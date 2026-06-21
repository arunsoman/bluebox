"""doc/api_event_contract.md SS6.2 Scale & Infrastructure Advisor.

The contract's `GET /scale/options` takes a `ScaleInputs` body to generate
the matrix - implemented here as `POST /scale/options` instead (a GET with
a meaningful request body is not idiomatic REST and FastAPI doesn't
support it cleanly). Generation is normally WS-pushed
(`HOSTING_OPTIONS_READY`, Task 9); this REST route exists for the
non-WS/manual-testing path, same pattern as `steering.py`.
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict

from bluebox.interfaces.api.auth import UserProfile, get_current_user
from bluebox.interfaces.api.deps import get_scaling_service
from bluebox.modules.advisory.scaling.application.scaling_service import (
    HostingOptionNotFoundError,
    ScalingService,
)
from bluebox.modules.advisory.scaling.domain.infrastructure_profile import InfrastructureProfile
from bluebox.modules.advisory.scaling.domain.validation import ScaleValidationResult
from bluebox.modules.advisory.scaling.llm.requests import ScaleInputsContext
from bluebox.modules.advisory.scaling.llm.responses import HostingOptionsMatrix
from bluebox.shared_kernel.infrastructure.in_memory import app_state

router = APIRouter(prefix="/api/v1/projects/{project_id}", tags=["scaling"])


class HostingSelection(BaseModel):
    """doc/api_event_contract.md SS6.2 `HostingSelection`.

    `modified_fields`/`override_budget_warning` are accepted for
    contract-shape compliance but not acted on: doc/prd.md AC-SC-04 only
    requires `over_budget` to be flagged for display (already done -
    `new-fe/src/components/onboarding/HostingOptionsView.tsx`'s badge), not
    rejected - there's no documented gate this would override, and no
    option-customization feature exists yet to apply `modified_fields` to.
    """

    model_config = ConfigDict(extra="forbid")

    option_id: str
    modified_fields: dict[str, Any] | None = None
    override_budget_warning: bool = False


@router.post("/scale", response_model=ScaleValidationResult)
def submit_scale_inputs(
    project_id: str,
    scale_inputs: ScaleInputsContext,
    service: ScalingService = Depends(get_scaling_service),
) -> ScaleValidationResult:
    return service.validate(scale_inputs)


@router.post("/scale/options", response_model=HostingOptionsMatrix)
async def generate_scale_options(
    project_id: str, scale_inputs: ScaleInputsContext, scale_persona: str = "MEDIUM",
    service: ScalingService = Depends(get_scaling_service),
) -> HostingOptionsMatrix:
    matrix = await service.generate_options(scale_inputs, scale_persona)
    app_state.pending_hosting_options[project_id] = matrix
    return matrix


@router.post("/infrastructure/select", response_model=InfrastructureProfile)
def select_infrastructure(
    project_id: str,
    selection: HostingSelection,
    user: UserProfile = Depends(get_current_user),
    service: ScalingService = Depends(get_scaling_service),
) -> InfrastructureProfile:
    matrix = app_state.pending_hosting_options.get(project_id)
    if matrix is None:
        raise HTTPException(404, detail="no generated hosting options - call .../scale/options first")
    try:
        return service.commit_selection(project_id, matrix, selection.option_id, user.user_id)
    except HostingOptionNotFoundError as exc:
        raise HTTPException(400, detail=str(exc)) from exc


@router.get("/infrastructure", response_model=InfrastructureProfile)
def get_infrastructure_profile(project_id: str) -> InfrastructureProfile:
    profile = app_state.infrastructure_profiles.get(project_id)
    if profile is None:
        raise HTTPException(404, detail=f"no committed infrastructure profile for {project_id!r}")
    return profile
