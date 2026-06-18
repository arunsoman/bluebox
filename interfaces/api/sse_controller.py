"""SSE Controller -- Server-Sent Events streaming endpoint.

Each pipeline session gets one SSE stream. Clients connect to receive
real-time events (stage progress, steering panels, decisions, etc.).
Steering actions are sent via REST POSTs and processed into events
that are pushed through the SSE stream.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse

from infrastructure.messaging.sse_manager import sse_manager

router = APIRouter()


@router.get("/pipeline/{session_id}/events")
async def stream_events(session_id: str) -> StreamingResponse:
    """SSE event stream for a pipeline session.

    Connects to the SSE manager and streams events in real-time.
    The connection is kept alive with periodic ping messages.
    Client disconnects when they close the connection.

    Args:
        session_id: The pipeline session ID to stream events for.

    Returns:
        StreamingResponse with ``text/event-stream`` media type.
    """
    if not session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="session_id is required",
        )

    async def event_stream():
        """Async generator that yields SSE-formatted events."""
        async for event in sse_manager.connect(session_id):
            yield event

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )
