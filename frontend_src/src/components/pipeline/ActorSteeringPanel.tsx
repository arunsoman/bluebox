// =============================================================================
// ActorSteeringPanel — Actor cards grouped by ActorClass (human, system, service, external)
// Each card: name, type, description, traceability badge, permissions_hint, data_access_hint
// RBACActorHint preview per actor
// Expandable detail view
// =============================================================================

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { User, Bot, Cable, Globe, Shield, Lock } from 'lucide-react';
import { useSteeringStore } from '@/stores/steeringStore';
import NodeCard from '@/components/shared/NodeCard';
import type { Actor, ActorDiscoveryResult, RBACActorHint, ActorClass } from '@/types/domain';

const actorClassConfig: Record<ActorClass, { icon: React.ReactNode; color: string; label: string }> = {
  human: { icon: <User className="h-4 w-4" />, color: 'bg-blue-900/60 text-blue-300 border-blue-700', label: 'Human' },
  system: { icon: <Bot className="h-4 w-4" />, color: 'bg-purple-900/60 text-purple-300 border-purple-700', label: 'System' },
  service: { icon: <Cable className="h-4 w-4" />, color: 'bg-emerald-900/60 text-emerald-300 border-emerald-700', label: 'Service' },
  external: { icon: <Globe className="h-4 w-4" />, color: 'bg-orange-900/60 text-orange-300 border-orange-700', label: 'External' },
};

export default function ActorSteeringPanel() {
  const draftOutput = useSteeringStore((s) => s.draftOutput);

  const result: ActorDiscoveryResult | null = useMemo(() => {
    if (!draftOutput) return null;
    return (draftOutput as { actor_result?: ActorDiscoveryResult }).actor_result ?? null;
  }, [draftOutput]);

  if (!result) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-slate-500">Waiting for actor discovery...</p>
      </div>
    );
  }

  const { actors, rbac_hints } = result;

  // Group actors by class
  const grouped = useMemo(() => {
    const groups: Record<ActorClass, Actor[]> = { human: [], system: [], service: [], external: [] };
    for (const actor of actors) {
      groups[actor.actor_class]?.push(actor);
    }
    return groups;
  }, [actors]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto space-y-6 p-4">
        {(Object.entries(grouped) as [ActorClass, Actor[]][]).map(
          ([actorClass, classActors]) =>
            classActors.length > 0 && (
              <motion.div
                key={actorClass}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
                  {actorClassConfig[actorClass].icon}
                  {actorClassConfig[actorClass].label} Actors ({classActors.length})
                </h3>
                <div className="space-y-2">
                  {classActors.map((a) => (
                    <ActorCard
                      key={a.actor_id}
                      actor={a}
                      rbacHint={rbac_hints.find((h) => h.actor_id === a.actor_id)}
                    />
                  ))}
                </div>
              </motion.div>
            )
        )}
      </div>
    </div>
  );
}

function ActorCard({
  actor,
  rbacHint,
}: {
  actor: Actor;
  rbacHint?: RBACActorHint;
}) {
  const config = actorClassConfig[actor.actor_class];

  return (
    <NodeCard
      id={actor.actor_id}
      title={actor.name}
      subtitle={actor.description?.slice(0, 120)}
      type={config.label}
      typeColor={config.color}
      traceability={actor.traceability}
      confidence={actor.confidence}
      icon={config.icon}
    >
      <div className="mt-3 space-y-3">
        {/* Description */}
        <p className="text-xs text-slate-400">{actor.description}</p>

        {/* Source */}
        {actor.source_fragment && (
          <div className="rounded bg-slate-900/60 px-2 py-1.5">
            <span className="text-[10px] font-medium text-slate-500">Source:</span>
            <p className="text-xs text-slate-400 italic">&quot;{actor.source_fragment}&quot;</p>
          </div>
        )}

        {/* Permissions hint */}
        {actor.permissions_hint && actor.permissions_hint.length > 0 && (
          <div>
            <div className="mb-1 flex items-center gap-1">
              <Shield className="h-3 w-3 text-slate-500" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Permissions Hint
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {actor.permissions_hint.map((p, i) => (
                <span key={i} className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300">
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Data access hint */}
        {actor.data_access_hint && actor.data_access_hint.length > 0 && (
          <div>
            <div className="mb-1 flex items-center gap-1">
              <Lock className="h-3 w-3 text-slate-500" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Data Access Hint
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {actor.data_access_hint.map((d, i) => (
                <span key={i} className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300">
                  {d}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* RBAC hint */}
        {rbacHint && (
          <div className="rounded-md border border-indigo-800/40 bg-indigo-900/20 px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400">
              RBAC Suggestion
            </span>
            <p className="mt-1 text-xs text-slate-300">
              Role: <span className="font-medium text-indigo-300">{rbacHint.role_suggestion}</span>
            </p>
            {rbacHint.permission_suggestions.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {rbacHint.permission_suggestions.map((p, i) => (
                  <span key={i} className="rounded bg-indigo-900/40 px-1.5 py-0.5 text-[10px] text-indigo-300">
                    {p}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </NodeCard>
  );
}
