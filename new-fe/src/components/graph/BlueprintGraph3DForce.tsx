import { useEffect, useRef } from "react";
import * as THREE from "three";
import ForceGraph3D, { type ForceGraph3DInstance } from "3d-force-graph";
import { EDGE_TYPE_COLORS, geometryFor, NODE_TYPE_COLORS, SELECTED_COLOR } from "./graphVisuals";
import styles from "./BlueprintGraph3DForce.module.css";

interface BlueprintGraph3DForceProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

function buildNodeObject(node: GraphNode, isSelected: boolean): THREE.Mesh {
  const material = new THREE.MeshStandardMaterial({ color: NODE_TYPE_COLORS[node.type] });
  if (isSelected) {
    material.emissive.set(SELECTED_COLOR);
    material.emissiveIntensity = 0.6;
  }
  const mesh = new THREE.Mesh(geometryFor(node.type), material);
  if (isSelected) mesh.scale.setScalar(1.5);
  return mesh;
}

/** doc/wireframes.md §3.8 — Blueprint Graph 3D mode, force-directed
 * alternative to `BlueprintGraph3D`'s hand-rolled layered layout. Wraps the
 * `3d-force-graph` library (three.js + d3-force-3d + its own orbit/zoom/pan
 * controls) directly over the same real `GraphData` - no separate layout
 * code needed here, the library's physics simulation positions nodes.
 *
 * Nodes render via `nodeThreeObject` using the same per-type geometry as
 * `BlueprintGraph3D` (`graphVisuals.geometryFor`) rather than the library's
 * default sphere - shape, not just color, distinguishes node types here too,
 * matching the 2D SVG view's approach.
 *
 * The library's bundled types model nodes/links as the generic, mostly-
 * optional `NodeObject`/`LinkObject` shapes (id/x/y/z/source/target) rather
 * than being generic over our `GraphNode`/`GraphEdge` - every accessor
 * below casts back to our real DTOs rather than fighting that. */
export function BlueprintGraph3DForce({ nodes, edges, selectedId, onSelect }: BlueprintGraph3DForceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraph3DInstance | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const graph = new ForceGraph3D(container)
      .backgroundColor("#f8fafc")
      .nodeLabel((n) => (n as unknown as GraphNode).name)
      .nodeThreeObject((n) => buildNodeObject(n as unknown as GraphNode, n.id === selectedIdRef.current))
      .nodeThreeObjectExtend(false)
      .linkColor((l) => `#${EDGE_TYPE_COLORS[(l as unknown as GraphEdge).type].toString(16).padStart(6, "0")}`)
      .linkWidth(1)
      .onNodeClick((n) => onSelectRef.current(n.id != null ? String(n.id) : null))
      .onBackgroundClick(() => onSelectRef.current(null))
      .showNavInfo(false);
    graphRef.current = graph;

    function resize() {
      graph.width(container?.clientWidth ?? 0).height(container?.clientHeight ?? 0);
    }
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      graph._destructor();
      graphRef.current = null;
    };
    // Only re-created on mount; data/selection are pushed via separate effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    graphRef.current?.graphData({ nodes, links: edges });
  }, [nodes, edges]);

  useEffect(() => {
    // nodeThreeObject's accessor reads selectedIdRef (already updated above
    // on this render) - refresh() forces it to re-run for every node so the
    // newly (de)selected node's mesh actually rebuilds with the highlight.
    graphRef.current?.refresh();
  }, [selectedId]);

  return <div ref={containerRef} className={styles.viewport} />;
}
