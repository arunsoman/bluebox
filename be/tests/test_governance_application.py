"""Tests for governance/application/node_service.py."""

import pytest
from pydantic_ai.models.test import TestModel

from bluebox.modules.governance.application.node_service import NodeNotFoundError, NodeService
from bluebox.modules.governance.llm import agents as governance_agents
from bluebox.shared_kernel.domain.node import ActorNode, Node, NodeProvenance
from bluebox.shared_kernel.infrastructure.in_memory import InMemoryNodeRepository

_PROJECT = "proj-test"


class _CopyOnGetNodeRepository:
    """Mimics `SqliteNodeRepository.get()`'s real contract: a fresh
    deserialized `Node` instance every call, no shared object identity with
    whatever a previous `get()` handed back. `InMemoryNodeRepository` (the
    fixture every other test here uses) hands back the *same* object on
    every `get()`, so a `NodeService` method that mutates it in place and
    forgets to `self._nodes.add()` it back looks like it works under that
    double but silently drops the edit against the real backend - this
    double exists to make that regression fail in a unit test instead of
    only showing up live."""

    def __init__(self) -> None:
        self._backing = InMemoryNodeRepository()

    def add(self, project_id: str, node: Node) -> None:
        self._backing.add(project_id, node.model_copy(deep=True))

    def get(self, project_id: str, node_id: str) -> Node | None:
        node = self._backing.get(project_id, node_id)
        return node.model_copy(deep=True) if node else None

    def list_by_project(self, project_id: str) -> list[Node]:
        return [n.model_copy(deep=True) for n in self._backing.list_by_project(project_id)]


def _make_actor(node_id: str = "ACT-1") -> ActorNode:
    return ActorNode(
        node_id=node_id,
        name="Dentist",
        description="A dental practitioner",
        layer="Frontend",
        risk_classification="LOW_RISK",
        status="SYSTEM_GENERATED",
        created_by="system",
        provenance=NodeProvenance(generated_at_stage=2, decision_entry_id="DEC-1", checkpoint_id="CKPT-1"),
    )


@pytest.fixture
def node_service():
    nodes = InMemoryNodeRepository()
    nodes.add(_PROJECT, _make_actor())
    return NodeService(nodes), nodes


@pytest.fixture
def node_service_copy_on_get():
    nodes = _CopyOnGetNodeRepository()
    nodes.add(_PROJECT, _make_actor())
    return NodeService(nodes), nodes


def test_deactivate_restore_persist_across_a_fresh_get(node_service_copy_on_get) -> None:
    service, nodes = node_service_copy_on_get
    service.deactivate(_PROJECT, "ACT-1")
    assert nodes.get(_PROJECT, "ACT-1").is_active is False

    service.restore(_PROJECT, "ACT-1")
    assert nodes.get(_PROJECT, "ACT-1").is_active is True


def test_update_persists_across_a_fresh_get(node_service_copy_on_get) -> None:
    service, nodes = node_service_copy_on_get
    service.update(_PROJECT, "ACT-1", {"name": "Dental Practitioner"})
    assert nodes.get(_PROJECT, "ACT-1").name == "Dental Practitioner"


async def test_enrich_persists_across_a_fresh_get(node_service_copy_on_get) -> None:
    service, nodes = node_service_copy_on_get
    with governance_agents.node_enrichment_agent.override(model=TestModel()):
        await service.enrich(_PROJECT, "ACT-1")
    assert nodes.get(_PROJECT, "ACT-1").status == "USER_ENRICHED"


def test_get_raises_when_missing(node_service) -> None:
    service, _ = node_service
    with pytest.raises(NodeNotFoundError):
        service.get(_PROJECT, "does-not-exist")


def test_list_by_project_passthrough(node_service) -> None:
    service, _ = node_service
    listed = service.list_by_project(_PROJECT)
    assert [n.node_id for n in listed] == ["ACT-1"]


def test_deactivate_and_restore(node_service) -> None:
    service, _ = node_service
    node = service.deactivate(_PROJECT, "ACT-1")
    assert node.is_active is False
    node = service.restore(_PROJECT, "ACT-1")
    assert node.is_active is True


async def test_enrich_applies_changes_and_advances_status(node_service) -> None:
    service, nodes = node_service
    with governance_agents.node_enrichment_agent.override(model=TestModel()):
        node, result = await service.enrich(_PROJECT, "ACT-1")

    assert node.status == "USER_ENRICHED"
    assert node.version == 2
    stored = nodes.get(_PROJECT, "ACT-1")
    assert stored is node
    assert result.completeness_score_after >= 0


async def test_enrich_defaults_fields_to_enrich_to_validation_failures(node_service, monkeypatch) -> None:
    """Regression: "AI Auto-Fix" used to hand the model only {name,
    description}, so a node failing e.g. "Preconditions must define at
    least one precondition" got its description rewritten while
    preconditions stayed empty - the actual reported error never cleared.
    `enrich` must default fields_to_enrich to whatever's failing validation
    and surface each failing field's current (empty) value + message."""

    from bluebox.shared_kernel.domain.node import EngineeringTaskNode

    service, nodes = node_service
    task = EngineeringTaskNode(
        node_id="TASK-1", name="Move scorer", description="Scores a move",
        layer="Backend", risk_classification="LOW_RISK", status="SYSTEM_GENERATED",
        created_by="system", provenance=_make_actor().provenance,
        preconditions=[], postconditions=["Score recorded"], file_paths=["Scorer.java"],
        tech_stack_requirements=["Java"], estimated_hours=2.0, complexity="Low", parent_story_id="US-1",
    )
    nodes.add(_PROJECT, task)

    captured = {}

    async def fake_enrich_node(request):
        captured["request"] = request
        from bluebox.modules.governance.llm.responses import EnrichResult

        return EnrichResult(enriched_fields={}, new_suggestions=[], completeness_score_before=0.5, completeness_score_after=0.5)

    monkeypatch.setattr(governance_agents, "enrich_node", fake_enrich_node)
    await service.enrich(_PROJECT, "TASK-1")

    request = captured["request"]
    assert request.fields_to_enrich == ["preconditions"]
    assert request.current_data["preconditions"] == []
    assert request.current_data["validation_errors"] == [
        {"field_path": "preconditions", "message": "Preconditions must define at least one precondition."}
    ]


def test_update_generic_edit_bumps_version_and_ignores_unknown_keys(node_service) -> None:
    service, _ = node_service
    node = service.update(_PROJECT, "ACT-1", {"name": "Dental Practitioner", "not_a_real_field": "x"})
    assert node.name == "Dental Practitioner"
    assert node.version == 2
    assert not hasattr(node, "not_a_real_field")


def test_update_protects_immutable_fields(node_service) -> None:
    service, _ = node_service
    node = service.update(_PROJECT, "ACT-1", {"node_id": "ACT-HIJACKED", "created_by": "someone-else"})
    assert node.node_id == "ACT-1"
    assert node.created_by == "system"


def test_update_status_deferred_requires_rationale(node_service) -> None:
    service, _ = node_service
    with pytest.raises(ValueError, match="change_rationale"):
        service.update(_PROJECT, "ACT-1", {"status": "DEFERRED"})


def test_update_status_deferred_routes_through_defer_lifecycle(node_service) -> None:
    service, _ = node_service
    node = service.update(_PROJECT, "ACT-1", {"status": "DEFERRED"}, change_rationale="Out of scope for MVP")
    assert node.status == "DEFERRED"
    assert node.deferred_rationale == "Out of scope for MVP"
