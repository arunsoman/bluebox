import { useState } from "react";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { useToast } from "@/components/common/Toast/ToastContext";
import { usePipelineStore } from "@/stores/pipelineStore";
import { useNodeEditorStore } from "@/stores/nodeEditorStore";
import { nodesApi } from "@/api/endpoints/nodes";
import { ApiError } from "@/api/httpClient";
import type { ErrorRow } from "./types";
import styles from "@/components/nodes/EditorForms.module.css";

type Strategy = "ai_auto_fix" | "defer_all";

/**
 * doc/wireframes.md missing-screens §3.3 — Bulk Fix Wizard.
 * "Template Fill" has no corresponding endpoint and renders disabled.
 * "Manual Edit" just opens the first selected node in the real Node Editor
 * and exits the wizard — there's no batch sequencing endpoint to drive that
 * flow automatically.
 */
export function BulkFixWizard({
  errors,
  onClose,
  onDone,
}: {
  errors: ErrorRow[];
  onClose: () => void;
  onDone: () => void;
}) {
  const projectId = usePipelineStore((s) => s.projectId);
  const openEdit = useNodeEditorStore((s) => s.openEdit);
  const { pushToast } = useToast();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selected, setSelected] = useState<Set<string>>(new Set(errors.map((e) => e.key)));
  const [strategy, setStrategy] = useState<Strategy>("ai_auto_fix");
  const [rationale, setRationale] = useState("");
  const [previews, setPreviews] = useState<Map<string, EnrichResult>>(new Map());
  const [applying, setApplying] = useState(false);

  const selectedRows = errors.filter((e) => selected.has(e.key));
  const selectedNodeIds = Array.from(new Set(selectedRows.map((r) => r.nodeId)));

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function goToStrategy() {
    if (strategy === "ai_auto_fix" || strategy === "defer_all") {
      setStep(3);
      if (strategy === "ai_auto_fix" && projectId) {
        const results = await Promise.all(
          selectedNodeIds.map((id) =>
            nodesApi.enrich(projectId, id, { enrichment_type: "auto" }).then((r) => [id, r] as const).catch(() => null),
          ),
        );
        setPreviews(new Map(results.filter(Boolean) as [string, EnrichResult][]));
      }
    }
  }

  function startManualEdit() {
    const first = selectedRows[0];
    if (first) openEdit(first.nodeId, first.nodeType);
    onClose();
  }

  async function confirmApply() {
    if (!projectId) return;
    setApplying(true);
    try {
      if (strategy === "defer_all") {
        await Promise.all(
          selectedNodeIds.map((id) => nodesApi.update(projectId, id, { data: { status: "DEFERRED" }, source: "user_edit", change_rationale: rationale })),
        );
      }
      pushToast({ severity: "success", title: `Applied fixes to ${selectedNodeIds.length} node(s)` });
      onDone();
    } catch (err) {
      pushToast({ severity: "error", title: "Bulk fix failed", body: err instanceof ApiError ? err.message : "Unknown error" });
    } finally {
      setApplying(false);
    }
  }

  return (
    <Modal title={`🔧 Bulk Fix Wizard — ${errors.length} Errors Selected`} onClose={onClose} width={640}>
      {step === 1 && (
        <>
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Step 1: Review Errors</h3>
            <div className={styles.sectionBody}>
              {errors.map((e) => (
                <label key={e.key} style={{ display: "flex", gap: 8 }}>
                  <input type="checkbox" checked={selected.has(e.key)} onChange={() => toggle(e.key)} />
                  {e.nodeName}: {e.message}
                </label>
              ))}
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className={styles.addButton} onClick={() => setSelected(new Set(errors.map((e) => e.key)))}>Select All</button>
                <button type="button" className={styles.addButton} onClick={() => setSelected(new Set())}>Deselect All</button>
              </div>
            </div>
          </section>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button disabled={selected.size === 0} onClick={() => setStep(2)}>Next →</Button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Step 2: Choose Fix Strategy</h3>
            <div className={styles.sectionBody}>
              <label style={{ display: "flex", gap: 8 }}>
                <input type="radio" checked={strategy === "ai_auto_fix"} onChange={() => setStrategy("ai_auto_fix")} />
                AI Auto-Fix — system generates fixes, review required
              </label>
              <label style={{ display: "flex", gap: 8, opacity: 0.5 }} title="Not yet available — no template-fill endpoint in the API contract">
                <input type="radio" disabled />
                Template Fill — apply standard templates to missing fields
              </label>
              <label style={{ display: "flex", gap: 8 }}>
                <input type="radio" checked={strategy === "defer_all"} onChange={() => setStrategy("defer_all")} />
                Defer All — mark all as deferred with batch rationale
              </label>
              <button type="button" className={styles.addButton} onClick={startManualEdit}>
                Manual Edit — open first selected node in editor
              </button>
            </div>
          </section>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button variant="secondary" onClick={() => setStep(1)}>← Previous</Button>
            <Button onClick={goToStrategy}>Next →</Button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Step 3: Preview & Confirm</h3>
            <div className={styles.sectionBody}>
              {strategy === "ai_auto_fix" &&
                selectedNodeIds.map((id) => {
                  const result = previews.get(id);
                  return (
                    <div key={id}>
                      <strong>{id}:</strong>{" "}
                      {result ? Object.keys(result.enriched_fields).join(", ") || "no changes" : "applying…"}
                    </div>
                  );
                })}
              {strategy === "defer_all" && (
                <div className={styles.field}>
                  <label className={styles.label}>Rationale for deferring all {selectedNodeIds.length} node(s)</label>
                  <textarea className={styles.textarea} value={rationale} onChange={(e) => setRationale(e.target.value)} />
                </div>
              )}
              <div className={styles.readonly}>{selectedNodeIds.length} node(s) will be updated.</div>
            </div>
          </section>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button variant="secondary" onClick={() => setStep(2)}>← Previous</Button>
            <Button loading={applying} disabled={strategy === "defer_all" && !rationale.trim()} onClick={confirmApply}>
              Confirm and Apply
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
