// types.d.ts
// Collaborative Steering Pipeline — API DTOs
// Auto-generated from API & Event Contract document

// ============================================================================
// Primitive Aliases
// ============================================================================

type ISO8601 = string;

// ============================================================================
// Shared Enums / Union Types
// ============================================================================

type Persona = "citizen_developer" | "architect" | "security_engineer";

type Permission = "pipeline_admin" | "pipeline_user" | "pipeline_viewer";

type TrustMode = "PARANOID" | "BALANCED" | "AUTO_PILOT";

type PipelineStateEnum =
  | "INITIALIZED"
  | "CLASSIFYING"
  | "AWAITING_INPUT_SEED"
  | "STAGE_RUNNING"
  | "STREAMING_CHUNKS"
  | "AWAITING_STEERING"
  | "REVISING"
  | "IMPACT_ANALYZING"
  | "AWAITING_PROPAGATION_CONSENT"
  | "CHATTING"
  | "STAGE_COMPLETED"
  | "FINAL_GATE"
  | "CODE_GENERATING"
  | "AWAITING_CODE_REVIEW"
  | "RUNNING"
  | "AWAITING_RUNTIME_FEEDBACK"
  | "DEPLOYING"
  | "DEPLOYED"
  | "FINALIZED"
  | "ERROR";

type NodeStatus =
  | "SYSTEM_GENERATED"
  | "USER_ENRICHED"
  | "USER_DEFINED"
  | "SUPERSEDED"
  | "INFERRED"
  | "DEFERRED"
  | "ORPHANED";

/** doc/api_event_contract.md §4.3 FileNode.status */
type FileNodeStatus = "generating" | "complete" | "modified" | "conflict" | "stale";

// ============================================================================
// 1. Authentication & Session
// ============================================================================

interface LoginRequest {
  /** Valid email format */
  email: string;
  /** Min 8 chars if password auth */
  password?: string;
  sso_provider?: "github" | "google" | "microsoft";
  sso_token?: string;
  persona: Persona;
  /** Default PARANOID */
  trust_mode_default?: TrustMode;
}

interface LoginResponse {
  /** JWT, 15min expiry */
  access_token: string;
  /** 7 days */
  refresh_token: string;
  user: UserProfile;
  /** UUID for pipeline session */
  session_id: string;
}

interface UserProfile {
  user_id: string;
  email: string;
  name: string;
  avatar_url?: string;
  persona: Persona;
  permissions: Permission[];
  preferences: {
    theme: "light" | "dark" | "system";
    /** BCP-47 locale */
    language: string;
    notification_channel: "websocket" | "polling" | "webhook";
    webhook_url?: string;
  };
}

interface GuestSession {
  session_id: string;
  /** 24h from creation */
  expires_at: ISO8601;
  limitations: ("no_export" | "no_checkpoint" | "paranoid_only")[];
  /** "Guest session — work will not be saved" */
  warning_banner: string;
}

interface ProjectListQuery {
  status?: "active" | "archived" | "all";
  sort_by?: "last_active" | "created_at" | "completion";
  /** Default 20, max 100 */
  limit?: number;
  offset?: number;
}

interface ProjectList {
  total: number;
  projects: ProjectSummary[];
}

interface ProjectSummary {
  project_id: string;
  project_name: string;
  /** 0-9 */
  current_stage: number;
  stage_name: string;
  /** 0-100 */
  completeness_percentage: number;
  status: "initialized" | "running" | "paused" | "completed" | "error";
  last_active_at: ISO8601;
  created_at: ISO8601;
  /** Preview screenshot */
  thumbnail_url?: string;
  checkpoint_count: number;
  has_errors: boolean;
  /** INFRASTRUCTURE_PROFILE_STALE */
  is_stale?: boolean;
}

interface CreateProjectRequest {
  /** Max 100 chars */
  project_name: string;
  description?: string;
  /** Optional seed */
  initial_input?: RawUserInput;
  template_id?: "saas" | "blog" | "api" | "mobile_backend";
  persona: Persona;
}

interface Project {
  project_id: string;
  project_name: string;
  description?: string;
  owner_id: string;
  collaborators: Collaborator[];
  current_session_id: string;
  state: SessionState;
  created_at: ISO8601;
  updated_at: ISO8601;
}

interface Collaborator {
  user_id: string;
  name: string;
  avatar_url?: string;
  role: "owner" | "editor" | "viewer";
  /** Collaboration cursor color */
  color: string;
  /** Where they are now */
  current_panel?: string;
  last_seen_at: ISO8601;
}

// ============================================================================
// 2. Onboarding Flow
// ============================================================================

interface RawUserInput {
  source: "text" | "voice" | "template";
  /** Max 50000 chars */
  text: string;
  template_id?: string;
  trust_mode?: TrustMode;
  metadata?: {
    user_agent: string;
    viewport_width: number;
    timestamp: ISO8601;
  };
}

interface InputAccepted {
  input_id: string;
  session_id: string;
  status: "accepted" | "queued";
  estimated_classification_time_ms: number;
}

interface FileUploadResult {
  file_id: string;
  file_name: string;
  file_type: "prd" | "image" | "csv" | "zip" | "git";
  file_size_bytes: number;
  /** For PDF */
  pages?: number;
  /** For PRD */
  extracted_text?: string;
  classification_hint?: "well_formed" | "minimalist" | "seed_only";
  /** For zip/git */
  legacy_analysis?: LegacyContextReport;
}

interface GitConnectRequest {
  /** Valid git URL */
  url: string;
  /** Default "main" */
  branch?: string;
  auth?: {
    type: "ssh_key" | "token" | "none";
    credentials?: string;
  };
}

interface GitConnectResult {
  repository_id: string;
  repo_name: string;
  default_branch: string;
  last_commit: string;
  /** Percentage per language */
  languages: Record<string, number>;
  detected_frameworks: string[];
  legacy_report: LegacyContextReport;
}

interface LegacyContextReport {
  existing_actors: ExistingActor[];
  existing_capabilities: ExistingCapability[];
  existing_api_routes: ExistingRoute[];
  existing_database_schema: ExistingTable[];
  /** e.g., "mvc", "microservices" */
  detected_patterns: string[];
  suggested_new_features: string[];
  conflicts: LegacyConflict[];
}

interface ExistingActor {
  actor_name: string;
  /** Pipeline actor_id if mapped */
  mapped_to?: string;
  /** 0-1 */
  confidence: number;
  source_files: string[];
}

/** Placeholder — extend as needed */
interface ExistingCapability {
  capability_name?: string;
  description?: string;
  [key: string]: any;
}

/** Placeholder — extend as needed */
interface ExistingRoute {
  path?: string;
  method?: string;
  [key: string]: any;
}

/** Placeholder — extend as needed */
interface ExistingTable {
  table_name?: string;
  columns?: Record<string, any>;
  [key: string]: any;
}

interface LegacyConflict {
  type: "database_mismatch" | "framework_conflict" | "schema_incompatibility";
  description: string;
  legacy_value: string;
  suggested_value: string;
  severity: "warning" | "blocking";
}

type RichnessMode = "WELL_FORMED" | "MINIMALIST" | "SEED_ONLY";

interface RichnessClassification {
  mode: RichnessMode;
  /** 0-1 */
  confidence: number;
  confidence_threshold: number;
  /** What's missing */
  gaps: string[];
  /** Why this mode */
  classification_basis: string[];
  /** Confidence < 0.85 */
  requires_user_review: boolean;
}

interface ClassificationOverride {
  input_id: string;
  user_selected_mode: RichnessMode;
  /** Why override */
  rationale: string;
}

/** doc/api_event_contract.md §2.1 COMPLIANCE_DETECTED — frameworks named in the PRD's compliance examples (GDPR/HIPAA/PCI-DSS/SOC2/ISO27001) */
type ComplianceFramework = "GDPR" | "HIPAA" | "PCI-DSS" | "SOC2" | "ISO27001";

/** doc/api_event_contract.md §2.1 COMPLIANCE_DETECTED payload — named in the WS table without a field list; inferred from the ComplianceBanner UI's needs */
interface ComplianceDetectionResult {
  frameworks: ComplianceFramework[];
  /** 0-1 */
  confidence: number;
  /** Setting name -> detected default value */
  audit_policy_defaults: Record<string, string>;
}

/** Alias to avoid shadowing the PRDAnalysisReport component's identifier in onboarding/ */
type PRDAnalysisReportType = PRDAnalysisReport;

interface PRDAnalysisReport {
  explicit_sections: PRDSection[];
  thin_sections: ThinSection[];
  missing_sections: MissingSection[];
  unmapped_sections: UnmappedSection[];
  conflicts: PRDConflict[];
  richness_classification: RichnessClassification;
}

interface PRDSection {
  section_name: string;
  /** 0-9 */
  mapped_to_stage: number;
  content_quality: "complete" | "partial" | "thin";
  extracted_actors?: string[];
  extracted_capabilities?: string[];
}

interface ThinSection {
  section_name: string;
  /** What's thin */
  missing_detail: string;
  /** Chat seed */
  suggested_prompt: string;
}

interface MissingSection {
  expected_section_name: string;
  pipeline_stage: number;
  severity: "blocking" | "recommended";
}

interface UnmappedSection {
  section_name: string;
  content_preview: string;
  suggested_action: "map_to_stage" | "custom_annotation" | "out_of_scope";
}

interface PRDConflict {
  conflict_type: "contradiction" | "duplicate" | "ambiguity";
  description: string;
  involved_sections: string[];
}

interface MinimalistDialogue {
  dialogue_id: string;
  questions: MinimalistQuestion[];
  estimated_completion_time_ms: number;
}

interface MinimalistQuestion {
  question_id: string;
  question_number: number;
  total_questions: number;
  question_text: string;
  input_type: "free_text" | "single_select" | "multi_select" | "numeric";
  /** For select types */
  options?: string[];
  validation_rules?: {
    min_length?: number;
    max_length?: number;
    min_value?: number;
    max_value?: number;
    required: boolean;
  };
  /** AI suggestion */
  suggested_answer?: string;
  /** Why this question */
  context?: string;
}

interface MinimalistAnswer {
  question_id: string;
  answer: string | string[] | number;
  skipped: boolean;
  override_suggested: boolean;
}

interface MinimalistResponse {
  dialogue_id: string;
  answers: MinimalistAnswer[];
}

interface DialogueResult {
  status: "complete" | "incomplete" | "validation_failed";
  /** Generated from answers */
  seed: Stage0Seed;
  next_stage: number;
  validation_errors?: ValidationError[];
}

interface SeedBuilderDialogue {
  dialogue_id: string;
  steps: SeedStep[];
  /** 0-1 */
  progress: number;
}

interface SeedStep {
  step_id: string;
  step_number: number;
  total_steps: number;
  /** e.g., "Defining users" */
  step_name: string;
  description: string;
  fields: SeedField[];
}

interface SeedField {
  field_id: string;
  field_name: string;
  field_type: "text" | "number" | "select" | "boolean";
  required: boolean;
  options?: string[];
  validation?: ValidationRule;
}

/** Placeholder — extend as needed */
interface ValidationRule {
  type?: string;
  pattern?: string;
  min?: number;
  max?: number;
  message?: string;
  [key: string]: any;
}

interface SeedBuilderResponse {
  dialogue_id: string;
  step_id: string;
  field_values: Record<string, any>;
  navigation: "next" | "back" | "submit";
}

interface Stage0Seed {
  problem_statement: string;
  target_users: string[];
  core_functionality: string[];
  constraints: string[];
  success_metrics: string[];
}

interface ScaleInputs {
  expected_total_users: number;
  peak_concurrent_users: number;
  monthly_budget_usd?: number;
  no_budget_limit: boolean;
  launch_timeline: "< 1 month" | "1-3 months" | "3-6 months" | "6+ months";
  data_volume_gb?: number;
  geographic_regions?: string[];
}

interface ScaleValidationResult {
  valid: boolean;
  conflicts: ScaleInputConflict[];
  sanitized_inputs: ScaleInputs;
}

interface ScaleInputConflict {
  conflict_type: "concurrent_exceeds_total" | "budget_timeline_mismatch" | "unsupported_region";
  description: string;
  affected_fields: string[];
  suggested_fix: string;
}

interface HostingOptionsMatrix {
  scale_persona: "SMALL" | "MEDIUM" | "LARGE" | "ENTERPRISE";
  options: HostingOption[];
  generation_time_ms: number;
}

interface HostingOption {
  option_id: string;
  option_name: string;
  architecture_description: string;
  components: InfrastructureComponent[];
  estimated_monthly_cost: CostRange;
  scale_fit: "optimal" | "acceptable" | "poor";
  over_budget: boolean;
  rationale: string;
  pros: string[];
  cons: string[];
}

interface CostRange {
  low_usd: number;
  mid_usd: number;
  high_usd: number;
  /** Pricing source */
  basis: string;
  /** What assumptions drive cost */
  assumptions: string[];
  /** What's not included */
  excludes: string[];
}

interface InfrastructureComponent {
  component_type: "compute" | "database" | "cache" | "cdn" | "storage" | "queue";
  /** e.g., "AWS", "Vercel" */
  provider: string;
  /** e.g., "ECS", "Neon" */
  service_name: string;
  /** e.g., "db.t3.medium" */
  tier: string;
}

// ============================================================================
// 3. IDE Shell & Global
// ============================================================================

interface IDELayout {
  left_sidebar_width: number;
  right_sidebar_width: number;
  chat_panel_height: number;
  bottom_panel_height: number;
  left_sidebar_collapsed: boolean;
  right_sidebar_collapsed: boolean;
  bottom_panel_collapsed: boolean;
  active_center_tab: "editor" | "steering" | "graph";
  active_bottom_tab: "terminal" | "test-results" | "audit-trail";
  open_editor_tabs: EditorTab[];
  recent_searches: string[];
}

interface EditorTab {
  file_path: string;
  file_type: string;
  layer: string;
  is_modified: boolean;
  is_active: boolean;
  scroll_position: number;
  cursor_position: { line: number; column: number };
}

/** doc/api_event_contract.md §3.1 names this same shape `PipelineState` (GET /state, PIPELINE_STATE_CHANGED); §1.2 names it `SessionState` (Project.state, resume response). One shape, two doc-names. */
type PipelineState = SessionState;

interface SessionState {
  session_id: string;
  current_state: PipelineStateEnum;
  /** 0-9 */
  current_stage: number;
  stage_name: string;
  /** 0-1 within stage */
  stage_progress: number;
  /** 0-1 */
  overall_progress: number;
  trust_mode: TrustMode;
  pending_steering: boolean;
  last_activity_at: ISO8601;
  idle_suspend_minutes: number;
  idle_expire_days: number;
}

interface TrustModeChange {
  new_mode: TrustMode;
  /** True = don't retroactively approve */
  apply_to_future_only: boolean;
}

interface TrustModeResult {
  previous_mode: TrustMode;
  new_mode: TrustMode;
  /** How many future boundaries affected */
  affected_decisions: number;
  /** If changing mid-pipeline */
  warning?: string;
}

interface CommandQuery {
  /** Fuzzy search */
  query: string;
  /** Current panel */
  context?: string;
  limit?: number;
}

interface CommandList {
  commands: IDECommand[];
}

interface IDECommand {
  id: string;
  name: string;
  description: string;
  category: "navigation" | "action" | "recent" | "settings";
  /** e.g., "Cmd+Shift+P" */
  shortcut?: string;
  /** Lucide icon name */
  icon: string;
  /** Context-dependent */
  available: boolean;
  /** Event to emit */
  action_type: string;
}

interface CommandExecute {
  command_id: string;
  args?: Record<string, any>;
  context: {
    current_panel: string;
    selected_node_id?: string;
    selected_file_path?: string;
  };
}

interface CommandResult {
  success: boolean;
  action_taken: string;
  navigation_target?: string;
  error?: string;
}

// ============================================================================
// 4. Primary Panels
// ============================================================================

interface ChatHistoryQuery {
  /** Default 50 */
  limit?: number;
  /** Pagination */
  before_message_id?: string;
  search_query?: string;
  /** Include system messages */
  include_system: boolean;
}

interface ChatHistory {
  messages: ChatMessage[];
  has_more: boolean;
  total_count: number;
}

interface ChatMessage {
  message_id: string;
  message_type: "user_intent" | "user_command" | "user_feedback" | "system_response" | "rich_card";
  sender: "user" | "system" | "context_agent";
  content: string;
  timestamp: ISO8601;
  edited_at?: ISO8601;
  /** Thread */
  parent_message_id?: string;
  rich_card?: RichCard;
  command_payload?: CommandPayload;
  linked_decision_id?: string;
  linked_audit_event_id?: string;
  /** Parsed intent */
  intent_matched?: string;
  /** Resulting action */
  action_taken?: string;
}

interface RichCard {
  card_type: "steering_panel" | "impact_report" | "code_stream" | "test_result" | "error_recovery";
  title: string;
  /** Type-specific data */
  payload: any;
  actions: CardAction[];
  collapsible: boolean;
  default_collapsed: boolean;
}

interface CardAction {
  action_id: string;
  label: string;
  action_type: "steering_action" | "navigation" | "api_call";
  payload?: any;
  style: "primary" | "secondary" | "danger";
}

interface CommandPayload {
  /** e.g., "/steer" */
  command: string;
  args: string[];
  parsed_intent?: string;
}

/** Inbound chat message (user-sent) */
interface ChatMessageInbound {
  text: string;
  message_type: "user_intent" | "user_command" | "user_feedback";
  intent?: "command" | "question" | "what_if";
  context_node_id?: string;
  context_file_path?: string;
}

interface SteeringPanel {
  stage_id: number;
  stage_name: string;
  stage_description: string;
  draft_output: DraftNode[];
  options: SteeringOption[];
  /** "Why these outputs" */
  context_window: string;
  render_policy: SteeringPanelRenderPolicy;
  trust_mode: string;
  auto_approved_count: number;
  paused_count: number;
  critical_count: number;
  total_nodes: number;
}

interface SteeringPanelRenderPolicy {
  default_mode: "summary" | "detail";
  /** 20 */
  summary_page_size: number;
  detail_expanded_id?: string;
}

interface DraftNode {
  node_id: string;
  node_type: string;
  name: string;
  description: string;
  layer: string;
  risk_classification: "LOW_RISK" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "auto_approved" | "paused" | "requires_authorization";
  downstream_count: number;
  bookmarked: boolean;
  selected: boolean;
  /** For CRITICAL */
  consent_required?: boolean;
  /** Detail mode only */
  full_data?: any;
}

type SteeringOptionType = "accept" | "modify" | "replace" | "authorize";

interface SteeringOption {
  option_id: string;
  option_type: SteeringOptionType;
  label: string;
  description: string;
  requires_authorization: boolean;
  authorization_scope?: string;
}

interface SteeringActionPayload {
  selected_node_ids?: string[];
  modified_nodes?: ModifiedNode[];
  replacement_text?: string;
  authorization_scope?: string;
  notes?: string;
}

interface SteeringAction {
  action_type: SteeringOptionType;
  stage_id: number;
  payload: SteeringActionPayload;
  timestamp: ISO8601;
}

interface ModifiedNode {
  node_id: string;
  /** e.g., "name" or "description" */
  field_path: string;
  new_value: any;
  old_value: any;
}

interface SteeringResult {
  success: boolean;
  decision_id: string;
  next_state: PipelineStateEnum;
  impacted_nodes?: number;
  propagation_required: boolean;
  checkpoint_id?: string;
}

interface BookmarkToggle {
  option_id: string;
  bookmarked: boolean;
}

interface FileListQuery {
  /** Directory path, default root */
  path?: string;
  /** Filter by layer */
  layer?: string;
  include_generated: boolean;
  include_user_edited: boolean;
}

interface FileTree {
  root: FileNode;
}

interface FileNode {
  path: string;
  name: string;
  type: "file" | "directory";
  layer: string;
  status: FileNodeStatus;
  size_bytes?: number;
  children?: FileNode[];
  provenance?: FileProvenance;
  last_modified: ISO8601;
}

interface FileReadRequest {
  path: string;
  /** For historical */
  version?: string;
}

interface FileContent {
  path: string;
  content: string;
  encoding: "utf-8" | "base64";
  /** For syntax highlighting */
  language: string;
  version: string;
  provenance: FileProvenance;
  is_generated: boolean;
  is_editable: boolean;
}

interface FileWriteRequest {
  path: string;
  content: string;
  encoding?: "utf-8" | "base64";
  source: "user_edit" | "regeneration" | "steering";
  steering_instruction?: string;
}

interface FileDeleteRequest {
  path: string;
  /** False = trash */
  permanent: boolean;
  rationale?: string;
}

interface ProvenanceQuery {
  path: string;
}

interface ProvenanceInfo {
  file_path: string;
  /** Plain English */
  why_this_file_exists: string;
  decision_chain: ProvenanceStep[];
  task_id: string;
  story_id: string;
  decision_entry_id: string;
  checkpoint_id: string;
  generated_at: ISO8601;
  generated_by: string;
}

interface ProvenanceStep {
  stage: number;
  stage_name: string;
  decision_id: string;
  decision_summary: string;
  timestamp: ISO8601;
}

interface FileProvenance {
  task_id: string;
  story_id: string;
  decision_entry_id: string;
  checkpoint_id: string;
  generation_timestamp: ISO8601;
}

interface DiffRequest {
  file_path: string;
  base_version?: string;
  /** Default current */
  compare_version?: string;
}

interface DiffResult {
  file_path: string;
  additions: DiffLine[];
  deletions: DiffLine[];
  modifications: DiffLine[];
  unchanged: number;
}

interface DiffLine {
  line_number: number;
  content: string;
  type: "addition" | "deletion" | "modification";
}

interface MergeRequest {
  file_path: string;
  base_content: string;
  ours_content: string;
  theirs_content: string;
  resolution: "accept_ours" | "accept_theirs" | "manual";
  manual_output?: string;
}

interface MergeResult {
  file_path: string;
  merged_content: string;
  conflicts_remaining: number;
  success: boolean;
}

interface RuntimeStartRequest {
  environment?: "development" | "production";
  hot_reload: boolean;
  preview_device?: "desktop" | "tablet" | "mobile";
}

interface RuntimeStartResult {
  sandbox_id: string;
  preview_url: string;
  status: "starting" | "running" | "error";
  startup_steps: StartupStep[];
}

interface StartupStep {
  step_number: number;
  step_name: string;
  status: "pending" | "active" | "complete" | "failed";
  logs?: string;
}

interface RuntimeStatus {
  sandbox_id: string;
  status: "stopped" | "starting" | "running" | "error" | "crashed";
  preview_url?: string;
  port_mappings: PortMapping[];
  uptime_seconds: number;
  resource_usage: {
    cpu_percent: number;
    memory_mb: number;
  };
}

interface PortMapping {
  internal_port: number;
  external_port: number;
  protocol: "http" | "https" | "tcp";
}

interface RuntimeCommand {
  command: string;
  args: string[];
  working_directory?: string;
  timeout_seconds?: number;
}

interface RuntimeCommandResult {
  exit_code: number;
  stdout: string;
  stderr: string;
  execution_time_ms: number;
}

interface PreviewFeedback {
  text: string;
  element_selector?: string;
  component_path?: string;
  story_id?: string;
  feedback_type: "change" | "validation" | "rbac" | "general";
  /** Base64, optional */
  screenshot?: string;
}

interface DependencyInstallStatus {
  status: "in_progress" | "done" | "failed";
  step: "resolving" | "downloading" | "linking" | "building";
  progress_percent: number;
  current_package?: string;
  logs: string;
  error?: string;
}

interface TestRunRequest {
  filter?: "all" | "failed" | "passed";
  file_pattern?: string;
  timeout_seconds?: number;
}

interface TestRunResult {
  run_id: string;
  status: "running" | "completed" | "failed";
  summary: TestSummary;
}

interface TestListQuery {
  run_id?: string;
  status?: "pass" | "fail" | "pending";
  file_path?: string;
}

interface TestList {
  tests: TestResult[];
  summary: TestSummary;
}

interface TestResult {
  test_id: string;
  test_name: string;
  file_path: string;
  status: "pass" | "fail" | "pending" | "skipped";
  duration_ms: number;
  assertion_count: number;
  failure_message?: string;
  stack_trace?: string;
  expected?: string;
  actual?: string;
  line_number?: number;
}

interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  pending: number;
  skipped: number;
  total_duration_ms: number;
  /** 0-1 */
  pass_rate: number;
}

interface GraphQuery {
  node_types?: string[];
  layers?: string[];
  /** Traversal depth */
  depth?: number;
  include_files: boolean;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: {
    total_nodes: number;
    max_depth: number;
    layers_present: string[];
  };
}

interface GraphNode {
  id: string;
  type: "actor" | "capability" | "use_case" | "user_story" | "engineering_task" | "file";
  name: string;
  layer: string;
  status: NodeStatus;
  /** Layout position */
  x?: number;
  y?: number;
  /** For 3D */
  z?: number;
  /** Full node data */
  data: any;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: "dependency" | "traceability" | "provenance";
  label?: string;
}

interface WhatIfRequest {
  node_id: string;
  proposed_changes: Record<string, any>;
}

interface WhatIfResult {
  affected_nodes: AffectedNode[];
  severity_breakdown: {
    success: number;
    warning: number;
    error: number;
  };
  files_to_regenerate: string[];
  estimated_regen_time_seconds: number;
  can_commit: boolean;
  blocking_reasons?: string[];
}

interface AffectedNode {
  node_id: string;
  node_type: string;
  name: string;
  severity: "success" | "warning" | "error";
  reason: string;
  /** Hops from changed node */
  distance: number;
}

/** doc/api_event_contract.md §10.2 IMPACT_REPORT_READY — named without a field list; modeled on WhatIfResult's affected_nodes (§4.8), the closest documented analog used by the same Chat/Steering impact UI */
interface ImpactReport {
  report_id: string;
  affected_nodes: AffectedNode[];
  stages_to_rerun: string[];
}

interface LedgerQuery {
  status?: "active" | "superseded" | "cancelled" | "all";
  stage?: number;
  layer?: string;
  from_date?: ISO8601;
  to_date?: ISO8601;
  search?: string;
  limit?: number;
  offset?: number;
}

interface DecisionLedger {
  entries: DecisionEntry[];
  total_count: number;
  revision_budget_remaining: number;
  revision_budget_total: number;
}

interface DecisionEntry {
  entry_id: string;
  decision_type: "steering" | "system_authorized" | "user_override" | "revision" | "revert";
  stage: number;
  stage_name: string;
  summary: string;
  status: "active" | "superseded" | "cancelled";
  /** Full decision data */
  payload: any;
  provenance: ProvenanceChain;
  metadata: {
    layer: string;
    risk_classification: string;
    auto_approved: boolean;
    trust_mode_at_decision: string;
  };
  created_at: ISO8601;
  created_by: string;
  superseded_by?: string;
  revision_chain?: string[];
}

interface ProvenanceChain {
  previous_entry_id?: string;
  parent_decision_id?: string;
  trigger_event: string;
  context_snapshot_id: string;
}

interface AuditQuery {
  session_id?: string;
  actor_id?: string;
  action?: "steering" | "codegen" | "system" | "error";
  stage?: number;
  from_date?: ISO8601;
  to_date?: ISO8601;
  type?: "DIFF" | "FULL" | "REFERENCE";
  limit?: number;
  offset?: number;
}

interface AuditTrail {
  events: AuditEvent[];
  total_count: number;
  storage_used_bytes: number;
  storage_budget_bytes: number;
  retention_days: number;
}

interface AuditEvent {
  event_id: string;
  timestamp: ISO8601;
  session_id: string;
  actor: {
    user_id: string;
    role: string;
  };
  action: string;
  stage?: number;
  target: {
    target_type: string;
    target_id: string;
  };
  description: string;
  before_state?: any;
  after_state?: any;
  diff?: any;
  authorization_ref?: string;
  storage_tier: "DIFF" | "FULL" | "REFERENCE";
}

interface RevisionRequest {
  original_decision_id: string;
  new_choice: SteeringOption;
  rationale: string;
}

interface RevisionResult {
  revision_id: string;
  impact_report_id: string;
  propagation_required: boolean;
  budget_remaining: number;
}

interface RevertRequest {
  target_decision_id: string;
  rationale: string;
}

interface RevertResult {
  new_entry_id: string;
  reverted_to_id: string;
  impact_report_id: string;
}

// ============================================================================
// 5. Node CRUD & Editors
// ============================================================================

interface Node {
  node_id: string;
  node_type: "root" | "actor" | "capability" | "use_case" | "user_story" | "engineering_task" | "custom_annotation";
  name: string;
  description: string;
  layer: string;
  status: NodeStatus;
  parent_id?: string;
  children_ids: string[];
  provenance: NodeProvenance;
  created_at: ISO8601;
  updated_at: ISO8601;
  created_by: string;
  version: number;
}

interface NodeProvenance {
  generated_at_stage: number;
  decision_entry_id: string;
  checkpoint_id: string;
  llm_call_id?: string;
}

interface CreateNodeRequest {
  node_type: string;
  parent_id?: string;
  data: Record<string, any>;
  source: "user" | "system";
}

interface UpdateNodeRequest {
  data: Record<string, any>;
  source: "user_edit" | "steering" | "enrichment";
  change_rationale?: string;
}

interface DeleteNodeRequest {
  /** False = deactivate */
  permanent: boolean;
  delete_downstream: boolean;
  rationale: string;
}

interface EnrichRequest {
  enrichment_type: "auto" | "manual";
  /** For manual */
  selected_suggestions?: string[];
  fields_to_enrich?: string[];
}

interface EnrichResult {
  enriched_fields: Record<string, { before: any; after: any }>;
  new_suggestions: EnrichmentSuggestion[];
  completeness_score_before: number;
  completeness_score_after: number;
  impact_report_id?: string;
}

interface EnrichmentSuggestion {
  suggestion_id: string;
  field_path: string;
  suggested_value: any;
  rationale: string;
  /** 0-1 */
  confidence: number;
}

interface ValidationResult {
  valid: boolean;
  completeness_score: number;
  required_fields: ValidationField[];
  prd_compliance: PRDComplianceCheck[];
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

interface ValidationField {
  field_path: string;
  field_name: string;
  present: boolean;
  value: any;
  required: boolean;
  rule: string;
}

interface PRDComplianceCheck {
  acceptance_criterion_id: string;
  criterion: string;
  passed: boolean;
  prd_reference: string;
}

interface ValidationError {
  field_path: string;
  error_code: string;
  message: string;
  severity: "blocking" | "critical";
  suggested_fix?: string;
}

interface ValidationWarning {
  field_path: string;
  warning_code: string;
  message: string;
  severity: "warning" | "info";
}

interface UseCase extends Node {
  primary_actor_id: string;
  secondary_actor_ids: string[];
  preconditions: string[];
  main_flow: UseCaseStep[];
  alternative_flows: AlternativeFlow[];
  postconditions: string[];
  success_criteria: string[];
}

interface UseCaseStep {
  step_number: number;
  description: string;
  actor_performing: string;
  system_response?: string;
}

interface AlternativeFlow {
  flow_id: string;
  flow_name: string;
  trigger_condition: string;
  steps: UseCaseStep[];
}

interface UserStory extends Node {
  /** "As a [role], I want [goal], so that [benefit]" */
  title: string;
  actor_id: string;
  /** Fibonacci */
  story_points: number;
  priority: "Must Have" | "Should Have" | "Could Have";
  acceptance_criteria: AcceptanceCriterion[];
  technical_notes: string;
  /** node_ids */
  dependencies: string[];
}

interface AcceptanceCriterion {
  ac_id: string;
  given: string;
  when: string;
  then: string;
  /** All three clauses present */
  complete: boolean;
}

interface EngineeringTask extends Node {
  estimated_hours: number;
  complexity: "Low" | "Medium" | "High" | "Critical";
  preconditions: string[];
  postconditions: string[];
  file_paths: string[];
  tech_stack_requirements: string[];
  database_schema_changes?: string;
  access_guards: AccessGuard[];
  parent_story_id: string;
}

interface AccessGuard {
  guard_type: "authorization" | "authentication" | "input_validation" | "rate_limiting";
  description: string;
  implementation_hint?: string;
}

/**
 * §5 only specifies UseCase/UserStory/EngineeringTask as concrete `extends Node`
 * blocks — Actor and Capability have no DTO block at all, despite being the
 * node types Stage 2/3 actually produce. Fields below are sourced from the
 * Actor/Capability Editor wireframe (doc/wireframes.md missing-screens §1.4),
 * the only place these fields are specified.
 */
interface Actor extends Node {
  actor_type: "Primary" | "Secondary" | "System" | "External";
  /** Emoji selector value */
  icon?: string;
  goals: string[];
  pain_points: string[];
  technical_proficiency: "Low" | "Medium" | "High";
  /** RBAC role name this actor maps to */
  role_name: string;
  /** RBACPermission ids granted to this actor's role */
  permissions: string[];
  data_access_level: "None" | "Own" | "Department" | "All";
}

type MoscowPriority = "Must Have" | "Should Have" | "Could Have" | "Won't Have";

/** doc/wireframes.md missing-screens §1.4 — same gap as Actor, see comment above */
interface Capability extends Node {
  priority: MoscowPriority;
  in_scope: string[];
  out_of_scope: string[];
  business_value: string;
  /** UseCase node_ids downstream of this capability */
  linked_use_case_ids: string[];
}

// ============================================================================
// 6. Advisory Modules
// ============================================================================

interface RBACModel {
  version: number;
  roles: RBACRole[];
  permissions: RBACPermission[];
  role_permissions: RolePermissionEntry[];
  inheritance_graph: InheritanceGraph;
  data_access_matrix: DataAccessEntry[];
}

interface RBACRole {
  role_id: string;
  role_name: string;
  parent_role_id?: string;
  description: string;
}

interface RBACPermission {
  permission_id: string;
  resource: string;
  action: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  description: string;
}

interface RolePermissionEntry {
  entry_id: string;
  role_id: string;
  permission_id: string;
  granted: boolean;
  /** Required if granted=true */
  rationale: string;
  /** Required if granted=true */
  decision_maker: string;
  conditions?: string[];
}

interface InheritanceGraph {
  nodes: { role_id: string; depth: number }[];
  edges: { from: string; to: string }[];
  max_depth: number;
  /** Detected cycles */
  cycles: string[][];
}

interface DataAccessEntry {
  role_id: string;
  entity: string;
  access_level: "None" | "Own" | "Department" | "All";
  rationale: string;
  guard?: string;
}

interface RBACModelUpdate {
  /** Must match current (optimistic locking) */
  version: number;
  changes: RBACChange[];
}

interface RBACChange {
  change_type: "add_role" | "remove_role" | "add_permission" | "grant" | "revoke" | "set_inheritance";
  target_id: string;
  new_value: any;
}

interface RBACValidationResult {
  valid: boolean;
  inheritance_cycles: string[][];
  privilege_escalations: EscalationPath[];
  missing_rationales: string[];
  depth_violations: string[];
}

interface EscalationPath {
  /** Role chain */
  path: string[];
  resulting_access: string;
  depth: number;
  algorithm: "STATIC_ESCALATION_ANALYSIS";
}

interface RBACCommitRequest {
  /** Override warnings */
  force?: boolean;
  rationale: string;
}

interface RBACCommitResult {
  committed_version: number;
  audit_event_id: string;
  generated_middleware_files: string[];
}

interface HostingSelection {
  option_id: string;
  modified_fields?: Record<string, any>;
  override_budget_warning?: boolean;
}

interface InfrastructureProfile {
  profile_id: string;
  selected_option: HostingOption;
  scale_persona: string;
  committed_at: ISO8601;
  committed_by: string;
  stale: boolean;
  stale_reason?: string;
  /** Terraform, Docker, etc. */
  generated_files: string[];
}

interface TechStackSelection {
  option_id: string;
  modified_fields?: Record<string, any>;
}

interface TechStackProfile {
  profile_id: string;
  frontend: TechStackComponent;
  backend: TechStackComponent;
  database: TechStackComponent;
  cache?: TechStackComponent;
  auth: TechStackComponent;
  hosting: TechStackComponent;
  committed_at: ISO8601;
  rationale: string;
}

interface TechStackComponent {
  framework: string;
  version?: string;
  language: string;
  justification: string;
}

// ============================================================================
// 7. Governance & Audit
// ============================================================================

interface CheckpointList {
  checkpoints: CheckpointSummary[];
}

interface CheckpointSummary {
  checkpoint_id: string;
  stage: number;
  stage_name: string;
  label: string;
  created_at: ISO8601;
  created_by: string;
  node_count: number;
  file_size_bytes: number;
  auto_generated: boolean;
}

interface Checkpoint {
  checkpoint_id: string;
  stage: number;
  stage_name: string;
  label: string;
  state_snapshot: SessionState;
  decision_ledger_snapshot: DecisionEntry[];
  workspace_snapshot?: WorkspaceSnapshot;
  created_at: ISO8601;
  created_by: string;
}

/** Placeholder — extend as needed */
interface WorkspaceSnapshot {
  files?: FileContent[];
  nodes?: Node[];
  [key: string]: any;
}

interface CreateCheckpointRequest {
  label?: string;
  include_workspace: boolean;
}

interface RestoreCheckpointRequest {
  checkpoint_id: string;
  /** "RESTORE CHECKPOINT-{id}" */
  safety_phrase: string;
  /** True = discard later checkpoints */
  discard_after: boolean;
}

interface RestoreResult {
  success: boolean;
  restored_checkpoint_id: string;
  new_session_id: string;
  discarded_checkpoints?: string[];
  rollback_stage: number;
}

interface BranchList {
  active_branch: string;
  branches: Branch[];
}

interface Branch {
  branch_id: string;
  branch_name: string;
  based_on_checkpoint_id: string;
  created_at: ISO8601;
  created_by: string;
  node_count: number;
  status: "open" | "merged" | "discarded";
  changes_summary: string[];
}

interface CreateBranchRequest {
  branch_name: string;
  from_checkpoint_id: string;
  proposed_changes: Record<string, any>;
}

interface MergeBranchRequest {
  /** Usually "main" */
  target_branch: string;
  resolution_strategy: "auto" | "manual";
  manual_resolutions?: Record<string, "ours" | "theirs">;
}

/** doc/api_event_contract.md §7.2 — distinct from the file-merge MergeResult in §4.4 */
interface BranchMergeResult {
  success: boolean;
  merged_branch_id: string;
  conflicts: MergeConflict[];
  new_checkpoint_id: string;
}

interface MergeConflict {
  conflict_id: string;
  node_id: string;
  field: string;
  base_value: any;
  ours_value: any;
  theirs_value: any;
  resolved_value?: any;
}

// ============================================================================
// 8. Code Generation & Runtime
// ============================================================================

interface CodeGenRequest {
  /** Specific tasks, or all */
  target_nodes?: string[];
  regenerate_files?: string[];
  include_tests: boolean;
  include_infrastructure: boolean;
}

interface CodeGenStart {
  generation_id: string;
  total_files: number;
  estimated_duration_seconds: number;
}

interface CodeGenStatus {
  generation_id: string;
  status: "queued" | "running" | "completed" | "failed";
  files_completed: number;
  files_total: number;
  current_file?: string;
  errors: CodeGenError[];
}

interface CodeGenError {
  file_path: string;
  error_type: "syntax" | "dependency" | "template" | "merge_conflict";
  message: string;
  recoverable: boolean;
}

/**
 * NOT part of doc/api_event_contract.md §8.1 (which only models a
 * project-aggregate `CodeGenStatus`, no per-task breakdown or pause/cancel
 * state) — added after the contract was written to back the code-generation
 * progress panel, same precedent as `llmConfig.ts`/the log viewer endpoints.
 * Mirrors `be/`'s `modules/code_generation/domain/generation_job.py::TaskGenerationStatus`.
 */
interface TaskGenerationStatus {
  task_id: string;
  file_paths: string[];
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  files_completed: number;
  files_total: number;
  current_file?: string;
  error?: CodeGenError;
}

/** WS `CODE_FILE_STREAM` payload (§4.3, §8.1) — not in the original generated set, added alongside GeneratedFile */
interface CodeFileChunk {
  file_path: string;
  content_delta: string;
  layer: string;
  task_id: string;
}

interface GeneratedFile {
  file_path: string;
  content: string;
  content_hash: string;
  size_bytes: number;
  layer: string;
  task_id: string;
  provenance: FileProvenance;
  language: string;
}

interface DeployRequest {
  target: "vercel" | "aws_amplify" | "netlify" | "kubernetes";
  environment_variables: Record<string, string>;
  domain?: string;
  ssl: boolean;
}

interface DeployStart {
  deployment_id: string;
  preview_url?: string;
  status: "queued" | "building" | "deploying" | "ready" | "failed";
}

interface DeployStatus {
  deployment_id: string;
  status: string;
  build_logs: string[];
  health_checks: HealthCheck[];
  url?: string;
  qr_code_url?: string;
}

interface HealthCheck {
  check_name: string;
  status: "pass" | "fail" | "pending";
  response_time_ms?: number;
}

// ============================================================================
// 9. Cross-Cutting
// ============================================================================

interface SearchQuery {
  /** Search string */
  q: string;
  /** Routes query to ContextAgent if "audit" or "chat" */
  panel_context?: "global" | "audit" | "chat";
  filters?: {
    types?: ("decision" | "node" | "file" | "audit")[];
    stages?: number[];
    layers?: string[];
    date_from?: ISO8601;
    date_to?: ISO8601;
  };
  limit?: number;
}

interface SearchResult {
  query: string;
  results: SearchResultItem[];
  total: number;
  suggested_queries: string[];
}

interface SearchResultItem {
  result_id: string;
  result_type: "decision" | "node" | "file" | "audit_event";
  title: string;
  snippet: string;
  relevance_score: number;
  metadata: any;
  navigation_target: string;
}

interface ToastNotification {
  id: string;
  severity: "success" | "warning" | "error" | "info";
  title: string;
  body?: string;
  actions?: { label: string; action_type: string; payload?: any }[];
  /** Null = never */
  auto_dismiss_seconds?: number;
  timestamp: ISO8601;
}

interface PipelineError {
  error_code: string;
  message: string;
  recoverable: boolean;
  action_options: ErrorAction[];
  context: any;
}

interface ErrorAction {
  label: string;
  action_type: "retry" | "modify" | "skip" | "restore_checkpoint" | "abort";
  payload?: any;
}

interface LLMFailure {
  failure_type: "timeout" | "malformed_json" | "context_overflow" | "rate_limit" | "empty_response";
  prompt_id: string;
  stage: number;
  partial_output?: any;
  retry_after_seconds?: number;
  queue_position?: number;
}

interface AutoSavePayload {
  active_files: EditorTab[];
  unsaved_changes: Record<string, string>;
  timestamp: ISO8601;
}

interface RecoveryData {
  has_recovery_data: boolean;
  recovery_timestamp?: ISO8601;
  recovered_stage?: number;
  /** "Restore from recovery or discard?" */
  prompt: string;
}

// ============================================================================
// 10. Event-Only Payload Types
// Named in api_event_contract.md §10.1/§10.2's event summary tables but never
// given a field list in a §1-9 DTO block. Inferred from the nearest
// documented analog; each cites what it was inferred from.
// ============================================================================

/** §6.1 RBAC_CONFLICT_DETECTED — modeled on RolePermissionEntry conflicts */
interface PermissionConflict {
  conflict_id: string;
  role_id: string;
  permission_id: string;
  conflict_type: "duplicate_grant" | "contradictory_grant" | "inheritance_override";
  description: string;
}

/** §10.2 NODE_COMMITTED — Node plus the confirmation context the Audit/Graph targets imply */
interface CommittedNode extends Node {
  decision_id: string;
  committed_at: ISO8601;
}

/**
 * §8.1 CODE_GENERATION_COMPLETE. Not fully specified by either spec doc
 * (doc/prd.md SS4.8/Glossary only says "generated file inventory with
 * run/test/build commands") — corrected here to match what `be/`'s
 * `modules/code_generation/domain/workspace.py::WorkspaceManifest` actually
 * sends (this previously guessed a richer shape before the backend existed).
 */
interface WorkspaceManifest {
  project_id: string;
  files: string[];
  run_command: string;
  test_command?: string;
  build_command?: string;
}

/** §10.2 PIPELINE_COMPLETE — modeled on SessionState's terminal fields */
interface PipelineCompletion {
  session_id: string;
  final_stage: number;
  total_nodes: number;
  completed_at: ISO8601;
}

/** §10.2 MERGE_CONFLICT — multi-user analog of EditorConflict (§4.4 EDITOR_CONFLICT) */
interface MergeConflictInfo {
  file_path: string;
  base: string;
  ours: string;
  theirs: string;
  conflicting_user_id?: string;
}

/** §10.2 CHUNK_STREAM — generic form of CHAT_STREAM/CODE_FILE_STREAM for other streamed surfaces */
interface StreamChunk {
  stream_id: string;
  delta: string;
  index: number;
  done: boolean;
}

/** §10.1 MID_STAGE_STEER — modeled on the existing ClientEventMap shape used by Chat/Editor */
interface MidSteerSignal {
  stage_id: number;
  instruction: string;
  action_type: string;
  file_path?: string;
}

/** §2.5 SCALE_DIALOGUE_OPENED — named in the WS table only; §2.5's own DTO block never defines it. Inferred from the trigger ("missing signals") */
interface ScaleDialogue {
  missing_signals: string[];
  partial_inputs?: Partial<ScaleInputs>;
}

/** §6.3 TECH_STACK_OPTIONS_READY — named in the WS summary table only, absent from §6.3's own DTO block. Modeled on HostingOptionsMatrix (§2.5), the structurally closest "options matrix" pattern */
interface TechStackOption {
  option_id: string;
  option_name: string;
  stack: TechStackComponent[];
  rationale: string;
  pros: string[];
  cons: string[];
}

interface TechStackOptionsMatrix {
  options: TechStackOption[];
  generation_time_ms: number;
}
/**
 * Log viewer (Ctrl+Shift+L) - not in api_event_contract.md, same dev-tool
 * exception as llmConfig.ts's ProviderInfo (CLAUDE.md "Every DTO cites its
 * contract section"). Transcribed directly from
 * be/src/bluebox/shared_kernel/observability/log_event.py's `LogEvent`.
 */
interface LogEvent {
  log_id: string;
  project_id: string;
  trace_id: string | null;
  timestamp: string;
  duration_ms: number | null;
  category:
    | "http_sent_by_client"
    | "http_received_by_backend"
    | "ws_sent_by_client"
    | "ws_received_by_backend"
    | "ws_sent_by_backend"
    | "ws_received_by_client"
    | "llm_call";
  summary: string;
  detail: Record<string, unknown>;
}
