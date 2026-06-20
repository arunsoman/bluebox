"""Persisted chat message - doc/api_event_contract.md SS4.1 `ChatMessage`.

Owned by the chat module (doc/prd.md SS4.6 Chat & Context Agent Module),
unlike `DecisionEntry`/`AuditEvent` (shared_kernel - PRD's architecture
diagram lists those as cross-cutting; chat history is not).
"""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class CommandPayload(BaseModel):
    """doc/api_event_contract.md SS4.1 `CommandPayload`."""

    model_config = ConfigDict(extra="forbid")

    command: str
    args: list[str] = Field(default_factory=list)
    parsed_intent: str | None = None


class RichCardAction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action_id: str
    label: str
    action_type: Literal["steering_action", "navigation", "api_call"]
    payload: Any = None
    style: Literal["primary", "secondary", "danger"] = "secondary"


class RichCard(BaseModel):
    """doc/api_event_contract.md SS4.1 `RichCard`."""

    model_config = ConfigDict(extra="forbid")

    card_type: Literal["steering_panel", "impact_report", "code_stream", "test_result", "error_recovery"]
    title: str
    payload: Any = None
    actions: list[RichCardAction] = Field(default_factory=list)
    collapsible: bool = True
    default_collapsed: bool = False


class ChatMessage(BaseModel):
    """doc/api_event_contract.md SS4.1 `ChatMessage`."""

    model_config = ConfigDict(extra="forbid")

    message_id: str
    message_type: Literal["user_intent", "user_command", "user_feedback", "system_response", "rich_card"]
    sender: Literal["user", "system", "context_agent"]
    content: str
    timestamp: datetime = Field(default_factory=datetime.now)
    edited_at: datetime | None = None
    parent_message_id: str | None = None
    rich_card: RichCard | None = None
    command_payload: CommandPayload | None = None
    linked_decision_id: str | None = None
    linked_audit_event_id: str | None = None
    intent_matched: str | None = None
    action_taken: str | None = None
