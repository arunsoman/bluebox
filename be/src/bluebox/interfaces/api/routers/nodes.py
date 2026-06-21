"""doc/api_event_contract.md SS5.1 Node CRUD.

`POST /nodes` (create) and `PUT /nodes/{node_id}` (arbitrary field update)
are not implemented: `NodeService` (pass 5) only has
get/deactivate/restore/enrich - accept-then-edit via steering is the
intended creation path (see `steering_service.py`'s module docstring), and
a generic field-by-field update has no real domain operation behind it yet.
`DELETE` with `permanent=true` (hard delete) is likewise not supported -
only the `permanent=false` (deactivate) case maps to a real lifecycle method.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict

from bluebox.interfaces.api.deps import get_node_service
from bluebox.modules.governance.application.node_service import NodeNotFoundError, NodeService
from bluebox.modules.governance.domain.node_validation import ValidationResult
from bluebox.modules.governance.llm.responses import EnrichResult
from bluebox.shared_kernel.domain.node import Node

router = APIRouter(prefix="/api/v1/projects/{project_id}/nodes", tags=["nodes"])


class DeleteNodeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    permanent: bool = False
    delete_downstream: bool = False
    rationale: str = ""


class EnrichRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    enrichment_type: str = "auto"
    selected_suggestions: list[str] | None = None
    fields_to_enrich: list[str] | None = None


def _get_or_404(service: NodeService, project_id: str, node_id: str) -> Node:
    try:
        return service.get(project_id, node_id)
    except NodeNotFoundError as exc:
        raise HTTPException(404, detail=str(exc)) from exc


@router.get("/{node_id}", response_model=Node)
def get_node(
    project_id: str, node_id: str, service: NodeService = Depends(get_node_service)
) -> Node:
    return _get_or_404(service, project_id, node_id)


@router.delete("/{node_id}")
def delete_node(
    project_id: str, node_id: str, request: DeleteNodeRequest,
    service: NodeService = Depends(get_node_service),
) -> dict:
    if request.permanent:
        raise HTTPException(400, detail="permanent (hard) delete is not supported")
    _get_or_404(service, project_id, node_id)
    service.deactivate(project_id, node_id)
    return {"deleted": True}


@router.post("/{node_id}/restore", response_model=Node)
def restore_node(
    project_id: str, node_id: str, service: NodeService = Depends(get_node_service)
) -> Node:
    _get_or_404(service, project_id, node_id)
    return service.restore(project_id, node_id)


@router.post("/{node_id}/enrich", response_model=EnrichResult)
async def enrich_node(
    project_id: str, node_id: str, request: EnrichRequest,
    service: NodeService = Depends(get_node_service),
) -> EnrichResult:
    _get_or_404(service, project_id, node_id)
    _, result = await service.enrich(
        project_id, node_id, enrichment_type=request.enrichment_type,
        selected_suggestions=request.selected_suggestions, fields_to_enrich=request.fields_to_enrich,
    )
    return result


@router.post("/{node_id}/validate", response_model=ValidationResult)
def validate_node(
    project_id: str, node_id: str, service: NodeService = Depends(get_node_service)
) -> ValidationResult:
    _get_or_404(service, project_id, node_id)
    return service.validate(project_id, node_id)
