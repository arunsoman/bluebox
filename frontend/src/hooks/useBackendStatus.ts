/**
 * Hook to check backend connectivity and health.
 * Polls the /health endpoint periodically.
 */

import { useState, useEffect, useRef } from 'react';
import { FEATURES, API_URL } from '@/lib/config';

export type BackendStatus = 'checking' | 'online' | 'offline' | 'mock';

export interface UseBackendStatusReturn {
  status: BackendStatus;
  version: string;
  latency: number | null;
}

export function useBackendStatus(pollIntervalMs = 30000): UseBackendStatusReturn {
  const [status, setStatus] = useState<BackendStatus>(FEATURES.liveApi ? 'checking' : 'mock' as BackendStatus);
  const [version, setVersion] = useState('1.0.0');
  const [latency, setLatency] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // If in mock mode, never try to connect
    if (!FEATURES.liveApi) {
      setStatus('mock');
      return;
    }

    const checkHealth = async () => {
      const start = performance.now();
      try {
        const response = await fetch(`${API_URL.replace('/api/v1', '')}/health`, {
          method: 'GET',
          // Short timeout so we don't hang
          signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
          const data = await response.json();
          setStatus('online');
          setVersion(data.version || '1.0.0');
          setLatency(Math.round(performance.now() - start));
        } else {
          setStatus('offline');
          setLatency(null);
        }
      } catch {
        setStatus('offline');
        setLatency(null);
      }
    };

    // Check immediately
    checkHealth();

    // Then poll periodically
    intervalRef.current = setInterval(checkHealth, pollIntervalMs);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [pollIntervalMs]);

  return { status, version, latency };
}
