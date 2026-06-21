import { useState } from "react";
import styles from "./AppShell.module.css";
import { PanelChrome } from "./PannelChrome";

type CenterTab = "projects" | "prd" | "steering" | "graph" | "code-gen" | "editor";
type BottomTab = "terminal" | "test-results" | "audit-trail";

interface AppShellProps {
  chatPanel: React.ReactNode;
  fileExplorer: React.ReactNode;
  centerPanels: {
    projects: React.ReactNode;
    prd: React.ReactNode;
    steering: React.ReactNode;
    graph: React.ReactNode;
    "code-gen": React.ReactNode;
    editor: React.ReactNode;
  };
  centerTabBadge?: { steering?: boolean };
  initialCenterTab?: CenterTab;
  rightPanel: React.ReactNode;
  bottomPanels: {
    terminal: React.ReactNode;
    "test-results": React.ReactNode;
    "audit-trail": React.ReactNode;
  };
}

export function AppShell({
  chatPanel,
  fileExplorer,
  centerPanels,
  centerTabBadge,
  initialCenterTab = "prd",
  rightPanel,
  bottomPanels,
}: AppShellProps) {
  const [leftTab, setLeftTab] = useState<"files" | "chat">("files");
  const [centerTab, setCenterTab] = useState<CenterTab>(initialCenterTab);
  const [bottomTab, setBottomTab] = useState<BottomTab>("terminal");
  const [rightCollapsed, setRightCollapsed] = useState(false);

  const centerLabels: Record<CenterTab, string> = {
    projects: "PROJECTS",
    prd: "PRD",
    steering: "STEER",
    graph: "GRAPH",
    "code-gen": "CODEGEN",
    editor: "EDITOR",
  };

  const bottomLabels: Record<BottomTab, string> = {
    terminal: "TERMINAL",
    "test-results": "TEST",
    "audit-trail": "AUDIT",
  };

  return (
    <div className={styles.shell}>
      {/* ── TOP ROW: 3 columns ── */}
      <div className={styles.topRow}>
        {/* LEFT */}
        <div className={styles.leftCol}>
          <PanelChrome
            tabs={[
              { label: "FILES", active: leftTab === "files", onClick: () => setLeftTab("files") },
              { label: "CHAT", active: leftTab === "chat", onClick: () => setLeftTab("chat") },
            ]}
            accentColor="var(--color-secondary)"
          >
            {leftTab === "files" ? fileExplorer : chatPanel}
          </PanelChrome>
        </div>

        {/* CENTER */}
        <div className={styles.centerCol}>
          <PanelChrome
            tabs={(Object.keys(centerLabels) as CenterTab[]).map((tab) => ({
              label: centerLabels[tab],
              active: centerTab === tab,
              onClick: () => setCenterTab(tab),
            }))}
            rightAction={<span className={styles.meta}>UTF-8 | TypeScript</span>}
            accentColor="var(--color-primary)"
          >
            {centerPanels[centerTab]}
          </PanelChrome>
        </div>

        {/* RIGHT */}
        <div className={`${styles.rightCol} ${rightCollapsed ? styles.collapsed : ""}`}>
          <PanelChrome
            title="PREVIEW"
            rightAction={
              <button className={styles.collapseBtn} onClick={() => setRightCollapsed((v) => !v)}>
                {rightCollapsed ? "◀" : "▶"}
              </button>
            }
            accentColor="var(--color-purple)"
          >
            {!rightCollapsed && rightPanel}
          </PanelChrome>
        </div>
      </div>

      {/* ── BOTTOM ROW: full-width ── */}
      <div className={styles.bottomRow}>
        <PanelChrome
          tabs={(Object.keys(bottomLabels) as BottomTab[]).map((tab) => ({
            label: bottomLabels[tab],
            active: bottomTab === tab,
            onClick: () => setBottomTab(tab),
          }))}
          accentColor="var(--color-warning)"
        >
          {bottomPanels[bottomTab]}
        </PanelChrome>
      </div>
    </div>
  );
}