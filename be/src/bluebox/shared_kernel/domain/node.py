"""The Node entity hierarchy - doc/api_event_contract.md SS5.1-SS5.4.

Owned by shared_kernel, not any one module: core_pipeline generates
candidates that become Nodes, governance mutates committed Nodes, the
(future) graph module traverses them, code_generation reads them,
chat/audit reference them - no single module owns the concept.

Value objects here (`UseCaseStep`, `AlternativeFlow`, `AcceptanceCriterion`,
`AccessGuard`) are deliberately NOT imported from any module's
`llm/responses.py`, even though the shapes are identical. Those are the LLM
contract/anti-corruption boundary; domain entities are the inner layer and
must not depend on it. Duplication here is the textbook anti-corruption
layer pattern, not an oversight - a future application-layer translator
maps an LLM candidate onto the matching Node subtype.
"""

from datetime import datetime
from typing import Annotated, Literal, Self, Union

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter

from bluebox.shared_kernel.domain.risk import RiskClassification

# doc/api_event_contract.md SS5.1 `NodeStatus`.
NodeStatus = Literal[
    "SYSTEM_GENERATED",
    "USER_ENRICHED",
    "USER_DEFINED",
    "SUPERSEDED",
    "INFERRED",
    "DEFERRED",
    "ORPHANED",
]


class NodeProvenance(BaseModel):
    """doc/api_event_contract.md SS5.1 `NodeProvenance`."""

    model_config = ConfigDict(extra="forbid")

    generated_at_stage: int
    decision_entry_id: str
    checkpoint_id: str
    llm_call_id: str | None = None


class UseCaseStep(BaseModel):
    """doc/api_event_contract.md SS5.2 `UseCaseStep`."""

    model_config = ConfigDict(extra="forbid")

    step_number: int
    description: str
    actor_performing: str
    system_response: str | None = None


class AlternativeFlow(BaseModel):
    """doc/api_event_contract.md SS5.2 `AlternativeFlow`."""

    model_config = ConfigDict(extra="forbid")

    flow_id: str
    flow_name: str
    trigger_condition: str
    steps: list[UseCaseStep]


class AcceptanceCriterion(BaseModel):
    """doc/api_event_contract.md SS5.3 `AcceptanceCriterion`."""

    model_config = ConfigDict(extra="forbid")

    ac_id: str
    given: str
    when: str
    then: str
    complete: bool


class AccessGuard(BaseModel):
    """doc/api_event_contract.md SS5.4 `AccessGuard`."""

    model_config = ConfigDict(extra="forbid")

    guard_type: Literal["authorization", "authentication", "input_validation", "rate_limiting"]
    description: str
    implementation_hint: str | None = None


class NodeBase(BaseModel):
    """Universal Node fields (doc/api_event_contract.md SS5.1). Not
    instantiated directly - always construct a concrete subtype below.

    `is_active` is a deliberate addition beyond the contract's `status`
    enum: `DeleteNodeRequest.permanent: false` means deactivate, and the
    `NODE_DELETED` event payload carries a separate `deactivated: boolean`
    field - the contract itself treats deactivation as orthogonal to
    `status`, so `status` is reserved purely for provenance/lifecycle
    classification.
    """

    model_config = ConfigDict(extra="forbid", validate_assignment=True)

    node_id: str
    name: str
    description: str
    layer: str
    risk_classification: RiskClassification
    status: NodeStatus
    is_active: bool = True
    deferred_rationale: str | None = None
    parent_id: str | None = None
    children_ids: list[str] = Field(default_factory=list)
    provenance: NodeProvenance
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    created_by: str
    version: int = 1

    def enrich(self) -> Self:
        """doc/prd.md SS4.4 CRUDNodeService.Enrich."""

        if self.status == "SUPERSEDED":
            raise ValueError(f"cannot enrich a superseded node ({self.node_id})")
        self.status = "USER_ENRICHED"
        self.version += 1
        self.updated_at = datetime.now()
        return self

    def supersede(self) -> Self:
        """doc/prd.md SS4.4 RevisionEngine: marks the old node superseded
        when a revision commits a replacement."""

        if self.status == "SUPERSEDED":
            raise ValueError(f"node {self.node_id} is already superseded")
        self.status = "SUPERSEDED"
        self.updated_at = datetime.now()
        return self

    def deactivate(self) -> Self:
        """doc/prd.md SS4.4 CRUDNodeService.Deactivate; contract `DeleteNodeRequest.permanent=false`."""

        self.is_active = False
        self.updated_at = datetime.now()
        return self

    def restore(self) -> Self:
        """doc/prd.md SS4.4 CRUDNodeService.Restore. A superseded node
        cannot be revived - a new node replaces it instead."""

        if self.status == "SUPERSEDED":
            raise ValueError(f"cannot restore a superseded node ({self.node_id})")
        self.is_active = True
        self.updated_at = datetime.now()
        return self

    def defer(self, rationale: str) -> Self:
        """doc/prd.md Glossary `DeferredArtifact`: "explicitly skipped by
        user choice, with mandatory rationale."""

        if not rationale.strip():
            raise ValueError("defer() requires a non-empty rationale")
        self.status = "DEFERRED"
        self.deferred_rationale = rationale
        self.updated_at = datetime.now()
        return self

    def mark_orphaned(self) -> Self:
        """doc/prd.md SS4.4 Node States: "Downstream node whose parent was
        removed/deactivated." Deciding *when* to call this (walking
        children on parent deactivation) is graph-traversal logic for a
        future pass; this is just the entity-level primitive."""

        self.status = "ORPHANED"
        self.updated_at = datetime.now()
        return self


class ActorNode(NodeBase):
    """doc/api_event_contract.md SS5.1 - Actor has no dedicated extension section."""

    node_type: Literal["actor"] = "actor"


class CapabilityNode(NodeBase):
    """doc/api_event_contract.md SS5.1 - Capability has no dedicated
    extension section either; `related_actor_ids` is required to build the
    Story -> UseCase -> Capability -> Actor graph (doc/prd.md SS4.5), same
    inference as the pass 1 LLM response model."""

    node_type: Literal["capability"] = "capability"
    related_actor_ids: list[str] = Field(default_factory=list)


class UseCaseNode(NodeBase):
    """doc/api_event_contract.md SS5.2 `UseCase` (extends Node)."""

    node_type: Literal["use_case"] = "use_case"
    primary_actor_id: str
    secondary_actor_ids: list[str] = Field(default_factory=list)
    preconditions: list[str]
    main_flow: list[UseCaseStep]
    alternative_flows: list[AlternativeFlow] = Field(default_factory=list)
    postconditions: list[str]
    success_criteria: list[str]


class UserStoryNode(NodeBase):
    """doc/api_event_contract.md SS5.3 `UserStory` (extends Node)."""

    node_type: Literal["user_story"] = "user_story"
    title: str
    actor_id: str
    story_points: int
    priority: Literal["Must Have", "Should Have", "Could Have"]
    acceptance_criteria: list[AcceptanceCriterion]
    technical_notes: str
    dependencies: list[str] = Field(default_factory=list)


class EngineeringTaskNode(NodeBase):
    """doc/api_event_contract.md SS5.4 `EngineeringTask` (extends Node)."""

    node_type: Literal["engineering_task"] = "engineering_task"
    estimated_hours: float
    complexity: Literal["Low", "Medium", "High", "Critical"]
    preconditions: list[str]
    postconditions: list[str]
    file_paths: list[str]
    tech_stack_requirements: list[str]
    database_schema_changes: str | None = None
    access_guards: list[AccessGuard] = Field(default_factory=list)
    parent_story_id: str


class CustomAnnotationNode(NodeBase):
    """doc/prd.md SS4.1 `UnmappedSectionRouter` -> `CustomAnnotation` nodes
    for PRD sections no pipeline stage consumes."""

    node_type: Literal["custom_annotation"] = "custom_annotation"
    annotation_text: str
    mapped_stage: int | None = None


Node = Annotated[
    Union[
        ActorNode,
        CapabilityNode,
        UseCaseNode,
        UserStoryNode,
        EngineeringTaskNode,
        CustomAnnotationNode,
    ],
    Field(discriminator="node_type"),
]

NodeAdapter: TypeAdapter[Node] = TypeAdapter(Node)
