"""doc/api_event_contract.md SS7.0 Decision Ledger.

`POST /ledger/revision` and `POST /ledger/revert` are not implemented: both
need a real `RevisionEngine` (impact analysis, regeneration-vs-edit
conflict resolution) that is out of this pass's scope (see the plan's
explicit scope boundaries) - only the read endpoints are wired.
"""

from fastapi import APIRouter, HTTPException

from bluebox.shared_kernel.domain.audit import DecisionEntry
from bluebox.shared_kernel.infrastructure.in_memory import app_state

router = APIRouter(prefix="/api/v1/projects/{project_id}/ledger", tags=["ledger"])


@router.get("", response_model=list[DecisionEntry])
def get_ledger(project_id: str) -> list[DecisionEntry]:
    return app_state.decisions.list(project_id)


@router.get("/{entry_id}", response_model=DecisionEntry)
def get_ledger_entry(project_id: str, entry_id: str) -> DecisionEntry:
    entry = app_state.decisions.get(project_id, entry_id)
    if entry is None:
        raise HTTPException(404, detail=f"decision entry {entry_id!r} not found")
    return entry
