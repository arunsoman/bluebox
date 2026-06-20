/**
 * doc/api_event_contract.md §8.2 — Deployment (Stage 10)
 */
import { http } from "@/api/httpClient";

export const deployApi = {
  start: (projectId: string, body: DeployRequest) =>
    http.post<DeployStart>(`/api/v1/projects/${projectId}/deploy`, body),

  getStatus: (projectId: string) =>
    http.get<DeployStatus>(`/api/v1/projects/${projectId}/deploy/status`),

  cancel: (projectId: string) =>
    http.post<{ cancelled: true }>(`/api/v1/projects/${projectId}/deploy/cancel`),
};
