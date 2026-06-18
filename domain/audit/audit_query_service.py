"""AuditQueryService — domain-level query interface for the audit trail.

Provides convenience methods for the most common audit query patterns
without exposing raw SQL to callers.
"""
from __future__ import annotations

from datetime import datetime

from domain.models import (
    AuditTrailDTO,
    AuditActionType,
    AuditQueryDTO,
    StorageStrategy,
    AuditEvent,
)
from domain.audit.audit_trail import AuditTrail


class AuditQueryService:
    """Service for querying audit events by common dimensions.

    Delegates storage access to :class:`AuditTrail` and provides
    paginated, typed results.
    """

    def __init__(self, audit_trail: AuditTrail | None = None):
        self._audit = audit_trail or AuditTrail()

    # ------------------------------------------------------------------ #
    # Session-scoped queries
    # ------------------------------------------------------------------ #

    async def query_by_session(
        self,
        session_id: str,
        page: int = 1,
        page_size: int = 50,
    ) -> AuditTrailDTO:
        """Retrieve all audit events for a session, newest first.

        Args:
            session_id: Pipeline session ID.
            page: 1-based page number.
            page_size: Number of events per page.

        Returns:
            Paginated AuditTrailDTO.
        """
        query = AuditQueryDTO(page=page, page_size=page_size)
        return await self._audit.query_events(session_id, query)

    async def query_by_actor(
        self,
        user_id: str,
        page: int = 1,
        page_size: int = 50,
    ) -> AuditTrailDTO:
        """Retrieve audit events by actor (user_id), across all sessions.

        Args:
            user_id: The user / actor ID.
            page: 1-based page number.
            page_size: Number of events per page.

        Returns:
            Paginated AuditTrailDTO.
        """
        from sqlalchemy import text
        from infrastructure.persistence.timescaledb.engine import get_ts_session_factory
        from domain.models import AuditActor, AuditTarget, AuditActorType, AuditActionType, StorageStrategy

        factory = get_ts_session_factory()
        async with factory() as db_session:
            # Count total
            count_result = await db_session.execute(
                text("SELECT COUNT(*) FROM audit_events WHERE user_id = :user_id"),
                {"user_id": user_id},
            )
            total = count_result.scalar() or 0

            # Fetch events
            offset = (page - 1) * page_size
            result = await db_session.execute(
                text(
                    """
                    SELECT * FROM audit_events
                    WHERE user_id = :user_id
                    ORDER BY timestamp DESC
                    LIMIT :limit OFFSET :offset
                    """
                ),
                {"user_id": user_id, "limit": page_size, "offset": offset},
            )
            rows = result.mappings().all()

            events = []
            for row in rows:
                events.append(
                    AuditEvent(
                        event_id=str(row["event_id"]),
                        session_id=str(row["session_id"]),
                        project_id=str(row["project_id"]),
                        timestamp=row["timestamp"],
                        actor=AuditActor(
                            actor_type=AuditActorType(row["actor_type"]),
                            user_id=str(row["user_id"]) if row["user_id"] else None,
                            session_id=str(row["session_id"]),
                        ),
                        action=AuditActionType(row["action"]),
                        target=AuditTarget(
                            target_type=row["target_type"] or "",
                            target_id=str(row["target_id"]) if row["target_id"] else "",
                            target_label=row["target_label"] or "",
                        )
                        if row["target_type"]
                        else None,
                        before_state=row["before_state"] or {},
                        after_state=row["after_state"] or {},
                        authorization_ref=str(row["authorization_ref"])
                        if row["authorization_ref"]
                        else None,
                        storage_strategy=StorageStrategy(row["storage_strategy"]),
                        metadata=row["metadata"] or {},
                        ip_address=row["ip_address"],
                    )
                )

            return AuditTrailDTO(
                events=events,
                total=total,
                storage_strategy=StorageStrategy.DIFF,
                storage_used_percent=0.0,
            )

    async def query_by_action(
        self,
        action: AuditActionType,
        page: int = 1,
        page_size: int = 50,
    ) -> AuditTrailDTO:
        """Retrieve audit events filtered by action type.

        Args:
            action: The AuditActionType to filter by.
            page: 1-based page number.
            page_size: Number of events per page.

        Returns:
            Paginated AuditTrailDTO.
        """
        from sqlalchemy import text
        from infrastructure.persistence.timescaledb.engine import get_ts_session_factory
        from domain.models import AuditActor, AuditTarget, AuditActorType, StorageStrategy

        factory = get_ts_session_factory()
        async with factory() as db_session:
            count_result = await db_session.execute(
                text("SELECT COUNT(*) FROM audit_events WHERE action = :action"),
                {"action": action.value},
            )
            total = count_result.scalar() or 0

            offset = (page - 1) * page_size
            result = await db_session.execute(
                text(
                    """
                    SELECT * FROM audit_events
                    WHERE action = :action
                    ORDER BY timestamp DESC
                    LIMIT :limit OFFSET :offset
                    """
                ),
                {"action": action.value, "limit": page_size, "offset": offset},
            )
            rows = result.mappings().all()

            events = []
            for row in rows:
                events.append(
                    AuditEvent(
                        event_id=str(row["event_id"]),
                        session_id=str(row["session_id"]),
                        project_id=str(row["project_id"]),
                        timestamp=row["timestamp"],
                        actor=AuditActor(
                            actor_type=AuditActorType(row["actor_type"]),
                            user_id=str(row["user_id"]) if row["user_id"] else None,
                            session_id=str(row["session_id"]),
                        ),
                        action=AuditActionType(row["action"]),
                        target=AuditTarget(
                            target_type=row["target_type"] or "",
                            target_id=str(row["target_id"]) if row["target_id"] else "",
                            target_label=row["target_label"] or "",
                        )
                        if row["target_type"]
                        else None,
                        before_state=row["before_state"] or {},
                        after_state=row["after_state"] or {},
                        authorization_ref=str(row["authorization_ref"])
                        if row["authorization_ref"]
                        else None,
                        storage_strategy=StorageStrategy(row["storage_strategy"]),
                        metadata=row["metadata"] or {},
                        ip_address=row["ip_address"],
                    )
                )

            return AuditTrailDTO(
                events=events,
                total=total,
                storage_strategy=StorageStrategy.DIFF,
                storage_used_percent=0.0,
            )

    async def query_by_time_range(
        self,
        session_id: str,
        date_from: datetime,
        date_to: datetime,
        page: int = 1,
        page_size: int = 50,
    ) -> AuditTrailDTO:
        """Retrieve audit events within a time range for a session.

        Args:
            session_id: Pipeline session ID.
            date_from: Start of the time range (inclusive).
            date_to: End of the time range (inclusive).
            page: 1-based page number.
            page_size: Number of events per page.

        Returns:
            Paginated AuditTrailDTO.
        """
        query = AuditQueryDTO(
            date_from=date_from,
            date_to=date_to,
            page=page,
            page_size=page_size,
        )
        return await self._audit.query_events(session_id, query)
