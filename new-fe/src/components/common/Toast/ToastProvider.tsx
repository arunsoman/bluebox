import { useCallback, useRef, useState, type ReactNode } from "react";
import styles from "./ToastProvider.module.css";
import { ToastContext, type ToastInput, type ToastItem } from "./ToastContext";

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `toast-${idCounter}`;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const pushToast = useCallback(
    (toast: ToastInput) => {
      const id = nextId();
      setToasts((prev) => [...prev, { ...toast, id }]);
      const dismissMs =
        toast.autoDismissMs === undefined
          ? toast.severity === "error"
            ? null
            : 5000
          : toast.autoDismissMs;
      if (dismissMs !== null) {
        const timer = setTimeout(() => dismissToast(id), dismissMs);
        timers.current.set(id, timer);
      }
      return id;
    },
    [dismissToast],
  );

  return (
    <ToastContext.Provider value={{ pushToast, dismissToast }}>
      {children}
      <div className={styles.viewport} role="region" aria-label="Notifications">
        {toasts.map((toast) => (
          <div key={toast.id} className={`${styles.toast} ${styles[toast.severity]}`} role="status">
            <div className={styles.title}>{toast.title}</div>
            {toast.body && <div className={styles.body}>{toast.body}</div>}
            {toast.actions && toast.actions.length > 0 && (
              <div className={styles.actions}>
                {toast.actions.map((action) => (
                  <button
                    key={action.label}
                    className={styles.actionButton}
                    onClick={() => {
                      action.onClick();
                      dismissToast(toast.id);
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
            <button
              className={styles.closeButton}
              aria-label="Dismiss notification"
              onClick={() => dismissToast(toast.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
