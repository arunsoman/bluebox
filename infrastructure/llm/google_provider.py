"""Google Gemini LLM provider."""
from __future__ import annotations

import json
from typing import AsyncIterator, TypeVar

import httpx

from config.settings import settings
from infrastructure.llm.llm_provider import LLMProvider, LLMTransientError

T = TypeVar("T")


class GoogleProvider(LLMProvider):
    """Google Gemini provider."""

    name = "google"

    def __init__(self, api_key: str | None = None, default_model: str | None = None):
        self.api_key = api_key or settings.google_api_key
        self.default_model = default_model or "gemini-1.5-flash"
        self._client = httpx.AsyncClient(timeout=300.0, http2=True)

    async def complete(self, prompt: str, *, temperature: float = 0.7, max_tokens: int | None = None, model: str | None = None) -> str:
        model = model or self.default_model
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": temperature},
        }
        if max_tokens:
            payload["generationConfig"]["maxOutputTokens"] = max_tokens
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={self.api_key}"
        try:
            resp = await self._client.post(url, json=payload)
            resp.raise_for_status()
            result = resp.json()
            candidates = result.get("candidates", [])
            if not candidates:
                return ""
            parts = candidates[0].get("content", {}).get("parts", [])
            return "".join(p.get("text", "") for p in parts)
        except httpx.TimeoutException as e:
            raise LLMTransientError(f"Google timeout: {e}") from e
        except httpx.HTTPStatusError as e:
            if e.response.status_code in (429, 503):
                raise LLMTransientError(f"Google rate limit / server error: {e}") from e
            raise

    async def complete_structured(self, prompt: str, output_schema: type[T], *, temperature: float = 0.7, model: str | None = None) -> T:
        prompt = self._inject_json_instruction(prompt, output_schema)
        raw = await self.complete(prompt, temperature=temperature, model=model)
        cleaned = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        data = json.loads(cleaned)
        return output_schema(**data)

    async def stream(self, prompt: str, *, temperature: float = 0.7, model: str | None = None) -> AsyncIterator[str]:
        model = model or self.default_model
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": temperature},
        }
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse&key={self.api_key}"
        async with self._client.stream("POST", url, json=payload) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data = line[6:]
                try:
                    chunk = json.loads(data)
                    candidates = chunk.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        for p in parts:
                            text = p.get("text", "")
                            if text:
                                yield text
                except (json.JSONDecodeError, KeyError):
                    continue
