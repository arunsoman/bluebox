/**
 * doc/api_event_contract.md §9.1 — Global Search
 */
import { http } from "@/api/httpClient";

export const searchApi = {
  search: (projectId: string, params: SearchQuery) =>
    http.get<SearchResult>(`/api/v1/projects/${projectId}/search`, { params }),
};
