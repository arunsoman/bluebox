// =============================================================================
// NodeTooltip — Floating HTML tooltip for 3D graph hover
// Uses @react-three/drei Html for 2D overlay on 3D scene
// =============================================================================

import { Html } from '@react-three/drei';
import type { GraphNode } from '@/types/domain';

interface NodeTooltipProps {
  node: GraphNode;
}

const stageLabels: Record<string, string> = {
  prd_analysis: 'PRD',
  ideation: 'Ideation',
  actor_discovery: 'Actor',
  capability_discovery: 'Capability',
  use_case_discovery: 'Use Case',
  story_discovery: 'Story',
  task_decomposition: 'Task',
};

const traceabilityColors: Record<string, string> = {
  EXPLICIT: 'text-green-400',
  INFERRED: 'text-yellow-400',
  CANDIDATE: 'text-red-400',
};

export default function NodeTooltip({ node }: NodeTooltipProps) {
  return (
    <Html
      position={[node.position[0] + 0.8, node.position[1] + 0.8, node.position[2]]}
      center
      style={{ pointerEvents: 'none' }}
    >
      <div className="min-w-[160px] rounded-lg border border-slate-600 bg-slate-800/95 px-3 py-2 shadow-xl backdrop-blur-sm">
        <p className="text-sm font-semibold text-white">{node.label}</p>
        <div className="mt-1 flex items-center gap-2 text-xs text-slate-300">
          <span className="rounded bg-slate-700 px-1.5 py-0.5 font-mono uppercase">
            {node.type}
          </span>
          <span className="text-slate-500">|</span>
          <span>{stageLabels[node.stage] ?? node.stage}</span>
        </div>
        <p className={`mt-1 text-xs font-medium ${traceabilityColors[node.traceability] ?? 'text-slate-400'}`}>
          {node.traceability}
        </p>
      </div>
    </Html>
  );
}
