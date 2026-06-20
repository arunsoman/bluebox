/**
 * Collaborative Steering Pipeline — Complete Screen-to-API Mapping
 * 
 * Maps every screen in the wireframe document to its concrete REST endpoints
 * and WebSocket events, extracted from the API & Event Contract.
 */

// =============================================================================
// SHARED EVENT TYPES (referenced across multiple screens)
// =============================================================================

type InboundAuthEvent =
  | 'AUTH_SESSION_OK'
  | 'AUTH_SESSION_EXPIRED';

type InboundGlobalEvent =
  | 'STATE_TRANSITION'
  | 'PIPELINE_STATE_CHANGED'
  | 'STAGE_COMPLETED'
  | 'CHECKPOINT_CREATED'
  | 'TOAST_NOTIFICATION'
  | 'BROWSER_TAB_UPDATE'
  | 'SESSION_TIMEOUT_WARNING'
  | 'SESSION_EXPIRED'
  | 'ERROR'
  | 'LLM_FAILURE'
  | 'REMOTE_CURSOR'
  | 'PRESENCE_UPDATE'
  | 'EDIT_CONFLICT';

type OutboundGlobalEvent =
  | 'AUTH_SESSION_INIT'
  | 'CURSOR_POSITION'
  | 'RESOLVE_CONFLICT'
  | 'AUTO_SAVE';

type InboundStreamingEvent =
  | 'CHUNK_STREAM'
  | 'CODE_FILE_STREAM'
  | 'CODE_FILE_COMPLETE'
  | 'DEPENDENCY_INSTALL_STATUS'
  | 'RUNTIME_LOG'
  | 'HOT_RELOAD'
  | 'TEST_RESULT_STREAM';

type InboundNodeEvent =
  | 'NODE_CREATED'
  | 'NODE_UPDATED'
  | 'NODE_DELETED'
  | 'NODE_ENRICHED'
  | 'NODE_PENDING'
  | 'NODE_COMMITTED'
  | 'USER_OPTION_INCOHERENT';

type OutboundNodeEvent =
  | 'NODE_MANIPULATION';

type InboundSteeringEvent =
  | 'STEERING_PANEL_READY'
  | 'STEERING_REQUIRED'
  | 'IMPACT_REPORT_READY'
  | 'REVISION_BUDGET_EXHAUSTED'
  | 'PROPAGATION_STARTED'
  | 'PROPAGATION_COMPLETE';

type OutboundSteeringEvent =
  | 'STEERING_ACTION'
  | 'BOOKMARK_TOGGLE'
  | 'MID_STAGE_STEER'
  | 'PROPAGATION_CONSENT'
  | 'WHAT_IF_COMMIT';

type InboundAuditEvent =
  | 'DECISION_LOGGED'
  | 'DECISION_SUPERSEDED'
  | 'DECISION_REVERTED'
  | 'AUDIT_EVENT_WRITTEN';

type OutboundAuditEvent =
  | 'AUDIT_FILTER'
  | 'REVISION_REQUEST'
  | 'CHECKPOINT_REQUEST'
  | 'CHECKPOINT_RESTORE_REQUEST';

type InboundRBACEvent =
  | 'RBAC_MODEL_READY'
  | 'RBAC_CONFLICT_DETECTED'
  | 'PRIVILEGE_ESCALATION_FLAGGED'
  | 'RBAC_INHERITANCE_CYCLE_DETECTED';

type OutboundRBACEvent =
  | 'RBAC_STEERING_ACTION';

type InboundChatEvent =
  | 'CHAT_RESPONSE'
  | 'CHAT_STREAM'
  | 'CONTEXT_ANSWER';

type OutboundChatEvent =
  | 'CHAT_MESSAGE'
  | 'CONTEXT_QUESTION';

type InboundCodeGenEvent =
  | 'CODE_GENERATION_STARTED'
  | 'CODE_GENERATION_COMPLETE'
  | 'MERGE_CONFLICT'
  | 'EDITOR_CONFLICT';

type OutboundCodeGenEvent =
  | 'CODE_FILE_STEER'
  | 'EDITOR_CHANGE'
  | 'INLINE_STEER'
  | 'RESOLVE_CONFLICT';

type InboundRuntimeEvent =
  | 'RUNTIME_STARTED'
  | 'TEST_RUN_COMPLETED'
  | 'PREVIEW_INTERACTIVE_ELEMENT';

type OutboundRuntimeEvent =
  | 'PREVIEW_FEEDBACK'
  | 'PREVIEW_INTERACTIVE_ELEMENT'
  | 'RUNTIME_COMMAND'
  | 'TEST_RERUN'
  | 'TEST_DEBUG';

type InboundDeployEvent =
  | 'DEPLOYING'
  | 'DEPLOYED'
  | 'PIPELINE_COMPLETE';

type InboundGraphEvent =
  | 'GRAPH_UPDATE'
  | 'WHAT_IF_RESULT';

type OutboundGraphEvent =
  | 'GRAPH_NODE_SELECT'
  | 'GRAPH_NODE_STEER'
  | 'WHAT_IF_SIMULATE';

type InboundInputEvent =
  | 'INPUT_PROCESSING_STARTED'
  | 'PROCESSING_STEP_COMPLETE'
  | 'RICHNESS_MODE_DETECTED'
  | 'PRD_ANALYSIS_READY'
  | 'COMPLIANCE_DETECTED'
  | 'INPUT_PROCESSING_ERROR';

type OutboundInputEvent =
  | 'USER_INPUT';

type InboundScaleEvent =
  | 'SCALE_INPUT_CONFLICT'
  | 'HOSTING_OPTIONS_READY'
  | 'INFRASTRUCTURE_PROFILE_STALE'
  | 'TECH_STACK_OPTIONS_READY';

type OutboundScaleEvent =
  | 'HOSTING_SELECTION'
  | 'TECH_STACK_SELECTION';

// =============================================================================
// SCREEN-TO-API MAPPING
// =============================================================================

export interface ScreenApiMapping {

  // ==========================================================================
  // 1. AUTHENTICATION & SESSION
  // ==========================================================================

  'LOGIN': {
    rest: {
      login: 'POST /api/v1/auth/login';
      biometric: 'POST /api/v1/auth/biometric';
      voice: 'POST /api/v1/auth/voice';
      me: 'GET /api/v1/auth/me';
      guest: 'POST /api/v1/auth/guest';
    };
    ws: {
      inbound: InboundAuthEvent;
      outbound: 'AUTH_SESSION_INIT';
    };
    sse: never;
  };

  // ==========================================================================
  // 2. PROJECT DASHBOARD
  // ==========================================================================

  'DASHBOARD': {
    rest: {
      listProjects: 'GET /api/v1/projects';
      createProject: 'POST /api/v1/projects';
      getProject: 'GET /api/v1/projects/{project_id}';
      deleteProject: 'DELETE /api/v1/projects/{project_id}';
      resumeSession: 'POST /api/v1/projects/{project_id}/resume';
    };
    ws: {
      inbound: 'PIPELINE_STATE_CHANGED';
      outbound: never;
    };
    sse: never;
  };

  // ==========================================================================
  // 3. LANDING / EMPTY STATE
  // ==========================================================================

  'LANDING': {
    rest: {
      submitInput: 'POST /api/v1/projects/{project_id}/input';
      uploadFile: 'POST /api/v1/projects/{project_id}/upload';
      gitConnect: 'POST /api/v1/projects/{project_id}/git-connect';
    };
    ws: {
      inbound: InboundInputEvent;
      outbound: OutboundInputEvent;
    };
    sse: 'GET /api/v1/projects/{project_id}/input/{input_id}/progress';
  };

  // ==========================================================================
  // 4. INPUT PROCESSING / CLASSIFICATION
  // ==========================================================================

  'INPUT_PROCESSING': {
    rest: {
      overrideClassification: 'POST /api/v1/projects/{project_id}/classification/override';
    };
    ws: {
      inbound: InboundInputEvent;
      outbound: never;
    };
    sse: 'GET /api/v1/projects/{project_id}/input/{input_id}/progress';
  };

  // ==========================================================================
  // 5. PRD ANALYSIS REPORT
  // ==========================================================================

  'PRD_ANALYSIS': {
    rest: {
      getState: 'GET /api/v1/projects/{project_id}/state';
    };
    ws: {
      inbound: 'PRD_ANALYSIS_READY' | 'COMPLIANCE_DETECTED' | InboundNodeEvent;
      outbound: OutboundNodeEvent;
    };
    sse: never;
  };

  // ==========================================================================
  // 6. MINIMALIST DIALOGUE (if richness = MINIMALIST)
  // ==========================================================================

  'MINIMALIST_DIALOGUE': {
    rest: {
      getDialogue: 'GET /api/v1/projects/{project_id}/dialogue/minimalist';
      submitDialogue: 'POST /api/v1/projects/{project_id}/dialogue/minimalist';
    };
    ws: {
      inbound: never;
      outbound: never;
    };
    sse: never;
  };

  // ==========================================================================
  // 7. SEED BUILDER (if richness = SEED_ONLY)
  // ==========================================================================

  'SEED_BUILDER': {
    rest: {
      getSeedDialogue: 'GET /api/v1/projects/{project_id}/dialogue/seed';
      submitSeedStep: 'POST /api/v1/projects/{project_id}/dialogue/seed';
    };
    ws: {
      inbound: never;
      outbound: never;
    };
    sse: never;
  };

  // ==========================================================================
  // 8. SCALE DIALOGUE (Stage 1)
  // ==========================================================================

  'SCALE_DIALOGUE': {
    rest: {
      submitScale: 'POST /api/v1/projects/{project_id}/scale';
      getOptions: 'GET /api/v1/projects/{project_id}/scale/options';
    };
    ws: {
      inbound: InboundScaleEvent;
      outbound: never;
    };
    sse: never;
  };

  // ==========================================================================
  // 9. HOSTING OPTIONS MATRIX (Stage 1)
  // ==========================================================================

  'HOSTING_OPTIONS': {
    rest: {
      selectHosting: 'POST /api/v1/projects/{project_id}/infrastructure/select';
      getProfile: 'GET /api/v1/projects/{project_id}/infrastructure';
    };
    ws: {
      inbound: 'HOSTING_OPTIONS_READY' | 'INFRASTRUCTURE_PROFILE_STALE';
      outbound: 'HOSTING_SELECTION';
    };
    sse: never;
  };

  // ==========================================================================
  // 10. ACTOR DISCOVERY STEERING PANEL (Stage 2)
  // ==========================================================================

  'ACTOR_DISCOVERY': {
    rest: {
      getPanel: 'GET /api/v1/projects/{project_id}/steering/2';
      submitAction: 'POST /api/v1/projects/{project_id}/steering';
      getNode: 'GET /api/v1/projects/{project_id}/nodes/{node_id}';
    };
    ws: {
      inbound: InboundSteeringEvent | InboundNodeEvent;
      outbound: OutboundSteeringEvent | OutboundNodeEvent;
    };
    sse: never;
  };

  // ==========================================================================
  // 11. RBAC MATRIX EDITOR (Stage 2)
  // ==========================================================================

  'RBAC_MATRIX': {
    rest: {
      getRBAC: 'GET /api/v1/projects/{project_id}/rbac';
      updateRBAC: 'POST /api/v1/projects/{project_id}/rbac';
      validateRBAC: 'POST /api/v1/projects/{project_id}/rbac/validate';
      commitRBAC: 'POST /api/v1/projects/{project_id}/rbac/commit';
    };
    ws: {
      inbound: InboundRBACEvent;
      outbound: OutboundRBACEvent;
    };
    sse: never;
  };

  // ==========================================================================
  // 12. TECH STACK OPTIONS (Stage 3)
  // ==========================================================================

  'TECH_STACK_OPTIONS': {
    rest: {
      selectStack: 'POST /api/v1/projects/{project_id}/tech-stack/select';
      getProfile: 'GET /api/v1/projects/{project_id}/tech-stack';
    };
    ws: {
      inbound: 'TECH_STACK_OPTIONS_READY';
      outbound: 'TECH_STACK_SELECTION';
    };
    sse: never;
  };

  // ==========================================================================
  // 13. CAPABILITY DEFINITION STEERING PANEL (Stage 3)
  // ==========================================================================

  'CAPABILITY_DEFINITION': {
    rest: {
      getPanel: 'GET /api/v1/projects/{project_id}/steering/3';
      submitAction: 'POST /api/v1/projects/{project_id}/steering';
      getNode: 'GET /api/v1/projects/{project_id}/nodes/{node_id}';
    };
    ws: {
      inbound: InboundSteeringEvent | InboundNodeEvent;
      outbound: OutboundSteeringEvent | OutboundNodeEvent;
    };
    sse: never;
  };

  // ==========================================================================
  // 14. USE CASE DECOMPOSITION STEERING PANEL (Stage 4)
  // ==========================================================================

  'USE_CASE_DECOMPOSITION': {
    rest: {
      getPanel: 'GET /api/v1/projects/{project_id}/steering/4';
      submitAction: 'POST /api/v1/projects/{project_id}/steering';
      getNode: 'GET /api/v1/projects/{project_id}/nodes/{node_id}';
    };
    ws: {
      inbound: InboundSteeringEvent | InboundNodeEvent | InboundStreamingEvent;
      outbound: OutboundSteeringEvent | OutboundNodeEvent;
    };
    sse: never;
  };

  // ==========================================================================
  // 15. USE CASE EDITOR (Node CRUD)
  // ==========================================================================

  'USE_CASE_EDITOR': {
    rest: {
      getNode: 'GET /api/v1/projects/{project_id}/nodes/{node_id}';
      createNode: 'POST /api/v1/projects/{project_id}/nodes';
      updateNode: 'PUT /api/v1/projects/{project_id}/nodes/{node_id}';
      deleteNode: 'DELETE /api/v1/projects/{project_id}/nodes/{node_id}';
      validateNode: 'POST /api/v1/projects/{project_id}/nodes/{node_id}/validate';
      enrichNode: 'POST /api/v1/projects/{project_id}/nodes/{node_id}/enrich';
    };
    ws: {
      inbound: InboundNodeEvent;
      outbound: OutboundNodeEvent;
    };
    sse: never;
  };

  // ==========================================================================
  // 16. USER STORY DECOMPOSITION STEERING PANEL (Stage 5)
  // ==========================================================================

  'STORY_DECOMPOSITION': {
    rest: {
      getPanel: 'GET /api/v1/projects/{project_id}/steering/5';
      submitAction: 'POST /api/v1/projects/{project_id}/steering';
      getNode: 'GET /api/v1/projects/{project_id}/nodes/{node_id}';
    };
    ws: {
      inbound: InboundSteeringEvent | InboundNodeEvent | InboundStreamingEvent | 'REVISION_BUDGET_EXHAUSTED';
      outbound: OutboundSteeringEvent | OutboundNodeEvent;
    };
    sse: never;
  };

  // ==========================================================================
  // 17. USER STORY EDITOR (Node CRUD)
  // ==========================================================================

  'STORY_EDITOR': {
    rest: {
      getNode: 'GET /api/v1/projects/{project_id}/nodes/{node_id}';
      createNode: 'POST /api/v1/projects/{project_id}/nodes';
      updateNode: 'PUT /api/v1/projects/{project_id}/nodes/{node_id}';
      deleteNode: 'DELETE /api/v1/projects/{project_id}/nodes/{node_id}';
      validateNode: 'POST /api/v1/projects/{project_id}/nodes/{node_id}/validate';
      enrichNode: 'POST /api/v1/projects/{project_id}/nodes/{node_id}/enrich';
    };
    ws: {
      inbound: InboundNodeEvent;
      outbound: OutboundNodeEvent;
    };
    sse: never;
  };

  // ==========================================================================
  // 18. TASK DECOMPOSITION STEERING PANEL (Stage 6)
  // ==========================================================================

  'TASK_DECOMPOSITION': {
    rest: {
      getPanel: 'GET /api/v1/projects/{project_id}/steering/6';
      submitAction: 'POST /api/v1/projects/{project_id}/steering';
      getNode: 'GET /api/v1/projects/{project_id}/nodes/{node_id}';
    };
    ws: {
      inbound: InboundSteeringEvent | InboundNodeEvent | InboundStreamingEvent | 'REVISION_BUDGET_EXHAUSTED' | 'CHECKPOINT_CREATED';
      outbound: OutboundSteeringEvent | OutboundNodeEvent;
    };
    sse: never;
  };

  // ==========================================================================
  // 19. TASK EDITOR (Node CRUD)
  // ==========================================================================

  'TASK_EDITOR': {
    rest: {
      getNode: 'GET /api/v1/projects/{project_id}/nodes/{node_id}';
      createNode: 'POST /api/v1/projects/{project_id}/nodes';
      updateNode: 'PUT /api/v1/projects/{project_id}/nodes/{node_id}';
      deleteNode: 'DELETE /api/v1/projects/{project_id}/nodes/{node_id}';
      validateNode: 'POST /api/v1/projects/{project_id}/nodes/{node_id}/validate';
      enrichNode: 'POST /api/v1/projects/{project_id}/nodes/{node_id}/enrich';
    };
    ws: {
      inbound: InboundNodeEvent;
      outbound: OutboundNodeEvent;
    };
    sse: never;
  };

  // ==========================================================================
  // 20. COMPLETENESS GATE (Stage 7)
  // ==========================================================================

  'COMPLETENESS_GATE': {
    rest: {
      getNode: 'GET /api/v1/projects/{project_id}/nodes/{node_id}';
      updateNode: 'PUT /api/v1/projects/{project_id}/nodes/{node_id}';
      validateNode: 'POST /api/v1/projects/{project_id}/nodes/{node_id}/validate';
      enrichNode: 'POST /api/v1/projects/{project_id}/nodes/{node_id}/enrich';
      generateCode: 'POST /api/v1/projects/{project_id}/generate';
    };
    ws: {
      inbound:
        | 'STEERING_REQUIRED'
        | 'STATE_TRANSITION'
        | InboundNodeEvent
        | 'INFRASTRUCTURE_PROFILE_STALE'
        | InboundRBACEvent
        | 'CHECKPOINT_CREATED';
      outbound: OutboundNodeEvent | OutboundAuditEvent;
    };
    sse: never;
  };

  // ==========================================================================
  // 21. CODE GENERATION (Stage 8)
  // ==========================================================================

  'CODE_GENERATION': {
    rest: {
      startGeneration: 'POST /api/v1/projects/{project_id}/generate';
      getStatus: 'GET /api/v1/projects/{project_id}/generate/status';
      cancelGeneration: 'POST /api/v1/projects/{project_id}/generate/cancel';
      listFiles: 'GET /api/v1/projects/{project_id}/workspace/files';
      readFile: 'GET /api/v1/projects/{project_id}/workspace/file';
    };
    ws: {
      inbound:
        | InboundCodeGenEvent
        | InboundStreamingEvent
        | 'FILE_STATUS_CHANGED'
        | 'EDITOR_SYNC';
      outbound: OutboundCodeGenEvent;
    };
    sse: 'GET /api/v1/projects/{project_id}/workspace/stream';
  };

  // ==========================================================================
  // 22. 3-WAY MERGE CONFLICT RESOLUTION
  // ==========================================================================

  'MERGE_CONFLICT': {
    rest: {
      getDiff: 'GET /api/v1/projects/{project_id}/workspace/diff';
      resolveMerge: 'POST /api/v1/projects/{project_id}/workspace/merge';
    };
    ws: {
      inbound: 'MERGE_CONFLICT' | 'EDITOR_CONFLICT';
      outbound: 'RESOLVE_CONFLICT';
    };
    sse: never;
  };

  // ==========================================================================
  // 23. LIVE PREVIEW / RUNTIME / TESTS (Stage 9)
  // ==========================================================================

  'LIVE_PREVIEW': {
    rest: {
      startRuntime: 'POST /api/v1/projects/{project_id}/runtime/start';
      stopRuntime: 'POST /api/v1/projects/{project_id}/runtime/stop';
      getRuntimeStatus: 'GET /api/v1/projects/{project_id}/runtime/status';
      executeCommand: 'POST /api/v1/projects/{project_id}/runtime/command';
      runTests: 'POST /api/v1/projects/{project_id}/tests/run';
      listTests: 'GET /api/v1/projects/{project_id}/tests';
    };
    ws: {
      inbound: InboundRuntimeEvent | InboundStreamingEvent;
      outbound: OutboundRuntimeEvent;
    };
    sse: 'GET /api/v1/projects/{project_id}/runtime/logs';
  };

  // ==========================================================================
  // 24. DEPLOYMENT CONFIGURATION (Stage 10)
  // ==========================================================================

  'DEPLOYMENT_CONFIG': {
    rest: {
      deploy: 'POST /api/v1/projects/{project_id}/deploy';
      getDeployStatus: 'GET /api/v1/projects/{project_id}/deploy/status';
      cancelDeploy: 'POST /api/v1/projects/{project_id}/deploy/cancel';
    };
    ws: {
      inbound: InboundDeployEvent;
      outbound: never;
    };
    sse: never;
  };

  // ==========================================================================
  // 25. DEPLOYMENT COMPLETE
  // ==========================================================================

  'DEPLOYMENT_COMPLETE': {
    rest: {
      getLedger: 'GET /api/v1/projects/{project_id}/ledger';
      getAudit: 'GET /api/v1/projects/{project_id}/audit';
      getBlueprint: 'GET /api/v1/blueprint/{project_id}';
    };
    ws: {
      inbound: 'PIPELINE_COMPLETE';
      outbound: never;
    };
    sse: never;
  };

  // ==========================================================================
  // 26. BLUEPRINT GRAPH (What-If Mode) — Cross-cutting
  // ==========================================================================

  'BLUEPRINT_GRAPH': {
    rest: {
      getGraph: 'GET /api/v1/projects/{project_id}/graph';
      whatIf: 'POST /api/v1/projects/{project_id}/graph/what-if';
    };
    ws: {
      inbound: InboundGraphEvent;
      outbound: OutboundGraphEvent;
    };
    sse: never;
  };

  // ==========================================================================
  // 27. AUDIT PANEL — Cross-cutting
  // ==========================================================================

  'AUDIT_PANEL': {
    rest: {
      getLedger: 'GET /api/v1/projects/{project_id}/ledger';
      getLedgerEntry: 'GET /api/v1/projects/{project_id}/ledger/{entry_id}';
      requestRevision: 'POST /api/v1/projects/{project_id}/ledger/revision';
      revertDecision: 'POST /api/v1/projects/{project_id}/ledger/revert';
      getAuditTrail: 'GET /api/v1/projects/{project_id}/audit';
    };
    ws: {
      inbound: InboundAuditEvent | 'REVISION_BUDGET_EXHAUSTED';
      outbound: OutboundAuditEvent;
    };
    sse: never;
  };

  // ==========================================================================
  // 28. COMMAND PALETTE — Cross-cutting
  // ==========================================================================

  'COMMAND_PALETTE': {
    rest: {
      listCommands: 'GET /api/v1/projects/{project_id}/commands';
      executeCommand: 'POST /api/v1/projects/{project_id}/commands/execute';
    };
    ws: {
      inbound: InboundChatEvent;
      outbound: OutboundChatEvent;
    };
    sse: never;
  };

  // ==========================================================================
  // 29. CHECKPOINT RESTORE — Cross-cutting
  // ==========================================================================

  'CHECKPOINT_RESTORE': {
    rest: {
      listCheckpoints: 'GET /api/v1/projects/{project_id}/checkpoints';
      createCheckpoint: 'POST /api/v1/projects/{project_id}/checkpoints';
      restoreCheckpoint: 'POST /api/v1/projects/{project_id}/checkpoints/restore';
      getCheckpoint: 'GET /api/v1/projects/{project_id}/checkpoints/{checkpoint_id}';
    };
    ws: {
      inbound: 'CHECKPOINT_CREATED' | 'CHECKPOINT_RESTORED';
      outbound: 'CHECKPOINT_REQUEST' | 'CHECKPOINT_RESTORE_REQUEST';
    };
    sse: never;
  };

  // ==========================================================================
  // 30. CHAT PANEL — Cross-cutting (accessible from any screen)
  // ==========================================================================

  'CHAT_PANEL': {
    rest: {
      getHistory: 'GET /api/v1/projects/{project_id}/chat';
      sendMessage: 'POST /api/v1/projects/{project_id}/chat';
      deleteMessage: 'DELETE /api/v1/projects/{project_id}/chat/{message_id}';
    };
    ws: {
      inbound: InboundChatEvent;
      outbound: OutboundChatEvent;
    };
    sse: 'GET /api/v1/projects/{project_id}/chat/stream';
  };

  // ==========================================================================
  // 31. FILE EXPLORER — Cross-cutting (accessible from any screen)
  // ==========================================================================

  'FILE_EXPLORER': {
    rest: {
      listFiles: 'GET /api/v1/projects/{project_id}/workspace/files';
      readFile: 'GET /api/v1/projects/{project_id}/workspace/file';
      writeFile: 'POST /api/v1/projects/{project_id}/workspace/file';
      deleteFile: 'DELETE /api/v1/projects/{project_id}/workspace/file';
      getProvenance: 'GET /api/v1/projects/{project_id}/workspace/file/provenance';
    };
    ws: {
      inbound: 'CODE_FILE_STREAM' | 'CODE_FILE_COMPLETE' | 'CODE_FILE_MODIFIED' | 'CODE_FILE_REJECTED' | 'FILE_STATUS_CHANGED';
      outbound: 'CODE_FILE_STEER';
    };
    sse: 'GET /api/v1/projects/{project_id}/workspace/stream';
  };

  // ==========================================================================
  // 32. EDITOR — Cross-cutting (accessible from any screen)
  // ==========================================================================

  'EDITOR': {
    rest: {
      getDiff: 'GET /api/v1/projects/{project_id}/workspace/diff';
      resolveMerge: 'POST /api/v1/projects/{project_id}/workspace/merge';
    };
    ws: {
      inbound: 'EDITOR_SYNC' | 'EDITOR_CONFLICT' | 'MERGE_CONFLICT';
      outbound: 'EDITOR_CHANGE' | 'INLINE_STEER';
    };
    sse: never;
  };

  // ==========================================================================
  // 33. TERMINAL — Cross-cutting (accessible from any screen)
  // ==========================================================================

  'TERMINAL': {
    rest: never;
    ws: {
      inbound: 'RUNTIME_COMMAND_OUTPUT' | 'DEPENDENCY_INSTALL_STATUS' | 'TERMINAL_OUTPUT';
      outbound: 'RUNTIME_COMMAND' | 'TERMINAL_INPUT';
    };
    sse: 'GET /api/v1/projects/{project_id}/runtime/logs';
  };

  // ==========================================================================
  // 34. GLOBAL SEARCH — Cross-cutting
  // ==========================================================================

  'GLOBAL_SEARCH': {
    rest: {
      search: 'GET /api/v1/projects/{project_id}/search';
    };
    ws: {
      inbound: never;
      outbound: never;
    };
    sse: never;
  };

  // ==========================================================================
  // 35. IDE SHELL / LAYOUT — Cross-cutting
  // ==========================================================================

  'IDE_SHELL': {
    rest: {
      getLayout: 'GET /api/v1/projects/{project_id}/layout';
      saveLayout: 'POST /api/v1/projects/{project_id}/layout';
      getState: 'GET /api/v1/projects/{project_id}/state';
      changeTrustMode: 'POST /api/v1/projects/{project_id}/trust-mode';
    };
    ws: {
      inbound: InboundGlobalEvent;
      outbound: OutboundGlobalEvent;
    };
    sse: never;
  };

  // ==========================================================================
  // 36. SESSION MANAGEMENT — Cross-cutting
  // ==========================================================================

  'SESSION_MANAGEMENT': {
    rest: {
      saveAndExit: 'POST /api/v1/projects/{project_id}/save-and-exit';
      autosave: 'PUT /api/v1/projects/{project_id}/autosave';
      abort: 'POST /api/v1/projects/{project_id}/abort';
      checkRecovery: 'GET /api/v1/projects/{project_id}/recovery';
    };
    ws: {
      inbound: 'SESSION_TIMEOUT_WARNING' | 'SESSION_EXPIRED';
      outbound: never;
    };
    sse: never;
  };
}

// =============================================================================
// SCREEN ID TYPE
// =============================================================================

export type ScreenId = keyof ScreenApiMapping;

// =============================================================================
// HELPER TYPE EXTRACTORS
// =============================================================================

/** Extract REST endpoints for a given screen */
export type RestEndpoints<S extends ScreenId> = ScreenApiMapping[S]['rest'];

/** Extract inbound WebSocket events for a given screen */
export type InboundWSEvents<S extends ScreenId> = ScreenApiMapping[S]['ws']['inbound'];

/** Extract outbound WebSocket events for a given screen */
export type OutboundWSEvents<S extends ScreenId> = ScreenApiMapping[S]['ws']['outbound'];

/** Extract SSE endpoint for a given screen (or never) */
export type SSEEndpoint<S extends ScreenId> = ScreenApiMapping[S]['sse'];

/** Check if a screen has an SSE stream */
export type HasSSE<S extends ScreenId> = ScreenApiMapping[S]['sse'] extends string ? true : false;

// =============================================================================
// SCREEN GROUPS (for batch operations)
// =============================================================================

/** All screens that use steering panel REST pattern */
export type SteeringScreen =
  | 'ACTOR_DISCOVERY'
  | 'CAPABILITY_DEFINITION'
  | 'USE_CASE_DECOMPOSITION'
  | 'STORY_DECOMPOSITION'
  | 'TASK_DECOMPOSITION';

/** All screens that use node CRUD REST pattern */
export type NodeCrudScreen =
  | 'USE_CASE_EDITOR'
  | 'STORY_EDITOR'
  | 'TASK_EDITOR'
  | 'COMPLETENESS_GATE';

/** All screens that stream LLM chunks */
export type StreamingScreen =
  | 'INPUT_PROCESSING'
  | 'USE_CASE_DECOMPOSITION'
  | 'STORY_DECOMPOSITION'
  | 'TASK_DECOMPOSITION'
  | 'CODE_GENERATION';

/** All screens with SSE streams */
export type SSEScreen =
  | 'LANDING'
  | 'INPUT_PROCESSING'
  | 'CODE_GENERATION'
  | 'LIVE_PREVIEW'
  | 'TERMINAL'
  | 'CHAT_PANEL'
  | 'FILE_EXPLORER';

/** All cross-cutting panels */
export type CrossCuttingPanel =
  | 'CHAT_PANEL'
  | 'FILE_EXPLORER'
  | 'EDITOR'
  | 'TERMINAL'
  | 'BLUEPRINT_GRAPH'
  | 'AUDIT_PANEL'
  | 'COMMAND_PALETTE'
  | 'CHECKPOINT_RESTORE'
  | 'GLOBAL_SEARCH'
  | 'IDE_SHELL'
  | 'SESSION_MANAGEMENT';

// =============================================================================
// COMPLETE EVENT INVENTORY (all possible WS events across all screens)
// =============================================================================

export type AllInboundWSEvents =
  | InboundAuthEvent
  | InboundGlobalEvent
  | InboundStreamingEvent
  | InboundNodeEvent
  | InboundSteeringEvent
  | InboundAuditEvent
  | InboundRBACEvent
  | InboundChatEvent
  | InboundCodeGenEvent
  | InboundRuntimeEvent
  | InboundDeployEvent
  | InboundGraphEvent
  | InboundInputEvent
  | InboundScaleEvent
  | 'WEBHOOK_DISPATCH';

export type AllOutboundWSEvents =
  | OutboundGlobalEvent
  | OutboundNodeEvent
  | OutboundSteeringEvent
  | OutboundAuditEvent
  | OutboundRBACEvent
  | OutboundChatEvent
  | OutboundCodeGenEvent
  | OutboundRuntimeEvent
  | OutboundGraphEvent
  | OutboundInputEvent
  | OutboundScaleEvent;

// =============================================================================
// COMPLETE REST ENDPOINT INVENTORY
// =============================================================================

export type AllRestEndpoints =
  | 'POST /api/v1/auth/login'
  | 'POST /api/v1/auth/biometric'
  | 'POST /api/v1/auth/voice'
  | 'GET /api/v1/auth/me'
  | 'POST /api/v1/auth/guest'
  | 'GET /api/v1/projects'
  | 'POST /api/v1/projects'
  | 'GET /api/v1/projects/{project_id}'
  | 'DELETE /api/v1/projects/{project_id}'
  | 'POST /api/v1/projects/{project_id}/resume'
  | 'POST /api/v1/projects/{project_id}/input'
  | 'POST /api/v1/projects/{project_id}/upload'
  | 'POST /api/v1/projects/{project_id}/git-connect'
  | 'POST /api/v1/projects/{project_id}/classification/override'
  | 'GET /api/v1/projects/{project_id}/state'
  | 'GET /api/v1/projects/{project_id}/dialogue/minimalist'
  | 'POST /api/v1/projects/{project_id}/dialogue/minimalist'
  | 'GET /api/v1/projects/{project_id}/dialogue/seed'
  | 'POST /api/v1/projects/{project_id}/dialogue/seed'
  | 'POST /api/v1/projects/{project_id}/scale'
  | 'GET /api/v1/projects/{project_id}/scale/options'
  | 'POST /api/v1/projects/{project_id}/infrastructure/select'
  | 'GET /api/v1/projects/{project_id}/infrastructure'
  | 'GET /api/v1/projects/{project_id}/steering/{stage_id}'
  | 'POST /api/v1/projects/{project_id}/steering'
  | 'GET /api/v1/projects/{project_id}/rbac'
  | 'POST /api/v1/projects/{project_id}/rbac'
  | 'POST /api/v1/projects/{project_id}/rbac/validate'
  | 'POST /api/v1/projects/{project_id}/rbac/commit'
  | 'POST /api/v1/projects/{project_id}/tech-stack/select'
  | 'GET /api/v1/projects/{project_id}/tech-stack'
  | 'GET /api/v1/projects/{project_id}/nodes/{node_id}'
  | 'POST /api/v1/projects/{project_id}/nodes'
  | 'PUT /api/v1/projects/{project_id}/nodes/{node_id}'
  | 'DELETE /api/v1/projects/{project_id}/nodes/{node_id}'
  | 'POST /api/v1/projects/{project_id}/nodes/{node_id}/validate'
  | 'POST /api/v1/projects/{project_id}/nodes/{node_id}/enrich'
  | 'POST /api/v1/projects/{project_id}/generate'
  | 'GET /api/v1/projects/{project_id}/generate/status'
  | 'POST /api/v1/projects/{project_id}/generate/cancel'
  | 'GET /api/v1/projects/{project_id}/workspace/files'
  | 'GET /api/v1/projects/{project_id}/workspace/file'
  | 'POST /api/v1/projects/{project_id}/workspace/file'
  | 'DELETE /api/v1/projects/{project_id}/workspace/file'
  | 'GET /api/v1/projects/{project_id}/workspace/file/provenance'
  | 'GET /api/v1/projects/{project_id}/workspace/diff'
  | 'POST /api/v1/projects/{project_id}/workspace/merge'
  | 'POST /api/v1/projects/{project_id}/runtime/start'
  | 'POST /api/v1/projects/{project_id}/runtime/stop'
  | 'GET /api/v1/projects/{project_id}/runtime/status'
  | 'POST /api/v1/projects/{project_id}/runtime/command'
  | 'POST /api/v1/projects/{project_id}/tests/run'
  | 'GET /api/v1/projects/{project_id}/tests'
  | 'POST /api/v1/projects/{project_id}/deploy'
  | 'GET /api/v1/projects/{project_id}/deploy/status'
  | 'POST /api/v1/projects/{project_id}/deploy/cancel'
  | 'GET /api/v1/projects/{project_id}/ledger'
  | 'GET /api/v1/projects/{project_id}/ledger/{entry_id}'
  | 'POST /api/v1/projects/{project_id}/ledger/revision'
  | 'POST /api/v1/projects/{project_id}/ledger/revert'
  | 'GET /api/v1/projects/{project_id}/audit'
  | 'GET /api/v1/blueprint/{project_id}'
  | 'GET /api/v1/projects/{project_id}/graph'
  | 'POST /api/v1/projects/{project_id}/graph/what-if'
  | 'GET /api/v1/projects/{project_id}/commands'
  | 'POST /api/v1/projects/{project_id}/commands/execute'
  | 'GET /api/v1/projects/{project_id}/checkpoints'
  | 'POST /api/v1/projects/{project_id}/checkpoints'
  | 'POST /api/v1/projects/{project_id}/checkpoints/restore'
  | 'GET /api/v1/projects/{project_id}/checkpoints/{checkpoint_id}'
  | 'GET /api/v1/projects/{project_id}/chat'
  | 'POST /api/v1/projects/{project_id}/chat'
  | 'DELETE /api/v1/projects/{project_id}/chat/{message_id}'
  | 'GET /api/v1/projects/{project_id}/search'
  | 'GET /api/v1/projects/{project_id}/layout'
  | 'POST /api/v1/projects/{project_id}/layout'
  | 'POST /api/v1/projects/{project_id}/trust-mode'
  | 'POST /api/v1/projects/{project_id}/save-and-exit'
  | 'PUT /api/v1/projects/{project_id}/autosave'
  | 'POST /api/v1/projects/{project_id}/abort'
  | 'GET /api/v1/projects/{project_id}/recovery';

// =============================================================================
// COMPLETE SSE ENDPOINT INVENTORY
// =============================================================================

export type AllSSEEndpoints =
  | 'GET /api/v1/projects/{project_id}/input/{input_id}/progress'
  | 'GET /api/v1/projects/{project_id}/chat/stream'
  | 'GET /api/v1/projects/{project_id}/workspace/stream'
  | 'GET /api/v1/projects/{project_id}/runtime/logs';