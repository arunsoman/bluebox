// =============================================================================
// PipelinePage — Main pipeline workspace
// Reads sessionId from URL params
// Connects SSE on mount: sseManager.connect(sessionId)
// Mounts useEventRouter() hook
// Shows different content based on pipelineStore.currentStage and pipelineStore.pipelineStatus
// Includes <SteeringToolbar /> when in steering mode
// Includes <StageContent /> which switches on stage
// =============================================================================

import { useParams } from 'react-router';
import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle, AlertTriangle, RefreshCw, ArrowRight,
  Download
} from 'lucide-react';
import { Link } from 'react-router';
import { usePipelineStore } from '@/stores/pipelineStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { useEventRouter } from '@/hooks/useEventRouter';
import { sseManager } from '@/lib/sse';
import { pipelineApi } from '@/lib/api';
import SteeringToolbar from '@/components/pipeline/SteeringToolbar';
import StageContent from '@/components/pipeline/StageContent';
import StreamingView from '@/components/shared/StreamingView';
import OptionsPanel from '@/components/pipeline/OptionsPanel';

export default function PipelinePage() {
  const { sessionId } = useParams<{ sessionId: string }>();

  const pipelineStatus = usePipelineStore((s) => s.pipelineStatus);
  const currentStage = usePipelineStore((s) => s.currentStage);
  const setSession = usePipelineStore((s) => s.setSession);
  const toasts = useNotificationStore((s) => s.toasts);
  const removeToast = useNotificationStore((s) => s.removeToast);

  // Connect SSE
  useEffect(() => {
    if (sessionId) {
      sseManager.connect(sessionId);
      // Sync session ID in store
      setSession({
        session_id: sessionId,
        project_id: '',
        user_id: '',
        current_stage: currentStage,
        status: pipelineStatus,
        richness_mode: null,
      });
    }
    return () => {
      // Keep connection alive on re-renders; only disconnect on unmount
    };
  }, [sessionId]);

  // Route all SSE events to stores
  useEventRouter(sessionId ?? null);

  if (!sessionId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-red-400">No session ID provided.</p>
      </div>
    );
  }

  const isSteeringMode = pipelineStatus === 'paused' && currentStage !== null;
  const isRunning = pipelineStatus === 'running';
  const isCompleted = pipelineStatus === 'completed';
  const isFailed = pipelineStatus === 'failed';

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Toast notifications */}
      <div className="absolute right-4 top-14 z-50 flex w-80 flex-col gap-2">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              className={`rounded-lg border px-4 py-3 shadow-lg ${
                toast.type === 'error'
                  ? 'border-red-700 bg-red-900/90 text-red-100'
                  : toast.type === 'success'
                    ? 'border-emerald-700 bg-emerald-900/90 text-emerald-100'
                    : toast.type === 'warning'
                      ? 'border-amber-700 bg-amber-900/90 text-amber-100'
                      : 'border-blue-700 bg-blue-900/90 text-blue-100'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold">{toast.title}</p>
                  <p className="mt-0.5 text-xs opacity-90">{toast.message}</p>
                </div>
                <button
                  onClick={() => removeToast(toast.id)}
                  className="text-xs opacity-60 hover:opacity-100"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Steering Toolbar */}
      {isSteeringMode && <SteeringToolbar />}

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Stage content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <AnimatePresence mode="wait">
            {isRunning && (
              <motion.div
                key="streaming"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full"
              >
                <StreamingView sessionId={sessionId} />
              </motion.div>
            )}

            {isSteeringMode && (
              <motion.div
                key="steering"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full overflow-hidden"
              >
                <StageContent />
              </motion.div>
            )}

            {(pipelineStatus === 'idle' || (!currentStage && !isRunning && !isCompleted && !isFailed)) && (
              <motion.div
                key="input"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full overflow-hidden"
              >
                <StageContent />
              </motion.div>
            )}

            {isCompleted && (
              <motion.div
                key="completed"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex h-full items-center justify-center"
              >
                <CompletionView sessionId={sessionId} />
              </motion.div>
            )}

            {isFailed && (
              <motion.div
                key="failed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex h-full items-center justify-center"
              >
                <FailureView sessionId={sessionId} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right options panel in steering mode */}
        {isSteeringMode && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="w-[340px] overflow-y-auto border-l border-slate-700 bg-slate-900/80 p-4"
          >
            <OptionsPanel />
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ── Completion view ──────────────────────────────────────────────────────────

function CompletionView({ sessionId }: { sessionId: string }) {
  return (
    <div className="text-center">
      <CheckCircle className="mx-auto h-16 w-16 text-emerald-400" />
      <h2 className="mt-4 text-2xl font-bold text-white">Pipeline Complete</h2>
      <p className="mt-2 text-sm text-slate-400">
        All stages have been completed and confirmed successfully.
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <Link
          to={`/pipeline/${sessionId}/export`}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
        >
          <Download className="h-4 w-4" />
          View Export
        </Link>
        <Link
          to="/"
          className="rounded-lg border border-slate-600 bg-slate-800 px-5 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

// ── Failure view ─────────────────────────────────────────────────────────────

function FailureView({ sessionId }: { sessionId: string }) {
  const setStatus = usePipelineStore((s) => s.setStatus);

  const handleRetry = async () => {
    try {
      await pipelineApi.resume(sessionId);
      setStatus('running');
    } catch {
      // Error handled silently
    }
  };

  return (
    <div className="text-center">
      <AlertTriangle className="mx-auto h-16 w-16 text-red-400" />
      <h2 className="mt-4 text-2xl font-bold text-white">Pipeline Failed</h2>
      <p className="mt-2 text-sm text-slate-400">
        A stage encountered an error. You can retry or go back to the dashboard.
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <button
          onClick={handleRetry}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
        <Link
          to="/"
          className="flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-5 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700"
        >
          <ArrowRight className="h-4 w-4" />
          Dashboard
        </Link>
      </div>
    </div>
  );
}
