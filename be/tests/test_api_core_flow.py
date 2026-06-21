"""End-to-end FastAPI TestClient flow - doc/api_event_contract.md, the REST
surface built in this pass. Uses `agent.override(model=TestModel())` on
every agent the flow touches (pass 2 pattern) so no real LLM calls happen.

Each test creates its own project via the API (random `proj-{uuid}` id) -
`app_state` is a process-wide singleton shared across the whole test
session, so tests must not share project ids.
"""

from contextlib import ExitStack

import pytest
from fastapi.testclient import TestClient
from pydantic_ai.models.test import TestModel

from bluebox.interfaces.api.app import create_app
from bluebox.modules.advisory.rbac.llm import agents as rbac_agents
from bluebox.modules.advisory.scaling.llm import agents as scaling_agents
from bluebox.modules.advisory.tech_stack.llm import agents as tech_stack_agents
from bluebox.modules.chat.llm import agents as chat_agents
from bluebox.modules.code_generation.llm import agents as codegen_agents
from bluebox.modules.core_pipeline.llm import agents as stage_agents
from bluebox.modules.governance.llm import agents as governance_agents
from bluebox.modules.input_processing.llm import agents as input_agents
from bluebox.shared_kernel.infrastructure.in_memory import app_state

_ALL_AGENTS = [
    input_agents.richness_classification_agent,
    input_agents.prd_analysis_agent,
    input_agents.compliance_detection_agent,
    input_agents.seed_synthesis_agent,
    stage_agents.actor_generation_agent,
    stage_agents.capability_generation_agent,
    governance_agents.node_enrichment_agent,
    scaling_agents.hosting_options_agent,
    tech_stack_agents.tech_stack_options_agent,
    rbac_agents.rbac_model_generation_agent,
    chat_agents.chat_intent_parse_agent,
    chat_agents.chat_response_agent,
    chat_agents.context_question_agent,
    codegen_agents.code_file_generation_agent,
]


@pytest.fixture
def client():
    with ExitStack() as stack:
        for agent in _ALL_AGENTS:
            stack.enter_context(agent.override(model=TestModel()))
        yield TestClient(create_app())


def _auth_headers(client: TestClient) -> dict:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "dev@bluebox.local", "password": "dev-password", "persona": "architect"},
    )
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _create_project(client: TestClient, headers: dict) -> str:
    response = client.post(
        "/api/v1/projects", json={"project_name": "Dental SaaS", "description": "Booking app"}, headers=headers
    )
    assert response.status_code == 200, response.text
    return response.json()["project_id"]


def test_login_rejects_wrong_password(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/login", json={"email": "dev@bluebox.local", "password": "wrong", "persona": "architect"}
    )
    assert response.status_code == 401


def test_login_then_me(client: TestClient) -> None:
    headers = _auth_headers(client)
    response = client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200
    assert response.json()["email"] == "dev@bluebox.local"


def test_protected_route_requires_auth(client: TestClient) -> None:
    response = client.get("/api/v1/projects")
    assert response.status_code == 401


def test_create_and_get_project(client: TestClient) -> None:
    headers = _auth_headers(client)
    project_id = _create_project(client, headers)

    response = client.get(f"/api/v1/projects/{project_id}", headers=headers)
    assert response.status_code == 200
    assert response.json()["project_name"] == "Dental SaaS"


def test_full_steering_flow_commits_actor_nodes(client: TestClient) -> None:
    headers = _auth_headers(client)
    project_id = _create_project(client, headers)

    onboarding = client.post(
        f"/api/v1/projects/{project_id}/input",
        json={"source": "text", "text": "A dental SaaS with patients and dentists."},
        headers=headers,
    )
    assert onboarding.status_code == 200, onboarding.text

    resume = client.post(f"/api/v1/projects/{project_id}/resume", headers=headers)
    state = resume.json()["current_state"]
    if state == "AWAITING_INPUT_SEED":
        pytest.skip("TestModel produced a non-WELL_FORMED classification this run")

    # `/input` already auto-advanced into Stage 2 (Actor Discovery) and cached
    # its panel - that's the real flow now (see routers/onboarding.py), so
    # there's no separate `/generate` call to make first.
    panel_get = client.get(f"/api/v1/projects/{project_id}/steering/2", headers=headers)
    assert panel_get.status_code == 200
    panel = panel_get.json()
    assert panel["stage_id"] == 2
    assert panel["total_nodes"] >= 1

    result = client.post(
        f"/api/v1/projects/{project_id}/steering",
        json={"action_type": "accept", "stage_id": 2, "payload": {}},
        headers=headers,
    )
    assert result.status_code == 200, result.text
    assert result.json()["success"] is True

    # Generation result was consumed - re-fetching the panel now 404s.
    panel_after = client.get(f"/api/v1/projects/{project_id}/steering/2", headers=headers)
    assert panel_after.status_code == 404


def test_accepting_last_generative_stage_reaches_final_gate(client: TestClient) -> None:
    """Regression for the pipeline getting stuck on STAGE_RUNNING forever
    after Stage 6 (Task Decomposition) is accepted - SteeringService.accept_all
    always lands on STAGE_RUNNING, but there's no Stage 7 `run_stage` call to
    pick it back up (Stage 7, the completeness gate, is rule-based, not
    generative). Accepting the last generative stage must push the
    orchestrator on into STAGE_COMPLETED -> FINAL_GATE instead."""

    headers = _auth_headers(client)
    project_id = _create_project(client, headers)

    onboarding = client.post(
        f"/api/v1/projects/{project_id}/input",
        json={"source": "text", "text": "A dental SaaS with patients and dentists."},
        headers=headers,
    )
    assert onboarding.status_code == 200, onboarding.text
    resume = client.post(f"/api/v1/projects/{project_id}/resume", headers=headers)
    if resume.json()["current_state"] == "AWAITING_INPUT_SEED":
        pytest.skip("TestModel produced a non-WELL_FORMED classification this run")

    for stage_id in range(2, 7):
        panel = client.get(f"/api/v1/projects/{project_id}/steering/{stage_id}", headers=headers)
        assert panel.status_code == 200, panel.text
        result = client.post(
            f"/api/v1/projects/{project_id}/steering",
            json={"action_type": "accept", "stage_id": stage_id, "payload": {}},
            headers=headers,
        )
        assert result.status_code == 200, result.text

    final_resume = client.post(f"/api/v1/projects/{project_id}/resume", headers=headers)
    assert final_resume.json()["current_state"] == "FINAL_GATE"


def test_node_enrich_and_deactivate(client: TestClient) -> None:
    headers = _auth_headers(client)
    project_id = _create_project(client, headers)

    onboarding = client.post(
        f"/api/v1/projects/{project_id}/input",
        json={"source": "text", "text": "A dental SaaS with patients and dentists."},
        headers=headers,
    )
    assert onboarding.status_code == 200
    resume = client.post(f"/api/v1/projects/{project_id}/resume", headers=headers)
    if resume.json()["current_state"] == "AWAITING_INPUT_SEED":
        pytest.skip("TestModel produced a non-WELL_FORMED classification this run")

    # `/input` already auto-advanced into Stage 2 and cached its panel.
    result = client.post(
        f"/api/v1/projects/{project_id}/steering",
        json={"action_type": "accept", "stage_id": 2, "payload": {}},
        headers=headers,
    )
    assert result.status_code == 200

    # No list-by-project nodes endpoint exists - pull the committed node id
    # from the ledger entry's payload instead.
    ledger = client.get(f"/api/v1/projects/{project_id}/ledger", headers=headers)
    assert ledger.status_code == 200
    entries = ledger.json()["entries"]
    assert len(entries) >= 1
    node_id = entries[0]["payload"]["node_id"]

    get_node = client.get(f"/api/v1/projects/{project_id}/nodes/{node_id}", headers=headers)
    assert get_node.status_code == 200

    delete_node = client.request(
        "DELETE", f"/api/v1/projects/{project_id}/nodes/{node_id}",
        json={"permanent": False, "delete_downstream": False, "rationale": "test"}, headers=headers,
    )
    assert delete_node.status_code == 200
    assert delete_node.json()["deleted"] is True

    restore_node = client.post(f"/api/v1/projects/{project_id}/nodes/{node_id}/restore", headers=headers)
    assert restore_node.status_code == 200
    assert restore_node.json()["is_active"] is True


def _force_awaiting_input_seed(project_id: str) -> None:
    """Deterministically reaches the state `submit_seed_dialogue` requires,
    rather than relying on TestModel's richness classification (normally
    WELL_FORMED - see other tests' `pytest.skip` for the rare opposite)."""

    orchestrator = app_state.sessions.get_or_create(project_id)
    orchestrator.transition("CLASSIFYING", reason="test setup")
    orchestrator.transition("AWAITING_INPUT_SEED", reason="test setup")
    app_state.sessions.save(project_id, orchestrator)


def test_minimalist_dialogue_get_and_submit(client: TestClient) -> None:
    headers = _auth_headers(client)
    project_id = _create_project(client, headers)

    dialogue = client.get(f"/api/v1/projects/{project_id}/dialogue/minimalist", headers=headers)
    assert dialogue.status_code == 200, dialogue.text
    body = dialogue.json()
    assert len(body["questions"]) == 5
    assert body["questions"][0]["question_id"] == "problem_statement"

    _force_awaiting_input_seed(project_id)
    submitted = client.post(
        f"/api/v1/projects/{project_id}/dialogue/minimalist",
        json={
            "dialogue_id": body["dialogue_id"],
            "answers": [
                {"question_id": "problem_statement", "answer": "Booking for dental clinics"},
                {"question_id": "target_users", "answer": "Dentists, Patients"},
                {"question_id": "core_functionality", "answer": "", "skipped": True},
            ],
        },
        headers=headers,
    )
    assert submitted.status_code == 200, submitted.text
    result = submitted.json()
    assert result["status"] == "complete"
    assert result["seed"]["target_users"]  # TestModel-backed synthesize_seed still returns a schema-valid seed


def test_seed_builder_dialogue_get_next_and_submit(client: TestClient) -> None:
    headers = _auth_headers(client)
    project_id = _create_project(client, headers)

    dialogue = client.get(f"/api/v1/projects/{project_id}/dialogue/seed", headers=headers)
    assert dialogue.status_code == 200, dialogue.text
    body = dialogue.json()
    assert len(body["steps"]) == 3
    dialogue_id = body["dialogue_id"]

    step1 = client.post(
        f"/api/v1/projects/{project_id}/dialogue/seed",
        json={
            "dialogue_id": dialogue_id,
            "step_id": "problem",
            "field_values": {"problem_statement": "Booking for dental clinics", "target_users": "Dentists, Patients"},
            "navigation": "next",
        },
        headers=headers,
    )
    assert step1.status_code == 200, step1.text
    assert step1.json()["status"] == "incomplete"
    assert step1.json()["seed"]["target_users"] == ["Dentists", "Patients"]

    _force_awaiting_input_seed(project_id)
    final = client.post(
        f"/api/v1/projects/{project_id}/dialogue/seed",
        json={
            "dialogue_id": dialogue_id,
            "step_id": "success",
            "field_values": {
                "problem_statement": "Booking for dental clinics",
                "target_users": "Dentists, Patients",
                "success_metrics": "Bookings per week",
            },
            "navigation": "submit",
        },
        headers=headers,
    )
    assert final.status_code == 200, final.text
    assert final.json()["status"] == "complete"


def test_checkpoint_create_get_restore(client: TestClient) -> None:
    headers = _auth_headers(client)
    project_id = _create_project(client, headers)

    created = client.post(
        f"/api/v1/projects/{project_id}/checkpoints", json={"label": "before stage 2", "stage": 1}, headers=headers
    )
    assert created.status_code == 200, created.text
    checkpoint_id = created.json()["checkpoint_id"]

    fetched = client.get(f"/api/v1/projects/{project_id}/checkpoints/{checkpoint_id}", headers=headers)
    assert fetched.status_code == 200

    restored = client.post(f"/api/v1/projects/{project_id}/checkpoints/restore?checkpoint_id={checkpoint_id}", headers=headers)
    assert restored.status_code == 200
    assert restored.json()["restored"] is True


def test_chat_send_and_history(client: TestClient) -> None:
    headers = _auth_headers(client)
    project_id = _create_project(client, headers)

    sent = client.post(
        f"/api/v1/projects/{project_id}/chat", json={"content": "what's the status?"}, headers=headers
    )
    assert sent.status_code == 200, sent.text

    history = client.get(f"/api/v1/projects/{project_id}/chat", headers=headers)
    assert history.status_code == 200
    assert len(history.json()["messages"]) == 2


def test_scale_submit_validates_inputs(client: TestClient) -> None:
    headers = _auth_headers(client)
    project_id = _create_project(client, headers)

    valid = client.post(
        f"/api/v1/projects/{project_id}/scale",
        json={"expected_total_users": 1000, "peak_concurrent_users": 100, "launch_timeline": "1-3 months"},
        headers=headers,
    )
    assert valid.status_code == 200, valid.text
    assert valid.json()["valid"] is True
    assert valid.json()["conflicts"] == []

    conflicting = client.post(
        f"/api/v1/projects/{project_id}/scale",
        json={"expected_total_users": 100, "peak_concurrent_users": 500, "launch_timeline": "6+ months"},
        headers=headers,
    )
    assert conflicting.status_code == 200, conflicting.text
    assert conflicting.json()["valid"] is False
    assert conflicting.json()["conflicts"][0]["conflict_type"] == "concurrent_exceeds_total"


def test_scaling_generate_and_select(client: TestClient) -> None:
    headers = _auth_headers(client)
    project_id = _create_project(client, headers)

    generated = client.post(
        f"/api/v1/projects/{project_id}/scale/options?scale_persona=SMALL",
        json={
            "expected_total_users": 1000, "peak_concurrent_users": 100, "launch_timeline": "1-3 months",
        },
        headers=headers,
    )
    assert generated.status_code == 200, generated.text
    option_id = generated.json()["options"][0]["option_id"]

    selected = client.post(
        f"/api/v1/projects/{project_id}/infrastructure/select",
        json={"option_id": option_id, "override_budget_warning": True},
        headers=headers,
    )
    assert selected.status_code == 200, selected.text
    assert selected.json()["committed_by"] == "user-1"

    fetched = client.get(f"/api/v1/projects/{project_id}/infrastructure", headers=headers)
    assert fetched.status_code == 200


def test_rbac_generate_validate_commit(client: TestClient) -> None:
    headers = _auth_headers(client)
    project_id = _create_project(client, headers)

    generated = client.post(f"/api/v1/projects/{project_id}/rbac/generate", headers=headers)
    assert generated.status_code == 200, generated.text

    validated = client.post(f"/api/v1/projects/{project_id}/rbac/validate", headers=headers)
    assert validated.status_code == 200

    committed = client.post(
        f"/api/v1/projects/{project_id}/rbac/commit", json={"rationale": "initial"}, headers=headers
    )
    assert committed.status_code == 200, committed.text

    fetched = client.get(f"/api/v1/projects/{project_id}/rbac", headers=headers)
    assert fetched.status_code == 200


def test_runtime_status_when_never_started(client: TestClient) -> None:
    headers = _auth_headers(client)
    project_id = _create_project(client, headers)

    status_resp = client.get(f"/api/v1/projects/{project_id}/runtime/status", headers=headers)
    assert status_resp.status_code == 200
    assert status_resp.json()["status"] == "stopped"

    stop_resp = client.post(f"/api/v1/projects/{project_id}/runtime/stop", headers=headers)
    assert stop_resp.status_code == 409
