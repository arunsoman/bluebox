"""doc/api_event_contract.md SS7.0 Audit Trail."""

from fastapi import APIRouter

from bluebox.shared_kernel.domain.audit import AuditEvent
from bluebox.shared_kernel.infrastructure.in_memory import app_state

router = APIRouter(prefix="/api/v1/projects/{project_id}/audit", tags=["audit"])


@router.get("", response_model=list[AuditEvent])
def get_audit_trail(project_id: str) -> list[AuditEvent]:
    return app_state.audit.list(project_id)
