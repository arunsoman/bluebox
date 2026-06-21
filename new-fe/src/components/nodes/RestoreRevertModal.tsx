import { useState } from "react";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { useToast } from "@/components/common/Toast/ToastContext";
import { usePipelineStore } from "@/stores/pipelineStore";
import { auditApi } from "@/api/endpoints/audit";
import { ApiError } from "@/api/httpClient";
import styles from "./EditorForms.module.css";

/**
 * doc/wireframes.md missing-screens §4.3 — Restore / Revert Flow, triggered
 * from the Audit Panel's Decision Ledger (it already holds both entries).
 * There's no "preview revert impact" endpoint, so unlike the wireframe's
 * pre-confirm "Impact: 47 nodes affected" estimate, we show the real diff
 * between the two decisions' payloads and surface the real
 * `RevertResult.impact_report_id` only after confirming.
 */
export function RestoreRevertModal({
  currentEntry,
  targetEntry,
  onClose,
  onReverted,
}: {
  currentEntry: DecisionEntry;
  targetEntry: DecisionEntry;
  onClose: () => void;
  onReverted: (result: RevertResult) => void;
}) {
  const projectId = usePipelineStore((s) => s.projectId);
  const { pushToast } = useToast();
  const [confirmText, setConfirmText] = useState("");
  const [reverting, setReverting] = useState(false);

  const expectedConfirm = `REVERT ${targetEntry.entry_id}`;
  const currentPayload = (currentEntry.payload ?? {}) as Record<string, unknown>;
  const targetPayload = (targetEntry.payload ?? {}) as Record<string, unknown>;
  const keys = Array.from(new Set([...Object.keys(currentPayload), ...Object.keys(targetPayload)]));

  async function handleConfirm() {
    if (!projectId || confirmText !== expectedConfirm) return;
    setReverting(true);
    try {
      const result = await auditApi.revertDecision(projectId, {
        target_decision_id: targetEntry.entry_id,
        rationale: `Revert from ${currentEntry.entry_id} to ${targetEntry.entry_id} via Audit Panel`,
      });
      pushToast({ severity: "success", title: "Reverted", body: `New entry: ${result.new_entry_id}` });
      onReverted(result);
    } catch (err) {
      pushToast({ severity: "error", title: "Revert failed", body: err instanceof ApiError ? err.message : "Unknown error" });
    } finally {
      setReverting(false);
    }
  }

  return (
    <Modal
      title="↩️ Revert to Previous Version"
      onClose={onClose}
      width={520}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" loading={reverting} disabled={confirmText !== expectedConfirm} onClick={handleConfirm}>
            Confirm Revert
          </Button>
        </>
      }
    >
      <div className={styles.readonly}>Current: {currentEntry.entry_id} ({currentEntry.summary})</div>
      <div className={styles.readonly}>Revert to: {targetEntry.entry_id} ({targetEntry.summary})</div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Diff Preview</h3>
        <div className={styles.row}>
          <div className={styles.sectionBody}>
            <strong>Before (Current)</strong>
            {keys.map((k) => (
              <div key={k}>{k}: {JSON.stringify(currentPayload[k])}</div>
            ))}
          </div>
          <div className={styles.sectionBody}>
            <strong>After (Revert)</strong>
            {keys.map((k) => (
              <div key={k}>{k}: {JSON.stringify(targetPayload[k])}</div>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Type "{expectedConfirm}" to confirm</label>
        <input className={styles.input} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
      </div>
    </Modal>
  );
}
