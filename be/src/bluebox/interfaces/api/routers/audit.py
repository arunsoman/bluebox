"""doc/api_event_contract.md SS7.0 Audit Trail."""

from pydantic import BaseModel, ConfigDict

from fastapi import APIRouter

from bluebox.shared_kernel.domain.audit import AuditEvent
from bluebox.shared_kernel.infrastructure.in_memory import app_state

router = APIRouter(prefix="/api/v1/projects/{project_id}/audit", tags=["audit"])

# doc/prd.md AC-AT-07: "tiered storage ... with a default retention of 90
# days and a default storage budget of 100MB per session." Tiered
# DIFF/FULL/REFERENCE switching itself isn't implemented (every event is
# kept FULL in memory, per `AuditEvent`'s docstring) - only the budget/
# retention constants the contract's `AuditTrail` shape requires.
_STORAGE_BUDGET_BYTES = 100 * 1024 * 1024
_RETENTION_DAYS = 90


class AuditTrail(BaseModel):
    """doc/api_event_contract.md SS4.9 `AuditTrail` - the `GET /audit`
    response. Previously a bare `list[AuditEvent]`, which doesn't match the
    frontend's `AuditTrail` object type (same class of bug as `ledger.py`'s
    `DecisionLedger` wrapper - see that module for the crash this caused)."""

    model_config = ConfigDict(extra="forbid")

    events: list[AuditEvent]
    total_count: int
    storage_used_bytes: int
    storage_budget_bytes: int
    retention_days: int


@router.get("", response_model=AuditTrail)
def get_audit_trail(project_id: str) -> AuditTrail:
    events = app_state.audit.list(project_id)
    storage_used_bytes = sum(len(event.model_dump_json().encode()) for event in events)
    return AuditTrail(
        events=events,
        total_count=len(events),
        storage_used_bytes=storage_used_bytes,
        storage_budget_bytes=_STORAGE_BUDGET_BYTES,
        retention_days=_RETENTION_DAYS,
    )
