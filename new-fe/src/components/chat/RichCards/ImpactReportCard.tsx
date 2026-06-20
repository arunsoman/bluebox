import styles from "./RichCards.module.css";

const SEVERITY_CLASS = {
  success: styles.success,
  warning: styles.warning,
  error: styles.error,
} as const;

export function ImpactReportCard({ report }: { report: ImpactReport }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>Impact Report</div>
      <ul className={styles.affectedList}>
        {report.affected_nodes.map((node) => (
          <li key={node.node_id} className={SEVERITY_CLASS[node.severity]}>
            {node.name} <span className={styles.cardSubtext}>({node.reason})</span>
          </li>
        ))}
      </ul>
      {report.stages_to_rerun.length > 0 && (
        <p className={styles.cardSubtext}>Stages to rerun: {report.stages_to_rerun.join(", ")}</p>
      )}
    </div>
  );
}
