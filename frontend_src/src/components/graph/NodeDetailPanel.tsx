// =============================================================================
// NodeDetailPanel — Slide-out panel when a node is clicked in the 3D graph
// Framer Motion for animations, shadcn/ui for layout
// =============================================================================

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Focus, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { GraphNode, GraphEdge } from '@/types/domain';
import { useGraphStore } from '@/stores/graphStore';

interface NodeDetailPanelProps {
  node: GraphNode | null;
  edges: GraphEdge[];
  onFocusCamera: (position: [number, number, number]) => void;
  onClose: () => void;
}

const stageColorMap: Record<string, string> = {
  prd_analysis: 'bg-amber-500',
  ideation: 'bg-purple-500',
  actor_discovery: 'bg-blue-500',
  capability_discovery: 'bg-green-500',
  use_case_discovery: 'bg-orange-500',
  story_discovery: 'bg-pink-500',
  task_decomposition: 'bg-cyan-500',
};

const traceabilityVariantMap: Record<string, 'default' | 'secondary' | 'destructive'> = {
  EXPLICIT: 'default',
  INFERRED: 'secondary',
  CANDIDATE: 'destructive',
};

export default function NodeDetailPanel({
  node,
  edges,
  onFocusCamera,
  onClose,
}: NodeDetailPanelProps) {
  const allNodes = useGraphStore((s) => s.nodes);

  const relatedNodes = useMemo(() => {
    if (!node) return [];
    const connectedIds = new Set<string>();
    edges.forEach((e) => {
      if (e.from === node.id) connectedIds.add(e.to);
      if (e.to === node.id) connectedIds.add(e.from);
    });
    return allNodes.filter((n) => connectedIds.has(n.id));
  }, [node, edges, allNodes]);

  return (
    <AnimatePresence>
      {node && (
        <motion.div
          initial={{ x: 320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 320, opacity: 0 }}
          transition={{ ease: [0.16, 1, 0.3, 1] as [number, number, number, number], duration: 0.35 }}
          className="absolute right-0 top-0 z-10 flex h-full w-[280px] flex-col border-l border-slate-700 bg-slate-800/95 shadow-2xl backdrop-blur-md"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-700 px-3 py-2">
            <div className="flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${stageColorMap[node.stage] ?? 'bg-slate-500'}`} />
              <span className="text-sm font-semibold text-white">Node Details</span>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-white" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="space-y-3 p-3">
              {/* Name */}
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Name</p>
                <p className="mt-0.5 text-sm font-semibold text-white">{node.label}</p>
              </div>

              {/* ID */}
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">ID</p>
                <p className="mt-0.5 font-mono text-xs text-slate-300">{node.id}</p>
              </div>

              {/* Type & Stage */}
              <div className="flex gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Type</p>
                  <Badge variant="outline" className="mt-0.5 text-xs capitalize text-slate-300">
                    {node.type}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Stage</p>
                  <Badge variant="outline" className="mt-0.5 text-xs text-slate-300">
                    {node.stage}
                  </Badge>
                </div>
              </div>

              {/* Traceability */}
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Traceability</p>
                <Badge
                  variant={traceabilityVariantMap[node.traceability] ?? 'default'}
                  className="mt-0.5 text-xs"
                >
                  {node.traceability}
                </Badge>
              </div>

              {/* Position */}
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Position</p>
                <p className="mt-0.5 font-mono text-xs text-slate-300">
                  X: {node.position[0].toFixed(2)} | Y: {node.position[1].toFixed(2)} | Z:{' '}
                  {node.position[2].toFixed(2)}
                </p>
              </div>

              {/* Metadata */}
              {Object.keys(node.metadata).length > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Metadata</p>
                  <div className="mt-0.5 rounded bg-slate-900/60 p-2">
                    {Object.entries(node.metadata).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-xs">
                        <span className="text-slate-400">{key}:</span>
                        <span className="text-slate-300">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Separator className="bg-slate-700" />

              {/* Related Nodes */}
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-slate-500">
                  Related Nodes ({relatedNodes.length})
                </p>
                {relatedNodes.length === 0 ? (
                  <p className="text-xs text-slate-500">No connected nodes</p>
                ) : (
                  <div className="space-y-1">
                    {relatedNodes.map((rn) => (
                      <button
                        key={rn.id}
                        onClick={() => useGraphStore.getState().selectNode(rn.id)}
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors hover:bg-slate-700/50"
                      >
                        <div
                          className={`h-2 w-2 shrink-0 rounded-full ${stageColorMap[rn.stage] ?? 'bg-slate-500'}`}
                        />
                        <span className="flex-1 truncate text-xs text-slate-300">{rn.label}</span>
                        <ArrowRight className="h-3 w-3 shrink-0 text-slate-500" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Focus Camera */}
              <Button
                size="sm"
                variant="secondary"
                className="w-full gap-1.5 text-xs"
                onClick={() => onFocusCamera(node.position)}
              >
                <Focus className="h-3.5 w-3.5" />
                Focus Camera
              </Button>
            </div>
          </ScrollArea>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
