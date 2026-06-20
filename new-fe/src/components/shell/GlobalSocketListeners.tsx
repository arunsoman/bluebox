import { useEffect } from "react";
import { socketClient } from "@/ws/socketClient";
import { useToast } from "@/components/common/Toast/ToastContext";

/**
 * Subscribes to cross-cutting WS events (§9.2, §9.4) once per session and
 * surfaces them as toasts / tab-title updates — no panel owns these.
 */
export function GlobalSocketListeners() {
  const { pushToast } = useToast();

  useEffect(() => {
    const unsubscribers = [
      socketClient.on("ERROR", (payload) => {
        pushToast({
          severity: payload.recoverable ? "warning" : "error",
          title: payload.recoverable ? "Something went wrong" : "Critical error",
          body: payload.message,
          autoDismissMs: payload.recoverable ? undefined : null,
        });
      }),
      socketClient.on("LLM_FAILURE", (payload) => {
        pushToast({
          severity: "warning",
          title: "LLM request failed",
          body: `${payload.failure_type} during stage ${payload.stage}.`,
          autoDismissMs: null,
        });
      }),
      socketClient.on("TOAST_NOTIFICATION", (payload) => {
        pushToast({
          severity: payload.severity,
          title: payload.title,
          body: payload.body,
          autoDismissMs: payload.auto_dismiss_seconds == null ? null : payload.auto_dismiss_seconds * 1000,
        });
      }),
      socketClient.on("BROWSER_TAB_UPDATE", ({ title }) => {
        document.title = title;
      }),
      socketClient.on("SESSION_TIMEOUT_WARNING", ({ minutes_remaining }) => {
        pushToast({
          severity: "warning",
          title: "Session timing out",
          body: `Your session will time out in ${minutes_remaining} minute(s).`,
        });
      }),
    ];
    return () => unsubscribers.forEach((u) => u());
  }, [pushToast]);

  return null;
}
