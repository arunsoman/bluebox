// =============================================================================
// UseCaseSteeringPanel — Use case cards with: title, primary_actor, preconditions,
// main_flow steps
// Expandable: alternative_flows, exception_flows, postconditions
// Access context: required_permission, data_sensitivity badge
// =============================================================================

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Route, ChevronDown, ChevronUp, User } from 'lucide-react';
import { useSteeringStore } from '@/stores/steeringStore';
import NodeCard from '@/components/shared/NodeCard';
import type { UseCase, UseCaseSet } from '@/types/domain';

export default function UseCaseSteeringPanel() {
  const draftOutput = useSteeringStore((s) => s.draftOutput);

  const result: UseCaseSet | null = useMemo(() => {
    if (!draftOutput) return null;
    return (draftOutput as { use_case_set?: UseCaseSet }).use_case_set ?? null;
  }, [draftOutput]);

  if (!result) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-slate-500">Waiting for use case discovery...</p>
      </div>
    );
  }

  const { use_cases, coverage_percent } = result;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto space-y-4 p-4">
        {/* Coverage */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/30 px-4 py-3"
        >
          <span className="text-sm font-medium text-slate-300">
            Use Case Coverage
          </span>
          <div className="flex items-center gap-2">
            <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-700">
              <motion.div
                className="h-full rounded-full bg-blue-500"
                initial={{ width: 0 }}
                animate={{ width: `${(coverage_percent ?? 0) * 100}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
            <span className="text-xs font-bold text-blue-400">
              {Math.round((coverage_percent ?? 0) * 100)}%
            </span>
          </div>
        </motion.div>

        {/* Use cases */}
        <div className="space-y-2">
          {use_cases.map((useCase, idx) => (
            <UseCaseCard key={useCase.use_case_id} useCase={useCase} index={idx} />
          ))}
        </div>
      </div>
    </div>
  );
}

function UseCaseCard({ useCase, index }: { useCase: UseCase; index: number }) {
  const [showFlows, setShowFlows] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.2 }}
    >
      <NodeCard
        id={useCase.use_case_id}
        title={useCase.name}
        subtitle={useCase.description?.slice(0, 120)}
        type="Use Case"
        typeColor="bg-cyan-900/60 text-cyan-300 border-cyan-700"
        traceability={useCase.traceability}
        confidence={useCase.confidence}
        icon={<Route className="h-4 w-4" />}
      >
        <div className="mt-3 space-y-3">
          {/* Description */}
          <p className="text-xs text-slate-400">{useCase.description}</p>

          {/* Primary actors */}
          <div className="flex items-center gap-2">
            <User className="h-3 w-3 text-slate-500" />
            <span className="text-[10px] text-slate-500">Actors:</span>
            <div className="flex flex-wrap gap-1">
              {useCase.actor_ids.map((aid) => (
                <span key={aid} className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300 font-mono">
                  {aid}
                </span>
              ))}
            </div>
          </div>

          {/* Preconditions */}
          {useCase.preconditions.length > 0 && (
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Preconditions
              </span>
              <ul className="mt-1 space-y-0.5">
                {useCase.preconditions.map((pre, i) => (
                  <li key={i} className="text-xs text-slate-400">- {pre}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Main flow */}
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Main Flow
            </span>
            <ol className="mt-1 space-y-1">
              {useCase.main_flow.map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-xs">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-900/60 text-[9px] font-bold text-blue-300">
                    {i + 1}
                  </span>
                  <span className="text-slate-300">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Expandable flows */}
          {(useCase.alternative_flows.length > 0 || useCase.exception_flows.length > 0) && (
            <button
              onClick={() => setShowFlows(!showFlows)}
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
            >
              {showFlows ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {useCase.alternative_flows.length} alt, {useCase.exception_flows.length} exception flows
            </button>
          )}

          <AnimatePresence>
            {showFlows && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden space-y-3"
              >
                {/* Alternative flows */}
                {useCase.alternative_flows.map((flow, i) => (
                  <div key={i} className="rounded-md border border-slate-700/50 bg-slate-900/40 px-3 py-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500">
                      Alt: {flow.name}
                    </span>
                    <ol className="mt-1 space-y-0.5">
                      {flow.steps.map((step, j) => (
                        <li key={j} className="text-xs text-slate-400">{j + 1}. {step}</li>
                      ))}
                    </ol>
                  </div>
                ))}

                {/* Exception flows */}
                {useCase.exception_flows.map((flow, i) => (
                  <div key={i} className="rounded-md border border-red-800/40 bg-red-900/20 px-3 py-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-red-400">
                      Exception: {flow.name}
                    </span>
                    <p className="text-[10px] text-red-400/70">Condition: {flow.condition}</p>
                    <ol className="mt-1 space-y-0.5">
                      {flow.steps.map((step, j) => (
                        <li key={j} className="text-xs text-slate-400">{j + 1}. {step}</li>
                      ))}
                    </ol>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Postconditions */}
          {useCase.postconditions.length > 0 && (
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Postconditions
              </span>
              <ul className="mt-1 space-y-0.5">
                {useCase.postconditions.map((post, i) => (
                  <li key={i} className="text-xs text-slate-400">- {post}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </NodeCard>
    </motion.div>
  );
}
