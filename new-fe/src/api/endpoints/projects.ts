/**
 * doc/api_event_contract.md §1.2 — Project Dashboard
 */
import { http } from "@/api/httpClient";

export const projectsApi = {
  list: (params?: ProjectListQuery) =>
    http.get<ProjectList>("/api/v1/projects", { params }),

  create: (body: CreateProjectRequest) =>
    http.post<Project>("/api/v1/projects", body),

  get: (projectId: string) =>
    http.get<Project>(`/api/v1/projects/${projectId}`),

  delete: (projectId: string) =>
    http.delete<{ deleted: true }>(`/api/v1/projects/${projectId}`),

  resume: (projectId: string) =>
    http.post<SessionState>(`/api/v1/projects/${projectId}/resume`),
};
