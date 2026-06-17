"""Abstract base class for all stage executors."""

from __future__ import annotations

import json
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator

from app.domain.models import ProjectBlueprint, StreamChunk
from app.llm.client import LLMClientInterface


class BaseStageExecutor(ABC):
    """Abstract base for all stage executors."""

    def __init__(self, stage_id: int, stage_name: str, llm_client: LLMClientInterface) -> None:
        self.stage_id = stage_id
        self.stage_name = stage_name
        self.llm_client = llm_client

    @abstractmethod
    async def execute(self, blueprint: ProjectBlueprint, context: dict) -> AsyncIterator[StreamChunk]:
        """Execute the stage, yielding StreamChunks."""
        ...

    @abstractmethod
    async def build_prompt(self, blueprint: ProjectBlueprint, context: dict) -> str:
        """Build the LLM prompt for this stage."""
        ...

    async def finalize(self, blueprint: ProjectBlueprint, chunks: list[StreamChunk]) -> ProjectBlueprint:
        """Apply stage outputs to blueprint. Override in subclasses."""
        return blueprint

    # Shared helpers

    def _is_json_complete(self, text: str) -> bool:
        """Heuristic: does ``text`` contain at least one fully-closed JSON object or array?"""
        stripped = text.strip()
        if stripped.count("{") == 0 and stripped.count("[") == 0:
            return False
        # Object: ends with } and braces match
        if stripped.rstrip().endswith("}") and stripped.count("{") == stripped.count("}"):
            return True
        # Array: ends with ] and brackets match
        if stripped.rstrip().endswith("]") and stripped.count("[") == stripped.count("]"):
            return True
        return False

    async def _parse_json_response(self, text: str) -> dict | None:
        """Safely parse a JSON string, returning None on failure."""
        try:
            return json.loads(text)
        except (json.JSONDecodeError, TypeError):
            return None
