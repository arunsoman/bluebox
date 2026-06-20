/**
 * GET /api/v1/projects/{project_id}/logs - not part of doc/api_event_contract.md
 * (added after the contract was written, same precedent as llmConfig.ts).
 * Backs the Log Viewer modal's (Ctrl+Shift+L) initial load; live updates
 * after that arrive as LOG_EVENT frames over the project's steering socket
 * (see logViewerStore.ts).
 */
import { http } from "@/api/httpClient";

export const logsApi = {
  getLogs: (projectId: string) => http.get<LogEvent[]>(`/api/v1/projects/${projectId}/logs`),
};
