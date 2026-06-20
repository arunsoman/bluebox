"""Tests for chat/application/chat_service.py."""

from contextlib import ExitStack

import pytest
from pydantic_ai.models.test import TestModel

from bluebox.modules.chat.application.chat_service import ChatService
from bluebox.modules.chat.llm import agents as chat_agents
from bluebox.modules.chat.llm.responses import NodeManipulationAction
from bluebox.modules.governance.application.node_service import NodeService
from bluebox.shared_kernel.domain.audit import (
    AuditActor,
    AuditEvent,
    AuditTarget,
    DecisionEntry,
    DecisionEntryMetadata,
    ProvenanceChain,
)
from bluebox.shared_kernel.domain.node import ActorNode, NodeProvenance
from bluebox.shared_kernel.infrastructure.in_memory import (
    InMemoryAuditTrailRepository,
    InMemoryChatRepository,
    InMemoryDecisionLedgerRepository,
    InMemoryNodeRepository,
)

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
def chat_service():
    chat = InMemoryChatRepository()
    decisions = InMemoryDecisionLedgerRepository()
    audit = InMemoryAuditTrailRepository()
    nodes = InMemoryNodeRepository()
    nodes.add(_PROJECT, _make_actor())

    decisions.append(
        _PROJECT,
        DecisionEntry(
            entry_id="DEC-1",
            decision_type="steering",
            stage=2,
            stage_name="Actor Discovery",
            summary="Accepted actor 'Dentist'",
            provenance=ProvenanceChain(trigger_event="STEERING_ACTION", context_snapshot_id="CKPT-1"),
            metadata=DecisionEntryMetadata(
                layer="Frontend", risk_classification="LOW_RISK", auto_approved=True,
                trust_mode_at_decision="FULL_AUTONOMY",
            ),
            created_by="user-1",
        ),
    )
    audit.append(
        _PROJECT,
        AuditEvent(
            event_id="EVT-1",
            session_id="sess-1",
            actor=AuditActor(user_id="user-1", role="Admin"),
            action="NODE_COMMIT",
            target=AuditTarget(target_type="node", target_id="ACT-1"),
            description="Committed actor node ACT-1",
        ),
    )

    service = ChatService(chat, decisions, audit, NodeService(nodes))
    return service, chat, nodes


def _override_agents():
    return ExitStack()


async def test_ask_context_question_uses_retrieved_context(chat_service) -> None:
    service, _, _ = chat_service
    with chat_agents.context_question_agent.override(model=TestModel()):
        answer = await service.ask_context_question(_PROJECT, "why was the Dentist actor added?")
    assert answer.answer


async def test_send_message_persists_inbound_and_outbound(chat_service) -> None:
    service, chat, _ = chat_service
    with ExitStack() as stack:
        stack.enter_context(chat_agents.chat_intent_parse_agent.override(model=TestModel()))
        stack.enter_context(chat_agents.chat_response_agent.override(model=TestModel()))
        outbound = await service.send_message(_PROJECT, "what's the status of stage 2?")

    assert outbound.sender == "system"
    history = chat.list(_PROJECT)
    assert len(history) == 2
    assert history[0].sender == "user"
    assert history[1] is outbound


def test_dispatch_node_manipulation_deactivate(chat_service) -> None:
    service, _, nodes = chat_service
    note = service._dispatch_node_manipulation(
        _PROJECT, NodeManipulationAction(action="deactivate", node_type="actor", node_id="ACT-1")
    )
    assert note == "Deactivated node ACT-1."
    assert nodes.get(_PROJECT, "ACT-1").is_active is False


def test_dispatch_node_manipulation_add_is_not_executed(chat_service) -> None:
    service, _, _ = chat_service
    note = service._dispatch_node_manipulation(
        _PROJECT, NodeManipulationAction(action="add", node_type="actor")
    )
    assert note is None


def test_list_and_delete_messages(chat_service) -> None:
    service, chat, _ = chat_service
    from bluebox.modules.chat.domain.chat_message import ChatMessage

    chat.append(_PROJECT, ChatMessage(message_id="MSG-1", message_type="user_intent", sender="user", content="hi"))
    assert len(service.list_messages(_PROJECT)) == 1
    assert service.delete_message(_PROJECT, "MSG-1") is True
    assert service.list_messages(_PROJECT) == []
    assert service.delete_message(_PROJECT, "does-not-exist") is False
