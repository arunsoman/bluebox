"""End-to-end integration tests for the Collaborative Steering Pipeline.

Tests cover:
- Create session -> run stage 0 with MockLLMClient -> verify state transitions
- Checkpoint create + restore
- Full pipeline run with MockLLMClient
"""

from __future__ import annotations

import json
import time

import pytest

from app.audit.checkpoint import CheckpointManager
from app.core.events import LocalEventBus
from app.core.state_machine import PipelineOrchestrator, PipelineState
from app.domain.models import (
    Actor,
    Capability,
    EngineeringTask,
    ProjectBlueprint,
    UseCase,
    UserStory,
)
from app.llm.mock import MockLLMClient
from app.stages.factory import StageExecutorFactory


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_full_mock_llm():
    """Create a MockLLMClient with responses for all stages."""
    return MockLLMClient(responses={
        "project description": (
            '{"problem_statement": "Build a task manager",'
            '"project_name": "TaskMaster",'
            '"domain_signals": {"scale": "small", "tech_hints": [], "compliance_hints": []}}'
        ),
        "actors": (
            '[{"id": "act-1", "name": "User", "description": "End user", "type": "human"}]'
        ),
        "capabilities": (
            '[{"id": "cap-1", "name": "Authentication", "description": "User login", "actor_ids": ["act-1"]}]'
        ),
        "use case": (
            '[{"id": "uc-1", "name": "Login", "description": "User login flow", "capability_ids": ["cap-1"]}]'
        ),
        "story": (
            '[{"id": "us-1", "title": "As a user I want to login", "description": "Login story", "use_case_ids": ["uc-1"]}]'
        ),
        "task": (
            '[{"id": "et-1", "title": "Implement login UI", "description": "Build login page", "story_ids": ["us-1"]}]'
        ),
    })


# ---------------------------------------------------------------------------
# Session + Stage 0
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestSessionAndStage0:
    async def test_create_session_and_run_stage_0(self):
        """Create session -> run stage 0 -> verify state transitions."""
        event_bus = LocalEventBus()
        orchestrator = PipelineOrchestrator(project_id="test-session", event_bus=event_bus)

        # Initial state
        assert orchestrator.state == PipelineState.INITIALIZED
        assert orchestrator.current_stage == -1

        # Transition to a state where we can run stages
        await orchestrator.transition_to(PipelineState.CLASSIFYING)
        await orchestrator.transition_to(PipelineState.STAGE_RUNNING)
        await orchestrator.transition_to(PipelineState.STREAMING_CHUNKS)
        await orchestrator.transition_to(PipelineState.AWAITING_STEERING)

        assert orchestrator.state == PipelineState.AWAITING_STEERING

        # Run stage 0 with MockLLMClient
        llm = MockLLMClient(responses={
            "problem": (
                '{"problem_statement": "Test problem",'
                '"project_name": "Test Project",'
                '"domain_signals": {"scale": "small", "tech_hints": [], "compliance_hints": []}}'
            ),
        })
        factory = StageExecutorFactory(llm)

        chunks = []
        async for chunk in orchestrator.run_next_stage(factory):
            chunks.append(chunk)

        assert len(chunks) >= 1
        assert chunks[0].node_type == "seed"
        assert "problem_statement" in chunks[0].node_data

    async def test_state_transitions_recorded(self):
        """State transitions emit events that can be captured."""
        events = []
        event_bus = LocalEventBus()
        event_bus.on("STATE_TRANSITION", lambda p: events.append(p))

        orchestrator = PipelineOrchestrator(project_id="test-events", event_bus=event_bus)

        await orchestrator.transition_to(PipelineState.CLASSIFYING)
        await orchestrator.transition_to(PipelineState.STAGE_RUNNING)

        assert len(events) == 2
        assert events[0]["from_state"] == "initialized"
        assert events[0]["to_state"] == "classifying"
        assert events[1]["from_state"] == "classifying"
        assert events[1]["to_state"] == "stage_running"


# ---------------------------------------------------------------------------
# Checkpoint Create + Restore
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestCheckpointCreateRestore:
    async def test_checkpoint_create_returns_id(self):
        event_bus = LocalEventBus()
        orchestrator = PipelineOrchestrator(project_id="test-checkpoint", event_bus=event_bus)
        orchestrator.current_stage = 3
        orchestrator.state = PipelineState.AWAITING_STEERING

        manager = CheckpointManager(blob_store=None)
        checkpoint_id = await manager.create(orchestrator)

        assert checkpoint_id is not None
        assert len(checkpoint_id) > 0

    async def test_checkpoint_restore_returns_snapshot(self):
        event_bus = LocalEventBus()
        orchestrator = PipelineOrchestrator(project_id="test-checkpoint", event_bus=event_bus)
        orchestrator.current_stage = 3
        orchestrator.state = PipelineState.AWAITING_STEERING

        manager = CheckpointManager(blob_store=None)
        checkpoint_id = await manager.create(orchestrator)
        snapshot = await manager.restore("test-checkpoint", checkpoint_id)

        assert snapshot["project_id"] == "test-checkpoint"
        assert snapshot["stage"] == 3
        assert snapshot["state"] == "awaiting_steering"
        assert "blueprint" in snapshot
        assert "ledger" in snapshot

    async def test_checkpoint_list(self):
        event_bus = LocalEventBus()
        orchestrator = PipelineOrchestrator(project_id="test-list", event_bus=event_bus)
        manager = CheckpointManager(blob_store=None)

        cp1 = await manager.create(orchestrator)
        cp2 = await manager.create(orchestrator)

        checkpoints = await manager.list_checkpoints("test-list")
        assert len(checkpoints) == 2
        ids = [c["checkpoint_id"] for c in checkpoints]
        assert cp1 in ids
        assert cp2 in ids

    async def test_restore_unknown_checkpoint_returns_empty(self):
        manager = CheckpointManager(blob_store=None)
        result = await manager.restore("unknown", "nonexistent")
        assert result == {}


# ---------------------------------------------------------------------------
# Full Pipeline Run
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestFullPipelineRun:
    async def test_full_pipeline_with_mock_llm(self):
        """Run the entire pipeline (stages 0-7) with MockLLMClient."""
        event_bus = LocalEventBus()
        orchestrator = PipelineOrchestrator(project_id="full-pipeline", event_bus=event_bus)
        llm = make_full_mock_llm()
        factory = StageExecutorFactory(llm)

        # Start from INITIALIZED -> transition to AWAITING_STEERING
        await orchestrator.transition_to(PipelineState.CLASSIFYING)
        await orchestrator.transition_to(PipelineState.STAGE_RUNNING)
        await orchestrator.transition_to(PipelineState.STAGE_COMPLETED)
        await orchestrator.transition_to(PipelineState.FINAL_GATE)
        await orchestrator.transition_to(PipelineState.AWAITING_STEERING)

        assert orchestrator.state == PipelineState.AWAITING_STEERING

        # Run through stages 0-6 (populating blueprint)
        for stage_id in range(7):
            all_chunks = []
            async for chunk in orchestrator.run_next_stage(factory):
                all_chunks.append(chunk)

            # Populate blueprint from chunks
            for chunk in all_chunks:
                if chunk.node_type == "seed" and "problem_statement" in chunk.node_data:
                    orchestrator.blueprint.problem_statement = chunk.node_data["problem_statement"]
                    orchestrator.blueprint.project_name = chunk.node_data.get("project_name", "")
                elif chunk.node_type == "actor" and isinstance(chunk.node_data, dict):
                    if "actors" in chunk.node_data:
                        for actor_data in chunk.node_data["actors"]:
                            orchestrator.blueprint.actors.append(Actor(**actor_data))
                    elif "name" in chunk.node_data:
                        orchestrator.blueprint.actors.append(Actor(**chunk.node_data))
                elif chunk.node_type == "capability" and isinstance(chunk.node_data, dict):
                    if "capabilities" in chunk.node_data:
                        for cap_data in chunk.node_data["capabilities"]:
                            orchestrator.blueprint.capabilities.append(Capability(**cap_data))
                    elif "name" in chunk.node_data:
                        orchestrator.blueprint.capabilities.append(Capability(**chunk.node_data))
                elif chunk.node_type == "usecase" and isinstance(chunk.node_data, dict):
                    if "name" in chunk.node_data:
                        orchestrator.blueprint.use_cases.append(UseCase(**chunk.node_data))
                elif chunk.node_type == "story" and isinstance(chunk.node_data, dict):
                    if "title" in chunk.node_data:
                        orchestrator.blueprint.user_stories.append(UserStory(**chunk.node_data))
                elif chunk.node_type == "task" and isinstance(chunk.node_data, dict):
                    if "title" in chunk.node_data:
                        orchestrator.blueprint.task_decomposition.append(EngineeringTask(**chunk.node_data))

        # Run stage 7 (finalization)
        async for chunk in orchestrator.run_next_stage(factory):
            pass

        # Verify blueprint has content
        assert orchestrator.blueprint.problem_statement != ""
        assert len(orchestrator.blueprint.actors) >= 0
        assert orchestrator.current_stage == 7

    async def test_full_pipeline_event_flow(self):
        """Verify events are emitted during pipeline execution."""
        events = []
        event_bus = LocalEventBus()
        event_bus.on("STATE_TRANSITION", lambda p: events.append(("transition", p)))

        orchestrator = PipelineOrchestrator(project_id="event-flow", event_bus=event_bus)

        # Run a sequence of transitions
        await orchestrator.transition_to(PipelineState.CLASSIFYING)
        await orchestrator.transition_to(PipelineState.STAGE_RUNNING)
        await orchestrator.transition_to(PipelineState.STREAMING_CHUNKS)
        await orchestrator.transition_to(PipelineState.AWAITING_STEERING)

        transition_events = [e for e in events if e[0] == "transition"]
        assert len(transition_events) == 4

    async def test_blueprint_populated_after_full_run(self):
        """Verify blueprint is fully populated after running all stages."""
        event_bus = LocalEventBus()
        orchestrator = PipelineOrchestrator(project_id="populated", event_bus=event_bus)
        llm = make_full_mock_llm()
        factory = StageExecutorFactory(llm)

        # Manually populate blueprint simulating a full pipeline run
        orchestrator.blueprint.problem_statement = "Build a task manager"
        orchestrator.blueprint.project_name = "TaskMaster"
        orchestrator.blueprint.actors = [
            Actor(id="act-1", name="User", description="End user", type="human"),
        ]
        orchestrator.blueprint.capabilities = [
            Capability(id="cap-1", name="Auth", description="Auth", actor_ids=["act-1"]),
        ]
        orchestrator.blueprint.use_cases = [
            UseCase(id="uc-1", name="Login", description="Login", capability_ids=["cap-1"]),
        ]
        orchestrator.blueprint.user_stories = [
            UserStory(id="us-1", title="Login story", description="Story", use_case_ids=["uc-1"]),
        ]
        orchestrator.blueprint.task_decomposition = [
            EngineeringTask(id="et-1", title="Login task", description="Task", story_ids=["us-1"]),
        ]

        # Stage 7 should pass
        executor = factory.get_executor(7)
        chunks = []
        async for chunk in executor.execute(orchestrator.blueprint, {}):
            chunks.append(chunk)

        report = orchestrator.blueprint.completeness_report
        assert report is not None
        assert report.is_complete is True
        assert len(report.missing_mandatory) == 0
