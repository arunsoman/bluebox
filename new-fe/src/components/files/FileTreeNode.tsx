import { useState } from "react";
import styles from "./FileTreeNode.module.css";

const LAYER_CLASS: Record<string, string> = {
  frontend: styles.frontend,
  backend: styles.backend,
  database: styles.database,
  infra: styles.infra,
  auth: styles.auth,
  test: styles.test,
  devops: styles.devops,
  security: styles.security,
};

const STATUS_ICON: Record<FileNode["status"], string> = {
  generating: "◐",
  complete: "✓",
  modified: "●",
  conflict: "▲",
  stale: "✓",
};

interface FileTreeNodeProps {
  node: FileNode;
  depth: number;
  activePath: string | null;
  onOpenFile: (path: string) => void;
  onContextMenu: (path: string, x: number, y: number) => void;
  onHoverFile: (path: string | null) => void;
}

export function FileTreeNode({ node, depth, activePath, onOpenFile, onContextMenu, onHoverFile }: FileTreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 3);

  if (node.type === "directory") {
    return (
      <div>
        <div
          className={styles.row}
          style={{ paddingLeft: Math.min(depth, 4) * 16 }}
          onClick={() => setExpanded((v) => !v)}
        >
          <span className={styles.chevron}>{expanded ? "▾" : "▸"}</span>
          <span className={styles.folderIcon}>📁</span>
          <span className={styles.name}>{node.name}</span>
        </div>
        {expanded && node.children?.map((child) => (
          <FileTreeNode
            key={child.path}
            node={child}
            depth={depth + 1}
            activePath={activePath}
            onOpenFile={onOpenFile}
            onContextMenu={onContextMenu}
            onHoverFile={onHoverFile}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`${styles.row} ${activePath === node.path ? styles.active : ""}`}
      style={{ paddingLeft: Math.min(depth, 4) * 16 + 12 }}
      onClick={() => onOpenFile(node.path)}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(node.path, e.clientX, e.clientY);
      }}
      onMouseEnter={() => onHoverFile(node.path)}
      onMouseLeave={() => onHoverFile(null)}
    >
      <span className={`${styles.layerDot} ${LAYER_CLASS[node.layer] ?? ""}`} />
      <span className={styles.name}>{node.name}</span>
      <span className={`${styles.statusIcon} ${styles[node.status]}`}>{STATUS_ICON[node.status]}</span>
    </div>
  );
}
