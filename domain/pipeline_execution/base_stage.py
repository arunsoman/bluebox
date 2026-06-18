"""Abstract base class for all pipeline stage runners.

Provides the common skeleton used by every stage:
  STAGE_STARTED -> (stream chunks) -> STEERING_PANEL_READY -> wait for steering
  -> STAGE_COMPLETED -> CHECKPOINT_CREATED
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, TypeVar

from domain.models import (
    Checkpoint,
    StageName,
    StreamChunk,
    SteeringPanel,
)
from infrastructure.llm.llm_provider import LLMClient
from infrastructure.messaging.sse_manager import sse_manager

T = TypeVar("T")


class BaseStage(ABC):
    """Every pipeline stage inherits from ``BaseStage``.

    Sub-classes must define *stage_name*, *input_model*, *output_model*,
    and implement the async ``run`` coroutine.
    """

    stage_name: StageName
    input_model: type
    output_model: type

    # ------------------------------------------------------------------
    # Abstract interface
    # ------------------------------------------------------------------

    @abstractmethod
    async def run(
        self,
        session_id: str,
        input_data: dict[str, Any],
        llm_client: LLMClient,
    ) -> dict[str, Any]:
        """Execute the stage.

        Parameters
        ----------
        session_id:
            Unique session identifier (used for SSE routing).
        input_data:
            Raw dict matching ``self.input_model``.
        llm_client:
            The shared :class:`LLMClient` instance -- must be used for **all**
            LLM calls (no mock / stub data allowed).

        Returns
        -------
        dict
            Serialised output matching ``self.output_model``.
        """
        ...

    # ------------------------------------------------------------------
    # Common SSE helpers
    # ------------------------------------------------------------------

    async def _emit_stage_started(self, session_id: str) -> None:
        await sse_manager.emit_stage_started(session_id, self.stage_name.value)

    async def _emit_stage_completed(
        self,
        session_id: str,
        checkpoint: dict[str, Any] | None = None,
    ) -> None:
        await sse_manager.emit_stage_completed(
            session_id, self.stage_name.value, checkpoint
        )

    async def _emit_stream_chunk(self, session_id: str, chunk: StreamChunk) -> None:
        await sse_manager.emit_chunk(session_id, chunk)

    async def _emit_steering_panel(
        self,
        session_id: str,
        draft_output: dict[str, Any],
        options: list[dict[str, Any]],
    ) -> None:
        """Signal the front-end that a steering decision is required."""
        panel = SteeringPanel(
            stage=self.stage_name.value,
            draft_output=draft_output,
            options=options,
        )
        await sse_manager.emit_panel_ready(session_id, panel.model_dump())

    async def _emit_checkpoint(self, session_id: str, checkpoint: Checkpoint) -> None:
        await sse_manager.emit_checkpoint_created(session_id, checkpoint.model_dump())

    async def _wait_for_steering(self, session_id: str) -> dict[str, Any]:
        """Block until the user submits a steering action.

        The implementation polls an in-memory steering queue that is
        populated by the REST endpoint receiving the user's choice.

        Returns
        -------
        dict
            The steering action payload.
        """
        # The steering action queue is maintained by the SSE manager's
        # companion module (``domain.steering``). We import lazily to
        # avoid circular dependencies.
        from domain.steering.action_queue import get_steering_queue

        queue = get_steering_queue(session_id)
        payload = await queue.get()
        return payload
