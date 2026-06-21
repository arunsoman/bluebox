/**
 * WebSocket event names + payload shapes — the full tables from
 * doc/api_event_contract.md §10.1 (Inbound, Client→Server) and §10.2
 * (Outbound, Server→Client), cross-checked against each event's
 * per-screen section body where one exists (more precise field names
 * there win over the summary table's shorthand).
 *
 * All payload types are the global ambient types declared in
 * src/api/types/types.d.ts — no imports needed.
 *
 * Wire framing assumption: neither document shows a raw frame example for
 * the main interactive socket (only the SSE streams use `event:`/`data:`
 * framing, which is a different transport). Every WS table in both docs
 * is laid out as "Event | Payload", so we frame each message as
 * `{ event: EventName, payload: Payload }` — the natural reading of that
 * table shape. See socketClient.ts.
 */

export interface ServerEventMap {
  // Connection lifecycle — §1.1
  AUTH_SESSION_OK: { user: UserProfile };
  AUTH_SESSION_EXPIRED: { reason: "token_expired" | "idle_timeout" };

  // Onboarding — §2.1, §2.2, §2.5
  INPUT_PROCESSING_STARTED: { input_id: string; steps: { step_index: number; name: string }[] };
  PROCESSING_STEP_COMPLETE: { step_index: number; step_name: string; progress_percent: number };
  RICHNESS_MODE_DETECTED: RichnessClassification;
  PRD_ANALYSIS_READY: PRDAnalysisReportType;
  COMPLIANCE_DETECTED: ComplianceDetectionResult;
  INPUT_PROCESSING_ERROR: { code: string; message: string; recoverable: boolean };
  SCALE_INPUT_CONFLICT: ScaleInputConflict;
  SCALE_DIALOGUE_OPENED: ScaleDialogue;
  HOSTING_OPTIONS_READY: HostingOptionsMatrix;
  TECH_STACK_OPTIONS_READY: TechStackOptionsMatrix;
  INFRASTRUCTURE_PROFILE_STALE: { profile_id: string; stale: true };

  // IDE Shell & Global state — §3.1
  STATE_TRANSITION: { from_state: PipelineStateEnum; to_state: PipelineStateEnum; reason: string; timestamp: string };
  PIPELINE_STATE_CHANGED: PipelineState;
  STAGE_COMPLETED: { stage: number; checkpoint_id: string; node_count: number };
  CHECKPOINT_CREATED: Checkpoint;

  // Chat — §4.1
  CHAT_RESPONSE: ChatMessage;
  CHAT_STREAM: { message_id: string; delta: string };
  CONTEXT_ANSWER: { answer: string; sources: unknown[] };
  CHUNK_STREAM: StreamChunk;

  // Steering — §4.2
  STEERING_PANEL_READY: SteeringPanel;
  STEERING_REQUIRED: { stage: number; reason: string; options: SteeringOption[] };
  NODE_PENDING: { node_id: string; reason: string };
  NODE_COMMITTED: CommittedNode;
  NODE_UPDATED: { node_id: string; node_type?: string; change_type?: string; new_data: Partial<DraftNode> };
  NODE_CREATED: Node;
  NODE_DELETED: { node_id: string };
  NODE_ENRICHED: EnrichResult;
  IMPACT_REPORT_READY: ImpactReport;
  PROPAGATION_STARTED: { revision_id: string };
  PROPAGATION_COMPLETE: { revision_id: string };
  USER_OPTION_INCOHERENT: { option_text: string; reason: string };

  // File Explorer / Editor — §4.3, §4.4, §8.1
  CODE_FILE_STREAM: CodeFileChunk;
  CODE_FILE_COMPLETE: GeneratedFile;
  CODE_FILE_MODIFIED: { file_path: string; diff: unknown };
  CODE_FILE_REJECTED: { file_path: string; reason: string };
  FILE_STATUS_CHANGED: { file_path: string; old_status: FileNodeStatus; new_status: FileNodeStatus };
  EDITOR_SYNC: { file_path: string; content: string; version: string };
  EDITOR_CONFLICT: { file_path: string; base: string; ours: string; theirs: string };
  EDIT_CONFLICT: MergeConflict;
  MERGE_CONFLICT: MergeConflictInfo;

  // Live Preview / Terminal — §4.5, §4.6
  RUNTIME_STARTED: { preview_url: string; sandbox_id: string };
  RUNTIME_LOG: { stream: "stdout" | "stderr"; content: string };
  HOT_RELOAD: { file_path: string };
  DEPENDENCY_INSTALL_STATUS: DependencyInstallStatus;
  PREVIEW_INTERACTIVE_ELEMENT: { selector: string };

  // Test Results — §4.7
  TEST_RESULT_STREAM: TestResult;
  TEST_RUN_COMPLETED: TestSummary;

  // Blueprint Graph / What-If — §4.8
  GRAPH_UPDATE: { nodes: GraphNode[]; edges: GraphEdge[] };
  WHAT_IF_RESULT: WhatIfResult;

  // Audit / Decision Ledger — §4.9
  DECISION_LOGGED: DecisionEntry;
  DECISION_SUPERSEDED: { old_id: string; new_id: string };
  DECISION_REVERTED: { reverted_to_id: string };
  AUDIT_EVENT_WRITTEN: AuditEvent;
  REVISION_BUDGET_EXHAUSTED: { budget_id: string };

  // Advisory modules — §6.1
  RBAC_MODEL_READY: RBACModel;
  RBAC_CONFLICT_DETECTED: PermissionConflict;
  PRIVILEGE_ESCALATION_FLAGGED: EscalationPath;
  RBAC_INHERITANCE_CYCLE_DETECTED: { cycle_path: string[] };

  // Governance — §7.1
  CHECKPOINT_RESTORED: { checkpoint_id: string };

  // Code Generation & Deployment — §8.1, §8.2
  CODE_GENERATION_STARTED: CodeGenStart;
  CODE_GENERATION_COMPLETE: WorkspaceManifest;
  /** NOT in the contract — per-task lifecycle push for the code-generation progress panel. See TaskGenerationStatus. */
  CODE_TASK_STATUS: TaskGenerationStatus;
  DEPLOYING: { deployment_id: string };
  DEPLOYED: { url: string };

  // Cross-cutting — §9.2, §9.3, §9.4, §9.5, §10.2
  PIPELINE_COMPLETE: PipelineCompletion;
  ERROR: PipelineError;
  LLM_FAILURE: LLMFailure;
  TOAST_NOTIFICATION: ToastNotification;
  BROWSER_TAB_UPDATE: { title: string };
  REMOTE_CURSOR: { user_id: string; x: number; y: number };
  PRESENCE_UPDATE: Collaborator[];
  SESSION_TIMEOUT_WARNING: { minutes_remaining: number };
  SESSION_EXPIRED: { recovery_available: boolean };
  AUTO_SAVE: { timestamp: string };

  // Log viewer (Ctrl+Shift+L) - not in api_event_contract.md, same dev-tool
  // exception as llmConfig.ts (CLAUDE.md). Pushed by connection_registry.py
  // over this same per-project socket - logViewerStore subscribes directly;
  // socketClient itself never logs this event (see its own module docstring).
  LOG_EVENT: LogEvent;
}

export type ServerEventName = keyof ServerEventMap;

export interface ClientEventMap {
  // Connection lifecycle — §1.1
  AUTH_SESSION_INIT: { session_id: string; token: string };

  // Onboarding — §2.1, §2.3, §2.4, §2.5
  USER_INPUT: RawUserInput;
  SCALE_DIALOGUE_RESPONSE: ScaleInputs;
  MINIMALIST_RESPONSE: MinimalistResponse;
  SEED_BUILDER_RESPONSE: SeedBuilderResponse;

  // IDE Shell & Global — §3.1
  CHECKPOINT_REQUEST: { action: "create" | "restore"; checkpoint_id?: string };

  // Chat — §4.1
  CHAT_MESSAGE: ChatMessageInbound;
  CONTEXT_QUESTION: { question: string; context_node_id?: string };
  MID_STAGE_STEER: MidSteerSignal;

  // Steering — §4.2
  STEERING_ACTION: SteeringAction;
  BOOKMARK_TOGGLE: { option_id: string; bookmarked: boolean };

  // Node Editor — §5.1
  NODE_MANIPULATION: { action: "create" | "update" | "delete"; node_type: string; node_id?: string; data?: Record<string, unknown> };

  // File Explorer / Editor — §4.3, §4.4
  CODE_FILE_STEER: { file_path: string; action: "accept" | "reject" | "modify" | "regenerate"; instruction?: string };
  EDITOR_CHANGE: { file_path: string; change_event: string; content_hash: string };
  INLINE_STEER: { file_path: string; line_number: number; instruction: string };
  AUTO_SAVE: AutoSavePayload;
  RESOLVE_CONFLICT: { conflict_id: string; resolution: "ours" | "theirs" | "manual" };

  // Live Preview / Terminal — §4.5, §4.6
  PREVIEW_FEEDBACK: PreviewFeedback;
  RUNTIME_COMMAND: RuntimeCommand;

  // Test Results — §4.7
  TEST_RERUN: { test_id: string };
  TEST_DEBUG: { test_id: string };

  // Blueprint Graph / What-If — §4.8
  GRAPH_NODE_SELECT: { node_id: string };
  GRAPH_NODE_STEER: { node_id: string; instruction: string };
  WHAT_IF_SIMULATE: WhatIfRequest;
  WHAT_IF_COMMIT: { simulation_id: string; proposed_changes: Record<string, unknown> };

  // Audit / Decision Ledger — §4.9, §7.2
  AUDIT_FILTER: AuditQuery;
  REVISION_REQUEST: RevisionRequest;
  PROPAGATION_CONSENT: { impact_report_id: string; confirmed: boolean; notes?: string };

  // Advisory modules — §6.1, §6.2, §6.3
  RBAC_STEERING_ACTION: { target: string; action_type: string; payload: Record<string, unknown> };
  HOSTING_SELECTION: HostingSelection;
  TECH_STACK_SELECTION: TechStackSelection;

  // Cross-cutting presence — §9.3
  CURSOR_POSITION: { x: number; y: number; panel: string };
}

export type ClientEventName = keyof ClientEventMap;
