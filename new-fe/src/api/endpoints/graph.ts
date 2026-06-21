/**
 * doc/api_event_contract.md §4.8 — Blueprint Graph & What-If Simulation
 */
import { http } from "@/api/httpClient";

export const graphApi = {
  getGraph: (projectId: string, params?: GraphQuery) =>
    http.get<GraphData>(`/api/v1/projects/${projectId}/graph`, params),

  simulateWhatIf: (projectId: string, body: WhatIfRequest) =>
    http.post<WhatIfResult>(`/api/v1/projects/${projectId}/graph/what-if`, body),
};
