"""The steering WebSocket session - doc/api_event_contract.md SS1.1, SS10.

Mirrors `mock_server.py`'s dual registration at `/ws/{project_id}` and
`/api/v1/steering/session/{project_id}` (CLAUDE.md), but real: every event
pushed below is the direct result of an awaited LLM/application call
completing, never a scripted `asyncio.sleep` timeline. Frame format is
`{"event": str, "payload": object}` on both directions, matching
`new-fe/src/ws/socketClient.ts`.

Scope (deliberately not the full SS10 event table - see the plan): handles
`AUTH_SESSION_INIT`, `USER_INPUT` (onboarding, auto-advancing into the first
stage), `STEERING_ACTION` (accept only - same restriction as the REST
router), `CHAT_MESSAGE`, `CONTEXT_QUESTION`, and `NODE_MANIPULATION`
(delete/restore only - `NodeService` doesn't implement create/update).
Every other client event from SS10.1 (RBAC_STEERING_ACTION, HOSTING_SELECTION,
GRAPH_NODE_SELECT, ...) is out of scope for this pass and is acknowledged
with an `ERROR` frame rather than silently ignored.
"""

from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.encoders import jsonable_encoder

from bluebox.interfaces.api.auth import TokenInvalidError, decode_token
from bluebox.interfaces.api.deps import (
    get_chat_service,
    get_node_service,
    get_onboarding_service,
    get_stage_service,
    get_steering_service,
)
from bluebox.interfaces.panel_builder import build_steering_panel
from bluebox.interfaces.ws.connection_registry import connection_registry
from bluebox.modules.governance.application.node_service import NodeNotFoundError
from bluebox.shared_kernel.infrastructure.in_memory import app_state
from bluebox.shared_kernel.llm.connector import LLMCallFailed
from bluebox.shared_kernel.observability.log_bus import log_bus
from bluebox.shared_kernel.observability.log_event import LogEvent

router = APIRouter()

_FIRST_GENERATIVE_STAGE = 2
_LAST_GENERATIVE_STAGE = 6

_STATE_TO_STAGE = {
    "INITIALIZED": 0, "CLASSIFYING": 0, "AWAITING_INPUT_SEED": 0,
    "CODE_GENERATING": 8, "RESOLVING_CONFLICT": 8, "AWAITING_CODE_REVIEW": 8,
    "RUNNING": 9, "AWAITING_RUNTIME_FEEDBACK": 9,
}


async def _send(websocket: WebSocket, project_id: str, event: str, payload: Any) -> None:
    encoded = jsonable_encoder({"event": event, "payload": payload})
    await websocket.send_json(encoded)
    if event == "LOG_EVENT":
        return  # the log viewer's own push frame - never log itself
    await log_bus.publish(
        LogEvent(
            project_id=project_id,
            category="ws_sent_by_backend",
            summary=f"WS server->client {event}",
            detail=encoded,
        )
    )


async def _receive(websocket: WebSocket, project_id: str) -> dict[str, Any]:
    frame = await websocket.receive_json()
    await log_bus.publish(
        LogEvent(
            project_id=project_id,
            category="ws_received_by_backend",
            summary=f"WS client->server {frame.get('event')}",
            detail=frame,
        )
    )
    return frame


async def _send_transitions(websocket: WebSocket, project_id: str, history_before: int) -> None:
    orchestrator = app_state.sessions.get_or_create(project_id)
    for record in orchestrator.history[history_before:]:
        await _send(websocket, project_id, "STATE_TRANSITION", record)


def _current_stage(project_id: str, current_state: str) -> int:
    cached = app_state.pending_candidates.get(project_id)
    if cached is not None:
        return cached[0]
    committed_stages = [n.provenance.generated_at_stage for n in app_state.nodes.list_by_project(project_id)]
    if committed_stages:
        return max(committed_stages)
    return _STATE_TO_STAGE.get(current_state, 0)


async def _send_session_state(websocket: WebSocket, project_id: str) -> None:
    orchestrator = app_state.sessions.get_or_create(project_id)
    stage = _current_stage(project_id, orchestrator.current_state)
    await _send(websocket, project_id, "PIPELINE_STATE_CHANGED", {
        "session_id": project_id,
        "current_state": orchestrator.current_state,
        "current_stage": stage,
        "stage_name": "",
        "stage_progress": 0.0,
        "overall_progress": min(stage / 9, 1.0),
        "trust_mode": orchestrator.trust_mode,
        "pending_steering": project_id in app_state.pending_candidates,
        "last_activity_at": "",
        "idle_suspend_minutes": 60,
        "idle_expire_days": 30,
    })


async def _run_and_advance_stage(websocket: WebSocket, project_id: str, stage: int, context: str = "") -> None:
    """Generates `stage`'s candidates, caches them, and pushes
    `STEERING_PANEL_READY` - the auto-advance step between onboarding/an
    accepted steering action and the next stage boundary."""

    stage_service = get_stage_service()
    history_before = len(app_state.sessions.get_or_create(project_id).history)
    candidates = await stage_service.run_stage(project_id, stage, context=context)
    app_state.pending_candidates[project_id] = (stage, candidates)

    await _send_transitions(websocket, project_id, history_before)
    orchestrator = app_state.sessions.get_or_create(project_id)
    await _send(websocket, project_id, "STEERING_PANEL_READY", build_steering_panel(orchestrator, stage, candidates))


async def _handle_user_input(websocket: WebSocket, project_id: str, payload: dict) -> None:
    onboarding_service = get_onboarding_service()
    history_before = len(app_state.sessions.get_or_create(project_id).history)

    result = await onboarding_service.submit_input(
        project_id, raw_text=payload.get("text", ""), source=payload.get("source", "text")
    )
    await _send_transitions(websocket, project_id, history_before)
    await _send(websocket, project_id, "RICHNESS_MODE_DETECTED", result.richness)
    if result.prd_analysis is not None:
        await _send(websocket, project_id, "PRD_ANALYSIS_READY", result.prd_analysis)
    await _send(websocket, project_id, "COMPLIANCE_DETECTED", result.compliance)

    orchestrator = app_state.sessions.get_or_create(project_id)
    if orchestrator.current_state == "STAGE_RUNNING":
        await _run_and_advance_stage(websocket, project_id, _FIRST_GENERATIVE_STAGE)


async def _handle_steering_action(websocket: WebSocket, project_id: str, payload: dict) -> None:
    action_type = payload.get("action_type")
    stage_id = payload.get("stage_id")

    if action_type != "accept":
        await _send(websocket, project_id, "ERROR", {
            "error_code": "SYS-E01", "message": f"steering action_type {action_type!r} is not implemented",
            "recoverable": False, "action_options": [], "context": None,
        })
        return

    cached = app_state.pending_candidates.get(project_id)
    if cached is None or cached[0] != stage_id:
        await _send(websocket, project_id, "ERROR", {
            "error_code": "VAL-E01", "message": f"no generated panel for stage {stage_id}",
            "recoverable": True, "action_options": [], "context": None,
        })
        return

    steering_service = get_steering_service()
    history_before = len(app_state.sessions.get_or_create(project_id).history)
    committed = steering_service.accept_all(project_id, stage_id, cached[1])
    del app_state.pending_candidates[project_id]

    await _send_transitions(websocket, project_id, history_before)
    for node in committed:
        await _send(websocket, project_id, "NODE_COMMITTED", {
            **node.model_dump(mode="json"),
            "decision_id": node.provenance.decision_entry_id,
            "committed_at": node.updated_at.isoformat(),
        })

    if stage_id < _LAST_GENERATIVE_STAGE:
        await _run_and_advance_stage(websocket, project_id, stage_id + 1)


async def _handle_chat_message(websocket: WebSocket, project_id: str, payload: dict) -> None:
    chat_service = get_chat_service()
    reply = await chat_service.send_message(
        project_id, payload.get("text", ""), message_type=payload.get("message_type", "user_intent"),
        context_node_id=payload.get("context_node_id"),
    )
    await _send(websocket, project_id, "CHAT_RESPONSE", reply)


async def _handle_context_question(websocket: WebSocket, project_id: str, payload: dict) -> None:
    chat_service = get_chat_service()
    answer = await chat_service.ask_context_question(
        project_id, payload.get("question", ""), payload.get("context_node_id")
    )
    await _send(websocket, project_id, "CONTEXT_ANSWER", answer)


async def _handle_node_manipulation(websocket: WebSocket, project_id: str, payload: dict) -> None:
    node_service = get_node_service()
    action, node_id = payload.get("action"), payload.get("node_id")

    try:
        if action == "delete" and node_id:
            node_service.deactivate(project_id, node_id)
            await _send(websocket, project_id, "NODE_DELETED", {"node_id": node_id})
            return
        if action == "restore" and node_id:
            node = node_service.restore(project_id, node_id)
            await _send(websocket, project_id, "NODE_UPDATED", {
                "node_id": node_id, "change_type": "restore", "new_data": {"is_active": node.is_active},
            })
            return
    except NodeNotFoundError as exc:
        await _send(websocket, project_id, "ERROR", {
            "error_code": "VAL-E01", "message": str(exc), "recoverable": True,
            "action_options": [], "context": None,
        })
        return

    await _send(websocket, project_id, "ERROR", {
        "error_code": "SYS-E01", "message": f"node action {action!r} is not implemented",
        "recoverable": False, "action_options": [], "context": None,
    })


_HANDLERS = {
    "USER_INPUT": _handle_user_input,
    "STEERING_ACTION": _handle_steering_action,
    "CHAT_MESSAGE": _handle_chat_message,
    "CONTEXT_QUESTION": _handle_context_question,
    "NODE_MANIPULATION": _handle_node_manipulation,
}


@router.websocket("/ws/{project_id}")
@router.websocket("/api/v1/steering/session/{project_id}")
async def steering_session(websocket: WebSocket, project_id: str) -> None:
    await websocket.accept()
    connection_registry.register(project_id, websocket)

    try:
        init_frame = await _receive(websocket, project_id)
        token = init_frame.get("payload", {}).get("token", "")
        try:
            user = decode_token(token)
        except TokenInvalidError:
            await _send(websocket, project_id, "AUTH_SESSION_EXPIRED", {"reason": "token_expired"})
            await websocket.close()
            return

        await _send(websocket, project_id, "AUTH_SESSION_OK", {"user": user})
        await _send_session_state(websocket, project_id)

        try:
            while True:
                frame = await _receive(websocket, project_id)
                event, payload = frame.get("event"), frame.get("payload", {})
                handler = _HANDLERS.get(event)
                if handler is None:
                    await _send(websocket, project_id, "ERROR", {
                        "error_code": "SYS-E01", "message": f"unhandled event {event!r}",
                        "recoverable": False, "action_options": [], "context": None,
                    })
                    continue
                try:
                    await handler(websocket, project_id, payload)
                except LLMCallFailed as exc:
                    await _send(websocket, project_id, "LLM_FAILURE", exc.failure)
        except WebSocketDisconnect:
            return
    finally:
        connection_registry.unregister(project_id, websocket)
