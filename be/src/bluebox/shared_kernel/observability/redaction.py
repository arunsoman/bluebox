"""Redaction/truncation policy shared by every log capture point (REST
middleware, httpx request/response hooks) - lives in one place so the
policy can't silently drift between them.

Redaction happens before a `LogEvent` is ever constructed, not at display
time - an unredacted secret must never exist in `log_bus`'s ring buffer,
even transiently. Two layers, both required: header-level (provider API
keys, our own JWT in `Authorization`) and body-level (a JSON response body
can carry a secret directly as a field value - e.g. `/api/v1/auth/login`'s
own `access_token`/`refresh_token` - a header blocklist alone misses this
entirely). `truncate_body` always redacts before truncating: truncating
first could leave a half-cut secret in the visible portion.
"""

import json
from collections.abc import Mapping
from typing import Any

# Case-insensitive. Covers provider API key headers (Anthropic's
# `x-api-key`, Google's `x-goog-api-key`, OpenAI-compatible `Authorization:
# Bearer ...`) and our own frontend JWT (`Authorization`).
_SENSITIVE_HEADERS = frozenset(
    {"authorization", "x-api-key", "x-goog-api-key", "api-key", "x-auth-token", "cookie", "set-cookie"}
)

# Case-insensitive JSON object keys, anywhere in a body (e.g. auth
# responses' access_token/refresh_token, a request body's password).
_SENSITIVE_BODY_FIELDS = frozenset(
    {"access_token", "refresh_token", "password", "api_key", "apikey", "secret", "token", "client_secret"}
)

MAX_BODY_BYTES = 32 * 1024


def redact_headers(headers: Mapping[str, str]) -> dict[str, str]:
    return {k: ("[redacted]" if k.lower() in _SENSITIVE_HEADERS else v) for k, v in headers.items()}


def _redact_value(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            k: ("[redacted]" if k.lower() in _SENSITIVE_BODY_FIELDS else _redact_value(v))
            for k, v in value.items()
        }
    if isinstance(value, list):
        return [_redact_value(v) for v in value]
    return value


def redact_json_body(text: str) -> str:
    """No-op for non-JSON bodies (LLM prompts are often plain text) -
    returned unchanged rather than raising, since this runs on arbitrary
    request/response bodies."""

    try:
        parsed = json.loads(text)
    except (ValueError, TypeError):
        return text
    return json.dumps(_redact_value(parsed))


def truncate_body(body: bytes | str | None, max_bytes: int = MAX_BODY_BYTES) -> dict[str, Any]:
    """Returns a dict ready to embed directly into a `LogEvent.detail` field."""

    if body is None or body == b"":
        return {"text": None, "truncated": False, "original_size_bytes": 0}

    text = body.decode("utf-8", errors="replace") if isinstance(body, bytes) else body
    text = redact_json_body(text)
    raw = text.encode("utf-8", errors="replace")

    original_size = len(raw)
    if original_size <= max_bytes:
        return {"text": text, "truncated": False, "original_size_bytes": original_size}
    return {
        "text": raw[:max_bytes].decode("utf-8", errors="replace"),
        "truncated": True,
        "original_size_bytes": original_size,
    }
