// =============================================================================
// DecisionChain — Chronological list of DecisionEntry cards
// Status indicators, revision chain links, action buttons per entry
// =============================================================================

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Circle,
  CircleDot,
  XCircle,
  ChevronDown,
  ChevronRight,
  User,
  Bot,
  RotateCcw,
  Pencil,
  Eye,
  GitCommit,
  FileText,
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
import type { DecisionEntry, DecisionStatus, StageName, DecisionMaker } from '@/types/domain';

interface DecisionChainProps {
  entries: DecisionEntry[];
  isLoading: boolean;
  sessionId: string;
  onRevert?: (decisionId: string) => void;
  onRevise?: (decisionId: string) => void;
}

function getStatusIcon(status: DecisionStatus) {
  switch (status) {
    case 'active':
      return <CircleDot className="h-4 w-4 text-emerald-400" />;
    case 'superseded':
      return <Circle className="h-4 w-4 text-amber-400" />;
    case 'cancelled':
      return <XCircle className="h-4 w-4 text-rose-400" />;
    default:
      return <Circle className="h-4 w-4 text-slate-400" />;
  }
}

function getStatusBadgeColor(status: DecisionStatus): string {
  switch (status) {
    case 'active':
      return 'bg-emerald-600/20 text-emerald-300 border-emerald-600/30';
    case 'superseded':
      return 'bg-amber-600/20 text-amber-300 border-amber-600/30';
    case 'cancelled':
      return 'bg-rose-600/20 text-rose-300 border-rose-600/30';
    default:
      return 'bg-slate-600/20 text-slate-300 border-slate-600/30';
  }
}

function getDecisionMakerIcon(maker: DecisionMaker) {
  return maker === 'user' ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />;
}

function getDecisionMakerBadge(maker: DecisionMaker): string {
  return maker === 'user'
    ? 'bg-blue-600/20 text-blue-300 border-blue-600/30'
    : 'bg-purple-600/20 text-purple-300 border-purple-600/30';
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

function formatStage(stage: StageName): string {
  return stage.replace(/_/g, ' ');
}

export default function DecisionChain({
  entries,
  isLoading,
  sessionId,
  onRevert,
  onRevise,
}: DecisionChainProps) {
  const navigate = useNavigate();
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [revertTarget, setRevertTarget] = useState<string | null>(null);

  const toggleEntry = (id: string) => {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleViewAudit = (_decisionId: string) => {
    navigate(`/pipeline/${sessionId}/audit`);
  };

  if (isLoading) {
    return <DecisionChainSkeleton />;
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-800 bg-slate-900/50 py-16">
        <FileText className="mb-3 h-10 w-10 text-slate-600" />
        <p className="text-sm text-slate-400">No decisions found</p>
        <p className="text-xs text-slate-500 mt-1">
          Decisions are logged as you steer the pipeline
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <AnimatePresence>
        {entries.map((entry, index) => {
          const isExpanded = expandedEntries.has(entry.decision_id);
          const isActive = entry.status === 'active';
          const isUserDecision = entry.decision_maker === 'user';
          const isSuperseded = entry.status === 'superseded';

          return (
            <motion.div
              key={entry.decision_id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ delay: index * 0.03, duration: 0.2 }}
              className="rounded-lg border border-slate-800 bg-slate-900/60 overflow-hidden"
            >
              {/* Header row */}
              <button
                onClick={() => toggleEntry(entry.decision_id)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-800/40 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                ) : (
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                )}

                {/* Status icon */}
                <div className="mt-0.5 shrink-0">{getStatusIcon(entry.status)}</div>

                <div className="flex flex-1 flex-col gap-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-slate-200">
                      {entry.decision_id}
                    </span>
                    <Badge variant="outline" className={getStatusBadgeColor(entry.status)}>
                      {entry.status.toUpperCase()}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="border-slate-700 bg-slate-800 text-slate-400 capitalize text-xs"
                    >
                      {formatStage(entry.stage)}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`${getDecisionMakerBadge(entry.decision_maker)}`}
                    >
                      {getDecisionMakerIcon(entry.decision_maker)}
                      {entry.decision_maker}
                    </Badge>
                  </div>

                  <div className="text-sm text-slate-300 truncate">
                    {entry.decision_point}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>Choice: {entry.chosen_option?.label ?? '—'}</span>
                    <span>|</span>
                    <span>{formatTimestamp(entry.timestamp)}</span>
                  </div>
                </div>
              </button>

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
                    <div className="border-t border-slate-800/60 px-4 py-3 space-y-3">
                      {/* Chosen option details */}
                      {entry.chosen_option && (
                        <div className="rounded-md bg-slate-800/50 p-3 space-y-2">
                          <div className="text-xs font-medium text-slate-400">Chosen Option</div>
                          <div className="text-sm text-slate-200">
                            {entry.chosen_option.label}
                          </div>
                          {entry.chosen_option.description && (
                            <div className="text-xs text-slate-400">
                              {entry.chosen_option.description}
                            </div>
                          )}
                          {entry.chosen_option.rationale && (
                            <div className="text-xs text-slate-500">
                              <span className="text-slate-400">Rationale:</span>{' '}
                              {entry.chosen_option.rationale}
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className="border-slate-700 bg-slate-800 text-slate-400 text-xs capitalize"
                            >
                              Confidence: {entry.chosen_option.confidence}
                            </Badge>
                            {entry.chosen_option.rank && (
                              <Badge
                                variant="outline"
                                className="border-slate-700 bg-slate-800 text-slate-400 text-xs"
                              >
                                Rank: #{entry.chosen_option.rank}
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Revision chain */}
                      {entry.revision_chain && entry.revision_chain.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-slate-400">Revision Chain</div>
                          <div className="flex flex-wrap items-center gap-1">
                            {entry.revision_chain.map((chainId) => (
                              <div key={chainId} className="flex items-center gap-1">
                                <GitCommit className="h-3 w-3 text-slate-500" />
                                <span
                                  className={`text-xs ${
                                    chainId === entry.decision_id
                                      ? 'text-blue-400 font-medium'
                                      : 'text-slate-500'
                                  }`}
                                >
                                  {chainId}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Superseded by */}
                      {isSuperseded && entry.superseded_by && (
                        <div className="text-xs text-amber-400">
                          Superseded by:{" "}
                          <button
                            onClick={() => toggleEntry(entry.superseded_by!)}
                            className="underline hover:text-amber-300"
                          >
                            {entry.superseded_by}
                          </button>
                        </div>
                      )}

                      {/* Authorization scope */}
                      {entry.authorization_scope && (
                        <div className="text-xs text-slate-500">
                          <span className="text-slate-400">Authorization scope:</span>{' '}
                          {entry.authorization_scope.scope_type}
                          {entry.authorization_scope.stage_range
                            ? ` (${entry.authorization_scope.stage_range.join(', ')})`
                            : ''}
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 pt-1">
                        {isActive && onRevise && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onRevise(entry.decision_id)}
                            className="h-7 border-blue-600/30 text-blue-300 hover:bg-blue-600/10 text-xs"
                          >
                            <Pencil className="mr-1 h-3 w-3" />
                            Revise
                          </Button>
                        )}
                        {isActive && isUserDecision && onRevert && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setRevertTarget(entry.decision_id)}
                            className="h-7 border-rose-600/30 text-rose-300 hover:bg-rose-600/10 text-xs"
                          >
                            <RotateCcw className="mr-1 h-3 w-3" />
                            Revert
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewAudit(entry.decision_id)}
                          className="h-7 text-xs text-slate-400 hover:text-slate-200"
                        >
                          <Eye className="mr-1 h-3 w-3" />
                          View Audit
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Revert confirmation dialog */}
      <Dialog open={revertTarget !== null} onOpenChange={() => setRevertTarget(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Confirm Revert</DialogTitle>
            <DialogDescription className="text-slate-400">
              This will revert decision <code className="text-slate-300">{revertTarget}</code>.
              A new decision entry will be created and this one will be marked as superseded.
              Downstream stages may need to be re-run.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setRevertTarget(null)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (revertTarget && onRevert) onRevert(revertTarget);
                setRevertTarget(null);
              }}
              className="bg-rose-600 hover:bg-rose-700"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Confirm Revert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DecisionChainSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 space-y-3"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-4 rounded-full bg-slate-800" />
            <Skeleton className="h-4 w-24 bg-slate-800" />
            <Skeleton className="h-5 w-16 rounded-full bg-slate-800" />
            <Skeleton className="h-5 w-20 rounded-full bg-slate-800" />
          </div>
          <Skeleton className="h-4 w-3/4 bg-slate-800" />
          <Skeleton className="h-3 w-1/2 bg-slate-800" />
        </div>
      ))}
    </div>
  );
}
