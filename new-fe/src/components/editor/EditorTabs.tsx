import type { OpenTab } from "@/stores/workspaceStore";
import styles from "./EditorTabs.module.css";

interface EditorTabsProps {
  tabs: OpenTab[];
  activePath: string | null;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
}

export function EditorTabs({ tabs, activePath, onSelect, onClose }: EditorTabsProps) {
  return (
    <div className={styles.bar}>
      {tabs.map((tab) => (
        <div
          key={tab.path}
          className={`${styles.tab} ${tab.path === activePath ? styles.active : ""}`}
          onClick={() => onSelect(tab.path)}
        >
          <span className={styles.name}>{tab.path.split("/").pop()}</span>
          {tab.isModified && <span className={styles.modifiedDot} />}
          <button
            className={styles.close}
            onClick={(e) => {
              e.stopPropagation();
              onClose(tab.path);
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
