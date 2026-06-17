"""OpenAI LLM client implementation."""

from __future__ import annotations

import os
from collections.abc import AsyncIterator
from typing import Any

from app.llm.client import LLMClientInterface


class OpenAIClient(LLMClientInterface):
    """OpenAI API client for production use."""

    def __init__(self, api_key: str | None = None, model: str = "gpt-4") -> None:
        self.api_key = api_key or os.getenv("OPENAI_API_KEY", "")
        self.model = model

    async def complete(self, prompt: str, **kwargs: Any) -> str:
        """Non-streaming completion via OpenAI API."""
        # Production implementation would use openai.AsyncOpenAI here
        raise NotImplementedError("OpenAI client not yet implemented — use MockLLMClient for testing")

    async def complete_stream(self, prompt: str, **kwargs: Any) -> AsyncIterator[str]:
        """Streaming completion via OpenAI API."""
        raise NotImplementedError("OpenAI client not yet implemented — use MockLLMClient for testing")
