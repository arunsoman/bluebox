"""doc/api_event_contract.md SS4.1 Chat & Context Agent.

`CONTEXT_QUESTION`/`CONTEXT_ANSWER` is WS-only in the contract; `POST
/chat/context-question` is added as the non-WS path, same pattern used for
the advisory "generate" routes.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict

from bluebox.interfaces.api.deps import get_chat_service
from bluebox.modules.chat.application.chat_service import ChatService
from bluebox.modules.chat.domain.chat_message import ChatMessage
from bluebox.modules.chat.llm.responses import ContextAnswer

router = APIRouter(prefix="/api/v1/projects/{project_id}/chat", tags=["chat"])


class SendMessageRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    content: str
    message_type: str = "user_intent"
    context_node_id: str | None = None


class ContextQuestionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question: str
    context_node_id: str | None = None


@router.get("")
def get_history(project_id: str, service: ChatService = Depends(get_chat_service)) -> dict:
    messages = service.list_messages(project_id)
    return {"messages": messages}


@router.post("", response_model=ChatMessage)
async def send_message(
    project_id: str, request: SendMessageRequest, service: ChatService = Depends(get_chat_service)
) -> ChatMessage:
    return await service.send_message(
        project_id, request.content, message_type=request.message_type,
        context_node_id=request.context_node_id,
    )


@router.delete("/{message_id}")
def delete_message(
    project_id: str, message_id: str, service: ChatService = Depends(get_chat_service)
) -> dict:
    deleted = service.delete_message(project_id, message_id)
    return {"deleted": deleted}


@router.post("/context-question", response_model=ContextAnswer)
async def ask_context_question(
    project_id: str, request: ContextQuestionRequest, service: ChatService = Depends(get_chat_service)
) -> ContextAnswer:
    return await service.ask_context_question(project_id, request.question, request.context_node_id)
