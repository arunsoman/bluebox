"""Decision Ledger, Audit Trail, and Checkpoint domain models.

doc/prd.md SS15.1 lists `DecisionLedger`, `AuditTrail`, and
`CheckpointManager` under "Cross-Cutting Services" in the architecture
diagram - not owned by any single bounded-context module - so they live in
shared_kernel alongside `Node` and `RBACModel`.

`Checkpoint.current_state` is typed `str`, not
`core_pipeline.domain.state_machine.PipelineState`: shared_kernel must not
depend on a leaf module (same rule that moved `RiskClassification` out of
`state_machine.py` in pass 3).
"""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class ProvenanceChain(BaseModel):
    """doc/api_event_contract.md SS4.9 `ProvenanceChain`."""

    model_config = ConfigDict(extra="forbid")

    previous_entry_id: str | None = None
    parent_decision_id: str | None = None
    trigger_event: str
    context_snapshot_id: str


class DecisionEntryMetadata(BaseModel):
    model_config = ConfigDict(extra="forbid")

    layer: str
    risk_classification: str
    auto_approved: bool
    trust_mode_at_decision: str


class DecisionEntry(BaseModel):
    """doc/api_event_contract.md SS4.9 `DecisionEntry`."""

    model_config = ConfigDict(extra="forbid")

    entry_id: str
    decision_type: Literal["steering", "system_authorized", "user_override", "revision", "revert"]
    stage: int
    stage_name: str
    summary: str
    status: Literal["active", "superseded", "cancelled"] = "active"
    payload: Any = None
    provenance: ProvenanceChain
    metadata: DecisionEntryMetadata
    created_at: datetime = Field(default_factory=datetime.now)
    created_by: str
    superseded_by: str | None = None
    revision_chain: list[str] = Field(default_factory=list)


class AuditActor(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: str
    role: str


class AuditTarget(BaseModel):
    model_config = ConfigDict(extra="forbid")

    target_type: str
    target_id: str


class AuditEvent(BaseModel):
    """doc/api_event_contract.md SS4.9 `AuditEvent`. Tiered storage
    (`DIFF`/`FULL`/`REFERENCE` budget switching, doc/prd.md SS4.7) is not
    implemented in this pass - `storage_tier` is recorded but every event is
    kept in full, in memory."""

    model_config = ConfigDict(extra="forbid")

    event_id: str
    timestamp: datetime = Field(default_factory=datetime.now)
    session_id: str
    actor: AuditActor
    action: str
    stage: int | None = None
    target: AuditTarget
    description: str
    before_state: Any = None
    after_state: Any = None
    diff: Any = None
    authorization_ref: str | None = None
    storage_tier: Literal["DIFF", "FULL", "REFERENCE"] = "FULL"


class Checkpoint(BaseModel):
    """doc/api_event_contract.md SS7.1 `Checkpoint`. `workspace_snapshot`
    is omitted - this pass's `WorkspaceManager` writes directly to disk
    rather than versioned snapshots (see code_generation/application)."""

    model_config = ConfigDict(extra="forbid")

    checkpoint_id: str
    stage: int
    stage_name: str
    label: str
    current_state: str
    decision_ledger_snapshot: list[DecisionEntry]
    created_at: datetime = Field(default_factory=datetime.now)
    created_by: str
