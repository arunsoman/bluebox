import { useEffect } from "react";
import { Navigate, Outlet, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { usePipelineStore } from "@/stores/pipelineStore";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";
import { useToast } from "@/components/common/Toast/ToastContext";
import { env } from "@/config/env";

export function RequireAuth() {
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const status = useAuthStore((s) => s.status);
  const accessToken = useAuthStore((s) => s.accessToken);
  const hydrate = useAuthStore((s) => s.hydrate);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    if (status === "idle" && accessToken) {
      void hydrate();
    }
  }, [status, accessToken, hydrate]);

  useIdleTimeout(env.sessionReauthIdleMinutes, () => {
    if (useAuthStore.getState().status === "authenticated") {
      logout();
      usePipelineStore.getState().disconnect();
      pushToast({
        severity: "info",
        title: "Signed out",
        body: `You were idle for ${env.sessionReauthIdleMinutes} minutes — please sign in again.`,
      });
      navigate("/login", { replace: true });
    }
  });

  if (!accessToken) return <Navigate to="/login" replace />;
  if (status === "loading" || status === "idle") return null;
  if (status === "error") return <Navigate to="/login" replace />;
  return <Outlet />;
}