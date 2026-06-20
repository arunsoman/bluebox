import { useEffect, useState } from "react";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { Spinner } from "@/components/common/Spinner";
import { useToast } from "@/components/common/Toast/ToastContext";
import { usePipelineStore } from "@/stores/pipelineStore";
import { socketClient } from "@/ws/socketClient";
import { checkpointsApi } from "@/api/endpoints/checkpoints";
import { ApiError } from "@/api/httpClient";
import sharedStyles from "@/components/nodes/EditorForms.module.css";
import styles from "./CheckpointRestoreModal.module.css";

/** doc/phase-1-wireframe.md §17.4 — Checkpoint Restore Timeline. */
export function CheckpointRestoreModal({ onClose }: { onClose: () => void }) {
  const projectId = usePipelineStore((s) => s.projectId);
  const { pushToast } = useToast();

  const [checkpoints, setCheckpoints] = useState<CheckpointSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Checkpoint | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [creating, setCreating] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [safetyPhrase, setSafetyPhrase] = useState("");
  const [discardAfter, setDiscardAfter] = useState(true);
  const [restoring, setRestoring] = useState(false);

  async function load() {
    if (!projectId) return;
    setLoading(true);
    try {
      const { checkpoints: list } = await checkpointsApi.list(projectId);
      setCheckpoints(list);
    } catch (err) {
      pushToast({ severity: "error", title: "Could not load checkpoints", body: err instanceof ApiError ? err.message : "Unknown error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    return socketClient.on("CHECKPOINT_CREATED", () => void load());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function selectCheckpoint(checkpointId: string) {
    if (!projectId) return;
    setLoadingDetail(true);
    try {
      const detail = await checkpointsApi.get(projectId, checkpointId);
      setSelected(detail);
    } catch (err) {
      pushToast({ severity: "error", title: "Could not load checkpoint detail", body: err instanceof ApiError ? err.message : "Unknown error" });
    } finally {
      setLoadingDetail(false);
    }
  }

  async function createNow() {
    if (!projectId) return;
    const label = window.prompt("Checkpoint label (optional)") ?? undefined;
    setCreating(true);
    try {
      await checkpointsApi.create(projectId, { label, include_workspace: true });
      pushToast({ severity: "success", title: "Checkpoint created" });
      await load();
    } catch (err) {
      pushToast({ severity: "error", title: "Could not create checkpoint", body: err instanceof ApiError ? err.message : "Unknown error" });
    } finally {
      setCreating(false);
    }
  }

  async function restore() {
    if (!projectId || !selected) return;
    setRestoring(true);
    try {
      const result = await checkpointsApi.restore(projectId, {
        checkpoint_id: selected.checkpoint_id,
        safety_phrase: safetyPhrase,
        discard_after: discardAfter,
      });
      pushToast({
        severity: "success",
        title: "Restored",
        body: result.discarded_checkpoints?.length ? `Discarded: ${result.discarded_checkpoints.join(", ")}` : undefined,
      });
      setConfirmRestore(false);
      onClose();
    } catch (err) {
      pushToast({ severity: "error", title: "Restore failed", body: err instanceof ApiError ? err.message : "Unknown error" });
    } finally {
      setRestoring(false);
    }
  }

  const requiredPhrase = selected ? `RESTORE ${selected.checkpoint_id}` : "";

  return (
    <Modal title="Checkpoint Timeline" onClose={onClose} width={760}>
      <div className={styles.headerActions}>
        <Button variant="secondary" loading={creating} onClick={createNow}>
          Create Now
        </Button>
        <Button disabled={!selected} onClick={() => setConfirmRestore(true)}>
          Restore Selected
        </Button>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className={styles.timeline}>
          {checkpoints.map((c) => (
            <button
              key={c.checkpoint_id}
              className={`${styles.node} ${selected?.checkpoint_id === c.checkpoint_id ? styles.nodeSelected : ""}`}
              onClick={() => selectCheckpoint(c.checkpoint_id)}
            >
              <span className={styles.nodeStage}>S{c.stage}</span>
              <span className={styles.nodeLabel}>{c.label}</span>
              <span className={styles.nodeMeta}>
                {c.auto_generated ? "auto" : "manual"} · {c.node_count} nodes
              </span>
            </button>
          ))}
          {checkpoints.length === 0 && <p>No checkpoints yet.</p>}
        </div>
      )}

      {loadingDetail && <Spinner />}

      {selected && !loadingDetail && (
        <section className={sharedStyles.section}>
          <h3 className={sharedStyles.sectionTitle}>
            {selected.label} — Stage {selected.stage}: {selected.stage_name}
          </h3>
          <div className={sharedStyles.sectionBody}>
            <div>
              Created: {new Date(selected.created_at).toLocaleString()} by {selected.created_by}
            </div>
            <div>Decision Ledger: {selected.decision_ledger_snapshot.length} entries</div>
            {selected.workspace_snapshot && (
              <div>Workspace snapshot: {JSON.stringify(selected.workspace_snapshot)}</div>
            )}
          </div>
        </section>
      )}

      {confirmRestore && selected && (
        <Modal title="Restore Checkpoint" onClose={() => setConfirmRestore(false)} width={420}>
          <p className={styles.warning}>⚠️ Restoring will discard all progress after this checkpoint.</p>
          <label className={sharedStyles.row} style={{ alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={discardAfter} onChange={(e) => setDiscardAfter(e.target.checked)} />
            Discard later checkpoints
          </label>
          <div className={sharedStyles.field}>
            <label className={sharedStyles.label}>Type "{requiredPhrase}" to confirm</label>
            <input className={sharedStyles.input} value={safetyPhrase} onChange={(e) => setSafetyPhrase(e.target.value)} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <Button variant="secondary" onClick={() => setConfirmRestore(false)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={safetyPhrase !== requiredPhrase} loading={restoring} onClick={restore}>
              Restore to This Point
            </Button>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
