"""Checkpoint create/list/get/restore - doc/api_event_contract.md SS7.1."""

import uuid

from bluebox.shared_kernel.domain.audit import Checkpoint
from bluebox.shared_kernel.ports import CheckpointRepository, DecisionLedgerRepository, SessionRepository

_STAGE_NAMES = {
    0: "Seed", 1: "Ideation", 2: "Actor Discovery", 3: "Capability Definition",
    4: "Use Case Decomposition", 5: "User Story Decomposition", 6: "Task Decomposition",
    7: "Completeness Gate", 8: "Code Generation", 9: "Runtime",
}


class CheckpointNotFoundError(Exception):
    def __init__(self, project_id: str, checkpoint_id: str) -> None:
        super().__init__(f"checkpoint {checkpoint_id!r} not found in project {project_id!r}")


class CheckpointService:
    def __init__(
        self,
        checkpoints: CheckpointRepository,
        decisions: DecisionLedgerRepository,
        sessions: SessionRepository,
    ) -> None:
        self._checkpoints = checkpoints
        self._decisions = decisions
        self._sessions = sessions

    def create(self, project_id: str, label: str, stage: int, created_by: str) -> Checkpoint:
        orchestrator = self._sessions.get_or_create(project_id)
        checkpoint = Checkpoint(
            checkpoint_id=f"CKPT-{uuid.uuid4().hex[:8].upper()}",
            stage=stage,
            stage_name=_STAGE_NAMES.get(stage, f"Stage {stage}"),
            label=label,
            current_state=orchestrator.current_state,
            decision_ledger_snapshot=self._decisions.list(project_id),
            created_by=created_by,
        )
        self._checkpoints.create(project_id, checkpoint)
        return checkpoint

    def list(self, project_id: str) -> list[Checkpoint]:
        return self._checkpoints.list(project_id)

    def get(self, project_id: str, checkpoint_id: str) -> Checkpoint:
        checkpoint = self._checkpoints.get(project_id, checkpoint_id)
        if checkpoint is None:
            raise CheckpointNotFoundError(project_id, checkpoint_id)
        return checkpoint

    def restore(self, project_id: str, checkpoint_id: str) -> Checkpoint:
        checkpoint = self.get(project_id, checkpoint_id)
        orchestrator = self._sessions.get_or_create(project_id)
        orchestrator.restore_to(
            checkpoint.current_state, reason=f"restored to checkpoint {checkpoint_id}"  # type: ignore[arg-type]
        )
        self._sessions.save(project_id, orchestrator)
        return checkpoint
