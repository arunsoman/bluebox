"""doc/api_event_contract.md SS8.1 Code Generation; SS4.3 Workspace files.

Stage 8 has no dedicated "generate" REST endpoint in the contract (it's
WS-event-driven, `CODE_GENERATION_STARTED`/`COMPLETE`); `POST
.../codegen/{task_id}` is the pragmatic non-WS trigger, same pattern as the
advisory/steering "generate" routes. Requires a committed `TechStackProfile`
(`POST /tech-stack/select` first) - code can't be generated without knowing
the target stack.
"""

from fastapi import APIRouter, Depends, HTTPException

from bluebox.interfaces.api.deps import get_codegen_service
from bluebox.modules.code_generation.application.codegen_service import CodeGenService
from bluebox.modules.code_generation.domain.workspace import GeneratedFile
from bluebox.modules.governance.application.node_service import NodeNotFoundError
from bluebox.shared_kernel.domain.node import EngineeringTaskNode
from bluebox.shared_kernel.infrastructure.in_memory import app_state

router = APIRouter(prefix="/api/v1/projects/{project_id}", tags=["codegen"])


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
