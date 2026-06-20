/**
 * doc/api_event_contract.md §8.1 — Code Generation (Stage 8)
 * File streaming via WebSocket/SSE.
 */
import { http } from "@/api/httpClient";

export const codeGenApi = {
  start: (projectId: string, body: CodeGenRequest) =>
    http.post<CodeGenStart>(`/api/v1/projects/${projectId}/generate`, body),

  getStatus: (projectId: string) =>
    http.get<CodeGenStatus>(`/api/v1/projects/${projectId}/generate/status`),

  cancel: (projectId: string) =>
    http.post<{ cancelled: true }>(`/api/v1/projects/${projectId}/generate/cancel`),
};
