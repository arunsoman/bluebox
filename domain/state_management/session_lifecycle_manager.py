"""SessionLifecycleManager — manages session suspend, resume, expiry, and re-auth.

Sessions transition through states:
  RUNNING → PAUSED (user action or idle timeout)
  PAUSED  → SUSPENDED (persisted, resources released)
  SUSPENDED → RUNNING (user resumes)

Expiry: Sessions older than 30 days are considered expired.
Re-auth: Sessions idle for 60 minutes require re-authentication.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import select

from domain.models import (
    PipelineSessionDTO,
    PipelineStatus,
    StageName,
    SessionPolicy,
)
from infrastructure.persistence.postgresql.models import PipelineSession
from infrastructure.persistence.postgresql.engine import get_session_factory
from infrastructure.persistence.redis.client import (
    cache_session,
    get_cached_session,
    delete_cached_session,
)
from infrastructure.messaging.sse_manager import sse_manager


class SessionLifecycleManager:
    """Manages the full lifecycle of a pipeline session."""

    def __init__(self, policy: SessionPolicy | None = None):
        self._policy = policy or SessionPolicy()

    # ------------------------------------------------------------------ #
    # Suspend
    # ------------------------------------------------------------------ #

    async def suspend(self, session_id: str) -> PipelineSessionDTO:
        """Suspend a session: persist state, release resources, emit event.

        1. Save state to PostgreSQL.
        2. Persist a final snapshot to Redis with longer TTL.
        3. Mark session as SUSPENDED.
        4. Emit ``SESSION_SUSPENDED`` via SSE.

        Args:
            session_id: Pipeline session ID.

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

            # Update status
            record.status = PipelineStatus.SUSPENDED.value
            record.suspended_at = datetime.utcnow()
            record.updated_at = datetime.utcnow()
            await db_session.commit()

            # Persist to Redis with extended TTL (24 hours)
            snapshot = {
                "session_id": record.session_id,
                "project_id": record.project_id,
                "user_id": record.user_id,
                "current_stage": record.current_stage,
                "status": record.status,
                "state_json": record.state_json,
                "suspended_at": record.suspended_at.isoformat() if record.suspended_at else None,
            }
            await cache_session(session_id, snapshot, ttl=86400)

        # Emit event
        await sse_manager.emit(
            session_id,
            "SESSION_SUSPENDED",
            {
                "session_id": session_id,
                "suspended_at": datetime.utcnow().isoformat(),
                "reason": "user_requested",
            },
        )

        return _record_to_dto(record)

    # ------------------------------------------------------------------ #
    # Resume
    # ------------------------------------------------------------------ #

    async def resume(self, session_id: str) -> PipelineSessionDTO:
        """Resume a suspended session.

        1. Try to load from Redis (fast path for recently suspended).
        2. Fall back to PostgreSQL.
        3. Mark session as PAUSED (ready for user to continue).
        4. Emit ``SESSION_RESUMED`` via SSE.

        Args:
            session_id: Pipeline session ID.

        Returns:
            Updated PipelineSessionDTO.
        """
        # Try Redis first
        cached = await get_cached_session(session_id)

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

            # If we have cached state, restore any fields that might have
            # been updated while suspended
            if cached:
                cached_state = cached.get("state_json", {})
                if cached_state:
                    current_state = dict(record.state_json or {})
                    current_state.update(cached_state)
                    record.state_json = current_state

            # Mark as PAUSED (user can then continue from where they left off)
            record.status = PipelineStatus.PAUSED.value
            record.suspended_at = None
            record.updated_at = datetime.utcnow()
            await db_session.commit()

        # Refresh cache with standard TTL
        await cache_session(session_id, {
            "session_id": record.session_id,
            "project_id": record.project_id,
            "user_id": record.user_id,
            "current_stage": record.current_stage,
            "status": record.status,
            "state_json": record.state_json,
        }, ttl=1800)

        # Emit event
        await sse_manager.emit(
            session_id,
            "SESSION_RESUMED",
            {
                "session_id": session_id,
                "resumed_at": datetime.utcnow().isoformat(),
                "current_stage": record.current_stage,
            },
        )

        return _record_to_dto(record)

    # ------------------------------------------------------------------ #
    # Expiry check
    # ------------------------------------------------------------------ #

    async def check_expiry(self, session_id: str) -> bool:
        """Check whether a session has expired (30 days old).

        Args:
            session_id: Pipeline session ID.

        Returns:
            True if the session has expired.
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
                return True  # Non-existent = expired

            expiry_threshold = datetime.utcnow() - timedelta(
                days=self._policy.idle_expire_days
            )
            return record.created_at < expiry_threshold

    # ------------------------------------------------------------------ #
    # Re-auth check
    # ------------------------------------------------------------------ #

    async def check_reauth(self, session_id: str) -> bool:
        """Check whether a session requires re-authentication (60 min idle).

        Uses the ``updated_at`` field as a proxy for last activity.

        Args:
            session_id: Pipeline session ID.

        Returns:
            True if re-authentication is required.
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
                return True  # Non-existent = needs re-auth

            reauth_threshold = datetime.utcnow() - timedelta(
                minutes=self._policy.session_reauth_idle_minutes
            )
            return record.updated_at < reauth_threshold

    # ------------------------------------------------------------------ #
    # Touch (keep-alive)
    # ------------------------------------------------------------------ #

    async def touch(self, session_id: str) -> PipelineSessionDTO:
        """Update the session's ``updated_at`` timestamp (keep-alive).

        Args:
            session_id: Pipeline session ID.

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

            record.updated_at = datetime.utcnow()
            await db_session.commit()

        return _record_to_dto(record)


# ------------------------------------------------------------------ #
# Helpers
# ------------------------------------------------------------------ #

def _record_to_dto(record: PipelineSession) -> PipelineSessionDTO:
    """Map a PipelineSession record to a PipelineSessionDTO."""
    from domain.models import RichnessMode

    return PipelineSessionDTO(
        session_id=record.session_id,
        project_id=record.project_id,
        user_id=record.user_id,
        current_stage=StageName(record.current_stage) if record.current_stage else None,
        status=PipelineStatus(record.status),
        richness_mode=RichnessMode(record.richness_mode) if record.richness_mode else None,
        created_at=record.created_at,
    )
