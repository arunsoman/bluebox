import { useIdeLayoutStore } from "@/stores/ideLayoutStore";
import styles from "./RichCards.module.css";

/**
 * Summary-only — the full interaction (accept/modify/replace/authorize)
 * lives in the dedicated Steering Panel (components/steering) to avoid
 * duplicating that logic here. This card is a navigational pointer.
 */
export function SteeringPanelCard({ panel }: { panel: SteeringPanel }) {
  const setActiveCenterTab = useIdeLayoutStore((s) => s.setActiveCenterTab);

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>{panel.stage_name}</div>
      <p className={styles.cardSubtext}>{panel.context_window}</p>
      <div className={styles.statRow}>
        <span>{panel.total_nodes} nodes</span>
        <span className={styles.success}>{panel.auto_approved_count} auto-approved</span>
        <span className={styles.warning}>{panel.paused_count} paused</span>
        {panel.critical_count > 0 && <span className={styles.error}>{panel.critical_count} critical</span>}
      </div>
      <button className={styles.cardAction} onClick={() => setActiveCenterTab("steering")}>
        Open Steering Panel →
      </button>
    </div>
  );
}
