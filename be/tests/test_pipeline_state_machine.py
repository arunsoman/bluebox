"""Tests for the pipeline FSM - doc/prd.md SS7.1-SS7.3.

Pure domain logic, no fixtures beyond a fresh `PipelineOrchestrator` per test
- no IO, no LLM, no TestModel needed here (contrast with
test_llm_agents_smoke.py).
"""

import pytest

from bluebox.modules.core_pipeline.domain.exceptions import (
    InvalidStateTransitionError,
    PipelinePausedError,
)
from bluebox.modules.core_pipeline.domain.state_machine import (
    TRANSITIONS,
    PipelineOrchestrator,
    PipelineState,
    RiskClassification,
    TrustMode,
)

ALL_STATES: tuple[PipelineState, ...] = tuple(TRANSITIONS.keys())

# Every documented (from, to) edge, flattened for parametrization.
ALL_EDGES: list[tuple[PipelineState, PipelineState]] = [
    (from_state, to_state)
    for from_state, targets in TRANSITIONS.items()
    for to_state in targets
]


def test_transitions_covers_every_state() -> None:
    """22 states total (PRD's 21 + the contract-gap ERROR addition);
    every one must have an explicit (possibly empty) entry."""

    expected_states = {
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
    }
    assert set(TRANSITIONS.keys()) == expected_states
    assert len(expected_states) == 22


def test_terminal_states_have_no_outgoing_edges() -> None:
    assert TRANSITIONS["DEPLOYED"] == frozenset()
    assert TRANSITIONS["FINALIZED"] == frozenset()
    assert TRANSITIONS["ERROR"] == frozenset()


@pytest.mark.parametrize("from_state,to_state", ALL_EDGES, ids=[f"{f}->{t}" for f, t in ALL_EDGES])
def test_every_documented_edge_succeeds(from_state: PipelineState, to_state: PipelineState) -> None:
    orchestrator = PipelineOrchestrator(current_state=from_state)
    record = orchestrator.transition(to_state, reason="test")
    assert orchestrator.current_state == to_state
    assert orchestrator.history == [record]
    assert record.from_state == from_state
    assert record.to_state == to_state


@pytest.mark.parametrize(
    "from_state,to_state",
    [
        ("INITIALIZED", "RUNNING"),
        ("AWAITING_STEERING", "DEPLOYED"),
        ("DEPLOYED", "INITIALIZED"),
        ("FINALIZED", "RUNNING"),
        ("ERROR", "CLASSIFYING"),
        ("CHATTING", "REVISING"),
    ],
)
def test_undocumented_edges_rejected(from_state: PipelineState, to_state: PipelineState) -> None:
    orchestrator = PipelineOrchestrator(current_state=from_state)
    with pytest.raises(InvalidStateTransitionError):
        orchestrator.transition(to_state, reason="test")
    # rejection must not mutate state
    assert orchestrator.current_state == from_state
    assert orchestrator.history == []


def test_advance_from_steering_without_action_raises_paused() -> None:
    orchestrator = PipelineOrchestrator(current_state="AWAITING_STEERING")
    with pytest.raises(PipelinePausedError):
        orchestrator.advance_from_steering(
            "STAGE_RUNNING", reason="auto-advance attempt", steering_action_received=False
        )
    assert orchestrator.current_state == "AWAITING_STEERING"


def test_advance_from_steering_with_action_succeeds() -> None:
    orchestrator = PipelineOrchestrator(current_state="AWAITING_STEERING")
    record = orchestrator.advance_from_steering(
        "STAGE_RUNNING", reason="user accepted", steering_action_received=True
    )
    assert orchestrator.current_state == "STAGE_RUNNING"
    assert record.to_state == "STAGE_RUNNING"


def test_advance_from_steering_outside_gated_state_ignores_flag() -> None:
    """`advance_from_steering` only enforces the guard while sitting in a
    steering-gated state; elsewhere it behaves like a plain transition."""

    orchestrator = PipelineOrchestrator(current_state="STAGE_RUNNING")
    record = orchestrator.advance_from_steering(
        "STREAMING_CHUNKS", reason="LLM call started", steering_action_received=False
    )
    assert record.to_state == "STREAMING_CHUNKS"


def test_fault_reaches_error_from_arbitrary_state() -> None:
    orchestrator = PipelineOrchestrator(current_state="IMPACT_ANALYZING")
    record = orchestrator.fault(reason="unhandled exception")
    assert orchestrator.current_state == "ERROR"
    assert record.to_state == "ERROR"


def test_restore_to_bypasses_transition_table() -> None:
    """DEPLOYED has no outgoing edges, but checkpoint restore can still jump
    away from it."""

    orchestrator = PipelineOrchestrator(current_state="DEPLOYED")
    record = orchestrator.restore_to("STAGE_RUNNING", reason="checkpoint restore")
    assert orchestrator.current_state == "STAGE_RUNNING"
    assert record.reason == "checkpoint restore"


_TRUST_MODES: tuple[TrustMode, ...] = ("PARANOID", "BALANCED", "AUTO_PILOT")
_RISKS: tuple[RiskClassification, ...] = ("LOW_RISK", "MEDIUM", "HIGH", "CRITICAL")

# doc/prd.md SS7.3 table, transcribed as the expected (trust_mode, risk) -> bool matrix.
_EXPECTED_AUTO_APPROVE: dict[tuple[TrustMode, RiskClassification], bool] = {
    ("PARANOID", "LOW_RISK"): False,
    ("PARANOID", "MEDIUM"): False,
    ("PARANOID", "HIGH"): False,
    ("PARANOID", "CRITICAL"): False,
    ("BALANCED", "LOW_RISK"): True,
    ("BALANCED", "MEDIUM"): False,
    ("BALANCED", "HIGH"): False,
    ("BALANCED", "CRITICAL"): False,
    ("AUTO_PILOT", "LOW_RISK"): True,
    ("AUTO_PILOT", "MEDIUM"): True,
    ("AUTO_PILOT", "HIGH"): False,
    ("AUTO_PILOT", "CRITICAL"): False,
}


@pytest.mark.parametrize("trust_mode", _TRUST_MODES)
@pytest.mark.parametrize("risk", _RISKS)
def test_should_auto_approve_matrix(trust_mode: TrustMode, risk: RiskClassification) -> None:
    orchestrator = PipelineOrchestrator(current_state="AWAITING_STEERING", trust_mode=trust_mode)
    assert orchestrator.should_auto_approve(risk) == _EXPECTED_AUTO_APPROVE[(trust_mode, risk)]


def test_auto_approve_matrix_is_fully_specified() -> None:
    assert len(_EXPECTED_AUTO_APPROVE) == len(_TRUST_MODES) * len(_RISKS)
