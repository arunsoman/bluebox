"""NotificationService -- sends notifications via SSE, webhook, and UI updates.

This service bridges domain events to client-facing notifications.
All notifications are sent asynchronously through SSE (primary) with
optional webhook fallback.
"""
from __future__ import annotations

from typing import Any

from infrastructure.messaging.sse_manager import sse_manager
from infrastructure.persistence.redis.client import publish_event
from domain.state_management.pipeline_state import PipelineStateManager


class NotificationService:
    """Application service for sending notifications to clients."""

    def __init__(
        self,
        state_manager: PipelineStateManager | None = None,
    ):
        self._state = state_manager or PipelineStateManager()

    # ------------------------------------------------------------------ #
    # Toast Notifications
    # ------------------------------------------------------------------ #

    async def send_toast(
        self,
        session_id: str,
        title: str,
        message: str,
        type: str = "info",
    ) -> None:
        """Send a toast notification to the client.

        Args:
            session_id: Pipeline session ID.
            title: Toast title.
            message: Toast body.
            type: Toast type -- "info", "success", "warning", "error".
        """
        await sse_manager.emit(
            session_id,
            "TOAST",
            {
                "title": title,
                "message": message,
                "type": type,
                "timestamp": __import__("datetime").datetime.utcnow().isoformat(),
            },
        )

    # ------------------------------------------------------------------ #
    # Tab Title Updates
    # ------------------------------------------------------------------ #

    async def update_tab_title(self, session_id: str, title: str) -> None:
        """Update the browser tab title for a session.

        Args:
            session_id: Pipeline session ID.
            title: New tab title.
        """
        await sse_manager.emit(
            session_id,
            "TAB_TITLE_UPDATE",
            {"title": title},
        )

    # ------------------------------------------------------------------ #
    # Webhook
    # ------------------------------------------------------------------ #

    async def send_webhook(
        self,
        session_id: str,
        event_data: dict[str, Any],
    ) -> dict[str, Any]:
        """Send a webhook notification if a webhook URL is configured.

        Args:
            session_id: Pipeline session ID.
            event_data: Event payload to send.

        Returns:
            Dict with delivery status.
        """
        import json
        import httpx

        session = await self._state.get_session(session_id)

        # Get webhook URL from session state
        state = await self._state.get_state(session_id)
        webhook_url = state.get("webhook_callback_url")

        if not webhook_url:
            return {"status": "no_webhook_configured", "session_id": session_id}

        payload = {
            "session_id": session_id,
            "project_id": session.project_id,
            "timestamp": __import__("datetime").datetime.utcnow().isoformat(),
            "event": event_data,
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    webhook_url,
                    json=payload,
                    headers={"Content-Type": "application/json"},
                )
                return {
                    "status": "delivered",
                    "http_status": response.status_code,
                    "session_id": session_id,
                }
        except Exception as exc:
            return {
                "status": "failed",
                "error": str(exc),
                "session_id": session_id,
            }

    # ------------------------------------------------------------------ #
    # Batch Notifications
    # ------------------------------------------------------------------ #

    async def notify_stage_start(self, session_id: str, stage: str) -> None:
        """Send a notification that a stage has started.

        Args:
            session_id: Pipeline session ID.
            stage: The stage name.
        """
        await self.update_tab_title(session_id, f"Pipeline -- {stage}")
        await self.send_toast(
            session_id,
            title="Stage Started",
            message=f"{stage} is now running...",
            type="info",
        )

    async def notify_stage_complete(self, session_id: str, stage: str) -> None:
        """Send a notification that a stage has completed.

        Args:
            session_id: Pipeline session ID.
            stage: The stage name.
        """
        await self.update_tab_title(session_id, f"Pipeline -- {stage} (done)")
        await self.send_toast(
            session_id,
            title="Stage Complete",
            message=f"{stage} completed successfully.",
            type="success",
        )

    async def notify_steering_required(self, session_id: str, stage: str) -> None:
        """Send a notification that user steering is required.

        Args:
            session_id: Pipeline session ID.
            stage: The stage name.
        """
        await self.update_tab_title(session_id, f"Pipeline -- Action Required")
        await self.send_toast(
            session_id,
            title="Steering Required",
            message=f"Please review the output for {stage}.",
            type="warning",
        )
