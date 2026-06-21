import { Header } from "./Header";
import { Footer } from "./Footer";
import styles from "./AppLayout.module.css";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.layout}>
      <Header />
      <main className={styles.main}>{children}</main>
      <Footer />
    </div>
  );
}