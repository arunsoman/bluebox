/**
 * doc/api_event_contract.md §4.9 — Audit Panel
 * Decision ledger, audit trail, revision, revert.
 */
import { http } from "@/api/httpClient";

export const auditApi = {
  getLedger: (projectId: string, params?: LedgerQuery) =>
    http.get<DecisionLedger>(`/api/v1/projects/${projectId}/ledger`, { params }),

  getLedgerEntry: (projectId: string, entryId: string) =>
    http.get<DecisionEntry>(`/api/v1/projects/${projectId}/ledger/${entryId}`),

  getAuditTrail: (projectId: string, params?: AuditQuery) =>
    http.get<AuditTrail>(`/api/v1/projects/${projectId}/audit`, { params }),

  requestRevision: (projectId: string, body: RevisionRequest) =>
    http.post<RevisionResult>(`/api/v1/projects/${projectId}/ledger/revision`, body),

  revertDecision: (projectId: string, body: RevertRequest) =>
    http.post<RevertResult>(`/api/v1/projects/${projectId}/ledger/revert`, body),
};
