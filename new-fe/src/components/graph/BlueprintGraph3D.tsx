import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { EDGE_TYPE_COLORS, geometryFor, LAYER_ORDER, NODE_TYPE_COLORS, SELECTED_COLOR } from "./graphVisuals";
import styles from "./BlueprintGraph3D.module.css";

const LAYER_SPACING = 70;
const RADIUS_PER_NODE = 16;
const MIN_RADIUS = 36;

/** Layer-grouped layout: each `LAYER_ORDER` type gets its own Y "floor",
 * nodes within a floor spread around a circle. Falls back to this whenever
 * a node's x/y/z (doc/api_event_contract.md SS4.8 - "layout position") is
 * unset, which is always today (the backend has no layout engine). */
function computeLayout(nodes: GraphNode[]): Map<string, THREE.Vector3> {
  const byType = new Map<GraphNode["type"], GraphNode[]>();
  for (const n of nodes) {
    const list = byType.get(n.type) ?? [];
    list.push(n);
    byType.set(n.type, list);
  }

  const positions = new Map<string, THREE.Vector3>();
  const totalHeight = (LAYER_ORDER.length - 1) * LAYER_SPACING;
  LAYER_ORDER.forEach((type, layerIndex) => {
    const layerNodes = byType.get(type) ?? [];
    const y = layerIndex * LAYER_SPACING - totalHeight / 2;
    const radius = Math.max(MIN_RADIUS, (layerNodes.length * RADIUS_PER_NODE) / (2 * Math.PI));
    layerNodes.forEach((n, i) => {
      const angle = (i / Math.max(layerNodes.length, 1)) * Math.PI * 2;
      const x = n.x ?? radius * Math.cos(angle);
      const z = n.z ?? radius * Math.sin(angle);
      positions.set(n.id, new THREE.Vector3(x, n.y ?? y, z));
    });
  });
  return positions;
}

interface BlueprintGraph3DProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

/** doc/wireframes.md §3.8 — Blueprint Graph 3D mode. Raw three.js (no
 * graph-specific library): a hand-rolled layered layout mirroring the 2D
 * view's row grouping, OrbitControls for orbit/zoom/pan, CSS2DRenderer for
 * name labels, raycasting for click-to-select. */
export function BlueprintGraph3D({ nodes, edges, selectedId, onSelect }: BlueprintGraph3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const labelRendererRef = useRef<CSS2DRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const meshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const raycasterRef = useRef(new THREE.Raycaster());

  // One-time scene/camera/renderer/controls setup.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, 1, 1, 5000);
    camera.position.set(160, 120, 220);
    cameraRef.current = camera;

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(100, 200, 100);
    scene.add(dirLight);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    const labelRenderer = new CSS2DRenderer();
    labelRenderer.domElement.className = styles.labelLayer;
    labelRendererRef.current = labelRenderer;
    container.appendChild(labelRenderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.minDistance = 40;
    controls.maxDistance = 1500;
    controlsRef.current = controls;

    function resize() {
      const clientWidth = container?.clientWidth ?? 0;
      const clientHeight = container?.clientHeight ?? 0;
      if (clientWidth === 0 || clientHeight === 0) return;
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(clientWidth, clientHeight);
      labelRenderer.setSize(clientWidth, clientHeight);
    }
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    let downPos: { x: number; y: number } | null = null;
    function onPointerDown(e: PointerEvent) {
      downPos = { x: e.clientX, y: e.clientY };
    }
    function onPointerUp(e: PointerEvent) {
      if (!downPos) return;
      const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
      downPos = null;
      if (moved > 5) return; // drag (orbit/pan), not a click

      const rect = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycasterRef.current.setFromCamera(mouse, camera);
      const hits = raycasterRef.current.intersectObjects([...meshesRef.current.values()]);
      onSelectRef.current(hits.length > 0 ? (hits[0].object.userData.nodeId as string) : null);
    }
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);

    let frameId: number;
    function tick() {
      controls.update();
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
      frameId = requestAnimationFrame(tick);
    }
    tick();

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      controls.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
      container.removeChild(labelRenderer.domElement);
    };
  }, []);

  // Rebuild geometry whenever the graph data changes.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const toRemove = scene.children.filter((c) => c.userData.graphObject);
    for (const obj of toRemove) {
      scene.remove(obj);
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) {
        obj.geometry.dispose();
        (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach((m) => m.dispose());
      }
    }
    meshesRef.current.clear();

    const positions = computeLayout(nodes);

    for (const node of nodes) {
      const pos = positions.get(node.id);
      if (!pos) continue;
      const geometry = geometryFor(node.type);
      const material = new THREE.MeshStandardMaterial({ color: NODE_TYPE_COLORS[node.type] });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(pos);
      mesh.userData.graphObject = true;
      mesh.userData.nodeId = node.id;
      scene.add(mesh);
      meshesRef.current.set(node.id, mesh);

      const label = document.createElement("div");
      label.className = styles.label;
      label.textContent = node.name;
      const labelObject = new CSS2DObject(label);
      labelObject.position.set(0, 10, 0);
      labelObject.userData.graphObject = true;
      mesh.add(labelObject);
    }

    for (const edge of edges) {
      const source = positions.get(edge.source);
      const target = positions.get(edge.target);
      if (!source || !target) continue;
      const geometry = new THREE.BufferGeometry().setFromPoints([source, target]);
      const dashed = edge.type !== "dependency";
      const material = dashed
        ? new THREE.LineDashedMaterial({
            color: EDGE_TYPE_COLORS[edge.type],
            dashSize: edge.type === "provenance" ? 1.5 : 4,
            gapSize: 3,
          })
        : new THREE.LineBasicMaterial({ color: EDGE_TYPE_COLORS[edge.type] });
      const line = new THREE.Line(geometry, material);
      if (dashed) line.computeLineDistances();
      line.userData.graphObject = true;
      scene.add(line);
    }
  }, [nodes, edges]);

  // Highlight the selected node without rebuilding the whole scene.
  useEffect(() => {
    for (const [id, mesh] of meshesRef.current) {
      const material = mesh.material as THREE.MeshStandardMaterial;
      const isSelected = id === selectedId;
      material.emissive.set(isSelected ? SELECTED_COLOR : 0x000000);
      material.emissiveIntensity = 0.6;
      mesh.scale.setScalar(isSelected ? 1.35 : 1);
    }
  }, [selectedId, nodes]);

  return <div ref={containerRef} className={styles.viewport} />;
}
