"""Ollama LLM provider for local model inference."""
from __future__ import annotations

import json
from typing import AsyncIterator, TypeVar

import httpx

from config.settings import settings
from infrastructure.llm.llm_provider import LLMProvider, LLMTransientError

T = TypeVar("T")


class OllamaProvider(LLMProvider):
    """Ollama provider — supports local models via Ollama API."""

    name = "ollama"

    def __init__(self, base_url: str | None = None, default_model: str | None = None):
        self.base_url = (base_url or settings.ollama_base_url).rstrip("/")
        self.default_model = default_model or settings.default_llm_model
        self._client = httpx.AsyncClient(timeout=300.0, http2=True)

    async def complete(self, prompt: str, *, temperature: float = 0.7, max_tokens: int | None = None, model: str | None = None) -> str:
        model = model or self.default_model
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": temperature},
        }
        if max_tokens:
            payload["options"]["num_predict"] = max_tokens
        try:
            resp = await self._client.post(f"{self.base_url}/api/generate", json=payload)
            resp.raise_for_status()
            return resp.json().get("response", "")
        except httpx.TimeoutException as e:
            raise LLMTransientError(f"Ollama timeout: {e}") from e
        except httpx.HTTPError as e:
            raise LLMTransientError(f"Ollama HTTP error: {e}") from e

    async def complete_structured(self, prompt: str, output_schema: type[T], *, temperature: float = 0.7, model: str | None = None) -> T:
        prompt = self._inject_json_instruction(prompt, output_schema)
        raw = await self.complete(prompt, temperature=temperature, model=model)
        # Clean up markdown code blocks
        cleaned = raw.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()
        data = json.loads(cleaned)
        return output_schema(**data)

    async def stream(self, prompt: str, *, temperature: float = 0.7, model: str | None = None) -> AsyncIterator[str]:
        model = model or self.default_model
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": True,
            "options": {"temperature": temperature},
        }
        async with self._client.stream("POST", f"{self.base_url}/api/generate", json=payload) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line.strip():
                    continue
                try:
                    chunk = json.loads(line)
                    yield chunk.get("response", "")
                except json.JSONDecodeError:
                    continue
