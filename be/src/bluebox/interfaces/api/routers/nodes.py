"""doc/api_event_contract.md SS5.1 Node CRUD.

`POST /nodes` (create) is not implemented: `NodeService` (pass 5) has no
domain operation for mapping an arbitrary `node_type` + free-form `data`
onto the right `Node` subtype's required fields - accept-then-edit via
steering is the intended creation path (see `steering_service.py`'s module
docstring). `PUT /nodes/{node_id}` IS contracted and now implemented via
`NodeService.update` - frontend's Node Editor "Save Changes" and the
Completeness Gate's defer actions depend on it (previously 405'd against
nothing). `DELETE` with `permanent=true` (hard delete) is likewise not
supported - only the `permanent=false` (deactivate) case maps to a real
lifecycle method.
"""

from typing import Any, Literal

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


class UpdateNodeRequest(BaseModel):
    """doc/api_event_contract.md SS5.1 `UpdateNodeRequest`."""

    model_config = ConfigDict(extra="forbid")

    data: dict[str, Any]
    source: Literal["user_edit", "steering", "enrichment"]
    change_rationale: str | None = None


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


@router.put("/{node_id}", response_model=Node)
def update_node(
    project_id: str, node_id: str, request: UpdateNodeRequest,
    service: NodeService = Depends(get_node_service),
) -> Node:
    _get_or_404(service, project_id, node_id)
    try:
        return service.update(project_id, node_id, request.data, change_rationale=request.change_rationale)
    except ValueError as exc:
        raise HTTPException(400, detail=str(exc)) from exc


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
