"""DecisionLedgerService — append-only decision log backed by PostgreSQL.

Every decision (accept, modify, replace, authorize, revert) is recorded as
an immutable entry.  Entries are never deleted; their status transitions
from ACTIVE → SUPERSEDED or CANCELLED.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from domain.models import (
    DecisionEntry,
    DecisionLedger,
    DecisionLedgerDTO,
    DecisionStatus,
    SteeringOption,
    DecisionMaker,
    AuthorizationScope,
)
from infrastructure.persistence.postgresql.models import DecisionEntryRecord
from infrastructure.persistence.postgresql.engine import get_session_factory


class DecisionLedgerService:
    """Service for append-only decision ledger operations.

    All writes go through PostgreSQL ``decision_entries`` table.
    The ledger is read-optimized with session-scoped indexes.
    """

    # ------------------------------------------------------------------ #
    # Write operations
    # ------------------------------------------------------------------ #

    async def log_decision(
        self,
        session_id: str,
        entry: DecisionEntry,
    ) -> DecisionEntry:
        """Persist a new decision entry.

        Args:
            session_id: The pipeline session that owns this decision.
            entry: The decision entry to append.

        Returns:
            The persisted entry (with any server-side defaults filled in).
        """
        factory = get_session_factory()
        async with factory() as db_session:
            record = DecisionEntryRecord(
                decision_id=entry.decision_id,
                session_id=session_id,
                stage=entry.stage,
                decision_point=entry.decision_point,
                chosen_option=entry.chosen_option.model_dump(mode="json") if entry.chosen_option else {},
                options_presented=[opt.model_dump(mode="json") for opt in entry.options_presented] if entry.options_presented else None,
                decision_maker=entry.decision_maker.value,
                authorization_scope=entry.authorization_scope.model_dump(mode="json") if entry.authorization_scope else None,
                status=entry.status.value,
                revision_chain=list(entry.revision_chain),
                reverted_from=entry.reverted_from,
                audit_event_id=entry.audit_event_id,
                created_at=entry.timestamp,
            )
            db_session.add(record)
            await db_session.commit()

        return entry

    async def supersede_decision(
        self,
        session_id: str,
        old_id: str,
        new_id: str,
    ) -> None:
        """Mark an existing decision as SUPERSEDED and link it to the replacement.

        Args:
            session_id: Pipeline session ID.
            old_id: Decision entry ID being superseded.
            new_id: New decision entry ID that replaces it.
        """
        factory = get_session_factory()
        async with factory() as db_session:
            result = await db_session.execute(
                select(DecisionEntryRecord).where(
                    and_(
                        DecisionEntryRecord.decision_id == old_id,
                        DecisionEntryRecord.session_id == session_id,
                    )
                )
            )
            record = result.scalar_one_or_none()
            if record is None:
                raise ValueError(f"Decision {old_id} not found in session {session_id}")

            record.status = DecisionStatus.SUPERSEDED.value
            revision_chain = list(record.revision_chain or [])
            revision_chain.append(new_id)
            record.revision_chain = revision_chain
            await db_session.commit()

    async def revert_decision(
        self,
        session_id: str,
        entry_id: str,
    ) -> DecisionEntry:
        """Revert a decision by creating a new REVERTED entry that points back.

        The original entry's status is left as-is (it may be SUPERSEDED
        already); the new entry captures the revert action.

        Args:
            session_id: Pipeline session ID.
            entry_id: The decision entry to revert.

        Returns:
            The newly created revert entry.
        """
        import uuid

        factory = get_session_factory()
        async with factory() as db_session:
            result = await db_session.execute(
                select(DecisionEntryRecord).where(
                    and_(
                        DecisionEntryRecord.decision_id == entry_id,
                        DecisionEntryRecord.session_id == session_id,
                    )
                )
            )
            original = result.scalar_one_or_none()
            if original is None:
                raise ValueError(f"Decision {entry_id} not found in session {session_id}")

            revert_entry = DecisionEntry(
                decision_id=str(uuid.uuid4()),
                stage=original.stage,
                decision_point=f"revert:{original.decision_point}",
                options_presented=[],
                chosen_option=None,
                decision_maker=DecisionMaker.USER,
                rationale_accepted=f"Reverted decision {entry_id}",
                status=DecisionStatus.ACTIVE,
                reverted_from=entry_id,
                timestamp=datetime.utcnow(),
            )

            record = DecisionEntryRecord(
                decision_id=revert_entry.decision_id,
                session_id=session_id,
                stage=revert_entry.stage,
                decision_point=revert_entry.decision_point,
                chosen_option={},
                options_presented=None,
                decision_maker=revert_entry.decision_maker.value,
                authorization_scope=None,
                status=revert_entry.status.value,
                reverted_from=entry_id,
                created_at=revert_entry.timestamp,
            )
            db_session.add(record)
            await db_session.commit()

        return revert_entry

    # ------------------------------------------------------------------ #
    # Read operations
    # ------------------------------------------------------------------ #

    async def get_entries(
        self,
        session_id: str,
        filter_status: str | None = None,
    ) -> DecisionLedgerDTO:
        """Retrieve the decision ledger for a session.

        Args:
            session_id: Pipeline session ID.
            filter_status: Optional status filter ("active", "superseded", "cancelled").

        Returns:
            A DecisionLedgerDTO containing all (or filtered) entries plus tallies.
        """
        factory = get_session_factory()
        async with factory() as db_session:
            query = select(DecisionEntryRecord).where(
                DecisionEntryRecord.session_id == session_id
            )
            if filter_status:
                query = query.where(DecisionEntryRecord.status == filter_status)
            query = query.order_by(DecisionEntryRecord.created_at)

            result = await db_session.execute(query)
            records = result.scalars().all()

            entries = [_record_to_entry(r) for r in records]

            total_user = sum(
                1 for e in entries if e.decision_maker == DecisionMaker.USER
            )
            total_system = sum(
                1
                for e in entries
                if e.decision_maker == DecisionMaker.SYSTEM_AUTHORIZED
            )
            total_superseded = sum(
                1 for e in entries if e.status == DecisionStatus.SUPERSEDED
            )
            total_reverted = sum(1 for e in entries if e.reverted_from is not None)

            return DecisionLedgerDTO(
                entries=entries,
                total_user_decisions=total_user,
                total_system_decisions=total_system,
                total_superseded=total_superseded,
                total_reverted=total_reverted,
            )

    async def export_ledger(
        self,
        session_id: str,
        format: str,
    ) -> dict[str, Any]:
        """Export the ledger in the requested format.

        Supported formats: "json", "csv_meta" (returns column metadata).

        Args:
            session_id: Pipeline session ID.
            format: Export format identifier.

        Returns:
            Dict suitable for JSON serialization or S3 storage.
        """
        dto = await self.get_entries(session_id)

        if format == "json":
            return {
                "session_id": session_id,
                "exported_at": datetime.utcnow().isoformat(),
                "format": "json",
                "entries": [e.model_dump(mode="json") for e in dto.entries],
                "totals": {
                    "user_decisions": dto.total_user_decisions,
                    "system_decisions": dto.total_system_decisions,
                    "superseded": dto.total_superseded,
                    "reverted": dto.total_reverted,
                },
            }

        if format == "csv_meta":
            return {
                "session_id": session_id,
                "format": "csv",
                "columns": [
                    "decision_id",
                    "stage",
                    "decision_point",
                    "decision_maker",
                    "status",
                    "created_at",
                ],
                "row_count": len(dto.entries),
            }

        raise ValueError(f"Unsupported export format: {format}")

    async def get_entry(
        self,
        session_id: str,
        decision_id: str,
    ) -> DecisionEntry | None:
        """Get a single decision entry by ID."""
        factory = get_session_factory()
        async with factory() as db_session:
            result = await db_session.execute(
                select(DecisionEntryRecord).where(
                    and_(
                        DecisionEntryRecord.decision_id == decision_id,
                        DecisionEntryRecord.session_id == session_id,
                    )
                )
            )
            record = result.scalar_one_or_none()
            return _record_to_entry(record) if record else None


# ------------------------------------------------------------------ #
# Helpers
# ------------------------------------------------------------------ #

def _record_to_entry(record: DecisionEntryRecord) -> DecisionEntry:
    """Map a SQLAlchemy DecisionEntryRecord to a Pydantic DecisionEntry."""
    chosen_raw = record.chosen_option if record.chosen_option else None
    chosen_option = None
    if chosen_raw and isinstance(chosen_raw, dict) and chosen_raw.get("option_id"):
        chosen_option = SteeringOption(**chosen_raw)

    options_presented: list[SteeringOption] = []
    if record.options_presented and isinstance(record.options_presented, list):
        for opt_raw in record.options_presented:
            if isinstance(opt_raw, dict) and opt_raw.get("option_id"):
                options_presented.append(SteeringOption(**opt_raw))

    auth_scope = None
    if record.authorization_scope and isinstance(record.authorization_scope, dict):
        auth_scope = AuthorizationScope(**record.authorization_scope)

    return DecisionEntry(
        decision_id=record.decision_id,
        stage=record.stage,
        decision_point=record.decision_point,
        options_presented=options_presented,
        chosen_option=chosen_option,
        decision_maker=DecisionMaker(record.decision_maker),
        authorization_scope=auth_scope,
        status=DecisionStatus(record.status),
        revision_chain=list(record.revision_chain or []),
        audit_event_id=record.audit_event_id or "",
        reverted_from=record.reverted_from,
        timestamp=record.created_at,
    )
