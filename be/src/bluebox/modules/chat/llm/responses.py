"""LLM response models for the Chat & Context Agent module.

Field shapes transcribed from doc/api_event_contract.md SS4.1.
"""

from typing import Literal

from bluebox.shared_kernel.llm.base import LLMResponse


class SourceRef(LLMResponse):
    """doc/api_event_contract.md SS4.1 `CONTEXT_ANSWER.sources[]`."""

    source_type: Literal["decision", "audit_event", "node"]
    source_id: str
    excerpt: str


class ContextAnswer(LLMResponse):
    """doc/api_event_contract.md SS4.1 `CONTEXT_ANSWER`."""

    answer: str
    sources: list[SourceRef]


class NodeManipulationAction(LLMResponse):
    """doc/api_event_contract.md SS5.1 `NODE_MANIPULATION`, as a parsed chat-intent target."""

    action: Literal["add", "edit", "remove", "deactivate", "restore"]
    node_type: str
    node_id: str | None = None
    data: dict[str, str] = {}


class SteeringActionIntent(LLMResponse):
    """doc/api_event_contract.md SS4.2 `SteeringAction`, as a parsed chat-intent target."""

    action_type: Literal["accept", "modify", "replace", "authorize"]
    stage_id: int


class ChatIntentParseResult(LLMResponse):
    """doc/api_event_contract.md SS4.1 `ChatMessage.intent_matched`/`action_taken`."""

    intent_matched: str
    action_taken: str
    structured_action: NodeManipulationAction | SteeringActionIntent | None = None
    confidence: float


class RichCardAction(LLMResponse):
    """doc/api_event_contract.md SS4.1 `CardAction`."""

    action_id: str
    label: str
    action_type: Literal["steering_action", "navigation", "api_call"]
    style: Literal["primary", "secondary", "danger"] = "secondary"


class RichCard(LLMResponse):
    """doc/api_event_contract.md SS4.1 `RichCard`."""

    card_type: Literal["steering_panel", "impact_report", "code_stream", "test_result", "error_recovery"]
    title: str
    payload: dict[str, str] = {}
    actions: list[RichCardAction]
    collapsible: bool = True
    default_collapsed: bool = False


class ChatResponseResult(LLMResponse):
    """doc/api_event_contract.md SS4.1 `ChatMessage` (system_response variant)."""

    content: str
    rich_card: RichCard | None = None


class PreviewFeedbackInterpretationResult(LLMResponse):
    """doc/api_event_contract.md SS4.5 `PreviewFeedback` -> doc/prd.md AC-CG-09 revision synthesis."""

    target_node_id: str | None = None
    proposed_change: dict[str, str]
    rationale: str


class MidSteerSignal(LLMResponse):
    """doc/prd.md SS14.1 `MID_STAGE_STEER` event payload."""

    instruction: str
    action_type: str
