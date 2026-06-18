// =============================================================================
// MiniAuditTrail — Embedded in RightSidebar, shows last 5 audit events
// Compact list: timestamp + action abbreviation
// Real-time updates via SSE (AUDIT_EVENT_WRITTEN)
// =============================================================================

import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowRight, Clock, User, Bot } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useAuditStore } from '@/stores/auditStore';
import type { AuditEvent } from '@/types/domain';

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatAction(action: string): string {
  // Truncate long actions for compact view
  if (action.length > 28) return action.slice(0, 25) + '...';
  return action;
}

function ActorIcon({ actorType }: { actorType: string }) {
  if (actorType === 'user') return <User className="h-3 w-3 text-blue-400" />;
  return <Bot className="h-3 w-3 text-emerald-400" />;
}

function AuditEventRow({ event }: { event: AuditEvent }) {
  return (
    <div className="group flex items-start gap-2 rounded px-2 py-1.5 transition-colors hover:bg-slate-800/60">
      <div className="mt-0.5 shrink-0">
        <ActorIcon actorType={event.actor.actor_type} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-slate-300">
          {formatAction(event.action)}
        </p>
        <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-500">
          <Clock className="h-2.5 w-2.5" />
          <span>{formatTime(event.timestamp)}</span>
          <span className="text-slate-700">|</span>
          <span className="truncate">{event.target.target_label}</span>
        </div>
      </div>
    </div>
  );
}

export default function MiniAuditTrail() {
  const events = useAuditStore((s) => s.events);
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();

  const lastFive = useMemo(() => events.slice(0, 5), [events]);

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1">
        <div className="space-y-0.5">
          {lastFive.length === 0 ? (
            <div className="px-2 py-4 text-center">
              <p className="text-xs text-slate-600">No events yet</p>
              <p className="mt-0.5 text-[10px] text-slate-700">
                Events appear as pipeline runs
              </p>
            </div>
          ) : (
            lastFive.map((event) => (
              <AuditEventRow key={event.event_id} event={event} />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Navigate to full audit */}
      {sessionId && (
        <div className="border-t border-slate-800 p-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-full justify-between gap-1 text-[10px] text-slate-500 hover:text-slate-300"
            onClick={() => navigate(`/pipeline/${sessionId}/audit`)}
          >
            View Full Audit
            <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
