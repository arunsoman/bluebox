import styles from "./PanelChrome.module.css";

interface PanelChromeProps {
  title?: string;
  tabs?: { label: string; active?: boolean; onClick?: () => void }[];
  rightAction?: React.ReactNode;
  children: React.ReactNode;
  accentColor?: string;
}

export function PanelChrome({
  title,
  tabs,
  rightAction,
  children,
  accentColor = "var(--color-primary)",
}: PanelChromeProps) {
  return (
    <div className={styles.panel} style={{ "--panel-accent": accentColor } as React.CSSProperties}>
      <div className={styles.titleBar}>
        <div className={styles.tabs}>
          {tabs ? (
            tabs.map((tab) => (
              <button
                key={tab.label}
                className={`${styles.tab} ${tab.active ? styles.active : ""}`}
                onClick={tab.onClick}
              >
                {tab.label}
              </button>
            ))
          ) : (
            <span className={styles.staticTitle}>{title}</span>
          )}
        </div>
        {rightAction && <div className={styles.rightAction}>{rightAction}</div>}
      </div>
      <div className={styles.content}>{children}</div>
    </div>
  );
}