import { createContext, useContext } from "react";

export type ToastSeverity = "success" | "warning" | "error" | "info";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastInput {
  severity: ToastSeverity;
  title: string;
  body?: string;
  actions?: ToastAction[];
  /** Error toasts never auto-dismiss per UIUX §6.1.3. */
  autoDismissMs?: number | null;
}

export interface ToastItem extends ToastInput {
  id: string;
}

export interface ToastContextValue {
  pushToast: (toast: ToastInput) => string;
  dismissToast: (id: string) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
