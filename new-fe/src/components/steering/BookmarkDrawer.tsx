import { Button } from "@/components/common/Button";
import styles from "./BookmarkDrawer.module.css";

interface BookmarkDrawerProps {
  nodes: DraftNode[];
  onClose: () => void;
  onSelect: (nodeId: string) => void;
  submitting: boolean;
}

export function BookmarkDrawer({ nodes, onClose, onSelect, submitting }: BookmarkDrawerProps) {
  return (
    <div className={styles.drawer}>
      <div className={styles.header}>
        <span>Compare bookmarked options</span>
        <button className={styles.close} onClick={onClose}>
          ×
        </button>
      </div>
      <div className={styles.columns}>
        {nodes.map((node) => (
          <div key={node.node_id} className={styles.column}>
            <p className={styles.name}>{node.name}</p>
            <p className={styles.description}>{node.description}</p>
            <p className={styles.meta}>
              {node.downstream_count} downstream · {node.layer}
            </p>
            <Button loading={submitting} onClick={() => onSelect(node.node_id)}>
              Select this option
            </Button>
          </div>
        ))}
        {nodes.length === 0 && <p className={styles.empty}>No bookmarks yet.</p>}
      </div>
    </div>
  );
}
