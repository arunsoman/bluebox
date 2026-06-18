"""ContextWindowManager — manages LLM context window sizing and compression strategies.

Uses tiktoken for token estimation. Selects strategy based on token count:
- FULL_CONTEXT: < 60k tokens — pass through as-is
- COMPRESSED_CONTEXT: 60k–100k tokens — keep names + IDs only, remove descriptions
- TWO_PASS: > 100k tokens — summarize into structured brief
"""
from __future__ import annotations

import json
from typing import Any

from domain.models import LLMCallStrategy
from infrastructure.llm.llm_provider import LLMClient


class ContextWindowManager:
    """Manages context window sizing and applies compression strategies.

    Token thresholds:
    - FULL_CONTEXT: 0 – 60,000 tokens
    - COMPRESSED_CONTEXT: 60,001 – 100,000 tokens
    - TWO_PASS: 100,001+ tokens
    """

    # Token count thresholds
    FULL_CONTEXT_MAX: int = 60_000
    COMPRESSED_CONTEXT_MAX: int = 100_000

    # tiktoken encoding name for the default model
    DEFAULT_ENCODING: str = "cl100k_base"  # Used by GPT-4, GPT-3.5-turbo, etc.

    def __init__(self, llm_client: LLMClient | None = None) -> None:
        self._llm = llm_client
        self._encoding_name = self.DEFAULT_ENCODING
        self._encoding: Any = None

    def _get_encoding(self) -> Any:
        """Lazy-load tiktoken encoding."""
        if self._encoding is None:
            try:
                import tiktoken
                self._encoding = tiktoken.get_encoding(self._encoding_name)
            except ImportError:
                raise RuntimeError(
                    "tiktoken is required for token estimation. "
                    "Install with: pip install tiktoken"
                )
        return self._encoding

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def estimate_tokens(self, text: str) -> int:
        """Estimate the number of tokens in *text* using tiktoken.

        Falls back to approximate word-based counting if tiktoken is unavailable.
        """
        if not text:
            return 0

        try:
            enc = self._get_encoding()
            tokens = enc.encode(text)
            return len(tokens)
        except Exception:
            # Fallback: ~4 characters per token on average for English text
            return len(text) // 4

    def select_strategy(self, token_count: int) -> LLMCallStrategy:
        """Select the LLM call strategy based on token count.

        - FULL_CONTEXT: < 60k tokens
        - COMPRESSED_CONTEXT: 60k–100k tokens
        - TWO_PASS: > 100k tokens
        """
        if token_count <= self.FULL_CONTEXT_MAX:
            return LLMCallStrategy.FULL_CONTEXT
        elif token_count <= self.COMPRESSED_CONTEXT_MAX:
            return LLMCallStrategy.COMPRESSED_CONTEXT
        else:
            return LLMCallStrategy.TWO_PASS

    async def compress_context(self, context: dict[str, Any], strategy: LLMCallStrategy) -> dict[str, Any]:
        """Apply the selected compression strategy to the context.

        - FULL_CONTEXT: pass through unchanged
        - COMPRESSED_CONTEXT: keep names + IDs only, remove descriptions
        - TWO_PASS: summarize into structured brief using LLM
        """
        if strategy == LLMCallStrategy.FULL_CONTEXT:
            return self._compress_full(context)
        elif strategy == LLMCallStrategy.COMPRESSED_CONTEXT:
            return self._compress_compressed(context)
        elif strategy == LLMCallStrategy.TWO_PASS:
            return await self._compress_two_pass(context)
        else:
            raise ValueError(f"Unknown strategy: {strategy}")

    # ------------------------------------------------------------------
    # Compression implementations
    # ------------------------------------------------------------------

    def _compress_full(self, context: dict[str, Any]) -> dict[str, Any]:
        """FULL_CONTEXT: pass through unchanged."""
        return context

    def _compress_compressed(self, context: dict[str, Any]) -> dict[str, Any]:
        """COMPRESSED_CONTEXT: keep names + IDs only, remove descriptions.

        Recursively processes the context dict, preserving:
        - id/name/title fields
        - Structural keys (lists, dicts) but with truncated content
        - Removing: description, rationale, notes, long text fields
        """
        return self._strip_descriptions(context)

    async def _compress_two_pass(self, context: dict[str, Any]) -> dict[str, Any]:
        """TWO_PASS: summarize into a structured brief using LLM.

        First pass: compress to key IDs and names.
        Second pass: use LLM to generate a structured summary brief.
        """
        # First pass: strip descriptions
        compressed = self._strip_descriptions(context)

        # Second pass: LLM summary if available
        if self._llm is not None:
            try:
                context_json = json.dumps(compressed, default=str, indent=2)[:4000]
                prompt = (
                    "Summarize the following project context into a structured brief. "
                    "The brief should include:\n"
                    "- project_overview: 2-3 sentence summary\n"
                    "- key_entities: list of important actors, capabilities, and use cases with their IDs\n"
                    "- critical_requirements: list of must-have requirements\n"
                    "- open_questions: any gaps or ambiguities\n"
                    "Return valid JSON with these exact keys.\n\n"
                    f"Context:\n{context_json}\n"
                )

                from pydantic import BaseModel, Field

                class _Brief(BaseModel):
                    project_overview: str = ""
                    key_entities: list[dict[str, str]] = Field(default_factory=list)
                    critical_requirements: list[str] = Field(default_factory=list)
                    open_questions: list[str] = Field(default_factory=list)

                brief = await self._llm.complete_structured(prompt, _Brief, temperature=0.4)
                return {
                    "_compression_strategy": "two_pass",
                    "_compressed": True,
                    "project_overview": brief.project_overview,
                    "key_entities": [
                        {k: str(v) for k, v in entity.items()}
                        for entity in brief.key_entities
                    ],
                    "critical_requirements": brief.critical_requirements,
                    "open_questions": brief.open_questions,
                    "_original_keys": list(context.keys()),
                }
            except Exception:
                # If LLM fails, fall back to compressed context
                return {
                    "_compression_strategy": "two_pass_fallback",
                    "_compressed": True,
                    **compressed,
                }

        # No LLM available — return compressed with metadata
        return {
            "_compression_strategy": "two_pass_no_llm",
            "_compressed": True,
            **compressed,
        }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _strip_descriptions(self, obj: Any) -> Any:
        """Recursively strip description/long-text fields from a data structure.

        Preserves id, name, title, type fields. Removes description, rationale,
        notes, and other verbose fields. Trims string values to 80 chars.
        """
        if isinstance(obj, dict):
            result: dict[str, Any] = {}
            for key, value in obj.items():
                key_lower = key.lower()
                # Skip known verbose fields
                if key_lower in {
                    "description", "rationale", "notes", "explanation",
                    "detail", "details", "comment", "comments",
                    "justification", "reason", "background",
                    "implementation_sketch", "raw_text",
                }:
                    continue
                # Recurse into nested structures
                result[key] = self._strip_descriptions(value)
            return result
        elif isinstance(obj, list):
            return [self._strip_descriptions(item) for item in obj]
        elif isinstance(obj, str):
            # Truncate long strings
            if len(obj) > 120:
                return obj[:117] + "..."
            return obj
        else:
            return obj

    def get_context_info(self, context: dict[str, Any]) -> dict[str, Any]:
        """Get metadata about a context object: token estimate, key count, strategy.

        Returns a dict with token_count, strategy, and key_count.
        """
        context_json = json.dumps(context, default=str)
        token_count = self.estimate_tokens(context_json)
        strategy = self.select_strategy(token_count)
        return {
            "token_count": token_count,
            "strategy": strategy.value,
            "key_count": len(context),
            "threshold_full_context": self.FULL_CONTEXT_MAX,
            "threshold_compressed_context": self.COMPRESSED_CONTEXT_MAX,
        }
