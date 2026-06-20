"""Tests for modules/graph/domain/dependency_graph.py."""

from bluebox.modules.graph.domain.dependency_graph import DependencyGraphService
from bluebox.shared_kernel.domain.node import (
    ActorNode,
    CapabilityNode,
    NodeProvenance,
    UseCaseNode,
    UserStoryNode,
)


def _provenance(stage: int) -> NodeProvenance:
    return NodeProvenance(generated_at_stage=stage, decision_entry_id=f"DEC-{stage}", checkpoint_id=f"CKPT-{stage}")


def _tree() -> list:
    """Actor -> Capability -> UseCase -> UserStory, mirroring doc/prd.md
    SS4.5's "Story -> UseCase -> Capability -> Actor" graph."""

    actor = ActorNode(
        node_id="ACT-1", name="Patient", description="End user", layer="Auth",
        risk_classification="LOW_RISK", status="SYSTEM_GENERATED", created_by="system",
        provenance=_provenance(2),
    )
    capability = CapabilityNode(
        node_id="CAP-1", name="Booking", description="Book appts", layer="Backend",
        risk_classification="LOW_RISK", status="SYSTEM_GENERATED", created_by="system",
        provenance=_provenance(3), parent_id="ACT-1", related_actor_ids=["ACT-1"],
    )
    use_case = UseCaseNode(
        node_id="UC-1", name="Book appointment", description="...", layer="Backend",
        risk_classification="LOW_RISK", status="SYSTEM_GENERATED", created_by="system",
        provenance=_provenance(4), parent_id="CAP-1", primary_actor_id="ACT-1",
        preconditions=[], main_flow=[], postconditions=[], success_criteria=[],
    )
    story = UserStoryNode(
        node_id="US-1", name="Book as patient", description="...", layer="Backend",
        risk_classification="LOW_RISK", status="SYSTEM_GENERATED", created_by="system",
        provenance=_provenance(5), parent_id="UC-1", title="As a Patient...",
        actor_id="ACT-1", story_points=5, priority="Must Have",
        acceptance_criteria=[], technical_notes="",
    )
    return [actor, capability, use_case, story]


def test_downstream_separates_direct_from_transitive() -> None:
    service = DependencyGraphService(_tree())
    report = service.downstream("ACT-1", report_id="RPT-1")
    assert report.directly_affected == ["CAP-1"]
    assert report.transitively_affected == ["UC-1", "US-1"]
    assert report.stages_to_rerun == [3, 4, 5]


def test_downstream_from_leaf_has_no_affected_nodes() -> None:
    service = DependencyGraphService(_tree())
    report = service.downstream("US-1", report_id="RPT-2")
    assert report.directly_affected == []
    assert report.transitively_affected == []
    assert report.stages_to_rerun == []


def test_upstream_stages_walks_ancestors() -> None:
    service = DependencyGraphService(_tree())
    assert service.upstream_stages("US-1") == [4, 3, 2]


def test_detect_cycles_on_acyclic_tree_is_empty() -> None:
    service = DependencyGraphService(_tree())
    assert service.detect_cycles() == []


def test_detect_cycles_finds_a_real_cycle() -> None:
    nodes = _tree()
    # Force a cycle: ACT-1's parent_id now points back into the tree.
    nodes[0].parent_id = "US-1"
    service = DependencyGraphService(nodes)
    cycles = service.detect_cycles()
    assert len(cycles) == 1
    assert set(cycles[0][:-1]) == {"ACT-1", "CAP-1", "UC-1", "US-1"}
