"""Streaming chunk manager for LLM output."""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator

from app.domain.models import StreamChunk

logger = logging.getLogger(__name__)


class StreamingChunkManager:
    """Serializes LLM output into StreamChunks. Emits CHUNK_READY events."""

    def __init__(self, chunk_interval_ms: int = 2000):
        self.chunk_interval_ms = chunk_interval_ms
        self._chunks: list[StreamChunk] = []
        self._interrupted: bool = False

    async def stream(self, llm_response: AsyncIterator[str], stage_id: int) -> AsyncIterator[StreamChunk]:
        """Convert raw LLM token stream into logical node chunks."""
        buffer = []
        async for token in llm_response:
            if self._interrupted:
                break
            buffer.append(token)
            # Parse buffer into complete nodes when possible
            if self._is_complete_node(buffer):
                chunk = self._create_chunk(buffer, stage_id)
                self._chunks.append(chunk)
                yield chunk
                buffer = []

    def interrupt(self) -> None:
        self._interrupted = True

    def _is_complete_node(self, buffer: list[str]) -> bool:
        """Check if buffer contains a complete JSON node."""
        text = "".join(buffer)
        return text.rstrip().endswith("}") and text.count("{") == text.count("}")

    def _create_chunk(self, buffer: list[str], stage_id: int) -> StreamChunk:
        text = "".join(buffer)
        data = json.loads(text)
        return StreamChunk(stage_id=stage_id, node_type=data.get("_type", "unknown"), node_data=data, index_in_stage=0)
