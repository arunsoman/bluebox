import { useEffect, useState } from "react";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { Spinner } from "@/components/common/Spinner";
import { useToast } from "@/components/common/Toast/ToastContext";
import { usePipelineStore } from "@/stores/pipelineStore";
import { useNodeEditorStore, type EditableNodeType } from "@/stores/nodeEditorStore";
import { nodesApi } from "@/api/endpoints/nodes";
import { ApiError } from "@/api/httpClient";
import styles from "@/components/nodes/EditorForms.module.css";

/** doc/wireframes.md missing-screens §3.2 — Node Validation Inspector. */
export function NodeValidationInspector({
  nodeId,
  nodeType,
  onClose,
}: {
  nodeId: string;
  nodeType: EditableNodeType;
  onClose: () => void;
}) {
  const projectId = usePipelineStore((s) => s.projectId);
  const openEdit = useNodeEditorStore((s) => s.openEdit);
  const { pushToast } = useToast();
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    nodesApi
      .validate(projectId, nodeId)
      .then(setResult)
      .catch((err: unknown) => pushToast({ severity: "error", title: "Could not load validation", body: err instanceof ApiError ? err.message : "Unknown error" }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, nodeId]);

  async function runAutoFix() {
    if (!projectId) return;
    setWorking(true);
    try {
      await nodesApi.enrich(projectId, nodeId, { enrichment_type: "auto" });
      setResult(await nodesApi.validate(projectId, nodeId));
      pushToast({ severity: "success", title: "Auto-fix applied" });
    } catch (err) {
      pushToast({ severity: "error", title: "Auto-fix failed", body: err instanceof ApiError ? err.message : "Unknown error" });
    } finally {
      setWorking(false);
    }
  }

  async function markDeferred() {
    if (!projectId) return;
    const rationale = window.prompt("Why is this node being deferred?");
    if (!rationale) return;
    setWorking(true);
    try {
      await nodesApi.update(projectId, nodeId, { data: { status: "DEFERRED" }, source: "user_edit", change_rationale: rationale });
      pushToast({ severity: "info", title: "Marked as deferred" });
      onClose();
    } catch (err) {
      pushToast({ severity: "error", title: "Could not defer node", body: err instanceof ApiError ? err.message : "Unknown error" });
    } finally {
      setWorking(false);
    }
  }

  return (
    <Modal title={`🔍 Validation Inspector: ${nodeId}`} onClose={onClose} width={560}>
      {loading || !result ? (
        <Spinner />
      ) : (
        <>
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Field Completeness</h3>
            <div className={styles.sectionBody}>
              {result.required_fields.map((f) => (
                <div key={f.field_path}>
                  {f.present ? "🟢" : f.required ? "🔴" : "🟡"} {f.field_name} — {String(f.value ?? "—")} ({f.required ? "Required" : "Optional"}, {f.rule})
                </div>
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>PRD Acceptance Criteria Mapping</h3>
            <div className={styles.sectionBody}>
              {result.prd_compliance.map((c) => (
                <div key={c.acceptance_criterion_id}>
                  {c.criterion} → {c.passed ? "🟢 Linked" : "🔴 Not satisfied"} ({c.prd_reference})
                </div>
              ))}
              {result.prd_compliance.length === 0 && <div className={styles.readonly}>No PRD acceptance criteria mapped to this node.</div>}
            </div>
          </section>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <Button variant="secondary" onClick={() => { openEdit(nodeId, nodeType); onClose(); }}>Edit Node</Button>
            <Button variant="secondary" loading={working} onClick={runAutoFix}>Run Auto-Fix</Button>
            <Button variant="danger" loading={working} onClick={markDeferred}>Mark as Deferred</Button>
          </div>
        </>
      )}
    </Modal>
  );
}
