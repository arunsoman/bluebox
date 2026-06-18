"""All Pydantic v2 domain models for the Collaborative Steering Pipeline.

This module contains every model referenced in PRD v3 Section 13.
No models should be defined elsewhere — this is the single source of truth.
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field


# ─────────────────────────────────────────────────────────────────────────────
# Enums
# ─────────────────────────────────────────────────────────────────────────────

class RichnessMode(str, Enum):
    WELL_FORMED = "WELL_FORMED"
    MINIMALIST = "MINIMALIST"
    SEED_ONLY = "SEED_ONLY"


class ActorClass(str, Enum):
    HUMAN = "human"
    SYSTEM = "system"
    SERVICE = "service"
    EXTERNAL = "external"


class Traceability(str, Enum):
    EXPLICIT = "EXPLICIT"
    INFERRED = "INFERRED"
    CANDIDATE = "CANDIDATE"


class CapabilityLens(str, Enum):
    FUNCTIONAL = "functional"
    DATA = "data"
    INTEGRATION = "integration"
    SECURITY = "security"
    OPERATIONAL = "operational"
    PLATFORM = "platform"
    GROWTH = "growth"


class AccessLevel(str, Enum):
    READ = "read"
    WRITE = "write"
    ADMIN = "admin"
    EXECUTE = "execute"
    NONE = "none"


class DataSensitivity(str, Enum):
    PUBLIC = "public"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"
    RESTRICTED = "restricted"


class Priority(str, Enum):
    MUST_HAVE = "must_have"
    SHOULD_HAVE = "should_have"
    NICE_TO_HAVE = "nice_to_have"


class StoryPriority(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class TestType(str, Enum):
    UNIT = "unit"
    INTEGRATION = "integration"
    E2E = "e2e"
    MANUAL = "manual"


class TaskLayer(str, Enum):
    FRONTEND = "frontend"
    BACKEND = "backend"
    DATABASE = "database"
    INFRA = "infra"
    AUTH = "auth"
    TEST = "test"
    DEVOPS = "devops"
    SECURITY = "security"


class TaskType(str, Enum):
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    CONFIGURE = "CONFIGURE"
    TEST = "TEST"
    DOCUMENT = "DOCUMENT"


class ScalePersona(str, Enum):
    SMALL = "SMALL"
    MEDIUM = "MEDIUM"
    LARGE = "LARGE"
    CUSTOM = "custom"


class HostingModel(str, Enum):
    SERVERLESS = "serverless"
    CONTAINER_MANAGED = "container_managed"
    VM_BASED = "vm_based"
    ON_PREM = "on_prem"
    HYBRID = "hybrid"
    EDGE = "edge"


class OpsComplexity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class Confidence(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ScaleFit(str, Enum):
    UNDER = "under"
    FIT = "fit"
    OVER = "over"


class LearningCurve(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class PermissionAction(str, Enum):
    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
    EXECUTE = "execute"
    APPROVE = "approve"
    EXPORT = "export"


class PermissionScope(str, Enum):
    OWN = "own"
    TEAM = "team"
    ALL = "all"


class DecisionMaker(str, Enum):
    USER = "user"
    SYSTEM_AUTHORIZED = "system_authorized"


class DecisionStatus(str, Enum):
    ACTIVE = "active"
    SUPERSEDED = "superseded"
    CANCELLED = "cancelled"


class AuthorizationScopeType(str, Enum):
    SINGLE = "single"
    STAGE = "stage"
    PIPELINE = "pipeline"


class BudgetStatus(str, Enum):
    ACTIVE = "active"
    EXHAUSTED = "exhausted"


class ExhaustionAction(str, Enum):
    ESCALATE_DIALOGUE = "escalate_dialogue"
    ACCEPT_BEST = "accept_best"
    MARK_PENDING = "mark_pending"


class ImpactSeverity(str, Enum):
    LOCAL = "LOCAL"
    CASCADING = "CASCADING"
    STRUCTURAL = "STRUCTURAL"


class ImpactType(str, Enum):
    MODIFIED = "modified"
    DELETED = "deleted"
    REQUIRES_RERUN = "requires_rerun"
    POTENTIALLY_AFFECTED = "potentially_affected"


class AuditActorType(str, Enum):
    USER = "user"
    SYSTEM = "system"
    SYSTEM_AUTHORIZED_BY_USER = "system_authorized_by_user"


class AuditActionType(str, Enum):
    PIPELINE_STARTED = "pipeline.started"
    PIPELINE_PAUSED = "pipeline.paused"
    PIPELINE_RESUMED = "pipeline.resumed"
    PIPELINE_COMPLETED = "pipeline.completed"
    STAGE_STARTED = "stage.started"
    STAGE_COMPLETED = "stage.completed"
    STAGE_FAILED = "stage.failed"
    STEERING_PANEL_OPENED = "steering.panel_opened"
    STEERING_ACCEPTED = "steering.accepted"
    STEERING_MODIFIED = "steering.modified"
    STEERING_REPLACED = "steering.replaced"
    STEERING_AUTHORIZATION_GRANTED = "steering.authorization_granted"
    MID_STAGE_REDIRECT = "steering.mid_stage_redirect"
    MID_STAGE_STOP = "steering.mid_stage_stop"
    DECISION_LOGGED = "decision.logged"
    DECISION_REVISED = "decision.revised"
    DECISION_SUPERSEDED = "decision.superseded"
    DECISION_REVERTED = "decision.reverted"
    PROPAGATION_CONSENTED = "revision.propagation_consented"
    PROPAGATION_CANCELLED = "revision.propagation_cancelled"
    ROLE_CREATED = "rbac.role_created"
    ROLE_MODIFIED = "rbac.role_modified"
    PERMISSION_GRANTED = "rbac.permission_granted"
    PERMISSION_REVOKED = "rbac.permission_revoked"
    DATA_ACCESS_GRANTED = "rbac.data_access_granted"
    DATA_ACCESS_REVOKED = "rbac.data_access_revoked"
    RBAC_MODEL_VERSIONED = "rbac.model_versioned"
    PRIVILEGE_ESCALATION_FLAGGED = "rbac.privilege_escalation_flagged"
    RBAC_INHERITANCE_CYCLE_DETECTED = "rbac.inheritance_cycle_detected"
    SCALE_INPUT_CAPTURED = "infra.scale_input_captured"
    HOSTING_OPTION_SELECTED = "infra.hosting_option_selected"
    COST_ESTIMATE_PRESENTED = "infra.cost_estimate_presented"
    INFRASTRUCTURE_PROFILE_STALE = "infra.profile_stale"
    TECH_STACK_SELECTED = "tech_stack.selected"
    NODE_COMMITTED = "node.committed"
    NODE_MODIFIED = "node.modified"
    NODE_PENDING = "node.pending"
    CHECKPOINT_CREATED = "checkpoint.created"
    CHECKPOINT_RESTORED = "checkpoint.restored"
    REVISION_BUDGET_EXHAUSTED = "revision.budget_exhausted"


class StorageStrategy(str, Enum):
    DIFF = "diff"
    FULL = "full"
    REFERENCE = "reference"


class PipelineStatus(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    SUSPENDED = "suspended"


class StageName(str, Enum):
    PRD_ANALYSIS = "prd_analysis"
    IDEATION = "ideation"
    ACTOR_DISCOVERY = "actor_discovery"
    CAPABILITY_DISCOVERY = "capability_discovery"
    USE_CASE_DISCOVERY = "use_case_discovery"
    STORY_DISCOVERY = "story_discovery"
    TASK_DECOMPOSITION = "task_decomposition"


class SteeringActionType(str, Enum):
    ACCEPT = "ACCEPT"
    MODIFY = "MODIFY"
    REPLACE = "REPLACE"
    ASK_ME = "ASK_ME"
    AUTHORIZE_SYSTEM = "AUTHORIZE_SYSTEM"
    REVERT = "REVERT"
    CUSTOM_OPTION = "CUSTOM_OPTION"
    SKIP_QUESTION = "SKIP_QUESTION"
    SUGGEST_ANSWER = "SUGGEST_ANSWER"
    ANSWER_QUESTION = "ANSWER_QUESTION"
    ACCEPT_INFERENCE = "ACCEPT_INFERENCE"
    CONFIRM_SEED = "CONFIRM_SEED"
    MAP_TO_STAGE = "MAP_TO_STAGE"
    CREATE_ANNOTATION = "CREATE_ANNOTATION"
    OUT_OF_SCOPE = "OUT_OF_SCOPE"
    DISMISS_COMPLIANCE = "DISMISS_COMPLIANCE"


class LLMCallStrategy(str, Enum):
    FULL_CONTEXT = "full_context"
    COMPRESSED_CONTEXT = "compressed_context"
    TWO_PASS = "two_pass"


class NotificationChannel(str, Enum):
    WEBSOCKET = "websocket"
    POLLING = "polling"
    WEBHOOK = "webhook"


class FailureMode(str, Enum):
    NONE = "none"
    TIMEOUT = "timeout"
    MALFORMED_JSON = "malformed_json"
    EMPTY_RESPONSE = "empty_response"
    CONTEXT_OVERFLOW = "context_overflow"


# ─────────────────────────────────────────────────────────────────────────────
# Core Pipeline Models
# ─────────────────────────────────────────────────────────────────────────────

class TradeOff(BaseModel):
    gains: list[str] = Field(default_factory=list)
    losses: list[str] = Field(default_factory=list)


class SteeringOption(BaseModel):
    option_id: str
    label: str
    rationale: str = ""
    confidence: Confidence = Confidence.MEDIUM
    confidence_basis: str = ""
    trade_offs: TradeOff = Field(default_factory=TradeOff)
    bookmark: bool = False


class TargetCustomerProfile(BaseModel):
    segment: str = ""
    industry: str | None = None
    geography: list[str] = Field(default_factory=list)
    user_count_estimate: str | None = None
    technical_sophistication: Literal["low", "medium", "high", "unknown"] = "unknown"


class ProblemDefinitionSeed(BaseModel):
    problem_statement: str
    constraints: list[str] = Field(default_factory=list)
    target_customer: TargetCustomerProfile | None = None
    scale_inputs: ScaleInputs | None = None
    traceability: Traceability = Traceability.CANDIDATE


class IdeaSeed(BaseModel):
    idea_id: str
    name: str
    description: str = ""
    traceability: Traceability = Traceability.CANDIDATE


class ActorSeed(BaseModel):
    actor_seed_id: str
    name: str
    actor_type: Literal["human", "system", "service", "external"] = "human"
    description: str = ""
    traceability: Traceability = Traceability.CANDIDATE


class CapabilitySeed(BaseModel):
    capability_seed_id: str
    name: str
    description: str = ""
    traceability: Traceability = Traceability.CANDIDATE


class UseCaseSeed(BaseModel):
    use_case_seed_id: str
    title: str
    description: str = ""
    traceability: Traceability = Traceability.CANDIDATE


class UserStorySeed(BaseModel):
    story_seed_id: str
    story_text: str = ""
    traceability: Traceability = Traceability.CANDIDATE


class UnmappedSection(BaseModel):
    section_id: str
    title: str = ""
    raw_text: str = ""
    suggested_stage: str | None = None
    user_action: Literal["map_to_stage", "custom_annotation", "out_of_scope", "pending"] | None = None
    mapped_stage: str | None = None
    annotation_id: str | None = None


class ConflictFlag(BaseModel):
    flag_id: str
    description: str = ""
    statement_a: str = ""
    statement_b: str = ""
    severity: Literal["blocking", "warning"] = "warning"


class AssumptionFlag(BaseModel):
    flag_id: str
    description: str = ""
    assumed_context: str = ""
    user_acknowledgement_required: bool = True


class ExtractionReport(BaseModel):
    explicit_fields: dict[str, str] = Field(default_factory=dict)
    inferred_fields: dict[str, str] = Field(default_factory=dict)
    candidate_fields: dict[str, str] = Field(default_factory=dict)
    gaps: list[str] = Field(default_factory=list)
    unmapped_input: list[UnmappedSection] = Field(default_factory=list)
    conflicting_statements: list[ConflictFlag] = Field(default_factory=list)
    assumption_flags: list[AssumptionFlag] = Field(default_factory=list)
    detected_compliance_frameworks: list[str] = Field(default_factory=list)
    classification_basis: list[str] = Field(default_factory=list)
    confidence: Confidence = Confidence.MEDIUM
    confidence_basis: str = ""


class TechStackSignal(BaseModel):
    signal_id: str
    detected_technologies: list[str] = Field(default_factory=list)
    detection_source: Literal["input_text", "inferred_from_product_type", "inferred_from_scale"] = "input_text"
    confidence: Confidence = Confidence.MEDIUM


class ScaleInputs(BaseModel):
    launch_users: int | str | None = None
    year1_growth: str | None = None
    peak_concurrent_sessions: int | str | None = None
    uptime_sla: str | None = None
    data_residency_regions: list[str] | None = None
    budget_usd_per_month: str | None = None


class CostRange(BaseModel):
    low_usd: float = 0.0
    mid_usd: float = 0.0
    high_usd: float = 0.0
    basis: str = ""
    assumptions: list[str] = Field(default_factory=list)
    excludes: list[str] = Field(default_factory=list)


class HostingOption(BaseModel):
    option_id: str
    label: str = ""
    hosting_model: HostingModel = HostingModel.CONTAINER_MANAGED
    provider: str = ""
    services_required: list[str] = Field(default_factory=list)
    estimated_monthly_cost_usd: CostRange = Field(default_factory=CostRange)
    estimated_annual_cost_usd: CostRange = Field(default_factory=CostRange)
    scale_ceiling: str = ""
    strengths: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    compliance_suitability: list[str] = Field(default_factory=list)
    time_to_production: str = ""
    ops_complexity: OpsComplexity = OpsComplexity.MEDIUM
    confidence: Confidence = Confidence.MEDIUM
    rationale: str = ""


class InfraComponent(BaseModel):
    component_name: str = ""
    service_name: str = ""
    quantity: int | str = 1
    unit_cost_usd_per_month: float | None = None
    notes: str = ""


class InfrastructureProfile(BaseModel):
    profile_id: str
    scale_persona: ScalePersona = ScalePersona.CUSTOM
    scale_inputs: ScaleInputs = Field(default_factory=ScaleInputs)
    selected_hosting_option: HostingOption | None = None
    estimated_monthly_cost: CostRange = Field(default_factory=CostRange)
    estimated_annual_cost: CostRange = Field(default_factory=CostRange)
    infrastructure_components: list[InfraComponent] = Field(default_factory=list)
    open_cost_flags: list[str] = Field(default_factory=list)
    decision_entry_id: str = ""
    stale: bool = False


class TechStackOption(BaseModel):
    option_id: str
    label: str = ""
    frontend: str | None = None
    backend: str | None = None
    database: str | None = None
    cache: str | None = None
    message_broker: str | None = None
    auth_provider: str | None = None
    hosting: str | None = None
    ci_cd: str | None = None
    monitoring: str | None = None
    rationale: str = ""
    actor_compatibility: list[str] = Field(default_factory=list)
    scale_fit: ScaleFit = ScaleFit.FIT
    learning_curve: LearningCurve = LearningCurve.MEDIUM
    community_maturity: Confidence = Confidence.MEDIUM
    confidence: Confidence = Confidence.MEDIUM


class TechStackProfile(BaseModel):
    profile_id: str
    frontend: str | None = None
    backend: str | None = None
    database: str | None = None
    cache: str | None = None
    message_broker: str | None = None
    auth_provider: str | None = None
    hosting: str | None = None
    ci_cd: str | None = None
    monitoring: str | None = None
    source: Literal["EXPLICIT", "USER_SELECTED", "SYSTEM_AUTHORIZED_SELECTION"] = "USER_SELECTED"
    decision_entry_id: str = ""
    rationale: str = ""


class ProjectBlueprintSeed(BaseModel):
    seed_id: str
    project_name: str | None = None
    problem_seed: ProblemDefinitionSeed = Field(default_factory=lambda: ProblemDefinitionSeed(problem_statement=""))
    idea_seeds: list[IdeaSeed] = Field(default_factory=list)
    actor_seeds: list[ActorSeed] = Field(default_factory=list)
    capability_seeds: list[CapabilitySeed] = Field(default_factory=list)
    use_case_seeds: list[UseCaseSeed] = Field(default_factory=list)
    user_story_seeds: list[UserStorySeed] = Field(default_factory=list)
    tech_stack_signal: TechStackSignal | None = None
    infrastructure_profile: InfrastructureProfile | None = None
    extraction_report: ExtractionReport = Field(default_factory=ExtractionReport)
    richness_mode: RichnessMode = RichnessMode.SEED_ONLY
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ProductIdea(BaseModel):
    idea_id: str
    name: str = ""
    one_line_summary: str = ""
    value_proposition: str = ""
    target_customer_fit: str = ""
    differentiation: str = ""
    risk_factors: list[str] = Field(default_factory=list)
    confidence: Confidence = Confidence.MEDIUM
    confidence_basis: str = ""
    traceability: Traceability = Traceability.CANDIDATE
    rank: int = 1
    rationale: str = ""
    trade_offs: TradeOff = Field(default_factory=TradeOff)


class ProductIdeaSet(BaseModel):
    problem_statement: str = ""
    constraints: list[str] = Field(default_factory=list)
    ideas: list[ProductIdea] = Field(default_factory=list)


class Actor(BaseModel):
    actor_id: str
    name: str = ""
    type: Literal["human", "system", "service", "external"] = "human"
    actor_class: ActorClass = ActorClass.HUMAN
    description: str = ""
    is_platform_actor: bool = False
    permissions_hint: list[str] = Field(default_factory=list)
    data_access_hint: list[str] = Field(default_factory=list)
    traceability: Traceability = Traceability.CANDIDATE
    source_fragment: str | None = None


class ActorRelationship(BaseModel):
    source_actor_id: str
    target_actor_id: str
    relationship_type: Literal["uses", "extends", "communicates_with", "owns"] = "uses"


class RBACActorHint(BaseModel):
    actor_id: str
    actor_name: str = ""
    suggested_role_label: str = ""
    permissions_preview: list[str] = Field(default_factory=list)


class ActorDiscoveryResult(BaseModel):
    actors: dict[ActorClass, list[Actor]] = Field(default_factory=dict)
    relationship_map: list[ActorRelationship] = Field(default_factory=list)
    actor_hierarchy: dict[str, list[str]] = Field(default_factory=dict)
    platform_actors: list[Actor] = Field(default_factory=list)
    rbac_candidates: list[RBACActorHint] = Field(default_factory=list)


class Capability(BaseModel):
    capability_id: str
    name: str = ""
    description: str = ""
    triggered_by: list[str] = Field(default_factory=list)
    capability_lens: CapabilityLens = CapabilityLens.FUNCTIONAL
    is_platform_capability: bool = False
    data_entities_involved: list[str] = Field(default_factory=list)
    access_level_hint: AccessLevel = AccessLevel.READ
    traceability: Traceability = Traceability.CANDIDATE
    priority: Priority = Priority.SHOULD_HAVE
    priority_rationale: str = ""


class CapabilitySet(BaseModel):
    capabilities: list[Capability] = Field(default_factory=list)
    platform_capabilities: list[Capability] = Field(default_factory=list)


class AccessContext(BaseModel):
    required_permission: str = ""
    minimum_role: str | None = None
    data_sensitivity: DataSensitivity = DataSensitivity.INTERNAL


class AlternativeFlow(BaseModel):
    trigger: str = ""
    steps: list[str] = Field(default_factory=list)


class ExceptionFlow(BaseModel):
    trigger: str = ""
    steps: list[str] = Field(default_factory=list)
    error_code: str | None = None


class UseCase(BaseModel):
    use_case_id: str
    title: str = ""
    primary_actor: str = ""
    secondary_actors: list[str] = Field(default_factory=list)
    capability_ids: list[str] = Field(default_factory=list)
    preconditions: list[str] = Field(default_factory=list)
    main_flow: list[str] = Field(default_factory=list)
    alternative_flows: list[AlternativeFlow] = Field(default_factory=list)
    exception_flows: list[ExceptionFlow] = Field(default_factory=list)
    postconditions: list[str] = Field(default_factory=list)
    data_entities_read: list[str] = Field(default_factory=list)
    data_entities_written: list[str] = Field(default_factory=list)
    access_context: AccessContext = Field(default_factory=AccessContext)
    traceability: Traceability = Traceability.CANDIDATE


class UseCaseSet(BaseModel):
    use_cases: list[UseCase] = Field(default_factory=list)


class AcceptanceCriterion(BaseModel):
    criterion_id: str
    given: str = ""
    when: str = ""
    then: str = ""
    test_type: TestType = TestType.UNIT


class UserStory(BaseModel):
    story_id: str
    actor: str = ""
    capability_id: str = ""
    use_case_id: str = ""
    story_text: str = ""
    acceptance_criteria: list[AcceptanceCriterion] = Field(default_factory=list)
    priority: StoryPriority = StoryPriority.MEDIUM
    priority_rationale: str = ""
    story_points: int | None = None
    dependencies: list[str] = Field(default_factory=list)
    access_requirement: str | None = None
    traceability: Traceability = Traceability.CANDIDATE


class UserStorySet(BaseModel):
    user_stories: list[UserStory] = Field(default_factory=list)


class TestSpec(BaseModel):
    spec_id: str
    criterion_id: str = ""
    test_type: TestType = TestType.UNIT
    description: str = ""
    inputs: list[str] = Field(default_factory=list)
    expected_outputs: list[str] = Field(default_factory=list)
    mocks_required: list[str] = Field(default_factory=list)


class EngineeringTask(BaseModel):
    task_id: str
    story_id: str = ""
    title: str = ""
    description: str = ""
    layer: TaskLayer = TaskLayer.BACKEND
    task_type: TaskType = TaskType.CREATE
    file_paths: list[str] = Field(default_factory=list)
    implementation_sketch: list[str] = Field(default_factory=list)
    acceptance_criteria: list[AcceptanceCriterion] = Field(default_factory=list)
    test_specs: list[TestSpec] = Field(default_factory=list)
    dependencies: list[str] = Field(default_factory=list)
    effort_points: int | None = None
    access_guards: list[str] = Field(default_factory=list)
    needs_retry: bool = False
    traceability: Traceability = Traceability.CANDIDATE


class StoryDecomposition(BaseModel):
    story_id: str
    tasks: list[EngineeringTask] = Field(default_factory=list)


class TaskDecompositionInputSeed(BaseModel):
    tech_stack: TechStackProfile = Field(default_factory=lambda: TechStackProfile(profile_id=""))
    user_stories: list[UserStory] = Field(default_factory=list)
    use_cases: list[UseCase] = Field(default_factory=list)
    infrastructure_profile: InfrastructureProfile | None = None
    rbac_model: RBACModel | None = None
    custom_annotations: list[CustomAnnotation] | None = None


class TaskDecompositionResult(BaseModel):
    tech_stack: TechStackProfile = Field(default_factory=lambda: TechStackProfile(profile_id=""))
    decompositions: list[StoryDecomposition] = Field(default_factory=list)


class CustomAnnotation(BaseModel):
    annotation_id: str
    title: str = ""
    raw_text: str = ""
    source_section: str = ""
    user_intent: Literal["additional_context", "out_of_scope", "future_work", "compliance_note"] = "additional_context"
    linked_stage: str | None = None
    linked_tasks: list[str] | None = None


# ─────────────────────────────────────────────────────────────────────────────
# RBAC Models
# ─────────────────────────────────────────────────────────────────────────────

class Role(BaseModel):
    role_id: str
    name: str = ""
    description: str = ""
    actor_ids: list[str] = Field(default_factory=list)
    is_system_role: bool = False
    traceability: Traceability = Traceability.CANDIDATE
    inheritance_depth: int = 0


class Permission(BaseModel):
    permission_id: str
    resource: str = ""
    action: PermissionAction = PermissionAction.READ
    scope: PermissionScope = PermissionScope.OWN
    description: str = ""
    sensitivity: DataSensitivity = DataSensitivity.INTERNAL
    capability_id: str | None = None


class RolePermissionEntry(BaseModel):
    role_id: str
    permission_id: str
    granted: bool = False
    conditions: list[str] = Field(default_factory=list)
    decision_maker: DecisionMaker = DecisionMaker.USER
    rationale: str = ""


class DataAccessEntry(BaseModel):
    role_id: str
    data_entity: str = ""
    read: bool = False
    write: bool = False
    delete_: bool = Field(default=False, alias="delete")
    export: bool = False
    scope: PermissionScope = PermissionScope.OWN
    conditions: list[str] = Field(default_factory=list)
    sensitivity: DataSensitivity = DataSensitivity.INTERNAL

    class Config:
        populate_by_name = True


class RoleInheritance(BaseModel):
    parent_role_id: str
    child_role_id: str
    inherited_permissions: list[str] = Field(default_factory=list)
    rationale: str = ""
    cycle_check_passed: bool = False


class AuditPolicy(BaseModel):
    audit_all_writes: bool = False
    audit_reads_for_sensitivity: list[Literal["confidential", "restricted"]] = Field(default_factory=list)
    retention_days: int = 90
    alert_on_privilege_escalation: bool = False
    alert_on_bulk_export: bool = False
    audit_log_immutable: bool = True
    max_inheritance_depth: int = 3
    storage_strategy: StorageStrategy = StorageStrategy.DIFF
    storage_budget_mb: int = 100


class RBACModel(BaseModel):
    model_id: str
    project_id: str = ""
    roles: list[Role] = Field(default_factory=list)
    permissions: list[Permission] = Field(default_factory=list)
    permission_matrix: list[RolePermissionEntry] = Field(default_factory=list)
    data_access_matrix: list[DataAccessEntry] = Field(default_factory=list)
    role_hierarchy: list[RoleInheritance] = Field(default_factory=list)
    audit_policy: AuditPolicy = Field(default_factory=AuditPolicy)
    decision_entry_id: str = ""
    version: int = 1
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_modified_at: datetime = Field(default_factory=datetime.utcnow)
    max_inheritance_depth: int = 3
    escalation_check_algorithm: str = "STATIC_ESCALATION_ANALYSIS"


# ─────────────────────────────────────────────────────────────────────────────
# Decision & Audit Models
# ─────────────────────────────────────────────────────────────────────────────

class AuthorizationScope(BaseModel):
    scope_type: AuthorizationScopeType = AuthorizationScopeType.SINGLE
    stage_range: list[str] | None = None
    granted_at: datetime = Field(default_factory=datetime.utcnow)
    expires_after: str | None = None


class DecisionEntry(BaseModel):
    decision_id: str
    stage: str = ""
    decision_point: str = ""
    options_presented: list[SteeringOption] = Field(default_factory=list)
    chosen_option: SteeringOption | None = None
    decision_maker: DecisionMaker = DecisionMaker.USER
    authorization_scope: AuthorizationScope | None = None
    rationale_accepted: str = ""
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    status: DecisionStatus = DecisionStatus.ACTIVE
    revisable: bool = True
    revision_chain: list[str] = Field(default_factory=list)
    audit_event_id: str = ""
    reverted_from: str | None = None


class DecisionLedger(BaseModel):
    project_id: str = ""
    session_id: str = ""
    entries: list[DecisionEntry] = Field(default_factory=list)
    total_user_decisions: int = 0
    total_system_decisions: int = 0
    total_superseded: int = 0
    total_reverted: int = 0


class RevisionBudget(BaseModel):
    budget_id: str
    decision_point: str = ""
    max_revisions: int = 5
    revisions_used: int = 0
    status: BudgetStatus = BudgetStatus.ACTIVE
    exhaustion_action: ExhaustionAction = ExhaustionAction.ESCALATE_DIALOGUE


class AffectedNode(BaseModel):
    node_id: str
    node_type: str = ""
    label: str = ""
    impact_reason: str = ""
    impact_type: ImpactType = ImpactType.MODIFIED


class ImpactReport(BaseModel):
    revision_request_id: str
    original_decision_id: str
    proposed_choice: SteeringOption | None = None
    directly_affected_nodes: list[AffectedNode] = Field(default_factory=list)
    transitively_affected_nodes: list[AffectedNode] = Field(default_factory=list)
    stages_needing_rerun: list[str] = Field(default_factory=list)
    invalidated_decisions: list[str] = Field(default_factory=list)
    severity: ImpactSeverity = ImpactSeverity.LOCAL
    plain_summary: str = ""
    detailed_breakdown: list[str] = Field(default_factory=list)
    estimated_rerun_time_seconds: int | None = None


class PropagationConsent(BaseModel):
    impact_report_id: str
    user_confirmed: bool = False
    confirmed_at: datetime | None = None
    notes: str | None = None


class AuditActor(BaseModel):
    actor_type: AuditActorType = AuditActorType.USER
    user_id: str | None = None
    session_id: str = ""
    authorization_scope: str | None = None
    identity_verified_at: datetime | None = None


class AuditTarget(BaseModel):
    target_type: str = ""  # Literal values defined in PRD
    target_id: str = ""
    target_label: str = ""


class AuditEvent(BaseModel):
    event_id: str
    session_id: str = ""
    project_id: str = ""
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    actor: AuditActor = Field(default_factory=AuditActor)
    action: AuditActionType = AuditActionType.PIPELINE_STARTED
    target: AuditTarget | None = None
    before_state: dict[str, Any] | None = None
    after_state: dict[str, Any] | None = None
    authorization_ref: str | None = None
    ip_address: str | None = None
    metadata: dict[str, str] = Field(default_factory=dict)
    storage_strategy: StorageStrategy = StorageStrategy.DIFF


# ─────────────────────────────────────────────────────────────────────────────
# State Management Models
# ─────────────────────────────────────────────────────────────────────────────

class Checkpoint(BaseModel):
    checkpoint_id: str
    stage_completed: str = ""
    pipeline_state_snapshot: dict[str, Any] = Field(default_factory=dict)
    decision_ledger_snapshot: DecisionLedger | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    label: str = ""


class SessionPolicy(BaseModel):
    idle_suspend_minutes: int = 30
    idle_expire_days: int = 30
    session_reauth_idle_minutes: int = 60


class LLMFailureResolution(BaseModel):
    session_id: str = ""
    stage: str = ""
    failure_reason: str = ""
    options: list[Literal["retry_same", "retry_user_modified", "skip_with_consent", "restore_checkpoint"]] = Field(
        default_factory=lambda: ["retry_same", "retry_user_modified", "skip_with_consent", "restore_checkpoint"]
    )


class StreamChunk(BaseModel):
    chunk_id: str
    stage: str = ""
    chunk_index: int = 0
    content_type: str = ""  # e.g. "actor", "capability", "task"
    content: dict[str, Any] = Field(default_factory=dict)
    is_final_chunk: bool = False


class SteeringPanelRenderPolicy(BaseModel):
    mode: Literal["summary", "detail"] = "summary"
    page: int = 1
    total_pages: int = 1
    total_nodes: int = 0
    nodes_per_page: int = 20


class ContextWindowInfo(BaseModel):
    strategy: LLMCallStrategy = LLMCallStrategy.FULL_CONTEXT
    token_estimate: int = 0
    input_size_chars: int = 0


class SteeringPanel(BaseModel):
    stage: str = ""
    draft_output: dict[str, Any] = Field(default_factory=dict)
    options: list[SteeringOption] = Field(default_factory=list)
    render_policy: SteeringPanelRenderPolicy = Field(default_factory=SteeringPanelRenderPolicy)
    context_window: ContextWindowInfo = Field(default_factory=ContextWindowInfo)


class NotificationPolicy(BaseModel):
    notification_channel: NotificationChannel = NotificationChannel.WEBSOCKET
    webhook_callback_url: str | None = None


# ─────────────────────────────────────────────────────────────────────────────
# Minimalist Dialogue Models
# ─────────────────────────────────────────────────────────────────────────────

class MinimalistQuestion(BaseModel):
    question_id: str
    dimension: str = ""  # problem_scope, user_base, scale_intent, monetization, constraints, success_definition
    question_text: str = ""
    skipped: bool = False
    answer: str | None = None
    inferred_answer: str | None = None
    inference_confidence: Confidence | None = None


class MinimalistDialogueResult(BaseModel):
    questions: list[MinimalistQuestion] = Field(default_factory=list)
    synthesized_seed: ProblemDefinitionSeed | None = None
    answers: dict[str, str] = Field(default_factory=dict)


# ─────────────────────────────────────────────────────────────────────────────
# Input Processing Models
# ─────────────────────────────────────────────────────────────────────────────

class RawUserInput(BaseModel):
    text: str
    source: Literal["chat", "file_upload", "api"] = "chat"
    richness_mode: RichnessMode = RichnessMode.SEED_ONLY
    prd_analysis_report: dict[str, Any] | None = None
    minimalist_dialogue_result: MinimalistDialogueResult | None = None
    scale_inputs: ScaleInputs | None = None
    tech_stack_signal: TechStackSignal | None = None
    detected_compliance_frameworks: list[str] = Field(default_factory=list)


class PRDAnalysisReport(BaseModel):
    explicit_sections: list[dict[str, Any]] = Field(default_factory=list)
    thin_sections: list[dict[str, Any]] = Field(default_factory=list)
    missing_sections: list[dict[str, Any]] = Field(default_factory=list)
    conflicts: list[ConflictFlag] = Field(default_factory=list)
    unmapped_input: list[UnmappedSection] = Field(default_factory=list)
    assumption_flags: list[AssumptionFlag] = Field(default_factory=list)
    detected_compliance_frameworks: list[str] = Field(default_factory=list)
    classification_basis: list[str] = Field(default_factory=list)


class RichnessClassification(BaseModel):
    mode: RichnessMode = RichnessMode.SEED_ONLY
    confidence: Confidence = Confidence.MEDIUM
    classification_basis: list[str] = Field(default_factory=list)
    gaps: list[str] = Field(default_factory=list)


class ScaleInputConflict(BaseModel):
    conflict_description: str = ""
    affected_fields: list[str] = Field(default_factory=list)


class PermissionConflict(BaseModel):
    conflict_id: str
    roles: list[str] = Field(default_factory=list)
    permission: str = ""
    description: str = ""


class EscalationFlag(BaseModel):
    path: list[str] = Field(default_factory=list)
    resulting_access: str = ""
    algorithm: str = "STATIC_ESCALATION_ANALYSIS"
    depth_limit: int = 3


class InheritanceCycle(BaseModel):
    cycle_path: list[str] = Field(default_factory=list)


class UserOptionIncoherent(BaseModel):
    option_text: str = ""
    failure_reason: str = ""
    suggestions: list[str] = Field(default_factory=list)


class RevisionBudgetExhausted(BaseModel):
    budget_id: str
    decision_point: str = ""
    exhaustion_action: ExhaustionAction = ExhaustionAction.ESCALATE_DIALOGUE


class SteeringRequired(BaseModel):
    stage: str = ""
    reason: str = ""
    options: list[SteeringOption] = Field(default_factory=list)


# ─────────────────────────────────────────────────────────────────────────────
# DTO Models (for API requests/responses)
# ─────────────────────────────────────────────────────────────────────────────

class StartPipelineRequest(BaseModel):
    user_id: str
    project_name: str | None = None


class PipelineSessionDTO(BaseModel):
    session_id: str
    project_id: str
    user_id: str
    current_stage: StageName | None = None
    status: PipelineStatus = PipelineStatus.IDLE
    richness_mode: RichnessMode | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class SessionSuspendDTO(BaseModel):
    session_id: str
    status: PipelineStatus = PipelineStatus.SUSPENDED
    checkpoint_id: str = ""
    suspended_at: datetime = Field(default_factory=datetime.utcnow)


class SubmitInputRequest(BaseModel):
    text: str
    source: Literal["chat", "file_upload", "api"] = "chat"


class SteeringActionDTO(BaseModel):
    session_id: str
    action_type: SteeringActionType
    stage: str = ""
    payload: dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class RevisionRequestDTO(BaseModel):
    session_id: str
    original_decision_id: str
    new_choice: SteeringOption | None = None


class PropagationConsentDTO(BaseModel):
    session_id: str
    impact_report_id: str
    user_confirmed: bool = False
    notes: str | None = None


class CheckpointRestoreDTO(BaseModel):
    session_id: str
    checkpoint_id: str


class AuditQueryDTO(BaseModel):
    action_type: AuditActionType | None = None
    actor_id: str | None = None
    date_from: datetime | None = None
    date_to: datetime | None = None
    page: int = 1
    page_size: int = 50


class AuditTrailDTO(BaseModel):
    events: list[AuditEvent] = Field(default_factory=list)
    total: int = 0
    storage_strategy: StorageStrategy = StorageStrategy.DIFF
    storage_used_percent: float = 0.0


class DecisionLedgerDTO(BaseModel):
    entries: list[DecisionEntry] = Field(default_factory=list)
    total_user_decisions: int = 0
    total_system_decisions: int = 0
    total_superseded: int = 0
    total_reverted: int = 0


class CheckpointListDTO(BaseModel):
    checkpoints: list[Checkpoint] = Field(default_factory=list)


class HealthCheckDTO(BaseModel):
    status: str = "healthy"
    version: str = "3.0.0"
    services: dict[str, str] = Field(default_factory=dict)


class AuthorizationGrantDTO(BaseModel):
    session_id: str
    scope_type: AuthorizationScopeType
    stage_range: list[str] | None = None


class MidStageSteerDTO(BaseModel):
    session_id: str
    instruction: str = ""
    action_type: SteeringActionType = SteeringActionType.MODIFY
    target_chunk: str | None = None


class ContextQuestionDTO(BaseModel):
    session_id: str
    question: str = ""
    context_node_id: str | None = None


class ScaleDialogueResponseDTO(BaseModel):
    session_id: str
    scale_inputs: ScaleInputs


class HostingOptionSelectionDTO(BaseModel):
    session_id: str
    option_id: str
    modified_fields: dict[str, Any] | None = None


class TechStackSelectionDTO(BaseModel):
    session_id: str
    option_id: str
    modified_fields: dict[str, Any] | None = None


class RBACSteeringActionDTO(BaseModel):
    session_id: str
    target: str = ""
    action_type: str = ""
    payload: dict[str, Any] = Field(default_factory=dict)


class BookmarkToggleDTO(BaseModel):
    session_id: str
    option_id: str
    bookmarked: bool = False


class PipelineCompletionDTO(BaseModel):
    project_id: str
    committed_nodes: list[dict[str, Any]] = Field(default_factory=list)
    decision_ledger: DecisionLedger = Field(default_factory=DecisionLedger)
    rbac_model: RBACModel | None = None
    infrastructure_profile: InfrastructureProfile | None = None
    tech_stack_profile: TechStackProfile | None = None
