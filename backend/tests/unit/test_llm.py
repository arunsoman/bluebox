"""Unit tests for LLM client abstraction.

Tests cover:
- MockLLMClient returns configured responses
- MockLLMClient records call_log
- MockLLMClient streams word-by-word
- Error classification (timeout, rate_limit, malformed_json, context_overflow, unknown)
"""

from __future__ import annotations

import asyncio
import json

import pytest

from app.llm.client import LLMClientInterface
from app.llm.mock import MockLLMClient


# ---------------------------------------------------------------------------
# MockLLMClient
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestMockLLMClient:
    async def test_returns_configured_response(self):
        client = MockLLMClient(responses={
            "hello": '{"greeting": "world"}',
        })
        result = await client.complete("Say hello")
        assert json.loads(result)["greeting"] == "world"

    async def test_returns_fallback_when_no_match(self):
        client = MockLLMClient(responses={})
        result = await client.complete("Anything")
        data = json.loads(result)
        assert data["mock"] is True

    async def test_partial_match_works(self):
        """Substring matching — key in prompt triggers response."""
        client = MockLLMClient(responses={
            "analysis": '{"result": "analyzed"}',
        })
        result = await client.complete("Run the analysis now")
        assert json.loads(result)["result"] == "analyzed"

    async def test_first_match_wins(self):
        """First matching key in responses dict wins."""
        client = MockLLMClient(responses={
            "first": '{"winner": "first"}',
            "second": '{"winner": "second"}',
        })
        # Both match, but "first" appears first in dict iteration (Python 3.7+)
        result = await client.complete("first second")
        assert json.loads(result)["winner"] == "first"

    async def test_records_call_log(self):
        client = MockLLMClient(responses={"test": "ok"})
        assert len(client.call_log) == 0

        await client.complete("test prompt")
        assert len(client.call_log) == 1
        assert client.call_log[0]["prompt"] == "test prompt"

    async def test_call_log_includes_kwargs(self):
        client = MockLLMClient(responses={"test": "ok"})
        await client.complete("test prompt", temperature=0.5, max_tokens=100)
        assert client.call_log[0]["kwargs"] == {"temperature": 0.5, "max_tokens": 100}

    async def test_call_log_multiple_calls(self):
        client = MockLLMClient(responses={"test": "ok"})
        await client.complete("call 1")
        await client.complete("call 2")
        await client.complete("call 3")
        assert len(client.call_log) == 3
        assert client.call_log[0]["prompt"] == "call 1"
        assert client.call_log[1]["prompt"] == "call 2"
        assert client.call_log[2]["prompt"] == "call 3"

    async def test_stream_returns_words(self):
        """complete_stream yields word-by-word."""
        client = MockLLMClient(responses={
            "stream": "one two three",
        })
        words = []
        async for token in client.complete_stream("stream test"):
            words.append(token.strip())

        assert words == ["one", "two", "three"]

    async def test_stream_empty_response(self):
        client = MockLLMClient(responses={"empty": ""})
        words = []
        async for token in client.complete_stream("empty"):
            words.append(token)
        assert words == []

    async def test_stream_single_word(self):
        client = MockLLMClient(responses={"single": "hello"})
        words = []
        async for token in client.complete_stream("single"):
            words.append(token.strip())
        assert words == ["hello"]


# ---------------------------------------------------------------------------
# Error Classification (via LLMClientInterface)
# ---------------------------------------------------------------------------


class TestErrorClassification:
    def test_timeout_error(self):
        class DummyClient(LLMClientInterface):
            async def complete(self, prompt, **kwargs):
                pass
            async def complete_stream(self, prompt, **kwargs):
                pass

        client = DummyClient()
        error_type = client._classify_error(asyncio.TimeoutError())
        assert error_type == "timeout"

    def test_malformed_json_error(self):
        class DummyClient(LLMClientInterface):
            async def complete(self, prompt, **kwargs):
                pass
            async def complete_stream(self, prompt, **kwargs):
                pass

        client = DummyClient()
        error_type = client._classify_error(json.JSONDecodeError("test", "doc", 0))
        assert error_type == "malformed_json"

    def test_context_overflow_error(self):
        class DummyClient(LLMClientInterface):
            async def complete(self, prompt, **kwargs):
                pass
            async def complete_stream(self, prompt, **kwargs):
                pass

        client = DummyClient()
        error_type = client._classify_error(Exception("Context overflow detected"))
        assert error_type == "context_overflow"

    def test_rate_limit_error(self):
        class DummyClient(LLMClientInterface):
            async def complete(self, prompt, **kwargs):
                pass
            async def complete_stream(self, prompt, **kwargs):
                pass

        client = DummyClient()
        error_type = client._classify_error(Exception("Rate limit exceeded"))
        assert error_type == "rate_limit"

    def test_unknown_error(self):
        class DummyClient(LLMClientInterface):
            async def complete(self, prompt, **kwargs):
                pass
            async def complete_stream(self, prompt, **kwargs):
                pass

        client = DummyClient()
        error_type = client._classify_error(Exception("Something weird happened"))
        assert error_type == "unknown"

    def test_handle_error_returns_steering_required(self):
        class DummyClient(LLMClientInterface):
            async def complete(self, prompt, **kwargs):
                pass
            async def complete_stream(self, prompt, **kwargs):
                pass

        client = DummyClient()
        result = asyncio.run(client.handle_error(asyncio.TimeoutError(), {"stage": 0}))

        assert result["event"] == "STEERING_REQUIRED"
        assert result["error_type"] == "timeout"
        assert "options" in result
        assert "retry" in result["options"]
        assert "restore_checkpoint" in result["options"]
