import { useMemo, useState } from "react";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { useToast } from "@/components/common/Toast/ToastContext";
import { usePipelineStore } from "@/stores/pipelineStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { workspaceApi } from "@/api/endpoints/workspace";
import { checkpointsApi } from "@/api/endpoints/checkpoints";
import { ApiError } from "@/api/httpClient";
import styles from "./MergeConflictModal.module.css";
import sharedStyles from "@/components/nodes/EditorForms.module.css";

/** doc/phase-1-wireframe.md §14.2 — 3-Way Merge Conflict Resolution. */
export function MergeConflictModal({ conflict, onClose }: { conflict: MergeConflictInfo; onClose: () => void }) {
  const projectId = usePipelineStore((s) => s.projectId);
  const applyMergedContent = useWorkspaceStore((s) => s.applyMergedContent);
  const { pushToast } = useToast();

  const defaultOutput = useMemo(
    () => `<<<<<<< OURS\n${conflict.ours}\n=======\n${conflict.theirs}\n>>>>>>> THEIRS`,
    [conflict],
  );
  const [output, setOutput] = useState(defaultOutput);
  const [resolving, setResolving] = useState(false);
  const [restoreCheckpointId, setRestoreCheckpointId] = useState<string | null>(null);
  const [safetyPhrase, setSafetyPhrase] = useState("");
  const [restoring, setRestoring] = useState(false);

  async function resolve(resolution: "accept_ours" | "accept_theirs" | "manual") {
    if (!projectId) return;
    setResolving(true);
    try {
      const result = await workspaceApi.merge(projectId, {
        file_path: conflict.file_path,
        base_content: conflict.base,
        ours_content: conflict.ours,
        theirs_content: conflict.theirs,
        resolution,
        manual_output: resolution === "manual" ? output : undefined,
      });
      applyMergedContent(conflict.file_path, result.merged_content);
      pushToast({
        severity: "success",
        title: "Merge resolved",
        body: result.conflicts_remaining > 0 ? `${result.conflicts_remaining} conflict(s) remaining` : undefined,
      });
      if (result.conflicts_remaining === 0) onClose();
    } catch (err) {
      pushToast({ severity: "error", title: "Merge failed", body: err instanceof ApiError ? err.message : "Unknown error" });
    } finally {
      setResolving(false);
    }
  }

  async function findPreStage8Checkpoint() {
    if (!projectId) return;
    try {
      const { checkpoints } = await checkpointsApi.list(projectId);
      const target = checkpoints.find((c) => c.label.toLowerCase().includes("pre-stage-8"));
      if (!target) {
        pushToast({ severity: "warning", title: "No Pre-Stage-8 checkpoint found" });
        return;
      }
      setRestoreCheckpointId(target.checkpoint_id);
    } catch (err) {
      pushToast({ severity: "error", title: "Could not load checkpoints", body: err instanceof ApiError ? err.message : "Unknown error" });
    }
  }

  async function restoreCheckpoint() {
    if (!projectId || !restoreCheckpointId) return;
    setRestoring(true);
    try {
      await checkpointsApi.restore(projectId, {
        checkpoint_id: restoreCheckpointId,
        safety_phrase: safetyPhrase,
        discard_after: true,
      });
      pushToast({ severity: "success", title: "Restored to Pre-Stage-8 checkpoint" });
      onClose();
    } catch (err) {
      pushToast({ severity: "error", title: "Restore failed", body: err instanceof ApiError ? err.message : "Unknown error" });
    } finally {
      setRestoring(false);
    }
  }

  return (
    <Modal title={`🔀 Merge Conflict: ${conflict.file_path}`} onClose={onClose} width={920}>
      <p className={styles.subtitle}>
        Blueprint revision triggered regeneration while you had unsaved local edits.
        {conflict.conflicting_user_id && ` (concurrent edit by ${conflict.conflicting_user_id})`}
      </p>

      <div className={styles.columns}>
        <div className={styles.column}>
          <div className={styles.columnHeader}>BASE</div>
          <pre className={styles.code}>{conflict.base}</pre>
        </div>
        <div className={styles.column}>
          <div className={styles.columnHeader}>OURS (your edits)</div>
          <pre className={styles.code}>{conflict.ours}</pre>
        </div>
        <div className={styles.column}>
          <div className={styles.columnHeader}>THEIRS (new generation)</div>
          <pre className={styles.code}>{conflict.theirs}</pre>
        </div>
      </div>

      <div className={styles.outputSection}>
        <div className={styles.columnHeader}>OUTPUT (editable)</div>
        <textarea className={styles.outputTextarea} value={output} onChange={(e) => setOutput(e.target.value)} />
      </div>

      <div className={styles.actions}>
        <Button variant="secondary" loading={resolving} onClick={() => resolve("accept_ours")}>
          Accept Ours
        </Button>
        <Button variant="secondary" loading={resolving} onClick={() => resolve("accept_theirs")}>
          Accept Theirs
        </Button>
        <Button loading={resolving} onClick={() => resolve("manual")}>
          Save Manual Resolution
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Cancel & Keep Current
        </Button>
        <Button variant="danger" onClick={findPreStage8Checkpoint}>
          Restore Pre-Stage-8 Checkpoint
        </Button>
      </div>

      {restoreCheckpointId && (
        <Modal title="Restore Checkpoint" onClose={() => setRestoreCheckpointId(null)} width={420}>
          <p>Restoring will discard all progress after this checkpoint.</p>
          <div className={sharedStyles.field}>
            <label className={sharedStyles.label}>Type "RESTORE {restoreCheckpointId}" to confirm</label>
            <input className={sharedStyles.input} value={safetyPhrase} onChange={(e) => setSafetyPhrase(e.target.value)} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <Button variant="secondary" onClick={() => setRestoreCheckpointId(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={safetyPhrase !== `RESTORE ${restoreCheckpointId}`}
              loading={restoring}
              onClick={restoreCheckpoint}
            >
              Confirm Restore
            </Button>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
