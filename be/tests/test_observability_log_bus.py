"""Tests for shared_kernel/observability/log_bus.py - the log viewer's
per-project ring buffer + live broadcaster.
"""

from bluebox.shared_kernel.observability.log_bus import LogEventBus
from bluebox.shared_kernel.observability.log_event import LogEvent


def _event(project_id: str = "proj-1", summary: str = "x") -> LogEvent:
    return LogEvent(project_id=project_id, category="http_received_by_backend", summary=summary)


async def test_publish_then_list_returns_in_order() -> None:
    bus = LogEventBus()
    await bus.publish(_event(summary="first"))
    await bus.publish(_event(summary="second"))

    summaries = [e.summary for e in bus.list("proj-1")]
    assert summaries == ["first", "second"]


async def test_list_is_scoped_per_project() -> None:
    bus = LogEventBus()
    await bus.publish(_event(project_id="proj-a"))
    await bus.publish(_event(project_id="proj-b"))

    assert len(bus.list("proj-a")) == 1
    assert len(bus.list("proj-b")) == 1
    assert bus.list("proj-unknown") == []


async def test_ring_buffer_evicts_oldest_past_max_per_project() -> None:
    bus = LogEventBus(max_per_project=2)
    await bus.publish(_event(summary="a"))
    await bus.publish(_event(summary="b"))
    await bus.publish(_event(summary="c"))

    summaries = [e.summary for e in bus.list("proj-1")]
    assert summaries == ["b", "c"]


async def test_publish_forwards_to_broadcaster() -> None:
    bus = LogEventBus()
    received: list[LogEvent] = []

    async def broadcaster(event: LogEvent) -> None:
        received.append(event)

    bus.set_broadcaster(broadcaster)
    await bus.publish(_event(summary="live"))

    assert [e.summary for e in received] == ["live"]


async def test_broadcaster_exception_does_not_break_publish() -> None:
    bus = LogEventBus()

    async def failing_broadcaster(event: LogEvent) -> None:
        raise RuntimeError("socket is closing")

    bus.set_broadcaster(failing_broadcaster)
    await bus.publish(_event(summary="still-stored"))

    assert [e.summary for e in bus.list("proj-1")] == ["still-stored"]
