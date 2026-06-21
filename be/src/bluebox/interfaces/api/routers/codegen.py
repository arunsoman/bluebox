"""doc/api_event_contract.md SS8.1 Code Generation; SS4.3 Workspace files.

`POST .../generate` (+ `/generate/status`, `/generate/cancel`) is the
contract's project-wide Stage 8 trigger - `new-fe`'s
`CompletenessGateModal`/`codeGenApi.start()` calls this, not a per-task
route. `POST .../codegen/{task_id}` (below) predates it and is kept as the
pragmatic non-WS single-task trigger the advisory/steering "generate"
routes also use - `ProjectCodeGenService.start` walks every committed task
through the exact same `CodeGenService.generate_task_files` call this route
makes directly. Both require a committed `TechStackProfile` (`POST
/tech-stack/select` first) - code can't be generated without knowing the
target stack.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict

from bluebox.interfaces.api.deps import get_codegen_service, get_project_codegen_service
from bluebox.modules.code_generation.application.codegen_service import CodeGenService
from bluebox.modules.code_generation.application.generation_service import ProjectCodeGenService
from bluebox.modules.code_generation.domain.workspace import CodeGenStart, CodeGenStatus, GeneratedFile
from bluebox.modules.governance.application.node_service import NodeNotFoundError
from bluebox.shared_kernel.domain.node import EngineeringTaskNode
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
def cancel_generation(project_id: str, service: ProjectCodeGenService = Depends(get_project_codegen_service)) -> dict:
    service.cancel(project_id)
    return {"cancelled": True}


@router.post("/codegen/{task_id}", response_model=list[GeneratedFile])
async def generate_task_code(
    project_id: str, task_id: str, service: CodeGenService = Depends(get_codegen_service)
) -> list[GeneratedFile]:
    task = app_state.nodes.get(project_id, task_id)
    if task is None or not isinstance(task, EngineeringTaskNode):
        raise NodeNotFoundError(project_id, task_id)

    tech_stack = app_state.tech_stack_profiles.get(project_id)
    if tech_stack is None:
        raise HTTPException(400, detail="no committed tech stack profile - select one first")

    return await service.generate_task_files(
        project_id, task, tech_stack,
        decision_entry_id=task.provenance.decision_entry_id, checkpoint_id=task.provenance.checkpoint_id,
    )


@router.get("/workspace/files", response_model=list[GeneratedFile])
def list_workspace_files(project_id: str) -> list[GeneratedFile]:
    return app_state.workspace.list_files(project_id)
