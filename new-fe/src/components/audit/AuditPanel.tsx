import { useEffect, useState } from "react";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { Spinner } from "@/components/common/Spinner";
import { EmptyState } from "@/components/common/EmptyState";
import { useToast } from "@/components/common/Toast/ToastContext";
import { usePipelineStore } from "@/stores/pipelineStore";
import { useAuditNavigationStore } from "@/stores/auditNavigationStore";
import { auditApi } from "@/api/endpoints/audit";
import { ApiError } from "@/api/httpClient";
import { RestoreRevertModal } from "@/components/nodes/RestoreRevertModal";
import styles from "./AuditPanel.module.css";
import formStyles from "@/components/nodes/EditorForms.module.css";

const ACTION_FILTERS: AuditQuery["action"][] = ["steering", "codegen", "system", "error"];

/** doc/wireframes.md §3.9 — Audit Panel. Decision Ledger + Audit Trail tabs. */
export function AuditPanel() {
  const projectId = usePipelineStore((s) => s.projectId);
  const { focusEntryId, focusAuditQuery, clear } = useAuditNavigationStore();
  const { pushToast } = useToast();

  const [tab, setTab] = useState<"ledger" | "trail">("ledger");
  const [ledger, setLedger] = useState<DecisionLedger | null>(null);
  const [trail, setTrail] = useState<AuditTrail | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [actionFilters, setActionFilters] = useState<Set<string>>(new Set());
  const [diffEvent, setDiffEvent] = useState<AuditEvent | null>(null);
  const [revisionEntry, setRevisionEntry] = useState<DecisionEntry | null>(null);
  const [revertTarget, setRevertTarget] = useState<DecisionEntry | null>(null);
  const [revisionLabel, setRevisionLabel] = useState("");
  const [revisionRationale, setRevisionRationale] = useState("");
  const [submittingRevision, setSubmittingRevision] = useState(false);

  useEffect(() => {
    if (focusEntryId) {
      setTab("ledger");
      setExpandedEntryId(focusEntryId);
    } else if (focusAuditQuery) {
      setTab("trail");
    }
  }, [focusEntryId, focusAuditQuery]);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    if (tab === "ledger") {
      auditApi
        .getLedger(projectId, { search: search || undefined, limit: 100 })
        .then(setLedger)
        .catch((err: unknown) => pushToast({ severity: "error", title: "Could not load ledger", body: err instanceof ApiError ? err.message : "Unknown error" }))
        .finally(() => setLoading(false));
    } else {
      const query: AuditQuery = {
        ...(focusAuditQuery ?? {}),
        action: actionFilters.size === 1 ? (Array.from(actionFilters)[0] as AuditQuery["action"]) : undefined,
        limit: 100,
      };
      auditApi
        .getAuditTrail(projectId, query)
        .then(setTrail)
        .catch((err: unknown) => pushToast({ severity: "error", title: "Could not load audit trail", body: err instanceof ApiError ? err.message : "Unknown error" }))
        .finally(() => setLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, tab, search, actionFilters]);

  function toggleFilter(action: string) {
    setActionFilters((prev) => {
      const next = new Set(prev);
      if (next.has(action)) next.delete(action);
      else next.add(action);
      return next;
    });
    clear();
  }

  async function submitRevision() {
    if (!projectId || !revisionEntry || !revisionLabel.trim() || !revisionRationale.trim()) return;
    setSubmittingRevision(true);
    try {
      // No dedicated "pick a new option" endpoint exists for revisions —
      // doc/api_event_contract.md §4.9's RevisionRequest.new_choice is a full
      // SteeringOption, so we construct a minimal one from the free-text
      // description the user enters here.
      const newChoice: SteeringOption = {
        option_id: `revision-${revisionEntry.entry_id}`,
        option_type: "modify",
        label: revisionLabel,
        description: revisionLabel,
        requires_authorization: false,
      };
      const result = await auditApi.requestRevision(projectId, {
        original_decision_id: revisionEntry.entry_id,
        new_choice: newChoice,
        rationale: revisionRationale,
      });
      pushToast({ severity: "success", title: "Revision requested", body: `Budget remaining: ${result.budget_remaining}` });
      setRevisionEntry(null);
      setRevisionLabel("");
      setRevisionRationale("");
    } catch (err) {
      pushToast({ severity: "error", title: "Could not request revision", body: err instanceof ApiError ? err.message : "Unknown error" });
    } finally {
      setSubmittingRevision(false);
    }
  }

  const entries = ledger?.entries ?? [];
  const activeEntry = entries.find((e) => e.status === "active") ?? entries[0] ?? null;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab === "ledger" ? styles.tabActive : ""}`} onClick={() => { setTab("ledger"); clear(); }}>
            Decision Ledger
          </button>
          <button className={`${styles.tab} ${tab === "trail" ? styles.tabActive : ""}`} onClick={() => { setTab("trail"); clear(); }}>
            Audit Trail
          </button>
        </div>
        <button className={formStyles.addButton} disabled title="Not yet available — no export endpoint in the API contract">
          Export JSON
        </button>
      </div>

      {tab === "ledger" && (
        <>
          <input
            className={styles.search}
            placeholder="Show me all auth layer decisions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {loading ? (
            <Spinner />
          ) : entries.length === 0 ? (
            <EmptyState title="No decisions logged yet" description="Decisions appear here as the pipeline progresses through stages." />
          ) : (
            <>
              <div className={styles.list}>
                {entries.map((entry) => (
                  <div key={entry.entry_id}>
                    <div className={styles.entryRow} onClick={() => setExpandedEntryId(expandedEntryId === entry.entry_id ? null : entry.entry_id)}>
                      <span
                        className={`${styles.statusDot} ${
                          entry.status === "active" ? styles.statusActive : entry.status === "cancelled" ? styles.statusCancelled : styles.statusSuperseded
                        }`}
                      />
                      <span className={styles.idBadge}>{entry.entry_id}</span>
                      <span className={styles.stageBadge}>Stage {entry.stage}</span>
                      <span className={styles.summary}>{entry.summary}</span>
                      <span className={styles.timestamp}>{new Date(entry.created_at).toLocaleString()}</span>
                    </div>
                    {expandedEntryId === entry.entry_id && (
                      <div className={styles.detail}>
                        <div className={styles.detailJson}>{JSON.stringify(entry.payload, null, 2)}</div>
                        <div>Revision chain: {entry.revision_chain && entry.revision_chain.length > 0 ? entry.revision_chain.join(" → ") : "none"}</div>
                        <div>Superseded by: {entry.superseded_by ?? "none"}</div>
                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                          <Button variant="secondary" onClick={() => setRevisionEntry(entry)}>Initiate Revision</Button>
                          {activeEntry && activeEntry.entry_id !== entry.entry_id && (
                            <Button variant="secondary" onClick={() => setRevertTarget(entry)}>Revert to this version</Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className={styles.footer}>
                {ledger?.total_count ?? 0} decisions · revision budget {ledger?.revision_budget_remaining ?? 0}/{ledger?.revision_budget_total ?? 0} remaining
              </div>
            </>
          )}
        </>
      )}

      {tab === "trail" && (
        <>
          <div className={styles.filterRow}>
            {ACTION_FILTERS.map((a) => (
              <button key={a} className={`${styles.chip} ${actionFilters.has(a as string) ? styles.chipActive : ""}`} onClick={() => toggleFilter(a as string)}>
                {a}
              </button>
            ))}
          </div>
          {loading ? (
            <Spinner />
          ) : !trail || trail.events.length === 0 ? (
            <EmptyState title="No audit events" description="Audit events appear here as steering decisions and code generation occur." />
          ) : (
            <>
              <div className={styles.list}>
                {trail.events.map((event) => (
                  <div key={event.event_id} className={styles.eventRow}>
                    <span className={`${styles.pill} ${styles[`pill${event.action.charAt(0).toUpperCase()}${event.action.slice(1)}` as keyof typeof styles] ?? ""}`}>
                      {event.action}
                    </span>
                    {event.stage !== undefined && <span className={styles.stageBadge}>S{event.stage}</span>}
                    <span className={styles.summary}>{event.description}</span>
                    <span className={styles.timestamp}>{new Date(event.timestamp).toLocaleTimeString()} · {event.actor.role}</span>
                    {(event.diff || event.before_state || event.after_state) && (
                      <button className={formStyles.addButton} onClick={() => setDiffEvent(event)}>View Diff</button>
                    )}
                  </div>
                ))}
              </div>
              <div className={styles.footer}>
                Showing {trail.events.length} of {trail.total_count} events · {Math.round(trail.storage_used_bytes / 1024)}KB of {Math.round(trail.storage_budget_bytes / 1024)}KB used · {trail.retention_days}d retention
              </div>
            </>
          )}
        </>
      )}

      {diffEvent && (
        <Modal title={`Diff — ${diffEvent.description}`} onClose={() => setDiffEvent(null)} width={640}>
          <div className={formStyles.row}>
            <div className={formStyles.sectionBody}>
              <strong>Before</strong>
              <div className={styles.detailJson}>{JSON.stringify(diffEvent.before_state ?? diffEvent.diff ?? "—", null, 2)}</div>
            </div>
            <div className={formStyles.sectionBody}>
              <strong>After</strong>
              <div className={styles.detailJson}>{JSON.stringify(diffEvent.after_state ?? "—", null, 2)}</div>
            </div>
          </div>
        </Modal>
      )}

      {revisionEntry && (
        <Modal title={`Initiate Revision — ${revisionEntry.entry_id}`} onClose={() => setRevisionEntry(null)} width={480}>
          <p>{revisionEntry.summary}</p>
          <div className={formStyles.field}>
            <label className={formStyles.label}>New choice</label>
            <input className={formStyles.input} value={revisionLabel} onChange={(e) => setRevisionLabel(e.target.value)} placeholder="Describe the new decision" />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Rationale</label>
            <textarea className={formStyles.textarea} value={revisionRationale} onChange={(e) => setRevisionRationale(e.target.value)} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <Button variant="secondary" onClick={() => setRevisionEntry(null)}>Cancel</Button>
            <Button loading={submittingRevision} disabled={!revisionLabel.trim() || !revisionRationale.trim()} onClick={submitRevision}>
              Submit Revision
            </Button>
          </div>
        </Modal>
      )}

      {revertTarget && activeEntry && (
        <RestoreRevertModal
          currentEntry={activeEntry}
          targetEntry={revertTarget}
          onClose={() => setRevertTarget(null)}
          onReverted={() => {
            setRevertTarget(null);
            if (projectId) auditApi.getLedger(projectId, { limit: 100 }).then(setLedger);
          }}
        />
      )}
    </div>
  );
}
