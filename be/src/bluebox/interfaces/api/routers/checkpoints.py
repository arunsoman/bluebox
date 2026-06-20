"""doc/api_event_contract.md SS7.1 Checkpoints."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict

from bluebox.interfaces.api.auth import UserProfile, get_current_user
from bluebox.interfaces.api.deps import get_checkpoint_service
from bluebox.modules.core_pipeline.application.checkpoint_service import (
    CheckpointNotFoundError,
    CheckpointService,
)
from bluebox.shared_kernel.domain.audit import Checkpoint

router = APIRouter(prefix="/api/v1/projects/{project_id}/checkpoints", tags=["checkpoints"])


class CreateCheckpointRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: str
    stage: int = 0


@router.get("", response_model=list[Checkpoint])
def list_checkpoints(project_id: str, service: CheckpointService = Depends(get_checkpoint_service)) -> list[Checkpoint]:
    return service.list(project_id)


@router.post("", response_model=Checkpoint)
def create_checkpoint(
    project_id: str, request: CreateCheckpointRequest,
    user: UserProfile = Depends(get_current_user),
    service: CheckpointService = Depends(get_checkpoint_service),
) -> Checkpoint:
    return service.create(project_id, request.label, request.stage, user.user_id)


@router.get("/{checkpoint_id}", response_model=Checkpoint)
def get_checkpoint(
    project_id: str, checkpoint_id: str, service: CheckpointService = Depends(get_checkpoint_service)
) -> Checkpoint:
    try:
        return service.get(project_id, checkpoint_id)
    except CheckpointNotFoundError as exc:
        raise HTTPException(404, detail=str(exc)) from exc


@router.post("/restore")
def restore_checkpoint(
    project_id: str, checkpoint_id: str, service: CheckpointService = Depends(get_checkpoint_service)
) -> dict:
    try:
        checkpoint = service.restore(project_id, checkpoint_id)
    except CheckpointNotFoundError as exc:
        raise HTTPException(404, detail=str(exc)) from exc
    return {"restored": True, "checkpoint_id": checkpoint.checkpoint_id, "current_state": checkpoint.current_state}
