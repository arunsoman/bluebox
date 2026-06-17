"""Context window management for LLM token limits."""

from __future__ import annotations

from collections.abc import AsyncIterator

from pydantic import BaseModel


class ContextWindowManager:
    """Token estimation, compression, and two-pass summarization."""

    FULL_CONTEXT_LIMIT = 60000
    COMPRESSED_LIMIT = 100000

    def __init__(self):
        self._token_estimates: dict[str, int] = {}

    def estimate_tokens(self, text: str) -> int:
        """Rough estimate: ~4 chars per token."""
        return len(text) // 4

    def select_strategy(self, context_text: str) -> str:
        tokens = self.estimate_tokens(context_text)
        if tokens < self.FULL_CONTEXT_LIMIT:
            return "full"
        elif tokens < self.COMPRESSED_LIMIT:
            return "compressed"
        else:
            return "two_pass"

    def compress(self, nodes: list[BaseModel]) -> list[dict]:
        """Compressed: keep IDs, names, relationships only. Drop descriptions."""
        compressed = []
        for node in nodes:
            d = {"id": getattr(node, "id", "")}
            if hasattr(node, "name"):
                d["name"] = node.name
            if hasattr(node, "parent_ids"):
                d["parent_ids"] = node.parent_ids
            if hasattr(node, "actor_ids"):
                d["actor_ids"] = node.actor_ids
            compressed.append(d)
        return compressed

    async def two_pass_summarize(self, context_text: str, llm_client) -> str:
        """Pass 1: Summarize prior stages. Pass 2: Return brief."""
        summary_prompt = (
            "Summarize the following project context into a structured brief:\n\n"
            + context_text[:40000]
        )
        summary = await llm_client.complete(summary_prompt)
        return summary
