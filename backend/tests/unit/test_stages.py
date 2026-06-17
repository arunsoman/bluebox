"""Unit tests for stage executors.

Tests cover:
- BaseStageExecutor ABC cannot be instantiated
- Stage0SeedExecutor with MockLLMClient
- Stage7FinalizationExecutor completeness gate
- Stage7 blocks incomplete blueprint
- Stage7 allows deferred fields
"""

from __future__ import annotations

import pytest

from app.core.exceptions import CompletenessGateError
from app.domain.models import (
    Actor,
    Capability,
    DeferredArtifact,
    EngineeringTask,
    ProjectBlueprint,
    UseCase,
    UserStory,
)
from app.llm.mock import MockLLMClient
from app.stages.base import BaseStageExecutor
from app.stages.executors.stage_0_seed import Stage0SeedExecutor
from app.stages.executors.stage_7_final import Stage7FinalizationExecutor


# ---------------------------------------------------------------------------
# BaseStageExecutor ABC
# ---------------------------------------------------------------------------


class TestBaseStageExecutor:
    def test_abc_cannot_be_instantiated(self):
        """BaseStageExecutor is abstract — cannot instantiate directly."""
        with pytest.raises(TypeError):
            BaseStageExecutor(stage_id=0, stage_name="test", llm_client=MockLLMClient())

    def test_subclass_must_implement_execute(self):
        """Subclasses must implement abstract methods."""
        class BadExecutor(BaseStageExecutor):
            async def build_prompt(self, blueprint, context):
                return ""
            # Missing execute

        with pytest.raises(TypeError):
            BadExecutor(stage_id=0, stage_name="bad", llm_client=MockLLMClient())


# ---------------------------------------------------------------------------
# Stage 0 — Seed
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestStage0SeedExecutor:
    async def test_execute_with_mock_llm(self, mock_llm):
        executor = Stage0SeedExecutor(llm_client=mock_llm)
        blueprint = ProjectBlueprint()
        context = {"user_input": "I need a problem analysis for my project"}

        chunks = []
        async for chunk in executor.execute(blueprint, context):
            chunks.append(chunk)

        assert len(chunks) == 1
        assert chunks[0].stage_id == 0
        assert chunks[0].node_type == "seed"
        assert "problem_statement" in chunks[0].node_data
        assert chunks[0].node_data["problem_statement"] == "Test problem"
        assert chunks[0].node_data["project_name"] == "Test Project"

    async def test_execute_records_call_log(self, mock_llm):
        executor = Stage0SeedExecutor(llm_client=mock_llm)
        blueprint = ProjectBlueprint()
        context = {"user_input": "test input"}

        async for _ in executor.execute(blueprint, context):
            pass

        assert len(mock_llm.call_log) >= 1

    async def test_finalize_applies_seed_data(self, mock_llm):
        executor = Stage0SeedExecutor(llm_client=mock_llm)
        blueprint = ProjectBlueprint()
        context = {"user_input": "test"}

        chunks = []
        async for chunk in executor.execute(blueprint, context):
            chunks.append(chunk)

        result = await executor.finalize(blueprint, chunks)
        assert result.project_name == "Test Project"
        assert result.problem_statement == "Test problem"

    async def test_build_prompt_includes_user_input(self, mock_llm):
        executor = Stage0SeedExecutor(llm_client=mock_llm)
        blueprint = ProjectBlueprint()
        context = {"user_input": "Build a task management app"}

        prompt = await executor.build_prompt(blueprint, context)
        assert "Build a task management app" in prompt
        assert "problem_statement" in prompt


# ---------------------------------------------------------------------------
# Stage 7 — Finalization
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestStage7FinalizationExecutor:
    async def test_completeness_gate_blocks_incomplete_blueprint(self):
        """Stage 7 blocks incomplete blueprints (missing mandatory fields)."""
        executor = Stage7FinalizationExecutor(llm_client=MockLLMClient())
        blueprint = ProjectBlueprint()
        # All mandatory fields are empty

        chunks = []
        async for chunk in executor.execute(blueprint, {}):
            chunks.append(chunk)

        assert len(chunks) == 1
        report = blueprint.completeness_report
        assert report is not None
        assert report.is_complete is False
        assert len(report.missing_mandatory) > 0

    async def test_completeness_gate_allows_complete_blueprint(self):
        """Stage 7 allows complete blueprints."""
        executor = Stage7FinalizationExecutor(llm_client=MockLLMClient())
        blueprint = ProjectBlueprint()
        blueprint.problem_statement = "Test problem"
        blueprint.actors = [Actor(id="a1", name="User", description="End user", type="human")]
        blueprint.capabilities = [Capability(id="c1", name="Auth", description="Auth", actor_ids=["a1"])]
        blueprint.use_cases = [UseCase(id="u1", name="Login", description="Login", capability_ids=["c1"])]
        blueprint.user_stories = [UserStory(id="s1", title="Login story", description="Story", use_case_ids=["u1"])]
        blueprint.task_decomposition = [EngineeringTask(id="t1", title="Task", description="Task", story_ids=["s1"])]

        chunks = []
        async for chunk in executor.execute(blueprint, {}):
            chunks.append(chunk)

        report = blueprint.completeness_report
        assert report is not None
        assert report.is_complete is True
        assert len(report.missing_mandatory) == 0

    async def test_deferred_fields_count_as_filled(self):
        """DeferredArtifact fields count as filled."""
        executor = Stage7FinalizationExecutor(llm_client=MockLLMClient())
        blueprint = ProjectBlueprint()
        blueprint.problem_statement = "Test problem"
        blueprint.actors = [Actor(id="a1", name="User", description="End user", type="human")]
        blueprint.capabilities = [Capability(id="c1", name="Auth", description="Auth", actor_ids=["a1"])]
        blueprint.use_cases = [UseCase(id="u1", name="Login", description="Login", capability_ids=["c1"])]
        blueprint.user_stories = [UserStory(id="s1", title="Login story", description="Story", use_case_ids=["u1"])]
        # Defer task_decomposition
        blueprint.task_decomposition = DeferredArtifact(
            field_name="task_decomposition",
            reason="Will be filled in later",
        )

        chunks = []
        async for chunk in executor.execute(blueprint, {}):
            chunks.append(chunk)

        report = blueprint.completeness_report
        assert report is not None
        assert "task_decomposition" in report.deferred_fields
        # task_decomposition is deferred, not missing
        assert "task_decomposition" not in report.missing_mandatory

    async def test_finalize_blocks_incomplete_blueprint(self):
        """finalize() raises CompletenessGateError for incomplete blueprints."""
        executor = Stage7FinalizationExecutor(llm_client=MockLLMClient())
        blueprint = ProjectBlueprint()

        chunks = []
        async for chunk in executor.execute(blueprint, {}):
            chunks.append(chunk)

        with pytest.raises(CompletenessGateError) as exc_info:
            await executor.finalize(blueprint, chunks)

        assert "blocked" in str(exc_info.value).lower() or "missing" in str(exc_info.value).lower()

    async def test_finalize_allows_complete_blueprint(self):
        """finalize() succeeds for complete blueprints."""
        executor = Stage7FinalizationExecutor(llm_client=MockLLMClient())
        blueprint = ProjectBlueprint()
        blueprint.problem_statement = "Test problem"
        blueprint.actors = [Actor(id="a1", name="User", description="End user", type="human")]
        blueprint.capabilities = [Capability(id="c1", name="Auth", description="Auth", actor_ids=["a1"])]
        blueprint.use_cases = [UseCase(id="u1", name="Login", description="Login", capability_ids=["c1"])]
        blueprint.user_stories = [UserStory(id="s1", title="Login story", description="Story", use_case_ids=["u1"])]
        blueprint.task_decomposition = [EngineeringTask(id="t1", title="Task", description="Task", story_ids=["s1"])]

        chunks = []
        async for chunk in executor.execute(blueprint, {}):
            chunks.append(chunk)

        result = await executor.finalize(blueprint, chunks)
        assert result is blueprint  # Returns the same blueprint
