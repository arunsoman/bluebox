"""OpenAI-compatible LLM client — works with Ollama Cloud, OpenAI, and any
OpenAI-compatible endpoint (DeepSeek, Groq, etc.)."""

from __future__ import annotations

import json
import logging
import os
import re
from collections.abc import AsyncIterator
from typing import Any

from openai import AsyncOpenAI

from app.llm.client import LLMClientInterface
from app.llm.providers import get_model_config, get_provider_key

logger = logging.getLogger("llm.openai_compat")


class OpenAICompatClient(LLMClientInterface):
    """OpenAI-compatible client that auto-configures from provider/model settings.

    For Ollama Cloud: the local ollama daemon (default localhost:11434) acts as
    an auth proxy — it uses SSH keypair auth (~/.ollama/id_ed25519) to forward
    :cloud model requests to ollama.com. No Bearer API key is needed for the
    local proxy; the API key in settings is stored for reference/other providers.
    """

    def __init__(
        self,
        model_id: str | None = None,
        api_key: str | None = None,
        base_url: str | None = None,
        provider: str | None = None,
        timeout: float = 120.0,
    ) -> None:
        # Resolve model config if a model_id was given
        if model_id and not provider:
            cfg = get_model_config(model_id)
            if cfg:
                provider = cfg.get("provider", provider)
                if not api_key:
                    api_key = cfg.get("api_key") or get_provider_key(provider or "ollama")
                if not base_url:
                    base_url = cfg.get("base_url")

        self.model_id = model_id or os.getenv("DEFAULT_LLM_MODEL", "deepseek-v4-flash:cloud")
        self.provider = provider or "ollama"
        self.base_url = base_url or os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")
        self.timeout = timeout

        # Ollama Cloud models (:cloud suffix) route through the local ollama
        # daemon which handles cloud auth via SSH keypair. No API key needed.
        # For other providers (OpenAI, etc.) the key is required.
        if self.provider == "ollama":
            # Local ollama daemon doesn't require Bearer auth — use placeholder
            self.api_key = "ollama"
        else:
            self.api_key = api_key or get_provider_key(self.provider) or os.getenv("OPENAI_API_KEY", "")
            if not self.api_key:
                raise ValueError(
                    f"No API key for provider '{self.provider}'. "
                    f"Set the key in Settings or the {self.provider.upper()}_API_KEY env var."
                )

        self._client = AsyncOpenAI(
            api_key=self.api_key,
            base_url=self.base_url,
            timeout=timeout,
        )
        logger.info(
            f"LLM client ready: provider={self.provider}, model={self.model_id}, "
            f"base_url={self.base_url}"
        )

    async def complete(self, prompt: str, system: str = "", **kwargs: Any) -> str:
        """Non-streaming completion."""
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        try:
            resp = await self._client.chat.completions.create(
                model=self.model_id,
                messages=messages,
                temperature=kwargs.get("temperature", 0.3),
                max_tokens=kwargs.get("max_tokens", 4096),
            )
            content = resp.choices[0].message.content or ""
            logger.debug(f"LLM complete: {len(content)} chars, model={self.model_id}")
            return content
        except Exception as e:
            logger.error(f"LLM complete failed: {e}")
            raise

    async def complete_stream(self, prompt: str, system: str = "", **kwargs: Any) -> AsyncIterator[str]:
        """Streaming completion — yields text chunks."""
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        try:
            stream = await self._client.chat.completions.create(
                model=self.model_id,
                messages=messages,
                temperature=kwargs.get("temperature", 0.3),
                max_tokens=kwargs.get("max_tokens", 4096),
                stream=True,
            )
            async for chunk in stream:
                delta = chunk.choices[0].delta.content if chunk.choices else None
                if delta:
                    yield delta
        except Exception as e:
            logger.error(f"LLM stream failed: {e}")
            raise

    async def complete_json(self, prompt: str, system: str = "", **kwargs: Any) -> dict:
        """Non-streaming completion that parses the response as JSON.

        Tries progressively harder to extract a valid JSON object/array from the
        LLM output without throwing away partial results.
        """
        raw = await self.complete(prompt, system, **kwargs)

        # 1) Strip common wrappers: markdown fences, leading/trailing whitespace
        text = raw.strip()
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)
        text = re.sub(r"^\s*\{[\s\S]*?\}\s*$", lambda m: m.group(0).strip(), text)

        # 2) Try the cleaned text directly
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # 3) Try to find the first top-level JSON object/array with brace balance
        candidates: list[str] = []
        for start_ch, end_ch in (("{", "}"), ("[", "]")):
            depth = 0
            start = None
            for i, ch in enumerate(text):
                if ch == start_ch:
                    if depth == 0:
                        start = i
                    depth += 1
                elif ch == end_ch:
                    depth -= 1
                    if depth == 0 and start is not None:
                        candidates.append(text[start : i + 1])
                        start = None

        for candidate in candidates:
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                continue

        # 4) Heuristic: fix common LLM JSON mistakes
        cleaned = text
        # Remove trailing commas before closing braces/brackets
        cleaned = re.sub(r",(\s*[}\]])", r"\1", cleaned)
        # Remove single-line comments (rare, but some models produce them)
        cleaned = re.sub(r"(?<!:)//[^\n]*", "", cleaned)
        # Normalize smart quotes / apostrophes
        cleaned = cleaned.replace("\u201c", '"').replace("\u201d", '"')
        cleaned = cleaned.replace("\u2018", "'").replace("\u2019", "'")
        cleaned = cleaned.replace("\u2026", "...")

        for candidate in candidates:
            try:
                fixed = re.sub(r",(\s*[}\]])", r"\1", candidate)
                fixed = fixed.replace("\u201c", '"').replace("\u201d", '"')
                fixed = fixed.replace("\u2018", "'").replace("\u2019", "'")
                return json.loads(fixed)
            except json.JSONDecodeError:
                continue

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON from LLM output ({len(raw)} chars): {str(e)[:120]}")
            raise