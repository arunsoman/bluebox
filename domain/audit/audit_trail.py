"""AuditTrail — append-only audit event log backed by TimescaleDB.

Every significant action in the pipeline is recorded as an AuditEvent:
  * Pipeline lifecycle (started, paused, resumed, completed)
  * Steering actions (accepted, modified, replaced, authorized)
  * Decision changes (logged, superseded, reverted)
  * RBAC operations (role created, permission granted, etc.)
  * Checkpoint events

Storage strategies:
  * DIFF:      Store only the delta between before/after state (default).
  * FULL:      Store complete snapshots.
  * REFERENCE: Store a pointer to a prior event + delta chain.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from domain.models import (
    AuditEvent,
    AuditTrailDTO,
    AuditQueryDTO,
    AuditActor,
    AuditTarget,
    AuditActionType,
    AuditActorType,
    StorageStrategy,
)
from infrastructure.persistence.timescaledb.engine import get_ts_session_factory


class AuditTrail:
    """Append-only audit trail service.

    Writes go to TimescaleDB (``audit_events`` hypertable).
    Queries support filtering by session, actor, action, and time range.
    """

    STORAGE_BUDGET_MB: int = 100  # Default audit storage budget in MB

    # ------------------------------------------------------------------ #
    # Write operations
    # ------------------------------------------------------------------ #

    async def write_event(
        self,
        session_id: str,
        event: AuditEvent,
    ) -> AuditEvent:
        """Write an audit event to TimescaleDB.

        The event is enriched with server-side timestamp and stored
        according to its ``storage_strategy``.

        Args:
            session_id: Pipeline session ID.
            event: The audit event to append.

        Returns:
            The persisted event (with any server-side defaults).
        """
        from sqlalchemy import text

        # Apply storage strategy transformation
        processed_event = self._apply_storage_strategy(
            event, event.storage_strategy
        )

        factory = get_ts_session_factory()
        async with factory() as db_session:
            # Use raw SQL for TimescaleDB hypertable inserts
            await db_session.execute(
                text(
                    """
                    INSERT INTO audit_events (
                        event_id, session_id, project_id, timestamp,
                        actor_type, user_id, action,
                        target_type, target_id, target_label,
                        before_state, after_state,
                        authorization_ref, storage_strategy, metadata, ip_address
                    ) VALUES (
                        :event_id, :session_id, :project_id, :timestamp,
                        :actor_type, :user_id, :action,
                        :target_type, :target_id, :target_label,
                        :before_state, :after_state,
                        :authorization_ref, :storage_strategy, :metadata, :ip_address
                    )
                    """
                ),
                {
                    "event_id": processed_event.event_id or str(uuid.uuid4()),
                    "session_id": session_id,
                    "project_id": processed_event.project_id or session_id,
                    "timestamp": processed_event.timestamp,
                    "actor_type": processed_event.actor.actor_type.value,
                    "user_id": processed_event.actor.user_id,
                    "action": processed_event.action.value,
                    "target_type": processed_event.target.target_type
                    if processed_event.target
                    else None,
                    "target_id": processed_event.target.target_id
                    if processed_event.target
                    else None,
                    "target_label": processed_event.target.target_label
                    if processed_event.target
                    else None,
                    "before_state": processed_event.before_state,
                    "after_state": processed_event.after_state,
                    "authorization_ref": processed_event.authorization_ref,
                    "storage_strategy": processed_event.storage_strategy.value,
                    "metadata": processed_event.metadata,
                    "ip_address": processed_event.ip_address,
                },
            )
            await db_session.commit()

        return processed_event

    # ------------------------------------------------------------------ #
    # Read operations
    # ------------------------------------------------------------------ #

    async def query_events(
        self,
        session_id: str,
        query: AuditQueryDTO,
    ) -> AuditTrailDTO:
        """Query audit events with filters.

        Args:
            session_id: Pipeline session ID.
            query: AuditQueryDTO with optional filters.

        Returns:
            AuditTrailDTO with matching events and storage usage.
        """
        from sqlalchemy import text

        factory = get_ts_session_factory()
        async with factory() as db_session:
            # Build dynamic WHERE clause
            conditions = ["session_id = :session_id"]
            params: dict[str, Any] = {"session_id": session_id}

            if query.action_type:
                conditions.append("action = :action")
                params["action"] = query.action_type.value

            if query.actor_id:
                conditions.append("user_id = :actor_id")
                params["actor_id"] = query.actor_id

            if query.date_from:
                conditions.append("timestamp >= :date_from")
                params["date_from"] = query.date_from

            if query.date_to:
                conditions.append("timestamp <= :date_to")
                params["date_to"] = query.date_to

            where_clause = " AND ".join(conditions)

            # Count total
            count_result = await db_session.execute(
                text(f"SELECT COUNT(*) FROM audit_events WHERE {where_clause}"),
                params,
            )
            total = count_result.scalar() or 0

            # Fetch paginated events
            offset = (query.page - 1) * query.page_size
            params["limit"] = query.page_size
            params["offset"] = offset

            result = await db_session.execute(
                text(
                    f"""
                    SELECT * FROM audit_events
                    WHERE {where_clause}
                    ORDER BY timestamp DESC
                    LIMIT :limit OFFSET :offset
                    """
                ),
                params,
            )
            rows = result.mappings().all()

            events = [_row_to_event(row) for row in rows]

            # Calculate storage usage
            storage_used = await self.get_storage_usage(session_id)

            return AuditTrailDTO(
                events=events,
                total=total,
                storage_strategy=StorageStrategy.DIFF,
                storage_used_percent=storage_used,
            )

    async def get_storage_usage(self, session_id: str) -> float:
        """Calculate the percentage of audit storage budget used for a session.

        Args:
            session_id: Pipeline session ID.

        Returns:
            Percentage (0.0–100.0) of the storage budget used.
        """
        from sqlalchemy import text

        factory = get_ts_session_factory()
        async with factory() as db_session:
            result = await db_session.execute(
                text(
                    """
                    SELECT COALESCE(SUM(pg_column_size(audit_events.*)), 0) AS bytes
                    FROM audit_events
                    WHERE session_id = :session_id
                    """
                ),
                {"session_id": session_id},
            )
            row = result.mappings().one_or_none()
            bytes_used = row["bytes"] if row else 0

        mb_used = bytes_used / (1024 * 1024)
        budget = self.STORAGE_BUDGET_MB
        return min(100.0, (mb_used / budget) * 100.0) if budget > 0 else 0.0

    # ------------------------------------------------------------------ #
    # Storage strategy
    # ------------------------------------------------------------------ #

    @staticmethod
    def _apply_storage_strategy(
        event: AuditEvent,
        strategy: StorageStrategy,
    ) -> AuditEvent:
        """Transform an event according to the storage strategy.

        DIFF:      Store only the delta between before/after.
        FULL:      Store complete snapshots (no-op transformation).
        REFERENCE: Store a pointer to the prior event + delta chain.

        Args:
            event: The raw audit event.
            strategy: The storage strategy to apply.

        Returns:
            The transformed audit event.
        """
        import copy

        if strategy == StorageStrategy.FULL:
            # Store everything as-is
            return event

        if strategy == StorageStrategy.DIFF:
            # Store only changed fields
            before = event.before_state or {}
            after = event.after_state or {}
            delta_before = {}
            delta_after = {}

            all_keys = set(before.keys()) | set(after.keys())
            for key in all_keys:
                if before.get(key) != after.get(key):
                    if key in before:
                        delta_before[key] = before[key]
                    if key in after:
                        delta_after[key] = after[key]

            return event.model_copy(
                update={
                    "before_state": delta_before,
                    "after_state": delta_after,
                }
            )

        if strategy == StorageStrategy.REFERENCE:
            # Store a pointer + minimal delta metadata
            return event.model_copy(
                update={
                    "before_state": {
                        "_strategy": "REFERENCE",
                        "_pointer": event.authorization_ref,
                    },
                    "after_state": {
                        "_action": event.action.value,
                        "_target_type": event.target.target_type if event.target else None,
                        "_target_id": event.target.target_id if event.target else None,
                    },
                }
            )

        # Unknown strategy — store as-is
        return event


# ------------------------------------------------------------------ #
# Helpers
# ------------------------------------------------------------------ #

def _row_to_event(row: Any) -> AuditEvent:
    """Map a TimescaleDB row (mapping) to a Pydantic AuditEvent."""
    return AuditEvent(
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
        authorization_ref=str(row["authorization_ref"]) if row["authorization_ref"] else None,
        storage_strategy=StorageStrategy(row["storage_strategy"]),
        metadata=row["metadata"] or {},
        ip_address=row["ip_address"],
    )
