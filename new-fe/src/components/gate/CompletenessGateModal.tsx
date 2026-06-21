import { useEffect, useState } from "react";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { Spinner } from "@/components/common/Spinner";
import { useToast } from "@/components/common/Toast/ToastContext";
import { usePipelineStore } from "@/stores/pipelineStore";
import { useIdeLayoutStore } from "@/stores/ideLayoutStore";
import { useNodeEditorStore, type EditableNodeType } from "@/stores/nodeEditorStore";
import { useAuthStore } from "@/stores/authStore";
import { graphApi } from "@/api/endpoints/graph";
import { nodesApi } from "@/api/endpoints/nodes";
import { codeGenApi } from "@/api/endpoints/codeGen";
import { ApiError } from "@/api/httpClient";
import { BulkFixWizard } from "./BulkFixWizard";
import type { ErrorRow } from "./types";
import styles from "@/components/nodes/EditorForms.module.css";

/**
 * doc/wireframes.md missing-screens §3.1 — Completeness Gate (Stage 7).
 * No project-level "gate status" endpoint exists in the contract — this is
 * composed client-side from two real endpoints: `GET /graph` for the full
 * node list, then `POST /nodes/{id}/validate` per node (parallel),
 * aggregated by node type here. "Export Blueprint JSON" has no endpoint and
 * renders disabled; "Generate Code (Stage 8)" and the admin "Override" path
 * both call the real `codeGenApi.start()`.
 */
const TYPE_LABELS: Record<string, string> = {
  actor: "Actors",
  capability: "Capabilities",
  use_case: "Use Cases",
  user_story: "User Stories",
  engineering_task: "Tasks",
};

export function CompletenessGateModal({ onClose }: { onClose: () => void }) {
  const projectId = usePipelineStore((s) => s.projectId);
  const setActiveCenterTab = useIdeLayoutStore((s) => s.setActiveCenterTab);
  const setActiveBottomTab = useIdeLayoutStore((s) => s.setActiveBottomTab);
  const openEdit = useNodeEditorStore((s) => s.openEdit);
  const isAdmin = useAuthStore((s) => s.user?.permissions.includes("pipeline_admin") ?? false);
  const { pushToast } = useToast();

  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [validations, setValidations] = useState<Map<string, ValidationResult>>(new Map());
  const [loading, setLoading] = useState(true);
  const [bulkFixRows, setBulkFixRows] = useState<ErrorRow[] | null>(null);
  const [confirmOverride, setConfirmOverride] = useState(false);
  const [overrideText, setOverrideText] = useState("");
  const [generating, setGenerating] = useState(false);

  async function load() {
    if (!projectId) return;
    setLoading(true);
    const graph = await graphApi.getGraph(projectId);
    const evaluable = graph.nodes.filter((n) => n.type !== "file");
    setNodes(evaluable);
    const results = await Promise.all(
      evaluable.map((n) => nodesApi.validate(projectId, n.id).then((v) => [n.id, v] as const).catch(() => null)),
    );
    setValidations(new Map(results.filter(Boolean) as [string, ValidationResult][]));
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const total = nodes.length;
  const valid = nodes.filter((n) => (validations.get(n.id)?.errors.length ?? 0) === 0).length;
  const withWarnings = nodes.filter((n) => {
    const v = validations.get(n.id);
    return v && v.errors.length === 0 && v.warnings.length > 0;
  }).length;
  const withErrors = total - valid;
  const overallPercent = total === 0 ? 100 : Math.round((valid / total) * 100);

  const byType = Object.entries(TYPE_LABELS).map(([type, label]) => {
    const typeNodes = nodes.filter((n) => n.type === type);
    const typeValid = typeNodes.filter((n) => (validations.get(n.id)?.errors.length ?? 0) === 0).length;
    return { type, label, total: typeNodes.length, valid: typeValid };
  });

  const errorRows: ErrorRow[] = nodes.flatMap((n) => {
    const v = validations.get(n.id);
    if (!v) return [];
    return v.errors.map((err) => ({
      key: `${n.id}:${err.error_code}`,
      nodeId: n.id,
      nodeType: n.type as EditableNodeType,
      nodeName: n.name,
      message: err.message,
      suggestedFix: err.suggested_fix,
    }));
  });

  const warningRows = nodes.flatMap((n) => {
    const v = validations.get(n.id);
    return v ? v.warnings.map((w) => ({ nodeId: n.id, nodeName: n.name, message: w.message })) : [];
  });

  async function quickFix(nodeId: string) {
    if (!projectId) return;
    try {
      await nodesApi.enrich(projectId, nodeId, { enrichment_type: "auto" });
      const fresh = await nodesApi.validate(projectId, nodeId);
      setValidations((prev) => new Map(prev).set(nodeId, fresh));
      pushToast({ severity: "success", title: "Quick fix applied" });
    } catch (err) {
      pushToast({ severity: "error", title: "Quick fix failed", body: err instanceof ApiError ? err.message : "Unknown error" });
    }
  }

  function deferRow(row: ErrorRow) {
    const rationale = window.prompt(`Defer ${row.nodeName} — rationale:`);
    if (!rationale || !projectId) return;
    nodesApi
      .update(projectId, row.nodeId, { data: { status: "DEFERRED" }, source: "user_edit", change_rationale: rationale })
      .then(() => nodesApi.validate(projectId, row.nodeId))
      .then((fresh) => setValidations((prev) => new Map(prev).set(row.nodeId, fresh)))
      .catch((err: unknown) => pushToast({ severity: "error", title: "Could not defer", body: err instanceof ApiError ? err.message : "Unknown error" }));
  }

  async function generateCode() {
    if (!projectId) return;
    setGenerating(true);
    try {
      await codeGenApi.start(projectId, { include_tests: true, include_infrastructure: true });
      pushToast({ severity: "success", title: "Code generation started" });
      setActiveBottomTab("code-gen");
      onClose();
    } catch (err) {
      pushToast({ severity: "error", title: "Could not start code generation", body: err instanceof ApiError ? err.message : "Unknown error" });
    } finally {
      setGenerating(false);
      setConfirmOverride(false);
    }
  }

  if (bulkFixRows) {
    return <BulkFixWizard errors={bulkFixRows} onClose={() => setBulkFixRows(null)} onDone={() => { setBulkFixRows(null); void load(); }} />;
  }

  return (
    <Modal title="🔍 Stage 7: Completeness Gate" onClose={onClose} width={800}>
      {loading ? (
        <Spinner />
      ) : (
        <>
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Overall Completeness</h3>
            <div className={styles.sectionBody}>
              <progress value={overallPercent} max={100} style={{ width: "100%" }} />
              <div>{overallPercent}% Complete — {valid} of {total} nodes fully validated</div>
              <div>🟢 {valid} Valid 🟡 {withWarnings} Warnings 🔴 {withErrors} Errors</div>
            </div>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Validation by Type</h3>
            <div className={styles.sectionBody}>
              {byType.map((row) => (
                <div key={row.type}>
                  {row.label}: {row.valid}/{row.total} {row.valid === row.total ? "🟢 complete" : "🟡 issues"}
                </div>
              ))}
            </div>
          </section>

          {errorRows.length > 0 && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Critical Errors (Blocking Export)</h3>
              <div className={styles.sectionBody}>
                {errorRows.map((row) => (
                  <div key={row.key} className={styles.acCard}>
                    <div className={styles.acStatusError}>🔴 {row.nodeName}: {row.message}</div>
                    <div className={styles.acActions}>
                      <button type="button" onClick={() => quickFix(row.nodeId)}>Quick Fix</button>
                      <button type="button" onClick={() => { openEdit(row.nodeId, row.nodeType); onClose(); }}>Edit</button>
                      <button type="button" onClick={() => deferRow(row)}>Defer with rationale</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {warningRows.length > 0 && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Warnings (Non-Blocking)</h3>
              <div className={styles.sectionBody}>
                {warningRows.map((w, i) => (
                  <div key={i}>🟡 {w.nodeName}: {w.message}</div>
                ))}
              </div>
            </section>
          )}

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Auto-Fix Options</h3>
            <div className={styles.sectionBody}>
              <Button variant="secondary" disabled={errorRows.length === 0} onClick={() => setBulkFixRows(errorRows)}>
                Run Auto-Fix for All Errors
              </Button>
            </div>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Export Options</h3>
            <div className={styles.sectionBody}>
              <Button disabled={errorRows.length > 0 || generating} loading={generating} onClick={generateCode}>
                Generate Code (Stage 8)
              </Button>
              <button className={styles.addButton} disabled title="Not yet available — no export endpoint in the API contract">
                Export Blueprint JSON
              </button>
            </div>
          </section>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <Button variant="secondary" onClick={() => { setActiveCenterTab("steering"); onClose(); }}>← Back to Steering</Button>
            {errorRows.length > 0 && (
              <Button variant="danger" disabled={!isAdmin} title={isAdmin ? undefined : "Requires pipeline_admin role"} onClick={() => setConfirmOverride(true)}>
                Override →
              </Button>
            )}
          </div>

          {confirmOverride && (
            <Modal title="Override Completeness Gate" onClose={() => setConfirmOverride(false)} width={420}>
              <p>{errorRows.length} errors must be resolved or explicitly deferred before code generation can proceed.</p>
              <div className={styles.field}>
                <label className={styles.label}>Type "OVERRIDE" to confirm</label>
                <input className={styles.input} value={overrideText} onChange={(e) => setOverrideText(e.target.value)} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
                <Button variant="secondary" onClick={() => setConfirmOverride(false)}>Cancel</Button>
                <Button variant="danger" disabled={overrideText !== "OVERRIDE"} loading={generating} onClick={generateCode}>
                  Confirm Override
                </Button>
              </div>
            </Modal>
          )}
        </>
      )}
    </Modal>
  );
}
