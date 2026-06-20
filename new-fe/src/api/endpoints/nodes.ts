/**
 * doc/api_event_contract.md §5 — Node CRUD & Editors
 * Universal node editor + specific type editors (use case, user story, task).
 */
import { http } from "@/api/httpClient";

export const nodesApi = {
  get: (projectId: string, nodeId: string) =>
    http.get<Node>(`/api/v1/projects/${projectId}/nodes/${nodeId}`),

  create: (projectId: string, body: CreateNodeRequest) =>
    http.post<Node>(`/api/v1/projects/${projectId}/nodes`, body),

  update: (projectId: string, nodeId: string, body: UpdateNodeRequest) =>
    http.put<Node>(`/api/v1/projects/${projectId}/nodes/${nodeId}`, body),

  delete: (projectId: string, nodeId: string, body: DeleteNodeRequest) =>
    http.delete<{ deleted: true }>(`/api/v1/projects/${projectId}/nodes/${nodeId}`, { data: body }),

  enrich: (projectId: string, nodeId: string, body: EnrichRequest) =>
    http.post<EnrichResult>(`/api/v1/projects/${projectId}/nodes/${nodeId}/enrich`, body),

  validate: (projectId: string, nodeId: string) =>
    http.post<ValidationResult>(`/api/v1/projects/${projectId}/nodes/${nodeId}/validate`),
};
