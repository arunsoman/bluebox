// =============================================================================
// StreamingView — Shows incoming StreamChunks while stage is running
// Live-updating list of chunks as they arrive
// "Interrupt" button requests chunk-boundary pause
// =============================================================================

import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pause, Loader2 } from 'lucide-react';
import { useStreamingStore } from '@/stores/streamingStore';
import { pipelineApi } from '@/lib/api';

interface StreamingViewProps {
  sessionId: string;
}

export default function StreamingView({ sessionId }: StreamingViewProps) {
  const chunks = useStreamingStore((s) => s.chunks);
  const isStreaming = useStreamingStore((s) => s.isStreaming);
  const interruptRequested = useStreamingStore((s) => s.interruptRequested);
  const requestInterrupt = useStreamingStore((s) => s.requestInterrupt);
  const clearInterrupt = useStreamingStore((s) => s.clearInterrupt);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chunks.length]);

  const handleInterrupt = async () => {
    requestInterrupt();
    try {
      await pipelineApi.steer(sessionId, {
        session_id: sessionId,
        action_type: 'ASK_ME',
        stage: 'task_decomposition',
        payload: { request_interrupt: true },
        timestamp: new Date().toISOString(),
      });
    } catch {
      clearInterrupt();
    }
  };

  if (!isStreaming && chunks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-slate-500" />
          <p className="mt-3 text-sm text-slate-400">Stage is starting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
          <span className="text-sm font-medium text-slate-200">Processing</span>
          <span className="text-xs text-slate-500">({chunks.length} chunks received)</span>
        </div>
        <button
          onClick={handleInterrupt}
          disabled={interruptRequested}
          className="flex items-center gap-1.5 rounded-md border border-amber-600 bg-amber-900/40 px-3 py-1.5 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-900/60 disabled:opacity-50"
        >
          <Pause className="h-3 w-3" />
          {interruptRequested ? 'Interrupting...' : 'Interrupt'}
        </button>
      </div>

      {/* Chunks list */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-1 px-4 py-3"
      >
        <AnimatePresence initial={false}>
          {chunks.map((chunk, idx) => (
            <motion.div
              key={chunk.chunk_id ?? idx}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.15 }}
              className="rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-slate-600">#{idx + 1}</span>
                <span className={
                  chunk.chunk_type === 'error'
                    ? 'text-xs text-red-400'
                    : chunk.chunk_type === 'structured'
                      ? 'text-xs text-blue-300'
                      : 'text-xs text-slate-300'
                }>
                  {chunk.content}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isStreaming && (
          <div className="flex items-center gap-2 px-3 py-2">
            <Loader2 className="h-3 w-3 animate-spin text-slate-500" />
            <span className="text-xs text-slate-500">Waiting for next chunk...</span>
          </div>
        )}
      </div>
    </div>
  );
}
