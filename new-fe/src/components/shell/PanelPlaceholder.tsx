import styles from "./PanelPlaceholder.module.css";

interface PanelPlaceholderProps {
  name: string;
  note?: string;
}

export function PanelPlaceholder({ name, note }: PanelPlaceholderProps) {
  return (
    <div className={styles.placeholder}>
      <span className={styles.bracket}>{"<"}</span>
      <span className={styles.name}>{name}</span>
      <span className={styles.bracket}>{"/>"}</span>
      {note && <span className={styles.note}>{note}</span>}
    </div>
  );
}