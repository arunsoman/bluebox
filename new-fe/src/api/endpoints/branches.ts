/**
 * doc/api_event_contract.md §7.2 — Revision & Branching Manager
 */
import { http } from "@/api/httpClient";

export const branchesApi = {
  list: (projectId: string) =>
    http.get<BranchList>(`/api/v1/projects/${projectId}/branches`),

  create: (projectId: string, body: CreateBranchRequest) =>
    http.post<Branch>(`/api/v1/projects/${projectId}/branches`, body),

  merge: (projectId: string, branchId: string, body: MergeBranchRequest) =>
    http.post<BranchMergeResult>(`/api/v1/projects/${projectId}/branches/${branchId}/merge`, body),

  delete: (projectId: string, branchId: string) =>
    http.delete<{ deleted: true }>(`/api/v1/projects/${projectId}/branches/${branchId}`),
};
