/**
 * doc/api_event_contract.md §4.3, §4.4 — File Explorer & Editor
 */
import { http } from "@/api/httpClient";

export const workspaceApi = {
  // ── File explorer ──
  listFiles: (projectId: string, params?: FileListQuery) =>
    http.get<FileTree>(`/api/v1/projects/${projectId}/workspace/files`, { params }),

  readFile: (projectId: string, params: FileReadRequest) =>
    http.get<FileContent>(`/api/v1/projects/${projectId}/workspace/file`, { params }),

  writeFile: (projectId: string, body: FileWriteRequest) =>
    http.post<FileContent>(`/api/v1/projects/${projectId}/workspace/file`, body),

  deleteFile: (projectId: string, body: FileDeleteRequest) =>
    http.delete<{ deleted: true }>(`/api/v1/projects/${projectId}/workspace/file`, { data: body }),

  getProvenance: (projectId: string, params: ProvenanceQuery) =>
    http.get<ProvenanceInfo>(`/api/v1/projects/${projectId}/workspace/file/provenance`, { params }),

  // ── Editor / diff ──
  getDiff: (projectId: string, params: DiffRequest) =>
    http.get<DiffResult>(`/api/v1/projects/${projectId}/workspace/diff`, { params }),

  merge: (projectId: string, body: MergeRequest) =>
    http.post<MergeResult>(`/api/v1/projects/${projectId}/workspace/merge`, body),
};
