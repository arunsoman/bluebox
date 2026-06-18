"""Domain models for the Collaborative Steering Pipeline.

This module contains the core domain models used throughout the application:
- Extraction models (from PRD text): ExtractedActor, ExtractedCapability, etc.
- Domain models (rich application state): Actor, Capability, UseCase, UserStory, EngineeringTask
- GraphNode: Hierarchical visualization model for frontend
- ProjectBlueprint: Final assembled artifact
- Decision/audit models for governance
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Literal, Optional
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Node States
# ---------------------------------------------------------------------------


class NodeState(str, Enum):
    EXTRACTED = "extracted"
    SYSTEM_GENERATED = "system_generated"
    USER_ENRICHED = "user_enriched"
    USER_DEFINED = "user_defined"
    SUPERSEDED = "superseded"
    INFERRED = "inferred"
    DEFERRED = "deferred"
    ORPHANED = "orphaned"


# ---------------------------------------------------------------------------
# Section Types (for PRD extraction)
# ---------------------------------------------------------------------------


class SectionType(str, Enum):
    """Known PRD section types."""

    PREAMBLE = "_preamble"
    OVERVIEW = "overview"
    ACTORS = "actors"
    FEATURES = "features"
    USE_CASES = "use_cases"
    USER_STORIES = "user_stories"
    NON_FUNCTIONAL = "non_functional"
    ARCHITECTURE = "architecture"
    API = "api"
    DATA = "data"
    SECURITY = "security"
    UI_UX = "ui_ux"
    OUT_OF_SCOPE = "out_of_scope"


# ---------------------------------------------------------------------------
# Extraction Models (LLM output schema - optimized for extraction)
# ---------------------------------------------------------------------------


def _slug_id(prefix: str, name: str) -> str:
    """Create a stable slug ID from a human-readable name."""
    import re

    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    slug = re.sub(r"-+", "-", slug)[:40]
    return f"{prefix}-{slug}" if slug else f"{prefix}-unknown"


class ExtractedActor(BaseModel):
    """An actor / user role extracted from a PRD."""

    id: str = Field(default="", description="Stable identifier (e.g. actor-admin)")
    name: str = ""
    description: str = ""
    actor_type: str = "human"  # human, system, external
    role: str = ""
    responsibilities: list[str] = Field(default_factory=list)

    def model_post_init(self, __context: object) -> None:
        if not self.id:
            self.id = _slug_id("actor", self.name)


class ExtractedCapability(BaseModel):
    """A capability / feature extracted from a PRD."""

    id: str = Field(default="", description="Stable identifier (e.g. cap-user-mgmt)")
    name: str = ""
    description: str = ""
    actor_names: list[str] = Field(default_factory=list)
    actor_ids: list[str] = Field(
        default_factory=list,
        description="Resolved actor IDs after cross-chunk merge",
    )
    features: list[str] = Field(default_factory=list)

    def model_post_init(self, __context: object) -> None:
        if not self.id:
            self.id = _slug_id("cap", self.name)


class ExtractedUseCase(BaseModel):
    """A use case / workflow extracted from a PRD."""

    id: str = Field(default="", description="Stable identifier (e.g. uc-login)")
    name: str = ""
    description: str = ""
    preconditions: list[str] = Field(default_factory=list)
    postconditions: list[str] = Field(default_factory=list)
    main_flow: list[str] = Field(default_factory=list)
    actor_names: list[str] = Field(default_factory=list)
    actor_ids: list[str] = Field(
        default_factory=list,
        description="Resolved actor IDs after cross-chunk merge",
    )
    capability_names: list[str] = Field(default_factory=list)
    capability_ids: list[str] = Field(
        default_factory=list,
        description="Resolved capability IDs after cross-chunk merge",
    )

    def model_post_init(self, __context: object) -> None:
        if not self.id:
            self.id = _slug_id("uc", self.name)


class ExtractedUserStory(BaseModel):
    """A user story extracted from a PRD."""

    id: str = Field(default="", description="Stable identifier (e.g. us-login-2fa)")
    title: str = ""
    description: str = ""
    acceptance_criteria: list[str] = Field(default_factory=list)
    entities: list[dict] = Field(default_factory=list)
    external_interfaces: list[dict] = Field(default_factory=list)
    actor_name: str = ""
    actor_id: str = Field(
        default="",
        description="Resolved actor ID after cross-chunk merge",
    )
    priority: str = "medium"
    use_case_name: str = ""
    use_case_id: str = Field(
        default="",
        description="Resolved use-case ID after cross-chunk merge",
    )

    def model_post_init(self, __context: object) -> None:
        if not self.id:
            self.id = _slug_id("us", self.title)


class ChunkResult(BaseModel):
    """Structured extraction output for a single chunk."""

    project_name: str = ""
    problem_statement: str = ""
    overview: str = ""
    actors: list[ExtractedActor] = Field(default_factory=list)
    capabilities: list[ExtractedCapability] = Field(default_factory=list)
    use_cases: list[ExtractedUseCase] = Field(default_factory=list)
    user_stories: list[ExtractedUserStory] = Field(default_factory=list)
    non_functional_requirements: list[str] = Field(default_factory=list)
    architecture_hints: list[str] = Field(default_factory=list)
    api_hints: list[str] = Field(default_factory=list)
    data_model_hints: list[str] = Field(default_factory=list)
    security_hints: list[str] = Field(default_factory=list)
    ui_ux_hints: list[str] = Field(default_factory=list)
    out_of_scope: list[str] = Field(default_factory=list)
    thin_statements: list[str] = Field(default_factory=list)
    conflicting_statements: list[str] = Field(default_factory=list)

    # Diagnostics
    sections_in_chunk: list[SectionType] = Field(default_factory=list)
    used_llm: bool = False
    llm_error: Optional[str] = None


class ExtractedPRD(BaseModel):
    """Complete structured extraction from a PRD document."""

    project_name: str = ""
    problem_statement: str = ""
    overview: str = ""
    actors: list[ExtractedActor] = Field(default_factory=list)
    capabilities: list[ExtractedCapability] = Field(default_factory=list)
    use_cases: list[ExtractedUseCase] = Field(default_factory=list)
    user_stories: list[ExtractedUserStory] = Field(default_factory=list)
    non_functional_requirements: list[str] = Field(default_factory=list)
    architecture_hints: list[str] = Field(default_factory=list)
    api_hints: list[str] = Field(default_factory=list)
    data_model_hints: list[str] = Field(default_factory=list)
    security_hints: list[str] = Field(default_factory=list)
    ui_ux_hints: list[str] = Field(default_factory=list)
    out_of_scope: list[str] = Field(default_factory=list)
    thin_statements: list[str] = Field(default_factory=list)
    conflicting_statements: list[str] = Field(default_factory=list)

    # Metadata
    word_count: int = 0
    has_structure: bool = False
    explicit_sections_found: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Domain Models (Rich application state with timestamps and relationships)
# ---------------------------------------------------------------------------


class Actor(BaseModel):
    """Domain model for an actor in the project blueprint."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    description: str
    type: Literal["human", "system", "external"]
    state: NodeState = NodeState.SYSTEM_GENERATED
    parent_ids: list[str] = Field(default_factory=list)
    capabilities: list[Capability] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    def to_graph_node(self) -> dict:
        """Convert to graph node format for frontend visualization."""
        return {
            "id": self.id,
            "type": "actor",
            "label": self.name,
            "description": self.description,
            "state": self.state.value,
            "children": [c.to_graph_node() for c in self.capabilities],
        }


class Capability(BaseModel):
    """Domain model for a capability in the project blueprint."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    description: str
    actor_ids: list[str] = Field(default_factory=list)
    state: NodeState = NodeState.SYSTEM_GENERATED
    use_cases: list[UseCase] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    def to_graph_node(self) -> dict:
        """Convert to graph node format for frontend visualization."""
        return {
            "id": self.id,
            "type": "capability",
            "label": self.name,
            "description": self.description,
            "state": self.state.value,
            "children": [u.to_graph_node() for u in self.use_cases],
        }


class UseCase(BaseModel):
    """Domain model for a use case in the project blueprint."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    description: str
    capability_ids: list[str] = Field(default_factory=list)
    actor_ids: list[str] = Field(default_factory=list)
    state: NodeState = NodeState.SYSTEM_GENERATED
    user_stories: list[UserStory] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    def to_graph_node(self) -> dict:
        """Convert to graph node format for frontend visualization."""
        return {
            "id": self.id,
            "type": "use_case",
            "label": self.name,
            "description": self.description,
            "state": self.state.value,
            "children": [s.to_graph_node() for s in self.user_stories],
        }


class UserStory(BaseModel):
    """Domain model for a user story in the project blueprint."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    title: str
    description: str
    acceptance_criteria: list[str] = Field(default_factory=list)
    entities: list[dict[str, Any]] = Field(default_factory=list)
    external_interfaces: list[dict[str, Any]] = Field(default_factory=list)
    use_case_ids: list[str] = Field(default_factory=list)
    actor_ids: list[str] = Field(default_factory=list)
    state: NodeState = NodeState.SYSTEM_GENERATED
    points: int | None = None
    tasks: list[EngineeringTask] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    def to_graph_node(self) -> dict:
        """Convert to graph node format for frontend visualization."""
        return {
            "id": self.id,
            "type": "user_story",
            "label": self.title,
            "description": self.description,
            "state": self.state.value,
            "children": [t.to_graph_node() for t in self.tasks],
        }


class EngineeringTask(BaseModel):
    """Domain model for an engineering task in the project blueprint."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    title: str
    description: str
    story_ids: list[str] = Field(default_factory=list)
    estimated_hours: float | None = None
    dependencies: list[str] = Field(default_factory=list)
    access_guards: list[str] = Field(default_factory=list)
    task_type: str = "general"
    contract: dict[str, Any] = Field(default_factory=dict)
    state: NodeState = NodeState.SYSTEM_GENERATED
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    @field_validator("dependencies", mode="before")
    @classmethod
    def _coerce_dependencies(cls, v):
        if not isinstance(v, list):
            return []
        return [str(x) if x is not None else "" for x in v if x is not None]

    @field_validator("contract", mode="before")
    @classmethod
    def _coerce_contract(cls, v):
        if not isinstance(v, dict):
            return {}
        for key in ("pre", "post", "inv", "frame"):
            val = v.get(key)
            if val is None:
                v[key] = []
            elif not isinstance(val, list):
                v[key] = [str(val)]
            else:
                v[key] = [str(x) for x in val]
        return v

    def to_graph_node(self) -> dict:
        """Convert to graph node format for frontend visualization."""
        return {
            "id": self.id,
            "type": "task",
            "label": self.title,
            "description": self.description,
            "state": self.state.value,
            "task_type": self.task_type,
            "contract": self.contract,
            "estimated_hours": self.estimated_hours,
        }


# Forward references need to be updated after class definitions
Actor.model_rebuild()
Capability.model_rebuild()
UseCase.model_rebuild()
UserStory.model_rebuild()


# ---------------------------------------------------------------------------
# GraphNode - Hierarchical visualization model
# ---------------------------------------------------------------------------


class GraphNode(BaseModel):
    """Hierarchical node structure for frontend graph visualization.

    This model converts the flat extraction output into a tree structure
    suitable for D3/ReactFlow visualization. Used in Phase 2 for
    interactive blueprint editing.
    """

    id: str = Field(default_factory=lambda: str(uuid4()))
    type: str  # seed, actor, capability, use_case, user_story, task
    state: NodeState = NodeState.SYSTEM_GENERATED
    label: str = ""
    description: str = ""
    children: list[GraphNode] = Field(default_factory=list)

    # Optional references to domain objects
    actor: Optional[Actor] = None
    capability: Optional[Capability] = None
    use_case: Optional[UseCase] = None
    user_story: Optional[UserStory] = None
    task: Optional[EngineeringTask] = None

    @classmethod
    def from_extracted_prd(cls, extracted: ExtractedPRD) -> "GraphNode":
        """Convert ExtractedPRD to GraphNode hierarchy.

        Builds the tree: seed -> actors -> capabilities -> use_cases -> user_stories
        """
        # Build lookups for cross-referencing
        actors_by_id: dict[str, ExtractedActor] = {a.id: a for a in extracted.actors}
        caps_by_id: dict[str, ExtractedCapability] = {c.id: c for c in extracted.capabilities}
        ucs_by_id: dict[str, ExtractedUseCase] = {u.id: u for u in extracted.use_cases}

        # Build the hierarchy bottom-up
        root = cls(type="seed", state=NodeState.EXTRACTED, label="Project Root")

        # Convert actors to domain and build hierarchy
        for extracted_actor in extracted.actors:
            actor = Actor(
                id=extracted_actor.id,
                name=extracted_actor.name,
                description=extracted_actor.description,
                type=extracted_actor.actor_type if extracted_actor.actor_type in ("human", "system", "external") else "human",
                state=NodeState.EXTRACTED,
            )

            actor_node = GraphNode(
                id=actor.id,
                type="actor",
                state=actor.state,
                label=actor.name,
                description=actor.description,
                actor=actor,
            )

            # Find capabilities for this actor
            for extracted_cap in extracted.capabilities:
                if extracted_actor.id in extracted_cap.actor_ids:
                    cap = Capability(
                        id=extracted_cap.id,
                        name=extracted_cap.name,
                        description=extracted_cap.description,
                        actor_ids=extracted_cap.actor_ids,
                        state=NodeState.EXTRACTED,
                    )

                    cap_node = GraphNode(
                        id=cap.id,
                        type="capability",
                        state=cap.state,
                        label=cap.name,
                        description=cap.description,
                        capability=cap,
                    )

                    # Find use cases for this capability
                    for extracted_uc in extracted.use_cases:
                        if extracted_cap.id in extracted_uc.capability_ids:
                            uc = UseCase(
                                id=extracted_uc.id,
                                name=extracted_uc.name,
                                description=extracted_uc.description,
                                capability_ids=extracted_uc.capability_ids,
                                actor_ids=extracted_uc.actor_ids,
                                state=NodeState.EXTRACTED,
                            )

                            uc_node = GraphNode(
                                id=uc.id,
                                type="use_case",
                                state=uc.state,
                                label=uc.name,
                                description=uc.description,
                                use_case=uc,
                            )

                            # Find user stories for this use case
                            for extracted_story in extracted.user_stories:
                                if extracted_uc.id == extracted_story.use_case_id:
                                    story = UserStory(
                                        id=extracted_story.id,
                                        title=extracted_story.title,
                                        description=extracted_story.description,
                                        acceptance_criteria=extracted_story.acceptance_criteria,
                                        use_case_ids=[extracted_story.use_case_id],
                                        actor_ids=[extracted_story.actor_id] if extracted_story.actor_id else [],
                                        state=NodeState.EXTRACTED,
                                    )

                                    story_node = GraphNode(
                                        id=story.id,
                                        type="user_story",
                                        state=story.state,
                                        label=story.title,
                                        description=story.description,
                                        user_story=story,
                                    )

                                    uc_node.children.append(story_node)

                            cap_node.children.append(uc_node)

                    actor_node.children.append(cap_node)

            root.children.append(actor_node)

        return root


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
    """Final assembled project blueprint artifact."""

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

    def to_graph_node(self) -> GraphNode:
        """Convert blueprint to GraphNode hierarchy for visualization."""
        root = GraphNode(type="seed", state=NodeState.EXTRACTED, label=self.project_name or "Project")

        # Build actor hierarchy
        for actor in self.actors:
            actor_node = GraphNode(
                id=actor.id,
                type="actor",
                state=actor.state,
                label=actor.name,
                description=actor.description,
                actor=actor,
            )

            # Find capabilities for this actor
            for cap in self.capabilities:
                if actor.id in cap.actor_ids:
                    cap_node = GraphNode(
                        id=cap.id,
                        type="capability",
                        state=cap.state,
                        label=cap.name,
                        description=cap.description,
                        capability=cap,
                    )

                    # Find use cases for this capability
                    for uc in self.use_cases:
                        if cap.id in uc.capability_ids:
                            uc_node = GraphNode(
                                id=uc.id,
                                type="use_case",
                                state=uc.state,
                                label=uc.name,
                                description=uc.description,
                                use_case=uc,
                            )

                            # Find user stories for this use case
                            for story in self.user_stories:
                                if uc.id in story.use_case_ids:
                                    story_node = GraphNode(
                                        id=story.id,
                                        type="user_story",
                                        state=story.state,
                                        label=story.title,
                                        description=story.description,
                                        user_story=story,
                                    )

                                    # Find tasks for this story
                                    for task in self.task_decomposition:
                                        if story.id in task.story_ids:
                                            task_node = GraphNode(
                                                id=task.id,
                                                type="task",
                                                state=task.state,
                                                label=task.title,
                                                description=task.description,
                                                task=task,
                                            )
                                            story_node.children.append(task_node)

                                    uc_node.children.append(story_node)

                            cap_node.children.append(uc_node)

                    actor_node.children.append(cap_node)

            root.children.append(actor_node)

        return root


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