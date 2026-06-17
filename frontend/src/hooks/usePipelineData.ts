/**
 * Hook to load pipeline data from the API.
 *
 * When VITE_LIVE_API=true, fetches from the backend.
 * When VITE_LIVE_API=false (default), uses mock data already in the store.
 */

import { useState, useEffect, useCallback } from 'react';
import { FEATURES } from '@/lib/config';
import * as api from '@/lib/api';
import { usePipelineStore } from '@/store/usePipelineStore';

export interface UsePipelineDataReturn {
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function usePipelineData(projectId?: string): UsePipelineDataReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Store setters
  const setStageStatus = usePipelineStore((s) => s.setStageStatus);
  const addActivity = usePipelineStore((s) => s.addActivity);

  const fetchData = useCallback(async () => {
    // Skip if not in live mode or already fetched
    if (!FEATURES.liveApi) {
      setLoading(false);
      return;
    }

    if (!projectId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch blueprint
      const blueprint = await api.getBlueprint(projectId);

      // Update store stages based on blueprint data
      if (blueprint.actors.length > 0) {
        setStageStatus(2, 'completed', 100);
      }
      if (blueprint.capabilities.length > 0) {
        setStageStatus(3, 'completed', 100);
      }
      if (blueprint.use_cases.length > 0) {
        setStageStatus(4, 'completed', 100);
      }
      if (blueprint.user_stories.length > 0) {
        setStageStatus(5, 'completed', 100);
      }
      if (blueprint.task_decomposition.length > 0) {
        setStageStatus(6, 'completed', 100);
      }

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load pipeline data';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [projectId, setStageStatus, addActivity]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { loading, error, refresh: fetchData };
}
