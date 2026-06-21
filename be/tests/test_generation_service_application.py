"""Tests for code_generation/application/generation_service.py - the
project-wide `/generate` job wrapper (plus per-task tracking, pause/resume,
and single-task run/rerun) around `CodeGenService.generate_task_files`."""

import asyncio

import pytest
from pydantic_ai.models.test import TestModel

from bluebox.modules.advisory.tech_stack.domain.tech_stack_profile import TechStackProfile
from bluebox.modules.advisory.tech_stack.llm.responses import TechStackComponent
from bluebox.modules.code_generation.application.codegen_service import CodeGenService
from bluebox.modules.code_generation.application.generation_service import (
    GenerationNotFoundError,
    NoTechStackProfileError,
    ProjectCodeGenService,
    TaskAlreadyRunningError,
)
from bluebox.modules.code_generation.application.workspace_manager import WorkspaceManager
from bluebox.modules.code_generation.llm import agents as codegen_agents
from bluebox.shared_kernel.domain.node import EngineeringTaskNode, NodeProvenance
from bluebox.shared_kernel.infrastructure.in_memory import (
    InMemoryNodeRepository,
    InMemoryTechStackProfileRepository,
    InMemoryWorkspaceRepository,
)

_PROJECT = "proj-test"


def _profile() -> TechStackProfile:
    return TechStackProfile(
        profile_id="STACK-1",
        frontend=TechStackComponent(framework="React", language="TypeScript", justification="x"),
        backend=TechStackComponent(framework="FastAPI", language="python", justification="x"),
        database=TechStackComponent(framework="PostgreSQL", language="SQL", justification="x"),
        rationale="simple",
    )


def _task(node_id: str, *file_paths: str) -> EngineeringTaskNode:
    return EngineeringTaskNode(
        node_id=node_id, name="Booking endpoint", description="POST /bookings",
        layer="Backend", risk_classification="LOW_RISK", status="SYSTEM_GENERATED",
        created_by="system",
        provenance=NodeProvenance(generated_at_stage=6, decision_entry_id="DEC-1", checkpoint_id="CKPT-1"),
        estimated_hours=4, complexity="Low", preconditions=[], postconditions=[],
        file_paths=list(file_paths), tech_stack_requirements=["FastAPI"],
        parent_story_id="US-1",
    )


class _Request:
    def __init__(self, target_nodes=None, regenerate_files=None) -> None:
        self.target_nodes = target_nodes
        self.regenerate_files = regenerate_files


def _service(tmp_path, nodes=None, profile=_profile()):
    workspace_repo = InMemoryWorkspaceRepository()
    workspace = WorkspaceManager(workspace_repo, root=tmp_path)
    codegen = CodeGenService(workspace)

    node_repo = InMemoryNodeRepository()
    for node in nodes or []:
        node_repo.add(_PROJECT, node)

    profiles = InMemoryTechStackProfileRepository()
    if profile is not None:
        profiles.save(_PROJECT, profile)

    events: list[tuple[str, str, object]] = []

    async def broadcast(project_id: str, event: str, payload: object) -> None:
        events.append((project_id, event, payload))

    service = ProjectCodeGenService(codegen, node_repo, profiles, workspace_repo, broadcast)
    return service, events, node_repo


async def test_start_with_no_tech_stack_profile_raises(tmp_path) -> None:
    service, _, _nodes = _service(tmp_path, profile=None)
    with pytest.raises(NoTechStackProfileError):
        await service.start(_PROJECT, _Request())


async def test_status_and_cancel_without_a_job_raise(tmp_path) -> None:
    service, _, _nodes = _service(tmp_path)
    with pytest.raises(GenerationNotFoundError):
        service.status(_PROJECT)
    with pytest.raises(GenerationNotFoundError):
        await service.cancel(_PROJECT)


async def test_list_tasks_seeds_from_committed_nodes_without_starting(tmp_path) -> None:
    tasks = [_task("TASK-1", "backend/a.py"), _task("TASK-2", "backend/b.py")]
    service, _, _nodes = _service(tmp_path, nodes=tasks)

    listed = service.list_tasks(_PROJECT)
    assert {t.task_id for t in listed} == {"TASK-1", "TASK-2"}
    assert all(t.status == "queued" for t in listed)


async def test_start_runs_every_committed_task_and_completes(tmp_path) -> None:
    tasks = [_task("TASK-1", "backend/a.py"), _task("TASK-2", "backend/b.py", "backend/c.py")]
    service, events, _nodes = _service(tmp_path, nodes=tasks)

    with codegen_agents.code_file_generation_agent.override(model=TestModel()):
        start = await service.start(_PROJECT, _Request())
        assert start.total_files == 3
        sweep_task = service._projects[_PROJECT].sweep_task
        await sweep_task

    status = service.status(_PROJECT)
    assert status.status == "completed"
    assert status.files_completed == 3
    assert status.current_file is None

    listed = {t.task_id: t for t in service.list_tasks(_PROJECT)}
    assert listed["TASK-1"].status == "completed"
    assert listed["TASK-2"].status == "completed"

    event_names = [e for _, e, _ in events]
    assert event_names[0] == "CODE_GENERATION_STARTED"
    assert event_names.count("CODE_FILE_COMPLETE") == 3
    assert event_names.count("CODE_TASK_STATUS") == 4  # running + completed, per task
    assert event_names[-1] == "CODE_GENERATION_COMPLETE"


async def test_start_filters_by_target_nodes(tmp_path) -> None:
    tasks = [_task("TASK-1", "backend/a.py"), _task("TASK-2", "backend/b.py")]
    service, _, _nodes = _service(tmp_path, nodes=tasks)

    with codegen_agents.code_file_generation_agent.override(model=TestModel()):
        start = await service.start(_PROJECT, _Request(target_nodes=["TASK-2"]))
        assert start.total_files == 1
        await service._projects[_PROJECT].sweep_task

    assert service.status(_PROJECT).files_completed == 1
    assert service.list_tasks(_PROJECT) and {t.task_id for t in service.list_tasks(_PROJECT)} == {
        "TASK-1", "TASK-2",
    }


async def test_cancel_stops_remaining_work(tmp_path) -> None:
    tasks = [_task("TASK-1", "backend/a.py"), _task("TASK-2", "backend/b.py")]
    service, _, _nodes = _service(tmp_path, nodes=tasks)

    with codegen_agents.code_file_generation_agent.override(model=TestModel()):
        await service.start(_PROJECT, _Request())
        await service.cancel(_PROJECT)
        sweep_task = service._projects[_PROJECT].sweep_task
        try:
            await sweep_task
        except asyncio.CancelledError:
            pass

    # Whichever task was mid-flight when cancelled must not be left "running"
    # forever (the bug a Plan-agent review flagged for this design).
    assert all(t.status != "running" for t in service.list_tasks(_PROJECT))


async def test_pause_blocks_the_sweep_until_resumed(tmp_path) -> None:
    tasks = [_task("TASK-1", "backend/a.py"), _task("TASK-2", "backend/b.py")]
    service, _, _nodes = _service(tmp_path, nodes=tasks)

    with codegen_agents.code_file_generation_agent.override(model=TestModel()):
        await service.start(_PROJECT, _Request())
        service.pause(_PROJECT)
        sweep_task = service._projects[_PROJECT].sweep_task

        # Give the event loop a few turns - the sweep must not finish while paused.
        for _ in range(5):
            await asyncio.sleep(0)
        assert not sweep_task.done()

        service.resume(_PROJECT)
        await sweep_task

    assert service.status(_PROJECT).status == "completed"


async def test_run_task_executes_a_single_task_synchronously(tmp_path) -> None:
    tasks = [_task("TASK-1", "backend/a.py")]
    service, events, _nodes = _service(tmp_path, nodes=tasks)

    with codegen_agents.code_file_generation_agent.override(model=TestModel()):
        generated = await service.run_task(_PROJECT, "TASK-1")

    assert len(generated) == 1
    assert service.list_tasks(_PROJECT)[0].status == "completed"
    assert ("CODE_FILE_COMPLETE" in [e for _, e, _ in events])


async def test_run_task_rejects_while_already_running_or_sweeping(tmp_path) -> None:
    tasks = [_task("TASK-1", "backend/a.py"), _task("TASK-2", "backend/b.py")]
    service, _, _nodes = _service(tmp_path, nodes=tasks)

    with codegen_agents.code_file_generation_agent.override(model=TestModel()):
        await service.start(_PROJECT, _Request())  # sweep now in progress
        with pytest.raises(TaskAlreadyRunningError):
            await service.run_task(_PROJECT, "TASK-2")
        await service._projects[_PROJECT].sweep_task
