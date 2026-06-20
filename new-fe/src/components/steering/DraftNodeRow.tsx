import type { ReactNode } from "react";
import styles from "./DraftNodeRow.module.css";

const RISK_CLASS: Record<DraftNode["risk_classification"], string> = {
  LOW_RISK: styles.low,
  MEDIUM: styles.medium,
  HIGH: styles.high,
  CRITICAL: styles.critical,
};

interface DraftNodeRowProps {
  node: DraftNode;
  selected: boolean;
  bookmarked: boolean;
  onToggleSelect: () => void;
  onToggleBookmark: () => void;
  onOpenDetail: () => void;
  /** Stage-specific summary content (e.g. "Steps: 5 | Pre: 3", "Points: 8 | AC: 4") shown in place of the generic downstream count. */
  meta?: ReactNode;
  /** HIGH/CRITICAL rows require an explicit consent checkbox per doc/phase-1-wireframe.md §7.1 etc. before "Approve All" can include them. */
  consent?: { checked: boolean; onToggle: () => void; label: string };
  /** Stage-specific content rendered below the row (e.g. access guard checklist, file path chips). */
  extra?: ReactNode;
}

export function DraftNodeRow({
  node,
  selected,
  bookmarked,
  onToggleSelect,
  onToggleBookmark,
  onOpenDetail,
  meta,
  consent,
  extra,
}: DraftNodeRowProps) {
  const autoApproved = node.status === "auto_approved";
  return (
    <div className={styles.rowGroup}>
      <div className={`${styles.row} ${node.risk_classification === "CRITICAL" ? styles.criticalRow : ""}`}>
        <input type="checkbox" checked={selected || autoApproved} disabled={autoApproved} onChange={onToggleSelect} />
        <button className={styles.name} onClick={onOpenDetail} title={node.description}>
          {node.name}
        </button>
        <span className={styles.type}>{node.node_type}</span>
        <span className={`${styles.riskBadge} ${RISK_CLASS[node.risk_classification]}`}>
          {node.risk_classification}
        </span>
        {autoApproved && <span className={styles.autoBadge}>auto</span>}
        <span className={styles.downstream}>{meta ?? `${node.downstream_count} downstream`}</span>
        <button
          className={`${styles.bookmark} ${bookmarked ? styles.bookmarked : ""}`}
          title="Bookmark"
          onClick={onToggleBookmark}
        >
          ★
        </button>
      </div>
      {consent && (
        <label className={styles.consentRow}>
          <input type="checkbox" checked={consent.checked} onChange={consent.onToggle} />
          {consent.label}
        </label>
      )}
      {extra}
    </div>
  );
}
