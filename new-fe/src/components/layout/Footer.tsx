import { useLayout } from "./LayoutContext";
import styles from "./Footer.module.css";

export function Footer() {
  const { config } = useLayout();

  return (
    <footer className={styles.footer}>
      <div className={styles.footerLeft}>
        {config.footerLeft ?? (
          <span className={styles.modeBadge}>NORMAL</span>
        )}
      </div>

      <div className={styles.footerCenter}>
        {config.footerCenter ?? (
          <>
            <span className={styles.hint}>^P Command</span>
            <span className={styles.hint}>^S Save</span>
            <span className={styles.hint}>^K Checkpoint</span>
          </>
        )}
      </div>

      <div className={styles.footerRight}>
        {config.footerRight ?? (
          <>
            <span className={styles.info}>Ln 42, Col 18</span>
            <span className={styles.divider}>│</span>
            <span className={styles.info}>v2.4.0</span>
          </>
        )}
      </div>
    </footer>
  );
}