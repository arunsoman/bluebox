/**
 * doc/api_event_contract.md §9.5 — Session Management
 */
import { http } from "@/api/httpClient";

export const sessionApi = {
  saveAndExit: (projectId: string) =>
    http.post<{ checkpoint_id: string }>(`/api/v1/projects/${projectId}/save-and-exit`),

  autoSave: (projectId: string, body: AutoSavePayload) =>
    http.put<{ saved: true }>(`/api/v1/projects/${projectId}/autosave`, body),

  abort: (projectId: string, reason: string) =>
    http.post<{ aborted: true }>(`/api/v1/projects/${projectId}/abort`, { reason }),

  checkRecovery: (projectId: string) =>
    http.get<RecoveryData>(`/api/v1/projects/${projectId}/recovery`),
};
