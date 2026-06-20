/**
 * Collaborative Steering Pipeline — Complete Screen Models (All Stages)
 * 
 * Self-contained TypeScript interfaces for every screen, element, and data
 * structure shown in the wireframe & API contract documents.
 */

// =============================================================================
// SECTION 0: SHARED PRIMITIVES & ENUMS
// =============================================================================

export type RiskClassification = 'LOW_RISK' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TrustMode = 'PARANOID' | 'BALANCED' | 'AUTO_PILOT';
export type NodeStatus = 'SYSTEM_GENERATED' | 'USER_ENRICHED' | 'USER_DEFINED' | 'SUPERSEDED' | 'INFERRED' | 'DEFERRED' | 'ORPHANED';
export type Priority = 'Must Have' | 'Should Have' | 'Could Have';
export type Complexity = 'Low' | 'Medium' | 'High' | 'Critical';
export type ValidationSeverity = 'success' | 'warning' | 'error' | 'info';
export type Layer = 'Frontend' | 'Backend' | 'Auth' | 'Security' | 'Database' | 'Infrastructure';
export type SteeringActionType = 'accept' | 'modify' | 'replace' | 'authorize';
export type ExportOption = 'Generate Code (Stage 8)' | 'Export Blueprint JSON' | 'Export with Deferred Fields';
export type Persona = 'citizen_developer' | 'architect' | 'security_engineer';
export type AuthMethod = 'password' | 'fingerprint' | 'voice' | 'sso';
export type SSOProvider = 'github' | 'google' | 'microsoft';
export type PipelineStateEnum =
  | 'INITIALIZED'
  | 'CLASSIFYING'
  | 'AWAITING_INPUT_SEED'
  | 'STAGE_RUNNING'
  | 'STREAMING_CHUNKS'
  | 'AWAITING_STEERING'
  | 'REVISING'
  | 'IMPACT_ANALYZING'
  | 'AWAITING_PROPAGATION_CONSENT'
  | 'CHATTING'
  | 'STAGE_COMPLETED'
  | 'FINAL_GATE'
  | 'CODE_GENERATING'
  | 'AWAITING_CODE_REVIEW'
  | 'RUNNING'
  | 'AWAITING_RUNTIME_FEEDBACK'
  | 'DEPLOYING'
  | 'DEPLOYED'
  | 'FINALIZED'
  | 'ERROR';

export type FileStatus = 'generating' | 'complete' | 'modified' | 'conflict' | 'stale';
export type TestStatus = 'pass' | 'fail' | 'pending' | 'skipped';
export type DeployTarget = 'vercel' | 'aws_amplify' | 'netlify' | 'kubernetes';
export type GraphNodeType = 'actor' | 'capability' | 'use_case' | 'user_story' | 'engineering_task' | 'file';
export type GraphEdgeType = 'dependency' | 'traceability' | 'provenance';
export type NotificationSeverity = 'success' | 'warning' | 'error' | 'info';
export type StorageTier = 'DIFF' | 'FULL' | 'REFERENCE';

export type ScreenId =
  | 'LOGIN'
  | 'DASHBOARD'
  | 'LANDING'
  | 'INPUT_PROCESSING'
  | 'CLASSIFICATION'
  | 'PRD_ANALYSIS'
  | 'SCALE_DIALOGUE'
  | 'HOSTING_OPTIONS'
  | 'ACTOR_DISCOVERY'
  | 'RBAC_MATRIX'
  | 'TECH_STACK_OPTIONS'
  | 'CAPABILITY_DEFINITION'
  | 'USE_CASE_EDITOR'
  | 'STORY_EDITOR'
  | 'TASK_EDITOR'
  | 'COMPLETENESS_GATE'
  | 'CODE_GENERATION'
  | 'MERGE_CONFLICT'
  | 'LIVE_PREVIEW'
  | 'DEPLOYMENT_CONFIG'
  | 'DEPLOYMENT_COMPLETE'
  | 'BLUEPRINT_GRAPH'
  | 'AUDIT_PANEL'
  | 'COMMAND_PALETTE'
  | 'CHECKPOINT_RESTORE';

// =============================================================================
// SECTION 1: SHARED STRUCTURES
// =============================================================================

export interface UserProfile {
  userId: string;
  email: string;
  name: string;
  avatarUrl?: string;
  persona: Persona;
  permissions: ('pipeline_admin' | 'pipeline_user' | 'pipeline_viewer')[];
  preferences: {
    theme: 'light' | 'dark' | 'system';
    language: string;
    notificationChannel: 'websocket' | 'polling' | 'webhook';
    webhookUrl?: string;
  };
}

export interface ProvenanceStep {
  stage: number;
  stageName: string;
  decisionId: string;
  decisionSummary: string;
  timestamp: string; // ISO8601
}

export interface ProvenanceChain {
  steps: ProvenanceStep[];
  generatedAt: string;
  generatedBy: string;
  llmCallId?: string;
}

export interface ValidationBadge {
  field: string;
  present: boolean;
  valid: boolean;
  message?: string;
}

export interface RevisionBudget {
  remaining: number;
  total: number;
  percentageUsed: number;
  warning?: string;
}

export interface BookmarkedItem {
  nodeId: string;
  nodeType: string;
  name: string;
  bookmarkedAt: string;
}

export interface TrustModeSummary {
  mode: TrustMode;
  autoApprovedCount: number;
  pausedCount: number;
  criticalCount: number;
  highCount: number;
  totalNodes: number;
}

export interface PaginationState {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export interface ContextWindow {
  explanation: string;
  canTellMeMore: boolean;
  agentName: string;
}

export interface ActionBarState {
  canApproveAll: boolean;
  approveAllDisabledReason?: string;
  canReviewSelected: boolean;
  selectedCount: number;
  bookmarkedCount: number;
  canViewImpactGraph: boolean;
}

export interface NavigationBreadcrumb {
  stageId: number;
  stageName: string;
  isClickable: boolean;
}

export interface Collaborator {
  userId: string;
  name: string;
  avatarUrl?: string;
  role: 'owner' | 'editor' | 'viewer';
  color: string;
  currentPanel?: string;
  lastSeenAt: string;
}

export interface CheckpointSummary {
  checkpointId: string;
  stage: number;
  stageName: string;
  label: string;
  createdAt: string;
  createdBy: string;
  nodeCount: number;
  fileSizeBytes: number;
  autoGenerated: boolean;
}

export interface ToastNotification {
  id: string;
  severity: NotificationSeverity;
  title: string;
  body?: string;
  actions?: { label: string; actionType: string; payload?: unknown }[];
  autoDismissSeconds?: number;
  timestamp: string;
}

export interface PipelineError {
  errorCode: string;
  message: string;
  recoverable: boolean;
  actionOptions: { label: string; actionType: 'retry' | 'modify' | 'skip' | 'restore_checkpoint' | 'abort'; payload?: unknown }[];
  context: unknown;
}

export interface LLMFailure {
  failureType: 'timeout' | 'malformed_json' | 'context_overflow' | 'rate_limit' | 'empty_response';
  promptId: string;
  stage: number;
  partialOutput?: unknown;
  retryAfterSeconds?: number;
  queuePosition?: number;
}

export interface EditorTab {
  filePath: string;
  fileType: string;
  layer: string;
  isModified: boolean;
  isActive: boolean;
  scrollPosition: number;
  cursorPosition: { line: number; column: number };
}

export interface IDELayout {
  leftSidebarWidth: number;
  rightSidebarWidth: number;
  chatPanelHeight: number;
  bottomPanelHeight: number;
  leftSidebarCollapsed: boolean;
  rightSidebarCollapsed: boolean;
  bottomPanelCollapsed: boolean;
  activeCenterTab: 'editor' | 'steering' | 'graph';
  activeBottomTab: 'terminal' | 'test-results' | 'audit-trail';
  openEditorTabs: EditorTab[];
  recentSearches: string[];
}

export interface PipelineState {
  sessionId: string;
  currentState: PipelineStateEnum;
  currentStage: number;
  stageName: string;
  stageProgress: number;
  overallProgress: number;
  trustMode: TrustMode;
  pendingSteering: boolean;
  lastActivityAt: string;
  idleSuspendMinutes: number;
  idleExpireDays: number;
}

export interface ProjectSummary {
  projectId: string;
  projectName: string;
  currentStage: number;
  stageName: string;
  completenessPercentage: number;
  status: 'initialized' | 'running' | 'paused' | 'completed' | 'error';
  lastActiveAt: string;
  createdAt: string;
  thumbnailUrl?: string;
  checkpointCount: number;
  hasErrors: boolean;
  isStale?: boolean;
}

export interface NodeBase {
  nodeId: string;
  nodeType: 'actor' | 'capability' | 'use_case' | 'user_story' | 'engineering_task' | 'custom_annotation';
  name: string;
  description: string;
  layer: string;
  status: NodeStatus;
  parentId?: string;
  childrenIds: string[];
  metadata: Record<string, unknown>;
  provenance: ProvenanceChain;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  version: number;
}

export interface FileNode {
  path: string;
  name: string;
  type: 'file' | 'directory';
  layer: string;
  status: FileStatus;
  sizeBytes?: number;
  children?: FileNode[];
  provenance?: FileProvenance;
  lastModified: string;
}

export interface FileProvenance {
  taskId: string;
  storyId: string;
  decisionEntryId: string;
  checkpointId: string;
  generationTimestamp: string;
}

export interface DiffLine {
  lineNumber: number;
  content: string;
  type: 'addition' | 'deletion' | 'modification';
}

export interface DiffResult {
  filePath: string;
  additions: DiffLine[];
  deletions: DiffLine[];
  modifications: DiffLine[];
  unchanged: number;
}

export interface MergeConflictInfo {
  conflictId: string;
  filePath: string;
  baseVersion: string;
  oursVersion: string;
  theirsVersion: string;
  baseContent: string;
  oursContent: string;
  theirsContent: string;
  conflictsRemaining: number;
  totalConflicts: number;
}

export interface PortMapping {
  internalPort: number;
  externalPort: number;
  protocol: 'http' | 'https' | 'tcp';
}

export interface HealthCheck {
  checkName: string;
  status: 'pass' | 'fail' | 'pending';
  responseTimeMs?: number;
}

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  name: string;
  layer: string;
  status: NodeStatus;
  x?: number;
  y?: number;
  z?: number;
  data: unknown;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: GraphEdgeType;
  label?: string;
}

export interface AffectedNode {
  nodeId: string;
  nodeType: string;
  name: string;
  severity: 'success' | 'warning' | 'error';
  reason: string;
  distance: number;
}

export interface WhatIfResult {
  affectedNodes: AffectedNode[];
  severityBreakdown: { success: number; warning: number; error: number };
  filesToRegenerate: string[];
  estimatedRegenTimeSeconds: number;
  canCommit: boolean;
  blockingReasons?: string[];
}

export interface DecisionEntry {
  entryId: string;
  decisionType: 'steering' | 'system_authorized' | 'user_override' | 'revision' | 'revert';
  stage: number;
  stageName: string;
  summary: string;
  status: 'active' | 'superseded' | 'cancelled';
  payload: unknown;
  provenance: {
    previousEntryId?: string;
    parentDecisionId?: string;
    triggerEvent: string;
    contextSnapshotId: string;
  };
  metadata: {
    layer: string;
    riskClassification: string;
    autoApproved: boolean;
    trustModeAtDecision: string;
  };
  createdAt: string;
  createdBy: string;
  supersededBy?: string;
  revisionChain?: string[];
}

export interface AuditEvent {
  eventId: string;
  timestamp: string;
  sessionId: string;
  actor: { userId: string; role: string };
  action: string;
  stage?: number;
  target: { targetType: string; targetId: string };
  description: string;
  beforeState?: unknown;
  afterState?: unknown;
  diff?: unknown;
  authorizationRef?: string;
  storageTier: StorageTier;
}

export interface SearchResultItem {
  resultId: string;
  resultType: 'decision' | 'node' | 'file' | 'audit_event';
  title: string;
  snippet: string;
  relevanceScore: number;
  metadata: unknown;
  navigationTarget: string;
}

export interface IDECommand {
  id: string;
  name: string;
  description: string;
  category: 'navigation' | 'action' | 'recent' | 'settings';
  shortcut?: string;
  icon: string;
  available: boolean;
  actionType: string;
}

export interface RichCard {
  cardType: 'steering_panel' | 'impact_report' | 'code_stream' | 'test_result' | 'error_recovery';
  title: string;
  payload: unknown;
  actions: { actionId: string; label: string; actionType: string; payload?: unknown; style: 'primary' | 'secondary' | 'danger' }[];
  collapsible: boolean;
  defaultCollapsed: boolean;
}

export interface ChatMessage {
  messageId: string;
  messageType: 'user_intent' | 'user_command' | 'user_feedback' | 'system_response' | 'rich_card';
  sender: 'user' | 'system' | 'context_agent';
  content: string;
  timestamp: string;
  editedAt?: string;
  parentMessageId?: string;
  richCard?: RichCard;
  commandPayload?: { command: string; args: string[]; parsedIntent?: string };
  linkedDecisionId?: string;
  linkedAuditEventId?: string;
  intentMatched?: string;
  actionTaken?: string;
}

export interface EnrichmentSuggestion {
  suggestionId: string;
  fieldPath: string;
  suggestedValue: unknown;
  rationale: string;
  confidence: number;
}

export interface ValidationResult {
  valid: boolean;
  completenessScore: number;
  requiredFields: { fieldPath: string; fieldName: string; present: boolean; value: unknown; required: boolean; rule: string }[];
  prdCompliance: { acceptanceCriterionId: string; criterion: string; passed: boolean; prdReference: string }[];
  errors: { fieldPath: string; errorCode: string; message: string; severity: 'blocking' | 'critical'; suggestedFix?: string }[];
  warnings: { fieldPath: string; warningCode: string; message: string; severity: 'warning' | 'info' }[];
}

// =============================================================================
// SECTION 2: LOGIN & PERSONA SELECTION
// =============================================================================

export interface PersonaCard {
  id: Persona;
  icon: string;
  title: string;
  description: string;
  isSelected: boolean;
  borderColor: string;
  bgTint: string;
}

export interface AuthMethodOption {
  method: AuthMethod;
  label: string;
  icon: string;
  isActive: boolean;
  ssoProvider?: SSOProvider;
}

export interface LoginFormState {
  email: string;
  password: string;
  isEmailValid: boolean;
  isPasswordValid: boolean;
  trustMode: TrustMode;
  trustModeTooltip: string;
}

export interface LoginScreen {
  screenType: 'LOGIN';
  logo: { size: number; alt: string };
  title: string;
  subtitle: string;
  personaCards: PersonaCard[];
  authMethods: AuthMethodOption[];
  form: LoginFormState;
  isSubmitting: boolean;
  canContinue: boolean;
  error?: string;
}

// =============================================================================
// SECTION 3: PROJECT DASHBOARD
// =============================================================================

export interface ProjectCard {
  projectId: string;
  projectName: string;
  currentStage: number;
  stageName: string;
  lastActiveText: string;
  completenessPercentage: number;
  statusIndicator: 'success' | 'warning' | 'error';
  errorCount: number;
  checkpointCount: number;
  revisionCount: number;
  budgetRemaining: number;
  budgetTotal: number;
  actions: {
    canResume: boolean;
    canExportLedger: boolean;
    canViewAudit: boolean;
    canArchive: boolean;
  };
}

export interface QuickStartButton {
  id: string;
  icon: string;
  label: string;
  action: 'new_project' | 'upload_prd' | 'import_legacy' | 'clone';
}

export interface CheckpointRecoveryBanner {
  projectId: string;
  projectName: string;
  checkpointCount: number;
  canViewTimeline: boolean;
}

export interface DashboardScreen {
  screenType: 'DASHBOARD';
  header: {
    logo: string;
    title: string;
    actions: {
      canNewProject: boolean;
      hasNotifications: boolean;
      notificationCount: number;
      userAvatar?: string;
    };
  };
  recentProjects: ProjectCard[];
  quickStartButtons: QuickStartButton[];
  checkpointRecovery?: CheckpointRecoveryBanner;
  isLoading: boolean;
}

// =============================================================================
// SECTION 4: LANDING / EMPTY STATE
// =============================================================================

export interface UploadButton {
  id: string;
  icon: string;
  label: string;
  acceptedTypes: string;
  action: 'upload_prd' | 'upload_zip' | 'git_url' | 'add_image';
}

export interface TemplateButton {
  id: string;
  label: string;
  icon: string;
  description: string;
}

export interface LandingScreen {
  screenType: 'LANDING';
  header: {
    logo: string;
    title: string;
    actions: { canOpenChat: boolean; canOpenProfile: boolean; currentTrustMode: TrustMode };
  };
  inputArea: {
    placeholder: string;
    title: string;
    subtitle: string;
    minHeight: number;
    maxHeight: number;
    focusBorderColor: string;
    focusGlow: string;
    currentText: string;
    isFocused: boolean;
  };
  uploadButtons: UploadButton[];
  templates: TemplateButton[];
  dragDropZone: {
    label: string;
    acceptedTypes: string;
    isDragging: boolean;
  };
  trustMode: {
    current: TrustMode;
    description: string;
  };
  isSubmitting: boolean;
  canSubmit: boolean;
}

// =============================================================================
// SECTION 5: INPUT PROCESSING & CLASSIFICATION
// =============================================================================

export interface ProcessingStep {
  stepIndex: number;
  name: string;
  status: 'pending' | 'active' | 'complete';
  progressPercent?: number;
}

export interface RichnessClassification {
  mode: 'WELL_FORMED' | 'MINIMALIST' | 'SEED_ONLY';
  confidence: number;
  confidenceThreshold: number;
  gaps: string[];
  classificationBasis: string[];
  requiresUserReview: boolean;
}

export interface ComplianceBanner {
  frameworks: string[];
  canReviewDefaults: boolean;
  canDismiss: boolean;
  isDismissed: boolean;
}

export interface ClassificationResultCard {
  classification: RichnessClassification;
  canReviewAnalysis: boolean;
  canOverride: boolean;
  whyExpanded: boolean;
  whyDetails: string[];
}

export interface InputProcessingScreen {
  screenType: 'INPUT_PROCESSING';
  header: {
    logo: string;
    title: string;
    actions: { canOpenChat: boolean; canOpenProfile: boolean; currentTrustMode: TrustMode };
  };
  progress: {
    steps: ProcessingStep[];
    overallPercent: number;
    isComplete: boolean;
  };
  spinner: {
    isActive: boolean;
    label: string;
  };
  classificationResult?: ClassificationResultCard;
  complianceBanner?: ComplianceBanner;
  isLoading: boolean;
}

// =============================================================================
// SECTION 6: PRD ANALYSIS REPORT
// =============================================================================

export interface PRDSection {
  sectionName: string;
  mappedToStage: number;
  contentQuality: 'complete' | 'partial' | 'thin';
  extractedActors?: string[];
  extractedCapabilities?: string[];
  canNavigateToStage: boolean;
}

export interface ThinSection {
  sectionName: string;
  missingDetail: string;
  suggestedPrompt: string;
  canAddDetailViaChat: boolean;
  canGenerate: boolean;
}

export interface MissingSection {
  expectedSectionName: string;
  pipelineStage: number;
  severity: 'blocking' | 'recommended';
  canGenerate: boolean;
  generationScope: 'minimalist' | 'full';
}

export interface UnmappedSection {
  sectionName: string;
  contentPreview: string;
  suggestedAction: 'map_to_stage' | 'custom_annotation' | 'out_of_scope';
  canMapToStage: boolean;
  canSaveAsAnnotation: boolean;
  canMarkOutOfScope: boolean;
}

export interface PRDConflict {
  conflictType: 'contradiction' | 'duplicate' | 'ambiguity';
  description: string;
  involvedSections: string[];
}

export interface PRDAnalysisReport {
  explicitSections: PRDSection[];
  thinSections: ThinSection[];
  missingSections: MissingSection[];
  unmappedSections: UnmappedSection[];
  conflicts: PRDConflict[];
  richnessClassification: RichnessClassification;
}

export interface RawJsonView {
  isVisible: boolean;
  content: unknown;
  canCopy: boolean;
  copyFeedback: 'idle' | 'copied' | 'error';
}

export interface PRDAnalysisScreen {
  screenType: 'PRD_ANALYSIS';
  header: {
    title: string;
    fileName: string;
    canExport: boolean;
    actions: { canOpenChat: boolean; canOpenProfile: boolean; currentTrustMode: TrustMode };
  };
  report: PRDAnalysisReport;
  rawJson: RawJsonView;
  navigation: {
    canGoBack: boolean;
    backTarget: string;
    canProceed: boolean;
    proceedTarget: string;
    proceedLabel: string;
  };
  isLoading: boolean;
}

// =============================================================================
// SECTION 7: SCALE DIALOGUE (Stage 1)
// =============================================================================

export interface ScaleFormField {
  id: string;
  label: string;
  value: string | number | boolean;
  isValid: boolean;
  validationMessage?: string;
  isRequired: boolean;
  inputType: 'number' | 'text' | 'select' | 'checkbox';
  options?: string[];
  placeholder?: string;
  prefix?: string;
  suffix?: string;
}

export interface ScaleInputConflict {
  conflictType: 'concurrent_exceeds_total' | 'budget_timeline_mismatch' | 'unsupported_region';
  description: string;
  affectedFields: string[];
  suggestedFix: string;
}

export interface ScaleDialogueScreen {
  screenType: 'SCALE_DIALOGUE';
  header: {
    title: string;
    subtitle: string;
  };
  formFields: {
    expectedTotalUsers: ScaleFormField;
    peakConcurrentUsers: ScaleFormField;
    monthlyBudget: ScaleFormField;
    noBudgetLimit: ScaleFormField;
    launchTimeline: ScaleFormField;
  };
  validation: {
    isValid: boolean;
    conflicts: ScaleInputConflict[];
  };
  actions: {
    canCancel: boolean;
    canGenerateOptions: boolean;
    generateDisabledReason?: string;
  };
  isSubmitting: boolean;
}

// =============================================================================
// SECTION 8: HOSTING OPTIONS MATRIX (Stage 1)
// =============================================================================

export interface InfrastructureComponent {
  componentType: 'compute' | 'database' | 'cache' | 'cdn' | 'storage' | 'queue';
  provider: string;
  serviceName: string;
  tier: string;
}

export interface CostRange {
  lowUsd: number;
  midUsd: number;
  highUsd: number;
  basis: string;
  assumptions: string[];
  excludes: string[];
}

export interface HostingOption {
  optionId: string;
  optionName: string;
  isRecommended: boolean;
  architectureDescription: string;
  components: InfrastructureComponent[];
  estimatedMonthlyCost: CostRange;
  scaleFit: 'optimal' | 'acceptable' | 'poor';
  overBudget: boolean;
  overBudgetAmount?: number;
  rationale: string;
  pros: string[];
  cons: string[];
  badges: {
    withinBudget: boolean;
    autoScaling: boolean;
  };
  actions: {
    canSelect: boolean;
    canBookmark: boolean;
    isBookmarked: boolean;
    canModifyParameters: boolean;
    canViewRawJson: boolean;
  };
}

export interface HostingComparison {
  optionA: HostingOption;
  optionB: HostingOption;
  diffFields: string[];
}

export interface HostingOptionsScreen {
  screenType: 'HOSTING_OPTIONS';
  header: {
    title: string;
    canGoBack: boolean;
    canCompare: boolean;
    canConfirm: boolean;
  };
  scalePersona: {
    name: string;
    totalUsers: number;
    concurrentUsers: number;
    monthlyBudget: number;
  };
  options: HostingOption[];
  comparison?: HostingComparison;
  architectNote?: string;
  selectedOptionId?: string;
  isLoading: boolean;
  isSubmitting: boolean;
}

// =============================================================================
// SECTION 9: ACTOR DISCOVERY STEERING PANEL (Stage 2)
// =============================================================================

export interface ActorSummaryRow {
  nodeId: string;
  actorName: string;
  riskClassification: RiskClassification;
  status: 'auto_approved' | 'paused' | 'requires_authorization';
  description: string;
  downstreamNodeCount: number;
  isBookmarked: boolean;
  isSelected: boolean;
  isExpanded: boolean;
  consentRequired?: boolean;
  consentGiven: boolean;
  consentLabel?: string;
}

export interface ActorDetailCard {
  nodeId: string;
  actorName: string;
  description: string;
  layer: Layer;
  status: NodeStatus;
  riskClassification: RiskClassification;
  goals: string[];
  responsibilities: string[];
  stakeholders: string[];
  downstreamCapabilities: { capId: string; capName: string }[];
  provenance: ProvenanceChain;
  canEdit: boolean;
  canSave: boolean;
  hasUnsavedChanges: boolean;
}

export interface ActorDiscoveryScreen {
  screenType: 'ACTOR_DISCOVERY';
  header: {
    stageId: number;
    stageName: string;
    backNavigation: NavigationBreadcrumb;
    canClose: boolean;
    canShowHelp: boolean;
    canShowRawJson: boolean;
    trustMode: TrustModeSummary;
  };
  viewMode: 'summary' | 'detail';
  actorRows: ActorSummaryRow[];
  contextWindow: ContextWindow;
  actionBar: ActionBarState;
  bookmarks: {
    items: BookmarkedItem[];
    canOpenComparisonDrawer: boolean;
  };
  expandedDetail: ActorDetailCard | null;
  isLoading: boolean;
  isSubmitting: boolean;
}

// =============================================================================
// SECTION 10: RBAC MATRIX EDITOR (Stage 2)
// =============================================================================

export interface RBACRole {
  roleId: string;
  roleName: string;
  parentRoleId?: string;
  description: string;
  depth: number;
}

export interface RBACPermission {
  permissionId: string;
  resource: string;
  action: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  description: string;
}

export interface RolePermissionEntry {
  entryId: string;
  roleId: string;
  permissionId: string;
  granted: boolean;
  rationale: string;
  decisionMaker: string;
  conditions?: string[];
}

export interface InheritanceGraph {
  nodes: { roleId: string; depth: number; roleName: string }[];
  edges: { from: string; to: string }[];
  maxDepth: number;
  cycles: string[][];
  hasCycles: boolean;
}

export interface DataAccessEntry {
  roleId: string;
  roleName: string;
  entity: string;
  accessLevel: 'None' | 'Own' | 'Department' | 'All';
  rationale: string;
  guard?: string;
}

export interface EscalationPath {
  path: string[];
  resultingAccess: string;
  depth: number;
  algorithm: string;
}

export interface RBACValidationStatus {
  valid: boolean;
  inheritanceCycles: string[][];
  privilegeEscalations: EscalationPath[];
  missingRationales: string[];
  depthViolations: string[];
  validCount: number;
  escalationCount: number;
  cycleCount: number;
}

export interface PermissionMatrixRow {
  roleName: string;
  resource: string;
  action: string;
  granted: boolean;
  rationale: string;
  decisionMaker: string;
}

export interface RBACMatrixScreen {
  screenType: 'RBAC_MATRIX';
  header: {
    title: string;
    version: number;
    canExportJson: boolean;
    canValidate: boolean;
    canCommit: boolean;
  };
  roleInheritanceGraph: {
    graph: InheritanceGraph;
    depthLimit: number;
    depthStatus: ValidationSeverity;
  };
  permissionMatrix: {
    rows: PermissionMatrixRow[];
    columns: { resource: string; actions: string[] }[];
  };
  dataAccessMatrix: {
    entries: DataAccessEntry[];
  };
  validation: RBACValidationStatus;
  commitBlocked: boolean;
  commitBlockedReason?: string;
  isLoading: boolean;
  isSubmitting: boolean;
  lastSaved: string;
}

// =============================================================================
// SECTION 11: TECH STACK OPTIONS (Stage 3)
// =============================================================================

export interface TechStackComponent {
  framework: string;
  version?: string;
  language: string;
  justification: string;
}

export interface TechStackOption {
  optionId: string;
  optionName: string;
  isRecommended: boolean;
  detectedSignals: string[];
  actorCompatibility: number;
  scaleFit: string;
  learningCurve: string;
  rationale: string;
  components: {
    frontend?: TechStackComponent;
    backend?: TechStackComponent;
    database?: TechStackComponent;
    cache?: TechStackComponent;
    auth?: TechStackComponent;
    hosting?: TechStackComponent;
  };
  actions: {
    canSelect: boolean;
    canBookmark: boolean;
    isBookmarked: boolean;
    canCustomize: boolean;
    canViewRawJson: boolean;
  };
}

export interface TechStackOptionsScreen {
  screenType: 'TECH_STACK_OPTIONS';
  header: {
    title: string;
    canGoBack: boolean;
    canBookmark: boolean;
    canConfirm: boolean;
  };
  detectedSignals: string[];
  options: TechStackOption[];
  canCompare: boolean;
  selectedOptionId?: string;
  isLoading: boolean;
  isSubmitting: boolean;
}

// =============================================================================
// SECTION 12: CAPABILITY DEFINITION STEERING PANEL (Stage 3)
// =============================================================================

export interface CapabilitySummaryRow {
  nodeId: string;
  capabilityName: string;
  riskClassification: RiskClassification;
  status: 'auto_approved' | 'paused' | 'requires_authorization';
  description: string;
  layer: Layer;
  downstreamFileCount: number;
  downstreamNodeCount: number;
  touchesConfidentialData: boolean;
  requiresConsent: boolean;
  consentGiven: boolean;
  consentLabel?: string;
  riskDescription?: string;
  isBookmarked: boolean;
  isSelected: boolean;
  isExpanded: boolean;
}

export interface CapabilityDetailCard {
  nodeId: string;
  capabilityName: string;
  description: string;
  layer: Layer;
  status: NodeStatus;
  riskClassification: RiskClassification;
  actors: string[];
  userStories: { storyId: string; storyName: string }[];
  apiEndpoints: { method: string; path: string; description: string }[];
  dataEntities: { entity: string; operations: string[] }[];
  nonFunctionalRequirements: string[];
  provenance: ProvenanceChain;
  canEdit: boolean;
  canSave: boolean;
  hasUnsavedChanges: boolean;
}

export interface CapabilityDefinitionScreen {
  screenType: 'CAPABILITY_DEFINITION';
  header: {
    stageId: number;
    stageName: string;
    backNavigation: NavigationBreadcrumb;
    canClose: boolean;
    canShowHelp: boolean;
    canShowRawJson: boolean;
    trustMode: TrustModeSummary;
  };
  viewMode: 'summary' | 'detail';
  capabilityRows: CapabilitySummaryRow[];
  pagination: PaginationState;
  contextWindow: ContextWindow;
  actionBar: ActionBarState;
  bookmarks: {
    items: BookmarkedItem[];
    canOpenComparisonDrawer: boolean;
  };
  revisionBudget: RevisionBudget;
  expandedDetail: CapabilityDetailCard | null;
  isLoading: boolean;
  isSubmitting: boolean;
}

// =============================================================================
// SECTION 13: USE CASE EDITOR (Node CRUD — Universal + Specific)
// =============================================================================

export interface UseCaseStepDetail {
  stepNumber: number;
  description: string;
  actorPerforming: string;
  systemResponse?: string;
}

export interface AlternativeFlowDetail {
  flowId: string;
  flowName: string;
  triggerCondition: string;
  steps: UseCaseStepDetail[];
}

export interface UseCaseEditorScreen {
  screenType: 'USE_CASE_EDITOR';
  header: {
    nodeId: string;
    nodeName: string;
    capabilityId: string;
    capabilityName: string;
    canClose: boolean;
    canValidate: boolean;
  };
  basicInfo: {
    name: string;
    id: string;
    layer: Layer;
    status: NodeStatus;
    nameValid: boolean;
  };
  descriptionAndContext: {
    description: string;
    businessContext: string;
    descriptionValid: boolean;
  };
  actorsAndPreconditions: {
    primaryActor: string;
    secondaryActors: string[];
    canAddSecondaryActor: boolean;
    preconditions: { id: string; text: string; order: number }[];
    canAddPrecondition: boolean;
  };
  mainFlow: {
    steps: UseCaseStepDetail[];
    stepCount: number;
    minSteps: number;
    isValid: boolean;
    canAddStep: boolean;
    canReorder: boolean;
  };
  alternativeFlows: AlternativeFlowDetail[];
  canAddAltFlow: boolean;
  postconditions: { id: string; text: string; order: number }[];
  validationStatus: {
    nameValid: boolean;
    descriptionValid: boolean;
    primaryActorValid: boolean;
    preconditionsValid: boolean;
    mainFlowValid: boolean;
    postconditionsValid: boolean;
    overallValid: boolean;
    canCommit: boolean;
  };
  provenance: ProvenanceChain;
  actions: {
    canCancel: boolean;
    canDelete: boolean;
    canSave: boolean;
    canSaveAndEnrich: boolean;
  };
  isLoading: boolean;
  isSaving: boolean;
}

// =============================================================================
// SECTION 14: USER STORY EDITOR (Node CRUD — Universal + Specific)
// =============================================================================

export interface AcceptanceCriterionDetail {
  acId: string;
  given: string;
  when: string;
  then: string;
  complete: boolean;
  validationStatus: ValidationSeverity;
}

export interface UserStoryEditorScreen {
  screenType: 'STORY_EDITOR';
  header: {
    nodeId: string;
    nodeName: string;
    useCaseId: string;
    useCaseName: string;
    canClose: boolean;
    canValidate: boolean;
  };
  basicInfo: {
    title: string;
    id: string;
    storyPoints: number;
    priority: Priority;
    layer: Layer;
    titleValid: boolean;
  };
  acceptanceCriteria: {
    items: AcceptanceCriterionDetail[];
    minRequired: number;
    allComplete: boolean;
    canAdd: boolean;
  };
  technicalNotesAndDependencies: {
    technicalNotes: string;
    dependencies: { nodeId: string; nodeType: string; name: string; isResolved: boolean }[];
  };
  validation: {
    acDefined: boolean;
    acCount: number;
    titleFormatValid: boolean;
    prioritySet: boolean;
    overallValid: boolean;
    canCommit: boolean;
  };
  autoEnrich: {
    canRun: boolean;
    suggestion?: {
      acId: string;
      given: string;
      when: string;
      then: string;
      description: string;
    };
  };
  provenance: ProvenanceChain;
  actions: {
    canCancel: boolean;
    canDelete: boolean;
    canSave: boolean;
    canSaveAndEnrich: boolean;
  };
  isLoading: boolean;
  isSaving: boolean;
}

// =============================================================================
// SECTION 15: TASK EDITOR (Node CRUD — Universal + Specific)
// =============================================================================

export interface AccessGuardDetail {
  guardId: string;
  guardType: 'authorization' | 'authentication' | 'input_validation' | 'rate_limiting' | 'audit_logging' | 'encryption';
  description: string;
  isRequired: boolean;
  isDefined: boolean;
  implementationHint?: string;
}

export interface TaskFilePathDetail {
  path: string;
  layer: Layer;
  willGenerate: boolean;
}

export interface SchemaChangeDetail {
  id: string;
  sql: string;
  tableName: string;
  changeType: 'ADD_COLUMN' | 'CREATE_TABLE' | 'ALTER_TABLE' | 'ADD_INDEX';
  isDestructive: boolean;
}

export interface TaskEditorScreen {
  screenType: 'TASK_EDITOR';
  header: {
    nodeId: string;
    nodeName: string;
    storyId: string;
    storyName: string;
    canClose: boolean;
    canValidate: boolean;
  };
  basicInfo: {
    name: string;
    id: string;
    complexity: Complexity;
    estimatedHours: number;
    layer: Layer;
    status: NodeStatus;
  };
  preconditions: { id: string; text: string; order: number }[];
  postconditions: { id: string; text: string; order: number }[];
  filePaths: TaskFilePathDetail[];
  techStackRequirements: { name: string; category: string }[];
  schemaChanges: SchemaChangeDetail[];
  accessGuards: {
    guards: AccessGuardDetail[];
    totalRequired: number;
    totalDefined: number;
    meetsRequirement: boolean;
    touchesConfidentialData: boolean;
    pciDssScope?: boolean;
  };
  validation: {
    namePresent: boolean;
    preconditionsPresent: boolean;
    postconditionsPresent: boolean;
    filePathsPresent: boolean;
    accessGuardsMet: boolean;
    schemaChangesDocumented: boolean;
    overallValid: boolean;
    completenessScore: number;
  };
  autoEnrich: {
    canRun: boolean;
    suggestions?: {
      guards: AccessGuardDetail[];
      preconditions: string[];
      rationale: string;
    };
  };
  provenance: ProvenanceChain;
  actions: {
    canCancel: boolean;
    canDelete: boolean;
    canSave: boolean;
    canSaveAndEnrich: boolean;
  };
  isLoading: boolean;
  isSaving: boolean;
}

// =============================================================================
// SECTION 16: COMPLETENESS GATE (Stage 7)
// =============================================================================

export interface StageValidationSummaryDetail {
  stageId: number;
  stageName: string;
  totalNodes: number;
  validatedNodes: number;
  progressPercentage: number;
  status: ValidationSeverity;
  issueSummary: string;
  issueCount: number;
  issueType: 'thin' | 'missing' | 'incomplete' | 'stale' | 'complete';
  isExpanded: boolean;
}

export interface CriticalErrorItemDetail {
  nodeId: string;
  nodeType: 'actor' | 'capability' | 'use_case' | 'user_story' | 'engineering_task' | 'infrastructure_profile' | 'rbac_role';
  nodeName: string;
  errorCode: string;
  errorMessage: string;
  severity: 'blocking' | 'critical';
  fieldPath: string;
  expectedValue: string;
  actualValue: string;
  suggestedFix?: string;
  canQuickFix: boolean;
  canEdit: boolean;
  canDefer: boolean;
  deferRationale?: string;
  isSelectedForAutoFix: boolean;
  editorTarget: { screen: string; nodeId: string };
}

export interface WarningItemDetail {
  nodeId: string;
  nodeType: string;
  nodeName: string;
  warningCode: string;
  warningMessage: string;
  severity: 'warning' | 'info';
  recommendedAction?: string;
  canQuickFix: boolean;
  canEdit: boolean;
}

export interface AutoFixStateDetail {
  canRunAll: boolean;
  canRunSelected: boolean;
  selectedErrorCount: number;
  totalErrors: number;
  estimatedDurationSeconds: number;
  isRunning: boolean;
  progress?: {
    currentItem: number;
    totalItems: number;
    currentNodeName: string;
    status: 'pending' | 'active' | 'complete' | 'failed';
  };
  results?: {
    fixed: number;
    failed: number;
    skipped: number;
    requiresReview: number;
  };
}

export interface ExportOptionsStateDetail {
  options: {
    type: ExportOption;
    enabled: boolean;
    disabledReason?: string;
    requiresRole?: string;
  }[];
  canOverride: boolean;
  overrideRequiresRole: string;
  overrideConfirmationPhrase?: string;
  overallBlocked: boolean;
  blockReason?: string;
}

export interface CompletenessGateScreen {
  screenType: 'COMPLETENESS_GATE';
  header: {
    stageId: number;
    stageName: string;
    canRunAutoFix: boolean;
    canOverride: boolean;
  };
  overallCompleteness: {
    percentage: number;
    totalNodes: number;
    validatedNodes: number;
    nodesWithIssues: number;
  };
  counts: {
    valid: number;
    warnings: number;
    errors: number;
    deferred: number;
  };
  stageSummaries: StageValidationSummaryDetail[];
  criticalErrors: CriticalErrorItemDetail[];
  warnings: WarningItemDetail[];
  autoFix: AutoFixStateDetail;
  exportOptions: ExportOptionsStateDetail;
  navigation: {
    canGoBack: boolean;
    backTarget: string;
    canProceedToStage8: boolean;
    proceedTarget: string;
  };
  isLoading: boolean;
  isSubmitting: boolean;
  lastUpdated: string;
}

// =============================================================================
// SECTION 17: CODE GENERATION (Stage 8)
// =============================================================================

export interface CodeGenProgress {
  generationId: string;
  isInProgress: boolean;
  overallPercent: number;
  filesCompleted: number;
  filesTotal: number;
  currentFile?: string;
  currentTaskId?: string;
  canPause: boolean;
  canCancel: boolean;
}

export interface FileExplorerState {
  root: FileNode;
  expandedPaths: string[];
  selectedFilePath?: string;
  fileCount: { total: number; completed: number; generating: number; modified: number; conflict: number };
}

export interface EditorState {
  activeFilePath?: string;
  activeFileContent: string;
  activeFileLanguage: string;
  isStreaming: boolean;
  streamingCursorLine?: number;
  isModified: boolean;
  version: string;
  steeringPills: { lineNumber: number; instruction: string; canSubmit: boolean; canDismiss: boolean }[];
}

export interface TerminalState {
  logs: { stream: 'stdout' | 'stderr'; content: string; timestamp: string }[];
  isRunning: boolean;
  currentStep?: string;
  dependencyStatus?: {
    status: 'in_progress' | 'done' | 'failed';
    step: 'resolving' | 'downloading' | 'linking' | 'building';
    progressPercent: number;
    currentPackage?: string;
  };
}

export interface CodeGenerationScreen {
  screenType: 'CODE_GENERATION';
  header: {
    stageId: number;
    stageName: string;
    canPause: boolean;
    canCancel: boolean;
    trustMode: TrustMode;
  };
  progress: CodeGenProgress;
  fileExplorer: FileExplorerState;
  editor: EditorState;
  terminal: TerminalState;
  isLoading: boolean;
}

// =============================================================================
// SECTION 18: 3-WAY MERGE CONFLICT RESOLUTION
// =============================================================================

export interface MergePanel {
  label: string;
  version: string;
  timestamp: string;
  content: string;
  canAccept: boolean;
}

export interface MergeConflictDetail {
  conflictId: string;
  filePath: string;
  base: MergePanel;
  ours: MergePanel;
  theirs: MergePanel;
  output: {
    content: string;
    isEditable: boolean;
    conflictMarkers: { startLine: number; endLine: number; oursContent: string; theirsContent: string }[];
  };
  conflictsRemaining: number;
  totalConflicts: number;
  currentConflictIndex: number;
}

export interface MergeConflictScreen {
  screenType: 'MERGE_CONFLICT';
  header: {
    filePath: string;
    canClose: boolean;
  };
  conflict: MergeConflictDetail;
  actions: {
    canAcceptMerge: boolean;
    canCancel: boolean;
    canRestoreCheckpoint: boolean;
    restoreCheckpointId?: string;
  };
  isLoading: boolean;
  isSubmitting: boolean;
}

// =============================================================================
// SECTION 19: LIVE PREVIEW & RUNTIME (Stage 9)
// =============================================================================

export interface LivePreviewState {
  previewUrl: string;
  device: 'desktop' | 'tablet' | 'mobile';
  availableDevices: ('desktop' | 'tablet' | 'mobile')[];
  isLoading: boolean;
  canCopyUrl: boolean;
  iframeReady: boolean;
}

export interface TestResultItem {
  testId: string;
  testName: string;
  filePath: string;
  status: TestStatus;
  durationMs: number;
  assertionCount: number;
  failureMessage?: string;
  stackTrace?: string;
  expected?: string;
  actual?: string;
  lineNumber?: number;
  canDebug: boolean;
  canRerun: boolean;
}

export interface TestSummaryState {
  total: number;
  passed: number;
  failed: number;
  pending: number;
  skipped: number;
  totalDurationMs: number;
  passRate: number;
  isRunning: boolean;
}

export interface RuntimeLog {
  stream: 'stdout' | 'stderr';
  content: string;
  timestamp: string;
}

export interface RuntimeState {
  sandboxId: string;
  status: 'stopped' | 'starting' | 'running' | 'error' | 'crashed';
  previewUrl?: string;
  portMappings: PortMapping[];
  uptimeSeconds: number;
  resourceUsage: { cpuPercent: number; memoryMb: number };
  canStop: boolean;
  canRestart: boolean;
}

export interface LivePreviewScreen {
  screenType: 'LIVE_PREVIEW';
  header: {
    stageId: number;
    stageName: string;
    canStop: boolean;
    canRestart: boolean;
    trustMode: TrustMode;
  };
  preview: LivePreviewState;
  editor: EditorState;
  terminal: {
    logs: RuntimeLog[];
    statusIndicators: { deps: boolean; build: boolean; runtime: boolean; test: boolean };
  };
  testResults: {
    summary: TestSummaryState;
    tests: TestResultItem[];
    activeFilter: 'all' | 'failed' | 'passed';
  };
  runtime: RuntimeState;
  isLoading: boolean;
}

// =============================================================================
// SECTION 20: DEPLOYMENT CONFIGURATION (Stage 10)
// =============================================================================

export interface DeployTargetOption {
  target: DeployTarget;
  label: string;
  isSelected: boolean;
  icon: string;
}

export interface EnvironmentVariableField {
  key: string;
  value: string;
  isSecret: boolean;
  isRequired: boolean;
  isValid: boolean;
  validationMessage?: string;
}

export interface PreDeployCheck {
  checkName: string;
  status: 'pass' | 'fail' | 'warning' | 'pending';
  message: string;
  canAutoFix?: boolean;
  canDefer?: boolean;
  detail?: string;
}

export interface DeploymentConfigScreen {
  screenType: 'DEPLOYMENT_CONFIG';
  header: {
    stageId: number;
    stageName: string;
    canGoBack: boolean;
    canDeploy: boolean;
  };
  targetEnvironment: {
    options: DeployTargetOption[];
    selectedTarget?: DeployTarget;
  };
  configuration: {
    projectName: string;
    frameworkPreset: string;
    environmentVariables: EnvironmentVariableField[];
    canValidate: boolean;
    validationStatus: 'idle' | 'validating' | 'valid' | 'invalid';
  };
  preDeployChecks: PreDeployCheck[];
  allChecksPassing: boolean;
  blockingChecks: number;
  canDeploy: boolean;
  deployDisabledReason?: string;
  isLoading: boolean;
  isDeploying: boolean;
}

// =============================================================================
// SECTION 21: DEPLOYMENT COMPLETE
// =============================================================================

export interface DeploymentArtifact {
  id: string;
  label: string;
  fileType: string;
  downloadUrl: string;
  sizeBytes?: number;
}

export interface DeploymentCompleteScreen {
  screenType: 'DEPLOYMENT_COMPLETE';
  isModal: boolean;
  modalConfig: {
    width: number;
    zIndex: number;
    backdropColor: string;
  };
  successIcon: { type: string; size: number };
  title: string;
  deployedUrl: string;
  canCopyUrl: boolean;
  copyFeedback: 'idle' | 'copied' | 'error';
  qrCode: {
    url: string;
    size: number;
    alt: string;
  };
  primaryActions: {
    openApp: { label: string; url: string };
    share: { label: string; canShare: boolean };
    viewAuditTrail: { label: string; canView: boolean };
  };
  artifacts: DeploymentArtifact[];
  isLoading: boolean;
}

// =============================================================================
// SECTION 22: BLUEPRINT GRAPH (What-If Mode)
// =============================================================================

export interface GraphFilterState {
  nodeTypes: GraphNodeType[];
  layers: string[];
  depth: number;
  includeFiles: boolean;
}

export interface ImpactSimulationOverlay {
  isVisible: boolean;
  changedNodeId: string;
  changedNodeName: string;
  proposedChangeDescription: string;
  affectedNodeCount: number;
  severityBreakdown: { success: number; warning: number; error: number };
  filesToRegenerate: number;
  estimatedRegenTimeMinutes: number;
  canRecalculate: boolean;
  canCommit: boolean;
  canDiscard: boolean;
}

export interface BlueprintGraphScreen {
  screenType: 'BLUEPRINT_GRAPH';
  header: {
    title: string;
    mode: 'view' | 'what-if';
    canExit: boolean;
    canReset: boolean;
    canCommit: boolean;
    trustMode: TrustMode;
  };
  graph: {
    nodes: GraphNode[];
    edges: GraphEdge[];
    metadata: { totalNodes: number; maxDepth: number; layersPresent: string[] };
  };
  filters: GraphFilterState;
  whatIf: {
    isActive: boolean;
    draggedNodeId?: string;
    dropZoneColor?: string;
    overlay: ImpactSimulationOverlay | null;
  };
  isLoading: boolean;
  isSimulating: boolean;
}

// =============================================================================
// SECTION 23: AUDIT PANEL
// =============================================================================

export interface DecisionLedgerEntry {
  entryId: string;
  decisionType: string;
  stage: number;
  stageName: string;
  summary: string;
  status: 'active' | 'superseded' | 'cancelled';
  timestamp: string;
  createdBy: string;
  isExpanded: boolean;
  canInitiateRevision: boolean;
  canViewImpactGraph: boolean;
  canViewCodeDiff: boolean;
  payloadPreview?: unknown;
  impactDescription?: string;
}

export interface AuditTrailEntry {
  eventId: string;
  timestamp: string;
  action: string;
  stage?: number;
  actorName: string;
  description: string;
  canViewDiff: boolean;
  diffAvailable: boolean;
}

export interface AuditPanelScreen {
  screenType: 'AUDIT_PANEL';
  header: {
    title: string;
    activeTab: 'decision_ledger' | 'audit_trail';
    canExportJson: boolean;
  };
  decisionLedger: {
    entries: DecisionLedgerEntry[];
    totalCount: number;
    revisionBudgetRemaining: number;
    revisionBudgetTotal: number;
    searchQuery: string;
    searchResults?: SearchResultItem[];
  };
  auditTrail: {
    events: AuditTrailEntry[];
    totalCount: number;
    storageUsedBytes: number;
    storageBudgetBytes: number;
    retentionDays: number;
    filters: {
      sessionId?: string;
      actorId?: string;
      action?: string;
      stage?: number;
      fromDate?: string;
      toDate?: string;
    };
  };
  semanticSearch: {
    query: string;
    isSearching: boolean;
    results?: { count: number; files: number; events: number };
  };
  isLoading: boolean;
}

// =============================================================================
// SECTION 24: COMMAND PALETTE
// =============================================================================

export interface CommandPaletteItem {
  id: string;
  name: string;
  description: string;
  category: 'navigation' | 'action' | 'recent' | 'settings';
  shortcut?: string;
  icon: string;
  available: boolean;
  actionType: string;
  isSelected: boolean;
}

export interface CommandPaletteScreen {
  screenType: 'COMMAND_PALETTE';
  isOpen: boolean;
  query: string;
  width: number;
  zIndex: number;
  fuzzySearch: boolean;
  sections: {
    navigation: CommandPaletteItem[];
    actions: CommandPaletteItem[];
    recent: CommandPaletteItem[];
  };
  selectedIndex: number;
  canClose: boolean;
  isLoading: boolean;
}

// =============================================================================
// SECTION 25: CHECKPOINT RESTORE
// =============================================================================

export interface CheckpointTimelineNode {
  stageId: number;
  stageName: string;
  isCompleted: boolean;
  isCurrent: boolean;
  checkpoint?: CheckpointSummary;
}

export interface CheckpointRestoreScreen {
  screenType: 'CHECKPOINT_RESTORE';
  header: {
    title: string;
    canCreateNow: boolean;
    canRestoreSelected: boolean;
  };
  timeline: {
    stages: CheckpointTimelineNode[];
    checkpoints: CheckpointSummary[];
  };
  selectedCheckpoint?: CheckpointSummary & {
    stateSnapshot: PipelineState;
    decisionLedgerSnapshot: DecisionEntry[];
    workspaceSnapshot?: unknown;
  };
  preview: {
    canPreview: boolean;
    canExportSnapshot: boolean;
  };
  restoreConfirmation: {
    requiresTypedPhrase: boolean;
    requiredPhrase: string;
    typedPhrase: string;
    phrasesMatch: boolean;
    warningMessage: string;
  };
  isLoading: boolean;
  isRestoring: boolean;
}

// =============================================================================
// SECTION 26: MASTER UNION & TYPE GUARDS
// =============================================================================

export type AnyScreen =
  | LoginScreen
  | DashboardScreen
  | LandingScreen
  | InputProcessingScreen
  | PRDAnalysisScreen
  | ScaleDialogueScreen
  | HostingOptionsScreen
  | ActorDiscoveryScreen
  | RBACMatrixScreen
  | TechStackOptionsScreen
  | CapabilityDefinitionScreen
  | UseCaseEditorScreen
  | UserStoryEditorScreen
  | TaskEditorScreen
  | CompletenessGateScreen
  | CodeGenerationScreen
  | MergeConflictScreen
  | LivePreviewScreen
  | DeploymentConfigScreen
  | DeploymentCompleteScreen
  | BlueprintGraphScreen
  | AuditPanelScreen
  | CommandPaletteScreen
  | CheckpointRestoreScreen;

export type AnyScreenType = AnyScreen['screenType'];

export function isLoginScreen(screen: AnyScreen): screen is LoginScreen {
  return screen.screenType === 'LOGIN';
}

export function isDashboardScreen(screen: AnyScreen): screen is DashboardScreen {
  return screen.screenType === 'DASHBOARD';
}

export function isLandingScreen(screen: AnyScreen): screen is LandingScreen {
  return screen.screenType === 'LANDING';
}

export function isInputProcessingScreen(screen: AnyScreen): screen is InputProcessingScreen {
  return screen.screenType === 'INPUT_PROCESSING';
}

export function isPRDAnalysisScreen(screen: AnyScreen): screen is PRDAnalysisScreen {
  return screen.screenType === 'PRD_ANALYSIS';
}

export function isScaleDialogueScreen(screen: AnyScreen): screen is ScaleDialogueScreen {
  return screen.screenType === 'SCALE_DIALOGUE';
}

export function isHostingOptionsScreen(screen: AnyScreen): screen is HostingOptionsScreen {
  return screen.screenType === 'HOSTING_OPTIONS';
}

export function isActorDiscoveryScreen(screen: AnyScreen): screen is ActorDiscoveryScreen {
  return screen.screenType === 'ACTOR_DISCOVERY';
}

export function isRBACMatrixScreen(screen: AnyScreen): screen is RBACMatrixScreen {
  return screen.screenType === 'RBAC_MATRIX';
}

export function isTechStackOptionsScreen(screen: AnyScreen): screen is TechStackOptionsScreen {
  return screen.screenType === 'TECH_STACK_OPTIONS';
}

export function isCapabilityDefinitionScreen(screen: AnyScreen): screen is CapabilityDefinitionScreen {
  return screen.screenType === 'CAPABILITY_DEFINITION';
}

export function isUseCaseEditorScreen(screen: AnyScreen): screen is UseCaseEditorScreen {
  return screen.screenType === 'USE_CASE_EDITOR';
}

export function isUserStoryEditorScreen(screen: AnyScreen): screen is UserStoryEditorScreen {
  return screen.screenType === 'STORY_EDITOR';
}

export function isTaskEditorScreen(screen: AnyScreen): screen is TaskEditorScreen {
  return screen.screenType === 'TASK_EDITOR';
}

export function isCompletenessGateScreen(screen: AnyScreen): screen is CompletenessGateScreen {
  return screen.screenType === 'COMPLETENESS_GATE';
}

export function isCodeGenerationScreen(screen: AnyScreen): screen is CodeGenerationScreen {
  return screen.screenType === 'CODE_GENERATION';
}

export function isMergeConflictScreen(screen: AnyScreen): screen is MergeConflictScreen {
  return screen.screenType === 'MERGE_CONFLICT';
}

export function isLivePreviewScreen(screen: AnyScreen): screen is LivePreviewScreen {
  return screen.screenType === 'LIVE_PREVIEW';
}

export function isDeploymentConfigScreen(screen: AnyScreen): screen is DeploymentConfigScreen {
  return screen.screenType === 'DEPLOYMENT_CONFIG';
}

export function isDeploymentCompleteScreen(screen: AnyScreen): screen is DeploymentCompleteScreen {
  return screen.screenType === 'DEPLOYMENT_COMPLETE';
}

export function isBlueprintGraphScreen(screen: AnyScreen): screen is BlueprintGraphScreen {
  return screen.screenType === 'BLUEPRINT_GRAPH';
}

export function isAuditPanelScreen(screen: AnyScreen): screen is AuditPanelScreen {
  return screen.screenType === 'AUDIT_PANEL';
}

export function isCommandPaletteScreen(screen: AnyScreen): screen is CommandPaletteScreen {
  return screen.screenType === 'COMMAND_PALETTE';
}

export function isCheckpointRestoreScreen(screen: AnyScreen): screen is CheckpointRestoreScreen {
  return screen.screenType === 'CHECKPOINT_RESTORE';
}

// =============================================================================
// SECTION 27: GLOBAL APP STATE
// =============================================================================

export interface GlobalAppState {
  currentScreen: AnyScreenType;
  screenData: AnyScreen;
  projectId: string;
  sessionId: string;
  pipelineState: PipelineState;
  user: UserProfile;
  layout: IDELayout;
  collaborators: Collaborator[];
  notifications: ToastNotification[];
  unreadNotificationCount: number;
  websocketStatus: 'connected' | 'connecting' | 'disconnected' | 'reconnecting';
  isIdle: boolean;
  idleWarningMinutes?: number;
  globalError?: PipelineError;
  globalLLMFailure?: LLMFailure;
  activeModal: {
    type: 'none' | 'node_editor' | 'comparison_drawer' | 'impact_graph' | 'override_confirmation' | 'error_recovery';
    context?: Record<string, unknown>;
  };
  activeDrawer: {
    type: 'none' | 'chat' | 'audit' | 'file_explorer' | 'bookmark_comparison' | 'checkpoint_restore';
    context?: Record<string, unknown>;
  };
  commandPalette: CommandPaletteScreen;
}