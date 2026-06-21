/**
 * doc/api_event_contract.md §8.1 — Code Generation (Stage 8)
 * File streaming via WebSocket/SSE.
 *
 * `listTasks`/`pause`/`resume`/`runTask` are NOT in the contract — added
 * after it was written to back the code-generation progress panel, same
 * precedent as `llmConfig.ts`. See `TaskGenerationStatus`'s doc comment.
 */
import { http } from "@/api/httpClient";

export const codeGenApi = {
  start: (projectId: string, body: CodeGenRequest) =>
    http.post<CodeGenStart>(`/api/v1/projects/${projectId}/generate`, body),

  getStatus: (projectId: string) =>
    http.get<CodeGenStatus>(`/api/v1/projects/${projectId}/generate/status`),

  cancel: (projectId: string) =>
    http.post<{ cancelled: true }>(`/api/v1/projects/${projectId}/generate/cancel`),

  listTasks: (projectId: string) =>
    http.get<TaskGenerationStatus[]>(`/api/v1/projects/${projectId}/generate/tasks`),

  pause: (projectId: string) =>
    http.post<{ paused: true }>(`/api/v1/projects/${projectId}/generate/pause`),

  resume: (projectId: string) =>
    http.post<{ paused: false }>(`/api/v1/projects/${projectId}/generate/resume`),

  runTask: (projectId: string, taskId: string) =>
    http.post<GeneratedFile[]>(`/api/v1/projects/${projectId}/codegen/${taskId}`),
};
