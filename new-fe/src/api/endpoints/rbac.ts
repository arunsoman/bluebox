/**
 * doc/api_event_contract.md §6.1 — RBAC Matrix Editor
 */
import { http } from "@/api/httpClient";

export const rbacApi = {
  getModel: (projectId: string) =>
    http.get<RBACModel>(`/api/v1/projects/${projectId}/rbac`),

  updateModel: (projectId: string, body: RBACModelUpdate) =>
    http.post<RBACModel>(`/api/v1/projects/${projectId}/rbac`, body),

  validate: (projectId: string) =>
    http.post<RBACValidationResult>(`/api/v1/projects/${projectId}/rbac/validate`),

  commit: (projectId: string, body: RBACCommitRequest) =>
    http.post<RBACCommitResult>(`/api/v1/projects/${projectId}/rbac/commit`, body),
};
