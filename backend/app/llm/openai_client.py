"""OpenAI LLM client — re-exports the real implementation."""

# The real implementation is in openai_compat_client.py which supports
# OpenAI, Ollama Cloud, and any OpenAI-compatible endpoint.
from app.llm.openai_compat_client import OpenAICompatClient as OpenAIClient

__all__ = ["OpenAIClient"]