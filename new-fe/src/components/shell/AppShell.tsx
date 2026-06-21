import type { ReactNode } from "react";
import { useIdeLayoutStore, type BottomTab, type CenterTab } from "@/stores/ideLayoutStore";
import { ResizableSash } from "./ResizableSash";
import { Toolbar } from "./Toolbar";
import styles from "./AppShell.module.css";

interface AppShellProps {
  projectName: string;
  chatPanel: ReactNode;
  fileExplorer: ReactNode;
  centerPanels: Record<CenterTab, ReactNode>;
  centerTabBadge?: Partial<Record<CenterTab, boolean>>;
  rightPanel: ReactNode;
  bottomPanels: Record<BottomTab, ReactNode>;
}

const CENTER_TABS: { id: CenterTab; label: string; disabled?: boolean }[] = [
  { id: "editor", label: "Editor" },
  { id: "steering", label: "Steering Panel" },
  { id: "graph", label: "Blueprint Graph" },
];

const BOTTOM_TABS: { id: BottomTab; label: string; disabled?: boolean }[] = [
  { id: "terminal", label: "Terminal", disabled: true },
  { id: "test-results", label: "Test Results", disabled: true },
  { id: "audit-trail", label: "Audit Trail" },
  { id: "code-gen", label: "Code Generation" },
];

export function AppShell({
  projectName,
  chatPanel,
  fileExplorer,
  centerPanels,
  centerTabBadge,
  rightPanel,
  bottomPanels,
}: AppShellProps) {
  const layout = useIdeLayoutStore();

  return (
    <div className={styles.root}>
      <Toolbar projectName={projectName} />
      <div className={styles.body}>
        {!layout.leftSidebarCollapsed ? (
          <>
            <div className={styles.leftSidebar} style={{ width: layout.leftSidebarWidth }}>
              <div className={styles.chatSlot} style={{ flexBasis: `${layout.chatPanelHeight}%` }}>
                {chatPanel}
              </div>
              <ResizableSash
                direction="horizontal"
                onDrag={(delta) =>
                  layout.setChatPanelHeight(
                    layout.chatPanelHeight + (delta / window.innerHeight) * 100,
                  )
                }
              />
              <div className={styles.fileExplorerSlot}>{fileExplorer}</div>
            </div>
            <ResizableSash direction="vertical" onDrag={(d) => layout.setLeftSidebarWidth(layout.leftSidebarWidth + d)} />
          </>
        ) : (
          <button className={styles.collapsedRail} onClick={layout.toggleLeftSidebar} title="Expand left sidebar">
            ▸
          </button>
        )}

        <div className={styles.center}>
          <div className={styles.centerTabBar}>
            {CENTER_TABS.map((tab) => (
              <button
                key={tab.id}
                className={`${styles.centerTab} ${layout.activeCenterTab === tab.id ? styles.activeTab : ""}`}
                disabled={tab.disabled}
                title={tab.disabled ? "Not implemented in this pass" : undefined}
                onClick={() => layout.setActiveCenterTab(tab.id)}
              >
                {tab.label}
                {centerTabBadge?.[tab.id] && <span className={styles.tabDot} />}
              </button>
            ))}
          </div>
          <div className={styles.centerContent}>{centerPanels[layout.activeCenterTab]}</div>

          {!layout.bottomPanelCollapsed ? (
            <>
              <ResizableSash
                direction="horizontal"
                onDrag={(delta) => layout.setBottomPanelHeight(layout.bottomPanelHeight - delta)}
              />
              <div className={styles.bottomPanel} style={{ height: layout.bottomPanelHeight }}>
                <div className={styles.bottomTabBar}>
                  {BOTTOM_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      className={`${styles.bottomTab} ${layout.activeBottomTab === tab.id ? styles.activeTab : ""}`}
                      disabled={tab.disabled}
                      title={tab.disabled ? "Not implemented in this pass" : undefined}
                      onClick={() => layout.setActiveBottomTab(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))}
                  <button className={styles.collapseToggle} onClick={layout.toggleBottomPanel}>
                    ▾
                  </button>
                </div>
                <div className={styles.bottomContent}>{bottomPanels[layout.activeBottomTab]}</div>
              </div>
            </>
          ) : (
            <button className={styles.collapsedBottomBar} onClick={layout.toggleBottomPanel}>
              ▴ Terminal / Test Results / Audit Trail
            </button>
          )}
        </div>

        {!layout.rightSidebarCollapsed ? (
          <>
            <ResizableSash
              direction="vertical"
              onDrag={(d) => layout.setRightSidebarWidth(layout.rightSidebarWidth - d)}
            />
            <div className={styles.rightSidebar} style={{ width: layout.rightSidebarWidth }}>
              {rightPanel}
            </div>
          </>
        ) : (
          <button className={styles.collapsedRail} onClick={layout.toggleRightSidebar} title="Expand live preview">
            ◂
          </button>
        )}
      </div>
    </div>
  );
}
