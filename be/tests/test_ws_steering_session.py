"""WS integration test for interfaces/ws/steering_session.py - the real,
event-driven flow (no scripted sleeps). Every agent the flow touches is
forced onto `TestModel` so no real LLM calls happen.
"""

from contextlib import ExitStack

import pytest
from fastapi.testclient import TestClient
from pydantic_ai.models.test import TestModel

from bluebox.interfaces.api.app import create_app
from bluebox.modules.chat.llm import agents as chat_agents
from bluebox.modules.core_pipeline.llm import agents as stage_agents
from bluebox.modules.input_processing.llm import agents as input_agents

_ALL_AGENTS = [
    input_agents.richness_classification_agent,
    input_agents.prd_analysis_agent,
    input_agents.compliance_detection_agent,
    stage_agents.actor_generation_agent,
    stage_agents.capability_generation_agent,
    chat_agents.chat_intent_parse_agent,
    chat_agents.chat_response_agent,
    chat_agents.context_question_agent,
]


@pytest.fixture
def client():
    with ExitStack() as stack:
        for agent in _ALL_AGENTS:
            stack.enter_context(agent.override(model=TestModel()))
        yield TestClient(create_app())


def _login(client: TestClient) -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "dev@bluebox.local", "password": "dev-password", "persona": "architect"},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def _create_project(client: TestClient, token: str) -> str:
    response = client.post(
        "/api/v1/projects", json={"project_name": "Dental SaaS", "description": "Booking app"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    return response.json()["project_id"]


def _recv(ws) -> dict:
    """Reads the next frame, transparently skipping `LOG_EVENT` pushes - the
    log viewer broadcasts onto this same per-project connection (see
    `connection_registry.py`), so any protocol-level assertion has to ignore
    them exactly like the real frontend's event-routed `socketClient` does."""

    while True:
        frame = ws.receive_json()
        if frame["event"] != "LOG_EVENT":
            return frame


def _drain_until(ws, event_name: str, *, max_frames: int = 20) -> dict:
    """Reads frames until one with `event == event_name` arrives, returning
    it. Asserts no `ERROR`/`LLM_FAILURE` frame is seen along the way."""

    for _ in range(max_frames):
        frame = _recv(ws)
        assert frame["event"] not in ("ERROR", "LLM_FAILURE"), frame
        if frame["event"] == event_name:
            return frame
    raise AssertionError(f"never received {event_name!r} within {max_frames} frames")


def test_auth_session_init_rejects_bad_token(client: TestClient) -> None:
    token = _login(client)
    project_id = _create_project(client, token)

    with client.websocket_connect(f"/api/v1/steering/session/{project_id}") as ws:
        ws.send_json({"event": "AUTH_SESSION_INIT", "payload": {"session_id": project_id, "token": "garbage"}})
        frame = _recv(ws)
        assert frame["event"] == "AUTH_SESSION_EXPIRED"


def test_auth_session_init_ok_then_session_state(client: TestClient) -> None:
    token = _login(client)
    project_id = _create_project(client, token)

    with client.websocket_connect(f"/api/v1/steering/session/{project_id}") as ws:
        ws.send_json({"event": "AUTH_SESSION_INIT", "payload": {"session_id": project_id, "token": token}})
        ok = _recv(ws)
        assert ok["event"] == "AUTH_SESSION_OK"
        assert ok["payload"]["user"]["email"] == "dev@bluebox.local"

        state = _recv(ws)
        assert state["event"] == "PIPELINE_STATE_CHANGED"
        assert state["payload"]["current_state"] == "INITIALIZED"


def test_user_input_drives_onboarding_and_first_steering_panel(client: TestClient) -> None:
    token = _login(client)
    project_id = _create_project(client, token)

    with client.websocket_connect(f"/api/v1/steering/session/{project_id}") as ws:
        ws.send_json({"event": "AUTH_SESSION_INIT", "payload": {"session_id": project_id, "token": token}})
        _recv(ws)  # AUTH_SESSION_OK
        _recv(ws)  # PIPELINE_STATE_CHANGED

        ws.send_json({
            "event": "USER_INPUT",
            "payload": {"source": "text", "text": "A dental SaaS with patients and dentists."},
        })

        richness = _drain_until(ws, "RICHNESS_MODE_DETECTED")
        if richness["payload"]["mode"] != "WELL_FORMED":
            pytest.skip("TestModel produced a non-WELL_FORMED classification this run")

        _drain_until(ws, "COMPLIANCE_DETECTED")
        panel = _drain_until(ws, "STEERING_PANEL_READY")
        assert panel["payload"]["stage_id"] == 2
        assert panel["payload"]["total_nodes"] >= 1


def test_steering_action_accept_commits_and_advances_to_next_stage(client: TestClient) -> None:
    token = _login(client)
    project_id = _create_project(client, token)

    with client.websocket_connect(f"/api/v1/steering/session/{project_id}") as ws:
        ws.send_json({"event": "AUTH_SESSION_INIT", "payload": {"session_id": project_id, "token": token}})
        _recv(ws)
        _recv(ws)

        ws.send_json({
            "event": "USER_INPUT",
            "payload": {"source": "text", "text": "A dental SaaS with patients and dentists."},
        })
        richness = _drain_until(ws, "RICHNESS_MODE_DETECTED")
        if richness["payload"]["mode"] != "WELL_FORMED":
            pytest.skip("TestModel produced a non-WELL_FORMED classification this run")
        _drain_until(ws, "STEERING_PANEL_READY")

        ws.send_json({
            "event": "STEERING_ACTION",
            "payload": {"action_type": "accept", "stage_id": 2, "payload": {}},
        })

        committed = _drain_until(ws, "NODE_COMMITTED")
        assert committed["payload"]["node_type"] == "actor"

        next_panel = _drain_until(ws, "STEERING_PANEL_READY")
        assert next_panel["payload"]["stage_id"] == 3


def test_chat_message_and_context_question(client: TestClient) -> None:
    token = _login(client)
    project_id = _create_project(client, token)

    with client.websocket_connect(f"/api/v1/steering/session/{project_id}") as ws:
        ws.send_json({"event": "AUTH_SESSION_INIT", "payload": {"session_id": project_id, "token": token}})
        _recv(ws)
        _recv(ws)

        ws.send_json({"event": "CHAT_MESSAGE", "payload": {"text": "what's the status?"}})
        reply = _drain_until(ws, "CHAT_RESPONSE")
        assert reply["payload"]["sender"] == "system"

        ws.send_json({"event": "CONTEXT_QUESTION", "payload": {"question": "why?"}})
        answer = _drain_until(ws, "CONTEXT_ANSWER")
        assert "answer" in answer["payload"]


def test_unhandled_event_returns_error_frame(client: TestClient) -> None:
    token = _login(client)
    project_id = _create_project(client, token)

    with client.websocket_connect(f"/api/v1/steering/session/{project_id}") as ws:
        ws.send_json({"event": "AUTH_SESSION_INIT", "payload": {"session_id": project_id, "token": token}})
        _recv(ws)
        _recv(ws)

        ws.send_json({"event": "GRAPH_NODE_SELECT", "payload": {"node_id": "x"}})
        frame = _recv(ws)
        assert frame["event"] == "ERROR"
