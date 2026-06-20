"""doc/api_event_contract.md SS4.2 Steering Panel.

Stage generation has no dedicated "run" endpoint in the contract - the
`SteeringPanel` is expected to already be populated (pushed via WS
`STEERING_PANEL_READY` in the real flow). Since the WS steering session
(Task 9) is the actual async trigger, this REST surface adds one pragmatic
extra route, `POST .../steering/{stage_id}/generate`, so the panel can also
be populated over plain REST for manual/non-WS testing - `GET
.../steering/{stage_id}` then just reads back whatever was last generated
for that stage from `app_state.pending_candidates`.

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
from bluebox.modules.core_pipeline.application.stage_service import StageService
from bluebox.modules.core_pipeline.application.steering_service import SteeringService
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


@router.post("/{stage_id}/generate")
async def generate_stage(
    project_id: str, stage_id: int, request: StageGenerateRequest,
    service: StageService = Depends(get_stage_service),
) -> dict:
    candidates = await service.run_stage(project_id, stage_id, context=request.context)
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
def submit_action(
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

    orchestrator = app_state.sessions.get_or_create(project_id)
    return {
        "success": True,
        "decision_id": committed[0].provenance.decision_entry_id if committed else "",
        "next_state": orchestrator.current_state,
        "impacted_nodes": len(committed),
        "propagation_required": False,
    }
