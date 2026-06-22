"""doc/api_event_contract.md SS8.1 Code Generation; SS4.3 Workspace files.

`POST .../generate` (+ `/generate/status`, `/generate/cancel`) is the
contract's project-wide Stage 8 trigger - `new-fe`'s
`CompletenessGateModal`/`codeGenApi.start()` calls this. `/generate/tasks`,
`/generate/pause`, `/generate/resume`, and `POST .../codegen/{task_id}`
(single-task run/rerun) are NOT in the contract - they back the
code-generation progress panel (`ProjectCodeGenService`'s module docstring
has the full rationale), same precedent as `llm_config.py`. A committed
`TechStackProfile` is not required beforehand - if none exists when
generation starts, `ProjectCodeGenService._ensure_tech_stack_profile`
auto-generates and commits one so code can't be generated against an
unknown stack, but the user is never hard-blocked into visiting
`POST /tech-stack/select` first.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict

from bluebox.interfaces.api.deps import get_project_codegen_service
from bluebox.modules.code_generation.application.generation_service import ProjectCodeGenService
from bluebox.modules.code_generation.domain.generation_job import TaskGenerationStatus
from bluebox.modules.code_generation.domain.workspace import CodeGenStart, CodeGenStatus, GeneratedFile
from bluebox.shared_kernel.infrastructure.in_memory import app_state

router = APIRouter(prefix="/api/v1/projects/{project_id}", tags=["codegen"])


class CodeGenRequest(BaseModel):
    """doc/api_event_contract.md SS8.1 `CodeGenRequest`. `include_tests`/
    `include_infrastructure` round-trip but don't currently filter
    anything - `CodeGenService.generate_task_files` generates exactly
    whatever a committed `EngineeringTaskNode.file_paths` lists, and neither
    a tests-only nor an infrastructure-as-code generation path exists yet;
    wiring them would mean inventing generated content the task node never
    asked for, which is exactly what CLAUDE.md rules out."""

    model_config = ConfigDict(extra="forbid")

    target_nodes: list[str] | None = None
    regenerate_files: list[str] | None = None
    include_tests: bool = True
    include_infrastructure: bool = True


@router.post("/generate", response_model=CodeGenStart)
async def start_generation(
    project_id: str, request: CodeGenRequest, service: ProjectCodeGenService = Depends(get_project_codegen_service),
) -> CodeGenStart:
    return await service.start(project_id, request)


@router.get("/generate/status", response_model=CodeGenStatus)
def generation_status(
    project_id: str, service: ProjectCodeGenService = Depends(get_project_codegen_service)
) -> CodeGenStatus:
    return service.status(project_id)


@router.post("/generate/cancel")
async def cancel_generation(
    project_id: str, service: ProjectCodeGenService = Depends(get_project_codegen_service)
) -> dict:
    await service.cancel(project_id)
    return {"cancelled": True}


@router.get("/generate/tasks", response_model=list[TaskGenerationStatus])
def list_generation_tasks(
    project_id: str, service: ProjectCodeGenService = Depends(get_project_codegen_service)
) -> list[TaskGenerationStatus]:
    return service.list_tasks(project_id)


@router.post("/generate/pause")
def pause_generation(project_id: str, service: ProjectCodeGenService = Depends(get_project_codegen_service)) -> dict:
    service.pause(project_id)
    return {"paused": True}


@router.post("/generate/resume")
def resume_generation(project_id: str, service: ProjectCodeGenService = Depends(get_project_codegen_service)) -> dict:
    service.resume(project_id)
    return {"paused": False}


@router.post("/codegen/{task_id}", response_model=list[GeneratedFile])
async def run_task(
    project_id: str, task_id: str, service: ProjectCodeGenService = Depends(get_project_codegen_service)
) -> list[GeneratedFile]:
    return await service.run_task(project_id, task_id)


@router.get("/workspace/files", response_model=list[GeneratedFile])
def list_workspace_files(project_id: str) -> list[GeneratedFile]:
    return app_state.workspace.list_files(project_id)
