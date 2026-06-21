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
    app_state.pending_candidates[project_id] = (stage, candidates)
    return candidates


def steering_panel_ready_payload(project_id: str, stage: int, candidates: Any) -> dict:
    orchestrator = app_state.sessions.get_or_create(project_id)
    return build_steering_panel(orchestrator, stage, candidates)
