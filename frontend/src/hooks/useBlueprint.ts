import { useEffect, useState } from 'react';
import { useWebSocketStore } from '@/store/useWebSocketStore';
import { usePipelineStore } from '@/store/usePipelineStore';
import { getBlueprint } from '@/lib/api';

export function useBlueprint() {
  const blueprintData = useWebSocketStore((state) => state.blueprintData);
  const projectId = usePipelineStore((state) => state.projectId);
  const [blueprint, setBlueprint] = useState<object | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (blueprintData) {
      setBlueprint(blueprintData);
      return;
    }
    if (projectId) {
      setLoading(true);
      getBlueprint(projectId)
        .then((data) => setBlueprint(data as object))
        .catch(() => setBlueprint(null))
        .finally(() => setLoading(false));
    }
  }, [blueprintData, projectId]);

  return { blueprint, loading };
}
