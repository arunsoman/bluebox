"""The pipeline state machine - doc/prd.md SS4.2, SS7.1-SS7.3.

Pure domain logic: no IO, no LLM calls, no persistence. Every future
application-layer use case (stage executors, steering handlers, the
revision flow) must go through `PipelineOrchestrator` before mutating
anything - this module is what makes "no state transition except via
explicit user action or system event" (doc/prd.md SS4.2) enforceable rather
than a convention.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from bluebox.modules.core_pipeline.domain.exceptions import (
    InvalidStateTransitionError,
    PipelinePausedError,
)
from bluebox.shared_kernel.domain.risk import RiskClassification

# doc/prd.md SS7.1, extended per a resolved spec gap: doc/api_event_contract.md
# SS3.1 PipelineStateEnum (19 states + ERROR) omits RESOLVING_CONFLICT and
# AWAITING_DEPLOYMENT_ACTION, both required by doc/prd.md SS7.1's transition
# table (AC-CG-09 merge conflicts, SS4.9 Stage 10 deployment). Decision: the
# backend enum is the PRD's 21 states + ERROR (22 total); new-fe's
# PipelineStateEnum needs the same two states added in a future
# frontend-touching pass.
PipelineState = Literal[
    "INITIALIZED",
    "CLASSIFYING",
    "AWAITING_INPUT_SEED",
    "STAGE_RUNNING",
    "STREAMING_CHUNKS",
    "AWAITING_STEERING",
    "REVISING",
    "IMPACT_ANALYZING",
    "AWAITING_PROPAGATION_CONSENT",
    "CHATTING",
    "STAGE_COMPLETED",
    "FINAL_GATE",
    "CODE_GENERATING",
    "RESOLVING_CONFLICT",
    "AWAITING_CODE_REVIEW",
    "RUNNING",
    "AWAITING_RUNTIME_FEEDBACK",
    "AWAITING_DEPLOYMENT_ACTION",
    "DEPLOYING",
    "DEPLOYED",
    "FINALIZED",
    "ERROR",
]

# doc/prd.md SS7.3 Risk-Based Steering Policies.
TrustMode = Literal["PARANOID", "BALANCED", "AUTO_PILOT"]

# doc/prd.md SS7.1 transition table. Terminal states map to an explicit
# empty frozenset, never an absent key (see test_pipeline_state_machine.py's
# structural coverage test). `ERROR` is appended to every non-terminal
# state's edge set: the PRD documents no fault edges explicitly, so "any
# state can fault" is the one inference made here. `ERROR`, `DEPLOYED`, and
# `FINALIZED` have no outgoing edges - recovery from `ERROR` and resumption
# after `DEPLOYED`/`FINALIZED` happen via checkpoint restore
# (`PipelineOrchestrator.restore_to`), which is deliberately not a regular
# transition.
TRANSITIONS: dict[PipelineState, frozenset[PipelineState]] = {
    "INITIALIZED": frozenset({"CLASSIFYING", "ERROR"}),
    "CLASSIFYING": frozenset({"AWAITING_INPUT_SEED", "STAGE_RUNNING", "ERROR"}),
    "AWAITING_INPUT_SEED": frozenset({"STAGE_RUNNING", "ERROR"}),
    "STAGE_RUNNING": frozenset({"STREAMING_CHUNKS", "STAGE_COMPLETED", "ERROR"}),
    "STREAMING_CHUNKS": frozenset({"AWAITING_STEERING", "STAGE_RUNNING", "ERROR"}),
    "AWAITING_STEERING": frozenset({"STAGE_RUNNING", "REVISING", "CHATTING", "ERROR"}),
    "REVISING": frozenset({"IMPACT_ANALYZING", "ERROR"}),
    "IMPACT_ANALYZING": frozenset({"AWAITING_PROPAGATION_CONSENT", "ERROR"}),
    "AWAITING_PROPAGATION_CONSENT": frozenset({"STAGE_RUNNING", "AWAITING_STEERING", "ERROR"}),
    "CHATTING": frozenset({"AWAITING_STEERING", "ERROR"}),
    "STAGE_COMPLETED": frozenset({"FINAL_GATE", "ERROR"}),
    "FINAL_GATE": frozenset({"AWAITING_STEERING", "CODE_GENERATING", "ERROR"}),
    "CODE_GENERATING": frozenset({"RESOLVING_CONFLICT", "AWAITING_CODE_REVIEW", "ERROR"}),
    "RESOLVING_CONFLICT": frozenset({"AWAITING_CODE_REVIEW", "ERROR"}),
    "AWAITING_CODE_REVIEW": frozenset({"CODE_GENERATING", "RUNNING", "ERROR"}),
    "RUNNING": frozenset({"AWAITING_RUNTIME_FEEDBACK", "ERROR"}),
    "AWAITING_RUNTIME_FEEDBACK": frozenset(
        {"AWAITING_DEPLOYMENT_ACTION", "FINALIZED", "ERROR"}
    ),
    "AWAITING_DEPLOYMENT_ACTION": frozenset({"DEPLOYING", "ERROR"}),
    "DEPLOYING": frozenset({"DEPLOYED", "ERROR"}),
    "DEPLOYED": frozenset(),
    "FINALIZED": frozenset(),
    "ERROR": frozenset(),
}

# States where advancing requires an explicit steering/consent action - see
# `PipelineOrchestrator.advance_from_steering`.
_STEERING_GATED_STATES: frozenset[PipelineState] = frozenset(
    {"AWAITING_STEERING", "AWAITING_PROPAGATION_CONSENT"}
)


class StateTransitionRecord(BaseModel):
    """doc/api_event_contract.md SS9.1 `STATE_TRANSITION` event payload, reused exactly."""

    model_config = ConfigDict(extra="forbid")

    from_state: PipelineState
    to_state: PipelineState
    reason: str
    timestamp: datetime = Field(default_factory=datetime.now)


class PipelineOrchestrator(BaseModel):
    """Single source of truth for one session's pipeline state.

    doc/prd.md SS4.2: "PipelineOrchestrator: Single source of truth for
    pipeline_state." Holding `history` here is a lightweight in-memory audit
    trail for this pass only - real persistence/audit storage is a future
    pass (doc/prd.md SS4.7 AuditTrailService).
    """

    model_config = ConfigDict(validate_assignment=True)

    current_state: PipelineState
    trust_mode: TrustMode = "BALANCED"
    history: list[StateTransitionRecord] = Field(default_factory=list)

    def transition(self, to: PipelineState, reason: str) -> StateTransitionRecord:
        """The general validated transition. Raises
        `InvalidStateTransitionError` if `to` is not a documented edge from
        `current_state`."""

        if to not in TRANSITIONS[self.current_state]:
            raise InvalidStateTransitionError(self.current_state, to)
        record = StateTransitionRecord(from_state=self.current_state, to_state=to, reason=reason)
        self.current_state = to
        self.history.append(record)
        return record

    def advance_from_steering(
        self, to: PipelineState, reason: str, *, steering_action_received: bool
    ) -> StateTransitionRecord:
        """doc/prd.md SS4.2: "Attempting `run_next_stage()` without a
        `STEERING_ACTION` throws `PipelinePausedError`." Use this instead of
        `transition()` whenever advancing out of a steering-gated state
        (`AWAITING_STEERING`, `AWAITING_PROPAGATION_CONSENT`) - it raises the
        specific business-rule error rather than the generic one when no
        steering action backs the call.
        """

        if self.current_state in _STEERING_GATED_STATES and not steering_action_received:
            raise PipelinePausedError(self.current_state)
        return self.transition(to, reason)

    def fault(self, reason: str) -> StateTransitionRecord:
        """Transition to `ERROR` from any non-terminal state."""

        return self.transition("ERROR", reason)

    def restore_to(self, state: PipelineState, reason: str) -> StateTransitionRecord:
        """Checkpoint restore (doc/prd.md AC-NF-06): jumps directly to
        `state` regardless of `TRANSITIONS`, since restoring to a prior
        checkpoint is not a normal forward edge in the FSM.
        """

        record = StateTransitionRecord(
            from_state=self.current_state, to_state=state, reason=reason
        )
        self.current_state = state
        self.history.append(record)
        return record

    def should_auto_approve(self, risk: RiskClassification) -> bool:
        """doc/prd.md SS7.3 trust-policy table. `CRITICAL` is never
        auto-approved regardless of `trust_mode`.
        """

        if risk == "CRITICAL":
            return False
        if self.trust_mode == "PARANOID":
            return False
        if self.trust_mode == "BALANCED":
            return risk == "LOW_RISK"
        return risk in ("LOW_RISK", "MEDIUM")  # AUTO_PILOT
