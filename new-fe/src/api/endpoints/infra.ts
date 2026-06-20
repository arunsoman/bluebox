/**
 * doc/api_event_contract.md §6.2 — Hosting Options Matrix
 */
import { http } from "@/api/httpClient";

export const infrastructureApi = {
  selectHosting: (projectId: string, body: HostingSelection) =>
    http.post<InfrastructureProfile>(`/api/v1/projects/${projectId}/infrastructure/select`, body),

  getProfile: (projectId: string) =>
    http.get<InfrastructureProfile>(`/api/v1/projects/${projectId}/infrastructure`),
};
