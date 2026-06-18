// =============================================================================
// Collaborative Steering Pipeline — REST API Client
// Typed fetch wrapper with auth header injection
// =============================================================================

import type {
  AuditQueryDTO,
  AuditTrailDTO,
  AuthorizationGrantDTO,
  CheckpointListDTO,
  CheckpointRestoreDTO,
  DecisionLedgerDTO,
  PipelineSessionDTO,
  PropagationConsentDTO,
  RevisionRequestDTO,
  StartPipelineRequest,
  SteeringActionDTO,
  SubmitInputRequest,
} from '@/types/api';
import type {
  ImpactReport,
  InfrastructureProfile,
  RBACModel,
  RichnessClassification,
  TechStackProfile,
} from '@/types/domain';
import { useAuthStore } from '@/stores/authStore';

const API_BASE = '/api/v1';

function getAuthHeaders(): Record<string, string> {
  const state = useAuthStore.getState();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (state.userId) {
    headers['X-User-Id'] = state.userId;
  }
  if (state.role) {
    headers['X-User-Role'] = state.role;
  }
  return headers;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers = {
    ...getAuthHeaders(),
    ...(options?.headers || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`API error ${response.status}: ${errorText}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

// ── Typed endpoint helpers ───────────────────────────────────────────────────

export const pipelineApi = {
  /** Start a new pipeline session */
  start: (req: StartPipelineRequest): Promise<PipelineSessionDTO> =>
    apiFetch<PipelineSessionDTO>('/pipeline/start', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  /** Submit user input (PRD text, chat message, file) */
  submitInput: (sessionId: string, req: SubmitInputRequest): Promise<RichnessClassification> =>
    apiFetch<RichnessClassification>(`/pipeline/${sessionId}/input`, {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  /** Get current pipeline state */
  getState: (sessionId: string): Promise<PipelineSessionDTO> =>
    apiFetch<PipelineSessionDTO>(`/pipeline/${sessionId}/state`),

  /** Send a steering action */
  steer: (sessionId: string, action: SteeringActionDTO): Promise<unknown> =>
    apiFetch<unknown>(`/pipeline/${sessionId}/steer`, {
      method: 'POST',
      body: JSON.stringify(action),
    }),

  /** Request a revision */
  revise: (sessionId: string, req: RevisionRequestDTO): Promise<ImpactReport> =>
    apiFetch<ImpactReport>(`/pipeline/${sessionId}/revise`, {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  /** Send propagation consent */
  propagate: (sessionId: string, req: PropagationConsentDTO): Promise<unknown> =>
    apiFetch<unknown>(`/pipeline/${sessionId}/propagate`, {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  /** Restore a checkpoint */
  restoreCheckpoint: (sessionId: string, req: CheckpointRestoreDTO): Promise<PipelineSessionDTO> =>
    apiFetch<PipelineSessionDTO>(`/pipeline/${sessionId}/checkpoint/restore`, {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  /** List all checkpoints */
  listCheckpoints: (sessionId: string): Promise<CheckpointListDTO> =>
    apiFetch<CheckpointListDTO>(`/pipeline/${sessionId}/checkpoints`),

  /** Get decision ledger */
  getDecisions: (sessionId: string): Promise<DecisionLedgerDTO> =>
    apiFetch<DecisionLedgerDTO>(`/pipeline/${sessionId}/decisions`),

  /** Query audit trail */
  queryAudit: (sessionId: string, query: AuditQueryDTO): Promise<AuditTrailDTO> => {
    const params = new URLSearchParams();
    if (query.action_type) params.set('action_type', query.action_type);
    if (query.actor_id) params.set('actor_id', query.actor_id);
    if (query.date_from) params.set('date_from', query.date_from);
    if (query.date_to) params.set('date_to', query.date_to);
    params.set('page', String(query.page));
    params.set('page_size', String(query.page_size));
    return apiFetch<AuditTrailDTO>(`/pipeline/${sessionId}/audit?${params.toString()}`);
  },

  /** List sessions for a user */
  listSessions: (userId: string): Promise<PipelineSessionDTO[]> =>
    apiFetch<PipelineSessionDTO[]>(`/pipeline?user_id=${encodeURIComponent(userId)}`),

  /** Grant authorization scope */
  authorize: (sessionId: string, req: AuthorizationGrantDTO): Promise<unknown> =>
    apiFetch<unknown>(`/pipeline/${sessionId}/authorize`, {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  /** Save and exit session */
  saveAndExit: (sessionId: string): Promise<unknown> =>
    apiFetch<unknown>(`/pipeline/${sessionId}/save-and-exit`, { method: 'POST' }),

  /** Resume a suspended session */
  resume: (sessionId: string): Promise<PipelineSessionDTO> =>
    apiFetch<PipelineSessionDTO>(`/pipeline/${sessionId}/resume`, { method: 'POST' }),

  /** Get RBAC model */
  getRbac: (sessionId: string): Promise<RBACModel> =>
    apiFetch<RBACModel>(`/pipeline/${sessionId}/rbac`),

  /** Get infrastructure profile */
  getInfrastructure: (sessionId: string): Promise<InfrastructureProfile> =>
    apiFetch<InfrastructureProfile>(`/pipeline/${sessionId}/infrastructure`),

  /** Get tech stack profile */
  getTechStack: (sessionId: string): Promise<TechStackProfile> =>
    apiFetch<TechStackProfile>(`/pipeline/${sessionId}/techstack`),

  /** Submit scale inputs */
  submitScaleInputs: (sessionId: string, inputs: Record<string, unknown>): Promise<unknown> =>
    apiFetch<unknown>(`/pipeline/${sessionId}/scale`, {
      method: 'POST',
      body: JSON.stringify(inputs),
    }),
};
