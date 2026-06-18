import type { ThreeEvent } from "@react-three/fiber";
// =============================================================================
// PipelineGraph3D — Full 3D pipeline graph visualization using React Three Fiber
// Canvas fills RightSidebar, dark background, color-coded nodes, interactive
// =============================================================================

import { useRef, useMemo, useCallback, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import type { GraphNode, GraphEdge } from '@/types/domain';
import { useGraphStore } from '@/stores/graphStore';
import NodeTooltip from './NodeTooltip';
import NodeDetailPanel from './NodeDetailPanel';

// ── Stage colors (hex for Three.js) ──────────────────────────────────────────
const STAGE_COLORS: Record<string, string> = {
  prd_analysis: '#f59e0b',
  ideation: '#a855f7',
  actor_discovery: '#3b82f6',
  capability_discovery: '#22c55e',
  use_case_discovery: '#f97316',
  story_discovery: '#ec4899',
  task_decomposition: '#06b6d4',
};

const STAGE_EMISSIVE: Record<string, string> = {
  prd_analysis: '#b45309',
  ideation: '#7e22ce',
  actor_discovery: '#1d4ed8',
  capability_discovery: '#15803d',
  use_case_discovery: '#c2410c',
  story_discovery: '#be185d',
  task_decomposition: '#0e7490',
};

// ── Traceability opacity ─────────────────────────────────────────────────────
const TRACEABILITY_OPACITY: Record<string, number> = {
  EXPLICIT: 1.0,
  INFERRED: 0.7,
  CANDIDATE: 0.4,
};

// ── Node size by type ────────────────────────────────────────────────────────
const NODE_SIZE: Record<string, number> = {
  product_idea: 0.55,
  actor: 0.5,
  capability: 0.45,
  use_case: 0.4,
  user_story: 0.35,
  task: 0.3,
};

// ── Individual Node Mesh ─────────────────────────────────────────────────────
interface GraphNodeMeshProps {
  node: GraphNode;
  isHovered: boolean;
  isSelected: boolean;
  onHover: (nodeId: string | null) => void;
  onClick: (nodeId: string) => void;
  animationProgress: number;
}

function GraphNodeMesh({
  node,
  isHovered,
  isSelected,
  onHover,
  onClick,
  animationProgress,
}: GraphNodeMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const color = STAGE_COLORS[node.stage] ?? '#64748b';
  const emissive = STAGE_EMISSIVE[node.stage] ?? '#334155';
  const opacity = TRACEABILITY_OPACITY[node.traceability] ?? 0.5;
  const baseSize = NODE_SIZE[node.type] ?? 0.4;
  const size = isHovered ? baseSize * 1.4 : isSelected ? baseSize * 1.2 : baseSize;

  // Idle pulse animation
  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    const pulse = isHovered ? 1.15 + Math.sin(t * 6) * 0.05 : 1.0;
    meshRef.current.scale.setScalar(
      Math.max(0.01, animationProgress * size * pulse)
    );
  });

  const handlePointerOver = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      onHover(node.id);
      document.body.style.cursor = 'pointer';
    },
    [node.id, onHover]
  );

  const handlePointerOut = useCallback(() => {
    onHover(null);
    document.body.style.cursor = 'auto';
  }, [onHover]);

  const handleClick = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      onClick(node.id);
    },
    [node.id, onClick]
  );

  return (
    <mesh
      ref={meshRef}
      position={node.position}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      <sphereGeometry args={[1, 32, 32]} />
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={isHovered ? 0.8 : isSelected ? 0.5 : 0.25}
        transparent
        opacity={Math.max(0.01, animationProgress * opacity)}
        roughness={0.35}
        metalness={0.6}
      />
    </mesh>
  );
}

// ── Edge Line ────────────────────────────────────────────────────────────────
interface GraphEdgeLineProps {
  edge: GraphEdge;
  nodeFrom: GraphNode | undefined;
  nodeTo: GraphNode | undefined;
}

function GraphEdgeLine({ edge: _edge, nodeFrom, nodeTo }: GraphEdgeLineProps) {
  if (!nodeFrom || !nodeTo) return null;

  const points = useMemo(
    () => [new THREE.Vector3(...nodeFrom.position), new THREE.Vector3(...nodeTo.position)],
    [nodeFrom.position, nodeTo.position]
  );

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[new Float32Array([
            points[0].x, points[0].y, points[0].z,
            points[1].x, points[1].y, points[1].z,
          ]), 3]}
        />
      </bufferGeometry>
      <lineBasicMaterial color="#475569" transparent opacity={0.4} linewidth={1} />
    </line>
  );
}

// ── Camera Controller ────────────────────────────────────────────────────────
interface CameraControllerProps {
  targetPosition: [number, number, number] | null;
}

function CameraController({ targetPosition }: CameraControllerProps) {
  const { camera } = useThree();
  const smoothTarget = useRef(new THREE.Vector3(0, 0, 0));
  const smoothPos = useRef(new THREE.Vector3(0, 5, 15));

  useFrame(() => {
    if (targetPosition) {
      const target = new THREE.Vector3(...targetPosition);
      smoothTarget.current.lerp(target, 0.05);
      const idealPos = new THREE.Vector3(
        targetPosition[0] + 3,
        targetPosition[1] + 2,
        targetPosition[2] + 6
      );
      smoothPos.current.lerp(idealPos, 0.04);
      camera.position.copy(smoothPos.current);
      camera.lookAt(smoothTarget.current);
    }
  });

  return null;
}

// ── Animated Entry ───────────────────────────────────────────────────────────
function useEntryAnimation(_nodeCount: number) {
  const progressRef = useRef(0);
  const [progress, setProgress] = useState(0);

  useFrame((_, delta) => {
    if (progressRef.current < 1) {
      progressRef.current = Math.min(1, progressRef.current + delta * 1.5);
      setProgress(progressRef.current);
    }
  });

  // Stagger each node's entry by its index
  const getNodeProgress = useCallback(
    (index: number) => {
      const stagger = 0.08;
      const start = index * stagger;
      const end = start + 0.5;
      if (progress < start) return 0;
      if (progress > end) return 1;
      return (progress - start) / (end - start);
    },
    [progress]
  );

  return { getNodeProgress, progress };
}

// ── Scene Content ────────────────────────────────────────────────────────────
interface SceneContentProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  focusPosition: [number, number, number] | null;
  onHoverNode: (nodeId: string | null) => void;
  onSelectNode: (nodeId: string) => void;
}

function SceneContent({
  nodes,
  edges,
  selectedNodeId,
  hoveredNodeId,
  focusPosition,
  onHoverNode,
  onSelectNode,
}: SceneContentProps) {
  const { getNodeProgress } = useEntryAnimation(nodes.length);

  // Node lookup for edges
  const nodeMap = useMemo(() => {
    const map = new Map<string, GraphNode>();
    nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [nodes]);

  return (
    <>
      <CameraController targetPosition={focusPosition} />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={2}
        maxDistance={60}
        target={[0, 0, 0]}
      />

      {/* Lighting */}
      <ambientLight intensity={0.3} />
      <directionalLight position={[10, 10, 10]} intensity={1.2} color="#e2e8f0" />
      <directionalLight position={[-10, -5, -10]} intensity={0.4} color="#64748b" />
      <pointLight position={[0, 8, 0]} intensity={0.6} color="#f8fafc" distance={30} />

      {/* Starfield background */}
      <Stars radius={50} depth={80} count={800} factor={3} saturation={0.1} fade speed={0.5} />

      {/* Edges */}
      {edges.map((edge) => (
        <GraphEdgeLine
          key={edge.id}
          edge={edge}
          nodeFrom={nodeMap.get(edge.from)}
          nodeTo={nodeMap.get(edge.to)}
        />
      ))}

      {/* Nodes */}
      {nodes.map((node, index) => (
        <GraphNodeMesh
          key={node.id}
          node={node}
          isHovered={hoveredNodeId === node.id}
          isSelected={selectedNodeId === node.id}
          onHover={onHoverNode}
          onClick={onSelectNode}
          animationProgress={getNodeProgress(index)}
        />
      ))}

      {/* Tooltip for hovered node */}
      {hoveredNodeId && (() => {
        const hoveredNode = nodes.find((n) => n.id === hoveredNodeId);
        return hoveredNode ? <NodeTooltip node={hoveredNode} /> : null;
      })()}
    </>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function PipelineGraph3D() {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const hoveredNodeId = useGraphStore((s) => s.hoveredNodeId);
  const selectNode = useGraphStore((s) => s.selectNode);
  const setHoveredNode = useGraphStore((s) => s.setHoveredNode);
  const setCameraPosition = useGraphStore((s) => s.setCameraPosition);

  const [focusPosition, setFocusPosition] = useState<[number, number, number] | null>(null);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId]
  );

  const handleFocusCamera = useCallback(
    (position: [number, number, number]) => {
      setFocusPosition(position);
      setCameraPosition(position);
    },
    [setCameraPosition]
  );

  const handleSelectNode = useCallback(
    (nodeId: string) => {
      selectNode(nodeId);
      const node = nodes.find((n) => n.id === nodeId);
      if (node) {
        handleFocusCamera(node.position);
      }
    },
    [selectNode, nodes, handleFocusCamera]
  );

  const handleClosePanel = useCallback(() => {
    selectNode(null);
    setFocusPosition(null);
  }, [selectNode]);

  return (
    <div className="relative h-full w-full" style={{ background: '#0a0a0a' }}>
      <Canvas
        camera={{ position: [0, 5, 15], fov: 50, near: 0.1, far: 200 }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => {
          gl.setClearColor('#0a0a0a');
        }}
        style={{ width: '100%', height: '100%' }}
      >
        <SceneContent
          nodes={nodes}
          edges={edges}
          selectedNodeId={selectedNodeId}
          hoveredNodeId={hoveredNodeId}
          focusPosition={focusPosition}
          onHoverNode={setHoveredNode}
          onSelectNode={handleSelectNode}
        />
      </Canvas>

      {/* Node detail panel overlay */}
      <NodeDetailPanel
        node={selectedNode}
        edges={edges}
        onFocusCamera={handleFocusCamera}
        onClose={handleClosePanel}
      />

      {/* Empty state overlay */}
      {nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-sm font-medium text-slate-500">Pipeline Graph</p>
            <p className="mt-1 text-xs text-slate-600">Nodes will appear as pipeline progresses</p>
          </div>
        </div>
      )}

      {/* Node count badge */}
      {nodes.length > 0 && (
        <div className="absolute bottom-2 left-2 rounded bg-slate-900/80 px-2 py-1 text-[10px] font-mono text-slate-400 backdrop-blur-sm">
          {nodes.length} nodes | {edges.length} edges
        </div>
      )}
    </div>
  );
}