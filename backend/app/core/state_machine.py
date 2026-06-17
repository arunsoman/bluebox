"""Finite state machine and pipeline orchestrator."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator
from enum import Enum
from typing import TYPE_CHECKING

from app.core.events import EventBus
from app.core.exceptions import InvalidStateTransitionError, PipelinePausedError
from app.domain.models import DecisionLedger, ProjectBlueprint, StreamChunk
from app.stages.context_window import ContextWindowManager

if TYPE_CHECKING:
    from app.stages.factory import StageExecutorFactory

logger = logging.getLogger(__name__)


class PipelineState(str, Enum):
    INITIALIZED = "initialized"
    CLASSIFYING = "classifying"
    AWAITING_INPUT_SEED = "awaiting_input_seed"
    STAGE_RUNNING = "stage_running"
    STREAMING_CHUNKS = "streaming_chunks"
    AWAITING_STEERING = "awaiting_steering"
    REVISING = "revising"
    IMPACT_ANALYZING = "impact_analyzing"
    AWAITING_PROPAGATION_CONSENT = "awaiting_propagation_consent"
    CHATTING = "chatting"
    STAGE_COMPLETED = "stage_completed"
    FINAL_GATE = "final_gate"
    FINALIZED = "finalized"


VALID_TRANSITIONS: dict[PipelineState, list[PipelineState]] = {
    PipelineState.INITIALIZED: [PipelineState.CLASSIFYING],
    PipelineState.CLASSIFYING: [PipelineState.AWAITING_INPUT_SEED, PipelineState.STAGE_RUNNING],
    PipelineState.AWAITING_INPUT_SEED: [PipelineState.STAGE_RUNNING],
    PipelineState.STAGE_RUNNING: [PipelineState.STREAMING_CHUNKS, PipelineState.STAGE_COMPLETED],
    PipelineState.STREAMING_CHUNKS: [PipelineState.AWAITING_STEERING, PipelineState.STAGE_RUNNING],
    PipelineState.AWAITING_STEERING: [PipelineState.STAGE_RUNNING, PipelineState.REVISING, PipelineState.CHATTING],
    PipelineState.REVISING: [PipelineState.IMPACT_ANALYZING],
    PipelineState.IMPACT_ANALYZING: [PipelineState.AWAITING_PROPAGATION_CONSENT],
    PipelineState.AWAITING_PROPAGATION_CONSENT: [PipelineState.STAGE_RUNNING, PipelineState.AWAITING_STEERING],
    PipelineState.CHATTING: [PipelineState.AWAITING_STEERING],
    PipelineState.STAGE_COMPLETED: [PipelineState.FINAL_GATE],
    PipelineState.FINAL_GATE: [PipelineState.AWAITING_STEERING, PipelineState.FINALIZED],
    PipelineState.FINALIZED: [],
}


class PipelineOrchestrator:
    """Single source of truth for pipeline state."""

    def __init__(self, project_id: str, event_bus: EventBus):
        self.project_id = project_id
        self.state: PipelineState = PipelineState.INITIALIZED
        self.current_stage: int = -1  # -1 = pre-stage
        self.blueprint: ProjectBlueprint = ProjectBlueprint(project_id=project_id)
        self.ledger: DecisionLedger = DecisionLedger(project_id=project_id)
        self.event_bus = event_bus
        self._context_window: ContextWindowManager = ContextWindowManager()
        self._lock: asyncio.Lock = asyncio.Lock()

    async def validate_transition(self, to_state: PipelineState) -> None:
        if to_state not in VALID_TRANSITIONS.get(self.state, []):
            raise InvalidStateTransitionError(self.state.value, to_state.value)

    async def transition_to(self, to_state: PipelineState, reason: str = "") -> None:
        await self.validate_transition(to_state)
        from_state = self.state
        self.state = to_state
        await self.event_bus.emit("STATE_TRANSITION", {
            "project_id": self.project_id,
            "from_state": from_state.value,
            "to_state": to_state.value,
            "reason": reason,
        })

    async def run_next_stage(self, executor_factory: StageExecutorFactory) -> AsyncIterator[StreamChunk]:
        if self.state != PipelineState.AWAITING_STEERING and self.state != PipelineState.INITIALIZED:
            raise PipelinePausedError(f"Cannot run stage from state: {self.state}")
        # Determine next stage
        all_stages = executor_factory.get_all_stages()
        next_stage_idx = self.current_stage + 1
        if next_stage_idx >= len(all_stages):
            logger.info("All stages completed")
            return

        next_stage_id = all_stages[next_stage_idx]
        self.current_stage = next_stage_id
        executor = executor_factory.get_executor(next_stage_id)

        await self.transition_to(PipelineState.STAGE_RUNNING, f"Running stage {next_stage_id}")

        context: dict = {"user_input": self.blueprint.problem_statement}
        async for chunk in executor.execute(self.blueprint, context):
            yield chunk
