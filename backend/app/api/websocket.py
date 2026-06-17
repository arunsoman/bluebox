"""WebSocket handler for steering interactions."""

from __future__ import annotations

import json
import logging

from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)


async def websocket_steering(websocket: WebSocket, session_id: str):
    """Handle WebSocket connection for a steering session."""
    await websocket.accept()

    # Emit current state
    await websocket.send_json({
        "event": "STEERING_PANEL_READY",
        "data": {"stage_id": -1, "status": "initialized"}
    })

    try:
        while True:
            message = await websocket.receive_json()
            event_type = message.get("event")

            if event_type == "STEERING_ACTION":
                await websocket.send_json({
                    "event": "STATE_TRANSITION",
                    "data": {"from": "awaiting_steering", "to": "stage_running"}
                })
            elif event_type == "NODE_MANIPULATION":
                await websocket.send_json({
                    "event": "NODE_UPDATED",
                    "data": message.get("data", {})
                })
            elif event_type == "PROPAGATION_CONSENT":
                await websocket.send_json({
                    "event": "PROPAGATION_CONSENT",
                    "data": {"received": True}
                })
            elif event_type == "INTERRUPT_SIGNAL":
                await websocket.send_json({
                    "event": "STREAM_INTERRUPTED",
                    "data": {}
                })
            elif event_type == "CHAT_MESSAGE":
                await websocket.send_json({
                    "event": "CHAT_RESPONSE",
                    "data": {"message": "Echo: " + str(message.get("data", ""))}
                })
            else:
                await websocket.send_json({
                    "event": "ERROR",
                    "data": {"message": f"Unknown event type: {event_type}"}
                })
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected for session %s", session_id)
    except Exception as e:
        logger.error("WebSocket error for session %s: %s", session_id, e)
