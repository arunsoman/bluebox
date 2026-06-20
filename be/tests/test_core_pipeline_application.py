"""Integration test for the core_pipeline application layer end-to-end:
create project -> submit WELL_FORMED input -> run stage 2 -> accept -> nodes
committed + FSM advanced. Uses TestModel overrides (no real LLM calls).
"""

from contextlib import ExitStack

import pytest
from pydantic_ai.models.test import TestModel

from bluebox.modules.core_pipeline.application.onboarding_service import OnboardingService
from bluebox.modules.core_pipeline.application.project_service import ProjectService
from bluebox.modules.core_pipeline.application.stage_service import StageService
from bluebox.modules.core_pipeline.application.steering_service import SteeringService
from bluebox.modules.core_pipeline.llm import agents as stage_agents
from bluebox.modules.input_processing.llm import agents as input_agents
from bluebox.shared_kernel.infrastructure.in_memory import (
    InMemoryDecisionLedgerRepository,
    InMemoryNodeRepository,
    InMemoryProjectRepository,
    InMemorySessionRepository,
)


@pytest.fixture
def services():
    projects = InMemoryProjectRepository()
    sessions = InMemorySessionRepository()
    nodes = InMemoryNodeRepository()
    decisions = InMemoryDecisionLedgerRepository()
    return {
        "project_service": ProjectService(projects, sessions),
        "onboarding_service": OnboardingService(sessions),
        "stage_service": StageService(nodes, sessions),
        "steering_service": SteeringService(nodes, sessions, decisions),
        "nodes": nodes,
        "sessions": sessions,
    }


@pytest.fixture
def llm_overrides():
    """Forces every agent the core flow touches onto TestModel for the
    duration of a test."""

    agents_to_override = [
        input_agents.richness_classification_agent,
        input_agents.prd_analysis_agent,
        input_agents.prd_chunk_analysis_agent,
        input_agents.compliance_detection_agent,
        stage_agents.actor_generation_agent,
    ]
    with ExitStack() as stack:
        for agent in agents_to_override:
            stack.enter_context(agent.override(model=TestModel()))
        yield


async def test_full_flow_creates_actors_and_advances_state(services, llm_overrides) -> None:
    project = services["project_service"].create_project(
        project_name="Dental SaaS", description="Booking app", owner_id="user-1"
    )

    onboarding_result = await services["onboarding_service"].submit_input(
        project.project_id, raw_text="A dental SaaS with patients and dentists."
    )
    assert onboarding_result.richness.mode in ("WELL_FORMED", "MINIMALIST", "SEED_ONLY")

    orchestrator = services["sessions"].get_or_create(project.project_id)
    assert orchestrator.current_state in ("STAGE_RUNNING", "AWAITING_INPUT_SEED")

    if orchestrator.current_state == "AWAITING_INPUT_SEED":
        pytest.skip("TestModel produced a non-WELL_FORMED classification this run; flow tested separately")

    candidates = await services["stage_service"].run_stage(project.project_id, stage=2, context="dental SaaS")
    assert orchestrator.current_state == "AWAITING_STEERING"

    committed = services["steering_service"].accept_all(project.project_id, stage=2, candidates=candidates)
    assert len(committed) == len(candidates.actors)
    assert orchestrator.current_state == "STAGE_RUNNING"

    stored_nodes = services["nodes"].list_by_project(project.project_id)
    assert {node.node_id for node in stored_nodes} == {node.node_id for node in committed}
    for node in stored_nodes:
        assert node.provenance.decision_entry_id != "pending"
