"""Abstract base class for LLM providers + unified client."""
from __future__ import annotations

import json
import os
from abc import ABC, abstractmethod
from typing import Any, AsyncIterator, TypeVar

from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

T = TypeVar("T")


class LLMProvider(ABC):
    """Abstract base for all LLM providers."""

    name: str = "abstract"

    @abstractmethod
    async def complete(self, prompt: str, *, temperature: float = 0.7, max_tokens: int | None = None, model: str | None = None) -> str:
        """Generate a completion. Returns raw text."""
        ...

    @abstractmethod
    async def complete_structured(self, prompt: str, output_schema: type[T], *, temperature: float = 0.7, model: str | None = None) -> T:
        """Generate a structured completion matching the given Pydantic model."""
        ...

    @abstractmethod
    async def stream(self, prompt: str, *, temperature: float = 0.7, model: str | None = None) -> AsyncIterator[str]:
        """Stream completion tokens."""
        ...

    def _inject_json_instruction(self, prompt: str, schema_cls: type) -> str:
        """Append JSON schema instruction to prompt."""
        schema = schema_cls.model_json_schema() if hasattr(schema_cls, "model_json_schema") else {}
        return (
            f"{prompt}\n\n"
            f"Respond with valid JSON that matches this schema:\n"
            f"{json.dumps(schema, indent=2)}\n"
            f"Respond ONLY with JSON, no markdown, no extra text."
        )


class LLMClient:
    """Unified LLM client with provider routing, circuit breaker, and retry."""

    def __init__(self, provider: LLMProvider | None = None):
        self._provider = provider
        self._circuit_open = False
        self._failure_count = 0
        self._max_failures = 5

    @property
    def provider(self) -> LLMProvider:
        if self._provider is None:
            raise RuntimeError("No LLM provider configured")
        return self._provider

    def set_provider(self, provider: LLMProvider) -> None:
        self._provider = provider
        self._circuit_open = False
        self._failure_count = 0

    def _check_circuit(self):
        if self._circuit_open:
            raise LLMCircuitOpenError("LLM circuit breaker is open")

    def _record_success(self):
        self._failure_count = 0
        self._circuit_open = False

    def _record_failure(self):
        self._failure_count += 1
        if self._failure_count >= self._max_failures:
            self._circuit_open = True

    @retry(
        retry=retry_if_exception_type((LLMTransientError,)),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        reraise=True,
    )
    async def complete(self, prompt: str, *, temperature: float = 0.7, max_tokens: int | None = None, model: str | None = None) -> str:
        self._check_circuit()
        try:
            result = await self.provider.complete(prompt, temperature=temperature, max_tokens=max_tokens, model=model)
            self._record_success()
            return result
        except LLMTransientError:
            self._record_failure()
            raise
        except Exception as e:
            self._record_failure()
            raise LLMError(f"LLM completion failed: {e}") from e

    @retry(
        retry=retry_if_exception_type((LLMTransientError,)),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        reraise=True,
    )
    async def complete_structured(self, prompt: str, output_schema: type[T], *, temperature: float = 0.7, model: str | None = None) -> T:
        self._check_circuit()
        try:
            result = await self.provider.complete_structured(prompt, output_schema, temperature=temperature, model=model)
            self._record_success()
            return result
        except LLMTransientError:
            self._record_failure()
            raise
        except Exception as e:
            self._record_failure()
            raise LLMError(f"LLM structured completion failed: {e}") from e

    async def stream(self, prompt: str, *, temperature: float = 0.7, model: str | None = None) -> AsyncIterator[str]:
        self._check_circuit()
        try:
            async for chunk in self.provider.stream(prompt, temperature=temperature, model=model):
                yield chunk
            self._record_success()
        except LLMTransientError:
            self._record_failure()
            raise
        except Exception as e:
            self._record_failure()
            raise LLMError(f"LLM streaming failed: {e}") from e


class LLMError(Exception):
    """Base LLM error."""
    pass


class LLMTransientError(LLMError):
    """Transient LLM error — safe to retry."""
    pass


class LLMCircuitOpenError(LLMError):
    """Circuit breaker is open — not safe to call LLM."""
    pass


class LLMTimeoutError(LLMTransientError):
    pass


class LLMContextOverflowError(LLMTransientError):
    def __init__(self, token_count: int, limit: int):
        self.token_count = token_count
        self.limit = limit
        super().__init__(f"Context overflow: {token_count} > {limit}")


class LLMRateLimitError(LLMTransientError):
    pass
