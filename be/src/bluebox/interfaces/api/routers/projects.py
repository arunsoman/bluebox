"""doc/api_event_contract.md SS1.2 Project Dashboard.

`ProjectList`/`SessionState` are returned as a partial, best-effort mapping:
the contract's `ProjectSummary` has computed fields (completeness_percentage,
checkpoint_count, ...) this pass's `Project` domain model doesn't track, and
`SessionState` itself is never fully specified in the contract (CLAUDE.md
notes this is one of the contract's intentionally loose `any`-typed shapes).
"""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict

from bluebox.interfaces.api.auth import UserProfile, get_current_user
from bluebox.interfaces.api.deps import get_project_service
from bluebox.modules.core_pipeline.application.project_service import ProjectService
from bluebox.modules.core_pipeline.domain.project import Project
from bluebox.shared_kernel.infrastructure.in_memory import app_state

router = APIRouter(prefix="/api/v1/projects", tags=["projects"], dependencies=[Depends(get_current_user)])


class CreateProjectRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")  # Ignore extra fields like persona

    project_name: str
    description: str = ""
    persona: Literal["citizen_developer", "architect", "security_engineer"] | None = None


@router.get("")
def list_projects(service: ProjectService = Depends(get_project_service)) -> dict:
    projects = service.list_projects()
    return {"total": len(projects), "projects": projects}


@router.post("", response_model=Project)
def create_project(
    request: CreateProjectRequest,
    user: UserProfile = Depends(get_current_user),
    service: ProjectService = Depends(get_project_service),
) -> Project:
    return service.create_project(
        project_name=request.project_name, description=request.description, owner_id=user.user_id
    )


@router.get("/{project_id}", response_model=Project)
def get_project(project_id: str, service: ProjectService = Depends(get_project_service)) -> Project:
    project = service.get_project(project_id)
    if project is None:
        raise HTTPException(404, detail=f"project {project_id!r} not found")
    return project


@router.delete("/{project_id}")
def delete_project(project_id: str, service: ProjectService = Depends(get_project_service)) -> dict:
    service.delete_project(project_id)
    return {"deleted": True}


@router.post("/{project_id}/resume")
def resume_project(project_id: str, service: ProjectService = Depends(get_project_service)) -> dict:
    project = service.get_project(project_id)
    if project is None:
        raise HTTPException(404, detail=f"project {project_id!r} not found")
    orchestrator = app_state.sessions.get_or_create(project_id)
    return {
        "project_id": project_id,
        "current_state": orchestrator.current_state,
        "trust_mode": orchestrator.trust_mode,
    }


@router.post("/{project_id}/reset")
def reset_project(project_id: str, service: ProjectService = Depends(get_project_service)) -> dict:
    """Reset the project's orchestrator state back to INITIALIZED.
    Allows re-submitting input without deleting the project.
    """
    project = service.get_project(project_id)
    if project is None:
        raise HTTPException(404, detail=f"project {project_id!r} not found")
    
    orchestrator = app_state.sessions.get_or_create(project_id)
    orchestrator.restore_to("INITIALIZED", "Manual reset via API")
    app_state.sessions.save(project_id, orchestrator)
    
    return {
        "project_id": project_id,
        "current_state": "INITIALIZED",
        "message": "Project reset successfully - you can now submit new input",
    }
