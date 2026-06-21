/**
 * Shared visual mapping for all Blueprint Graph render modes (2D SVG,
 * 3D grid, 3D force) - one source of truth so switching modes doesn't
 * change what a node/edge type means visually.
 */

import * as THREE from "three";

export const LAYER_ORDER: GraphNode["type"][] = [
  "actor",
  "capability",
  "use_case",
  "user_story",
  "engineering_task",
  "file",
];

/** Hex numbers (three.js Color/Material format). */
export const NODE_TYPE_COLORS: Record<GraphNode["type"], number> = {
  actor: 0x60a5fa,
  capability: 0xf59e0b,
  use_case: 0x34d399,
  user_story: 0xa78bfa,
  engineering_task: 0xfb7185,
  file: 0x94a3b8,
};

export const EDGE_TYPE_COLORS: Record<GraphEdge["type"], number> = {
  dependency: 0x94a3b8,
  traceability: 0x64748b,
  provenance: 0xcbd5e1,
};

export const SELECTED_COLOR = 0x2563eb;

export function nodeColorHex(type: GraphNode["type"]): string {
  return `#${NODE_TYPE_COLORS[type].toString(16).padStart(6, "0")}`;
}

/** One geometry per node type - shape is a second, color-independent way to
 * tell types apart (matches the 2D SVG view's use of distinct shapes per
 * type, rather than relying on color alone). Shared by both 3D render
 * modes so a "capability" looks the same (an octahedron) whichever one is
 * active. */
export function geometryFor(type: GraphNode["type"]): THREE.BufferGeometry {
  switch (type) {
    case "actor":
      return new THREE.SphereGeometry(7, 20, 16);
    case "capability":
      return new THREE.OctahedronGeometry(8);
    case "use_case":
      return new THREE.IcosahedronGeometry(7, 0);
    case "user_story":
      return new THREE.BoxGeometry(11, 11, 11);
    case "engineering_task":
      return new THREE.BoxGeometry(12, 7, 7);
    case "file":
      return new THREE.BoxGeometry(8, 10, 1.5);
  }
}
