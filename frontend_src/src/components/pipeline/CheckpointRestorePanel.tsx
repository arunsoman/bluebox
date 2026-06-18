// =============================================================================
// CheckpointRestorePanel — Shows when LLM failure occurs with checkpoint
// restore option. Lists available checkpoints with selection, warning, and
// confirm/cancel. Per UI Architecture §6.12.
// =============================================================================

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Checkpoint } from '@/types/domain';
import { useCheckpointStore } from '@/stores/checkpointStore';
import { usePipelineStore } from '@/stores/pipelineStore';
import { pipelineApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Save, RotateCcw, AlertTriangle, Clock, GitCommit, CheckCircle, Database, ChevronDown, ChevronUp
} from 'lucide-react';

function CheckpointCard({
  checkpoint,
  isSelected,
  onSelect,
  isCurrent,
}: {
  checkpoint: Checkpoint;
  isSelected: boolean;
  onSelect: () => void;
  isCurrent: boolean;
}) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <motion.div
      layout
      onClick={onSelect}
      className={`cursor-pointer rounded-lg border p-3 transition-all ${
        isSelected
          ? 'border-blue-400 bg-blue-50 shadow-sm dark:border-blue-500 dark:bg-blue-900/20'
          : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Save className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {checkpoint.label}
          </span>
          {isCurrent && (
            <Badge variant="outline" className="text-[10px] text-blue-600">
              CURRENT
            </Badge>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowDetails(!showDetails);
          }}
          className="text-slate-400 hover:text-slate-600"
        >
          {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>
      <div className="mt-1 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1">
          <GitCommit className="h-3 w-3" />
          {checkpoint.checkpoint_id}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {new Date(checkpoint.created_at).toLocaleTimeString()}
        </span>
        <span className="flex items-center gap-1 capitalize">
          <Database className="h-3 w-3" />
          {checkpoint.stage_completed.replace('_', ' ')}
        </span>
      </div>
      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-2 overflow-hidden"
          >
            <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
              <span>{checkpoint.node_count} nodes</span>
              <span>{checkpoint.decision_count} decisions</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function CheckpointRestorePanel() {
  const sessionId = usePipelineStore((s) => s.sessionId);
  const checkpoints = useCheckpointStore((s) => s.checkpoints);
  const selectedCheckpointId = useCheckpointStore((s) => s.selectedCheckpointId);
  const selectCheckpoint = useCheckpointStore((s) => s.selectCheckpoint);

  const [isRestoring, setIsRestoring] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const selectedCheckpoint = checkpoints.find((c) => c.checkpoint_id === selectedCheckpointId);

  const handleRestore = useCallback(async () => {
    if (!sessionId || !selectedCheckpointId) return;
    setIsRestoring(true);
    try {
      await pipelineApi.restoreCheckpoint(sessionId, {
        session_id: sessionId,
        checkpoint_id: selectedCheckpointId,
      });
      selectCheckpoint(null);
    } finally {
      setIsRestoring(false);
    }
  }, [sessionId, selectedCheckpointId, selectCheckpoint]);

  if (!checkpoints || checkpoints.length === 0) {
    return (
      <Card className="border-dashed border-slate-300 dark:border-slate-600">
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center text-sm text-slate-500 dark:text-slate-400">
            <Save className="mx-auto mb-2 h-8 w-8 text-slate-300" />
            No checkpoints available.
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentCheckpoint = [...checkpoints].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
    >
      <Card>
        <CardHeader>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex w-full items-center justify-between text-left"
          >
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <RotateCcw className="h-5 w-5 text-blue-500" />
              Restore Checkpoint
            </CardTitle>
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-slate-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-slate-400" />
            )}
          </button>
        </CardHeader>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
            >
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {checkpoints.map((cp) => (
                    <CheckpointCard
                      key={cp.checkpoint_id}
                      checkpoint={cp}
                      isSelected={selectedCheckpointId === cp.checkpoint_id}
                      onSelect={() => selectCheckpoint(cp.checkpoint_id)}
                      isCurrent={cp.checkpoint_id === currentCheckpoint?.checkpoint_id}
                    />
                  ))}
                </div>

                <AnimatePresence>
                  {selectedCheckpoint && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      <Separator />
                      <div className="flex items-start gap-3 rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                        <div className="text-sm text-amber-800 dark:text-amber-300">
                          <p className="font-semibold">Restore Warning</p>
                          <p className="mt-1">
                            Restoring to &quot;{selectedCheckpoint.label}&quot; will discard all
                            progress after {new Date(selectedCheckpoint.created_at).toLocaleString()}.
                            Post-checkpoint decisions will be marked as superseded. This action
                            cannot be undone.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-3">
                        <Button
                          variant="outline"
                          onClick={() => selectCheckpoint(null)}
                          className="min-w-[100px]"
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="default"
                          onClick={handleRestore}
                          disabled={isRestoring || !sessionId}
                          className="min-w-[140px]"
                        >
                          {isRestoring ? (
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                              className="mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"
                            />
                          ) : (
                            <CheckCircle className="mr-2 h-4 w-4" />
                          )}
                          Confirm Restore
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

export default CheckpointRestorePanel;
