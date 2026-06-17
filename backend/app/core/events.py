"""Event bus abstraction (Redis/local fallback)."""

from __future__ import annotations

import asyncio
from typing import Any, Callable


class EventBus:
    """Async event bus with in-memory fallback."""

    def __init__(self) -> None:
        self._handlers: dict[str, list[Callable]] = {}
        self._local_buffer: list[dict] = []

    def on(self, event_type: str, handler: Callable) -> None:
        self._handlers.setdefault(event_type, []).append(handler)

    async def emit(self, event_type: str, payload: dict) -> None:
        event = {"event_type": event_type, "payload": payload}
        self._local_buffer.append(event)
        for handler in self._handlers.get(event_type, []):
            await handler(payload)


class LocalEventBus(EventBus):
    """Alias for the default in-memory event bus."""
