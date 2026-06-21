"""doc/api_event_contract.md SS6.1 RBAC Matrix Editor.

`POST /rbac` (`RBACModelUpdate` - a generic diff-style patch via
`RBACChange[]`) is not implemented: no domain operation exists this pass
for applying an arbitrary add_role/remove_role/grant/revoke/set_inheritance
diff to a model - only whole-model generate + commit are real flows
(`RBACService`). `POST /rbac/generate` is the pragmatic non-WS trigger for
that generation step, same pattern as `scaling.py`/`tech_stack.py`.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict

from bluebox.interfaces.api.deps import get_rbac_service
from bluebox.modules.advisory.rbac.application.rbac_service import RBACService
from bluebox.modules.core_pipeline.llm.requests import ConfirmedNodeRef
from bluebox.shared_kernel.domain.rbac import RBACModel, detect_inheritance_cycles, detect_privilege_escalation
from bluebox.shared_kernel.infrastructure.in_memory import app_state

router = APIRouter(prefix="/api/v1/projects/{project_id}/rbac", tags=["rbac"])


class RBACCommitRequest(BaseModel):
    """doc/api_event_contract.md SS6.1 `RBACCommitRequest`. `force` accepted
    for contract-shape compliance but not acted on - `commit_model` has no
    warning-override behavior to bypass yet."""

    model_config = ConfigDict(extra="forbid")

    rationale: str
    force: bool = False


def _node_refs(project_id: str, stage: int) -> list[ConfirmedNodeRef]:
    return [
        ConfirmedNodeRef(node_id=n.node_id, name=n.name, description=n.description)
        for n in app_state.nodes.list_by_stage(project_id, stage)
    ]


@router.post("/generate", response_model=RBACModel)
async def generate_rbac_model(
    project_id: str, service: RBACService = Depends(get_rbac_service)
) -> RBACModel:
    model = await service.generate_model(
        actors=_node_refs(project_id, 2), capabilities=_node_refs(project_id, 3),
        use_cases=_node_refs(project_id, 4),
    )
    app_state.pending_rbac_model[project_id] = model
    return model


@router.get("", response_model=RBACModel)
def get_rbac_model(project_id: str) -> RBACModel:
    model = app_state.rbac_models.get(project_id)
    if model is None:
        raise HTTPException(404, detail=f"no committed RBAC model for {project_id!r}")
    return model


@router.post("/validate")
def validate_rbac_model(project_id: str) -> dict:
    model = app_state.pending_rbac_model.get(project_id) or app_state.rbac_models.get(project_id)
    if model is None:
        raise HTTPException(404, detail="no generated or committed RBAC model to validate")

    cycles = detect_inheritance_cycles(model.roles)
    escalations = detect_privilege_escalation(model.roles, model.role_permissions, model.permissions)
    missing_rationales = [
        entry.entry_id for entry in model.role_permissions
        if entry.granted and not entry.rationale.strip()
    ]
    return {
        "valid": not cycles and not missing_rationales,
        "inheritance_cycles": cycles,
        "privilege_escalations": [e.model_dump(mode="json") for e in escalations],
        "missing_rationales": missing_rationales,
        "depth_violations": [],
    }


@router.post("/commit")
def commit_rbac_model(
    project_id: str, request: RBACCommitRequest, service: RBACService = Depends(get_rbac_service)
) -> dict:
    model = app_state.pending_rbac_model.get(project_id)
    if model is None:
        raise HTTPException(404, detail="no generated RBAC model to commit - call .../generate first")

    committed, escalations = service.commit_model(project_id, model)
    del app_state.pending_rbac_model[project_id]
    return {
        "committed_version": committed.version,
        "audit_event_id": "",
        "generated_middleware_files": [],
        "privilege_escalations": [e.model_dump(mode="json") for e in escalations],
        "rationale": request.rationale,
    }
