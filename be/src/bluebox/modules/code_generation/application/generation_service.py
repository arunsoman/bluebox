"""Stage 8 whole-project code generation - doc/api_event_contract.md SS8.1
`POST/GET .../generate(/status|/cancel)`.

`CodeGenService.generate_task_files` (codegen_service.py) already generates
one committed `EngineeringTaskNode`'s files for real, but the contract's
`/generate` is project-wide and async (`CodeGenStart` returns immediately,
`CodeGenStatus` is polled separately) - this wraps that single-task call in
a background job that walks every targeted task.

Job state (`_jobs`) is a plain process-local dict, not routed through
`AppState`/SQLite - same precedent as `RuntimeSandbox._handles`
(runtime_sandbox.py): a generation in flight when the process restarts has
no live `asyncio.Task` to resume regardless of where its bookkeeping lives,
so there is nothing to gain from persisting it.

`_broadcast` is injected (see `interfaces/api/deps.py`) rather than imported
directly, so this module - like every other `modules/.../application/`
service - never depends on `interfaces/`; mirrors
`shared_kernel/observability/log_bus.py`'s `set_broadcaster` hook, just via
constructor injection instead of a singleton setter.
"""

import asyncio
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any, Protocol

from bluebox.modules.advisory.tech_stack.domain.tech_stack_profile import TechStackProfile
from bluebox.modules.code_generation.application.codegen_service import CodeGenService
from bluebox.modules.code_generation.domain.workspace import (
    CodeGenError,
    CodeGenStart,
    CodeGenStatus,
)
from bluebox.shared_kernel.domain.node import EngineeringTaskNode
from bluebox.shared_kernel.llm.connector import LLMCallFailed
from bluebox.shared_kernel.ports import NodeRepository, TechStackProfileRepository, WorkspaceRepository

Broadcaster = Callable[[str, str, Any], Awaitable[None]]

# No historical generation to time yet - a flat per-file guess (LLM call +
# disk write) until real timings warrant something better.
_SECONDS_PER_FILE_ESTIMATE = 20.0


class NoTechStackProfileError(Exception):
    def __init__(self, project_id: str) -> None:
        super().__init__(f"project {project_id!r} has no committed tech stack profile - select one first")


class GenerationNotFoundError(Exception):
    def __init__(self, project_id: str) -> None:
        super().__init__(f"no code generation job for project {project_id!r}")


class CodeGenRequest(Protocol):
    """Structurally matches the router's pydantic `CodeGenRequest` model
    (`interfaces/api/routers/codegen.py`) without importing it - this
    application-layer module must not depend on an interfaces-layer schema."""

    target_nodes: list[str] | None
    regenerate_files: list[str] | None


@dataclass
class _Job:
    status: CodeGenStatus
    task: "asyncio.Task[None] | None" = None
    cancelled: bool = False


class ProjectCodeGenService:
    def __init__(
        self,
        codegen: CodeGenService,
        nodes: NodeRepository,
        tech_stack_profiles: TechStackProfileRepository,
        workspace: WorkspaceRepository,
        broadcast: Broadcaster,
    ) -> None:
        self._codegen = codegen
        self._nodes = nodes
        self._tech_stack_profiles = tech_stack_profiles
        self._workspace = workspace
        self._broadcast = broadcast
        self._jobs: dict[str, _Job] = {}

    def _target_tasks(self, project_id: str, request: CodeGenRequest) -> list[EngineeringTaskNode]:
        tasks = [
            node
            for node in self._nodes.list_by_project(project_id)
            if isinstance(node, EngineeringTaskNode) and node.is_active
        ]
        if request.target_nodes:
            wanted = set(request.target_nodes)
            tasks = [t for t in tasks if t.node_id in wanted]
        if request.regenerate_files:
            wanted_files = set(request.regenerate_files)
            tasks = [t for t in tasks if wanted_files & set(t.file_paths)]
        return tasks

    async def start(self, project_id: str, request: CodeGenRequest) -> CodeGenStart:
        tech_stack = self._tech_stack_profiles.get(project_id)
        if tech_stack is None:
            raise NoTechStackProfileError(project_id)

        tasks = self._target_tasks(project_id, request)
        total_files = sum(len(t.file_paths) for t in tasks)
        generation_id = f"GEN-{uuid.uuid4().hex[:8].upper()}"

        job = _Job(
            status=CodeGenStatus(
                generation_id=generation_id, status="queued", files_completed=0, files_total=total_files
            )
        )
        self._jobs[project_id] = job

        start_payload = CodeGenStart(
            generation_id=generation_id,
            total_files=total_files,
            estimated_duration_seconds=total_files * _SECONDS_PER_FILE_ESTIMATE,
        )
        await self._broadcast(project_id, "CODE_GENERATION_STARTED", start_payload.model_dump())
        job.task = asyncio.create_task(self._run(project_id, tasks, tech_stack))
        return start_payload

    async def _run(self, project_id: str, tasks: list[EngineeringTaskNode], tech_stack: TechStackProfile) -> None:
        job = self._jobs[project_id]
        job.status.status = "running"
        try:
            for task in tasks:
                if job.cancelled:
                    return
                job.status.current_file = task.file_paths[0] if task.file_paths else None
                try:
                    generated = await self._codegen.generate_task_files(
                        project_id, task, tech_stack,
                        decision_entry_id=task.provenance.decision_entry_id,
                        checkpoint_id=task.provenance.checkpoint_id,
                    )
                except LLMCallFailed as exc:
                    job.status.errors.append(
                        CodeGenError(
                            file_path=task.file_paths[0] if task.file_paths else task.node_id,
                            error_type="template",
                            message=str(exc),
                            recoverable=True,
                        )
                    )
                    continue
                except Exception as exc:  # noqa: BLE001 - one task's bug must not sink the whole job/task
                    job.status.errors.append(
                        CodeGenError(
                            file_path=task.file_paths[0] if task.file_paths else task.node_id,
                            error_type="template",
                            message=str(exc),
                            recoverable=False,
                        )
                    )
                    continue
                for generated_file in generated:
                    job.status.files_completed += 1
                    await self._broadcast(project_id, "CODE_FILE_COMPLETE", generated_file.model_dump(mode="json"))
            job.status.status = "failed" if job.status.errors and job.status.files_completed == 0 else "completed"
        finally:
            job.status.current_file = None
            manifest = self._workspace.get_manifest(project_id)
            if manifest is not None:
                await self._broadcast(project_id, "CODE_GENERATION_COMPLETE", manifest.model_dump(mode="json"))

    def status(self, project_id: str) -> CodeGenStatus:
        job = self._jobs.get(project_id)
        if job is None:
            raise GenerationNotFoundError(project_id)
        return job.status

    def cancel(self, project_id: str) -> None:
        job = self._jobs.get(project_id)
        if job is None:
            raise GenerationNotFoundError(project_id)
        job.cancelled = True
        if job.task is not None:
            job.task.cancel()
        job.status.status = "failed"
