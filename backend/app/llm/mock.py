"""Mock LLM client — deterministic, injectable in all services for testing."""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from typing import Any

from app.llm.client import LLMClientInterface

logger = logging.getLogger(__name__)


class MockLLMClient(LLMClientInterface):
    """Deterministic LLM client for testing. Injected in all services for test mode.

    * ``responses`` — mapping of prompt substrings -> response strings.
    * ``call_log``  — records every invocation for later inspection.
    * ``complete_stream`` yields word-by-word to simulate real streaming.
    """

    def __init__(self, responses: dict[str, str] | None = None) -> None:
        self.responses = responses or {}
        self.call_log: list[dict] = []

    async def complete(self, prompt: str, **kwargs: Any) -> str:
        """Return the first matching response, or a safe JSON fallback."""
        self.call_log.append({"prompt": prompt, "kwargs": kwargs})
        for key, response in self.responses.items():
            if key in prompt:
                return response
        logger.debug("MockLLMClient: no match for prompt %r, returning fallback", prompt[:100])
        return json.dumps({"mock": True, "prompt_preview": prompt[:100]})

    async def complete_stream(self, prompt: str, **kwargs: Any) -> AsyncIterator[str]:
        """Yield the response word-by-word to exercise streaming paths."""
        response = await self.complete(prompt, **kwargs)
        words = response.split()
        for word in words:
            yield word + " "
