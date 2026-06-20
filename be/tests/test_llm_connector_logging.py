"""Tests for the log-viewer side of shared_kernel/llm/connector.py:
`run_structured` publishing one `llm_call` LogEvent per call, tagged with
whatever REST request (if any) triggered it, on both the success and
failure paths. Uses `Agent.override(model=TestModel())` (no network, no API
key) for the success path, and a fake agent for the failure paths, since
pydantic-ai's own `TestModel` doesn't make it easy to force its three
distinct failure exceptions deterministically - that mapping is this
module's own logic, not pydantic-ai's, so a fake `.run()` is the right
level to test it at.
"""

import pytest
from pydantic_ai.exceptions import ModelHTTPError, UnexpectedModelBehavior, UsageLimitExceeded
from pydantic_ai.models.test import TestModel

from bluebox.shared_kernel.llm.base import LLMResponse
from bluebox.shared_kernel.llm.connector import LLMCallFailed, _build_live_model, build_agent, run_structured
from bluebox.shared_kernel.observability.context import current_project_id, current_trace_id
from bluebox.shared_kernel.observability.log_bus import log_bus


class _DummyResponse(LLMResponse):
    text: str = ""


class _FakeAgent:
    """Stands in for a pydantic-ai `Agent` whose `.run()` raises a specific
    provider-side exception - see module docstring for why this is the
    right level to unit-test `run_structured`'s failure-mapping/logging at."""

    def __init__(self, exc: Exception) -> None:
        self._exc = exc

    async def run(self, _prompt: str, *, model=None):  # noqa: ANN001 - test double
        raise self._exc


@pytest.fixture(autouse=True)
def _clean_context():
    token_p = current_project_id.set(None)
    token_t = current_trace_id.set(None)
    yield
    current_project_id.reset(token_p)
    current_trace_id.reset(token_t)


async def test_run_structured_success_publishes_ok_llm_call_event() -> None:
    current_project_id.set("proj-success")
    current_trace_id.set("trace-1")
    agent = build_agent(_DummyResponse, "say hi")

    with agent.override(model=TestModel()):
        await run_structured(agent, "hello", stage=3)

    entries = log_bus.list("proj-success")
    assert len(entries) == 1
    entry = entries[0]
    assert entry.category == "llm_call"
    assert entry.trace_id == "trace-1"
    assert entry.duration_ms is not None and entry.duration_ms >= 0
    assert entry.detail["stage"] == 3
    assert entry.detail["failure"] is None
    assert entry.detail["output"] is not None


async def test_run_structured_with_no_project_context_logs_to_global() -> None:
    agent = build_agent(_DummyResponse, "say hi")

    with agent.override(model=TestModel()):
        await run_structured(agent, "hello")

    from bluebox.shared_kernel.observability.log_event import GLOBAL_PROJECT_ID

    entries = log_bus.list(GLOBAL_PROJECT_ID)
    assert any(e.category == "llm_call" for e in entries)


@pytest.mark.parametrize(
    ("exc", "expected_failure_type"),
    [
        (UsageLimitExceeded("too many tokens"), "context_overflow"),
        (ModelHTTPError(status_code=429, model_name="m"), "rate_limit"),
        (ModelHTTPError(status_code=504, model_name="m"), "timeout"),
        (ModelHTTPError(status_code=500, model_name="m"), "malformed_json"),
        (UnexpectedModelBehavior("bad output"), "malformed_json"),
    ],
)
async def test_run_structured_failure_paths_publish_failure_event(exc: Exception, expected_failure_type: str) -> None:
    project_id = f"proj-failure-{expected_failure_type}-{type(exc).__name__}"
    current_project_id.set(project_id)
    fake_agent = _FakeAgent(exc)

    with pytest.raises(LLMCallFailed) as exc_info:
        await run_structured(fake_agent, "hello", stage=5)

    assert exc_info.value.failure.failure_type == expected_failure_type

    entries = log_bus.list(project_id)
    assert len(entries) == 1
    assert entries[0].detail["failure"]["failure_type"] == expected_failure_type
    assert entries[0].detail["output"] is None


def test_build_live_model_falls_back_to_lazy_string_when_provider_misconfigured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)

    model = _build_live_model("anthropic", "claude-sonnet-4-6")

    assert model == "anthropic:claude-sonnet-4-6"


def test_build_live_model_passes_through_unregistered_provider() -> None:
    model = _build_live_model("mistral", "mistral-large-latest")

    assert model == "mistral:mistral-large-latest"
