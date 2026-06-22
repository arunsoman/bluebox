import { useAuthStore } from "@/stores/authStore";
import { usePipelineStore } from "@/stores/pipelineStore";
import { useLayout } from "./LayoutContext";
import styles from "./Header.module.css";

interface HeaderProps {
  left?: React.ReactNode;
}

export function Header({ left }: HeaderProps) {
  const { config } = useLayout();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  function handleLogout() {
    logout();
    usePipelineStore.getState().disconnect();
  }

  return (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        <span className={styles.logo}>◆</span>
        <span className={styles.brand}>BLUEBOX</span>
        {left}
      </div>

      <div className={styles.headerCenter}>{config.headerCenter}</div>

      <div className={styles.headerRight}>
        {config.headerRight ?? (
          <>
            <span className={styles.statusDot} />
            <span className={styles.statusText}>ONLINE</span>
          </>
        )}
        <span className={styles.divider}>│</span>
        <span className={styles.userTag}>{user?.email}</span>
        <button className={styles.logoutBtn} onClick={handleLogout}>
          logout
        </button>
      </div>
    </header>
  );
}