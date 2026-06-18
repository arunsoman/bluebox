/**
 * API client for the Bluebox backend.
 *
 * When VITE_LIVE_API=true, makes real HTTP requests.
 * When VITE_LIVE_API=false, returns mock data (for UI dev without backend).
 */

import { API_URL, FEATURES } from './config';

/* ─── types ─── */
export interface Blueprint {
  project_id: string;
  project_name: string;
  problem_statement: string;
  actors: Actor[];
  capabilities: Capability[];
  use_cases: UseCase[];
  user_stories: UserStory[];
  tech_stack_profile: TechStackProfile | null;
  infrastructure_profile: InfrastructureProfile | null;
  rbac_model: RBACModel | null;
  task_decomposition: EngineeringTask[];
  completeness_status: 'complete' | 'deferred' | 'incomplete';
  version: number;
}

export interface Actor {
  id: string;
  name: string;
  description: string;
  type: 'human' | 'system' | 'external';
  state: string;
  parent_ids: string[];
}

export interface Capability {
  id: string;
  name: string;
  description: string;
  actor_ids: string[];
  state: string;
}

export interface UseCase {
  id: string;
  name: string;
  description: string;
  capability_ids: string[];
  actor_ids: string[];
  state: string;
}

export interface UserStory {
  id: string;
  title: string;
  description: string;
  acceptance_criteria: string[];
  use_case_ids: string[];
  actor_ids: string[];
  state: string;
  points: number | null;
}

export interface EngineeringTask {
  id: string;
  title: string;
  description: string;
  story_ids: string[];
  estimated_hours: number | null;
  dependencies: string[];
  state: string;
}

export interface TechStackProfile {
  components: TechComponent[];
}

export interface TechComponent {
  category: string;
  technology: string;
  version: string | null;
  justification: string;
}

export interface InfrastructureProfile {
  tier: string | null;
  hosting_options: HostingOption[];
}

export interface HostingOption {
  name: string;
  provider: string;
  cost_range: string;
  scale_fit: string;
}

export interface RBACModel {
  roles: RBACRole[];
  max_inheritance_depth: number;
  has_cycles: boolean;
}

export interface RBACRole {
  id: string;
  name: string;
  permissions: string[];
  actor_ids: string[];
}

export interface DecisionLedger {
  project_id: string;
  entries: DecisionEntry[];
  revision_count: number;
  budget_remaining: number;
}

export interface DecisionEntry {
  entry_id: string;
  project_id: string;
  stage_id: number;
  action: string;
  node_id: string | null;
  node_type: string | null;
  user_id: string;
  old_value: object | null;
  new_value: object | null;
  reason: string;
  timestamp: string;
}

export interface SessionState {
  session_id: string;
  state: string;
  current_stage: number;
  project_id: string;
}

export interface HealthCheck {
  status: string;
  app: string;
  version: string;
}

/* ─── low-level fetch helper ─── */
async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API ${response.status}: ${error}`);
  }

  return response.json();
}

/* ─── API methods ─── */

/** Health check */
export async function getHealth(): Promise<HealthCheck> {
  const response = await fetch(`${API_URL.replace('/api/v1', '')}/health`);
  return response.json();
}

/** Create a new pipeline session */
export async function createSession(prdText: string, modelId?: string): Promise<{ session_id: string; project_id: string }> {
  if (!FEATURES.liveApi) {
    // Mock: return after short delay
    await new Promise((r) => setTimeout(r, 500));
    return { session_id: `sess-${Date.now()}`, project_id: `proj-${Date.now()}` };
  }
  return apiFetch('/session', {
    method: 'POST',
    body: JSON.stringify({ prd_text: prdText, model_id: modelId || '' }),
  });
}

/** Get session state */
export async function getSessionState(sessionId: string): Promise<SessionState> {
  if (!FEATURES.liveApi) {
    await new Promise((r) => setTimeout(r, 200));
    return {
      session_id: sessionId,
      state: 'stage_running',
      current_stage: 0,
      project_id: `proj-${Date.now()}`,
    };
  }
  return apiFetch(`/session/${sessionId}/state`);
}

/** Get blueprint */
export async function getBlueprint(projectId: string): Promise<Blueprint> {
  if (!FEATURES.liveApi) {
    await new Promise((r) => setTimeout(r, 300));
    throw new Error('Mock mode — use PRD input to start');
  }
  return apiFetch(`/blueprint/${projectId}`);
}

/** Get blueprint completeness */
export async function getCompleteness(projectId: string): Promise<object> {
  if (!FEATURES.liveApi) {
    return { is_complete: false, filled_fields: 0, total_fields: 7 };
  }
  return apiFetch(`/blueprint/${projectId}/completeness`);
}

/** Get decision ledger */
export async function getLedger(projectId: string): Promise<DecisionLedger> {
  if (!FEATURES.liveApi) {
    return {
      project_id: projectId,
      entries: [],
      revision_count: 0,
      budget_remaining: 5,
    };
  }
  return apiFetch(`/ledger/${projectId}`);
}

/** Send steering action */
export async function sendSteeringAction(
  sessionId: string,
  action: 'accept' | 'modify' | 'replace' | 'skip',
  data?: { node_id?: string; value?: string }
): Promise<void> {
  if (!FEATURES.liveApi) {
    await new Promise((r) => setTimeout(r, 200));
    return;
  }
  await apiFetch(`/session/${sessionId}/steering`, {
    method: 'POST',
    body: JSON.stringify({ action, ...data }),
  });
}

/** Get audit events */
export async function getAuditEvents(projectId: string): Promise<DecisionEntry[]> {
  if (!FEATURES.liveApi) {
    return [];
  }
  return apiFetch(`/audit/${projectId}`);
}

/** Restore checkpoint */
export async function restoreCheckpoint(projectId: string, checkpointId: string): Promise<object> {
  if (!FEATURES.liveApi) {
    await new Promise((r) => setTimeout(r, 300));
    return { restored: true };
  }
  return apiFetch(`/checkpoint/restore/${projectId}`, {
    method: 'POST',
    body: JSON.stringify({ checkpoint_id: checkpointId }),
  });
}

/** Abort session */
export async function abortSession(sessionId: string): Promise<void> {
  if (!FEATURES.liveApi) {
    return;
  }
  await apiFetch(`/session/${sessionId}/abort`, { method: 'POST' });
}

/* ─── LLM Providers & Models ─── */

export interface ProviderInfo {
  name: string;
  display_name: string;
  has_key: boolean;
  requires_key: boolean;
  key_env_var: string;
  docs_url: string;
  models: ModelOption[];
}

export interface ModelOption {
  id: string;
  name: string;
  description: string;
  max_tokens: number;
  supports_streaming: boolean;
  supports_functions: boolean;
  cost_per_1k_input: string | null;
  cost_per_1k_output: string | null;
}

/** List all providers with their models */
export async function listProviders(): Promise<{ providers: ProviderInfo[] }> {
  return apiFetch('/providers');
}

/** List active models (from providers with keys) */
export async function listActiveModels(): Promise<{ models: (ModelOption & { provider: string; provider_display: string })[] }> {
  return apiFetch('/models');
}

/** Set provider API key */
export async function setProviderKey(providerName: string, apiKey: string): Promise<{ provider: string; key_set: boolean }> {
  return apiFetch(`/providers/${providerName}/key`, {
    method: 'POST',
    body: JSON.stringify({ api_key: apiKey }),
  });
}

/** Get model config */
export async function getModelConfig(modelId: string): Promise<object> {
  return apiFetch(`/models/${modelId}/config`);
}

/* ─── Nodes ─── */

export interface PipelineNode {
  id: string;
  type: 'actor' | 'capability' | 'use_case' | 'user_story' | 'engineering_task';
  name: string;
  description: string;
  state: string;
  [key: string]: unknown;
}

export interface NodesResponse {
  nodes: PipelineNode[];
  total: number;
  limit: number;
  offset: number;
}

/** List pipeline nodes */
export async function listNodes(
  nodeType?: string,
  search?: string,
  limit = 100,
  offset = 0
): Promise<NodesResponse> {
  const params = new URLSearchParams();
  if (nodeType) params.set('node_type', nodeType);
  if (search) params.set('search', search);
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  return apiFetch(`/nodes?${params.toString()}`);
}
