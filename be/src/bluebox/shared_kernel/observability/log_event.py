"""The log viewer's event shape - not in doc/api_event_contract.md (the
spec predates this feature, same precedent as `llm_config.py`). Backs the
Ctrl+Shift+L "Log Viewer" popup: every REST call, WS message, and outbound
LLM/httpx call this stack makes, logged from both sides of each "wire
crossing" as distinct rows (see `shared_kernel/observability/log_bus.py`
module docstring for why) rather than one merged row.
"""

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

LogCategory = Literal[
    "http_sent_by_client",
    "http_received_by_backend",
    "ws_sent_by_client",
    "ws_received_by_backend",
    "ws_sent_by_backend",
    "ws_received_by_client",
    "llm_call",
]

# Sentinel project_id for calls with no project in scope (login, project list).
GLOBAL_PROJECT_ID = "_global"


class LogEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    log_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    project_id: str
    trace_id: str | None = None
    timestamp: datetime = Field(default_factory=datetime.now)
    duration_ms: float | None = None
    category: LogCategory
    summary: str
    detail: dict[str, Any] = {}
