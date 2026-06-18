// =============================================================================
// Graph Store — 3D graph visualization state
// =============================================================================

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { GraphNode, GraphEdge } from '@/types/domain';

type LayoutAlgorithm = 'force' | 'hierarchical' | 'circular';

interface GraphState {
  // ── Data from backend ──
  nodes: GraphNode[];
  edges: GraphEdge[];

  // ── Local UI state ──
  selectedNodeId: string | null;
  cameraPosition: [number, number, number];
  layoutAlgorithm: LayoutAlgorithm;
  hoveredNodeId: string | null;

  // ── Actions ──
  setNodes: (nodes: GraphNode[]) => void;
  setEdges: (edges: GraphEdge[]) => void;
  addNode: (node: GraphNode) => void;
  addEdge: (edge: GraphEdge) => void;
  buildGraph: (nodes: GraphNode[], edges: GraphEdge[]) => void;
  selectNode: (nodeId: string | null) => void;
  setHoveredNode: (nodeId: string | null) => void;
  setCameraPosition: (pos: [number, number, number]) => void;
  setLayout: (layout: LayoutAlgorithm) => void;
  reset: () => void;
}

export const useGraphStore = create<GraphState>()(
  devtools(
    (set) => ({
      nodes: [],
      edges: [],
      selectedNodeId: null,
      cameraPosition: [0, 5, 15],
      layoutAlgorithm: 'force',
      hoveredNodeId: null,

      setNodes: (nodes) => set({ nodes }),
      setEdges: (edges) => set({ edges }),

      addNode: (node) =>
        set((state) => ({
          nodes: [...state.nodes, node],
        })),

      addEdge: (edge) =>
        set((state) => ({
          edges: [...state.edges, edge],
        })),

      buildGraph: (nodes, edges) => set({ nodes, edges }),

      selectNode: (nodeId) => set({ selectedNodeId: nodeId }),
      setHoveredNode: (nodeId) => set({ hoveredNodeId: nodeId }),
      setCameraPosition: (pos) => set({ cameraPosition: pos }),
      setLayout: (layout) => set({ layoutAlgorithm: layout }),

      reset: () =>
        set({
          nodes: [],
          edges: [],
          selectedNodeId: null,
          cameraPosition: [0, 5, 15],
          hoveredNodeId: null,
        }),
    }),
    { name: 'graph-store' }
  )
);
