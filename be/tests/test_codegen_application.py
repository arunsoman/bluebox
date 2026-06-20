"""Tests for code_generation/application/codegen_service.py."""

from pydantic_ai.models.test import TestModel

from bluebox.modules.advisory.tech_stack.domain.tech_stack_profile import TechStackProfile
from bluebox.modules.advisory.tech_stack.llm.responses import TechStackComponent
from bluebox.modules.code_generation.application.codegen_service import CodeGenService, infer_commands
from bluebox.modules.code_generation.application.workspace_manager import WorkspaceManager
from bluebox.modules.code_generation.llm import agents as codegen_agents
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
