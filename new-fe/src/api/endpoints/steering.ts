/**
 * doc/api_event_contract.md §4.2 — Steering Panel
 */
import { http } from "@/api/httpClient";

export const steeringApi = {
  getPanel: (projectId: string, stageId: number) =>
    http.get<SteeringPanel>(`/api/v1/projects/${projectId}/steering/${stageId}`),

  submitAction: (projectId: string, body: SteeringAction) =>
    http.post<SteeringResult>(`/api/v1/projects/${projectId}/steering`, body),

  toggleBookmark: (projectId: string, body: BookmarkToggle) =>
    http.post<void>(`/api/v1/projects/${projectId}/steering/bookmark`, body),
};
