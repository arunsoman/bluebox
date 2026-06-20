"""Tests for shared_kernel/observability/redaction.py - the policy shared by
every log capture point (REST middleware, httpx hooks).
"""

import json

from bluebox.shared_kernel.observability.redaction import (
    redact_headers,
    redact_json_body,
    truncate_body,
)


def test_redact_headers_is_case_insensitive_and_leaves_others_untouched() -> None:
    headers = {"Authorization": "Bearer secret", "X-Goog-Api-Key": "abc", "Content-Type": "application/json"}

    redacted = redact_headers(headers)

    assert redacted["Authorization"] == "[redacted]"
    assert redacted["X-Goog-Api-Key"] == "[redacted]"
    assert redacted["Content-Type"] == "application/json"


def test_redact_json_body_redacts_nested_sensitive_fields() -> None:
    body = json.dumps({"user": {"email": "a@b.com", "access_token": "secret-value"}, "refresh_token": "also-secret"})

    redacted = json.loads(redact_json_body(body))

    assert redacted["user"]["access_token"] == "[redacted]"
    assert redacted["refresh_token"] == "[redacted]"
    assert redacted["user"]["email"] == "a@b.com"


def test_redact_json_body_passes_through_non_json_unchanged() -> None:
    text = "this is a plain-text LLM prompt, not JSON"

    assert redact_json_body(text) == text


def test_truncate_body_none_or_empty() -> None:
    assert truncate_body(None) == {"text": None, "truncated": False, "original_size_bytes": 0}
    assert truncate_body(b"") == {"text": None, "truncated": False, "original_size_bytes": 0}


def test_truncate_body_under_cap_is_unchanged() -> None:
    result = truncate_body("hello", max_bytes=100)

    assert result == {"text": "hello", "truncated": False, "original_size_bytes": 5}


def test_truncate_body_over_cap_is_truncated_with_original_size() -> None:
    body = "x" * 100

    result = truncate_body(body, max_bytes=10)

    assert result["truncated"] is True
    assert result["original_size_bytes"] == 100
    assert len(result["text"]) == 10


def test_truncate_body_redacts_before_truncating() -> None:
    """A secret near the size cap must never appear in the visible (possibly
    truncated) text - redaction has to run first, or a half-cut secret could
    leak through the boundary."""

    body = json.dumps({"access_token": "s" * 1000})

    result = truncate_body(body, max_bytes=50)

    assert result["truncated"] is False  # redacted body is tiny, well under the cap
    assert "s" * 1000 not in result["text"]
    assert "[redacted]" in result["text"]
