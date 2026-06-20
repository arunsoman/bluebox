import { useEffect, useState } from "react";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { useToast } from "@/components/common/Toast/ToastContext";
import { useNodeEditorStore } from "@/stores/nodeEditorStore";
import { usePipelineStore } from "@/stores/pipelineStore";
import { nodesApi } from "@/api/endpoints/nodes";
import { graphApi } from "@/api/endpoints/graph";
import { ApiError } from "@/api/httpClient";
import styles from "./EditorForms.module.css";

/**
 * doc/wireframes.md missing-screens §4.2 — Delete / Deactivate Flow.
 * The wireframe also shows a "Replace" option; there's no replace endpoint
 * in the contract (only `permanent`/`delete_downstream` on DeleteNodeRequest),
 * so Replace renders disabled with an honest tooltip instead.
 */
export function DeleteNodeModal() {
  const target = useNodeEditorStore((s) => s.target);
  const close = useNodeEditorStore((s) => s.close);
  const projectId = usePipelineStore((s) => s.projectId);
  const { pushToast } = useToast();

  const [downstream, setDownstream] = useState<GraphEdge[]>([]);
  const [action, setAction] = useState<"delete" | "deactivate">("delete");
  const [rationale, setRationale] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const active = target?.mode === "delete" ? target : null;

  useEffect(() => {
    if (!active || !projectId) return;
    graphApi.getGraph(projectId).then((g) => setDownstream(g.edges.filter((e) => e.source === active.nodeId)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.nodeId, projectId]);

  if (!active) return null;

  const expectedConfirm = `DELETE ${active.nodeId}`;

  const handleConfirm = async () => {
    if (!projectId || confirmText !== expectedConfirm || !rationale.trim()) return;
    setDeleting(true);
    try {
      await nodesApi.delete(projectId, active.nodeId, {
        permanent: action === "delete",
        delete_downstream: action === "delete",
        rationale,
      });
      pushToast({ severity: "success", title: action === "delete" ? "Node deleted" : "Node deactivated" });
      close();
    } catch (err) {
      pushToast({ severity: "error", title: "Could not delete node", body: err instanceof ApiError ? err.message : "Unknown error" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal title={`⚠️ Delete Node: ${active.nodeId}`} onClose={close} width={480}>
      {downstream.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>This node has {downstream.length} downstream dependencies</h3>
          <ul className={styles.stringList}>
            {downstream.map((e) => (
              <li key={e.id}>{e.target}{e.label ? ` — ${e.label}` : ""}</li>
            ))}
          </ul>
        </div>
      )}

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Choose action</h3>
        <div className={styles.sectionBody}>
          <label style={{ display: "flex", gap: 8 }}>
            <input type="radio" checked={action === "delete"} onChange={() => setAction("delete")} />
            Delete — permanently remove node and all downstream files
          </label>
          <label style={{ display: "flex", gap: 8 }}>
            <input type="radio" checked={action === "deactivate"} onChange={() => setAction("deactivate")} />
            Deactivate — keep node but mark inactive (preserves history)
          </label>
          <label style={{ display: "flex", gap: 8, opacity: 0.5 }} title="Not yet available — no replace endpoint in the API contract">
            <input type="radio" disabled />
            Replace — delete this, create new node to replace it
          </label>
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Reason</label>
        <input className={styles.input} value={rationale} onChange={(e) => setRationale(e.target.value)} placeholder="Why is this being removed?" />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Type "{expectedConfirm}" to confirm</label>
        <input className={styles.input} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
        <Button variant="secondary" onClick={close}>Cancel</Button>
        <Button variant="danger" loading={deleting} disabled={confirmText !== expectedConfirm || !rationale.trim()} onClick={handleConfirm}>
          Confirm {action === "delete" ? "Delete" : "Deactivate"}
        </Button>
      </div>
    </Modal>
  );
}
