// =============================================================================
// CheckpointsPage — Checkpoint list with restore functionality
// Route: /pipeline/:sessionId/checkpoints
// =============================================================================

import { useCallback, useEffect } from 'react';
import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { HardDrive, RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { pipelineApi } from '@/lib/api';
import { useCheckpointStore } from '@/stores/checkpointStore';
import { useNotificationStore } from '@/stores/notificationStore';
import CheckpointList from '@/components/checkpoints/CheckpointList';

export default function CheckpointsPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const addToast = useNotificationStore((s) => s.addToast);

  const {
    data: checkpointData,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['checkpoints', sessionId],
    queryFn: () => {
      if (!sessionId) throw new Error('No session ID');
      return pipelineApi.listCheckpoints(sessionId);
    },
    enabled: !!sessionId,
    staleTime: 15 * 1000,
  });

  // Sync to store
  const storeSetCheckpoints = useCheckpointStore((s) => s.setCheckpoints);
  useEffect(() => {
    if (checkpointData?.checkpoints) {
      storeSetCheckpoints(checkpointData.checkpoints);
    }
  }, [checkpointData, storeSetCheckpoints]);

  // Listen for real-time checkpoint creation (CHECKPOINT_CREATED SSE event)
  // The store is already updated by the event router; just refetch periodically
  useEffect(() => {
    if (!sessionId) return;
    const interval = setInterval(() => {
      refetch();
    }, 30000); // refetch every 30s to stay in sync
    return () => clearInterval(interval);
  }, [sessionId, refetch]);

  const handleRestore = useCallback(
    async (checkpointId: string) => {
      if (!sessionId) return;
      try {
        await pipelineApi.restoreCheckpoint(sessionId, {
          session_id: sessionId,
          checkpoint_id: checkpointId,
        });
        addToast({
          id: crypto.randomUUID(),
          type: 'success',
          title: 'Checkpoint Restored',
          message: `Successfully restored to ${checkpointId}`,
        });
        refetch();
      } catch (err) {
        console.error('Restore failed:', err);
        addToast({
          id: crypto.randomUUID(),
          type: 'error',
          title: 'Restore Failed',
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    },
    [sessionId, refetch, addToast]
  );

  if (!sessionId) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        No session selected
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="flex h-full flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Checkpoints</h1>
          <p className="text-xs text-slate-500 mt-0.5">Session: {sessionId}</p>
        </div>
        <div className="flex items-center gap-2">
          {isFetching && !isLoading && (
            <div className="flex items-center gap-2 text-xs text-blue-400">
              <HardDrive className="h-3 w-3 animate-pulse" />
              Refreshing...
            </div>
          )}
          <Button
            onClick={() => refetch()}
            variant="outline"
            size="sm"
            className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-slate-200"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="mx-auto max-w-5xl space-y-4">
          {/* Info bar */}
          <InfoBar
            count={checkpointData?.checkpoints?.length ?? 0}
            isLoading={isLoading}
          />

          {/* Checkpoint list */}
          <CheckpointList
            checkpoints={checkpointData?.checkpoints ?? []}
            isLoading={isLoading}
            onRestore={handleRestore}
          />
        </div>
      </div>
    </motion.div>
  );
}

// =============================================================================
// InfoBar — Checkpoint count and explanation
// =============================================================================

interface InfoBarProps {
  count: number;
  isLoading: boolean;
}

function InfoBar({ count, isLoading }: InfoBarProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <Skeleton className="h-4 w-full max-w-md bg-slate-800" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="rounded-lg border border-slate-800 bg-slate-900/60 p-4"
    >
      <div className="flex items-center gap-3">
        <Save className="h-5 w-5 text-blue-400" />
        <div>
          <p className="text-sm text-slate-300">
            <span className="font-medium">{count}</span> checkpoint{count !== 1 ? 's' : ''} available
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Checkpoints are created automatically at the end of each stage. Restoring a checkpoint
            will revert the pipeline state and mark post-checkpoint decisions as superseded.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
