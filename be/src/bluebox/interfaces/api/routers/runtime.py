"""doc/api_event_contract.md SS4.5 Live Preview / Stage 9 RuntimeSandbox."""

from fastapi import APIRouter, Depends, HTTPException

from bluebox.interfaces.api.deps import get_runtime_sandbox
from bluebox.modules.code_generation.application.runtime_sandbox import (
    RuntimeSandbox,
    SandboxNotRunningError,
)
from bluebox.modules.code_generation.domain.runtime import (
    RuntimeCommand,
    RuntimeCommandResult,
    RuntimeStartRequest,
    RuntimeStartResult,
    RuntimeStatus,
)
from bluebox.shared_kernel.infrastructure.in_memory import app_state

router = APIRouter(prefix="/api/v1/projects/{project_id}/runtime", tags=["runtime"])


@router.post("/start", response_model=RuntimeStartResult)
def start_runtime(
    project_id: str, _: RuntimeStartRequest, sandbox: RuntimeSandbox = Depends(get_runtime_sandbox)
) -> RuntimeStartResult:
    manifest = app_state.workspace.get_manifest(project_id)
    if manifest is None:
        raise HTTPException(400, detail="no workspace manifest - generate code first")
    return sandbox.start(project_id, manifest)


@router.post("/stop")
def stop_runtime(project_id: str, sandbox: RuntimeSandbox = Depends(get_runtime_sandbox)) -> dict:
    try:
        sandbox.stop(project_id)
    except SandboxNotRunningError as exc:
        raise HTTPException(409, detail=str(exc)) from exc
    return {"stopped": True}


@router.get("/status", response_model=RuntimeStatus)
def runtime_status(project_id: str, sandbox: RuntimeSandbox = Depends(get_runtime_sandbox)) -> RuntimeStatus:
    return sandbox.status(project_id)


@router.post("/command", response_model=RuntimeCommandResult)
def run_command(
    project_id: str, command: RuntimeCommand, sandbox: RuntimeSandbox = Depends(get_runtime_sandbox)
) -> RuntimeCommandResult:
    try:
        return sandbox.execute_command(project_id, command)
    except SandboxNotRunningError as exc:
        raise HTTPException(409, detail=str(exc)) from exc
