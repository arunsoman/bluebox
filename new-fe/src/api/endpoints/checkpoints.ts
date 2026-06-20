/**
 * doc/api_event_contract.md §7.1 — Checkpoint Manager
 */
import { http } from "@/api/httpClient";

export const checkpointsApi = {
  list: (projectId: string) =>
    http.get<CheckpointList>(`/api/v1/projects/${projectId}/checkpoints`),

  create: (projectId: string, body: CreateCheckpointRequest) =>
    http.post<Checkpoint>(`/api/v1/projects/${projectId}/checkpoints`, body),

  restore: (projectId: string, body: RestoreCheckpointRequest) =>
    http.post<RestoreResult>(`/api/v1/projects/${projectId}/checkpoints/restore`, body),

  get: (projectId: string, checkpointId: string) =>
    http.get<Checkpoint>(`/api/v1/projects/${projectId}/checkpoints/${checkpointId}`),
};
