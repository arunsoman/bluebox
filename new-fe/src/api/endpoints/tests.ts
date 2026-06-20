/**
 * doc/api_event_contract.md §4.7 — Test Results
 */
import { http } from "@/api/httpClient";

export const testsApi = {
  run: (projectId: string, body?: TestRunRequest) =>
    http.post<TestRunResult>(`/api/v1/projects/${projectId}/tests/run`, body),

  list: (projectId: string, params?: TestListQuery) =>
    http.get<TestList>(`/api/v1/projects/${projectId}/tests`, { params }),
};
