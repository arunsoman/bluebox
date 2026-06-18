"""CheckpointManager — creates, lists, and restores pipeline checkpoints.

Checkpoints are full snapshots of pipeline state + decision ledger,
compressed and stored in S3/MinIO.  They provide a recovery point for
LLM failures, user-initiated rollback, and session migration.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from domain.models import (
    Checkpoint,
    CheckpointListDTO,
    PipelineStatus,
    DecisionLedger,
    DecisionStatus,
)
from infrastructure.persistence.postgresql.models import (
    PipelineSession,
    CheckpointRecord,
)
from infrastructure.persistence.postgresql.engine import get_session_factory
from infrastructure.persistence.s3.client import (
    store_checkpoint as s3_store_checkpoint,
    load_checkpoint as s3_load_checkpoint,
    list_checkpoints as s3_list_checkpoints,
)
from infrastructure.persistence.redis.client import delete_cached_session
from infrastructure.messaging.sse_manager import sse_manager


class CheckpointManager:
    """Manages checkpoint lifecycle: create, list, restore.

    Checkpoints are stored in S3/MinIO as compressed JSON.  The PostgreSQL
    ``checkpoints`` table holds metadata (ID, stage, label, S3 key).
    """

    # ------------------------------------------------------------------ #
    # Create
    # ------------------------------------------------------------------ #

    async def create_checkpoint(
        self,
        session_id: str,
        stage: str,
        label: str,
    ) -> Checkpoint:
        """Create a checkpoint of the current pipeline state.

        1. Load full session state from PostgreSQL.
        2. Snapshot the decision ledger.
        3. Compress and store in S3.
        4. Record metadata in PostgreSQL.
        5. Emit ``CHECKPOINT_CREATED`` via SSE.

        Args:
            session_id: Pipeline session ID.
            stage: The stage that was just completed.
            label: Human-readable label for the checkpoint.

        Returns:
            The created Checkpoint.
        """
        factory = get_session_factory()
        async with factory() as db_session:
            result = await db_session.execute(
                select(PipelineSession).where(
                    PipelineSession.session_id == session_id
                )
            )
            session_record = result.scalar_one_or_none()
            if session_record is None:
                raise ValueError(f"Session {session_id} not found")

            # Gather state snapshot
            state_snapshot = {
                "session_id": session_id,
                "project_id": session_record.project_id,
                "user_id": session_record.user_id,
                "current_stage": session_record.current_stage,
                "status": session_record.status,
                "state_json": session_record.state_json,
                "richness_mode": session_record.richness_mode,
                "created_at": session_record.created_at.isoformat(),
                "checkpointed_at": datetime.utcnow().isoformat(),
                "stage": stage,
            }

            # Gather decision ledger snapshot
            from domain.decision_management.decision_ledger import DecisionLedgerService

            ledger_service = DecisionLedgerService()
            ledger_dto = await ledger_service.get_entries(session_id)
            ledger_snapshot = {
                "session_id": session_id,
                "entries": [e.model_dump(mode="json") for e in ledger_dto.entries],
                "totals": {
                    "user_decisions": ledger_dto.total_user_decisions,
                    "system_decisions": ledger_dto.total_system_decisions,
                    "superseded": ledger_dto.total_superseded,
                    "reverted": ledger_dto.total_reverted,
                },
            }

            # Build checkpoint
            checkpoint_id = str(uuid.uuid4())
            checkpoint = Checkpoint(
                checkpoint_id=checkpoint_id,
                stage_completed=stage,
                pipeline_state_snapshot=state_snapshot,
                decision_ledger_snapshot=DecisionLedger(
                    session_id=session_id,
                    entries=ledger_dto.entries,
                    total_user_decisions=ledger_dto.total_user_decisions,
                    total_system_decisions=ledger_dto.total_system_decisions,
                    total_superseded=ledger_dto.total_superseded,
                    total_reverted=ledger_dto.total_reverted,
                ),
                created_at=datetime.utcnow(),
                label=label,
            )

            # Store to S3
            s3_data = {
                "checkpoint_id": checkpoint_id,
                "stage_completed": stage,
                "pipeline_state_snapshot": state_snapshot,
                "decision_ledger_snapshot": checkpoint.decision_ledger_snapshot.model_dump(
                    mode="json"
                )
                if checkpoint.decision_ledger_snapshot
                else {},
                "created_at": checkpoint.created_at.isoformat(),
                "label": label,
            }
            s3_key = s3_store_checkpoint(session_id, checkpoint_id, s3_data)

            # Record metadata in PostgreSQL
            record = CheckpointRecord(
                checkpoint_id=checkpoint_id,
                session_id=session_id,
                stage_completed=stage,
                pipeline_state_snapshot=state_snapshot,
                decision_ledger_snapshot=ledger_snapshot,
                label=label,
                s3_key=s3_key,
            )
            db_session.add(record)
            await db_session.commit()

        # Emit event
        await sse_manager.emit_checkpoint_created(
            session_id,
            {
                "checkpoint_id": checkpoint_id,
                "stage": stage,
                "label": label,
                "s3_key": s3_key,
                "created_at": checkpoint.created_at.isoformat(),
            },
        )

        return checkpoint

    # ------------------------------------------------------------------ #
    # List
    # ------------------------------------------------------------------ #

    async def list_checkpoints(self, session_id: str) -> CheckpointListDTO:
        """List all checkpoints for a session.

        Args:
            session_id: Pipeline session ID.

        Returns:
            CheckpointListDTO with all checkpoints.
        """
        factory = get_session_factory()
        async with factory() as db_session:
            result = await db_session.execute(
                select(CheckpointRecord)
                .where(CheckpointRecord.session_id == session_id)
                .order_by(CheckpointRecord.created_at.desc())
            )
            records = result.scalars().all()

            checkpoints = [
                Checkpoint(
                    checkpoint_id=r.checkpoint_id,
                    stage_completed=r.stage_completed,
                    pipeline_state_snapshot=r.pipeline_state_snapshot or {},
                    decision_ledger_snapshot=None,  # Loaded on demand via restore
                    created_at=r.created_at,
                    label=r.label,
                )
                for r in records
            ]

            return CheckpointListDTO(checkpoints=checkpoints)

    # ------------------------------------------------------------------ #
    # Restore
    # ------------------------------------------------------------------ #

    async def restore_checkpoint(
        self,
        session_id: str,
        checkpoint_id: str,
    ) -> dict[str, Any]:
        """Restore pipeline state from a checkpoint.

        1. Load checkpoint metadata from PostgreSQL.
        2. Load full snapshot from S3.
        3. Restore session state in PostgreSQL.
        4. Mark post-checkpoint decisions as superseded.
        5. Invalidate Redis cache.
        6. Emit ``CHECKPOINT_RESTORED`` via SSE.

        Args:
            session_id: Pipeline session ID.
            checkpoint_id: The checkpoint to restore.

        Returns:
            The restored pipeline state snapshot.
        """
        factory = get_session_factory()
        async with factory() as db_session:
            result = await db_session.execute(
                select(CheckpointRecord).where(
                    CheckpointRecord.checkpoint_id == checkpoint_id,
                    CheckpointRecord.session_id == session_id,
                )
            )
            record = result.scalar_one_or_none()
            if record is None:
                raise ValueError(
                    f"Checkpoint {checkpoint_id} not found for session {session_id}"
                )

            # Load from S3
            s3_data = s3_load_checkpoint(record.s3_key) if record.s3_key else {}
            state_snapshot = (
                s3_data.get("pipeline_state_snapshot")
                or record.pipeline_state_snapshot
                or {}
            )

            # Restore session state
            session_result = await db_session.execute(
                select(PipelineSession).where(
                    PipelineSession.session_id == session_id
                )
            )
            session_record = session_result.scalar_one_or_none()
            if session_record is None:
                raise ValueError(f"Session {session_id} not found")

            # Restore state fields
            restored_state = state_snapshot.get("state_json", {})
            session_record.state_json = restored_state
            session_record.current_stage = state_snapshot.get("current_stage")
            session_record.status = PipelineStatus.PAUSED.value
            session_record.updated_at = datetime.utcnow()
            await db_session.commit()

            # Mark post-checkpoint decisions as superseded
            await self._supersede_post_checkpoint_decisions(
                session_id, record.created_at, db_session
            )
            await db_session.commit()

        # Invalidate cache
        await delete_cached_session(session_id)

        # Emit event
        await sse_manager.emit(
            session_id,
            "CHECKPOINT_RESTORED",
            {
                "checkpoint_id": checkpoint_id,
                "stage_restored_to": record.stage_completed,
                "session_id": session_id,
                "timestamp": datetime.utcnow().isoformat(),
            },
        )

        return state_snapshot

    # ------------------------------------------------------------------ #
    # Internals
    # ------------------------------------------------------------------ #

    async def _supersede_post_checkpoint_decisions(
        self,
        session_id: str,
        checkpoint_time: datetime,
        db_session: AsyncSession,
    ) -> None:
        """Mark decisions created after the checkpoint as superseded."""
        from infrastructure.persistence.postgresql.models import DecisionEntryRecord
        from sqlalchemy import update

        await db_session.execute(
            update(DecisionEntryRecord)
            .where(
                DecisionEntryRecord.session_id == session_id,
                DecisionEntryRecord.created_at > checkpoint_time,
                DecisionEntryRecord.status == DecisionStatus.ACTIVE.value,
            )
            .values(status=DecisionStatus.SUPERSEDED.value)
        )
