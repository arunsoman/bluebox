"""Stage 8 whole-project code generation - doc/api_event_contract.md SS8.1
`POST/GET .../generate(/status|/cancel)`, plus per-task tracking and
pause/resume/single-task-run that are NOT in the contract (see
`domain/generation_job.py`'s docstring for that precedent).

`CodeGenService.generate_task_files` (codegen_service.py) already generates
one committed `EngineeringTaskNode`'s files for real, but the contract's
`/generate` is project-wide and async (`CodeGenStart` returns immediately,
`CodeGenStatus` is polled separately) - this wraps that single-task call in
a background "sweep" that walks every targeted task, plus the per-task
status tracking the code-generation progress panel needs.

Per-project state (`_projects`) is a plain process-local dict, not routed
through `AppState`/SQLite - same precedent as `RuntimeSandbox._handles`
(runtime_sandbox.py): a generation in flight when the process restarts has
no live `asyncio.Task` to resume regardless of where its bookkeeping lives,
so there is nothing to gain from persisting it. `tasks` is reseeded lazily
from committed nodes on every `_ensure_state` call instead, which is cheap
and self-healing across restarts.

`_broadcast` is injected (see `interfaces/api/deps.py`) rather than imported
directly, so this module - like every other `modules/.../application/`
service - never depends on `interfaces/`; mirrors
`shared_kernel/observability/log_bus.py`'s `set_broadcaster` hook, just via
constructor injection instead of a singleton setter.
"""

import asyncio
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any, Literal, Protocol

from bluebox.modules.advisory.tech_stack.domain.tech_stack_profile import TechStackProfile
from bluebox.modules.code_generation.application.codegen_service import CodeGenService
from bluebox.modules.code_generation.domain.generation_job import TaskGenerationStatus
from bluebox.modules.code_generation.domain.workspace import (
    CodeGenError,
    CodeGenStart,
    CodeGenStatus,
    GeneratedFile,
)
from bluebox.modules.governance.application.node_service import NodeNotFoundError
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


class TaskAlreadyRunningError(Exception):
    def __init__(self, project_id: str, task_id: str) -> None:
        super().__init__(
            f"task {task_id!r} in project {project_id!r} is already running "
            "(or a project-wide generation sweep is in progress)"
        )


class CodeGenRequest(Protocol):
    """Structurally matches the router's pydantic `CodeGenRequest` model
    (`interfaces/api/routers/codegen.py`) without importing it - this
    application-layer module must not depend on an interfaces-layer schema."""

    target_nodes: list[str] | None
    regenerate_files: list[str] | None


@dataclass
class _ProjectGenState:
    tasks: dict[str, TaskGenerationStatus]  # insertion-ordered
    generation_id: str | None = None
    sweep_task: "asyncio.Task[None] | None" = None
    cancelled: bool = False
    pause_event: asyncio.Event = field(default_factory=asyncio.Event)


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
        self._projects: dict[str, _ProjectGenState] = {}

    def _ensure_state(self, project_id: str) -> _ProjectGenState:
        state = self._projects.get(project_id)
        if state is None:
            state = _ProjectGenState(tasks={})
            state.pause_event.set()
            self._projects[project_id] = state
        for node in self._nodes.list_by_project(project_id):
            if isinstance(node, EngineeringTaskNode) and node.is_active and node.node_id not in state.tasks:
                state.tasks[node.node_id] = TaskGenerationStatus(
                    task_id=node.node_id, file_paths=node.file_paths, status="queued",
                    files_completed=0, files_total=len(node.file_paths),
                )
        return state

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

    def list_tasks(self, project_id: str) -> list[TaskGenerationStatus]:
        return list(self._ensure_state(project_id).tasks.values())

    async def start(self, project_id: str, request: CodeGenRequest) -> CodeGenStart:
        tech_stack = self._tech_stack_profiles.get(project_id)
        if tech_stack is None:
            raise NoTechStackProfileError(project_id)

        state = self._ensure_state(project_id)
        tasks = self._target_tasks(project_id, request)
        total_files = sum(len(t.file_paths) for t in tasks)
        generation_id = f"GEN-{uuid.uuid4().hex[:8].upper()}"

        state.generation_id = generation_id
        state.cancelled = False
        state.pause_event.set()
        for task in tasks:
            state.tasks[task.node_id] = TaskGenerationStatus(
                task_id=task.node_id, file_paths=task.file_paths, status="queued",
                files_completed=0, files_total=len(task.file_paths),
            )

        start_payload = CodeGenStart(
            generation_id=generation_id,
            total_files=total_files,
            estimated_duration_seconds=total_files * _SECONDS_PER_FILE_ESTIMATE,
        )
        await self._broadcast(project_id, "CODE_GENERATION_STARTED", start_payload.model_dump())
        state.sweep_task = asyncio.create_task(
            self._sweep(project_id, [t.node_id for t in tasks], tech_stack)
        )
        return start_payload

    async def _sweep(self, project_id: str, task_ids: list[str], tech_stack: TechStackProfile) -> None:
        state = self._projects[project_id]
        try:
            for task_id in task_ids:
                await state.pause_event.wait()
                if state.cancelled:
                    return
                await self._run_one(project_id, state, task_id, tech_stack)
        finally:
            manifest = self._workspace.get_manifest(project_id)
            if manifest is not None:
                await self._broadcast(project_id, "CODE_GENERATION_COMPLETE", manifest.model_dump(mode="json"))

    async def _run_one(
        self, project_id: str, state: _ProjectGenState, task_id: str, tech_stack: TechStackProfile
    ) -> None:
        task_status = state.tasks[task_id]
        node = self._nodes.get(project_id, task_id)
        if node is None or not isinstance(node, EngineeringTaskNode):
            return  # deleted/deactivated since being queued - nothing to run

        task_status.status = "running"
        task_status.error = None
        task_status.current_file = node.file_paths[0] if node.file_paths else None
        await self._broadcast(project_id, "CODE_TASK_STATUS", task_status.model_dump(mode="json"))
        try:
            generated = await self._codegen.generate_task_files(
                project_id, node, tech_stack,
                decision_entry_id=node.provenance.decision_entry_id,
                checkpoint_id=node.provenance.checkpoint_id,
            )
        except asyncio.CancelledError:
            task_status.status = "cancelled"
            raise
        except LLMCallFailed as exc:
            task_status.status = "failed"
            task_status.error = self._to_error(node, exc, recoverable=True)
            return
        except Exception as exc:  # noqa: BLE001 - one task's bug must not sink the whole sweep
            task_status.status = "failed"
            task_status.error = self._to_error(node, exc, recoverable=False)
            return
        else:
            task_status.files_completed = len(generated)
            task_status.status = "completed"
            for generated_file in generated:
                await self._broadcast(project_id, "CODE_FILE_COMPLETE", generated_file.model_dump(mode="json"))
        finally:
            task_status.current_file = None
            await self._broadcast(project_id, "CODE_TASK_STATUS", task_status.model_dump(mode="json"))

    @staticmethod
    def _to_error(node: EngineeringTaskNode, exc: Exception, *, recoverable: bool) -> CodeGenError:
        return CodeGenError(
            file_path=node.file_paths[0] if node.file_paths else node.node_id,
            error_type="template", message=str(exc), recoverable=recoverable,
        )

    async def run_task(self, project_id: str, task_id: str) -> list[GeneratedFile]:
        tech_stack = self._tech_stack_profiles.get(project_id)
        if tech_stack is None:
            raise NoTechStackProfileError(project_id)

        node = self._nodes.get(project_id, task_id)
        if node is None or not isinstance(node, EngineeringTaskNode):
            raise NodeNotFoundError(project_id, task_id)

        state = self._ensure_state(project_id)
        task_status = state.tasks[task_id]
        sweep_active = state.sweep_task is not None and not state.sweep_task.done()
        if task_status.status == "running" or sweep_active:
            raise TaskAlreadyRunningError(project_id, task_id)

        task_status.status = "running"
        task_status.error = None
        task_status.files_completed = 0
        task_status.current_file = node.file_paths[0] if node.file_paths else None
        await self._broadcast(project_id, "CODE_TASK_STATUS", task_status.model_dump(mode="json"))
        try:
            generated = await self._codegen.generate_task_files(
                project_id, node, tech_stack,
                decision_entry_id=node.provenance.decision_entry_id,
                checkpoint_id=node.provenance.checkpoint_id,
            )
        except LLMCallFailed as exc:
            task_status.status = "failed"
            task_status.error = self._to_error(node, exc, recoverable=True)
            await self._broadcast(project_id, "CODE_TASK_STATUS", task_status.model_dump(mode="json"))
            raise
        finally:
            task_status.current_file = None

        task_status.files_completed = len(generated)
        task_status.status = "completed"
        await self._broadcast(project_id, "CODE_TASK_STATUS", task_status.model_dump(mode="json"))
        for generated_file in generated:
            await self._broadcast(project_id, "CODE_FILE_COMPLETE", generated_file.model_dump(mode="json"))
        return generated

    def status(self, project_id: str) -> CodeGenStatus:
        state = self._projects.get(project_id)
        if state is None or state.generation_id is None:
            raise GenerationNotFoundError(project_id)

        tasks = list(state.tasks.values())
        current = next((t.current_file for t in tasks if t.status == "running"), None)
        errors = [t.error for t in tasks if t.error is not None]
        running_or_queued = any(t.status in ("queued", "running") for t in tasks)
        agg_status: Literal["queued", "running", "completed", "failed"]
        if any(t.status == "running" for t in tasks):
            agg_status = "running"
        elif running_or_queued:
            agg_status = "queued"
        elif errors and sum(t.files_completed for t in tasks) == 0:
            agg_status = "failed"
        else:
            agg_status = "completed"
        # The contract's 4-value `status` literal has no "cancelled" slot -
        # a cancelled task is simply absent from `running_or_queued`/`errors`
        # above and so falls through to "completed" here. Deliberately
        # lossy: `list_tasks()` exposes the real per-task "cancelled" value.
        return CodeGenStatus(
            generation_id=state.generation_id,
            status=agg_status,
            files_completed=sum(t.files_completed for t in tasks),
            files_total=sum(t.files_total for t in tasks),
            current_file=current,
            errors=errors,
        )

    def pause(self, project_id: str) -> None:
        state = self._projects.get(project_id)
        if state is None or state.generation_id is None:
            raise GenerationNotFoundError(project_id)
        state.pause_event.clear()

    def resume(self, project_id: str) -> None:
        state = self._projects.get(project_id)
        if state is None or state.generation_id is None:
            raise GenerationNotFoundError(project_id)
        state.pause_event.set()

    async def cancel(self, project_id: str) -> None:
        state = self._projects.get(project_id)
        if state is None or state.generation_id is None:
            raise GenerationNotFoundError(project_id)
        state.cancelled = True
        state.pause_event.set()  # unblock instantly if currently paused-waiting
        if state.sweep_task is not None:
            state.sweep_task.cancel()
        for task_status in state.tasks.values():
            if task_status.status == "queued":
                task_status.status = "cancelled"
                await self._broadcast(project_id, "CODE_TASK_STATUS", task_status.model_dump(mode="json"))
