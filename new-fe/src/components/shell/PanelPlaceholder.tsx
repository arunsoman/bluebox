import styles from "./PanelPlaceholder.module.css";

interface PanelPlaceholderProps {
  name: string;
  note?: string;
}

/**
 * Honest stand-in for panels out of scope this pass (Live Preview, Terminal,
 * Test Results, Blueprint Graph, Audit). Renders no data — just states that
 * the panel isn't wired up yet, so the layout matches the spec without
 * faking functionality.
 */
export function PanelPlaceholder({ name, note }: PanelPlaceholderProps) {
  return (
    <div className={styles.container}>
      <p className={styles.name}>{name}</p>
      <p className={styles.note}>{note ?? "Not implemented in this pass."}</p>
    </div>
  );
}
