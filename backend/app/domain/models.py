"""Domain models for the Collaborative Steering Pipeline."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, Field


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Node States
# ---------------------------------------------------------------------------


class NodeState(str, Enum):
    SYSTEM_GENERATED = "system_generated"
    USER_ENRICHED = "user_enriched"
    USER_DEFINED = "user_defined"
    SUPERSEDED = "superseded"
    INFERRED = "inferred"
    DEFERRED = "deferred"
    ORPHANED = "orphaned"


# ---------------------------------------------------------------------------
# Core Node Types
# ---------------------------------------------------------------------------


class Actor(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    description: str
    type: Literal["human", "system", "external"]
    state: NodeState = NodeState.SYSTEM_GENERATED
    parent_ids: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class Capability(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    description: str
    actor_ids: list[str] = Field(default_factory=list)  # FK to actors
    state: NodeState = NodeState.SYSTEM_GENERATED
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class UseCase(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    description: str
    capability_ids: list[str] = Field(default_factory=list)
    actor_ids: list[str] = Field(default_factory=list)
    state: NodeState = NodeState.SYSTEM_GENERATED
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class UserStory(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    title: str
    description: str
    acceptance_criteria: list[str] = Field(default_factory=list)
    use_case_ids: list[str] = Field(default_factory=list)
    actor_ids: list[str] = Field(default_factory=list)
    state: NodeState = NodeState.SYSTEM_GENERATED
    points: int | None = None
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class EngineeringTask(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    title: str
    description: str
    story_ids: list[str] = Field(default_factory=list)
    estimated_hours: float | None = None
    dependencies: list[str] = Field(default_factory=list)
    access_guards: list[str] = Field(default_factory=list)
    state: NodeState = NodeState.SYSTEM_GENERATED
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


# ---------------------------------------------------------------------------
# Infrastructure & RBAC
# ---------------------------------------------------------------------------


class ScaleTier(str, Enum):
    SMALL = "small"
    MEDIUM = "medium"
    LARGE = "large"


class HostingOption(BaseModel):
    name: str
    provider: str
    cost_range: str
    cost_basis: str
    assumptions: list[str] = Field(default_factory=list)
    exclusions: list[str] = Field(default_factory=list)
    scale_fit: str  # "good" | "fair" | "poor"


class InfrastructureProfile(BaseModel):
    tier: ScaleTier | None = None
    hosting_options: list[HostingOption] = Field(default_factory=list)
    committed_option: HostingOption | None = None
    is_stale: bool = False


class TechComponent(BaseModel):
    category: str  # frontend, backend, database, cache, queue, etc.
    technology: str
    version: str | None = None
    justification: str = ""


class TechStackProfile(BaseModel):
    components: list[TechComponent] = Field(default_factory=list)
    actor_compatibility: dict[str, str] = Field(default_factory=dict)
    scale_fit: str = ""
    learning_curve: str = ""


class RBACRole(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    permissions: list[str] = Field(default_factory=list)
    parent_role_ids: list[str] = Field(default_factory=list)
    actor_ids: list[str] = Field(default_factory=list)
    depth: int = 0  # computed


class RBACModel(BaseModel):
    roles: list[RBACRole] = Field(default_factory=list)
    max_inheritance_depth: int = 3
    has_cycles: bool = False
    escalation_paths: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Streaming
# ---------------------------------------------------------------------------


class StreamChunk(BaseModel):
    chunk_id: str = Field(default_factory=lambda: str(uuid4()))
    stage_id: int
    node_type: str  # actor, capability, use_case, story, task, seed, concept, etc.
    node_data: dict  # serialized node
    index_in_stage: int
    total_in_stage: int | None = None
    timestamp: datetime = Field(default_factory=utcnow)


# ---------------------------------------------------------------------------
# Project Blueprint Artifact
# ---------------------------------------------------------------------------


class DeferredArtifact(BaseModel):
    field_name: str
    reason: str
    deferred_at: datetime = Field(default_factory=utcnow)


class CompletenessReport(BaseModel):
    total_fields: int
    filled_fields: int
    deferred_fields: list[str] = Field(default_factory=list)
    missing_mandatory: list[str] = Field(default_factory=list)
    is_complete: bool


class ProjectBlueprint(BaseModel):
    project_id: str = Field(default_factory=lambda: str(uuid4()))
    project_name: str = ""
    problem_statement: str = ""
    actors: list[Actor] = Field(default_factory=list)
    capabilities: list[Capability] = Field(default_factory=list)
    use_cases: list[UseCase] = Field(default_factory=list)
    user_stories: list[UserStory] = Field(default_factory=list)
    tech_stack_profile: TechStackProfile | DeferredArtifact | None = None
    infrastructure_profile: InfrastructureProfile | DeferredArtifact | None = None
    rbac_model: RBACModel | DeferredArtifact | None = None
    task_decomposition: list[EngineeringTask] = Field(default_factory=list)
    custom_annotations: list[dict] = Field(default_factory=list)
    decision_ledger_summary: dict = Field(default_factory=dict)
    completeness_status: Literal["complete", "deferred", "incomplete"] = "incomplete"
    completeness_report: CompletenessReport | None = None
    created_at: datetime = Field(default_factory=utcnow)
    version: int = 1


# ---------------------------------------------------------------------------
# Decision Ledger
# ---------------------------------------------------------------------------


class DecisionEntry(BaseModel):
    entry_id: str = Field(default_factory=lambda: str(uuid4()))
    project_id: str
    stage_id: int
    action: str  # accept, modify, replace, add, edit, remove, defer
    node_id: str | None = None
    node_type: str | None = None
    user_id: str
    old_value: dict | None = None
    new_value: dict | None = None
    reason: str = ""
    timestamp: datetime = Field(default_factory=utcnow)


class DecisionLedger(BaseModel):
    project_id: str
    entries: list[DecisionEntry] = Field(default_factory=list)
    revision_count: int = 0
    budget_remaining: int = 5  # default cap
    created_at: datetime = Field(default_factory=utcnow)


# ---------------------------------------------------------------------------
# Governance
# ---------------------------------------------------------------------------


class CRUDNodeAction(str, Enum):
    ENRICH = "enrich"
    ADD = "add"
    EDIT = "edit"
    REMOVE = "remove"
    DEACTIVATE = "deactivate"
    RESTORE = "restore"


class ProposedChange(BaseModel):
    change_id: str
    action: str
    node_type: str
    node_id: str | None = None
    node_data: dict = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=utcnow)


class ImpactReport(BaseModel):
    report_id: str = Field(default_factory=lambda: str(uuid4()))
    proposed_change: ProposedChange
    directly_affected: list[str]
    transitively_affected: list[str]
    upstream_affected: list[str]
    stages_to_rerun: list[int]
    estimated_rework_time_ms: int
    generated_at: datetime = Field(default_factory=utcnow)
