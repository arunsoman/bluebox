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
from bluebox.modules.core_pipeline.application.steering_service import (
    SteeringService,
    apply_modifications,
    generate_node_ids,
    preview_nodes,
    remaining_candidates,
)
from bluebox.modules.core_pipeline.llm import agents as stage_agents
from bluebox.modules.core_pipeline.llm.responses import (
    AccessGuard,
    AcceptanceCriterion,
    ActorCandidate,
    ActorCandidateSet,
    AlternativeFlow,
    EngineeringTaskCandidate,
    EngineeringTaskCandidateSet,
    UseCaseCandidate,
    UseCaseCandidateSet,
    UseCaseStep,
    UserStoryCandidate,
    UserStoryCandidateSet,
)
from bluebox.modules.input_processing.llm import agents as input_agents
from bluebox.shared_kernel.infrastructure.in_memory import (
    InMemoryDecisionLedgerRepository,
    InMemoryNodeRepository,
    InMemoryPrdSubmissionRepository,
    InMemoryProjectRepository,
    InMemorySessionRepository,
)


@pytest.fixture
def services():
    projects = InMemoryProjectRepository()
    sessions = InMemorySessionRepository()
    nodes = InMemoryNodeRepository()
    decisions = InMemoryDecisionLedgerRepository()
    prd_submissions = InMemoryPrdSubmissionRepository()
    return {
        "project_service": ProjectService(projects, sessions),
        "onboarding_service": OnboardingService(sessions, prd_submissions, nodes),
        "stage_service": StageService(nodes, sessions),
        "steering_service": SteeringService(nodes, sessions, decisions),
        "nodes": nodes,
        "sessions": sessions,
        "prd_submissions": prd_submissions,
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

    persisted = services["prd_submissions"].get(project.project_id)
    assert persisted is not None
    assert persisted.raw_text == "A dental SaaS with patients and dentists."
    assert persisted.richness == onboarding_result.richness
    assert persisted.prd_analysis == onboarding_result.prd_analysis

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


async def test_run_stage_rolls_back_to_stage_running_on_generation_failure(services) -> None:
    """A failed generation (here: no stage executor, but the same path covers an LLM failure)
    must not leave the orchestrator stuck at STREAMING_CHUNKS - it should land back at
    STAGE_RUNNING so a retry's STAGE_RUNNING -> STREAMING_CHUNKS transition isn't blocked."""

    project = services["project_service"].create_project(
        project_name="Dental SaaS", description="Booking app", owner_id="user-1"
    )
    orchestrator = services["sessions"].get_or_create(project.project_id)
    orchestrator.transition("CLASSIFYING", reason="test setup")
    orchestrator.transition("STAGE_RUNNING", reason="test setup")
    services["sessions"].save(project.project_id, orchestrator)

    with pytest.raises(ValueError, match="no stage executor"):
        await services["stage_service"].run_stage(project.project_id, stage=99)

    assert orchestrator.current_state == "STAGE_RUNNING"
    # Retry must not 409 - confirms the rollback actually unblocks the next attempt.
    with pytest.raises(ValueError, match="no stage executor"):
        await services["stage_service"].run_stage(project.project_id, stage=99)
    assert orchestrator.current_state == "STAGE_RUNNING"


async def test_run_stage_regenerates_from_awaiting_steering(services, llm_overrides) -> None:
    """A stage's first `run_stage` call lands AWAITING_STEERING (e.g. the LLM came back with a
    degenerate/empty candidate set) - re-running it for the same stage must not raise
    InvalidStateTransitionError just because the FSM is no longer at STAGE_RUNNING."""

    project = services["project_service"].create_project(
        project_name="Dental SaaS", description="Booking app", owner_id="user-1"
    )
    orchestrator = services["sessions"].get_or_create(project.project_id)
    orchestrator.transition("CLASSIFYING", reason="test setup")
    orchestrator.transition("STAGE_RUNNING", reason="test setup")
    services["sessions"].save(project.project_id, orchestrator)

    await services["stage_service"].run_stage(project.project_id, stage=2, context="dental SaaS")
    assert orchestrator.current_state == "AWAITING_STEERING"

    candidates = await services["stage_service"].run_stage(project.project_id, stage=2, context="dental SaaS")
    assert orchestrator.current_state == "AWAITING_STEERING"
    assert candidates is not None


async def test_modify_action_edits_candidate_before_commit(services, llm_overrides) -> None:
    """Regression for `node_id`s being regenerated on every
    `preview_nodes`/`accept_all` call: a `modify` action names a `node_id`
    from a previously-rendered panel, so panel and commit must agree on it,
    and the edit made via `apply_modifications` must actually be the thing
    `accept_all` later commits."""

    project = services["project_service"].create_project(
        project_name="Dental SaaS", description="Booking app", owner_id="user-1"
    )
    await services["onboarding_service"].submit_input(
        project.project_id, raw_text="A dental SaaS with patients and dentists."
    )
    orchestrator = services["sessions"].get_or_create(project.project_id)
    if orchestrator.current_state == "AWAITING_INPUT_SEED":
        pytest.skip("TestModel produced a non-WELL_FORMED classification this run; flow tested separately")

    candidates = await services["stage_service"].run_stage(project.project_id, stage=2, context="dental SaaS")
    node_ids = generate_node_ids(candidates)

    preview = preview_nodes(2, candidates, node_ids)
    assert [n.node_id for n in preview] == node_ids

    target_id = node_ids[0]
    new_description = "Edited via modify action - regression check."
    updates = apply_modifications(candidates, node_ids, [(target_id, "description", new_description)])
    assert updates == [{"node_id": target_id, "change_type": "modify", "new_data": {"description": new_description}}]

    committed = services["steering_service"].accept_all(project.project_id, stage=2, candidates=candidates, node_ids=node_ids)
    committed_target = next(n for n in committed if n.node_id == target_id)
    assert committed_target.description == new_description

    with pytest.raises(ValueError):
        apply_modifications(candidates, node_ids, [("no-such-id", "description", "x")])


def _force_awaiting_steering(services, project_id: str) -> None:
    """Deterministically drives the orchestrator to AWAITING_STEERING (the
    only state `accept_all`'s `advance_from_steering` accepts from) without
    a real stage run - mirrors `test_api_core_flow.py`'s
    `_force_awaiting_input_seed` pattern."""

    orchestrator = services["sessions"].get_or_create(project_id)
    orchestrator.transition("CLASSIFYING", reason="test setup")
    orchestrator.transition("STAGE_RUNNING", reason="test setup")
    orchestrator.transition("STREAMING_CHUNKS", reason="test setup")
    orchestrator.transition("AWAITING_STEERING", reason="test setup")
    services["sessions"].save(project_id, orchestrator)


def test_accept_all_use_case_with_nested_flows(services) -> None:
    """Regression: `_candidates_to_nodes` used to pass the LLM-boundary
    `UseCaseStep`/`AlternativeFlow` straight into `UseCaseNode.main_flow`/
    `alternative_flows`, which declare the *domain* `UseCaseStep`/
    `AlternativeFlow` (anti-corruption-layer split, structurally identical,
    different classes) - pydantic's `extra="forbid"` model validation
    rejects an instance of one where the other is declared. Only trips when
    these lists are actually non-empty, which TestModel's minimal output
    never exercises - hence a hand-built candidate here."""

    project = services["project_service"].create_project(
        project_name="Tic-Tac-Toe", description="", owner_id="user-1"
    )
    _force_awaiting_steering(services, project.project_id)

    candidates = UseCaseCandidateSet(
        use_cases=[
            UseCaseCandidate(
                name="Create Game", description="Player starts a new game",
                primary_actor_id="ACT-1", preconditions=["Player is logged in"],
                main_flow=[
                    UseCaseStep(step_number=1, description="Player clicks new game", actor_performing="Player"),
                ],
                alternative_flows=[
                    AlternativeFlow(
                        flow_id="ALT-1", flow_name="No opponent yet", trigger_condition="No second player joins",
                        steps=[UseCaseStep(step_number=1, description="Game stays open", actor_performing="System")],
                    )
                ],
                postconditions=["Game exists in WAITING state"], success_criteria=["Game id returned"],
            )
        ]
    )

    committed = services["steering_service"].accept_all(project.project_id, stage=4, candidates=candidates)
    assert len(committed) == 1
    assert committed[0].main_flow[0].description == "Player clicks new game"
    assert committed[0].alternative_flows[0].steps[0].description == "Game stays open"


def test_accept_all_partial_selection_commits_only_selected_and_keeps_stage_open(services) -> None:
    """"Approve Selected" with some boxes left unchecked must NOT behave like "Approve All" -
    only the selected candidates get committed, the FSM stays at AWAITING_STEERING (the stage
    isn't fully resolved yet), and `remaining_candidates` hands back just the leftovers so a
    follow-up accept doesn't recommit anything already-committed."""

    project = services["project_service"].create_project(
        project_name="Tic-Tac-Toe", description="", owner_id="user-1"
    )
    _force_awaiting_steering(services, project.project_id)

    candidates = ActorCandidateSet(
        actors=[
            ActorCandidate(name="Player", description="Human player", layer="Frontend", risk_classification="LOW_RISK", rationale="r"),
            ActorCandidate(name="ComputerOpponent", description="AI opponent", layer="Backend", risk_classification="LOW_RISK", rationale="r"),
            ActorCandidate(name="H2Database", description="Persistence", layer="Database", risk_classification="MEDIUM", rationale="r"),
        ]
    )
    node_ids = generate_node_ids(candidates)

    committed = services["steering_service"].accept_all(
        project.project_id, stage=2, candidates=candidates, node_ids=node_ids,
        selected_node_ids=node_ids[:2],
    )

    assert {n.name for n in committed} == {"Player", "ComputerOpponent"}
    assert {n.node_id for n in services["nodes"].list_by_project(project.project_id)} == set(node_ids[:2])

    orchestrator = services["sessions"].get_or_create(project.project_id)
    assert orchestrator.current_state == "AWAITING_STEERING"

    kept_candidates, kept_ids = remaining_candidates(candidates, node_ids, {n.node_id for n in committed})
    assert kept_ids == [node_ids[2]]
    assert [a.name for a in kept_candidates.actors] == ["H2Database"]


def test_accept_all_user_story_synthesizes_acceptance_criterion_ids(services) -> None:
    project = services["project_service"].create_project(project_name="Tic-Tac-Toe", description="", owner_id="user-1")
    _force_awaiting_steering(services, project.project_id)

    candidates = UserStoryCandidateSet(
        user_stories=[
            UserStoryCandidate(
                title="As a Player I can create a game", actor_id="ACT-1", story_points=3, priority="Must Have",
                acceptance_criteria=[
                    AcceptanceCriterion(given="I am logged in", when="I click new game", then="a game is created", complete=True),
                ],
                technical_notes="", dependencies=[],
            )
        ]
    )

    committed = services["steering_service"].accept_all(project.project_id, stage=5, candidates=candidates)
    assert len(committed) == 1
    assert committed[0].acceptance_criteria[0].ac_id == "AC-1"


def test_accept_all_engineering_task_with_access_guards(services) -> None:
    project = services["project_service"].create_project(project_name="Tic-Tac-Toe", description="", owner_id="user-1")
    _force_awaiting_steering(services, project.project_id)

    candidates = EngineeringTaskCandidateSet(
        tasks=[
            EngineeringTaskCandidate(
                name="Ban player endpoint", description="Admin-only endpoint to ban a player",
                estimated_hours=2.0, complexity="Medium", preconditions=[], postconditions=[],
                file_paths=["src/main/java/AdminController.java"], tech_stack_requirements=["Spring Boot"],
                access_guards=[AccessGuard(guard_type="authorization", description="Admin role required")],
                parent_story_id="US-1",
            )
        ]
    )

    committed = services["steering_service"].accept_all(project.project_id, stage=6, candidates=candidates)
    assert len(committed) == 1
    assert committed[0].access_guards[0].guard_type == "authorization"
    assert committed[0].risk_classification == "MEDIUM"
