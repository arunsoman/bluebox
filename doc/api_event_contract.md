I'll create a comprehensive API contract document mapping every screen to its REST endpoints, DTOs, and WebSocket/SSE events.

---

# Collaborative Steering Pipeline — API & Event Contract

## Document Structure
1. [Authentication & Session](#1-authentication--session)
2. [Onboarding Flow](#2-onboarding-flow)
3. [IDE Shell & Global](#3-ide-shell--global)
4. [Primary Panels](#4-primary-panels)
5. [Node CRUD & Editors](#5-node-crud--editors)
6. [Advisory Modules](#6-advisory-modules)
7. [Governance & Audit](#7-governance--audit)
8. [Code Generation & Runtime](#8-code-generation--runtime)
9. [Cross-Cutting Events](#9-cross-cutting-events)

---

## 1. Authentication & Session

### 1.1 Login / Persona Selection

**REST Endpoints:**

| Method | Path | Request DTO | Response DTO | Description |
|--------|------|-------------|--------------|-------------|
| `POST` | `/api/v1/auth/login` | `LoginRequest` | `LoginResponse` | Password/SSO auth |
| `POST` | `/api/v1/auth/biometric` | `BiometricRequest` | `LoginResponse` | WebAuthn challenge |
| `POST` | `/api/v1/auth/voice` | `VoiceAuthRequest` | `LoginResponse` | Voice print auth |
| `GET` | `/api/v1/auth/me` | — | `UserProfile` | Current user + persona |
| `POST` | `/api/v1/auth/guest` | — | `GuestSession` | Limited guest session |

**DTOs:**

```typescript
// LoginRequest
{
  email: string;           // valid email format
  password?: string;        // min 8 chars if password auth
  sso_provider?: "github" | "google" | "microsoft";
  sso_token?: string;
  persona: "citizen_developer" | "architect" | "security_engineer";
  trust_mode_default?: "PARANOID" | "BALANCED" | "AUTO_PILOT"; // default PARANOID
}

// LoginResponse
{
  access_token: string;     // JWT, 15min expiry
  refresh_token: string;    // 7 days
  user: UserProfile;
  session_id: string;       // UUID for pipeline session
}

// UserProfile
{
  user_id: string;
  email: string;
  name: string;
  avatar_url?: string;
  persona: "citizen_developer" | "architect" | "security_engineer";
  permissions: ("pipeline_admin" | "pipeline_user" | "pipeline_viewer")[];
  preferences: {
    theme: "light" | "dark" | "system";
    language: string;       // BCP-47 locale
    notification_channel: "websocket" | "polling" | "webhook";
    webhook_url?: string;
  };
}

// GuestSession
{
  session_id: string;
  expires_at: ISO8601;      // 24h from creation
  limitations: ("no_export" | "no_checkpoint" | "paranoid_only")[];
  warning_banner: string;   // "Guest session — work will not be saved"
}
```

**WebSocket Events:**
| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| C→S | `AUTH_SESSION_INIT` | `{ session_id, token }` | Authenticate WebSocket |
| S→C | `AUTH_SESSION_OK` | `{ user: UserProfile }` | Auth confirmed |
| S→C | `AUTH_SESSION_EXPIRED` | `{ reason: "token_expired" \| "idle_timeout" }` | Force re-auth |

---

### 1.2 Project Dashboard

**REST Endpoints:**

| Method | Path | Request DTO | Response DTO | Description |
|--------|------|-------------|--------------|-------------|
| `GET` | `/api/v1/projects` | `ProjectListQuery` | `ProjectList` | List user projects |
| `POST` | `/api/v1/projects` | `CreateProjectRequest` | `Project` | New project |
| `GET` | `/api/v1/projects/{project_id}` | — | `Project` | Project details |
| `DELETE` | `/api/v1/projects/{project_id}` | `DeleteProjectRequest` | `{ deleted: true }` | Archive project |
| `POST` | `/api/v1/projects/{project_id}/resume` | — | `SessionState` | Resume session |

**DTOs:**

```typescript
// ProjectListQuery
{
  status?: "active" | "archived" | "all";
  sort_by?: "last_active" | "created_at" | "completion";
  limit?: number;           // default 20, max 100
  offset?: number;
}

// ProjectList
{
  total: number;
  projects: ProjectSummary[];
}

// ProjectSummary
{
  project_id: string;
  project_name: string;
  current_stage: number;    // 0-9
  stage_name: string;
  completeness_percentage: number; // 0-100
  status: "initialized" | "running" | "paused" | "completed" | "error";
  last_active_at: ISO8601;
  created_at: ISO8601;
  thumbnail_url?: string;   // preview screenshot
  checkpoint_count: number;
  has_errors: boolean;
  is_stale?: boolean;       // INFRASTRUCTURE_PROFILE_STALE
}

// CreateProjectRequest
{
  project_name: string;     // max 100 chars
  description?: string;
  initial_input?: RawUserInput; // optional seed
  template_id?: "saas" | "blog" | "api" | "mobile_backend";
  persona: UserProfile["persona"];
}

// Project
{
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

// Collaborator
{
  user_id: string;
  name: string;
  avatar_url?: string;
  role: "owner" | "editor" | "viewer";
  color: string;            // collaboration cursor color
  current_panel?: string;   // where they are now
  last_seen_at: ISO8601;
}
```

---

## 2. Onboarding Flow

### 2.1 Landing / Empty State

**REST Endpoints:**

| Method | Path | Request DTO | Response DTO | Description |
|--------|------|-------------|--------------|-------------|
| `POST` | `/api/v1/projects/{project_id}/input` | `RawUserInput` | `InputAccepted` | Submit initial input |
| `POST` | `/api/v1/projects/{project_id}/upload` | `MultipartFile` | `FileUploadResult` | Upload PRD/zip/image |
| `POST` | `/api/v1/projects/{project_id}/git-connect` | `GitConnectRequest` | `GitConnectResult` | Connect Git repo |

**DTOs:**

```typescript
// RawUserInput
{
  source: "text" | "voice" | "template";
  text: string;             // max 50000 chars
  template_id?: string;
  trust_mode?: "PARANOID" | "BALANCED" | "AUTO_PILOT";
  metadata?: {
    user_agent: string;
    viewport_width: number;
    timestamp: ISO8601;
  };
}

// InputAccepted
{
  input_id: string;
  session_id: string;
  status: "accepted" | "queued";
  estimated_classification_time_ms: number;
}

// FileUploadResult
{
  file_id: string;
  file_name: string;
  file_type: "prd" | "image" | "csv" | "zip" | "git";
  file_size_bytes: number;
  pages?: number;           // for PDF
  extracted_text?: string;  // for PRD
  classification_hint?: "well_formed" | "minimalist" | "seed_only";
  legacy_analysis?: LegacyContextReport; // for zip/git
}

// GitConnectRequest
{
  url: string;              // valid git URL
  branch?: string;          // default "main"
  auth?: {
    type: "ssh_key" | "token" | "none";
    credentials?: string;
  };
}

// GitConnectResult
{
  repository_id: string;
  repo_name: string;
  default_branch: string;
  last_commit: string;
  languages: { [lang: string]: number }; // percentage
  detected_frameworks: string[];
  legacy_report: LegacyContextReport;
}

// LegacyContextReport
{
  existing_actors: ExistingActor[];
  existing_capabilities: ExistingCapability[];
  existing_api_routes: ExistingRoute[];
  existing_database_schema: ExistingTable[];
  detected_patterns: string[]; // e.g., "mvc", "microservices"
  suggested_new_features: string[];
  conflicts: LegacyConflict[];
}

// ExistingActor
{
  actor_name: string;
  mapped_to?: string;       // pipeline actor_id if mapped
  confidence: number;       // 0-1
  source_files: string[];
}

// LegacyConflict
{
  type: "database_mismatch" | "framework_conflict" | "schema_incompatibility";
  description: string;
  legacy_value: string;
  suggested_value: string;
  severity: "warning" | "blocking";
}
```

**WebSocket Events (Input Processing):**

| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| S→C | `INPUT_PROCESSING_STARTED` | `{ input_id, steps: ProcessingStep[] }` | Show progress |
| S→C | `PROCESSING_STEP_COMPLETE` | `{ step_index, step_name, progress_percent }` | Update bar |
| S→C | `RICHNESS_MODE_DETECTED` | `RichnessClassification` | Classification result |
| S→C | `PRD_ANALYSIS_READY` | `PRDAnalysisReport` | Full PRD analysis |
| S→C | `COMPLIANCE_DETECTED` | `ComplianceDetectionResult` | Framework chips |
| S→C | `INPUT_PROCESSING_ERROR` | `{ code, message, recoverable }` | Failure |

**SSE Stream:**
```
GET /api/v1/projects/{project_id}/input/{input_id}/progress
Content-Type: text/event-stream

event: step
data: {"step_index": 0, "name": "Receiving input", "status": "complete"}

event: step
data: {"step_index": 2, "name": "Classifying richness", "status": "active", "progress": 65}

event: classification
data: {"mode": "WELL_FORMED", "confidence": 0.94, "gaps": []}
```

---

### 2.2 Richness Classification

**REST Endpoints:**

| Method | Path | Request DTO | Response DTO | Description |
|--------|------|-------------|--------------|-------------|
| `POST` | `/api/v1/projects/{project_id}/classification/override` | `ClassificationOverride` | `ClassificationResult` | User overrides classification |

**DTOs:**

```typescript
// RichnessClassification
{
  mode: "WELL_FORMED" | "MINIMALIST" | "SEED_ONLY";
  confidence: number;       // 0-1
  confidence_threshold: number; // 0.85
  gaps: string[];           // what's missing
  classification_basis: string[]; // why this mode
  requires_user_review: boolean; // confidence < 0.85
}

// ClassificationOverride
{
  input_id: string;
  user_selected_mode: "WELL_FORMED" | "MINIMALIST" | "SEED_ONLY";
  rationale: string;        // why override
}

// PRDAnalysisReport
{
  explicit_sections: PRDSection[];
  thin_sections: ThinSection[];
  missing_sections: MissingSection[];
  unmapped_sections: UnmappedSection[];
  conflicts: PRDConflict[];
  richness_classification: RichnessClassification;
}

// PRDSection
{
  section_name: string;
  mapped_to_stage: number;  // 0-9
  content_quality: "complete" | "partial" | "thin";
  extracted_actors?: string[];
  extracted_capabilities?: string[];
}

// ThinSection
{
  section_name: string;
  missing_detail: string;   // what's thin
  suggested_prompt: string; // chat seed
}

// MissingSection
{
  expected_section_name: string;
  pipeline_stage: number;
  severity: "blocking" | "recommended";
}

// UnmappedSection
{
  section_name: string;
  content_preview: string;
  suggested_action: "map_to_stage" | "custom_annotation" | "out_of_scope";
}

// PRDConflict
{
  conflict_type: "contradiction" | "duplicate" | "ambiguity";
  description: string;
  involved_sections: string[];
}
```

---

### 2.3 Minimalist Dialogue

**REST Endpoints:**

| Method | Path | Request DTO | Response DTO | Description |
|--------|------|-------------|--------------|-------------|
| `GET` | `/api/v1/projects/{project_id}/dialogue/minimalist` | — | `MinimalistDialogue` | Get questions |
| `POST` | `/api/v1/projects/{project_id}/dialogue/minimalist` | `MinimalistResponse` | `DialogueResult` | Submit answers |

**DTOs:**

```typescript
// MinimalistDialogue
{
  dialogue_id: string;
  questions: MinimalistQuestion[];
  estimated_completion_time_ms: number;
}

// MinimalistQuestion
{
  question_id: string;
  question_number: number;
  total_questions: number;
  question_text: string;
  input_type: "free_text" | "single_select" | "multi_select" | "numeric";
  options?: string[];       // for select types
  validation_rules?: {
    min_length?: number;
    max_length?: number;
    min_value?: number;
    max_value?: number;
    required: boolean;
  };
  suggested_answer?: string; // AI suggestion
  context?: string;         // why this question
}

// MinimalistResponse
{
  dialogue_id: string;
  answers: {
    question_id: string;
    answer: string | string[] | number;
    skipped: boolean;
    override_suggested: boolean;
  }[];
}

// DialogueResult
{
  status: "complete" | "incomplete" | "validation_failed";
  seed: Stage0Seed;         // generated from answers
  next_stage: number;
  validation_errors?: ValidationError[];
}
```

---

### 2.4 Seed Builder

**REST Endpoints:**

| Method | Path | Request DTO | Response DTO | Description |
|--------|------|-------------|--------------|-------------|
| `GET` | `/api/v1/projects/{project_id}/dialogue/seed` | — | `SeedBuilderDialogue` | Get seed questions |
| `POST` | `/api/v1/projects/{project_id}/dialogue/seed` | `SeedBuilderResponse` | `DialogueResult` | Submit seed |

**DTOs:**

```typescript
// SeedBuilderDialogue
{
  dialogue_id: string;
  steps: SeedStep[];
  progress: number;         // 0-1
}

// SeedStep
{
  step_id: string;
  step_number: number;
  total_steps: number;
  step_name: string;        // e.g., "Defining users"
  description: string;
  fields: SeedField[];
}

// SeedField
{
  field_id: string;
  field_name: string;
  field_type: "text" | "number" | "select" | "boolean";
  required: boolean;
  options?: string[];
  validation?: ValidationRule;
}

// SeedBuilderResponse
{
  dialogue_id: string;
  step_id: string;
  field_values: { [field_id]: any };
  navigation: "next" | "back" | "submit";
}

// Stage0Seed
{
  problem_statement: string;
  target_users: string[];
  core_functionality: string[];
  constraints: string[];
  success_metrics: string[];
}
```

---

### 2.5 Scale Dialogue

**REST Endpoints:**

| Method | Path | Request DTO | Response DTO | Description |
|--------|------|-------------|--------------|-------------|
| `POST` | `/api/v1/projects/{project_id}/scale` | `ScaleInputs` | `ScaleValidationResult` | Submit scale inputs |
| `GET` | `/api/v1/projects/{project_id}/scale/options` | `ScaleInputs` | `HostingOptionsMatrix` | Generate options |

**DTOs:**

```typescript
// ScaleInputs
{
  expected_total_users: number;     // > 0
  peak_concurrent_users: number;    // <= total_users
  monthly_budget_usd?: number;      // >= 0 or null
  no_budget_limit: boolean;
  launch_timeline: "< 1 month" | "1-3 months" | "3-6 months" | "6+ months";
  data_volume_gb?: number;
  geographic_regions?: string[];
}

// ScaleValidationResult
{
  valid: boolean;
  conflicts: ScaleInputConflict[];
  sanitized_inputs: ScaleInputs;
}

// ScaleInputConflict
{
  conflict_type: "concurrent_exceeds_total" | "budget_timeline_mismatch" | "unsupported_region";
  description: string;
  affected_fields: string[];
  suggested_fix: string;
}

// HostingOptionsMatrix
{
  scale_persona: "SMALL" | "MEDIUM" | "LARGE" | "ENTERPRISE";
  options: HostingOption[];
  generation_time_ms: number;
}

// HostingOption
{
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

// CostRange
{
  low_usd: number;
  mid_usd: number;
  high_usd: number;
  basis: string;            // pricing source
  assumptions: string[];    // what assumptions drive cost
  excludes: string[];       // what's not included
}

// InfrastructureComponent
{
  component_type: "compute" | "database" | "cache" | "cdn" | "storage" | "queue";
  provider: string;         // e.g., "AWS", "Vercel"
  service_name: string;     // e.g., "ECS", "Neon"
  tier: string;           // e.g., "db.t3.medium"
}
```

**WebSocket Events:**
| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| S→C | `SCALE_INPUT_CONFLICT` | `ScaleInputConflict` | Real-time validation error |
| S→C | `HOSTING_OPTIONS_READY` | `HostingOptionsMatrix` | Options generated |
| S→C | `INFRASTRUCTURE_PROFILE_STALE` | `{ profile_id, stale: true }` | Inputs changed post-selection |

---

## 3. IDE Shell & Global

### 3.1 Toolbar & Layout

**REST Endpoints:**

| Method | Path | Request DTO | Response DTO | Description |
|--------|------|-------------|--------------|-------------|
| `GET` | `/api/v1/projects/{project_id}/layout` | — | `IDELayout` | Get saved layout |
| `POST` | `/api/v1/projects/{project_id}/layout` | `IDELayout` | `IDELayout` | Save layout |
| `GET` | `/api/v1/projects/{project_id}/state` | — | `PipelineState` | Current state machine |
| `POST` | `/api/v1/projects/{project_id}/trust-mode` | `TrustModeChange` | `TrustModeResult` | Change trust mode |

**DTOs:**

```typescript
// IDELayout
{
  left_sidebar_width: number;      // 260-480
  right_sidebar_width: number;     // 320-640
  chat_panel_height: number;       // 160-80% of sidebar
  bottom_panel_height: number;     // 120-480
  left_sidebar_collapsed: boolean;
  right_sidebar_collapsed: boolean;
  bottom_panel_collapsed: boolean;
  active_center_tab: "editor" | "steering" | "graph";
  active_bottom_tab: "terminal" | "test-results" | "audit-trail";
  open_editor_tabs: EditorTab[];
  recent_searches: string[];
}

// EditorTab
{
  file_path: string;
  file_type: string;
  layer: string;
  is_modified: boolean;
  is_active: boolean;
  scroll_position: number;
  cursor_position: { line: number; column: number };
}

// PipelineState
{
  session_id: string;
  current_state: PipelineStateEnum;
  current_stage: number;           // 0-9
  stage_name: string;
  stage_progress: number;          // 0-1 within stage
  overall_progress: number;        // 0-1
  trust_mode: "PARANOID" | "BALANCED" | "AUTO_PILOT";
  pending_steering: boolean;
  last_activity_at: ISO8601;
  idle_suspend_minutes: number;
  idle_expire_days: number;
}

// PipelineStateEnum
  "INITIALIZED"
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

// TrustModeChange
{
  new_mode: "PARANOID" | "BALANCED" | "AUTO_PILOT";
  apply_to_future_only: boolean;   // true = don't retroactively approve
}

// TrustModeResult
{
  previous_mode: string;
  new_mode: string;
  affected_decisions: number;     // how many future boundaries affected
  warning?: string;               // if changing mid-pipeline
}
```

**WebSocket Events (Global State):**
| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| S→C | `STATE_TRANSITION` | `{ from_state, to_state, reason, timestamp }` | State machine change |
| S→C | `PIPELINE_STATE_CHANGED` | `PipelineState` | Full state update |
| S→C | `STAGE_COMPLETED` | `{ stage, checkpoint_id, node_count }` | Stage done |
| S→C | `CHECKPOINT_CREATED` | `Checkpoint` | Auto-checkpoint |
| C→S | `CHECKPOINT_REQUEST` | `{ action: "create" \| "restore", checkpoint_id? }` | Manual checkpoint |

---

### 3.2 Command Palette

**REST Endpoints:**

| Method | Path | Request DTO | Response DTO | Description |
|--------|------|-------------|--------------|-------------|
| `GET` | `/api/v1/projects/{project_id}/commands` | `CommandQuery` | `CommandList` | Available commands |
| `POST` | `/api/v1/projects/{project_id}/commands/execute` | `CommandExecute` | `CommandResult` | Execute command |

**DTOs:**

```typescript
// CommandQuery
{
  query: string;            // fuzzy search
  context?: string;          // current panel
  limit?: number;
}

// CommandList
{
  commands: IDECommand[];
}

// IDECommand
{
  id: string;
  name: string;
  description: string;
  category: "navigation" | "action" | "recent" | "settings";
  shortcut?: string;        // e.g., "Cmd+Shift+P"
  icon: string;             // Lucide icon name
  available: boolean;       // context-dependent
  action_type: string;      // event to emit
}

// CommandExecute
{
  command_id: string;
  args?: { [key: string]: any };
  context: {
    current_panel: string;
    selected_node_id?: string;
    selected_file_path?: string;
  };
}

// CommandResult
{
  success: boolean;
  action_taken: string;
  navigation_target?: string;
  error?: string;
}
```

---

## 4. Primary Panels

### 4.1 Chat Panel

**REST Endpoints:**

| Method | Path | Request DTO | Response DTO | Description |
|--------|------|-------------|--------------|-------------|
| `GET` | `/api/v1/projects/{project_id}/chat` | `ChatHistoryQuery` | `ChatHistory` | Get messages |
| `POST` | `/api/v1/projects/{project_id}/chat` | `ChatMessage` | `ChatMessage` | Send message |
| `DELETE` | `/api/v1/projects/{project_id}/chat/{message_id}` | — | `{ deleted: true }` | Delete message |

**DTOs:**

```typescript
// ChatHistoryQuery
{
  limit?: number;           // default 50
  before_message_id?: string; // pagination
  search_query?: string;
  include_system: boolean;  // include system messages
}

// ChatHistory
{
  messages: ChatMessage[];
  has_more: boolean;
  total_count: number;
}

// ChatMessage
{
  message_id: string;
  message_type: "user_intent" | "user_command" | "user_feedback" | "system_response" | "rich_card";
  sender: "user" | "system" | "context_agent";
  content: string;
  timestamp: ISO8601;
  edited_at?: ISO8601;
  parent_message_id?: string; // thread
  rich_card?: RichCard;
  command_payload?: CommandPayload;
  linked_decision_id?: string;
  linked_audit_event_id?: string;
  intent_matched?: string;   // parsed intent
  action_taken?: string;     // resulting action
}

// RichCard
{
  card_type: "steering_panel" | "impact_report" | "code_stream" | "test_result" | "error_recovery";
  title: string;
  payload: any;             // type-specific data
  actions: CardAction[];
  collapsible: boolean;
  default_collapsed: boolean;
}

// CardAction
{
  action_id: string;
  label: string;
  action_type: "steering_action" | "navigation" | "api_call";
  payload?: any;
  style: "primary" | "secondary" | "danger";
}

// CommandPayload
{
  command: string;          // e.g., "/steer"
  args: string[];
  parsed_intent?: string;
}

// ChatMessage (Inbound)
{
  text: string;
  message_type: "user_intent" | "user_command" | "user_feedback";
  intent?: "command" | "question" | "what_if";
  context_node_id?: string;
  context_file_path?: string;
}
```

**WebSocket Events (Chat):**
| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| C→S | `CHAT_MESSAGE` | `ChatMessage` | User sends message |
| S→C | `CHAT_RESPONSE` | `ChatMessage` | System replies |
| S→C | `CHAT_STREAM` | `{ message_id, delta: string }` | Streaming response |
| S→C | `CHAT_RESPONSE` (rich) | `ChatMessage` with `rich_card` | Rich card |
| C→S | `CONTEXT_QUESTION` | `{ question, context_node_id? }` | "Why" query |
| S→C | `CONTEXT_ANSWER` | `{ answer, sources: SourceRef[] }` | ContextAgent answer |

**SSE Stream (Chat Streaming):**
```
GET /api/v1/projects/{project_id}/chat/stream
Content-Type: text/event-stream

event: message_start
data: {"message_id": "msg-123", "sender": "system"}

event: delta
data: {"delta": "I'll help you ", "index": 0}

event: delta
data: {"delta": "build that. ", "index": 1}

event: intent_detected
data: {"intent": "add_actor", "confidence": 0.95}

event: message_end
data: {"message_id": "msg-123", "complete": true}
```

---

### 4.2 Steering Panel

**REST Endpoints:**

| Method | Path | Request DTO | Response DTO | Description |
|--------|------|-------------|--------------|-------------|
| `GET` | `/api/v1/projects/{project_id}/steering/{stage_id}` | — | `SteeringPanel` | Get current panel |
| `POST` | `/api/v1/projects/{project_id}/steering` | `SteeringAction` | `SteeringResult` | Submit action |

**DTOs:**

```typescript
// SteeringPanel
{
  stage_id: number;
  stage_name: string;
  stage_description: string;
  draft_output: DraftNode[];
  options: SteeringOption[];
  context_window: string;   // "Why these outputs"
  render_policy: SteeringPanelRenderPolicy;
  trust_mode: string;
  auto_approved_count: number;
  paused_count: number;
  critical_count: number;
  total_nodes: number;
}

// SteeringPanelRenderPolicy
{
  default_mode: "summary" | "detail";
  summary_page_size: number;  // 20
  detail_expanded_id?: string;
}

// DraftNode
{
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
  consent_required?: boolean; // for CRITICAL
  full_data?: any;           // detail mode only
}

// SteeringOption
{
  option_id: string;
  option_type: "accept" | "modify" | "replace" | "authorize";
  label: string;
  description: string;
  requires_authorization: boolean;
  authorization_scope?: string;
}

// SteeringAction
{
  action_type: "accept" | "modify" | "replace" | "authorize";
  stage_id: number;
  payload: {
    selected_node_ids?: string[];
    modified_nodes?: ModifiedNode[];
    replacement_text?: string;
    authorization_scope?: string;
    notes?: string;
  };
  timestamp: ISO8601;
}

// ModifiedNode
{
  node_id: string;
  field_path: string;         // e.g., "name" or "description"
  new_value: any;
  old_value: any;
}

// SteeringResult
{
  success: boolean;
  decision_id: string;
  next_state: PipelineStateEnum;
  impacted_nodes?: number;
  propagation_required: boolean;
  checkpoint_id?: string;
}

// BookmarkToggle
{
  option_id: string;
  bookmarked: boolean;
}
```

**WebSocket Events (Steering):**
| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| S→C | `STEERING_PANEL_READY` | `SteeringPanel` | Panel populated |
| S→C | `STEERING_REQUIRED` | `{ stage, reason, options }` | System needs input |
| C→S | `STEERING_ACTION` | `SteeringAction` | User decision |
| C→S | `BOOKMARK_TOGGLE` | `BookmarkToggle` | Bookmark option |
| S→C | `NODE_PENDING` | `{ node_id, pending_reason }` | Node awaiting input |
| S→C | `NODE_COMMITTED` | `{ node_id, node_type, data, provenance }` | Node confirmed |
| S→C | `NODE_UPDATED` | `{ node_id, change_type, new_data }` | CRUD committed |

---

### 4.3 File Explorer

**REST Endpoints:**

| Method | Path | Request DTO | Response DTO | Description |
|--------|------|-------------|--------------|-------------|
| `GET` | `/api/v1/projects/{project_id}/workspace/files` | `FileListQuery` | `FileTree` | List files |
| `GET` | `/api/v1/projects/{project_id}/workspace/file` | `FileReadRequest` | `FileContent` | Read file |
| `POST` | `/api/v1/projects/{project_id}/workspace/file` | `FileWriteRequest` | `FileContent` | Write file |
| `DELETE` | `/api/v1/projects/{project_id}/workspace/file` | `FileDeleteRequest` | `{ deleted: true }` | Delete file |
| `GET` | `/api/v1/projects/{project_id}/workspace/file/provenance` | `ProvenanceQuery` | `ProvenanceInfo` | File provenance |

**DTOs:**

```typescript
// FileListQuery
{
  path?: string;            // directory path, default root
  layer?: string;           // filter by layer
  include_generated: boolean;
  include_user_edited: boolean;
}

// FileTree
{
  root: FileNode;
}

// FileNode
{
  path: string;
  name: string;
  type: "file" | "directory";
  layer: string;
  status: "generating" | "complete" | "modified" | "conflict" | "stale";
  size_bytes?: number;
  children?: FileNode[];
  provenance?: FileProvenance;
  last_modified: ISO8601;
}

// FileReadRequest
{
  path: string;
  version?: string;         // for historical
}

// FileContent
{
  path: string;
  content: string;
  encoding: "utf-8" | "base64";
  language: string;         // for syntax highlighting
  version: string;
  provenance: FileProvenance;
  is_generated: boolean;
  is_editable: boolean;
}

// FileWriteRequest
{
  path: string;
  content: string;
  encoding?: "utf-8" | "base64";
  source: "user_edit" | "regeneration" | "steering";
  steering_instruction?: string;
}

// FileDeleteRequest
{
  path: string;
  permanent: boolean;       // false = trash
  rationale?: string;
}

// ProvenanceQuery
{
  path: string;
}

// ProvenanceInfo
{
  file_path: string;
  why_this_file_exists: string; // plain English
  decision_chain: ProvenanceStep[];
  task_id: string;
  story_id: string;
  decision_entry_id: string;
  checkpoint_id: string;
  generated_at: ISO8601;
  generated_by: string;
}

// ProvenanceStep
{
  stage: number;
  stage_name: string;
  decision_id: string;
  decision_summary: string;
  timestamp: ISO8601;
}

// FileProvenance
{
  task_id: string;
  story_id: string;
  decision_entry_id: string;
  checkpoint_id: string;
  generation_timestamp: ISO8601;
}
```

**WebSocket Events (Files):**
| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| S→C | `CODE_FILE_STREAM` | `CodeFileChunk` | File being generated |
| S→C | `CODE_FILE_COMPLETE` | `GeneratedFile` | File done |
| S→C | `CODE_FILE_MODIFIED` | `{ file_path, diff }` | File changed |
| S→C | `CODE_FILE_REJECTED` | `{ file_path, reason }` | User rejected |
| C→S | `CODE_FILE_STEER` | `{ file_path, action, instruction? }` | Steer file |
| S→C | `FILE_STATUS_CHANGED` | `{ file_path, old_status, new_status }` | Status update |

**SSE Stream (File Generation):**
```
GET /api/v1/projects/{project_id}/workspace/stream
Content-Type: text/event-stream

event: file_start
data: {"file_path": "src/components/Login.tsx", "layer": "frontend", "task_id": "TASK-001"}

event: file_chunk
data: {"file_path": "src/components/Login.tsx", "content_delta": "import React...", "offset": 0}

event: file_complete
data: {"file_path": "src/components/Login.tsx", "content_hash": "sha256:abc123", "size_bytes": 2048}
```

---

### 4.4 Editor

**REST Endpoints:**

| Method | Path | Request DTO | Response DTO | Description |
|--------|------|-------------|--------------|-------------|
| `GET` | `/api/v1/projects/{project_id}/workspace/diff` | `DiffRequest` | `DiffResult` | Get diff |
| `POST` | `/api/v1/projects/{project_id}/workspace/merge` | `MergeRequest` | `MergeResult` | Resolve merge |

**DTOs:**

```typescript
// DiffRequest
{
  file_path: string;
  base_version?: string;
  compare_version?: string; // default current
}

// DiffResult
{
  file_path: string;
  additions: DiffLine[];
  deletions: DiffLine[];
  modifications: DiffLine[];
  unchanged: number;
}

// DiffLine
{
  line_number: number;
  content: string;
  type: "addition" | "deletion" | "modification";
}

// MergeRequest
{
  file_path: string;
  base_content: string;
  ours_content: string;
  theirs_content: string;
  resolution: "accept_ours" | "accept_theirs" | "manual";
  manual_output?: string;
}

// MergeResult
{
  file_path: string;
  merged_content: string;
  conflicts_remaining: number;
  success: boolean;
}
```

**WebSocket Events (Editor):**
| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| C→S | `EDITOR_CHANGE` | `{ file_path, change_event, content_hash }` | User edited |
| C→S | `INLINE_STEER` | `{ file_path, line_number, instruction }` | `@steering` comment |
| S→C | `EDITOR_SYNC` | `{ file_path, content, version }` | Backend update |
| S→C | `EDITOR_CONFLICT` | `{ file_path, base, ours, theirs }` | Merge conflict |

---

### 4.5 Live Preview

**REST Endpoints:**

| Method | Path | Request DTO | Response DTO | Description |
|--------|------|-------------|--------------|-------------|
| `POST` | `/api/v1/projects/{project_id}/runtime/start` | `RuntimeStartRequest` | `RuntimeStartResult` | Start sandbox |
| `POST` | `/api/v1/projects/{project_id}/runtime/stop` | — | `{ stopped: true }` | Stop sandbox |
| `GET` | `/api/v1/projects/{project_id}/runtime/status` | — | `RuntimeStatus` | Sandbox status |
| `POST` | `/api/v1/projects/{project_id}/runtime/command` | `RuntimeCommand` | `RuntimeCommandResult` | Execute command |

**DTOs:**

```typescript
// RuntimeStartRequest
{
  environment?: "development" | "production";
  hot_reload: boolean;
  preview_device?: "desktop" | "tablet" | "mobile";
}

// RuntimeStartResult
{
  sandbox_id: string;
  preview_url: string;
  status: "starting" | "running" | "error";
  startup_steps: StartupStep[];
}

// StartupStep
{
  step_number: number;
  step_name: string;
  status: "pending" | "active" | "complete" | "failed";
  logs?: string;
}

// RuntimeStatus
{
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

// PortMapping
{
  internal_port: number;
  external_port: number;
  protocol: "http" | "https" | "tcp";
}

// RuntimeCommand
{
  command: string;
  args: string[];
  working_directory?: string;
  timeout_seconds?: number;
}

// RuntimeCommandResult
{
  exit_code: number;
  stdout: string;
  stderr: string;
  execution_time_ms: number;
}

// PreviewFeedback
{
  text: string;
  element_selector?: string;
  component_path?: string;
  story_id?: string;
  feedback_type: "change" | "validation" | "rbac" | "general";
  screenshot?: string;      // base64, optional
}
```

**WebSocket Events (Preview):**
| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| S→C | `RUNTIME_STARTED` | `{ preview_url, sandbox_id }` | Sandbox ready |
| S→C | `RUNTIME_LOG` | `{ stream: "stdout" \| "stderr", content: string }` | Runtime output |
| S→C | `HOT_RELOAD` | `{ file_path, reload_type: "hmr" \| "full" }` | Frontend reload |
| C→S | `PREVIEW_FEEDBACK` | `PreviewFeedback` | User feedback |
| S→C | `PREVIEW_INTERACTIVE_ELEMENT` | `{ selector, component_path, story_id }` | Click detected |
| C→S | `PREVIEW_INTERACTIVE_ELEMENT` | `{ selector, component_path, story_id }` | Click from preview |

**SSE Stream (Runtime Logs):**
```
GET /api/v1/projects/{project_id}/runtime/logs
Content-Type: text/event-stream

event: log
data: {"stream": "stdout", "content": "Server running on port 3000", "timestamp": "2024-06-19T10:00:00Z"}

event: log
data: {"stream": "stderr", "content": "DeprecationWarning: ...", "timestamp": "2024-06-19T10:00:01Z"}

event: status
data: {"status": "running", "uptime_seconds": 120}
```

---

### 4.6 Terminal

**WebSocket Events:**
| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| C→S | `RUNTIME_COMMAND` | `RuntimeCommand` | Execute shell |
| S→C | `RUNTIME_COMMAND_OUTPUT` | `{ command_id, stdout, stderr, exit_code }` | Command output |
| S→C | `DEPENDENCY_INSTALL_STATUS` | `DependencyInstallStatus` | Package manager |
| C→S | `TERMINAL_INPUT` | `{ input: string }` | Raw terminal input |
| S→C | `TERMINAL_OUTPUT` | `{ output: string, stream: "stdout" \| "stderr" }` | Raw output |

**DTOs:**

```typescript
// DependencyInstallStatus
{
  status: "in_progress" | "done" | "failed";
  step: "resolving" | "downloading" | "linking" | "building";
  progress_percent: number;
  current_package?: string;
  logs: string;
  error?: string;
}
```

---

### 4.7 Test Results

**REST Endpoints:**

| Method | Path | Request DTO | Response DTO | Description |
|--------|------|-------------|--------------|-------------|
| `POST` | `/api/v1/projects/{project_id}/tests/run` | `TestRunRequest` | `TestRunResult` | Run tests |
| `GET` | `/api/v1/projects/{project_id}/tests` | `TestListQuery` | `TestList` | List results |

**DTOs:**

```typescript
// TestRunRequest
{
  filter?: "all" | "failed" | "passed";
  file_pattern?: string;
  timeout_seconds?: number;
}

// TestRunResult
{
  run_id: string;
  status: "running" | "completed" | "failed";
  summary: TestSummary;
}

// TestListQuery
{
  run_id?: string;
  status?: "pass" | "fail" | "pending";
  file_path?: string;
}

// TestList
{
  tests: TestResult[];
  summary: TestSummary;
}

// TestResult
{
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

// TestSummary
{
  total: number;
  passed: number;
  failed: number;
  pending: number;
  skipped: number;
  total_duration_ms: number;
  pass_rate: number;        // 0-1
}
```

**WebSocket Events:**
| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| S→C | `TEST_RESULT_STREAM` | `TestResult` | Individual test |
| S→C | `TEST_RUN_COMPLETED` | `TestSummary` | Suite done |
| C→S | `TEST_RERUN` | `{ test_id }` | Re-run single |
| C→S | `TEST_DEBUG` | `{ test_id }` | Debug test |

---

### 4.8 Blueprint Graph

**REST Endpoints:**

| Method | Path | Request DTO | Response DTO | Description |
|--------|------|-------------|--------------|-------------|
| `GET` | `/api/v1/projects/{project_id}/graph` | `GraphQuery` | `GraphData` | Get graph |
| `POST` | `/api/v1/projects/{project_id}/graph/what-if` | `WhatIfRequest` | `WhatIfResult` | Simulate change |

**DTOs:**

```typescript
// GraphQuery
{
  node_types?: string[];    // filter
  layers?: string[];
  depth?: number;           // traversal depth
  include_files: boolean;
}

// GraphData
{
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: {
    total_nodes: number;
    max_depth: number;
    layers_present: string[];
  };
}

// GraphNode
{
  id: string;
  type: "actor" | "capability" | "use_case" | "user_story" | "engineering_task" | "file";
  name: string;
  layer: string;
  status: NodeStatus;
  x?: number;               // layout position
  y?: number;
  z?: number;               // for 3D
  data: any;                // full node data
}

// GraphEdge
{
  id: string;
  source: string;
  target: string;
  type: "dependency" | "traceability" | "provenance";
  label?: string;
}

// WhatIfRequest
{
  node_id: string;
  proposed_changes: { [field: string]: any };
}

// WhatIfResult
{
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

// AffectedNode
{
  node_id: string;
  node_type: string;
  name: string;
  severity: "success" | "warning" | "error";
  reason: string;
  distance: number;         // hops from changed node
}
```

**WebSocket Events:**
| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| C→S | `GRAPH_NODE_SELECT` | `{ node_id }` | Focus node |
| C→S | `GRAPH_NODE_STEER` | `{ node_id, instruction }` | Steer from graph |
| S→C | `GRAPH_UPDATE` | `{ nodes_added, nodes_removed, nodes_modified }` | Graph changed |
| C→S | `WHAT_IF_SIMULATE` | `WhatIfRequest` | Run simulation |
| S→C | `WHAT_IF_RESULT` | `WhatIfResult` | Simulation done |

---

### 4.9 Audit Panel

**REST Endpoints:**

| Method | Path | Request DTO | Response DTO | Description |
|--------|------|-------------|--------------|-------------|
| `GET` | `/api/v1/projects/{project_id}/ledger` | `LedgerQuery` | `DecisionLedger` | Get ledger |
| `GET` | `/api/v1/projects/{project_id}/ledger/{entry_id}` | — | `DecisionEntry` | Single entry |
| `GET` | `/api/v1/projects/{project_id}/audit` | `AuditQuery` | `AuditTrail` | Get audit trail |
| `POST` | `/api/v1/projects/{project_id}/ledger/revision` | `RevisionRequest` | `RevisionResult` | Request revision |
| `POST` | `/api/v1/projects/{project_id}/ledger/revert` | `RevertRequest` | `RevertResult` | Revert decision |

**DTOs:**

```typescript
// LedgerQuery
{
  status?: "active" | "superseded" | "cancelled" | "all";
  stage?: number;
  layer?: string;
  from_date?: ISO8601;
  to_date?: ISO8601;
  search?: string;
  limit?: number;
  offset?: number;
}

// DecisionLedger
{
  entries: DecisionEntry[];
  total_count: number;
  revision_budget_remaining: number;
  revision_budget_total: number;
}

// DecisionEntry
{
  entry_id: string;
  decision_type: "steering" | "system_authorized" | "user_override" | "revision" | "revert";
  stage: number;
  stage_name: string;
  summary: string;
  status: "active" | "superseded" | "cancelled";
  payload: any;             // full decision data
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

// ProvenanceChain
{
  previous_entry_id?: string;
  parent_decision_id?: string;
  trigger_event: string;
  context_snapshot_id: string;
}

// AuditQuery
{
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

// AuditTrail
{
  events: AuditEvent[];
  total_count: number;
  storage_used_bytes: number;
  storage_budget_bytes: number;
  retention_days: number;
}

// AuditEvent
{
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

// RevisionRequest
{
  original_decision_id: string;
  new_choice: SteeringOption;
  rationale: string;
}

// RevisionResult
{
  revision_id: string;
  impact_report_id: string;
  propagation_required: boolean;
  budget_remaining: number;
}

// RevertRequest
{
  target_decision_id: string;
  rationale: string;
}

// RevertResult
{
  new_entry_id: string;
  reverted_to_id: string;
  impact_report_id: string;
}
```

**WebSocket Events:**
| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| S→C | `DECISION_LOGGED` | `DecisionEntry` | New decision |
| S→C | `DECISION_SUPERSEDED` | `{ old_id, new_id }` | Decision revised |
| S→C | `DECISION_REVERTED` | `{ reverted_to_id, new_entry_id }` | Decision reverted |
| S→C | `AUDIT_EVENT_WRITTEN` | `AuditEvent` | New audit event |
| S→C | `REVISION_BUDGET_EXHAUSTED` | `{ budget_id, decision_point }` | Budget gone |
| C→S | `AUDIT_FILTER` | `AuditQuery` | Filter request |

---

## 5. Node CRUD & Editors

### 5.1 Node Editor (Universal)

**REST Endpoints:**

| Method | Path | Request DTO | Response DTO | Description |
|--------|------|-------------|--------------|-------------|
| `GET` | `/api/v1/projects/{project_id}/nodes/{node_id}` | — | `Node` | Get node |
| `POST` | `/api/v1/projects/{project_id}/nodes` | `CreateNodeRequest` | `Node` | Create node |
| `PUT` | `/api/v1/projects/{project_id}/nodes/{node_id}` | `UpdateNodeRequest` | `Node` | Update node |
| `DELETE` | `/api/v1/projects/{project_id}/nodes/{node_id}` | `DeleteNodeRequest` | `{ deleted: true }` | Delete node |
| `POST` | `/api/v1/projects/{project_id}/nodes/{node_id}/enrich` | `EnrichRequest` | `EnrichResult` | Auto-enrich |
| `POST` | `/api/v1/projects/{project_id}/nodes/{node_id}/validate` | — | `ValidationResult` | Validate node |

**DTOs:**

```typescript
// Node (Universal)
{
  node_id: string;
  node_type: "actor" | "capability" | "use_case" | "user_story" | "engineering_task" | "custom_annotation";
  name: string;
  description: string;
  layer: string;
  status: NodeStatus;
  parent_id?: string;
  children_ids: string[];
  metadata: { [key: string]: any };
  provenance: NodeProvenance;
  created_at: ISO8601;
  updated_at: ISO8601;
  created_by: string;
  version: number;
}

// NodeStatus
  "SYSTEM_GENERATED"
| "USER_ENRICHED"
| "USER_DEFINED"
| "SUPERSEDED"
| "INFERRED"
| "DEFERRED"
| "ORPHANED";

// NodeProvenance
{
  generated_at_stage: number;
  decision_entry_id: string;
  checkpoint_id: string;
  llm_call_id?: string;
}

// CreateNodeRequest
{
  node_type: string;
  parent_id?: string;
  data: { [key: string]: any };
  source: "user" | "system";
}

// UpdateNodeRequest
{
  data: { [key: string]: any };
  source: "user_edit" | "steering" | "enrichment";
  change_rationale?: string;
}

// DeleteNodeRequest
{
  permanent: boolean;       // false = deactivate
  delete_downstream: boolean;
  rationale: string;
}

// EnrichRequest
{
  enrichment_type: "auto" | "manual";
  selected_suggestions?: string[]; // for manual
  fields_to_enrich?: string[];
}

// EnrichResult
{
  enriched_fields: { [field: string]: { before: any; after: any } };
  new_suggestions: EnrichmentSuggestion[];
  completeness_score_before: number;
  completeness_score_after: number;
  impact_report_id?: string;
}

// EnrichmentSuggestion
{
  suggestion_id: string;
  field_path: string;
  suggested_value: any;
  rationale: string;
  confidence: number;
}

// ValidationResult
{
  valid: boolean;
  completeness_score: number;
  required_fields: ValidationField[];
  prd_compliance: PRDComplianceCheck[];
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

// ValidationField
{
  field_path: string;
  field_name: string;
  present: boolean;
  value: any;
  required: boolean;
  rule: string;
}

// PRDComplianceCheck
{
  acceptance_criterion_id: string;
  criterion: string;
  passed: boolean;
  prd_reference: string;
}

// ValidationError
{
  field_path: string;
  error_code: string;
  message: string;
  severity: "blocking" | "critical";
  suggested_fix?: string;
}

// ValidationWarning
{
  field_path: string;
  warning_code: string;
  message: string;
  severity: "warning" | "info";
}
```

**WebSocket Events:**
| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| C→S | `NODE_MANIPULATION` | `{ action, node_type, node_id, data }` | CRUD operation |
| S→C | `NODE_CREATED` | `Node` | Node added |
| S→C | `NODE_UPDATED` | `{ node_id, changes, new_version }` | Node modified |
| S→C | `NODE_DELETED` | `{ node_id, deactivated: boolean }` | Node removed |
| S→C | `NODE_ENRICHED` | `EnrichResult` | Enrichment applied |
| S→C | `USER_OPTION_INCOHERENT` | `{ option_text, failure_reason, suggestions }` | Validation fail |

---

### 5.2 Use Case Editor (Specific)

**DTOs:**

```typescript
// UseCase (extends Node)
{
  primary_actor_id: string;
  secondary_actor_ids: string[];
  preconditions: string[];
  main_flow: UseCaseStep[];
  alternative_flows: AlternativeFlow[];
  postconditions: string[];
  success_criteria: string[];
}

// UseCaseStep
{
  step_number: number;
  description: string;
  actor_performing: string;
  system_response?: string;
}

// AlternativeFlow
{
  flow_id: string;
  flow_name: string;
  trigger_condition: string;
  steps: UseCaseStep[];
}
```

---

### 5.3 User Story Editor (Specific)

**DTOs:**

```typescript
// UserStory (extends Node)
{
  title: string;            // "As a [role], I want [goal], so that [benefit]"
  actor_id: string;
  story_points: number;     // Fibonacci
  priority: "Must Have" | "Should Have" | "Could Have";
  acceptance_criteria: AcceptanceCriterion[];
  technical_notes: string;
  dependencies: string[];    // node_ids
}

// AcceptanceCriterion
{
  ac_id: string;
  given: string;
  when: string;
  then: string;
  complete: boolean;        // all three clauses present
}
```

---

### 5.4 Task Editor (Specific)

**DTOs:**

```typescript
// EngineeringTask (extends Node)
{
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

// AccessGuard
{
  guard_type: "authorization" | "authentication" | "input_validation" | "rate_limiting";
  description: string;
  implementation_hint?: string;
}
```

---

## 6. Advisory Modules

### 6.1 RBAC Matrix Editor

**REST Endpoints:**

| Method | Path | Request DTO | Response DTO | Description |
|--------|------|-------------|--------------|-------------|
| `GET` | `/api/v1/projects/{project_id}/rbac` | — | `RBACModel` | Get RBAC model |
| `POST` | `/api/v1/projects/{project_id}/rbac` | `RBACModelUpdate` | `RBACModel` | Update RBAC |
| `POST` | `/api/v1/projects/{project_id}/rbac/validate` | — | `RBACValidationResult` | Validate |
| `POST` | `/api/v1/projects/{project_id}/rbac/commit` | `RBACCommitRequest` | `RBACCommitResult` | Commit model |

**DTOs:**

```typescript
// RBACModel
{
  version: number;
  roles: RBACRole[];
  permissions: RBACPermission[];
  role_permissions: RolePermissionEntry[];
  inheritance_graph: InheritanceGraph;
  data_access_matrix: DataAccessEntry[];
}

// RBACRole
{
  role_id: string;
  role_name: string;
  parent_role_id?: string;
  description: string;
}

// RBACPermission
{
  permission_id: string;
  resource: string;
  action: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  description: string;
}

// RolePermissionEntry
{
  entry_id: string;
  role_id: string;
  permission_id: string;
  granted: boolean;
  rationale: string;        // required if granted=true
  decision_maker: string;   // required if granted=true
  conditions?: string[];
}

// InheritanceGraph
{
  nodes: { role_id: string; depth: number }[];
  edges: { from: string; to: string }[];
  max_depth: number;
  cycles: string[][];       // detected cycles
}

// DataAccessEntry
{
  role_id: string;
  entity: string;
  access_level: "None" | "Own" | "Department" | "All";
  rationale: string;
  guard?: string;
}

// RBACModelUpdate
{
  version: number;          // must match current (optimistic locking)
  changes: RBACChange[];
}

// RBACChange
{
  change_type: "add_role" | "remove_role" | "add_permission" | "grant" | "revoke" | "set_inheritance";
  target_id: string;
  new_value: any;
}

// RBACValidationResult
{
  valid: boolean;
  inheritance_cycles: string[][];
  privilege_escalations: EscalationPath[];
  missing_rationales: string[];
  depth_violations: string[];
}

// EscalationPath
{
  path: string[];             // role chain
  resulting_access: string;
  depth: number;
  algorithm: "STATIC_ESCALATION_ANALYSIS";
}

// RBACCommitRequest
{
  force?: boolean;            // override warnings
  rationale: string;
}

// RBACCommitResult
{
  committed_version: number;
  audit_event_id: string;
  generated_middleware_files: string[];
}
```

**WebSocket Events:**
| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| S→C | `RBAC_MODEL_READY` | `RBACModel` | Model generated |
| S→C | `RBAC_CONFLICT_DETECTED` | `PermissionConflict` | Permission conflict |
| S→C | `PRIVILEGE_ESCALATION_FLAGGED` | `EscalationPath` | Escalation found |
| S→C | `RBAC_INHERITANCE_CYCLE_DETECTED` | `{ cycle_path: string[] }` | Cycle blocked |
| C→S | `RBAC_STEERING_ACTION` | `{ target, action_type, payload }` | RBAC edit |

---

### 6.2 Hosting Options Matrix

**REST Endpoints:**

| Method | Path | Request DTO | Response DTO | Description |
|--------|------|-------------|--------------|-------------|
| `POST` | `/api/v1/projects/{project_id}/infrastructure/select` | `HostingSelection` | `InfrastructureProfile` | Select hosting |
| `GET` | `/api/v1/projects/{project_id}/infrastructure` | — | `InfrastructureProfile` | Get profile |

**DTOs:**

```typescript
// HostingSelection
{
  option_id: string;
  modified_fields?: { [key: string]: any };
  override_budget_warning?: boolean;
}

// InfrastructureProfile
{
  profile_id: string;
  selected_option: HostingOption;
  scale_persona: string;
  committed_at: ISO8601;
  committed_by: string;
  stale: boolean;
  stale_reason?: string;
  generated_files: string[]; // Terraform, Docker, etc.
}
```

---

### 6.3 Tech Stack Options Matrix

**REST Endpoints:**

| Method | Path | Request DTO | Response DTO | Description |
|--------|------|-------------|--------------|-------------|
| `POST` | `/api/v1/projects/{project_id}/tech-stack/select` | `TechStackSelection` | `TechStackProfile` | Select stack |
| `GET` | `/api/v1/projects/{project_id}/tech-stack` | — | `TechStackProfile` | Get profile |

**DTOs:**

```typescript
// TechStackSelection
{
  option_id: string;
  modified_fields?: { [key: string]: any };
}

// TechStackProfile
{
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

// TechStackComponent
{
  framework: string;
  version?: string;
  language: string;
  justification: string;
}
```

---

## 7. Governance & Audit

### 7.1 Checkpoint Manager

**REST Endpoints:**

| Method | Path | Request DTO | Response DTO | Description |
|--------|------|-------------|--------------|-------------|
| `GET` | `/api/v1/projects/{project_id}/checkpoints` | — | `CheckpointList` | List checkpoints |
| `POST` | `/api/v1/projects/{project_id}/checkpoints` | `CreateCheckpointRequest` | `Checkpoint` | Create checkpoint |
| `POST` | `/api/v1/projects/{project_id}/checkpoints/restore` | `RestoreCheckpointRequest` | `RestoreResult` | Restore |
| `GET` | `/api/v1/projects/{project_id}/checkpoints/{checkpoint_id}` | — | `Checkpoint` | Get checkpoint |

**DTOs:**

```typescript
// CheckpointList
{
  checkpoints: CheckpointSummary[];
}

// CheckpointSummary
{
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

// Checkpoint
{
  checkpoint_id: string;
  stage: number;
  stage_name: string;
  label: string;
  state_snapshot: PipelineState;
  decision_ledger_snapshot: DecisionEntry[];
  workspace_snapshot?: WorkspaceSnapshot;
  created_at: ISO8601;
  created_by: string;
}

// CreateCheckpointRequest
{
  label?: string;
  include_workspace: boolean;
}

// RestoreCheckpointRequest
{
  checkpoint_id: string;
  safety_phrase: string;    // "RESTORE CHECKPOINT-{id}"
  discard_after: boolean;     // true = discard later checkpoints
}

// RestoreResult
{
  success: boolean;
  restored_checkpoint_id: string;
  new_session_id: string;
  discarded_checkpoints?: string[];
  rollback_stage: number;
}
```

**WebSocket Events:**
| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| S→C | `CHECKPOINT_CREATED` | `Checkpoint` | New checkpoint |
| S→C | `CHECKPOINT_RESTORED` | `{ checkpoint_id, restored_from_state }` | Restored |
| C→S | `CHECKPOINT_RESTORE_REQUEST` | `RestoreCheckpointRequest` | Manual restore |

---

### 7.2 Revision & Branching Manager

**REST Endpoints:**

| Method | Path | Request DTO | Response DTO | Description |
|--------|------|-------------|--------------|-------------|
| `GET` | `/api/v1/projects/{project_id}/branches` | — | `BranchList` | List branches |
| `POST` | `/api/v1/projects/{project_id}/branches` | `CreateBranchRequest` | `Branch` | Create branch |
| `POST` | `/api/v1/projects/{project_id}/branches/{branch_id}/merge` | `MergeBranchRequest` | `MergeResult` | Merge branch |
| `DELETE` | `/api/v1/projects/{project_id}/branches/{branch_id}` | — | `{ deleted: true }` | Delete branch |

**DTOs:**

```typescript
// BranchList
{
  active_branch: string;
  branches: Branch[];
}

// Branch
{
  branch_id: string;
  branch_name: string;
  based_on_checkpoint_id: string;
  created_at: ISO8601;
  created_by: string;
  node_count: number;
  status: "open" | "merged" | "discarded";
  changes_summary: string[];
}

// CreateBranchRequest
{
  branch_name: string;
  from_checkpoint_id: string;
  proposed_changes: { [node_id: string]: any };
}

// MergeBranchRequest
{
  target_branch: string;    // usually "main"
  resolution_strategy: "auto" | "manual";
  manual_resolutions?: { [conflict_id: string]: "ours" | "theirs" };
}

// MergeResult
{
  success: boolean;
  merged_branch_id: string;
  conflicts: MergeConflict[];
  new_checkpoint_id: string;
}

// MergeConflict
{
  conflict_id: string;
  node_id: string;
  field: string;
  base_value: any;
  ours_value: any;
  theirs_value: any;
  resolved_value?: any;
}
```

---

## 8. Code Generation & Runtime

### 8.1 Code Generation (Stage 8)

**REST Endpoints:**

| Method | Path | Request DTO | Response DTO | Description |
|--------|------|-------------|--------------|-------------|
| `POST` | `/api/v1/projects/{project_id}/generate` | `CodeGenRequest` | `CodeGenStart` | Start generation |
| `GET` | `/api/v1/projects/{project_id}/generate/status` | — | `CodeGenStatus` | Get status |
| `POST` | `/api/v1/projects/{project_id}/generate/cancel` | — | `{ cancelled: true }` | Cancel |

**DTOs:**

```typescript
// CodeGenRequest
{
  target_nodes?: string[]; // specific tasks, or all
  regenerate_files?: string[];
  include_tests: boolean;
  include_infrastructure: boolean;
}

// CodeGenStart
{
  generation_id: string;
  total_files: number;
  estimated_duration_seconds: number;
}

// CodeGenStatus
{
  generation_id: string;
  status: "queued" | "running" | "completed" | "failed";
  files_completed: number;
  files_total: number;
  current_file?: string;
  errors: CodeGenError[];
}

// CodeGenError
{
  file_path: string;
  error_type: "syntax" | "dependency" | "template" | "merge_conflict";
  message: string;
  recoverable: boolean;
}

// GeneratedFile
{
  file_path: string;
  content: string;
  content_hash: string;
  size_bytes: number;
  layer: string;
  task_id: string;
  provenance: FileProvenance;
  language: string;
}
```

**WebSocket Events:**
| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| S→C | `CODE_GENERATION_STARTED` | `CodeGenStart` | Stage 8 begins |
| S→C | `CODE_FILE_STREAM` | `CodeFileChunk` | File chunk |
| S→C | `CODE_FILE_COMPLETE` | `GeneratedFile` | File done |
| S→C | `CODE_GENERATION_COMPLETE` | `WorkspaceManifest` | Stage 8 done |
| S→C | `DEPENDENCY_INSTALL_STATUS` | `DependencyInstallStatus` | Install progress |
| C→S | `CODE_FILE_STEER` | `{ file_path, action, instruction }` | File-level steer |

---

### 8.2 Deployment (Stage 10)

**REST Endpoints:**

| Method | Path | Request DTO | Response DTO | Description |
|--------|------|-------------|--------------|-------------|
| `POST` | `/api/v1/projects/{project_id}/deploy` | `DeployRequest` | `DeployStart` | Start deploy |
| `GET` | `/api/v1/projects/{project_id}/deploy/status` | — | `DeployStatus` | Get status |
| `POST` | `/api/v1/projects/{project_id}/deploy/cancel` | — | `{ cancelled: true }` | Cancel |

**DTOs:**

```typescript
// DeployRequest
{
  target: "vercel" | "aws_amplify" | "netlify" | "kubernetes";
  environment_variables: { [key: string]: string };
  domain?: string;
  ssl: boolean;
}

// DeployStart
{
  deployment_id: string;
  preview_url?: string;
  status: "queued" | "building" | "deploying" | "ready" | "failed";
}

// DeployStatus
{
  deployment_id: string;
  status: string;
  build_logs: string[];
  health_checks: HealthCheck[];
  url?: string;
  qr_code_url?: string;
}

// HealthCheck
{
  check_name: string;
  status: "pass" | "fail" | "pending";
  response_time_ms?: number;
}
```

**WebSocket Events:**
| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| S→C | `DEPLOYING` | `{ deployment_id, stage: "building" }` | Deploy progress |
| S→C | `DEPLOYED` | `{ url, qr_code_url }` | Deploy complete |

---

## 9. Cross-Cutting Events

### 9.1 Global Search

**REST Endpoints:**

| Method | Path | Request DTO | Response DTO | Description |
|--------|------|-------------|--------------|-------------|
| `GET` | `/api/v1/projects/{project_id}/search` | `SearchQuery` | `SearchResult` | Global search |

**DTOs:**

```typescript
// SearchQuery
{
  q: string;                // search string
  panel_context?: "global" | "audit" | "chat"; // routes query to ContextAgent if "audit" or "chat"

  filters?: {
    types?: ("decision" | "node" | "file" | "audit")[];
    stages?: number[];
    layers?: string[];
    date_from?: ISO8601;
    date_to?: ISO8601;
  };
  limit?: number;
}

// SearchResult
{
  query: string;
  results: SearchResultItem[];
  total: number;
  suggested_queries: string[];
}

// SearchResultItem
{
  result_id: string;
  result_type: "decision" | "node" | "file" | "audit_event";
  title: string;
  snippet: string;
  relevance_score: number;
  metadata: any;
  navigation_target: string;
}
```

---

### 9.2 Notifications

**WebSocket Events:**
| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| S→C | `TOAST_NOTIFICATION` | `ToastNotification` | Toast push |
| S→C | `BROWSER_TAB_UPDATE` | `{ title: string }` | Tab title |
| S→C | `WEBHOOK_DISPATCH` | `{ event_type, payload }` | Webhook (if configured) |

**DTOs:**

```typescript
// ToastNotification
{
  id: string;
  severity: "success" | "warning" | "error" | "info";
  title: string;
  body?: string;
  actions?: { label: string; action_type: string; payload?: any }[];
  auto_dismiss_seconds?: number; // null = never
  timestamp: ISO8601;
}
```

---

### 9.3 Collaboration

**WebSocket Events:**
| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| C→S | `CURSOR_POSITION` | `{ x, y, panel, timestamp }` | Cursor move |
| S→C | `REMOTE_CURSOR` | `{ user_id, x, y, color, label }` | Remote cursor |
| S→C | `PRESENCE_UPDATE` | `Collaborator[]` | Who's online |
| S→C | `EDIT_CONFLICT` | `MergeConflict` | Concurrent edit |
| C→S | `RESOLVE_CONFLICT` | `{ conflict_id, resolution }` | Conflict resolution |

---

### 9.4 Error Handling

**WebSocket Events (Error Recovery):**
| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| S→C | `ERROR` | `PipelineError` | General error |
| S→C | `LLM_FAILURE` | `LLMFailure` | LLM-specific |
| S→C | `STEERING_REQUIRED` | `{ stage, reason, options }` | Needs user |
| S→C | `REVISION_BUDGET_EXHAUSTED` | `{ budget_id, decision_point }` | Budget gone |

**DTOs:**

```typescript
// PipelineError
{
  error_code: string;
  message: string;
  recoverable: boolean;
  action_options: ErrorAction[];
  context: any;
}

// ErrorAction
{
  label: string;
  action_type: "retry" | "modify" | "skip" | "restore_checkpoint" | "abort";
  payload?: any;
}

// LLMFailure
{
  failure_type: "timeout" | "malformed_json" | "context_overflow" | "rate_limit" | "empty_response";
  prompt_id: string;
  stage: number;
  partial_output?: any;
  retry_after_seconds?: number;
  queue_position?: number;
}
```

---

### 9.5 Session Management

**REST Endpoints:**

| Method | Path | Request DTO | Response DTO | Description |
|--------|------|-------------|--------------|-------------|
| `POST` | `/api/v1/projects/{project_id}/save-and-exit` | — | `{ checkpoint_id }` | Save & exit |
| `PUT` | `/api/v1/projects/{project_id}/autosave` | `AutoSavePayload` | `{ saved: true }` | Autosave editor state |
| `POST` | `/api/v1/projects/{project_id}/abort` | `{ reason }` | `{ aborted: true }` | Abort session |
| `GET` | `/api/v1/projects/{project_id}/recovery` | — | `RecoveryData` | Check recovery |

**DTOs:**

```typescript
// AutoSavePayload
{
  active_files: EditorTab[];
  unsaved_changes: { [file_path: string]: string };
  timestamp: ISO8601;
}

// RecoveryData
{
  has_recovery_data: boolean;
  recovery_timestamp?: ISO8601;
  recovered_stage?: number;
  prompt: "Restore from recovery or discard?";
}
```

**WebSocket Events:**
| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| S→C | `SESSION_TIMEOUT_WARNING` | `{ minutes_remaining }` | 5min, 1min |
| S→C | `SESSION_EXPIRED` | `{ recovery_available }` | Force logout |
---

## 10. Event Summary Table

### 10.1 Inbound WebSocket Events (Client → Server)

| Event | Payload | Source Screen | Action |
|-------|---------|---------------|--------|
| `AUTH_SESSION_INIT` | `{ session_id, token }` | Login | Auth WS |
| `USER_INPUT` | `RawUserInput` | Landing | Submit input |
| `CHAT_MESSAGE` | `ChatMessage` | Chat | Send message |
| `STEERING_ACTION` | `SteeringAction` | Steering | Decision |
| `NODE_MANIPULATION` | `{ action, node_type, node_id, data }` | Node Editor | CRUD |
| `MID_STAGE_STEER` | `MidSteerSignal` | Chat/Editor | Interrupt |
| `CONTEXT_QUESTION` | `{ question, context_node_id }` | Chat/Why | Query |
| `PROPAGATION_CONSENT` | `{ impact_report_id, confirmed }` | Impact Report | Approve |
| `CHECKPOINT_REQUEST` | `{ action, checkpoint_id }` | Checkpoint | Manage |
| `REVISION_REQUEST` | `RevisionRequest` | Audit | Revise |
| `BOOKMARK_TOGGLE` | `{ option_id, bookmarked }` | Steering | Bookmark |
| `CODE_FILE_STEER` | `{ file_path, action, instruction }` | File Explorer | Steer file |
| `PREVIEW_FEEDBACK` | `PreviewFeedback` | Live Preview | Feedback |
| `RUNTIME_COMMAND` | `RuntimeCommand` | Terminal | Execute |
| `GRAPH_NODE_SELECT` | `{ node_id }` | Blueprint Graph | Focus |
| `GRAPH_NODE_STEER` | `{ node_id, instruction }` | Blueprint Graph | Steer |
| `WHAT_IF_SIMULATE` | `WhatIfRequest` | What-If | Simulate |
| `AUDIT_FILTER` | `AuditQuery` | Audit | Filter |
| `RBAC_STEERING_ACTION` | `{ target, action_type, payload }` | RBAC Matrix | Edit RBAC |
| `HOSTING_SELECTION` | `HostingSelection` | Hosting | Select |
| `TECH_STACK_SELECTION` | `TechStackSelection` | Tech Stack | Select |
| `INLINE_STEER` | `{ file_path, line, instruction }` | Editor | `@steering` |
| `EDITOR_CHANGE` | `{ file_path, change }` | Editor | Edit |
| `TEST_RERUN` | `{ test_id }` | Test Results | Re-run |
| `TEST_DEBUG` | `{ test_id }` | Test Results | Debug |
| `CURSOR_POSITION` | `{ x, y, panel }` | Global | Presence |
| `RESOLVE_CONFLICT` | `{ conflict_id, resolution }` | Merge | Resolve |
| `SCALE_DIALOGUE_RESPONSE` | `ScaleInputs` | Scale Dialogue | Submit |
| `MINIMALIST_RESPONSE` | `MinimalistResponse` | Minimalist | Answers |
| `SEED_BUILDER_RESPONSE` | `SeedBuilderResponse` | Seed Builder | Steps |
| `AUTO_SAVE` | `AutoSavePayload` | Editor | Periodic 60s save |
| `WHAT_IF_COMMIT` | `{ simulation_id, proposed_changes }` | Blueprint Graph | Commit sandboxed What-If state |

### 10.2 Outbound WebSocket Events (Server → Client)

| Event | Payload | Target Screen | Trigger |
|-------|---------|---------------|---------|
| `AUTH_SESSION_OK` | `{ user }` | Login | Auth confirmed |
| `AUTH_SESSION_EXPIRED` | `{ reason }` | Global | Token expired |
| `RICHNESS_MODE_DETECTED` | `RichnessClassification` | Landing | Classification done |
| `PRD_ANALYSIS_READY` | `PRDAnalysisReport` | PRD Analysis | Analysis done |
| `SCALE_DIALOGUE_OPENED` | `ScaleDialogue` | Scale Dialogue | Missing signals |
| `HOSTING_OPTIONS_READY` | `HostingOptionsMatrix` | Hosting | Options generated |
| `TECH_STACK_OPTIONS_READY` | `TechStackOptionsMatrix` | Tech Stack | Options generated |
| `STEERING_PANEL_READY` | `SteeringPanel` | Steering | Stage boundary |
| `CHUNK_STREAM` | `StreamChunk` | Chat/Editor | LLM output |
| `NODE_UPDATED` | `{ node_id, change_type, new_data }` | Graph/Explorer | CRUD commit |
| `NODE_PENDING` | `{ node_id, reason }` | Steering | Awaiting input |
| `NODE_COMMITTED` | `CommittedNode` | Audit/Graph | Confirmed |
| `NODE_CREATED` | `Node` | Graph/Explorer | Added |
| `NODE_DELETED` | `{ node_id }` | Graph/Explorer | Removed |
| `NODE_ENRICHED` | `EnrichResult` | Enrichment | Enriched |
| `IMPACT_REPORT_READY` | `ImpactReport` | Impact Overlay | Revision |
| `PROPAGATION_STARTED` | `{ revision_id }` | Global | User confirmed |
| `PROPAGATION_COMPLETE` | `{ revision_id }` | Global | Done |
| `DECISION_LOGGED` | `DecisionEntry` | Audit | New decision |
| `DECISION_SUPERSEDED` | `{ old_id, new_id }` | Audit | Revised |
| `DECISION_REVERTED` | `{ reverted_to_id }` | Audit | Reverted |
| `RBAC_MODEL_READY` | `RBACModel` | RBAC Matrix | Generated |
| `RBAC_CONFLICT_DETECTED` | `PermissionConflict` | RBAC Matrix | Conflict |
| `PRIVILEGE_ESCALATION_FLAGGED` | `EscalationPath` | RBAC Matrix | Escalation |
| `RBAC_INHERITANCE_CYCLE_DETECTED` | `{ cycle_path }` | RBAC Matrix | Cycle |
| `AUDIT_EVENT_WRITTEN` | `AuditEvent` | Audit | New event |
| `STEERING_REQUIRED` | `{ stage, reason, options }` | Global | System stuck |
| `CHECKPOINT_CREATED` | `Checkpoint` | Checkpoint | Auto/manual |
| `CHECKPOINT_RESTORED` | `{ checkpoint_id }` | Global | Restored |
| `REVISION_BUDGET_EXHAUSTED` | `{ budget_id }` | Revision | Budget gone |
| `USER_OPTION_INCOHERENT` | `{ option_text, reason }` | Node Editor | Invalid |
| `INFRASTRUCTURE_PROFILE_STALE` | `{ profile_id }` | Settings | Stale |
| `CODE_GENERATION_STARTED` | `CodeGenStart` | Editor | Stage 8 |
| `CODE_FILE_STREAM` | `CodeFileChunk` | Editor | File chunk |
| `CODE_FILE_COMPLETE` | `GeneratedFile` | File Explorer | File done |
| `CODE_GENERATION_COMPLETE` | `WorkspaceManifest` | Global | Stage 8 done |
| `DEPENDENCY_INSTALL_STATUS` | `DependencyInstallStatus` | Terminal | Install |
| `RUNTIME_STARTED` | `{ preview_url, sandbox_id }` | Live Preview | Stage 9 |
| `RUNTIME_LOG` | `{ stream, content }` | Terminal | Output |
| `HOT_RELOAD` | `{ file_path }` | Live Preview | HMR |
| `TEST_RESULT_STREAM` | `TestResult` | Test Results | Test |
| `TEST_RUN_COMPLETED` | `TestSummary` | Test Results | Suite |
| `PREVIEW_INTERACTIVE_ELEMENT` | `{ selector }` | Editor/Explorer | Click |
| `PIPELINE_COMPLETE` | `PipelineCompletion` | Global | All done |
| `DEPLOYING` | `{ deployment_id }` | Deployment | Deploy |
| `DEPLOYED` | `{ url }` | Deployment | Done |
| `ERROR` | `PipelineError` | Global | Error |
| `LLM_FAILURE` | `LLMFailure` | Chat/Steering | LLM fail |
| `TOAST_NOTIFICATION` | `ToastNotification` | Global | Toast |
| `BROWSER_TAB_UPDATE` | `{ title }` | Global | Tab |
| `REMOTE_CURSOR` | `{ user_id, x, y }` | Global | Presence |
| `PRESENCE_UPDATE` | `Collaborator[]` | Global | Online |
| `EDIT_CONFLICT` | `MergeConflict` | Editor | Conflict |
| `SESSION_TIMEOUT_WARNING` | `{ minutes }` | Global | Timeout |
| `SESSION_EXPIRED` | `{ recovery }` | Global | Expired |
| `AUTO_SAVE` | `{ timestamp }` | Global | Save |
| `GRAPH_UPDATE` | `{ nodes, edges }` | Blueprint Graph | Change |
| `WHAT_IF_RESULT` | `WhatIfResult` | What-If | Simulation |
| `FILE_STATUS_CHANGED` | `{ file_path, status }` | File Explorer | Status |
| `EDITOR_SYNC` | `{ file_path, content }` | Editor | Sync |
| `EDITOR_CONFLICT` | `{ file_path, base, ours, theirs }` | Editor | Merge |
| `MERGE_CONFLICT` | `MergeConflictInfo` | Editor | 3-way diff |

---

## 11. Error Code Reference

| Code | Name | HTTP Status | Recoverable | UI Action |
|------|------|-------------|-------------|-----------|
| `LLM-E01` | LLM Timeout | 504 | Yes | Retry, Modify, Skip, Restore |
| `LLM-E02` | Malformed JSON | 500 | Yes | Repair, Discard, Restore |
| `LLM-E03` | Context Overflow | 413 | Yes | Compress, Override, Restore |
| `LLM-E04` | Rate Limit | 429 | Yes | Wait, Queue, Cancel |
| `GEN-E01` | Merge Conflict | 409 | Yes | 3-Way Diff, Manual Edit |
| `DEP-E01` | Dependency Failure | 500 | Yes | Retry, Modify, Skip |
| `SYS-E01` | General Error | 500 | Varies | Per `action_options` |
| `VAL-E01` | Validation Failed | 400 | Yes | Fix fields, Auto-fix |
| `VAL-E02` | RBAC Cycle | 400 | Yes | Fix inheritance |
| `VAL-E03` | RBAC Escalation | 400 | Yes | Remove inheritance, Add guard |
| `AUTH-E01` | Unauthorized | 401 | No | Re-login |
| `AUTH-E02` | Forbidden | 403 | No | Elevate role |
| `SES-E01` | Session Expired | 401 | Yes | Restore checkpoint |
| `SES-E02` | Session Conflict | 409 | Yes | Merge or overwrite |

---
