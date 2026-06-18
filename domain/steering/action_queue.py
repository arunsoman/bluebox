"""In-memory steering action queue.

Each pipeline session receives its own asyncio queue.  Steering actions
arrive via REST endpoints and are consumed by the active stage runner.
"""
from __future__ import annotations

import asyncio
from typing import Any

# session_id -> Queue
_queues: dict[str, asyncio.Queue[dict[str, Any]]] = {}


def get_steering_queue(session_id: str) -> asyncio.Queue[dict[str, Any]]:
    """Return (or create) the steering queue for *session_id*."""
    if session_id not in _queues:
        _queues[session_id] = asyncio.Queue(maxsize=1)
    return _queues[session_id]


def put_steering_action(session_id: str, payload: dict[str, Any]) -> None:
    """Called by the REST handler when a steering action is submitted."""
    queue = get_steering_queue(session_id)
    # If a previous action is still pending, discard it.
    while not queue.empty():
        try:
            queue.get_nowait()
        except asyncio.QueueEmpty:
            break
    queue.put_nowait(payload)


def cleanup_steering_queue(session_id: str) -> None:
    """Remove the queue when a session ends."""
    _queues.pop(session_id, None)
