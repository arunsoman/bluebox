"""Tests for interfaces/ws/connection_registry.py - tracks which WebSocket(s)
are open per project_id, used solely so `log_bus.publish` can push a live
`LOG_EVENT` frame without coupling to the normal steering event flow.
"""

from bluebox.interfaces.ws.connection_registry import WSConnectionRegistry
from bluebox.shared_kernel.observability.log_event import LogEvent


class _FakeWebSocket:
    def __init__(self, *, fail: bool = False) -> None:
        self.fail = fail
        self.sent: list[dict] = []

    async def send_json(self, data: dict) -> None:
        if self.fail:
            raise RuntimeError("socket is closing")
        self.sent.append(data)


def _event(project_id: str) -> LogEvent:
    return LogEvent(project_id=project_id, category="http_received_by_backend", summary="x")


async def test_push_log_event_reaches_registered_socket() -> None:
    registry = WSConnectionRegistry()
    ws = _FakeWebSocket()
    registry.register("proj-1", ws)

    await registry.push_log_event(_event("proj-1"))

    assert len(ws.sent) == 1
    assert ws.sent[0]["event"] == "LOG_EVENT"


async def test_push_log_event_does_not_reach_other_projects() -> None:
    registry = WSConnectionRegistry()
    ws = _FakeWebSocket()
    registry.register("proj-a", ws)

    await registry.push_log_event(_event("proj-b"))

    assert ws.sent == []


async def test_unregister_stops_delivery() -> None:
    registry = WSConnectionRegistry()
    ws = _FakeWebSocket()
    registry.register("proj-1", ws)
    registry.unregister("proj-1", ws)

    await registry.push_log_event(_event("proj-1"))

    assert ws.sent == []


async def test_push_log_event_to_unknown_project_is_a_silent_noop() -> None:
    registry = WSConnectionRegistry()

    await registry.push_log_event(_event("never-registered"))  # must not raise


async def test_push_log_event_swallows_a_failing_socket_without_raising() -> None:
    registry = WSConnectionRegistry()
    failing = _FakeWebSocket(fail=True)
    healthy = _FakeWebSocket()
    registry.register("proj-1", failing)
    registry.register("proj-1", healthy)

    await registry.push_log_event(_event("proj-1"))  # must not raise

    assert len(healthy.sent) == 1


def test_unregister_unknown_websocket_is_a_noop() -> None:
    registry = WSConnectionRegistry()
    registry.unregister("never-registered", _FakeWebSocket())
