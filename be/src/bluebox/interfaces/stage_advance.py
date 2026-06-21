"""Shared "run a generative stage and cache its panel" step.

Three call sites need this exact sequence - run the stage, cache the result
in `app_state.pending_candidates` (so `GET .../steering/{stage_id}` and a
reconnecting WS client can read it back), and build the `STEERING_PANEL_READY`
payload from it: the onboarding REST router (auto-advancing into the first
generative stage right after `/input` or a seed dialogue completes), the
steering REST router (auto-advancing into the next stage after an `accept`),
and the WS steering session (both of the above, over WS). Centralized here
so the three don't drift - see `be/CLAUDE.md`-adjacent context: this used to
only exist inside `interfaces/ws/steering_session.py`, which meant the two
REST-only paths the frontend actually drives never advanced past onboarding.
"""

from typing import Any

from bluebox.interfaces.api.deps import get_stage_service
from bluebox.interfaces.panel_builder import build_steering_panel
from bluebox.modules.core_pipeline.application.steering_service import generate_node_ids
from bluebox.modules.core_pipeline.domain.state_machine import StateTransitionRecord
from bluebox.modules.core_pipeline.llm.requests import TechStackSummary
from bluebox.modules.input_processing.llm.responses import Stage0Seed
from bluebox.shared_kernel.infrastructure.in_memory import app_state

FIRST_GENERATIVE_STAGE = 2
LAST_GENERATIVE_STAGE = 6


async def run_stage_and_cache(
    project_id: str,
    stage: int,
    *,
    context: str = "",
    seed: Stage0Seed | None = None,
    tech_stack: TechStackSummary | None = None,
) -> Any:
    stage_service = get_stage_service()
    candidates = await stage_service.run_stage(
        project_id, stage, context=context, seed=seed, tech_stack=tech_stack
    )
    # Generated once here and cached alongside `candidates` - every later
    # read of this stage's panel/accept/modify must reuse this exact list
    # (see `generate_node_ids`'s docstring), never regenerate it.
    node_ids = generate_node_ids(candidates)
    app_state.pending_candidates[project_id] = (stage, candidates, node_ids)
    return candidates


def steering_panel_ready_payload(project_id: str, stage: int, candidates: Any) -> dict:
    orchestrator = app_state.sessions.get_or_create(project_id)
    cached = app_state.pending_candidates.get(project_id)
    node_ids = cached[2] if cached is not None else generate_node_ids(candidates)
    return build_steering_panel(orchestrator, stage, candidates, node_ids)


def complete_pipeline_steering(project_id: str) -> list[StateTransitionRecord]:
    """`SteeringService.accept_all` always lands on `STAGE_RUNNING` (it
    doesn't know whether there's a next stage to run - see its docstring).
    For every stage before `LAST_GENERATIVE_STAGE` that's fine, the
    `run_stage_and_cache` call right after picks it back up - but accepting
    the *last* generative stage left `STAGE_RUNNING` with nothing left to
    run it into, since Stage 7 (the completeness gate) is rule-based, not a
    `StageService.run_stage` call. The orchestrator would sit at
    `STAGE_RUNNING` forever and the Steering Panel would wait for a panel
    that was never coming. `STAGE_RUNNING -> STAGE_COMPLETED -> FINAL_GATE`
    are both valid edges (state_machine.py's `TRANSITIONS`) and `FINAL_GATE`
    is exactly what `new-fe/src/pages/WorkspacePage.tsx` already watches
    `current_state` for to open `CompletenessGateModal` - the frontend has
    been ready for this transition, nothing was ever sending it."""

    orchestrator = app_state.sessions.get_or_create(project_id)
    records = [
        orchestrator.transition("STAGE_COMPLETED", reason="last generative stage accepted"),
        orchestrator.transition("FINAL_GATE", reason="entering completeness gate"),
    ]
    app_state.sessions.save(project_id, orchestrator)
    return records
