"""SSE (Server-Sent Events) manager for streaming pipeline events.

Replaces WebSocket from PRD. Each session gets one SSE stream.
Steering actions are sent via REST POSTs and processed into events
that are pushed through the SSE stream.
"""
from __future__ import annotations

import asyncio
import json
from typing import Any, AsyncIterator

from domain.models import StreamChunk


class SSEManager:
    """Per-session SSE stream manager with chunk-boundary interrupt support."""

    def __init__(self):
        # session_id -> (queue, connected flag)
        self._streams: dict[str, tuple[asyncio.Queue[dict], bool]] = {}
        # Pending interrupt signals
        self._interrupts: set[str] = set()

    async def connect(self, session_id: str) -> AsyncIterator[str]:
        """Connect a client to the SSE stream for a session."""
        queue: asyncio.Queue[dict] = asyncio.Queue(maxsize=1000)
        self._streams[session_id] = (queue, True)

        try:
            while True:
                try:
                    msg = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield f"event: {msg['event']}\ndata: {json.dumps(msg['data'], default=str)}\n\n"
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
        finally:
            if session_id in self._streams:
                self._streams[session_id] = (queue, False)

    def disconnect(self, session_id: str) -> None:
        """Disconnect a session's SSE stream."""
        if session_id in self._streams:
            self._streams.pop(session_id, None)

    async def emit(self, session_id: str, event: str, data: dict[str, Any]) -> None:
        """Emit an event to a session's SSE stream."""
        stream = self._streams.get(session_id)
        if stream and stream[1]:
            queue = stream[0]
            try:
                queue.put_nowait({"event": event, "data": data})
            except asyncio.QueueFull:
                pass  # Stream backpressure — drop oldest or log

    def request_interrupt(self, session_id: str) -> None:
        """Request a chunk-boundary interrupt for a session."""
        self._interrupts.add(session_id)

    def should_interrupt(self, session_id: str) -> bool:
        """Check if interrupt was requested and clear it."""
        return self._interrupts.discard(session_id) or session_id in self._interrupts

    def clear_interrupt(self, session_id: str) -> None:
        self._interrupts.discard(session_id)

    async def emit_chunk(self, session_id: str, chunk: StreamChunk) -> bool:
        """Emit a StreamChunk. Returns True if interrupted at boundary."""
        await self.emit(session_id, "STREAM_CHUNK", chunk.model_dump())
        # Check for interrupt at chunk boundary (<2s target)
        if session_id in self._interrupts:
            self._interrupts.discard(session_id)
            await self.emit(session_id, "STAGE_INTERRUPTED", {
                "stage": chunk.stage,
                "chunk_index": chunk.chunk_index,
                "reason": "user_requested"
            })
            return True
        return False

    async def emit_panel_ready(self, session_id: str, panel_data: dict[str, Any]) -> None:
        await self.emit(session_id, "STEERING_PANEL_READY", panel_data)

    async def emit_stage_started(self, session_id: str, stage: str) -> None:
        await self.emit(session_id, "STAGE_STARTED", {"stage": stage, "timestamp": datetime.utcnow().isoformat()})

    async def emit_stage_completed(self, session_id: str, stage: str, checkpoint: dict | None = None) -> None:
        await self.emit(session_id, "STAGE_COMPLETED", {
            "stage": stage,
            "checkpoint": checkpoint,
            "timestamp": datetime.utcnow().isoformat()
        })

    async def emit_stage_failed(self, session_id: str, stage: str, reason: str) -> None:
        await self.emit(session_id, "STAGE_FAILED", {"stage": stage, "reason": reason})

    async def emit_decision_logged(self, session_id: str, entry: dict[str, Any]) -> None:
        await self.emit(session_id, "DECISION_LOGGED", entry)

    async def emit_audit_event(self, session_id: str, event: dict[str, Any]) -> None:
        await self.emit(session_id, "AUDIT_EVENT_WRITTEN", event)

    async def emit_checkpoint_created(self, session_id: str, checkpoint: dict[str, Any]) -> None:
        await self.emit(session_id, "CHECKPOINT_CREATED", checkpoint)

    async def emit_impact_report(self, session_id: str, report: dict[str, Any]) -> None:
        await self.emit(session_id, "IMPACT_REPORT_READY", report)

    async def emit_richness_mode(self, session_id: str, mode: str, confidence: str, basis: list[str]) -> None:
        await self.emit(session_id, "RICHNESS_MODE_DETECTED", {
            "mode": mode, "confidence": confidence, "classification_basis": basis, "gaps": []
        })

    async def emit_prd_analysis(self, session_id: str, report: dict[str, Any]) -> None:
        await self.emit(session_id, "PRD_ANALYSIS_READY", report)

    async def emit_hosting_options(self, session_id: str, options: list[dict], scale_persona: str) -> None:
        await self.emit(session_id, "HOSTING_OPTIONS_READY", {"options": options, "scale_persona": scale_persona})

    async def emit_tech_stack_options(self, session_id: str, options: list[dict]) -> None:
        await self.emit(session_id, "TECH_STACK_OPTIONS_READY", {"options": options})

    async def emit_rbac_model(self, session_id: str, rbac: dict[str, Any]) -> None:
        await self.emit(session_id, "RBAC_MODEL_READY", rbac)

    async def emit_steering_required(self, session_id: str, stage: str, reason: str, options: list[dict] | None = None) -> None:
        await self.emit(session_id, "STEERING_REQUIRED", {"stage": stage, "reason": reason, "options": options or []})

    async def emit_llm_failure(self, session_id: str, resolution: dict[str, Any]) -> None:
        await self.emit(session_id, "LLM_FAILURE_RESOLUTION", resolution)

    async def emit_compliance_detected(self, session_id: str, frameworks: list[str], defaults: dict) -> None:
        await self.emit(session_id, "COMPLIANCE_DETECTED", {"frameworks": frameworks, "defaults": defaults})

    async def emit_budget_exhausted(self, session_id: str, budget: dict[str, Any]) -> None:
        await self.emit(session_id, "REVISION_BUDGET_EXHAUSTED", budget)

    async def emit_propagation_started(self, session_id: str, affected_stages: list[str]) -> None:
        await self.emit(session_id, "PROPAGATION_STARTED", {"affected_stages": affected_stages})

    async def emit_propagation_complete(self, session_id: str) -> None:
        await self.emit(session_id, "PROPAGATION_COMPLETE", {})

    async def emit_scale_dialogue(self, session_id: str, questions: list[dict]) -> None:
        await self.emit(session_id, "SCALE_DIALOGUE_OPENED", {"questions": questions})

    async def emit_scale_conflict(self, session_id: str, conflict: dict[str, Any]) -> None:
        await self.emit(session_id, "SCALE_INPUT_CONFLICT", conflict)

    async def emit_infrastructure_stale(self, session_id: str, profile_id: str) -> None:
        await self.emit(session_id, "INFRASTRUCTURE_PROFILE_STALE", {"profile_id": profile_id, "stale": True})

    async def emit_pipeline_complete(self, session_id: str, completion: dict[str, Any]) -> None:
        await self.emit(session_id, "PIPELINE_COMPLETE", completion)


# Global singleton
sse_manager = SSEManager()

from datetime import datetime  # noqa: E402
