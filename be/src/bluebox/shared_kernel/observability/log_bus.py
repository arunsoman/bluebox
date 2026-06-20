"""The log viewer's event bus.

Per-project ring buffer (bounded - this backend has no database yet, same
as every other in-memory repository in `shared_kernel/infrastructure/in_memory.py`)
plus a live broadcaster hook. `LogEventBus` lives in `shared_kernel` and
must not import anything from `interfaces/` - the WS connection registry
that actually pushes events to a connected browser lives in
`interfaces/ws/connection_registry.py`, a higher layer. Wiring is inverted
instead: `create_app()` calls `log_bus.set_broadcaster(connection_registry.push_log_event)`
once at startup, so this module stays decoupled from how (or whether) a
live transport exists.

A broadcast failure must never break the request/call that triggered the
log - `publish` swallows broadcaster exceptions.
"""

from collections import deque
from collections.abc import Awaitable, Callable

from bluebox.shared_kernel.observability.log_event import LogEvent

Broadcaster = Callable[[LogEvent], Awaitable[None]]


class LogEventBus:
    def __init__(self, max_per_project: int = 1000) -> None:
        self._max_per_project = max_per_project
        self._buffers: dict[str, deque[LogEvent]] = {}
        self._broadcaster: Broadcaster | None = None

    def set_broadcaster(self, broadcaster: Broadcaster) -> None:
        self._broadcaster = broadcaster

    async def publish(self, event: LogEvent) -> None:
        buffer = self._buffers.setdefault(event.project_id, deque(maxlen=self._max_per_project))
        buffer.append(event)
        if self._broadcaster is None:
            return
        try:
            await self._broadcaster(event)
        except Exception:  # noqa: BLE001 - a dead/closing socket must not break the caller
            pass

    def list(self, project_id: str) -> list[LogEvent]:
        return list(self._buffers.get(project_id, ()))


log_bus = LogEventBus()
