"""PipelineStateManager — reads and writes pipeline session state.

State is stored in PostgreSQL (authoritative) and cached in Redis
(access layer).  All updates are atomic: write to PostgreSQL first,
then invalidate the Redis cache.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from domain.models import (
    PipelineSessionDTO,
    PipelineStatus,
    StageName,
    RichnessMode,
)
from infrastructure.persistence.postgresql.models import PipelineSession
from infrastructure.persistence.postgresql.engine import get_session_factory
from infrastructure.persistence.redis.client import (
    cache_session,
    get_cached_session,
    delete_cached_session,
)


class PipelineStateManager:
    """Manages the lifecycle of pipeline session state.

    Provides CRUD operations for sessions with a two-tier storage
    strategy: PostgreSQL as the source of truth, Redis as a hot cache.
    """

    DEFAULT_SESSION_TTL_SECONDS: int = 1800  # 30 minutes

    # ------------------------------------------------------------------ #
    # Read operations
    # ------------------------------------------------------------------ #

    async def get_state(self, session_id: str) -> dict[str, Any]:
        """Get the current pipeline state for a session.

        Reads from Redis first (fast path), falls back to PostgreSQL.

        Args:
            session_id: The session ID.

        Returns:
            The session state as a dict.
        """
        # Try Redis cache first
        cached = await get_cached_session(session_id)
        if cached:
            return cached.get("state_json", {})

        # Fall back to PostgreSQL
        factory = get_session_factory()
        async with factory() as db_session:
            result = await db_session.execute(
                select(PipelineSession).where(
                    PipelineSession.session_id == session_id
                )
            )
            record = result.scalar_one_or_none()
            if record is None:
                raise ValueError(f"Session {session_id} not found")

            state = record.state_json or {}

            # Populate cache
            await self._refresh_cache(record)
            return state

    async def get_session(self, session_id: str) -> PipelineSessionDTO:
        """Get a session as a DTO.

        Args:
            session_id: The session ID.

        Returns:
            PipelineSessionDTO.
        """
        factory = get_session_factory()
        async with factory() as db_session:
            result = await db_session.execute(
                select(PipelineSession).where(
                    PipelineSession.session_id == session_id
                )
            )
            record = result.scalar_one_or_none()
            if record is None:
                raise ValueError(f"Session {session_id} not found")

            return _record_to_dto(record)

    async def list_sessions(self, user_id: str) -> list[PipelineSessionDTO]:
        """List all sessions for a user.

        Args:
            user_id: The user ID.

        Returns:
            List of PipelineSessionDTOs, newest first.
        """
        factory = get_session_factory()
        async with factory() as db_session:
            result = await db_session.execute(
                select(PipelineSession)
                .where(PipelineSession.user_id == user_id)
                .order_by(PipelineSession.created_at.desc())
            )
            records = result.scalars().all()
            return [_record_to_dto(r) for r in records]

    # ------------------------------------------------------------------ #
    # Write operations
    # ------------------------------------------------------------------ #

    async def create_session(
        self,
        user_id: str,
        project_name: str | None = None,
    ) -> PipelineSessionDTO:
        """Create a new pipeline session.

        Args:
            user_id: The user who owns the session.
            project_name: Optional project name.

        Returns:
            The newly created PipelineSessionDTO.
        """
        session_id = str(uuid.uuid4())
        project_id = str(uuid.uuid4())

        factory = get_session_factory()
        async with factory() as db_session:
            record = PipelineSession(
                session_id=session_id,
                project_id=project_id,
                user_id=user_id,
                status=PipelineStatus.IDLE.value,
                state_json={"project_name": project_name or "", "stage_outputs": {}},
                current_stage=None,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db_session.add(record)
            await db_session.commit()

        dto = _record_to_dto(record)

        # Cache the new session
        await cache_session(
            session_id,
            dto.model_dump(mode="json"),
            ttl=self.DEFAULT_SESSION_TTL_SECONDS,
        )

        return dto

    async def update_state(
        self,
        session_id: str,
        updates: dict[str, Any],
    ) -> dict[str, Any]:
        """Atomically update session state.

        Merges ``updates`` into the existing state_json in PostgreSQL
        and invalidates the Redis cache.

        Args:
            session_id: The session ID.
            updates: Key-value pairs to merge into the state.

        Returns:
            The updated full state.
        """
        factory = get_session_factory()
        async with factory() as db_session:
            result = await db_session.execute(
                select(PipelineSession).where(
                    PipelineSession.session_id == session_id
                )
            )
            record = result.scalar_one_or_none()
            if record is None:
                raise ValueError(f"Session {session_id} not found")

            # Merge updates into existing state
            current_state = dict(record.state_json or {})
            current_state.update(updates)
            record.state_json = current_state
            record.updated_at = datetime.utcnow()

            await db_session.commit()

            # Invalidate and refresh cache
            await delete_cached_session(session_id)
            await self._refresh_cache(record)

            return current_state

    async def set_status(
        self,
        session_id: str,
        status: PipelineStatus,
    ) -> PipelineSessionDTO:
        """Update the pipeline status for a session.

        Args:
            session_id: The session ID.
            status: The new pipeline status.

        Returns:
            Updated PipelineSessionDTO.
        """
        factory = get_session_factory()
        async with factory() as db_session:
            result = await db_session.execute(
                select(PipelineSession).where(
                    PipelineSession.session_id == session_id
                )
            )
            record = result.scalar_one_or_none()
            if record is None:
                raise ValueError(f"Session {session_id} not found")

            record.status = status.value
            record.updated_at = datetime.utcnow()
            await db_session.commit()

            # Invalidate cache
            await delete_cached_session(session_id)
            await self._refresh_cache(record)

            return _record_to_dto(record)

    async def set_current_stage(
        self,
        session_id: str,
        stage: StageName | None,
    ) -> PipelineSessionDTO:
        """Set the current pipeline stage for a session.

        Args:
            session_id: The session ID.
            stage: The current stage, or None to clear.

        Returns:
            Updated PipelineSessionDTO.
        """
        factory = get_session_factory()
        async with factory() as db_session:
            result = await db_session.execute(
                select(PipelineSession).where(
                    PipelineSession.session_id == session_id
                )
            )
            record = result.scalar_one_or_none()
            if record is None:
                raise ValueError(f"Session {session_id} not found")

            record.current_stage = stage.value if stage else None
            record.updated_at = datetime.utcnow()
            await db_session.commit()

            await delete_cached_session(session_id)
            await self._refresh_cache(record)

            return _record_to_dto(record)

    # ------------------------------------------------------------------ #
    # Cache helpers
    # ------------------------------------------------------------------ #

    async def _refresh_cache(self, record: PipelineSession) -> None:
        """Write a session record to the Redis cache."""
        dto = _record_to_dto(record)
        await cache_session(
            record.session_id,
            dto.model_dump(mode="json"),
            ttl=self.DEFAULT_SESSION_TTL_SECONDS,
        )


# ------------------------------------------------------------------ #
# Helpers
# ------------------------------------------------------------------ #

def _record_to_dto(record: PipelineSession) -> PipelineSessionDTO:
    """Map a PipelineSession SQLAlchemy record to a PipelineSessionDTO."""
    return PipelineSessionDTO(
        session_id=record.session_id,
        project_id=record.project_id,
        user_id=record.user_id,
        current_stage=StageName(record.current_stage) if record.current_stage else None,
        status=PipelineStatus(record.status),
        richness_mode=RichnessMode(record.richness_mode) if record.richness_mode else None,
        created_at=record.created_at,
    )
