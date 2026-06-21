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

  // Not part of doc/api_event_contract.md's REST table (the contract only documents the
  // WS-pushed STEERING_PANEL_READY flow) - backs a "Regenerate" action for when a stage's
  // candidates came back degenerate (e.g. an empty list) so the user isn't stuck with no
  // recovery path. Same endpoint the onboarding/WS auto-advance flows already call internally.
  regenerate: (projectId: string, stageId: number, body: { context?: string } = {}) =>
    http.post<SteeringPanel>(`/api/v1/projects/${projectId}/steering/${stageId}/generate`, body),
};
