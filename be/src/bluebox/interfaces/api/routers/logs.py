"""Log viewer history - not part of doc/api_event_contract.md (the spec
predates this feature, same precedent as `llm_config.py`). Backs the Log
Viewer modal's (Ctrl+Shift+L) initial load; live updates after that arrive
over the project's steering WebSocket via `LOG_EVENT` frames
(`interfaces/ws/connection_registry.py`).
"""

from fastapi import APIRouter

from bluebox.shared_kernel.observability.log_bus import log_bus
from bluebox.shared_kernel.observability.log_event import LogEvent

router = APIRouter(prefix="/api/v1/projects/{project_id}/logs", tags=["logs"])


@router.get("", response_model=list[LogEvent])
def get_logs(project_id: str) -> list[LogEvent]:
    return log_bus.list(project_id)
