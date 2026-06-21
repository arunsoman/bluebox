"""Tests for governance/application/node_relations.py."""

from bluebox.modules.governance.application.node_relations import gather_design_context
from bluebox.shared_kernel.domain.node import (
    ActorNode,
    CapabilityNode,
    EngineeringTaskNode,
    NodeProvenance,
    UseCaseNode,
    UserStoryNode,
)

_PROVENANCE = NodeProvenance(generated_at_stage=2, decision_entry_id="DEC-1", checkpoint_id="CKPT-1")


def _actor(node_id: str) -> ActorNode:
    return ActorNode(
        node_id=node_id, name="Dentist", description="A dental practitioner", layer="Frontend",
        risk_classification="LOW_RISK", status="SYSTEM_GENERATED", created_by="system",
        provenance=_PROVENANCE,
    )


def _capability(node_id: str, related_actor_ids: list[str]) -> CapabilityNode:
    return CapabilityNode(
        node_id=node_id, name="Booking", description="Book appointments", layer="Backend",
        risk_classification="LOW_RISK", status="SYSTEM_GENERATED", created_by="system",
        provenance=_PROVENANCE, related_actor_ids=related_actor_ids,
    )


def _use_case(node_id: str, primary_actor_id: str, secondary_actor_ids: list[str]) -> UseCaseNode:
    return UseCaseNode(
        node_id=node_id, name="Book appointment", description="A dentist books an appointment",
        layer="Backend", risk_classification="LOW_RISK", status="SYSTEM_GENERATED", created_by="system",
        provenance=_PROVENANCE, primary_actor_id=primary_actor_id, secondary_actor_ids=secondary_actor_ids,
        preconditions=[], main_flow=[], postconditions=[], success_criteria=[],
    )


def _story(node_id: str, actor_id: str, dependencies: list[str]) -> UserStoryNode:
    return UserStoryNode(
        node_id=node_id, name="Booking story", description="As a dentist I book an appointment",
        layer="Backend", risk_classification="LOW_RISK", status="SYSTEM_GENERATED", created_by="system",
        provenance=_PROVENANCE, title="Book appointment", actor_id=actor_id, story_points=3,
        priority="Must Have", acceptance_criteria=[], technical_notes="", dependencies=dependencies,
    )


def _task(node_id: str, parent_story_id: str) -> EngineeringTaskNode:
    return EngineeringTaskNode(
        node_id=node_id, name="Booking endpoint", description="POST /bookings", layer="Backend",
        risk_classification="LOW_RISK", status="SYSTEM_GENERATED", created_by="system",
        provenance=_PROVENANCE, estimated_hours=4, complexity="Low", preconditions=[], postconditions=[],
        file_paths=["backend/bookings.py"], tech_stack_requirements=["FastAPI"],
        parent_story_id=parent_story_id,
    )


def _build_graph():
    actor = _actor("ACT-1")
    other_actor = _actor("ACT-2")
    capability = _capability("CAP-1", related_actor_ids=["ACT-1"])
    use_case = _use_case("UC-1", primary_actor_id="ACT-1", secondary_actor_ids=["ACT-2"])
    dependency_story = _story("US-2", actor_id="ACT-2", dependencies=[])
    story = _story("US-1", actor_id="ACT-1", dependencies=["US-2"])
    task = _task("TASK-1", parent_story_id="US-1")
    return [actor, other_actor, capability, use_case, dependency_story, story, task]


def test_engineering_task_returns_self_and_parent_story() -> None:
    nodes = _build_graph()
    result = gather_design_context(nodes, "TASK-1")
    assert {n.node_id for n in result} == {"TASK-1", "US-1"}


def test_user_story_returns_actor_dependency_and_child_task() -> None:
    nodes = _build_graph()
    result = gather_design_context(nodes, "US-1")
    assert {n.node_id for n in result} == {"US-1", "ACT-1", "US-2", "TASK-1"}


def test_use_case_returns_primary_and_secondary_actors() -> None:
    nodes = _build_graph()
    result = gather_design_context(nodes, "UC-1")
    assert {n.node_id for n in result} == {"UC-1", "ACT-1", "ACT-2"}


def test_capability_returns_related_actors() -> None:
    nodes = _build_graph()
    result = gather_design_context(nodes, "CAP-1")
    assert {n.node_id for n in result} == {"CAP-1", "ACT-1"}


def test_actor_returns_only_itself() -> None:
    nodes = _build_graph()
    result = gather_design_context(nodes, "ACT-1")
    assert {n.node_id for n in result} == {"ACT-1"}


def test_missing_node_id_returns_empty_list() -> None:
    nodes = _build_graph()
    assert gather_design_context(nodes, "does-not-exist") == []
