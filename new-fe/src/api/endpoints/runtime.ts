/**
 * doc/api_event_contract.md §4.5, §4.6 — Live Preview & Terminal
 * Runtime logs streamed via WebSocket/SSE.
 */
import { http } from "@/api/httpClient";

export const runtimeApi = {
  start: (projectId: string, body: RuntimeStartRequest) =>
    http.post<RuntimeStartResult>(`/api/v1/projects/${projectId}/runtime/start`, body),

  stop: (projectId: string) =>
    http.post<{ stopped: true }>(`/api/v1/projects/${projectId}/runtime/stop`),

  getStatus: (projectId: string) =>
    http.get<RuntimeStatus>(`/api/v1/projects/${projectId}/runtime/status`),

  executeCommand: (projectId: string, body: RuntimeCommand) =>
    http.post<RuntimeCommandResult>(`/api/v1/projects/${projectId}/runtime/command`, body),

  sendFeedback: (projectId: string, body: PreviewFeedback) =>
    http.post<void>(`/api/v1/projects/${projectId}/runtime/feedback`, body),
};
