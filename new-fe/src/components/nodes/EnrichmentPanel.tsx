import { useEffect, useState } from "react";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { Spinner } from "@/components/common/Spinner";
import { useToast } from "@/components/common/Toast/ToastContext";
import { usePipelineStore } from "@/stores/pipelineStore";
import { nodesApi } from "@/api/endpoints/nodes";
import { ApiError } from "@/api/httpClient";
import type { EditableNodeType } from "@/stores/nodeEditorStore";
import styles from "./EditorForms.module.css";

/**
 * doc/wireframes.md missing-screens §2 — Enrichment Panel.
 *
 * The contract (§5.1) has one `enrich` endpoint, not a separate
 * "preview suggestions" + "apply" pair. We call it once with
 * `enrichment_type: "auto"` on open to generate real suggestions (rendered
 * as the wireframe's reviewable checklist), then "Apply Selected
 * Enrichments" re-calls it with `enrichment_type: "manual"` and the checked
 * suggestion ids — both are real calls to the one documented endpoint, just
 * sequenced to match the wireframe's review-before-commit flow.
 */
export function EnrichmentPanel({
  nodeId,
  nodeType,
  onClose,
}: {
  nodeId: string;
  nodeType: EditableNodeType;
  onClose: () => void;
}) {
  const projectId = usePipelineStore((s) => s.projectId);
  const { pushToast } = useToast();
  const [node, setNode] = useState<Node | null>(null);
  const [result, setResult] = useState<EnrichResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    Promise.all([nodesApi.get(projectId, nodeId), nodesApi.enrich(projectId, nodeId, { enrichment_type: "auto" })])
      .then(([n, r]) => {
        setNode(n);
        setResult(r);
        setSelected(new Set(r.new_suggestions.map((s) => s.suggestion_id)));
      })
      .catch((err: unknown) => {
        pushToast({ severity: "error", title: "Could not load enrichment suggestions", body: err instanceof ApiError ? err.message : "Unknown error" });
        onClose();
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, nodeId]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function apply() {
    if (!projectId) return;
    setApplying(true);
    try {
      await nodesApi.enrich(projectId, nodeId, { enrichment_type: "manual", selected_suggestions: Array.from(selected) });
      pushToast({ severity: "success", title: "Enrichments applied" });
      onClose();
    } catch (err) {
      pushToast({ severity: "error", title: "Could not apply enrichments", body: err instanceof ApiError ? err.message : "Unknown error" });
    } finally {
      setApplying(false);
    }
  }

  return (
    <Modal title={`✨ Enrich: ${nodeType} ${nodeId}`} onClose={onClose} width={640}>
      {loading || !result ? (
        <Spinner />
      ) : (
        <>
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Current State</h3>
            <div className={styles.sectionBody}>
              <div className={styles.readonly}>{node?.name}</div>
              <div className={styles.readonly}>Completeness Score: {Math.round(result.completeness_score_before * 100)}%</div>
            </div>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Suggested Enrichments (AI-generated, user-reviewed)</h3>
            <div className={styles.sectionBody}>
              {result.new_suggestions.length === 0 && <div className={styles.readonly}>No further suggestions.</div>}
              {result.new_suggestions.map((s) => (
                <label key={s.suggestion_id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <input type="checkbox" checked={selected.has(s.suggestion_id)} onChange={() => toggle(s.suggestion_id)} />
                  <span>
                    {s.rationale} <span className={styles.readonly}>({s.field_path}, {Math.round(s.confidence * 100)}% confidence)</span>
                  </span>
                </label>
              ))}
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className={styles.addButton} onClick={() => setSelected(new Set(result.new_suggestions.map((s) => s.suggestion_id)))}>
                  Select All
                </button>
                <button type="button" className={styles.addButton} onClick={() => setSelected(new Set())}>
                  Deselect All
                </button>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Preview of Enriched Result</h3>
            <div className={styles.sectionBody}>
              {Object.entries(result.enriched_fields).map(([field, change]) => (
                <div key={field} className={styles.readonly}>
                  {field}: {JSON.stringify(change.before)} → {JSON.stringify(change.after)}
                </div>
              ))}
              <div className={styles.acStatusOk}>
                🟢 Completeness Score: {Math.round(result.completeness_score_after * 100)}% (+
                {Math.round((result.completeness_score_after - result.completeness_score_before) * 100)}%)
              </div>
            </div>
          </section>

          {result.impact_report_id && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Impact Analysis</h3>
              <div className={styles.sectionBody}>
                <div className={styles.readonly}>This change affects downstream nodes (report {result.impact_report_id}).</div>
              </div>
            </section>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button loading={applying} onClick={apply}>Apply Selected Enrichments</Button>
          </div>
        </>
      )}
    </Modal>
  );
}
