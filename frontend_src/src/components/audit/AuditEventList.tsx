// =============================================================================
// AuditEventList — Grouped by stage (collapsible), expandable event rows
// Each event: timestamp, actor badge, action badge, target, before/after diff
// =============================================================================

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Clock, User, Bot, Eye, FileJson } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import type { AuditEvent, AuditActorType, StageName } from '@/types/domain';
import type { AuditTrailDTO } from '@/types/api';

interface AuditEventListProps {
  auditData: AuditTrailDTO | undefined;
  isLoading: boolean;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

function getActorIcon(actorType: AuditActorType) {
  switch (actorType) {
    case 'user':
      return <User className="h-3 w-3" />;
    case 'system':
    case 'system_authorized_by_user':
      return <Bot className="h-3 w-3" />;
    default:
      return <User className="h-3 w-3" />;
  }
}

function getActorBadgeColor(actorType: AuditActorType): string {
  switch (actorType) {
    case 'user':
      return 'bg-blue-600/20 text-blue-300 border-blue-600/30';
    case 'system':
      return 'bg-emerald-600/20 text-emerald-300 border-emerald-600/30';
    case 'system_authorized_by_user':
      return 'bg-purple-600/20 text-purple-300 border-purple-600/30';
    default:
      return 'bg-slate-600/20 text-slate-300 border-slate-600/30';
  }
}

function getActionBadgeColor(action: string): string {
  if (action.includes('ACCEPT') || action.includes('CONFIRM')) {
    return 'bg-emerald-600/20 text-emerald-300 border-emerald-600/30';
  }
  if (action.includes('MODIFY') || action.includes('REPLACE')) {
    return 'bg-amber-600/20 text-amber-300 border-amber-600/30';
  }
  if (action.includes('REVERT')) {
    return 'bg-rose-600/20 text-rose-300 border-rose-600/30';
  }
  if (action.includes('SKIP') || action.includes('DISMISS')) {
    return 'bg-slate-600/20 text-slate-300 border-slate-600/30';
  }
  return 'bg-blue-600/20 text-blue-300 border-blue-600/30';
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return ts;
  }
}

function formatDate(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return ts;
  }
}

interface GroupedEvents {
  stage: StageName | 'unknown';
  events: AuditEvent[];
}

function groupEventsByStage(events: AuditEvent[]): GroupedEvents[] {
  const map = new Map<StageName | 'unknown', AuditEvent[]>();
  for (const evt of events) {
    const stage = evt.target?.stage ?? 'unknown';
    const existing = map.get(stage) ?? [];
    existing.push(evt);
    map.set(stage, existing);
  }
  return Array.from(map.entries()).map(([stage, events]) => ({ stage, events }));
}

export default function AuditEventList({
  auditData,
  isLoading,
  page,
  pageSize,
  onPageChange,
}: AuditEventListProps) {
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [detailEvent, setDetailEvent] = useState<AuditEvent | null>(null);

  const events = auditData?.events ?? [];
  const total = auditData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const grouped = useMemo(() => groupEventsByStage(events), [events]);

  const toggleStage = (stage: string) => {
    setExpandedStages((prev) => {
      const next = new Set(prev);
      if (next.has(stage)) {
        next.delete(stage);
      } else {
        next.add(stage);
      }
      return next;
    });
  };

  const toggleEvent = (eventId: string) => {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  if (isLoading) {
    return <AuditEventListSkeleton />;
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-800 bg-slate-900/50 py-16">
        <FileJson className="mb-3 h-10 w-10 text-slate-600" />
        <p className="text-sm text-slate-400">No audit events found</p>
        <p className="text-xs text-slate-500 mt-1">
          Events will appear as the pipeline progresses
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stage groups */}
      <AnimatePresence>
        {grouped.map((group) => {
          const stageKey = group.stage;
          const isStageExpanded = expandedStages.has(stageKey);

          return (
            <motion.div
              key={stageKey}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="rounded-lg border border-slate-800 bg-slate-900/60 overflow-hidden"
            >
              {/* Stage header */}
              <button
                onClick={() => toggleStage(stageKey)}
                className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-slate-800/50 transition-colors"
              >
                {isStageExpanded ? (
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                )}
                <span className="text-sm font-medium capitalize text-slate-200">
                  {stageKey === 'unknown' ? 'Unknown Stage' : stageKey.replace(/_/g, ' ')}
                </span>
                <Badge
                  variant="outline"
                  className="ml-2 border-slate-700 bg-slate-800 text-slate-400 text-xs"
                >
                  {group.events.length}
                </Badge>
              </button>

              {/* Events within stage */}
              <AnimatePresence>
                {isStageExpanded && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="divide-y divide-slate-800/60">
                      {group.events.map((evt) => {
                        const isEventExpanded = expandedEvents.has(evt.event_id);
                        return (
                          <div
                            key={evt.event_id}
                            className="px-4 py-3 hover:bg-slate-800/30 transition-colors"
                          >
                            {/* Event row summary */}
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 flex flex-col items-center gap-0.5 min-w-[52px]">
                                <div className="flex items-center gap-1 text-xs text-slate-400">
                                  <Clock className="h-3 w-3" />
                                  {formatTimestamp(evt.timestamp)}
                                </div>
                                <span className="text-[10px] text-slate-500">
                                  {formatDate(evt.timestamp)}
                                </span>
                              </div>

                              <div className="flex flex-1 flex-wrap items-center gap-2">
                                {/* Actor badge */}
                                <Badge
                                  variant="outline"
                                  className={`gap-1 ${getActorBadgeColor(evt.actor.actor_type)}`}
                                >
                                  {getActorIcon(evt.actor.actor_type)}
                                  {evt.actor.actor_type}
                                </Badge>

                                {/* Action badge */}
                                <Badge
                                  variant="outline"
                                  className={`${getActionBadgeColor(evt.action)}`}
                                >
                                  {evt.action}
                                </Badge>

                                {/* Target */}
                                <span className="text-sm text-slate-300">
                                  {evt.target?.target_label ?? evt.target?.target_id ?? '—'}
                                </span>

                                {/* Expand / View Details buttons */}
                                <div className="ml-auto flex items-center gap-1">
                                  {(evt.before_state || evt.after_state) && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => toggleEvent(evt.event_id)}
                                      className="h-7 text-xs text-slate-400 hover:text-slate-200"
                                    >
                                      {isEventExpanded ? 'Hide Diff' : 'View Diff'}
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDetailEvent(evt)}
                                    className="h-7 text-xs text-slate-400 hover:text-slate-200"
                                  >
                                    <Eye className="mr-1 h-3 w-3" />
                                    Details
                                  </Button>
                                </div>
                              </div>
                            </div>

                            {/* Expanded diff view */}
                            <AnimatePresence>
                              {isEventExpanded && (evt.before_state || evt.after_state) && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <div className="mt-3 grid grid-cols-1 gap-3 rounded-md bg-slate-950 p-3 lg:grid-cols-2">
                                    {evt.before_state && (
                                      <div>
                                        <div className="mb-1 text-xs font-medium text-rose-400">
                                          Before
                                        </div>
                                        <pre className="max-h-48 overflow-auto rounded bg-slate-900 p-2 text-xs text-slate-300">
                                          {JSON.stringify(evt.before_state, null, 2)}
                                        </pre>
                                      </div>
                                    )}
                                    {evt.after_state && (
                                      <div>
                                        <div className="mb-1 text-xs font-medium text-emerald-400">
                                          After
                                        </div>
                                        <pre className="max-h-48 overflow-auto rounded bg-slate-900 p-2 text-xs text-slate-300">
                                          {JSON.stringify(evt.after_state, null, 2)}
                                        </pre>
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            Prev
          </Button>
          {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
            let pageNum: number;
            if (totalPages <= 7) {
              pageNum = i + 1;
            } else if (page <= 4) {
              pageNum = i + 1;
            } else if (page >= totalPages - 3) {
              pageNum = totalPages - 6 + i;
            } else {
              pageNum = page - 3 + i;
            }
            const isActive = pageNum === page;
            return (
              <Button
                key={pageNum}
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                onClick={() => onPageChange(pageNum)}
                className={
                  isActive
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                }
              >
                {pageNum}
              </Button>
            );
          })}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            Next
          </Button>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailEvent !== null} onOpenChange={() => setDetailEvent(null)}>
        <DialogContent className="max-w-2xl bg-slate-900 border-slate-700 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Audit Event Details</DialogTitle>
          </DialogHeader>
          {detailEvent && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-slate-500">Event ID</span>
                  <p className="text-slate-200 break-all">{detailEvent.event_id}</p>
                </div>
                <div>
                  <span className="text-slate-500">Timestamp</span>
                  <p className="text-slate-200">{detailEvent.timestamp}</p>
                </div>
                <div>
                  <span className="text-slate-500">Action</span>
                  <p className="text-slate-200">{detailEvent.action}</p>
                </div>
                <div>
                  <span className="text-slate-500">Actor</span>
                  <p className="text-slate-200">
                    {detailEvent.actor.actor_type} ({detailEvent.actor.user_id})
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Target</span>
                  <p className="text-slate-200">
                    {detailEvent.target?.target_label ?? detailEvent.target?.target_id} (
                    {detailEvent.target?.target_type})
                  </p>
                </div>
                {detailEvent.authorization_ref && (
                  <div>
                    <span className="text-slate-500">Authorization</span>
                    <p className="text-slate-200">{detailEvent.authorization_ref}</p>
                  </div>
                )}
              </div>
              {detailEvent.before_state && (
                <div>
                  <span className="text-sm text-slate-500">Before State</span>
                  <pre className="mt-1 max-h-60 overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-300">
                    {JSON.stringify(detailEvent.before_state, null, 2)}
                  </pre>
                </div>
              )}
              {detailEvent.after_state && (
                <div>
                  <span className="text-sm text-slate-500">After State</span>
                  <pre className="mt-1 max-h-60 overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-300">
                    {JSON.stringify(detailEvent.after_state, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AuditEventListSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }, (_, gi) => (
        <div key={gi} className="rounded-lg border border-slate-800 bg-slate-900/60 overflow-hidden">
          <div className="px-4 py-3">
            <Skeleton className="h-5 w-40 bg-slate-800" />
          </div>
          <div className="divide-y divide-slate-800/60 px-4">
            {Array.from({ length: 3 }, (_, ei) => (
              <div key={ei} className="py-3 flex items-center gap-3">
                <Skeleton className="h-4 w-14 bg-slate-800" />
                <Skeleton className="h-5 w-16 rounded-full bg-slate-800" />
                <Skeleton className="h-5 w-20 rounded-full bg-slate-800" />
                <Skeleton className="h-4 w-32 bg-slate-800" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
