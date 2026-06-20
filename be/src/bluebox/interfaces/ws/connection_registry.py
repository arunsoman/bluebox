"""Tracks which WebSocket(s) are currently connected for a given
project_id - genuinely new infrastructure: `steering_session.py` has no
connection-tracking object today, just a `websocket` local variable scoped
to one connection's route-handler closure.

Exists solely so the log viewer's `log_bus` (`shared_kernel/observability/log_bus.py`,
a lower layer that must not import from `interfaces/`) can push a live
`LOG_EVENT` frame to whatever browser tab(s) have a project's steering
session open, without coupling to - or going through - the normal steering
event flow (`steering_session._send`). `create_app()` wires
`log_bus.set_broadcaster(connection_registry.push_log_event)` once at
startup.
"""

from fastapi import WebSocket
from fastapi.encoders import jsonable_encoder

from bluebox.shared_kernel.observability.log_event import LogEvent


class WSConnectionRegistry:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = {}

    def register(self, project_id: str, websocket: WebSocket) -> None:
        self._connections.setdefault(project_id, set()).add(websocket)

    def unregister(self, project_id: str, websocket: WebSocket) -> None:
        sockets = self._connections.get(project_id)
        if sockets is None:
            return
        sockets.discard(websocket)
        if not sockets:
            del self._connections[project_id]

    async def push_log_event(self, event: LogEvent) -> None:
        """Best-effort - a socket mid-close or a project with no open
        session must never raise into `log_bus.publish`."""

        for websocket in self._connections.get(event.project_id, ()):
            try:
                await websocket.send_json(
                    jsonable_encoder({"event": "LOG_EVENT", "payload": event})
                )
            except Exception:  # noqa: BLE001
                pass


connection_registry = WSConnectionRegistry()
