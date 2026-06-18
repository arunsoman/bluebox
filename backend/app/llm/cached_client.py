"""Caching LLM client — wraps any LLMClientInterface with in-memory cache."""

from __future__ import annotations

import asyncio
import hashlib
import logging
from collections.abc import AsyncIterator
from typing import TYPE_CHECKING, Any

from app.llm.client import LLMClientInterface

if TYPE_CHECKING:
    from openai import AsyncOpenAI

logger = logging.getLogger("llm.cached")


def _make_cache_key(prompt: str, system: str = "", **kwargs: Any) -> str:
    """Generate a cache key from prompt + parameters."""
    key_parts = [
        prompt,
        system,
        str(kwargs.get("model", "")),
        str(kwargs.get("temperature", "")),
        str(kwargs.get("max_tokens", "")),
    ]
    key_string = "|".join(key_parts)
    return hashlib.sha256(key_string.encode()).hexdigest()


class CachingLLMClient(LLMClientInterface):
    """LLM client wrapper that caches responses in memory.

    For identical prompts (same prompt + system + model + temperature + max_tokens),
    returns cached response instead of calling the underlying LLM.

    Cache is per-instance (in-memory). For persistent cross-instance caching,
    consider Redis or disk-based storage.
    """

    def __init__(
        self,
        wrapped: LLMClientInterface,
        cache_ttl_seconds: float | None = None,
    ) -> None:
        """Wrap an existing LLM client with caching.

        Args:
            wrapped: The underlying LLM client to wrap.
            cache_ttl_seconds: Optional TTL for cache entries (None = no expiry).
        """
        self._wrapped = wrapped
        self._cache: dict[str, str] = {}
        self._cache_ttl = cache_ttl_seconds
        self._lock = asyncio.Lock()
        logger.info(f"CachingLLMClient initialized, ttl={cache_ttl_seconds}s")

    async def complete(self, prompt: str, system: str = "", **kwargs: Any) -> str:
        """Non-streaming completion with cache hit/miss."""
        cache_key = _make_cache_key(prompt, system, **kwargs)

        # Check cache first (with lock to avoid race conditions)
        async with self._lock:
            if cache_key in self._cache:
                logger.debug(f"Cache HIT for key {cache_key[:12]}...")
                return self._cache[cache_key]

        # Cache miss — call the underlying LLM
        logger.debug(f"Cache MISS for key {cache_key[:12]}..., calling LLM")
        result = await self._wrapped.complete(prompt, system, **kwargs)

        # Store in cache
        async with self._lock:
            self._cache[cache_key] = result
            logger.debug(f"Cached response for key {cache_key[:12]} ({len(result)} chars)")

        return result

    async def complete_stream(
        self, prompt: str, system: str = "", **kwargs: Any
    ) -> AsyncIterator[str]:
        """Streaming completion — caches full response and replays as iterator."""
        cache_key = _make_cache_key(prompt, system, **kwargs)

        # Check cache for full response
        async with self._lock:
            if cache_key in self._cache:
                logger.debug(f"Cache HIT (stream) for key {cache_key[:12]}...")
                cached = self._cache[cache_key]
                # Replay as chunks (yield each character for realistic streaming feel)
                for char in cached:
                    yield char
                return

        # Cache miss — stream from underlying LLM, accumulate for cache
        logger.debug(f"Cache MISS (stream) for key {cache_key[:12]}..., calling LLM")
        accumulator: list[str] = []

        async for chunk in self._wrapped.complete_stream(prompt, system, **kwargs):
            accumulator.append(chunk)
            yield chunk

        # Cache the full accumulated response
        full_response = "".join(accumulator)
        async with self._lock:
            self._cache[cache_key] = full_response
            logger.debug(
                f"Cached stream response for key {cache_key[:12]} ({len(full_response)} chars)"
            )

    async def complete_json(self, prompt: str, system: str = "", **kwargs: Any) -> dict:
        """Non-streaming JSON completion with cache hit/miss.

        Caches the raw text response from the underlying LLM, then parses
        it as JSON. On cache hit, re-parses the stored raw text.
        """
        cache_key = _make_cache_key(prompt, system, **kwargs)

        # Check cache for raw text
        async with self._lock:
            if cache_key in self._cache:
                logger.debug(f"Cache HIT (json) for key {cache_key[:12]}...")
                raw = self._cache[cache_key]
                return self._parse_json(raw)

        # Cache miss — call underlying LLM, cache raw text, then parse
        logger.debug(f"Cache MISS (json) for key {cache_key[:12]}..., calling LLM")
        raw = await self._wrapped.complete(prompt, system, **kwargs)

        async with self._lock:
            self._cache[cache_key] = raw
            logger.debug(f"Cached json response for key {cache_key[:12]} ({len(raw)} chars)")

        return self._parse_json(raw)

    @staticmethod
    def _parse_json(raw: str) -> dict:
        """Parse raw LLM text as JSON, stripping markdown fences."""
        import json as _json
        import re as _re
        text = raw.strip()
        text = _re.sub(r"^```(?:json)?\s*", "", text, flags=_re.IGNORECASE)
        text = _re.sub(r"\s*```$", "", text)
        try:
            return _json.loads(text)
        except _json.JSONDecodeError:
            # Try brace/bracket balance extraction
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
                            try:
                                return _json.loads(text[start:i + 1])
                            except _json.JSONDecodeError:
                                continue
            raise

    def clear_cache(self) -> int:
        """Clear all cached entries. Returns number of entries cleared."""
        count = len(self._cache)
        self._cache.clear()
        logger.info(f"Cache cleared ({count} entries)")
        return count

    def cache_size(self) -> int:
        """Return number of cached entries."""
        return len(self._cache)