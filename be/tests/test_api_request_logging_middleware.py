"""Tests for interfaces/api/app.py's `log_http_requests` middleware - every
REST call captured for the log viewer, with secrets redacted before they
ever reach `log_bus`.
"""

from fastapi.testclient import TestClient

from bluebox.interfaces.api.app import create_app
from bluebox.shared_kernel.observability.log_bus import log_bus
from bluebox.shared_kernel.observability.log_event import GLOBAL_PROJECT_ID


def _login(client: TestClient) -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "dev@bluebox.local", "password": "dev-password", "persona": "architect"},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def test_login_request_is_logged_with_secrets_redacted() -> None:
    client = TestClient(create_app())

    _login(client)

    # `_global` is a process-wide singleton bucket shared across the whole
    # test session (other tests also log in) - the most recent matching
    # entry is this test's own, regardless of what ran before it.
    entries = [e for e in log_bus.list(GLOBAL_PROJECT_ID) if e.detail.get("path") == "/api/v1/auth/login"]
    assert entries
    entry = entries[-1]

    assert entry.category == "http_received_by_backend"
    assert entry.detail["response_status"] == 200
    assert entry.duration_ms is not None and entry.duration_ms >= 0

    response_text = entry.detail["response_body"]["text"]
    assert "access_token" not in response_text or '"access_token": "[redacted]"' in response_text
    assert '"[redacted]"' in response_text  # access_token/refresh_token must not leak in plaintext


def test_authenticated_request_redacts_authorization_header() -> None:
    client = TestClient(create_app())
    token = _login(client)

    client.post(
        "/api/v1/projects",
        json={"project_name": "X", "description": "Y"},
        headers={"Authorization": f"Bearer {token}"},
    )

    entries = [e for e in log_bus.list(GLOBAL_PROJECT_ID) if e.detail.get("path") == "/api/v1/projects"]
    assert entries
    entry = entries[-1]
    headers = entry.detail["request_headers"]
    assert headers["authorization"] == "[redacted]"
    assert token not in str(entry.detail)


def test_project_scoped_request_is_logged_under_that_project_id() -> None:
    client = TestClient(create_app())
    token = _login(client)
    project_id = client.post(
        "/api/v1/projects",
        json={"project_name": "X", "description": "Y"},
        headers={"Authorization": f"Bearer {token}"},
    ).json()["project_id"]

    client.get(f"/api/v1/projects/{project_id}/audit")

    entries = log_bus.list(project_id)
    assert len(entries) == 1
    assert entries[0].detail["method"] == "GET"
    assert entries[0].detail["path"] == f"/api/v1/projects/{project_id}/audit"
    assert entries[0].detail["response_status"] == 200
