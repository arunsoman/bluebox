"""LLM request models for the Chat & Context Agent module.

doc/prd.md SS4.6: ContextAgent (read/write/what-if), IntentParser.
"""

from typing import Literal

from bluebox.shared_kernel.llm.base import LLMRequest


class RetrievedContextItem(LLMRequest):
    """One piece of context retrieved (RAG over Decision Ledger / Audit Trail /
    Pipeline State) and fed to the ContextAgent prompt - doc/prd.md SS4.6."""

    source_type: Literal["decision", "audit_event", "node"]
    source_id: str
    content: str


class ContextQuestionRequest(LLMRequest):
    """doc/api_event_contract.md SS4.1 `CONTEXT_QUESTION` -> `CONTEXT_ANSWER`."""

    question: str
    context_node_id: str | None = None
    retrieved_context: list[RetrievedContextItem] = []


class ChatIntentParseRequest(LLMRequest):
    """doc/api_event_contract.md SS4.1 `ChatMessage` (inbound); doc/prd.md SS4.6 IntentParser."""

    text: str
    message_type: Literal["user_intent", "user_command", "user_feedback"]
    context_node_id: str | None = None
    context_file_path: str | None = None


class ChatResponseRequest(LLMRequest):
    """doc/api_event_contract.md SS4.1 `ChatMessage` (system_response variant)."""

    conversation_history: list[str]
    user_message: str
    parsed_intent: str | None = None


class PreviewFeedbackInterpretationRequest(LLMRequest):
    """doc/api_event_contract.md SS4.5 `PreviewFeedback`; doc/prd.md AC-CG-09."""

    text: str
    element_selector: str | None = None
    component_path: str | None = None


class InlineSteeringCommentRequest(LLMRequest):
    """doc/prd.md FR-IDE-09 - inline `// @steering: ...` editor comments."""

    file_path: str
    comment_text: str
    surrounding_code: str
