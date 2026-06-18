"""Chunked streaming strategy for pipeline stage execution.

The core streaming engine that emits StreamChunk objects via SSE at chunk
boundaries. Each chunk represents ONE node (one actor, one capability, one
task, etc.). After emitting each chunk, checks if an interrupt was requested
(chunk-boundary interrupt).
"""
from __future__ import annotations

from typing import Any

from domain.models import StageName, StreamChunk
from infrastructure.messaging.sse_manager import sse_manager


class ChunkedStreamingStrategy:
    """Streams pipeline output as discrete chunks with boundary-interrupt support.

    Each chunk represents a single node (actor, capability, task, etc.).
    After every emission, the strategy checks whether the session has been
    flagged for interruption, enabling sub-second mid-stage steering.
    """

    async def emit_node(
        self,
        node_data: dict[str, Any],
        stage: StageName,
        chunk_index: int,
        content_type: str,
        session_id: str,
    ) -> bool:
        """Emit one node as a :class:`StreamChunk` via SSE.

        Parameters
        ----------
        node_data:
            The serialised node payload (e.g. a dict from ``Actor.model_dump()``).
        stage:
            The pipeline stage that produced this node.
        chunk_index:
            Zero-based position of this node in the stream.
        content_type:
            Semantic type of the node -- ``actor``, ``capability``, ``task``, etc.
        session_id:
            Session identifier used to route the SSE event.

        Returns
        -------
        bool
            ``True`` if an interrupt was requested at this chunk boundary and
            the caller should stop emitting further nodes.
        """
        chunk = StreamChunk(
            chunk_id=f"{session_id}:{stage.value}:{chunk_index}",
            stage=stage.value,
            chunk_index=chunk_index,
            content_type=content_type,
            content=node_data,
            is_final_chunk=False,
        )
        interrupted = await sse_manager.emit_chunk(session_id, chunk)
        return interrupted

    async def finalize(
        self,
        session_id: str,
        stage: StageName,
        chunk_index: int,
    ) -> None:
        """Emit a sentinel chunk marking the end of the stream.

        The ``is_final_chunk=True`` flag tells the front-end that all nodes
        have been received and the steering panel can be rendered.
        """
        final_chunk = StreamChunk(
            chunk_id=f"{session_id}:{stage.value}:{chunk_index}:final",
            stage=stage.value,
            chunk_index=chunk_index,
            content_type="final",
            content={},
            is_final_chunk=True,
        )
        # Final chunk is emitted via plain emit so it does not trigger
        # another interrupt check (the boundary has already been handled).
        await sse_manager.emit(session_id, "STREAM_CHUNK", final_chunk.model_dump())
