/**
 * doc/api_event_contract.md §3.1 — IDE Shell & Global
 * Toolbar, layout persistence, pipeline state, trust mode, command palette.
 */
import { http } from "@/api/httpClient";

export const layoutApi = {
  getLayout: (projectId: string) =>
    http.get<IDELayout>(`/api/v1/projects/${projectId}/layout`),

  saveLayout: (projectId: string, body: IDELayout) =>
    http.post<IDELayout>(`/api/v1/projects/${projectId}/layout`, body),

  getState: (projectId: string) =>
    http.get<SessionState>(`/api/v1/projects/${projectId}/state`),

  setTrustMode: (projectId: string, body: TrustModeChange) =>
    http.post<TrustModeResult>(`/api/v1/projects/${projectId}/trust-mode`, body),

  // Command palette
  listCommands: (projectId: string, params: CommandQuery) =>
    http.get<CommandList>(`/api/v1/projects/${projectId}/commands`, { params }),

  executeCommand: (projectId: string, body: CommandExecute) =>
    http.post<CommandResult>(`/api/v1/projects/${projectId}/commands/execute`, body),
};
