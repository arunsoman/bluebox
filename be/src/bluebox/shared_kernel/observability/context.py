"""Request-local context for the log viewer - mirrors
`shared_kernel/llm/context.py`'s `active_provider`/`active_model` exactly
(same ContextVar mechanism, same reason: code several layers deep -
`connector.py`'s `run_structured` - needs to know which project/trace an
LLM call belongs to without every intermediate function threading extra
parameters through its signature).

Set by `interfaces/api/app.py`'s REST logging middleware (from the URL path
and the `X-Debug-Trace-Id` header) and read wherever a `LogEvent` is
published.
"""

from contextvars import ContextVar

current_project_id: ContextVar[str | None] = ContextVar("current_project_id", default=None)
current_trace_id: ContextVar[str | None] = ContextVar("current_trace_id", default=None)
