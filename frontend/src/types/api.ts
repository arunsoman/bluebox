// =============================================================================
// Collaborative Steering Pipeline — API DTO Types
// =============================================================================

import type {
  AuditEvent,
  Checkpoint,
  DecisionEntry,
  RichnessClassification,
  SteeringOption,
  StorageStrategy,
  StageName,
  PipelineStatus,
  RichnessMode,
  AuthorizationScopeType,
} from './domain';

export interface StartPipelineRequest {
  user_id: string;
  project_name?: string;
}

export interface PipelineSessionDTO {
  session_id: string;
  project_id: string;
  user_id: string;
  current_stage: StageName | null;
  status: PipelineStatus;
  richness_mode: RichnessMode | null;
  created_at: string;
}

export interface SubmitInputRequest {
  text: string;
  source: 'chat' | 'file_upload' | 'api';
}

export interface SteeringActionDTO {
  session_id: string;
  action_type: string;
  stage: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

export interface RevisionRequestDTO {
  session_id: string;
  original_decision_id: string;
  new_choice?: SteeringOption;
}

export interface PropagationConsentDTO {
  session_id: string;
  impact_report_id: string;
  user_confirmed: boolean;
  notes?: string;
}

export interface CheckpointRestoreDTO {
  session_id: string;
  checkpoint_id: string;
}

export interface AuditQueryDTO {
  action_type?: string;
  actor_id?: string;
  date_from?: string;
  date_to?: string;
  page: number;
  page_size: number;
}

export interface AuditTrailDTO {
  events: AuditEvent[];
  total: number;
  storage_strategy: StorageStrategy;
  storage_used_percent: number;
}

export interface DecisionLedgerDTO {
  entries: DecisionEntry[];
  total_user_decisions: number;
  total_system_decisions: number;
  total_superseded: number;
  total_reverted: number;
}

export interface CheckpointListDTO {
  checkpoints: Checkpoint[];
}

export interface AuthorizationGrantDTO {
  session_id: string;
  scope_type: AuthorizationScopeType;
  stage_range?: string[];
}

export interface PipelineStateDTO {
  session: PipelineSessionDTO;
  current_panel: Record<string, unknown> | null;
  streaming: boolean;
  last_event_timestamp: string | null;
}

export interface InputClassificationResponse {
  classification: RichnessClassification;
  input_id: string;
}
