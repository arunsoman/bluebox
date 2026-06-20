/**
 * doc/api_event_contract.md §6.3 — Tech Stack Options Matrix
 */
import { http } from "@/api/httpClient";

export const techStackApi = {
  selectStack: (projectId: string, body: TechStackSelection) =>
    http.post<TechStackProfile>(`/api/v1/projects/${projectId}/tech-stack/select`, body),

  getProfile: (projectId: string) =>
    http.get<TechStackProfile>(`/api/v1/projects/${projectId}/tech-stack`),
};
