"""Tests for code_generation/application/codegen_service.py."""

import pytest
from pydantic_ai.models.test import TestModel

from bluebox.modules.advisory.tech_stack.domain.tech_stack_profile import TechStackProfile
from bluebox.modules.advisory.tech_stack.llm.responses import TechStackComponent
from bluebox.modules.code_generation.application.codegen_service import CodeGenService, infer_commands
from bluebox.modules.code_generation.application.syntax_validator import GeneratedCodeSyntaxError
from bluebox.modules.code_generation.application.workspace_manager import WorkspaceManager
from bluebox.modules.code_generation.llm import agents as codegen_agents
from bluebox.modules.code_generation.llm.requests import CodeFileGenerationRequest
from bluebox.modules.code_generation.llm.responses import GeneratedFileDraft
from bluebox.shared_kernel.domain.node import EngineeringTaskNode, NodeProvenance
from bluebox.shared_kernel.infrastructure.in_memory import InMemoryWorkspaceRepository

_PROJECT = "proj-test"


def _python_profile() -> TechStackProfile:
    return TechStackProfile(
        profile_id="STACK-1",
        frontend=TechStackComponent(framework="React", language="TypeScript", justification="x"),
        backend=TechStackComponent(framework="FastAPI", language="python", justification="x"),
        database=TechStackComponent(framework="PostgreSQL", language="SQL", justification="x"),
        rationale="simple",
    )


def _task() -> EngineeringTaskNode:
    return EngineeringTaskNode(
        node_id="TASK-1", name="Booking endpoint", description="POST /bookings",
        layer="Backend", risk_classification="LOW_RISK", status="SYSTEM_GENERATED",
        created_by="system",
        provenance=NodeProvenance(generated_at_stage=6, decision_entry_id="DEC-1", checkpoint_id="CKPT-1"),
        estimated_hours=4, complexity="Low", preconditions=[], postconditions=[],
        file_paths=["backend/routes/bookings.py"], tech_stack_requirements=["FastAPI"],
        parent_story_id="US-1",
    )


def test_infer_commands_python_vs_node() -> None:
    run, test, build = infer_commands(_python_profile())
    assert "uvicorn" in run
    assert test == "pytest"
    assert build is None


async def test_generate_task_files_writes_to_workspace(tmp_path) -> None:
    repo = InMemoryWorkspaceRepository()
    workspace = WorkspaceManager(repo, root=tmp_path)
    service = CodeGenService(workspace)

    with codegen_agents.code_file_generation_agent.override(model=TestModel()):
        generated = await service.generate_task_files(
            _PROJECT, _task(), _python_profile(),
            decision_entry_id="DEC-1", checkpoint_id="CKPT-1",
        )

    assert len(generated) == 1
    stored = repo.list_files(_PROJECT)
    assert stored == generated
    manifest = repo.get_manifest(_PROJECT)
    assert manifest is not None
    assert "uvicorn" in manifest.run_command


def _task_with_files(node_id: str, *file_paths: str) -> EngineeringTaskNode:
    return EngineeringTaskNode(
        node_id=node_id, name="Booking endpoint", description="POST /bookings",
        layer="Backend", risk_classification="LOW_RISK", status="SYSTEM_GENERATED",
        created_by="system",
        provenance=NodeProvenance(generated_at_stage=6, decision_entry_id="DEC-1", checkpoint_id="CKPT-1"),
        estimated_hours=4, complexity="Low", preconditions=[], postconditions=[],
        file_paths=list(file_paths), tech_stack_requirements=["FastAPI"],
        parent_story_id="US-1",
    )


async def test_generate_task_files_threads_existing_files_context(tmp_path, monkeypatch) -> None:
    repo = InMemoryWorkspaceRepository()
    workspace = WorkspaceManager(repo, root=tmp_path)
    service = CodeGenService(workspace)

    requests: list[CodeFileGenerationRequest] = []

    async def fake_generate_code_file(request: CodeFileGenerationRequest) -> GeneratedFileDraft:
        requests.append(request)
        return GeneratedFileDraft(file_path=request.file_path, content="class User:\n    pass\n", language="python")

    monkeypatch.setattr(codegen_agents, "generate_code_file", fake_generate_code_file)

    # First file in a fresh project: no prior files, so no context.
    await service.generate_task_files(
        _PROJECT, _task_with_files("TASK-1", "backend/a.py"), _python_profile(),
        decision_entry_id="DEC-1", checkpoint_id="CKPT-1",
    )
    assert requests[0].existing_files_context == ""

    # Second file, different task: sees the first file's outline.
    await service.generate_task_files(
        _PROJECT, _task_with_files("TASK-2", "backend/b.py"), _python_profile(),
        decision_entry_id="DEC-2", checkpoint_id="CKPT-1",
    )
    assert "backend/a.py" in requests[1].existing_files_context
    assert "class User" in requests[1].existing_files_context
    assert "EXTEND" not in requests[1].existing_files_context

    # Regenerating backend/a.py: sees the EXTEND notice with its prior content.
    await service.generate_task_files(
        _PROJECT, _task_with_files("TASK-1", "backend/a.py"), _python_profile(),
        decision_entry_id="DEC-1", checkpoint_id="CKPT-1",
    )
    assert "EXTEND, DO NOT OVERWRITE" in requests[2].existing_files_context
    assert "class User" in requests[2].existing_files_context


async def test_generate_task_files_aborts_on_invalid_syntax_without_writing(tmp_path, monkeypatch) -> None:
    repo = InMemoryWorkspaceRepository()
    workspace = WorkspaceManager(repo, root=tmp_path)
    service = CodeGenService(workspace)

    async def fake_generate_code_file(request: CodeFileGenerationRequest) -> GeneratedFileDraft:
        if request.file_path == "backend/a.py":
            return GeneratedFileDraft(file_path=request.file_path, content="class User:\n    pass\n", language="python")
        return GeneratedFileDraft(file_path=request.file_path, content="def foo(:\n", language="python")

    monkeypatch.setattr(codegen_agents, "generate_code_file", fake_generate_code_file)

    with pytest.raises(GeneratedCodeSyntaxError):
        await service.generate_task_files(
            _PROJECT, _task_with_files("TASK-1", "backend/a.py", "backend/b.py"), _python_profile(),
            decision_entry_id="DEC-1", checkpoint_id="CKPT-1",
        )

    stored = {f.file_path for f in repo.list_files(_PROJECT)}
    assert stored == {"backend/a.py"}


async def test_generate_task_files_calls_on_file_start_per_file(tmp_path) -> None:
    repo = InMemoryWorkspaceRepository()
    workspace = WorkspaceManager(repo, root=tmp_path)
    service = CodeGenService(workspace)

    started: list[str] = []

    async def on_file_start(file_path: str) -> None:
        started.append(file_path)

    with codegen_agents.code_file_generation_agent.override(model=TestModel()):
        await service.generate_task_files(
            _PROJECT, _task_with_files("TASK-1", "backend/a.py", "backend/b.py"), _python_profile(),
            decision_entry_id="DEC-1", checkpoint_id="CKPT-1", on_file_start=on_file_start,
        )

    assert started == ["backend/a.py", "backend/b.py"]
