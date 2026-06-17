import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactFlow, {
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeProps,
  type ReactFlowInstance,
  Handle,
  Position,
  MarkerType,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Users,
  Zap,
  GitBranch,
  BookOpen,
  CheckSquare,
  Filter,
  Download,
  Plus,
  Minus,
  Maximize2,
  RotateCcw,
  X,
  Search,
  Crosshair,
  AlertTriangle,
} from 'lucide-react';
import type { EntityType } from '@/data/mockEntities';
import { graphNodes, graphEdges, allEntities } from '@/data/mockEntities';
import GlassButton from '@/components/GlassButton';

/* ─── node type config ─── */
const NODE_CONFIG: Record<EntityType, { label: string; icon: typeof Users; color: string; bgTint: string; borderColor: string; glow: string; minW: number; minH: number }> = {
  actor: {
    label: 'Actor',
    icon: Users,
    color: '#00F5FF',
    bgTint: 'rgba(0,245,255,0.08)',
    borderColor: 'rgba(0,245,255,0.4)',
    glow: '0 0 20px rgba(0, 245, 255, 0.15), 0 0 40px rgba(0, 245, 255, 0.05)',
    minW: 160,
    minH: 72,
  },
  capability: {
    label: 'Capability',
    icon: Zap,
    color: '#7B2FFF',
    bgTint: 'rgba(123,47,255,0.08)',
    borderColor: 'rgba(123,47,255,0.4)',
    glow: '0 0 20px rgba(123, 47, 255, 0.15)',
    minW: 140,
    minH: 60,
  },
  'use-case': {
    label: 'Use Case',
    icon: GitBranch,
    color: '#39FF14',
    bgTint: 'rgba(57,255,20,0.06)',
    borderColor: 'rgba(57,255,20,0.4)',
    glow: '0 0 20px rgba(57, 255, 20, 0.1)',
    minW: 140,
    minH: 60,
  },
  story: {
    label: 'Story',
    icon: BookOpen,
    color: '#FFB800',
    bgTint: 'rgba(255,184,0,0.08)',
    borderColor: 'rgba(255,184,0,0.4)',
    glow: '0 0 20px rgba(255, 184, 0, 0.1)',
    minW: 140,
    minH: 60,
  },
  task: {
    label: 'Task',
    icon: CheckSquare,
    color: '#8BA4C7',
    bgTint: 'rgba(138,180,230,0.05)',
    borderColor: 'rgba(138,180,230,0.3)',
    glow: '0 0 12px rgba(138, 180, 230, 0.08)',
    minW: 120,
    minH: 52,
  },
};

/* ─── edge config ─── */
const EDGE_CONFIG: Record<string, { color: string; dashArray: string; width: number }> = {
  depends_on: { color: 'rgba(138, 180, 230, 0.25)', dashArray: 'none', width: 1.5 },
  triggers:   { color: 'rgba(0, 245, 255, 0.35)',   dashArray: '6 4',  width: 1.5 },
  includes:   { color: 'rgba(123, 47, 255, 0.35)',  dashArray: '2 3',  width: 1.5 },
};

/* ─── type for impact highlight ─── */
type ImpactMode = 'none' | 'upstream' | 'downstream' | 'both';

/* ─── custom node component ─── */
function PipelineNode(props: NodeProps<{ entityType: EntityType; label: string }>) {
  const { data, selected } = props;
  const config = NODE_CONFIG[data.entityType];
  const Icon = config.icon;

  return (
    <div
      className="relative transition-all duration-300"
      style={{
        minWidth: config.minW,
        minHeight: config.minH,
      }}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-transparent !border-0" />
      <div
        className="w-full h-full rounded-xl px-4 py-3 flex flex-col justify-center gap-1 transition-all duration-300"
        style={{
          background: selected
            ? `rgba(16, 36, 65, 0.7)`
            : `rgba(10, 22, 40, 0.75)`,
          backdropFilter: 'blur(12px)',
          border: selected
            ? `2px solid #00F5FF`
            : `1.5px solid ${config.borderColor}`,
          boxShadow: selected
            ? '0 0 30px rgba(0, 245, 255, 0.25), 0 0 60px rgba(0, 245, 255, 0.1)'
            : `0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03)`,
          transform: selected ? 'scale(1.05)' : 'scale(1)',
        }}
      >
        {/* Status dot */}
        <span
          className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: config.color }}
        />
        <div className="flex items-center gap-2">
          <Icon size={16} style={{ color: config.color }} className="flex-shrink-0" />
          <span className="text-sm font-medium text-[#E8F0FE] truncate leading-tight">
            {data.label}
          </span>
        </div>
        <span
          className="text-[10px] font-mono px-1.5 py-0.5 rounded-full self-start"
          style={{
            color: config.color,
            backgroundColor: config.bgTint,
          }}
        >
          {config.label.toUpperCase()}
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-transparent !border-0" />
    </div>
  );
}

const nodeTypes = { pipelineNode: PipelineNode };

/* ─── layout helpers ─── */
interface LayoutNode { id: string; x: number; y: number; }

function computeHierarchicalLayout(nodes: Node[], edges: Edge[]): LayoutNode[] {
  const levels: Record<string, number> = {};
  const adjacency: Record<string, string[]> = {};

  nodes.forEach((n) => { adjacency[n.id] = []; levels[n.id] = 0; });
  edges.forEach((e) => { if (adjacency[e.source]) adjacency[e.source].push(e.target); });

  // Assign levels via BFS
  const visited = new Set<string>();
  const queue: string[] = [];

  // Start with nodes that have no incoming edges (roots)
  const incomingCounts: Record<string, number> = {};
  nodes.forEach((n) => { incomingCounts[n.id] = 0; });
  edges.forEach((e) => { incomingCounts[e.target] = (incomingCounts[e.target] || 0) + 1; });

  nodes.forEach((n) => {
    if (incomingCounts[n.id] === 0) {
      levels[n.id] = 0;
      queue.push(n.id);
      visited.add(n.id);
    }
  });

  while (queue.length > 0) {
    const current = queue.shift()!;
    adjacency[current]?.forEach((neighbor) => {
      levels[neighbor] = Math.max(levels[neighbor] || 0, levels[current] + 1);
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    });
  }

  // For unvisited nodes, assign level 0
  nodes.forEach((n) => { if (levels[n.id] === undefined) levels[n.id] = 0; });

  const maxLevel = Math.max(...Object.values(levels), 0);
  const levelWidth = 280;
  const nodeHeight = 120;

  const nodesByLevel: Record<number, string[]> = {};
  Object.entries(levels).forEach(([id, lvl]) => {
    if (!nodesByLevel[lvl]) nodesByLevel[lvl] = [];
    nodesByLevel[lvl].push(id);
  });

  const result: LayoutNode[] = [];
  for (let lvl = 0; lvl <= maxLevel; lvl++) {
    const levelNodes = nodesByLevel[lvl] || [];
    const totalHeight = levelNodes.length * nodeHeight;
    levelNodes.forEach((id, idx) => {
      result.push({
        id,
        x: lvl * levelWidth + 100,
        y: idx * nodeHeight - totalHeight / 2,
      });
    });
  }

  return result;
}

function computeGridLayout(nodes: Node[]): LayoutNode[] {
  const cols = Math.ceil(Math.sqrt(nodes.length));
  const cellW = 240;
  const cellH = 140;
  return nodes.map((n, i) => ({
    id: n.id,
    x: (i % cols) * cellW + 100,
    y: Math.floor(i / cols) * cellH + 50,
  }));
}

function computeForceLayout(nodes: Node[], edges: Edge[], iterations = 80): LayoutNode[] {
  const positions: Record<string, { x: number; y: number }> = {};
  const width = 1200;
  const height = 800;

  // Random initial positions
  nodes.forEach((n) => {
    positions[n.id] = {
      x: Math.random() * width * 0.8 + width * 0.1,
      y: Math.random() * height * 0.8 + height * 0.1,
    };
  });

  const repulsion = 8000;
  const attraction = 0.008;
  const damping = 0.85;
  const velocities: Record<string, { vx: number; vy: number }> = {};
  nodes.forEach((n) => { velocities[n.id] = { vx: 0, vy: 0 }; });

  for (let iter = 0; iter < iterations; iter++) {
    // Repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = positions[b.id].x - positions[a.id].x;
        const dy = positions[b.id].y - positions[a.id].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = repulsion / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        velocities[a.id].vx -= fx;
        velocities[a.id].vy -= fy;
        velocities[b.id].vx += fx;
        velocities[b.id].vy += fy;
      }
    }

    // Attraction along edges
    edges.forEach((e) => {
      if (!positions[e.source] || !positions[e.target]) return;
      const dx = positions[e.target].x - positions[e.source].x;
      const dy = positions[e.target].y - positions[e.source].y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = dist * attraction;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      velocities[e.source].vx += fx;
      velocities[e.source].vy += fy;
      velocities[e.target].vx -= fx;
      velocities[e.target].vy -= fy;
    });

    // Apply velocities
    nodes.forEach((n) => {
      velocities[n.id].vx *= damping;
      velocities[n.id].vy *= damping;
      positions[n.id].x += velocities[n.id].vx;
      positions[n.id].y += velocities[n.id].vy;
      // Center gravity
      positions[n.id].x += (width / 2 - positions[n.id].x) * 0.005;
      positions[n.id].y += (height / 2 - positions[n.id].y) * 0.005;
    });
  }

  return nodes.map((n) => ({ id: n.id, x: positions[n.id].x, y: positions[n.id].y }));
}

/* ─── impact analysis ─── */
function getConnectedNodes(nodeId: string, edges: Edge[], direction: 'downstream' | 'upstream' | 'both'): Set<string> {
  const result = new Set<string>();
  const adjacencyDown: Record<string, string[]> = {};
  const adjacencyUp: Record<string, string[]> = {};

  edges.forEach((e) => {
    if (!adjacencyDown[e.source]) adjacencyDown[e.source] = [];
    adjacencyDown[e.source].push(e.target);
    if (!adjacencyUp[e.target]) adjacencyUp[e.target] = [];
    adjacencyUp[e.target].push(e.source);
  });

  function traverse(id: string, adj: Record<string, string[]>, visited: Set<string>) {
    if (visited.has(id)) return;
    visited.add(id);
    (adj[id] || []).forEach((next) => traverse(next, adj, visited));
  }

  if (direction === 'downstream' || direction === 'both') {
    traverse(nodeId, adjacencyDown, result);
  }
  if (direction === 'upstream' || direction === 'both') {
    traverse(nodeId, adjacencyUp, result);
  }

  result.delete(nodeId);
  return result;
}

/* ─── sidebar legend ─── */
const LEGEND_ITEMS: { type: EntityType; label: string; count: number }[] = [
  { type: 'actor',      label: 'Actor',       count: allEntities.filter((e) => e.type === 'actor').length },
  { type: 'capability', label: 'Capability',  count: allEntities.filter((e) => e.type === 'capability').length },
  { type: 'use-case',   label: 'Use Case',    count: allEntities.filter((e) => e.type === 'use-case').length },
  { type: 'story',      label: 'Story',       count: allEntities.filter((e) => e.type === 'story').length },
  { type: 'task',       label: 'Task',        count: allEntities.filter((e) => e.type === 'task').length },
];

const EDGE_LEGEND = [
  { type: 'depends_on', label: 'Depends On', style: 'solid', color: 'rgba(138, 180, 230, 0.4)' },
  { type: 'triggers',   label: 'Triggers',   style: 'dashed', color: 'rgba(0, 245, 255, 0.5)' },
  { type: 'includes',   label: 'Includes',   style: 'dotted', color: 'rgba(123, 47, 255, 0.5)' },
];

/* ─── main visualizer page ─── */
export default function Visualizer() {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [impactMode, setImpactMode] = useState<ImpactMode>('none');
  const [activeLayout, setActiveLayout] = useState<'hierarchical' | 'force' | 'grid'>('hierarchical');
  const [searchQuery, setSearchQuery] = useState('');
  const [hiddenTypes, setHiddenTypes] = useState<Set<EntityType>>(new Set());
  const [hiddenEdgeTypes, setHiddenEdgeTypes] = useState<Set<string>>(new Set());
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [sidebarTab, setSidebarTab] = useState<'legend' | 'selection'>('legend');

  /* Build nodes */
  const initialNodes = useMemo<Node[]>(() => {
    return graphNodes.map((gn) => {
      const config = NODE_CONFIG[gn.type];
      return {
        id: gn.id,
        type: 'pipelineNode',
        position: { x: 0, y: 0 },
        data: { entityType: gn.type, label: gn.label },
        style: { width: config.minW, height: config.minH },
      };
    });
  }, []);

  /* Build edges */
  const initialEdges = useMemo<Edge[]>(() => {
    return graphEdges.map((ge) => {
      const cfg = EDGE_CONFIG[ge.type] || EDGE_CONFIG.depends_on;
      return {
        id: ge.id,
        source: ge.source,
        target: ge.target,
        label: ge.label,
        type: 'smoothstep',
        style: {
          stroke: cfg.color,
          strokeWidth: cfg.width,
          strokeDasharray: cfg.dashArray === 'none' ? undefined : cfg.dashArray,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: cfg.color,
          width: 10,
          height: 10,
        },
        data: { edgeType: ge.type },
      };
    });
  }, []);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  /* Apply layout */
  const applyLayout = useCallback((layoutType: 'hierarchical' | 'force' | 'grid') => {
    const visibleNodes = nodes.filter((n) => !hiddenTypes.has(n.data.entityType as EntityType));
    const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));
    const visibleEdges = edges.filter((e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target));

    let layout: LayoutNode[] = [];
    if (layoutType === 'hierarchical') {
      layout = computeHierarchicalLayout(visibleNodes, visibleEdges);
    } else if (layoutType === 'force') {
      layout = computeForceLayout(visibleNodes, visibleEdges);
    } else {
      layout = computeGridLayout(visibleNodes);
    }

    setNodes((prev) =>
      prev.map((n) => {
        const pos = layout.find((l) => l.id === n.id);
        return pos ? { ...n, position: { x: pos.x, y: pos.y } } : n;
      })
    );
  }, [nodes, edges, hiddenTypes, setNodes]);

  useEffect(() => {
    applyLayout(activeLayout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLayout]);

  /* Apply impact highlighting */
  useEffect(() => {
    if (!selectedNodeId || impactMode === 'none') {
      // Reset all
      setNodes((prev) =>
        prev.map((n) => ({
          ...n,
          style: { ...n.style, opacity: 1 },
          className: '',
        }))
      );
      setEdges((prev) =>
        prev.map((e) => ({
          ...e,
          style: { ...e.style, opacity: 1 },
          animated: false,
        }))
      );
      return;
    }

    const connected = getConnectedNodes(selectedNodeId, edges, impactMode);
    const connectedEdges = edges.filter((e) => {
      if (impactMode === 'downstream') return e.source === selectedNodeId || connected.has(e.source);
      if (impactMode === 'upstream') return e.target === selectedNodeId || connected.has(e.target);
      return connected.has(e.source) || connected.has(e.target) || e.source === selectedNodeId || e.target === selectedNodeId;
    });
    const connectedEdgeIds = new Set(connectedEdges.map((e) => e.id));

    setNodes((prev) =>
      prev.map((n) => {
        const isSelected = n.id === selectedNodeId;
        const isConnected = connected.has(n.id);
        if (isSelected || isConnected) {
          return {
            ...n,
            style: { ...n.style, opacity: 1 },
            className: isConnected ? 'impact-highlighted' : '',
          };
        }
        return { ...n, style: { ...n.style, opacity: 0.2 }, className: 'impact-dimmed' };
      })
    );

    setEdges((prev) =>
      prev.map((e) => {
        if (connectedEdgeIds.has(e.id)) {
          return {
            ...e,
            style: {
              ...e.style,
              opacity: 1,
              stroke: '#7B2FFF',
              strokeWidth: 2.5,
            },
            animated: true,
          };
        }
        return { ...e, style: { ...e.style, opacity: 0.08 }, animated: false };
      })
    );
  }, [selectedNodeId, impactMode, edges, setNodes, setEdges]);

  /* Node click handler */
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
    setSidebarTab('selection');
    if (impactMode !== 'none') {
      setImpactMode('none');
    }
  }, [impactMode]);

  /* Pane click handler */
  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setImpactMode('none');
    setSidebarTab('legend');
  }, []);

  /* Simulate impact */
  const simulateImpact = useCallback((mode: ImpactMode) => {
    if (!selectedNodeId) return;
    setImpactMode(mode);
  }, [selectedNodeId]);

  /* Toggle node type visibility */
  const toggleNodeType = useCallback((type: EntityType) => {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  /* Toggle edge type visibility */
  const toggleEdgeType = useCallback((type: string) => {
    setHiddenEdgeTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  /* Filtered view */
  const visibleNodes = useMemo(() => {
    return nodes
      .filter((n) => !hiddenTypes.has(n.data.entityType as EntityType))
      .filter((n) => {
        if (!searchQuery) return true;
        const entity = allEntities.find((e) => e.id === n.id);
        if (!entity) return true;
        const q = searchQuery.toLowerCase();
        return entity.name.toLowerCase().includes(q) || entity.tags.some((t) => t.toLowerCase().includes(q));
      });
  }, [nodes, hiddenTypes, searchQuery]);

  const visibleEdges = useMemo(() => {
    const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));
    return edges.filter(
      (e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target) && !hiddenEdgeTypes.has(e.data?.edgeType)
    );
  }, [edges, visibleNodes, hiddenEdgeTypes]);

  /* Selected node data */
  const selectedNodeData = useMemo(() => {
    if (!selectedNodeId) return null;
    const entity = allEntities.find((e) => e.id === selectedNodeId);
    const node = nodes.find((n) => n.id === selectedNodeId);
    if (!entity || !node) return null;

    const downstream = getConnectedNodes(selectedNodeId, edges, 'downstream');
    const upstream = getConnectedNodes(selectedNodeId, edges, 'upstream');

    return {
      entity,
      nodeType: node.data.entityType as EntityType,
      downstreamCount: downstream.size,
      upstreamCount: upstream.size,
      downstreamByType: Array.from(downstream).reduce((acc, id) => {
        const e = allEntities.find((en) => en.id === id);
        if (e) acc[e.type] = (acc[e.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  }, [selectedNodeId, edges, nodes]);

  /* Search and focus node */
  const focusNode = useCallback((nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (node && reactFlowInstance) {
      reactFlowInstance.setCenter(node.position.x + 80, node.position.y + 36, { zoom: 1.2, duration: 600 });
      setSelectedNodeId(nodeId);
      setSidebarTab('selection');
    }
  }, [nodes, reactFlowInstance]);

  const searchResults = useMemo(() => {
    if (!searchQuery) return [];
    const q = searchQuery.toLowerCase();
    return allEntities.filter((e) => e.name.toLowerCase().includes(q)).slice(0, 5);
  }, [searchQuery]);

  return (
    <div className="flex h-full relative overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 50%, rgba(123, 47, 255, 0.05) 0%, transparent 60%)',
        }}
      />

      {/* Sidebar */}
      <motion.aside
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.175, 0.885, 0.32, 1.275] as [number, number, number, number] }}
        className="relative z-10 w-[280px] flex-shrink-0 border-r border-[rgba(138,180,230,0.08)] overflow-y-auto hidden lg:block"
        style={{ background: 'rgba(10, 22, 40, 0.4)', backdropFilter: 'blur(20px) saturate(120%)' }}
      >
        <div className="p-4 space-y-5">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A6487] pointer-events-none" />
            <input
              type="text"
              placeholder="Find node..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[rgba(10,22,40,0.5)] border border-[rgba(138,180,230,0.1)] rounded-lg text-[#E8F0FE] font-body-sm pl-9 pr-3 py-2 placeholder:text-[rgba(138,180,230,0.4)] focus:outline-none focus:border-[rgba(0,245,255,0.5)] transition-all"
            />
            {searchQuery && (
              <div className="absolute top-full left-0 right-0 mt-1 glass-elevated rounded-lg overflow-hidden z-20">
                {searchResults.map((r) => {
                  const cfg = NODE_CONFIG[r.type];
                  return (
                    <button
                      key={r.id}
                      onClick={() => { focusNode(r.id); setSearchQuery(''); }}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[rgba(0,245,255,0.08)] transition-colors text-left"
                    >
                      <cfg.icon size={14} style={{ color: cfg.color }} />
                      <span className="text-sm text-[#E8F0FE] truncate">{r.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <AnimatePresence mode="wait">
            {sidebarTab === 'legend' ? (
              <motion.div
                key="legend"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="space-y-5"
              >
                {/* Node Type Legend */}
                <div>
                  <h3 className="font-heading-sm text-[#8BA4C7] mb-3">Node Types</h3>
                  <div className="space-y-1.5">
                    {LEGEND_ITEMS.map((item, idx) => {
                      const config = NODE_CONFIG[item.type];
                      const isHidden = hiddenTypes.has(item.type);
                      return (
                        <motion.button
                          key={item.type}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          onClick={() => toggleNodeType(item.type)}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${
                            isHidden ? 'opacity-40' : 'hover:bg-[rgba(0,245,255,0.04)]'
                          }`}
                        >
                          <div
                            className="w-5 h-5 rounded-full flex-shrink-0 border-2"
                            style={{
                              borderColor: config.color,
                              backgroundColor: isHidden ? 'transparent' : config.bgTint,
                            }}
                          />
                          <span className="font-body-sm text-[#E8F0FE] flex-1 text-left">{item.label}</span>
                          <span className="text-xs font-mono text-[#4A6487]">{item.count}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Edge Type Legend */}
                <div>
                  <h3 className="font-heading-sm text-[#8BA4C7] mb-3">Edge Types</h3>
                  <div className="space-y-2">
                    {EDGE_LEGEND.map((item) => {
                      const isHidden = hiddenEdgeTypes.has(item.type);
                      return (
                        <button
                          key={item.type}
                          onClick={() => toggleEdgeType(item.type)}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                            isHidden ? 'opacity-40' : 'hover:bg-[rgba(0,245,255,0.04)]'
                          }`}
                        >
                          <svg width="24" height="8" className="flex-shrink-0">
                            <line
                              x1="0" y1="4" x2="24" y2="4"
                              stroke={item.color}
                              strokeWidth="1.5"
                              strokeDasharray={item.style === 'dashed' ? '5 3' : item.style === 'dotted' ? '1 2' : undefined}
                            />
                          </svg>
                          <span className="font-body-sm text-[#E8F0FE] flex-1 text-left">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="selection"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="space-y-5"
              >
                {selectedNodeData && (
                  <>
                    {/* Back to legend */}
                    <button
                      onClick={() => { setSidebarTab('legend'); setSelectedNodeId(null); setImpactMode('none'); }}
                      className="flex items-center gap-1 text-sm text-[#4A6487] hover:text-[#00F5FF] transition-colors"
                    >
                      <X size={14} /> Back to legend
                    </button>

                    {/* Node preview */}
                    <div className="flex items-center gap-3">
                      {(() => {
                        const cfg = NODE_CONFIG[selectedNodeData.nodeType];
                        const Icon = cfg.icon;
                        return (
                          <>
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center border-2"
                              style={{ borderColor: cfg.color, backgroundColor: cfg.bgTint }}
                            >
                              <Icon size={20} style={{ color: cfg.color }} />
                            </div>
                            <div>
                              <h3 className="font-heading-md text-[#E8F0FE] leading-tight">{selectedNodeData.entity.name}</h3>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full" style={{ color: cfg.color, backgroundColor: cfg.bgTint }}>
                                {cfg.label.toUpperCase()}
                              </span>
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-3 rounded-lg bg-[rgba(10,22,40,0.4)] border border-[rgba(138,180,230,0.06)]">
                        <div className="text-xs font-body-sm text-[#4A6487] mb-1">Upstream</div>
                        <div className="font-mono text-lg text-[#E8F0FE]">{selectedNodeData.upstreamCount}</div>
                      </div>
                      <div className="p-3 rounded-lg bg-[rgba(10,22,40,0.4)] border border-[rgba(138,180,230,0.06)]">
                        <div className="text-xs font-body-sm text-[#4A6487] mb-1">Downstream</div>
                        <div className="font-mono text-lg text-[#E8F0FE]">{selectedNodeData.downstreamCount}</div>
                      </div>
                    </div>

                    {/* Impact simulation buttons */}
                    <div className="space-y-2">
                      <h3 className="font-heading-sm text-[#8BA4C7]">Impact Simulation</h3>
                      <GlassButton
                        variant="primary"
                        fullWidth
                        icon={<Crosshair size={14} />}
                        onClick={() => simulateImpact('downstream')}
                      >
                        Simulate Downstream
                      </GlassButton>
                      <GlassButton
                        variant="secondary"
                        fullWidth
                        icon={<Crosshair size={14} />}
                        onClick={() => simulateImpact('upstream')}
                      >
                        Simulate Upstream
                      </GlassButton>
                      <GlassButton
                        variant="ghost"
                        fullWidth
                        icon={<AlertTriangle size={14} />}
                        onClick={() => simulateImpact('both')}
                      >
                        Simulate Both
                      </GlassButton>
                      {impactMode !== 'none' && (
                        <GlassButton
                          variant="ghost"
                          fullWidth
                          onClick={() => setImpactMode('none')}
                        >
                          Clear Highlight
                        </GlassButton>
                      )}
                    </div>

                    {/* Downstream breakdown */}
                    {selectedNodeData.downstreamCount > 0 && (
                      <div>
                        <h3 className="font-heading-sm text-[#8BA4C7] mb-2">Downstream Impact</h3>
                        <div className="space-y-1.5">
                          {Object.entries(selectedNodeData.downstreamByType).map(([type, count]) => {
                            const cfg = NODE_CONFIG[type as EntityType];
                            return (
                              <div key={type} className="flex items-center justify-between py-1.5 px-2 rounded-md bg-[rgba(10,22,40,0.3)]">
                                <span className="font-body-sm text-[#E8F0FE]">{cfg?.label || type}</span>
                                <span className="font-mono text-sm" style={{ color: cfg?.color }}>{count}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.aside>

      {/* Main Canvas Area */}
      <div className="flex-1 relative">
        {/* Page Header */}
        <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="pointer-events-auto"
          >
            <h1 className="font-display-md text-[#E8F0FE]">Impact Visualizer</h1>
            {impactMode !== 'none' && selectedNodeData && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-mono text-[#7B2FFF] bg-[rgba(123,47,255,0.12)] px-2 py-0.5 rounded-full">
                  Impact mode: {impactMode}
                </span>
                <span className="text-xs font-mono text-[#4A6487]">
                  {selectedNodeData.downstreamCount + selectedNodeData.upstreamCount} nodes affected
                </span>
              </div>
            )}
          </motion.div>

          {/* Toolbar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25, delay: 0.08 }}
            className="flex items-center gap-2 pointer-events-auto"
          >
            {/* Layout selector */}
            <div className="flex items-center glass-frosted rounded-lg overflow-hidden">
              {([ 'hierarchical', 'force', 'grid' ] as const).map((layout) => (
                <button
                  key={layout}
                  onClick={() => setActiveLayout(layout)}
                  className={`px-3 py-2 text-xs font-heading-sm transition-all capitalize ${
                    activeLayout === layout
                      ? 'bg-[rgba(0,245,255,0.12)] text-[#00F5FF]'
                      : 'text-[#8BA4C7] hover:text-[#E8F0FE] hover:bg-[rgba(10,22,40,0.3)]'
                  }`}
                >
                  {layout}
                </button>
              ))}
            </div>

            <GlassButton variant="ghost" size="sm" icon={<Filter size={14} />} className="lg:hidden">
              Filters
            </GlassButton>
            <GlassButton variant="ghost" size="sm" icon={<Download size={14} />}>
              Export
            </GlassButton>
          </motion.div>
        </div>

        {/* React Flow Canvas */}
        <div className="w-full h-full" style={{ background: 'rgba(5, 10, 20, 0.6)' }}>
          <ReactFlow
            nodes={visibleNodes}
            edges={visibleEdges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onInit={setReactFlowInstance}
            fitView
            minZoom={0.2}
            maxZoom={2}
            attributionPosition="bottom-left"
            proOptions={{ hideAttribution: true }}
            style={{ background: 'transparent' }}
          >
            <Background
              gap={32}
              size={1}
              color="rgba(0, 245, 255, 0.03)"
              style={{ background: 'transparent' }}
            />
            <Controls
              className="!bg-[rgba(10,22,40,0.65)] !border-[rgba(138,180,230,0.1)] !shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
              style={{}}
            />
          </ReactFlow>
        </div>

        {/* Floating Zoom Controls (custom, bottom-right) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="absolute bottom-6 right-6 z-10 flex flex-col gap-1 p-1.5 rounded-lg glass-elevated"
        >
          <button
            onClick={() => reactFlowInstance?.zoomIn()}
            className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-[rgba(0,245,255,0.08)] transition-colors"
            aria-label="Zoom in"
          >
            <Plus size={16} className="text-[#8BA4C7]" />
          </button>
          <button
            onClick={() => reactFlowInstance?.zoomOut()}
            className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-[rgba(0,245,255,0.08)] transition-colors"
            aria-label="Zoom out"
          >
            <Minus size={16} className="text-[#8BA4C7]" />
          </button>
          <button
            onClick={() => reactFlowInstance?.fitView({ duration: 600 })}
            className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-[rgba(0,245,255,0.08)] transition-colors"
            aria-label="Fit view"
          >
            <Maximize2 size={16} className="text-[#8BA4C7]" />
          </button>
          <button
            onClick={() => applyLayout(activeLayout)}
            className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-[rgba(0,245,255,0.08)] transition-colors"
            aria-label="Reset layout"
          >
            <RotateCcw size={16} className="text-[#8BA4C7]" />
          </button>
        </motion.div>

        {/* Legend (bottom-right, above zoom controls) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="absolute bottom-6 left-6 z-10 p-3 rounded-lg glass-frosted hidden lg:block"
        >
          <div className="flex flex-col gap-1.5">
            {LEGEND_ITEMS.map((item) => {
              const config = NODE_CONFIG[item.type];
              return (
                <div key={item.type} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full border"
                    style={{ borderColor: config.color, backgroundColor: config.bgTint }}
                  />
                  <span className="text-[11px] text-[#8BA4C7]">{config.label}</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
