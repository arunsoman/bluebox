"""doc/api_event_contract.md SS7.0 Decision Ledger.

`POST /ledger/revision` and `POST /ledger/revert` are not implemented: both
need a real `RevisionEngine` (impact analysis, regeneration-vs-edit
conflict resolution) that is out of this pass's scope (see the plan's
explicit scope boundaries) - only the read endpoints are wired.
"""

from pydantic import BaseModel, ConfigDict

from fastapi import APIRouter, HTTPException

from bluebox.shared_kernel.domain.audit import DecisionEntry
from bluebox.shared_kernel.infrastructure.in_memory import app_state

router = APIRouter(prefix="/api/v1/projects/{project_id}/ledger", tags=["ledger"])

# doc/prd.md AC-DL-04: "Each decision point shall have a RevisionBudget
# (default 5)." The RevisionBudgetManager that would track consumption is a
# v3 ADD, not built this pass (see module docstring) - revision/revert are
# both unimplemented, so nothing ever spends the budget yet, and `remaining`
# is always the same as `total`.
_REVISION_BUDGET_TOTAL = 5


class DecisionLedger(BaseModel):
    """doc/api_event_contract.md SS4.9 `DecisionLedger` - the `GET /ledger`
    response. Previously this endpoint returned a bare `list[DecisionEntry]`,
    which the frontend's `DecisionLedger` type (an object wrapping `entries`)
    doesn't match - `AuditPanel.tsx` reading `ledger.entries` off a JS array
    silently got `Array.prototype.entries` (the built-in iterator method)
    instead of `undefined`, so the `?? []` fallback never kicked in and the
    next line's `.find()` crashed on a function instead of an array."""

    model_config = ConfigDict(extra="forbid")

    entries: list[DecisionEntry]
    total_count: int
    revision_budget_remaining: int
    revision_budget_total: int


@router.get("", response_model=DecisionLedger)
def get_ledger(project_id: str) -> DecisionLedger:
    entries = app_state.decisions.list(project_id)
    return DecisionLedger(
        entries=entries,
        total_count=len(entries),
        revision_budget_remaining=_REVISION_BUDGET_TOTAL,
        revision_budget_total=_REVISION_BUDGET_TOTAL,
    )


@router.get("/{entry_id}", response_model=DecisionEntry)
def get_ledger_entry(project_id: str, entry_id: str) -> DecisionEntry:
    entry = app_state.decisions.get(project_id, entry_id)
    if entry is None:
        raise HTTPException(404, detail=f"decision entry {entry_id!r} not found")
    return entry
