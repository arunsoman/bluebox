// =============================================================================
// CapabilitySteeringPanel — Capability cards grouped by capability_lens
// Each card: name, description, triggered_by, priority badge, data_entities_involved
// Platform capabilities section
// =============================================================================

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Layers, Puzzle, Database, Shield, Wrench, TrendingUp, Zap, Box,
  AlertTriangle
} from 'lucide-react';
import { useSteeringStore } from '@/stores/steeringStore';
import NodeCard from '@/components/shared/NodeCard';
import type { Capability, CapabilitySet, CapabilityLens } from '@/types/domain';

const lensConfig: Record<CapabilityLens, { icon: React.ReactNode; color: string }> = {
  functional: { icon: <Puzzle className="h-4 w-4" />, color: 'bg-blue-900/60 text-blue-300 border-blue-700' },
  data: { icon: <Database className="h-4 w-4" />, color: 'bg-emerald-900/60 text-emerald-300 border-emerald-700' },
  integration: { icon: <Zap className="h-4 w-4" />, color: 'bg-amber-900/60 text-amber-300 border-amber-700' },
  security: { icon: <Shield className="h-4 w-4" />, color: 'bg-red-900/60 text-red-300 border-red-700' },
  operational: { icon: <Wrench className="h-4 w-4" />, color: 'bg-purple-900/60 text-purple-300 border-purple-700' },
  platform: { icon: <Box className="h-4 w-4" />, color: 'bg-indigo-900/60 text-indigo-300 border-indigo-700' },
  growth: { icon: <TrendingUp className="h-4 w-4" />, color: 'bg-pink-900/60 text-pink-300 border-pink-700' },
};

export default function CapabilitySteeringPanel() {
  const draftOutput = useSteeringStore((s) => s.draftOutput);

  const result: CapabilitySet | null = useMemo(() => {
    if (!draftOutput) return null;
    return (draftOutput as { capability_set?: CapabilitySet }).capability_set ?? null;
  }, [draftOutput]);

  if (!result) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-slate-500">Waiting for capability discovery...</p>
      </div>
    );
  }

  const { capabilities, gaps } = result;

  const grouped = useMemo(() => {
    const groups: Partial<Record<CapabilityLens, Capability[]>> = {};
    for (const cap of capabilities) {
      if (!groups[cap.lens]) groups[cap.lens] = [];
      groups[cap.lens]!.push(cap);
    }
    return groups;
  }, [capabilities]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto space-y-6 p-4">
        {/* Coverage summary */}
        {result.coverage && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-slate-700 bg-slate-800/30 p-4"
          >
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
              <Layers className="h-4 w-4" />
              Coverage Summary
            </h3>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {(Object.entries(result.coverage) as [CapabilityLens, number][]).map(([lens, pct]) => (
                <div key={lens} className="rounded-md border border-slate-700 bg-slate-800/50 p-2 text-center">
                  <div className="flex justify-center mb-1">{lensConfig[lens].icon}</div>
                  <div className="text-xs font-medium capitalize text-slate-300">{lens}</div>
                  <div className="mt-1 text-xs font-bold text-blue-400">{Math.round(pct * 100)}%</div>
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-700">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${pct * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Grouped capabilities */}
        {(Object.entries(grouped) as [CapabilityLens, Capability[]][]).map(
          ([lens, lensCaps]) =>
            lensCaps.length > 0 && (
              <motion.div
                key={lens}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
                  {lensConfig[lens].icon}
                  <span className="capitalize">{lens}</span> Capabilities ({lensCaps.length})
                </h3>
                <div className="space-y-2">
                  {lensCaps.map((cap) => (
                    <CapabilityCard key={cap.capability_id} capability={cap} />
                  ))}
                </div>
              </motion.div>
            )
        )}

        {/* Gaps */}
        {gaps.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-amber-700/40 bg-amber-900/20 p-4"
          >
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-300">
              <AlertTriangle className="h-4 w-4" />
              Capability Gaps ({gaps.length})
            </h3>
            <ul className="space-y-2">
              {gaps.map((gap, i) => (
                <li key={i} className="flex items-start gap-2 text-xs">
                  <span className="mt-0.5 rounded bg-amber-900/60 px-1.5 py-0.5 text-[10px] font-medium uppercase text-amber-300">
                    {gap.lens}
                  </span>
                  <span className="text-slate-400">{gap.suggestion}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function CapabilityCard({ capability }: { capability: Capability }) {
  const config = lensConfig[capability.lens];

  return (
    <NodeCard
      id={capability.capability_id}
      title={capability.name}
      subtitle={capability.description?.slice(0, 120)}
      type={capability.lens}
      typeColor={config.color}
      traceability={capability.traceability}
      confidence={capability.confidence}
      icon={config.icon}
    >
      <div className="mt-3 space-y-2">
        <p className="text-xs text-slate-400">{capability.description}</p>
        {capability.source_fragment && (
          <div className="rounded bg-slate-900/60 px-2 py-1.5">
            <span className="text-[10px] font-medium text-slate-500">Source:</span>
            <p className="text-xs text-slate-400 italic">&quot;{capability.source_fragment}&quot;</p>
          </div>
        )}
        {capability.parent_ids.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <span className="text-[10px] text-slate-500">Parents:</span>
            {capability.parent_ids.map((pid) => (
              <span key={pid} className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300 font-mono">
                {pid}
              </span>
            ))}
          </div>
        )}
      </div>
    </NodeCard>
  );
}
