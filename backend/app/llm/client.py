"""LLM Client Interface — abstract base for all LLM clients."""

from __future__ import annotations

import asyncio
import json
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from typing import Any


class LLMClientInterface(ABC):
    """Abstract LLM client. All failures emit STEERING_REQUIRED with options."""

    @abstractmethod
    async def complete(self, prompt: str, **kwargs: Any) -> str:
        """Non-streaming completion."""
        ...

    @abstractmethod
    async def complete_stream(self, prompt: str, **kwargs: Any) -> AsyncIterator[str]:
        """Streaming completion — yields tokens."""
        ...

    async def handle_error(self, error: Exception, context: dict) -> dict:
        """Convert LLM errors to STEERING_REQUIRED events."""
        error_type = self._classify_error(error)
        return {
            "event": "STEERING_REQUIRED",
            "error_type": error_type,
            "context": context,
            "options": ["retry", "modify", "skip", "restore_checkpoint"],
        }

    def _classify_error(self, error: Exception) -> str:
        if isinstance(error, asyncio.TimeoutError):
            return "timeout"
        elif isinstance(error, json.JSONDecodeError):
            return "malformed_json"
        elif "context" in str(error).lower() and "overflow" in str(error).lower():
            return "context_overflow"
        elif "rate" in str(error).lower():
            return "rate_limit"
        return "unknown"
