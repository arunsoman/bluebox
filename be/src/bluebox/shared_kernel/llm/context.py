"""Request-local context for AI provider/model selection.

This module holds contextvars that are set by the HTTP middleware in
`interfaces.api.app` based on headers from the frontend (X-AI-Provider,
X-AI-Model). The LLM connector reads these to dynamically select the
provider/model for each request.
"""

from contextvars import ContextVar

# Per-request context variables for AI provider/model selection.
# These are None by default; if set, they override BLUEBOX_LLM_MODEL.
active_provider: ContextVar[str | None] = ContextVar("active_provider", default=None)
active_model: ContextVar[str | None] = ContextVar("active_model", default=None)