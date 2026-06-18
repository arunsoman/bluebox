"""OpenAI / Azure OpenAI LLM provider."""
from __future__ import annotations

import json
from typing import AsyncIterator, TypeVar

import httpx

from config.settings import settings
from infrastructure.llm.llm_provider import LLMProvider, LLMTransientError

T = TypeVar("T")


class OpenAIProvider(LLMProvider):
    """OpenAI provider — GPT-4, GPT-4o, GPT-3.5-turbo, etc."""

    name = "openai"

    def __init__(self, api_key: str | None = None, base_url: str | None = None, default_model: str | None = None):
        self.api_key = api_key or settings.openai_api_key
        self.base_url = (base_url or settings.openai_base_url).rstrip("/")
        self.default_model = default_model or "gpt-4o"
        self._client = httpx.AsyncClient(
            timeout=300.0,
            http2=True,
            headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
        )

    async def complete(self, prompt: str, *, temperature: float = 0.7, max_tokens: int | None = None, model: str | None = None) -> str:
        model = model or self.default_model
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
            "stream": False,
        }
        if max_tokens:
            payload["max_tokens"] = max_tokens
        try:
            resp = await self._client.post(f"{self.base_url}/chat/completions", json=payload)
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"] or ""
        except httpx.TimeoutException as e:
            raise LLMTransientError(f"OpenAI timeout: {e}") from e
        except httpx.HTTPStatusError as e:
            if e.response.status_code in (429, 502, 503):
                raise LLMTransientError(f"OpenAI rate limit / server error: {e}") from e
            raise

    async def complete_structured(self, prompt: str, output_schema: type[T], *, temperature: float = 0.7, model: str | None = None) -> T:
        model = model or self.default_model
        schema = output_schema.model_json_schema() if hasattr(output_schema, "model_json_schema") else {}
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
            "response_format": {"type": "json_schema", "json_schema": {"name": "output", "schema": schema, "strict": True}},
        }
        try:
            resp = await self._client.post(f"{self.base_url}/chat/completions", json=payload)
            resp.raise_for_status()
            raw = resp.json()["choices"][0]["message"]["content"] or "{}"
            data = json.loads(raw)
            return output_schema(**data)
        except (httpx.TimeoutException, httpx.HTTPStatusError) as e:
            raise LLMTransientError(f"OpenAI structured error: {e}") from e

    async def stream(self, prompt: str, *, temperature: float = 0.7, model: str | None = None) -> AsyncIterator[str]:
        model = model or self.default_model
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
            "stream": True,
        }
        async with self._client.stream("POST", f"{self.base_url}/chat/completions", json=payload) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data = line[6:]
                if data == "[DONE]":
                    break
                try:
                    chunk = json.loads(data)
                    delta = chunk["choices"][0]["delta"].get("content", "")
                    if delta:
                        yield delta
                except (json.JSONDecodeError, KeyError):
                    continue
