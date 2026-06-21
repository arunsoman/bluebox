import type { ReactNode } from "react";
import { Button } from "@/components/common/Button";
import styles from "./StagePanelShared.module.css";

interface StagePanelChromeProps {
  title: string;
  subtitle: string;
  trustSummary: string;
  mode: "summary" | "detail";
  setMode: (mode: "summary" | "detail") => void;
  page: number;
  setPage: (page: number) => void;
  totalPages: number;
  contextWindow: string;
  children: ReactNode;
  /** Extra row rendered between the context window and the action bar (e.g. revision budget meter). */
  extraRow?: ReactNode;
  approveAll: { disabled: boolean; loading: boolean; title?: string; label?: string; onClick: () => void };
  reviewSelected: { disabled: boolean; loading: boolean; onClick: () => void };
  bookmarkCount: number;
  onShowBookmarks: () => void;
  onImpactGraph: () => void;
  bookmarkDrawer?: ReactNode;
  /** Re-runs this stage's generation in place - recovery path for a degenerate/empty LLM
   * result, since there's otherwise no way back once a stage's candidates are cached. */
  regenerate: { loading: boolean; onClick: () => void };
}

/** Shared chrome (header/toolbar/pagination/context-window/action-bar) behind all five stage-specific steering panels. */
export function StagePanelChrome({
  title,
  subtitle,
  trustSummary,
  mode,
  setMode,
  page,
  setPage,
  totalPages,
  contextWindow,
  children,
  extraRow,
  approveAll,
  reviewSelected,
  bookmarkCount,
  onShowBookmarks,
  onImpactGraph,
  bookmarkDrawer,
  regenerate,
}: StagePanelChromeProps) {
  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.description}>{subtitle}</p>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.modeToggle}>
          <button className={mode === "summary" ? styles.activeMode : ""} onClick={() => setMode("summary")}>
            Summary
          </button>
          <button className={mode === "detail" ? styles.activeMode : ""} onClick={() => setMode("detail")}>
            Detail
          </button>
        </div>
        <div className={styles.toolbarRight}>
          <span className={styles.trustChip}>{trustSummary}</span>
          <button className={styles.impactLink} disabled={regenerate.loading} onClick={regenerate.onClick}>
            {regenerate.loading ? "Regenerating…" : "↻ Regenerate"}
          </button>
        </div>
      </div>

      <div className={styles.nodeList}>{children}</div>

      {mode === "summary" && totalPages > 1 && (
        <div className={styles.pagination}>
          <button disabled={page === 0} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span>
            Page {page + 1} of {totalPages}
          </span>
          <button disabled={page === totalPages - 1} onClick={() => setPage(page + 1)}>
            Next
          </button>
        </div>
      )}

      <div className={styles.contextWindow}>
        <strong>Why these outputs?</strong> {contextWindow}
      </div>

      {extraRow}

      <div className={styles.actionBar}>
        <Button loading={approveAll.loading} disabled={approveAll.disabled} title={approveAll.title} onClick={approveAll.onClick}>
          {approveAll.label ?? "Approve All"}
        </Button>
        <Button variant="secondary" loading={reviewSelected.loading} disabled={reviewSelected.disabled} onClick={reviewSelected.onClick}>
          Approve Selected
        </Button>
        <button className={styles.bookmarkToggle} onClick={onShowBookmarks}>
          ★ Bookmarks ({bookmarkCount})
        </button>
        <button className={styles.impactLink} onClick={onImpactGraph}>
          View Impact Graph
        </button>
      </div>

      {bookmarkDrawer}
    </div>
  );
}
