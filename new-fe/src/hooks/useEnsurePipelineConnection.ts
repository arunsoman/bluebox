import { useEffect, useState } from "react";
import { projectsApi } from "@/api/endpoints/projects";
import { usePipelineStore } from "@/stores/pipelineStore";

/**
 * Re-establishes the WS session for a project if the user navigated to an
 * onboarding/workspace route directly (deep link or page refresh) rather
 * than via the dashboard's "open" flow, which already calls resume+connect.
 */
export function useEnsurePipelineConnection(projectId: string | undefined): {
  ready: boolean;
  error: string | null;
} {
  const connect = usePipelineStore((s) => s.connect);
  const connectedProjectId = usePipelineStore((s) => s.projectId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId || connectedProjectId === projectId) return;
    let cancelled = false;
    projectsApi
      .resume(projectId)
      .then((sessionState) => {
        if (!cancelled) connect(projectId, sessionState.session_id);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to resume session");
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, connectedProjectId, connect]);

  return { ready: connectedProjectId === projectId, error };
}
