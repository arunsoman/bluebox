// =============================================================================
// CheckpointList — Grid/list of checkpoint cards with restore confirmation
// =============================================================================

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HardDrive,
  GitCommit,
  Clock,
  Boxes,
  GitPullRequest,
  RotateCcw,
  AlertTriangle,
  X,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import type { Checkpoint, StageName } from '@/types/domain';

interface CheckpointListProps {
  checkpoints: Checkpoint[];
  isLoading: boolean;
  onRestore: (checkpointId: string) => void;
}

function formatStage(stage: StageName): string {
  return stage.replace(/_/g, ' ');
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return ts;
  }
}

export default function CheckpointList({
  checkpoints,
  isLoading,
  onRestore,
}: CheckpointListProps) {
  const [restoreTarget, setRestoreTarget] = useState<Checkpoint | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (isLoading) {
    return <CheckpointListSkeleton />;
  }

  if (checkpoints.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-800 bg-slate-900/50 py-16">
        <HardDrive className="mb-3 h-10 w-10 text-slate-600" />
        <p className="text-sm text-slate-400">No checkpoints found</p>
        <p className="text-xs text-slate-500 mt-1">
          Checkpoints are created automatically as stages complete
        </p>
      </div>
    );
  }

  // Sort by created_at ascending (oldest first), latest is current state
  const sorted = [...checkpoints].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const latestCheckpointId = sorted[sorted.length - 1]?.checkpoint_id;

  return (
    <div className="space-y-3">
      <AnimatePresence>
        {sorted.map((cp, index) => {
          const isLatest = cp.checkpoint_id === latestCheckpointId;
          const isExpanded = expandedIds.has(cp.checkpoint_id);

          return (
            <motion.div
              key={cp.checkpoint_id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ delay: index * 0.05, duration: 0.2 }}
              className={`rounded-lg border ${
                isLatest
                  ? 'border-blue-700/40 bg-blue-900/10'
                  : 'border-slate-800 bg-slate-900/60'
              } overflow-hidden`}
            >
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Checkpoint icon */}
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    isLatest ? 'bg-blue-600/20' : 'bg-slate-800'
                  }`}
                >
                  <GitCommit
                    className={`h-4 w-4 ${isLatest ? 'text-blue-400' : 'text-slate-400'}`}
                  />
                </div>

                {/* Info */}
                <div className="flex flex-1 flex-col min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-slate-200">
                      {cp.checkpoint_id}
                    </span>
                    {isLatest && (
                      <Badge
                        variant="outline"
                        className="border-blue-600/40 bg-blue-600/15 text-blue-300 text-xs"
                      >
                        CURRENT STATE
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className="border-slate-700 bg-slate-800 text-slate-400 capitalize text-xs"
                    >
                      {formatStage(cp.stage_completed)}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-0.5">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTimestamp(cp.created_at)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Boxes className="h-3 w-3" />
                      {cp.node_count} nodes
                    </span>
                    <span className="flex items-center gap-1">
                      <GitPullRequest className="h-3 w-3" />
                      {cp.decision_count} decisions
                    </span>
                  </div>
                </div>

                {/* Label + actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="hidden sm:block text-xs text-slate-400 max-w-[140px] truncate">
                    {cp.label}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleExpanded(cp.checkpoint_id)}
                    className="h-7 w-7 p-0 text-slate-400 hover:text-slate-200"
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                  {!isLatest && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRestoreTarget(cp)}
                      className="h-7 border-amber-600/30 text-amber-300 hover:bg-amber-600/10 text-xs"
                    >
                      <RotateCcw className="mr-1 h-3 w-3" />
                      Restore
                    </Button>
                  )}
                </div>
              </div>

              {/* Expanded details */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-slate-800/60 px-4 py-3 space-y-2 text-xs text-slate-400">
                      <div>
                        <span className="text-slate-500">Label:</span>{' '}
                        <span className="text-slate-300">{cp.label}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Stage completed:</span>{' '}
                        <span className="capitalize text-slate-300">
                          {formatStage(cp.stage_completed)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-slate-500">Nodes:</span>{' '}
                          <span className="text-slate-300">{cp.node_count}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Decisions:</span>{' '}
                          <span className="text-slate-300">{cp.decision_count}</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-500">Created:</span>{' '}
                        <span className="text-slate-300">{cp.created_at}</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Restore confirmation dialog */}
      <Dialog open={restoreTarget !== null} onOpenChange={() => setRestoreTarget(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-300">
              <AlertTriangle className="h-5 w-5" />
              Restore Checkpoint
            </DialogTitle>
            <DialogDescription className="text-slate-400 space-y-2">
              <p>
                Restoring to{' '}
                <code className="text-slate-300">{restoreTarget?.checkpoint_id}</code>{' '}
                will discard all progress after{' '}
                <span className="text-slate-300">
                  {restoreTarget ? formatTimestamp(restoreTarget.created_at) : ''}
                </span>
                .
              </p>
              <p>Post-checkpoint decisions will be marked as superseded.</p>
              <p className="text-amber-400">This action cannot be undone.</p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setRestoreTarget(null)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              <X className="mr-1.5 h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (restoreTarget) onRestore(restoreTarget.checkpoint_id);
                setRestoreTarget(null);
              }}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              <Check className="mr-1.5 h-3.5 w-3.5" />
              Confirm Restore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CheckpointListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          className="rounded-lg border border-slate-800 bg-slate-900/60 p-4"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full bg-slate-800" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-28 bg-slate-800" />
                <Skeleton className="h-5 w-16 rounded-full bg-slate-800" />
              </div>
              <Skeleton className="h-3 w-48 bg-slate-800" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
