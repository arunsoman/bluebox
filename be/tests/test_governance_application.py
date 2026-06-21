"""Tests for governance/application/node_service.py."""

import pytest
from pydantic_ai.models.test import TestModel

from bluebox.modules.governance.application.node_service import NodeNotFoundError, NodeService
from bluebox.modules.governance.llm import agents as governance_agents
from bluebox.shared_kernel.domain.node import ActorNode, NodeProvenance
from bluebox.shared_kernel.infrastructure.in_memory import InMemoryNodeRepository

_PROJECT = "proj-test"


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
