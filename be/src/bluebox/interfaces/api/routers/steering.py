"""doc/api_event_contract.md SS4.2 Steering Panel.

Stage generation has no dedicated "run" endpoint in the contract - the
`SteeringPanel` is expected to already be populated (pushed via WS
`STEERING_PANEL_READY` in the real flow). `POST .../steering/{stage_id}/generate`
is a pragmatic extra route for manual/non-WS testing - `GET
.../steering/{stage_id}` then just reads back whatever was last generated
for that stage from `app_state.pending_candidates`. `submit_action` below
*is* the real driver of that flow, though: the frontend calls this REST
route (not the WS `STEERING_ACTION` event - see `steeringStore.submitAction`),
so accepting a stage auto-advances into the next one and broadcasts the
next `STEERING_PANEL_READY` over WS itself, mirroring what
`interfaces/ws/steering_session.py`'s `_handle_steering_action` does for the
WS-driven path.

Only `action_type="accept"` is wired to `SteeringService.accept_all`.
`modify`/`replace`/`authorize` are accepted by the schema (so the contract
shape round-trips) but rejected with a 400 - `SteeringService` doesn't
implement those paths yet (see its module docstring), and a REST handler
silently no-op'ing them would be exactly the kind of fabricated behavior
CLAUDE.md rules out for the frontend.
"""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict

from bluebox.interfaces.api.deps import get_stage_service, get_steering_service
from bluebox.interfaces.panel_builder import build_steering_panel
from bluebox.interfaces.stage_advance import (
    LAST_GENERATIVE_STAGE,
    complete_pipeline_steering,
    run_stage_and_cache,
    steering_panel_ready_payload,
)
from bluebox.interfaces.ws.connection_registry import connection_registry
from bluebox.modules.advisory.tech_stack.domain.tech_stack_profile import TechStackProfile
from bluebox.modules.core_pipeline.application.stage_service import StageService
from bluebox.modules.core_pipeline.application.steering_service import SteeringService
from bluebox.modules.core_pipeline.llm.requests import TechStackSummary
from bluebox.shared_kernel.infrastructure.in_memory import app_state

router = APIRouter(prefix="/api/v1/projects/{project_id}/steering", tags=["steering"])


class StageGenerateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    context: str = ""


class SteeringActionPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    selected_node_ids: list[str] | None = None
    notes: str | None = None


class SteeringAction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action_type: Literal["accept", "modify", "replace", "authorize"]
    stage_id: int
    payload: SteeringActionPayload = SteeringActionPayload()


def _tech_stack_summary(profile: TechStackProfile) -> TechStackSummary:
    return TechStackSummary(
        frontend_framework=profile.frontend.framework,
        backend_framework=profile.backend.framework,
        database=profile.database.framework,
    )


@router.post("/{stage_id}/generate")
async def generate_stage(
    project_id: str, stage_id: int, request: StageGenerateRequest,
    service: StageService = Depends(get_stage_service),
) -> dict:
    # doc/prd.md AC-TS-04: "TechStackProfile shall be available as input to
    # Stage 6 task decomposition" - without this, run_stage silently falls
    # back to StageService's hardcoded React/FastAPI/PostgreSQL default
    # regardless of what `/tech-stack/select` actually committed.
    profile = app_state.tech_stack_profiles.get(project_id)
    tech_stack = _tech_stack_summary(profile) if profile is not None else None

    candidates = await service.run_stage(project_id, stage_id, context=request.context, tech_stack=tech_stack)
    app_state.pending_candidates[project_id] = (stage_id, candidates)
    orchestrator = app_state.sessions.get_or_create(project_id)
    return build_steering_panel(orchestrator, stage_id, candidates)


@router.get("/{stage_id}")
def get_panel(project_id: str, stage_id: int) -> dict:
    cached = app_state.pending_candidates.get(project_id)
    if cached is None or cached[0] != stage_id:
        raise HTTPException(404, detail=f"no generated panel for stage {stage_id} - call .../generate first")
    orchestrator = app_state.sessions.get_or_create(project_id)
    return build_steering_panel(orchestrator, stage_id, cached[1])


@router.post("")
async def submit_action(
    project_id: str, action: SteeringAction,
    service: SteeringService = Depends(get_steering_service),
) -> dict:
    if action.action_type != "accept":
        raise HTTPException(400, detail=f"steering action_type {action.action_type!r} is not implemented")

    cached = app_state.pending_candidates.get(project_id)
    if cached is None or cached[0] != action.stage_id:
        raise HTTPException(404, detail=f"no generated panel for stage {action.stage_id}")

    stage_id, candidates = cached
    committed = service.accept_all(project_id, stage_id, candidates)
    del app_state.pending_candidates[project_id]

    # Mirrors the WS steering session's `_handle_steering_action`: accepting
    # a stage auto-advances into the next one rather than leaving the
    # Steering Panel with nothing queued - this REST route is what the
    # frontend actually calls (steeringStore.submitAction), so without this
    # the panel would go blank again after every accept.
    if stage_id < LAST_GENERATIVE_STAGE:
        next_stage = stage_id + 1
        next_candidates = await run_stage_and_cache(project_id, next_stage)
        await connection_registry.broadcast(
            project_id, "STEERING_PANEL_READY",
            steering_panel_ready_payload(project_id, next_stage, next_candidates),
        )
    else:
        # Last generative stage accepted - nothing left to auto-advance into,
        # so push the pipeline on into the completeness gate instead of
        # leaving it stuck on STAGE_RUNNING (see complete_pipeline_steering).
        for record in complete_pipeline_steering(project_id):
            await connection_registry.broadcast(project_id, "STATE_TRANSITION", record)

    orchestrator = app_state.sessions.get_or_create(project_id)
    return {
        "success": True,
        "decision_id": committed[0].provenance.decision_entry_id if committed else "",
        "next_state": orchestrator.current_state,
        "impacted_nodes": len(committed),
        "propagation_required": False,
    }
