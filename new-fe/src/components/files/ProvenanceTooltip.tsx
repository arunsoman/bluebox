import styles from "./ProvenanceTooltip.module.css";

export function ProvenanceTooltip({ info }: { info: ProvenanceInfo }) {
  return (
    <div className={styles.tooltip}>
      <div className={styles.section}>
        <div className={styles.heading}>Why this file exists</div>
        <p className={styles.body}>{info.why_this_file_exists}</p>
      </div>
      <div className={styles.section}>
        <div className={styles.heading}>Decision chain</div>
        {info.decision_chain.map((step, i) => (
          <p key={i} className={styles.chainStep}>
            → {step.stage_name}: {step.decision_summary}
          </p>
        ))}
      </div>
    </div>
  );
}
