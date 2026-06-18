/**
 * 3D Force-Directed Graph using Three.js.
 *
 * Hierarchy (root → leaves, each level at +Y delta from its parent):
 *   Project (root)
 *     └─ Actors          (+Y)
 *        └─ Capabilities  (+Y)
 *           └─ Use Cases   (+Y)
 *              └─ Stories   (+Y)
 *                 └─ Tasks   (+Y)
 *
 * Nodes are positioned by type-layer initially, then a lightweight
 * force simulation (repulsion + spring + Y-axis constraint) relaxes
 * positions so siblings don't overlap while keeping the layered +Y
 * structure.
 *
 * Graph3DNode now supports hierarchy via `children` array.
 */

import * as THREE from 'three';

export interface Graph3DNode {
  id: string;
  label: string;
  type: 'project' | 'actor' | 'capability' | 'use-case' | 'story' | 'task';
  children?: Graph3DNode[];  // Hierarchical children
  // Optional data for detail view
  data?: {
    description?: string;
    state?: string;
    taskType?: string;
    contract?: { pre: string[]; post: string[]; inv: string[]; frame: string[] };
  };
}

export interface Graph3DEdge {
  source: string;
  target: string;
}

export interface Graph3DData {
  nodes: Graph3DNode[];
  links: Graph3DEdge[];
}

const TYPE_COLORS: Record<Graph3DNode['type'], number> = {
  project: 0x00F5FF,
  actor: 0x00F5FF,
  capability: 0x7B2FFF,
  'use-case': 0x39FF14,
  story: 0xFFB800,
  task: 0x8BA4C7,
};

const TYPE_SIZES: Record<Graph3DNode['type'], number> = {
  project: 18,
  actor: 12,
  capability: 9,
  'use-case': 7,
  story: 6,
  task: 5,
};

const LAYER_Y: Record<Graph3DNode['type'], number> = {
  project: 0,
  actor: -80,
  capability: -160,
  'use-case': -240,
  story: -320,
  task: -400,
};

interface SimNode {
  id: string;
  label: string;
  type: Graph3DNode['type'];
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  fixedY: number;
}

interface SimEdge {
  src: SimNode;
  tgt: SimNode;
}

const MAX_NODES_FOR_LABELS = 60;

export class ForceGraph3D {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private clock: THREE.Clock;
  private container: HTMLElement;

  private nodes: SimNode[] = [];
  private edges: SimEdge[] = [];
  private nodeMeshes: THREE.Mesh[] = [];
  private labelSprites: THREE.Sprite[] = [];
  private glowMeshes: THREE.Mesh[] = [];
  private lineSegments: THREE.LineSegments | null = null;

  private raycaster: THREE.Raycaster;
  private pointer: THREE.Vector2;
  private hovered: SimNode | null = null;

  private running = true;
  private animationId = 0;
  private simSteps = 0;
  private readonly maxSimSteps = 300;

  // Camera orbit controls
  private isDragging = false;
  private isPanning = false;
  private prevMouse = { x: 0, y: 0 };
  private targetRotation = { theta: 0.6, phi: 1.1 };
  private currentRotation = { theta: 0.6, phi: 1.1 };
  private targetDistance = 600;
  private currentDistance = 800;
  private panTarget = new THREE.Vector3(0, -160, 0);

  private tooltip: HTMLDivElement;
  private onNodeClick?: (node: Graph3DNode) => void;

  constructor(container: HTMLElement, onNodeClick?: (node: Graph3DNode) => void) {
    this.container = container;
    this.onNodeClick = onNodeClick;
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 600;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x050A14, 0.0008);

    this.camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 5000);
    this.updateCameraPosition();

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    container.appendChild(this.renderer.domElement);

    this.clock = new THREE.Clock();
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    this.scene.add(new THREE.AmbientLight(0x4A6487, 0.6));
    const pl1 = new THREE.PointLight(0x00F5FF, 1.2, 1200);
    pl1.position.set(0, 200, 400);
    this.scene.add(pl1);
    const pl2 = new THREE.PointLight(0x7B2FFF, 0.8, 1200);
    pl2.position.set(-300, -100, 300);
    this.scene.add(pl2);

    this.tooltip = document.createElement('div');
    this.tooltip.style.cssText = `
      position: absolute;
      pointer-events: none;
      padding: 8px 12px;
      background: rgba(10,22,40,0.92);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(0,245,255,0.3);
      border-radius: 8px;
      color: #E8F0FE;
      font-family: 'Inter', sans-serif;
      font-size: 12px;
      white-space: nowrap;
      opacity: 0;
      transition: opacity 0.15s;
      z-index: 10;
      box-shadow: 0 4px 24px rgba(0,0,0,0.5), 0 0 16px rgba(0,245,255,0.08);
      max-width: 280px;
    `;
    container.appendChild(this.tooltip);

    this.setupControls();
    this.animate = this.animate.bind(this);
  }

  // ── Public API ──────────────────────────────────────────────────

  setData(data: Graph3DData) {
    this.clear();
    const { nodes, links } = data;
    if (nodes.length === 0) return;

    const nodeMap = this.buildNodes(nodes);
    this.storeEdges(links, nodeMap);
    this.createMeshes();
    this.buildLines();
    this.panTarget.set(0, -160, 0);
    this.targetDistance = Math.max(400, this.nodes.length * 8);
  }

  /**
   * Set data from hierarchical Graph3DNode (root node with children).
   * Flattens the hierarchy and builds links automatically.
   */
  setHierarchicalData(root: Graph3DNode) {
    this.clear();
    if (!root) return;

    const nodes: Graph3DNode[] = [];
    const links: Graph3DEdge[] = [];

    // Flatten hierarchy and build links
    const traverse = (node: Graph3DNode, parentId: string | null) => {
      nodes.push(node);
      if (parentId) {
        links.push({ source: parentId, target: node.id });
      }
      if (node.children) {
        for (const child of node.children) {
          traverse(child, node.id);
        }
      }
    };

    traverse(root, null);

    if (nodes.length === 0) return;

    const nodeMap = this.buildNodes(nodes);
    this.storeEdges(links, nodeMap);
    this.createMeshes();
    this.buildLines();
    this.panTarget.set(0, -160, 0);
    this.targetDistance = Math.max(400, this.nodes.length * 8);
  }

  start() { this.running = true; this.clock.start(); this.animate(); }
  stop() { this.running = false; cancelAnimationFrame(this.animationId); }

  resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  dispose() {
    this.stop();
    this.clear();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
    if (this.tooltip.parentElement === this.container) {
      this.container.removeChild(this.tooltip);
    }
  }

  // ── Node building ───────────────────────────────────────────────

  private buildNodes(nodes: Graph3DNode[]): Map<string, SimNode> {
    const nodeMap = new Map<string, SimNode>();
    const byType: Record<string, Graph3DNode[]> = {};
    nodes.forEach((n) => { (byType[n.type] ||= []).push(n); });

    for (const [type, list] of Object.entries(byType)) {
      const y = LAYER_Y[type as Graph3DNode['type']] ?? 0;
      const count = list.length;
      const radius = Math.max(40, count * 18);
      list.forEach((n, i) => {
        const angle = (i / count) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const sn: SimNode = {
          id: n.id,
          label: n.label,
          type: n.type,
          pos: new THREE.Vector3(x, y, z),
          vel: new THREE.Vector3(),
          fixedY: y,
        };
        nodeMap.set(n.id, sn);
        this.nodes.push(sn);
      });
    }
    return nodeMap;
  }

  private storeEdges(links: Graph3DEdge[], nodeMap: Map<string, SimNode>) {
    this.edges = [];
    links.forEach((link) => {
      const src = nodeMap.get(link.source);
      const tgt = nodeMap.get(link.target);
      if (src && tgt) this.edges.push({ src, tgt });
    });
  }

  private createMeshes() {
    const showLabels = this.nodes.length <= MAX_NODES_FOR_LABELS;

    this.nodes.forEach((node) => {
      const color = TYPE_COLORS[node.type];
      const size = TYPE_SIZES[node.type];

      // Core sphere
      const geo = new THREE.SphereGeometry(size, 32, 32);
      const mat = new THREE.MeshPhongMaterial({
        color, emissive: color, emissiveIntensity: 0.4,
        shininess: 80, transparent: true, opacity: 0.92,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(node.pos);
      mesh.userData.simNode = node;
      this.scene.add(mesh);
      this.nodeMeshes.push(mesh);

      // Glow halo
      const glowGeo = new THREE.SphereGeometry(size * 1.8, 16, 16);
      const glowMat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.08, depthWrite: false,
      });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.position.copy(node.pos);
      this.scene.add(glow);
      this.glowMeshes.push(glow);

      // Label sprite
      if (showLabels) {
        const sprite = this.makeTextSprite(node.label, color);
        sprite.position.copy(node.pos);
        sprite.position.y += size + 14;
        this.scene.add(sprite);
        this.labelSprites.push(sprite);
      }
    });
  }

  private makeTextSprite(text: string, color: number): THREE.Sprite {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const fontSize = 48;
    ctx.font = `${fontSize}px Inter, sans-serif`;
    const metrics = ctx.measureText(text);
    canvas.width = Math.ceil(metrics.width) + 24;
    canvas.height = fontSize + 16;
    ctx.font = `${fontSize}px Inter, sans-serif`;
    ctx.fillStyle = 'rgba(10,22,40,0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const hex = '#' + color.toString(16).padStart(6, '0');
    ctx.fillStyle = hex;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 12, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(canvas.width * 0.25, canvas.height * 0.25, 1);
    return sprite;
  }

  private buildLines() {
    const positions: number[] = [];
    const colors: number[] = [];

    this.edges.forEach(({ src, tgt }) => {
      positions.push(src.pos.x, src.pos.y, src.pos.z);
      positions.push(tgt.pos.x, tgt.pos.y, tgt.pos.z);
      const c = new THREE.Color(TYPE_COLORS[tgt.type]);
      colors.push(c.r * 0.4, c.g * 0.4, c.b * 0.4);
      colors.push(c.r * 0.6, c.g * 0.6, c.b * 0.6);
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const mat = new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.35,
    });
    this.lineSegments = new THREE.LineSegments(geo, mat);
    this.scene.add(this.lineSegments);
  }

  // ── Force simulation ─────────────────────────────────────────────

  private simulate(dt: number) {
    if (this.simSteps >= this.maxSimSteps) return;
    this.simSteps++;

    const repulsion = 3000;
    const springK = 0.02;
    const springLength = 60;
    const damping = 0.82;
    const yConstraint = 0.35;

    const n = this.nodes.length;

    // Repulsion (same-layer or nearby layers only)
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = this.nodes[i];
        const b = this.nodes[j];
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const distSq = dx * dx + dz * dz || 1;
        const dist = Math.sqrt(distSq);
        if (Math.abs(a.fixedY - b.fixedY) < 50 && dist < 120) {
          const force = repulsion / distSq;
          const fx = (dx / dist) * force;
          const fz = (dz / dist) * force;
          a.vel.x -= fx;
          a.vel.z -= fz;
          b.vel.x += fx;
          b.vel.z += fz;
        }
      }
    }

    // Spring along edges
    this.edges.forEach(({ src, tgt }) => {
      const dx = tgt.pos.x - src.pos.x;
      const dy = tgt.pos.y - src.pos.y;
      const dz = tgt.pos.z - src.pos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      const displacement = dist - springLength;
      const fx = (dx / dist) * displacement * springK;
      const fz = (dz / dist) * displacement * springK;
      src.vel.x += fx;
      src.vel.z += fz;
      tgt.vel.x -= fx;
      tgt.vel.z -= fz;
    });

    // Integrate + Y constraint
    for (const node of this.nodes) {
      node.vel.x *= damping;
      node.vel.z *= damping;
      node.pos.x += node.vel.x * dt;
      node.pos.z += node.vel.z * dt;
      const yDelta = node.fixedY - node.pos.y;
      node.vel.y = yDelta * yConstraint;
      node.pos.y += node.vel.y * dt;
    }
  }

  // ── Controls ────────────────────────────────────────────────────

  private setupControls() {
    const el = this.renderer.domElement;

    el.addEventListener('mousedown', (e) => {
      this.prevMouse = { x: e.clientX, y: e.clientY };
      if (e.button === 2 || e.shiftKey) this.isPanning = true;
      else this.isDragging = true;
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
      this.isPanning = false;
    });

    el.addEventListener('mousemove', (e) => {
      const rect = el.getBoundingClientRect();
      this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (this.isDragging) {
        const dx = e.clientX - this.prevMouse.x;
        const dy = e.clientY - this.prevMouse.y;
        this.targetRotation.theta -= dx * 0.005;
        this.targetRotation.phi = Math.max(0.15, Math.min(Math.PI - 0.15, this.targetRotation.phi - dy * 0.005));
        this.prevMouse = { x: e.clientX, y: e.clientY };
      } else if (this.isPanning) {
        const dx = e.clientX - this.prevMouse.x;
        const dy = e.clientY - this.prevMouse.y;
        this.panTarget.x += dx * 0.5;
        this.panTarget.y -= dy * 0.5;
        this.prevMouse = { x: e.clientX, y: e.clientY };
      } else {
        this.handleHover(e);
      }
    });

    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.targetDistance += e.deltaY * 0.3;
      this.targetDistance = Math.max(150, Math.min(2000, this.targetDistance));
    }, { passive: false });

    el.addEventListener('click', () => {
      if (this.hovered && this.onNodeClick) {
        this.onNodeClick({
          id: this.hovered.id,
          label: this.hovered.label,
          type: this.hovered.type,
        });
      }
    });

    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private handleHover(e: MouseEvent) {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersects = this.raycaster.intersectObjects(this.nodeMeshes);

    if (intersects.length > 0) {
      const simNode = intersects[0].object.userData.simNode as SimNode;
      this.hovered = simNode;
      const color = '#' + TYPE_COLORS[simNode.type].toString(16).padStart(6, '0');
      const containerRect = this.container.getBoundingClientRect();
      this.tooltip.innerHTML =
        `<strong style="color:${color}">${simNode.label}</strong>` +
        `<br><span style="color:#4A6487;font-size:10px;text-transform:uppercase">${simNode.type}</span>`;
      this.tooltip.style.left = `${e.clientX - containerRect.left + 12}px`;
      this.tooltip.style.top = `${e.clientY - containerRect.top + 12}px`;
      this.tooltip.style.opacity = '1';
      this.renderer.domElement.style.cursor = 'pointer';
    } else {
      this.hovered = null;
      this.tooltip.style.opacity = '0';
      this.renderer.domElement.style.cursor = 'grab';
    }
  }

  // ── Camera ──────────────────────────────────────────────────────

  private updateCameraPosition() {
    const r = this.currentDistance;
    const { theta, phi } = this.currentRotation;
    this.camera.position.set(
      this.panTarget.x + r * Math.sin(phi) * Math.cos(theta),
      this.panTarget.y + r * Math.cos(phi),
      this.panTarget.z + r * Math.sin(phi) * Math.sin(theta),
    );
    this.camera.lookAt(this.panTarget);
  }

  // ── Render loop ─────────────────────────────────────────────────

  private animate() {
    if (!this.running) return;
    this.animationId = requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), 0.05);

    this.simulate(dt);

    // Update mesh positions
    this.nodeMeshes.forEach((mesh, i) => {
      mesh.position.copy(this.nodes[i].pos);
    });
    this.glowMeshes.forEach((mesh, i) => {
      mesh.position.copy(this.nodes[i].pos);
    });
    this.labelSprites.forEach((sprite, i) => {
      sprite.position.copy(this.nodes[i].pos);
      sprite.position.y += TYPE_SIZES[this.nodes[i].type] + 14;
    });

    // Update line positions
    if (this.lineSegments) {
      const positions = this.lineSegments.geometry.attributes.position.array as Float32Array;
      let idx = 0;
      this.edges.forEach(({ src, tgt }) => {
        positions[idx++] = src.pos.x;
        positions[idx++] = src.pos.y;
        positions[idx++] = src.pos.z;
        positions[idx++] = tgt.pos.x;
        positions[idx++] = tgt.pos.y;
        positions[idx++] = tgt.pos.z;
      });
      this.lineSegments.geometry.attributes.position.needsUpdate = true;
    }

    // Smooth camera orbit
    this.currentRotation.theta += (this.targetRotation.theta - this.currentRotation.theta) * 0.08;
    this.currentRotation.phi += (this.targetRotation.phi - this.currentRotation.phi) * 0.08;
    this.currentDistance += (this.targetDistance - this.currentDistance) * 0.08;

    this.updateCameraPosition();
    this.renderer.render(this.scene, this.camera);
  }

  // ── Cleanup ─────────────────────────────────────────────────────

  private clear() {
    this.nodes = [];
    this.edges = [];
    this.nodeMeshes.forEach((m) => this.scene.remove(m));
    this.glowMeshes.forEach((m) => this.scene.remove(m));
    this.labelSprites.forEach((s) => this.scene.remove(s));
    if (this.lineSegments) this.scene.remove(this.lineSegments);
    this.nodeMeshes = [];
    this.glowMeshes = [];
    this.labelSprites = [];
    this.lineSegments = null;
    this.simSteps = 0;
  }
}