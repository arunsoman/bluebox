import styles from "./LogViewerModal.module.css";
import { useEffect, useMemo, useState } from "react";
import { useLogViewerStore } from "@/stores/logViewerStore";

interface LogViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIES: LogEvent["category"][] = [
  "http_sent_by_client",
  "http_received_by_backend",
  "ws_sent_by_client",
  "ws_received_by_backend",
  "ws_sent_by_backend",
  "ws_received_by_client",
  "llm_call",
];

export function LogViewerModal({ isOpen, onClose }: LogViewerModalProps) {
  const entries = useLogViewerStore((s) => s.entries);
  const connected = useLogViewerStore((s) => s.connected);
  const clear = useLogViewerStore((s) => s.clear);
  const [activeCategories, setActiveCategories] = useState<Set<LogEvent["category"]>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const visible = useMemo(
    () => (activeCategories.size === 0 ? entries : entries.filter((e) => activeCategories.has(e.category))),
    [entries, activeCategories],
  );

  if (!isOpen) return null;

  const toggleCategory = (category: LogEvent["category"]) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  return (
    <div className={styles["log-viewer-overlay"]} onClick={onClose}>
      <div className={styles["log-viewer-modal"]} onClick={(e) => e.stopPropagation()}>
        <div className={styles["log-viewer-header"]}>
          <h2>Log Viewer</h2>
          <span
            className={
              connected ? styles["log-viewer-status-live"] : styles["log-viewer-status-offline"]
            }
          >
            {connected ? "● live" : "○ disconnected"}
          </span>
          <button className={styles["log-viewer-close"]} onClick={onClose} title="Close (Esc)">
            ✕
          </button>
        </div>

        <div className={styles["log-viewer-filters"]}>
          {CATEGORIES.map((category) => (
            <button
              key={category}
              className={`${styles["log-viewer-filter-chip"]} ${
                activeCategories.has(category) ? styles["log-viewer-filter-chip-active"] : ""
              }`}
              onClick={() => toggleCategory(category)}
            >
              {category}
            </button>
          ))}
          <button className={styles["log-viewer-clear"]} onClick={clear}>
            Clear
          </button>
        </div>

        <div className={styles["log-viewer-body"]}>
          {visible.length === 0 && <p className={styles["log-viewer-empty"]}>No log entries yet.</p>}
          {visible.map((entry) => (
            <div key={entry.log_id} className={styles["log-viewer-row"]}>
              <button
                className={styles["log-viewer-row-summary"]}
                onClick={() => setExpandedId((id) => (id === entry.log_id ? null : entry.log_id))}
              >
                <span className={styles["log-viewer-row-time"]}>
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
                <span className={styles["log-viewer-row-category"]}>{entry.category}</span>
                <span className={styles["log-viewer-row-text"]}>{entry.summary}</span>
                {entry.duration_ms !== null && (
                  <span className={styles["log-viewer-row-duration"]}>{entry.duration_ms.toFixed(0)}ms</span>
                )}
              </button>
              {expandedId === entry.log_id && (
                <pre className={styles["log-viewer-row-detail"]}>{JSON.stringify(entry.detail, null, 2)}</pre>
              )}
            </div>
          ))}
        </div>

        <div className={styles["log-viewer-footer"]}>
          <p>
            <small>
              Press <kbd>Ctrl+Shift+L</kbd> to toggle this panel. {entries.length} entries buffered
              (most recent 1000, per project).
            </small>
          </p>
        </div>
      </div>
    </div>
  );
}
