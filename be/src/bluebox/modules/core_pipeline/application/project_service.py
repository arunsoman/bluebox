"""Project lifecycle use cases - doc/api_event_contract.md SS1.2."""

import uuid

from bluebox.modules.core_pipeline.domain.project import Project
from bluebox.shared_kernel.ports import ProjectRepository, SessionRepository


class ProjectService:
    def __init__(self, projects: ProjectRepository, sessions: SessionRepository) -> None:
        self._projects = projects
        self._sessions = sessions

    def create_project(self, project_name: str, description: str, owner_id: str) -> Project:
        project = Project(
            project_id=f"proj-{uuid.uuid4().hex[:8]}",
            project_name=project_name,
            description=description,
            owner_id=owner_id,
        )
        self._projects.create(project)
        # Initializes a PipelineOrchestrator at INITIALIZED for this project.
        self._sessions.get_or_create(project.project_id)
        return project

    def get_project(self, project_id: str) -> Project | None:
        return self._projects.get(project_id)

    def list_projects(self) -> list[Project]:
        return self._projects.list()

    def delete_project(self, project_id: str) -> None:
        self._projects.delete(project_id)
