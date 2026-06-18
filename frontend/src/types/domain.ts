// =============================================================================
// Collaborative Steering Pipeline — Domain Types
// Generated from backend Pydantic models
// =============================================================================

// ── Enums ───────────────────────────────────────────────────────────────────

export type RichnessMode = 'WELL_FORMED' | 'MINIMALIST' | 'SEED_ONLY';
export type ActorClass = 'human' | 'system' | 'service' | 'external';
export type Traceability = 'EXPLICIT' | 'INFERRED' | 'CANDIDATE';
export type CapabilityLens = 'functional' | 'data' | 'integration' | 'security' | 'operational' | 'platform' | 'growth';
export type AccessLevel = 'read' | 'write' | 'admin' | 'execute' | 'none';
export type DataSensitivity = 'public' | 'internal' | 'confidential' | 'restricted';
export type Priority = 'must_have' | 'should_have' | 'nice_to_have';
export type StoryPriority = 'critical' | 'high' | 'medium' | 'low';
export type TestType = 'unit' | 'integration' | 'e2e' | 'manual';
export type TaskLayer = 'frontend' | 'backend' | 'database' | 'infra' | 'auth' | 'test' | 'devops' | 'security';
export type TaskType = 'CREATE' | 'UPDATE' | 'DELETE' | 'CONFIGURE' | 'TEST' | 'DOCUMENT';
export type ScalePersona = 'SMALL' | 'MEDIUM' | 'LARGE' | 'CUSTOM';
export type HostingModel = 'serverless' | 'container_managed' | 'vm_based' | 'on_prem' | 'hybrid' | 'edge';
export type OpsComplexity = 'low' | 'medium' | 'high';
export type Confidence = 'high' | 'medium' | 'low';
export type ScaleFit = 'under' | 'fit' | 'over';
export type LearningCurve = 'low' | 'medium' | 'high';
export type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'execute' | 'approve' | 'export';
export type PermissionScope = 'own' | 'team' | 'all';
export type DecisionMaker = 'user' | 'system_authorized';
export type DecisionStatus = 'active' | 'superseded' | 'cancelled';
export type AuthorizationScopeType = 'single' | 'stage' | 'pipeline';
export type BudgetStatus = 'active' | 'exhausted';
export type ExhaustionAction = 'escalate_dialogue' | 'accept_best' | 'mark_pending';
export type ImpactSeverity = 'LOCAL' | 'CASCADING' | 'STRUCTURAL';
export type ImpactType = 'modified' | 'deleted' | 'requires_rerun' | 'potentially_affected';
export type AuditActorType = 'user' | 'system' | 'system_authorized_by_user';
export type AuditActionType = string;
export type StorageStrategy = 'diff' | 'full' | 'reference';
export type PipelineStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'suspended' | 'expired';
export type StageName = 'prd_analysis' | 'ideation' | 'actor_discovery' | 'capability_discovery' | 'use_case_discovery' | 'story_discovery' | 'task_decomposition';
export type SteeringActionType =
  | 'ACCEPT'
  | 'MODIFY'
  | 'REPLACE'
  | 'ASK_ME'
  | 'AUTHORIZE_SYSTEM'
  | 'REVERT'
  | 'CUSTOM_OPTION'
  | 'SKIP_QUESTION'
  | 'SUGGEST_ANSWER'
  | 'ANSWER_QUESTION'
  | 'ACCEPT_INFERENCE'
  | 'CONFIRM_SEED'
  | 'MAP_TO_STAGE'
  | 'CREATE_ANNOTATION'
  | 'OUT_OF_SCOPE'
  | 'DISMISS_COMPLIANCE';
export type LLMCallStrategy = 'full_context' | 'compressed_context' | 'two_pass';
export type NotificationChannel = 'websocket' | 'polling' | 'webhook';

// ── Core Models ──────────────────────────────────────────────────────────────

export interface TradeOff {
  advantage: string;
  disadvantage: string;
}

export interface SteeringOption {
  option_id: string;
  label: string;
  description: string;
  rank: number;
  confidence: Confidence;
  rationale: string;
  trade_offs: TradeOff[];
  metadata?: Record<string, unknown>;
}

export interface TargetCustomerProfile {
  segment: string;
  pain_points: string[];
  demographics?: Record<string, string>;
}

export interface ProblemDefinitionSeed {
  project_name: string;
  problem_statement: string;
  target_customer: TargetCustomerProfile;
  constraints: string[];
  success_metrics: string[];
}

export interface IdeaSeed {
  idea_id: string;
  name: string;
  description: string;
  confidence: Confidence;
  source_fragment?: string;
}

export interface ActorSeed {
  actor_id: string;
  name: string;
  actor_class: ActorClass;
  description: string;
  confidence: Confidence;
  traceability: Traceability;
  source_fragment?: string;
  permissions_hint?: string[];
  data_access_hint?: string[];
}

export interface CapabilitySeed {
  capability_id: string;
  name: string;
  description: string;
  lens: CapabilityLens;
  parent_ids: string[];
  confidence: Confidence;
  traceability: Traceability;
  source_fragment?: string;
}

export interface UseCaseSeed {
  use_case_id: string;
  name: string;
  description: string;
  actor_ids: string[];
  capability_ids: string[];
  confidence: Confidence;
  traceability: Traceability;
  source_fragment?: string;
}

export interface UserStorySeed {
  story_id: string;
  role: string;
  action: string;
  benefit: string;
  acceptance_criteria: string[];
  priority: StoryPriority;
  use_case_ids: string[];
  confidence: Confidence;
  traceability: Traceability;
}

export interface UnmappedSection {
  section_id: string;
  title: string;
  content_preview: string;
  suggested_action: 'map_to_stage' | 'create_annotation' | 'out_of_scope';
  mapped_stage?: StageName | null;
}

export interface ConflictFlag {
  conflict_id: string;
  severity: 'warning' | 'error';
  statement_a: string;
  statement_b: string;
  resolution?: string | null;
}

export interface AssumptionFlag {
  assumption_id: string;
  field: string;
  assumed_value: string;
  confidence: Confidence;
}

export interface ExtractionReport {
  explicit_sections: Array<{ title: string; content_summary: string }>;
  thin_sections: Array<{ title: string; content_summary: string; suggestion: string }>;
  missing_sections: Array<{ name: string; suggested_action: string }>;
  conflicts: ConflictFlag[];
  unmapped_input: UnmappedSection[];
  assumptions: AssumptionFlag[];
  detected_compliance_frameworks?: string[];
  pre_populated_defaults?: AuditPolicy | null;
}

export interface TechStackSignal {
  framework?: string | null;
  language?: string | null;
  database?: string | null;
  cloud_provider?: string | null;
  containerization?: string | null;
  ci_cd?: string | null;
}

export interface ScaleInputs {
  launch_users?: number | null;
  year1_growth?: number | null;
  peak_concurrent?: number | null;
  data_volume_gb?: number | null;
  uptime_sla?: string | null;
  persona?: ScalePersona | null;
}

export interface CostRange {
  min_usd: number;
  max_usd: number;
  mid_usd: number;
  basis: string;
  assumptions: string;
  excludes: string;
}

export interface HostingOption {
  option_id: string;
  label: string;
  hosting_model: HostingModel;
  provider: string;
  services_required: string[];
  estimated_monthly_cost_usd: CostRange;
  scale_ceiling: string;
  strengths: string[];
  limitations: string[];
  compliance_suitability: string[];
  time_to_production: string;
  ops_complexity: OpsComplexity;
  confidence: Confidence;
  rationale: string;
}

export interface InfraComponent {
  component_name: string;
  service: string;
  monthly_cost_usd_mid: number;
}

export interface InfrastructureProfile {
  profile_id: string;
  hosting_option_id: string | null;
  infrastructure_components: InfraComponent[];
  total_monthly_cost_usd_mid: number;
  total_annual_cost_usd_mid: number;
  open_cost_flags: string[];
  stale: boolean;
}

export interface TechStackOption {
  option_id: string;
  label: string;
  frontend: string;
  backend: string;
  database: string;
  cache?: string | null;
  message_queue?: string | null;
  auth?: string | null;
  hosting: string;
  ci_cd?: string | null;
  monitoring?: string | null;
  rationale: string;
  actor_compatibility: string[];
  scale_fit: ScaleFit;
  learning_curve: LearningCurve;
  community_maturity: Confidence;
  confidence: Confidence;
}

export interface TechStackProfile {
  profile_id: string;
  source: 'EXPLICIT' | 'USER_SELECTED' | 'SYSTEM_AUTHORIZED_SELECTION';
  decision_entry_id: string | null;
  selected_option_id: string | null;
  custom_configuration?: Record<string, string> | null;
  rationale: string;
}

export interface ProjectBlueprintSeed {
  project_name: string;
  problem_definition: ProblemDefinitionSeed;
  product_idea: ProductIdea | null;
  actors: Actor[];
  capabilities: Capability[];
  use_cases: UseCase[];
  user_stories: UserStory[];
  rbac_model: RBACModel | null;
  infrastructure: InfrastructureProfile | null;
  tech_stack: TechStackProfile | null;
  annotations: CustomAnnotation[];
}

export interface ProductIdea {
  idea_id: string;
  name: string;
  description: string;
  confidence: Confidence;
  source_fragment?: string | null;
  alternatives_considered?: SteeringOption[] | null;
}

export interface ProductIdeaSet {
  primary: ProductIdea;
  alternatives: ProductIdea[];
  decision_id: string;
}

export interface Actor {
  actor_id: string;
  name: string;
  actor_class: ActorClass;
  description: string;
  confidence: Confidence;
  traceability: Traceability;
  source_fragment?: string | null;
  permissions_hint?: string[] | null;
  data_access_hint?: string[] | null;
}

export interface ActorRelationship {
  from_actor_id: string;
  to_actor_id: string;
  relationship_type: 'interacts_with' | 'depends_on' | 'triggers' | 'notifies';
}

export interface RBACActorHint {
  actor_id: string;
  role_suggestion: string;
  permission_suggestions: string[];
}

export interface ActorDiscoveryResult {
  actors: Actor[];
  relationships: ActorRelationship[];
  rbac_hints: RBACActorHint[];
}

export interface Capability {
  capability_id: string;
  name: string;
  description: string;
  lens: CapabilityLens;
  parent_ids: string[];
  confidence: Confidence;
  traceability: Traceability;
  source_fragment?: string | null;
}

export interface CapabilitySet {
  capabilities: Capability[];
  coverage: Record<CapabilityLens, number>;
  gaps: Array<{ lens: CapabilityLens; suggestion: string }>;
}

export interface AccessContext {
  role_id: string;
  permission: string;
  data_entity: string;
  scope: PermissionScope;
}

export interface AlternativeFlow {
  name: string;
  steps: string[];
}

export interface ExceptionFlow {
  name: string;
  condition: string;
  steps: string[];
}

export interface UseCase {
  use_case_id: string;
  name: string;
  description: string;
  actor_ids: string[];
  capability_ids: string[];
  preconditions: string[];
  postconditions: string[];
  main_flow: string[];
  alternative_flows: AlternativeFlow[];
  exception_flows: ExceptionFlow[];
  confidence: Confidence;
  traceability: Traceability;
  source_fragment?: string | null;
}

export interface UseCaseSet {
  use_cases: UseCase[];
  orphaned_actors: string[];
  coverage_percent: number;
}

export interface AcceptanceCriterion {
  criterion_id: string;
  given: string;
  when: string;
  then: string;
}

export interface UserStory {
  story_id: string;
  role: string;
  action: string;
  benefit: string;
  acceptance_criteria: AcceptanceCriterion[];
  priority: StoryPriority;
  use_case_ids: string[];
  test_specs: TestSpec[];
  confidence: Confidence;
  traceability: Traceability;
}

export interface UserStorySet {
  stories: UserStory[];
  priority_distribution: Record<StoryPriority, number>;
  completeness_percent: number;
}

export interface TestSpec {
  test_id: string;
  test_type: TestType;
  description: string;
  automated: boolean;
  story_id: string;
}

export interface EngineeringTask {
  task_id: string;
  task_type: TaskType;
  title: string;
  description: string;
  layer: TaskLayer;
  story_ids: string[];
  estimated_hours: number | null;
  dependencies: string[];
  acceptance_criteria: string[];
}

export interface StoryDecomposition {
  story_id: string;
  tasks: EngineeringTask[];
  total_estimated_hours: number | null;
}

export interface TaskDecompositionResult {
  decompositions: StoryDecomposition[];
  total_tasks: number;
  total_estimated_hours: number | null;
  layer_distribution: Record<TaskLayer, number>;
}

export interface CustomAnnotation {
  annotation_id: string;
  stage: StageName;
  node_id: string | null;
  annotation_type: 'comment' | 'warning' | 'decision_note';
  content: string;
  created_at: string;
  created_by: string;
}

// ── RBAC Models ──────────────────────────────────────────────────────────────

export interface Role {
  role_id: string;
  name: string;
  description: string;
  actor_ids: string[];
  inherited_role_ids: string[];
}

export interface Permission {
  permission_id: string;
  resource: string;
  action: PermissionAction;
}

export interface RolePermissionEntry {
  role_id: string;
  permission_id: string;
  permission_label: string;
  granted: boolean;
  rationale: string;
  decision_maker: DecisionMaker;
}

export interface DataAccessEntry {
  role_id: string;
  data_entity: string;
  read: boolean;
  write: boolean;
  delete: boolean;
  export: boolean;
  scope: PermissionScope;
  rationale: string;
}

export interface RoleInheritance {
  from_role_id: string;
  to_role_id: string;
  depth: number;
}

export interface AuditPolicy {
  policy_id: string;
  retention_days: number;
  audit_all_writes: boolean;
  alert_on_privilege_escalation: boolean;
  alert_on_bulk_export: boolean;
  audit_log_immutable: boolean;
  storage_strategy: StorageStrategy;
}

export interface RBACModel {
  version: number;
  roles: Role[];
  permissions: Permission[];
  permission_matrix: RolePermissionEntry[];
  data_access_matrix: DataAccessEntry[];
  role_hierarchy: RoleInheritance[];
  max_inheritance_depth: number;
  audit_policy: AuditPolicy;
}

// ── Decision & Authorization ─────────────────────────────────────────────────

export interface AuthorizationScope {
  scope_type: AuthorizationScopeType;
  stage_range?: StageName[] | null;
}

export interface DecisionEntry {
  decision_id: string;
  stage: StageName;
  decision_point: string;
  chosen_option: SteeringOption;
  decision_maker: DecisionMaker;
  authorization_scope: AuthorizationScope | null;
  status: DecisionStatus;
  revision_chain: string[];
  timestamp: string;
  superseded_by: string | null;
  reverted_to: string | null;
}

export interface DecisionLedger {
  entries: DecisionEntry[];
  total_user_decisions: number;
  total_system_decisions: number;
  total_superseded: number;
  total_reverted: number;
}

export interface RevisionBudget {
  budget_id: string;
  decision_point: string;
  max_revisions: number;
  current_count: number;
  status: BudgetStatus;
  exhaustion_action: ExhaustionAction;
}

// ── Impact Analysis ──────────────────────────────────────────────────────────

export interface AffectedNode {
  node_id: string;
  node_label: string;
  impact_type: ImpactType;
  stage: StageName;
  severity: ImpactSeverity;
}

export interface ImpactReport {
  report_id: string;
  severity: ImpactSeverity;
  plain_summary: string;
  directly_affected_nodes: AffectedNode[];
  transitively_affected_nodes: AffectedNode[];
  stages_needing_rerun: StageName[];
  invalidated_decisions: string[];
  estimated_rerun_time_seconds: number | null;
}

export interface PropagationConsent {
  report_id: string;
  user_confirmed: boolean;
  notes?: string | null;
}

// ── Audit ────────────────────────────────────────────────────────────────────

export interface AuditActor {
  actor_type: AuditActorType;
  user_id: string;
  user_role?: string | null;
  session_id: string;
}

export interface AuditTarget {
  target_type: string;
  target_id: string;
  target_label: string;
  stage: StageName;
}

export interface AuditEvent {
  event_id: string;
  timestamp: string;
  actor: AuditActor;
  action: AuditActionType;
  target: AuditTarget;
  before_state?: Record<string, unknown> | null;
  after_state?: Record<string, unknown> | null;
  authorization_ref?: string | null;
  storage_strategy: StorageStrategy;
}

// ── Checkpoint ───────────────────────────────────────────────────────────────

export interface Checkpoint {
  checkpoint_id: string;
  session_id: string;
  stage_completed: StageName;
  label: string;
  created_at: string;
  node_count: number;
  decision_count: number;
}

// ── Streaming ────────────────────────────────────────────────────────────────

export interface StreamChunk {
  chunk_id: string;
  stage: StageName;
  content: string;
  chunk_type: 'text' | 'structured' | 'error';
  timestamp: string;
}

// ── Steering Panel ───────────────────────────────────────────────────────────

export interface SteeringPanelRenderPolicy {
  view_mode: 'summary' | 'detail';
  page_size: number;
  total_pages: number;
  total_nodes: number;
  enable_comparison: boolean;
  enable_search: boolean;
}

export interface ContextWindowInfo {
  current_tokens: number;
  max_tokens: number;
  compression_ratio: number;
  strategy: LLMCallStrategy;
}

export interface SteeringPanel {
  panel_id: string;
  stage: StageName;
  title: string;
  draft_output: Record<string, unknown> | null;
  options: SteeringOption[];
  render_policy: SteeringPanelRenderPolicy;
  context_window: ContextWindowInfo | null;
}

export interface MinimalistQuestion {
  question_id: string;
  field: string;
  label: string;
  question: string;
  required: boolean;
  allow_skip: boolean;
}

export interface MinimalistDialogueResult {
  dialogue_id: string;
  answers: Array<{ field: string; answer: string; source: 'user' | 'inferred' | 'deferred' }>;
  synthesized_seed: ProblemDefinitionSeed | null;
  progress_percent: number;
}

// ── PRD Analysis ─────────────────────────────────────────────────────────────

export interface RawUserInput {
  input_id: string;
  text: string;
  source: 'chat' | 'file_upload' | 'api';
  uploaded_at: string;
}

export interface PRDAnalysisReport {
  report_id: string;
  explicit_sections: Array<{ title: string; content_summary: string }>;
  thin_sections: Array<{ title: string; content_summary: string; suggestion: string }>;
  missing_sections: Array<{ name: string; suggested_action: string }>;
  conflicts: ConflictFlag[];
  unmapped_input: UnmappedSection[];
  assumptions: AssumptionFlag[];
  detected_compliance_frameworks: string[];
  pre_populated_defaults: AuditPolicy | null;
}

export interface RichnessClassification {
  mode: RichnessMode;
  confidence: Confidence;
  classification_basis: string[];
  override_available: boolean;
}

// ── Graph (3D Visualization) ─────────────────────────────────────────────────

export interface GraphNode {
  id: string;
  label: string;
  type: 'actor' | 'capability' | 'use_case' | 'user_story' | 'task' | 'product_idea';
  stage: StageName;
  traceability: Traceability;
  position: [number, number, number];
  metadata: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  type: 'depends_on' | 'triggers' | 'contains' | 'relates_to';
}

// ── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'system';
  content: string;
  timestamp: string;
}

// ── Toast ────────────────────────────────────────────────────────────────────

export interface Toast {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
}

// ── Stage Output (generic) ───────────────────────────────────────────────────

export interface StageOutput {
  stage: StageName;
  nodes: Array<Record<string, unknown>>;
  summary: string | null;
}

// ── User ─────────────────────────────────────────────────────────────────────

export interface User {
  user_id: string;
  name: string;
  role: 'pipeline_admin' | 'pipeline_user' | 'pipeline_viewer';
}
