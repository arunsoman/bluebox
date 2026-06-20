"""Chat & Context Agent application service - doc/prd.md SS4.6.

`send_message` covers doc/api_event_contract.md SS4.1 `CHAT_MESSAGE` ->
`CHAT_RESPONSE`: persist the inbound message, parse intent, dispatch a
structured action when one was confidently parsed, generate a reply,
persist + return it. `ask_context_question` covers the separate
`CONTEXT_QUESTION` -> `CONTEXT_ANSWER` event pair - distinct in the
contract from the chat send/response pair, not a chat message variant.

Node manipulation dispatch is intentionally narrow: only `deactivate`/
`restore` are wired to `NodeService`, matching what `NodeService` (pass 5)
actually implements. `add`/`edit`/`remove` and any `SteeringActionIntent`
are acknowledged in the reply text but not executed - same "don't fabricate
behavior the system doesn't have" principle the contract applies to the
frontend (CLAUDE.md), applied here to chat-triggered actions.
"""

import uuid

from bluebox.modules.chat.domain.chat_message import ChatMessage, RichCard
from bluebox.modules.chat.llm import agents as chat_agents
from bluebox.modules.chat.llm.requests import (
    ChatIntentParseRequest,
    ChatResponseRequest,
    ContextQuestionRequest,
    RetrievedContextItem,
)
from bluebox.modules.chat.llm.responses import ContextAnswer, NodeManipulationAction
from bluebox.modules.governance.application.node_service import NodeService
from bluebox.shared_kernel.ports import AuditTrailRepository, ChatRepository, DecisionLedgerRepository

_MAX_RETRIEVED_DECISIONS = 5
_MAX_RETRIEVED_AUDIT_EVENTS = 5


def _new_message_id() -> str:
    return f"MSG-{uuid.uuid4().hex[:8].upper()}"


class ChatService:
    def __init__(
        self,
        chat: ChatRepository,
        decisions: DecisionLedgerRepository,
        audit: AuditTrailRepository,
        nodes: NodeService,
    ) -> None:
        self._chat = chat
        self._decisions = decisions
        self._audit = audit
        self._nodes = nodes

    def _retrieve_context(self, project_id: str) -> list[RetrievedContextItem]:
        items = [
            RetrievedContextItem(
                source_type="decision", source_id=entry.entry_id, content=entry.summary
            )
            for entry in self._decisions.list(project_id)[-_MAX_RETRIEVED_DECISIONS:]
        ]
        items += [
            RetrievedContextItem(
                source_type="audit_event", source_id=event.event_id, content=event.description
            )
            for event in self._audit.list(project_id)[-_MAX_RETRIEVED_AUDIT_EVENTS:]
        ]
        return items

    async def ask_context_question(
        self, project_id: str, question: str, context_node_id: str | None = None
    ) -> ContextAnswer:
        """doc/api_event_contract.md SS4.1 `CONTEXT_QUESTION` -> `CONTEXT_ANSWER`."""

        return await chat_agents.answer_context_question(
            ContextQuestionRequest(
                question=question,
                context_node_id=context_node_id,
                retrieved_context=self._retrieve_context(project_id),
            )
        )

    def _dispatch_node_manipulation(
        self, project_id: str, action: NodeManipulationAction
    ) -> str | None:
        if action.action == "deactivate" and action.node_id:
            self._nodes.deactivate(project_id, action.node_id)
            return f"Deactivated node {action.node_id}."
        if action.action == "restore" and action.node_id:
            self._nodes.restore(project_id, action.node_id)
            return f"Restored node {action.node_id}."
        return None

    async def send_message(
        self,
        project_id: str,
        text: str,
        message_type: str = "user_intent",
        context_node_id: str | None = None,
        sender: str = "user",
    ) -> ChatMessage:
        """doc/api_event_contract.md SS4.1 `CHAT_MESSAGE` -> `CHAT_RESPONSE`."""

        inbound = ChatMessage(
            message_id=_new_message_id(),
            message_type=message_type,  # type: ignore[arg-type]
            sender=sender,  # type: ignore[arg-type]
            content=text,
        )
        self._chat.append(project_id, inbound)

        parsed = await chat_agents.parse_chat_intent(
            ChatIntentParseRequest(
                text=text, message_type=message_type, context_node_id=context_node_id  # type: ignore[arg-type]
            )
        )

        action_note: str | None = None
        if isinstance(parsed.structured_action, NodeManipulationAction):
            action_note = self._dispatch_node_manipulation(project_id, parsed.structured_action)

        reply = await chat_agents.generate_chat_response(
            ChatResponseRequest(
                conversation_history=[m.content for m in self._chat.list(project_id)],
                user_message=text,
                parsed_intent=parsed.intent_matched,
            )
        )

        outbound = ChatMessage(
            message_id=_new_message_id(),
            message_type="rich_card" if reply.rich_card else "system_response",
            sender="system",
            content=f"{reply.content}\n\n{action_note}" if action_note else reply.content,
            parent_message_id=inbound.message_id,
            rich_card=RichCard(**reply.rich_card.model_dump()) if reply.rich_card else None,
            intent_matched=parsed.intent_matched,
            action_taken=parsed.action_taken,
        )
        self._chat.append(project_id, outbound)
        return outbound

    def list_messages(self, project_id: str) -> list[ChatMessage]:
        return self._chat.list(project_id)

    def delete_message(self, project_id: str, message_id: str) -> bool:
        return self._chat.delete(project_id, message_id)
