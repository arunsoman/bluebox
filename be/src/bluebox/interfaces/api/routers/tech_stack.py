"""doc/api_event_contract.md SS6.3 Tech Stack Advisor.

No REST "generate options" endpoint exists in the contract (it's
WS-pushed, `TECH_STACK_OPTIONS_READY`); `POST /tech-stack/options` is added
here as the non-WS path, same pattern as `scaling.py`.
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict

from bluebox.interfaces.api.deps import get_tech_stack_service
from bluebox.modules.advisory.tech_stack.application.tech_stack_service import (
    TechStackOptionNotFoundError,
    TechStackService,
)
from bluebox.modules.advisory.tech_stack.domain.tech_stack_profile import TechStackProfile
from bluebox.modules.advisory.tech_stack.llm.responses import TechStackOptionsMatrix
from bluebox.modules.core_pipeline.llm.requests import ConfirmedNodeRef
from bluebox.shared_kernel.infrastructure.in_memory import app_state

router = APIRouter(prefix="/api/v1/projects/{project_id}/tech-stack", tags=["tech_stack"])


class TechStackSelection(BaseModel):
    """doc/api_event_contract.md SS6.3 `TechStackSelection`. `modified_fields`
    accepted for contract-shape compliance but not acted on - same reasoning
    as `scaling.py`'s `HostingSelection.modified_fields` (no option-
    customization feature built yet)."""

    model_config = ConfigDict(extra="forbid")

    option_id: str
    modified_fields: dict[str, Any] | None = None


@router.post("/options", response_model=TechStackOptionsMatrix)
async def generate_tech_stack_options(
    project_id: str, scale_persona: str = "MEDIUM",
    service: TechStackService = Depends(get_tech_stack_service),
) -> TechStackOptionsMatrix:
    actors = [
        ConfirmedNodeRef(node_id=n.node_id, name=n.name, description=n.description)
        for n in app_state.nodes.list_by_stage(project_id, 2)
    ]
    matrix = await service.generate_options(actors, scale_persona)
    app_state.pending_tech_stack_options[project_id] = matrix
    return matrix


@router.post("/select", response_model=TechStackProfile)
def select_tech_stack(
    project_id: str, selection: TechStackSelection,
    service: TechStackService = Depends(get_tech_stack_service),
) -> TechStackProfile:
    matrix = app_state.pending_tech_stack_options.get(project_id)
    if matrix is None:
        raise HTTPException(404, detail="no generated tech stack options - call .../options first")
    try:
        return service.commit_selection(project_id, matrix, selection.option_id)
    except TechStackOptionNotFoundError as exc:
        raise HTTPException(400, detail=str(exc)) from exc


@router.get("", response_model=TechStackProfile)
def get_tech_stack_profile(project_id: str) -> TechStackProfile:
    profile = app_state.tech_stack_profiles.get(project_id)
    if profile is None:
        raise HTTPException(404, detail=f"no committed tech stack profile for {project_id!r}")
    return profile
