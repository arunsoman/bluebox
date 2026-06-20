import { useEffect, useMemo, useState } from "react";
import { Spinner } from "@/components/common/Spinner";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/common/Button";
import { useToast } from "@/components/common/Toast/ToastContext";
import { usePipelineStore } from "@/stores/pipelineStore";
import { useAuditNavigationStore } from "@/stores/auditNavigationStore";
import { useNodeEditorStore, type EditableNodeType } from "@/stores/nodeEditorStore";
import { graphApi } from "@/api/endpoints/graph";
import { socketClient } from "@/ws/socketClient";
import { ApiError } from "@/api/httpClient";
import styles from "./BlueprintGraph.module.css";

const LAYER_ORDER: GraphNode["type"][] = ["actor", "capability", "use_case", "user_story", "engineering_task", "file"];

const FILTER_OPTIONS: { type: GraphNode["type"]; label: string }[] = [
  { type: "actor", label: "Actors" },
  { type: "capability", label: "Caps" },
  { type: "use_case", label: "Use Cases" },
  { type: "user_story", label: "Stories" },
  { type: "engineering_task", label: "Tasks" },
  { type: "file", label: "Files" },
];

const ROW_HEIGHT = 110;
const COL_WIDTH = 150;
const NODE_W = 96;
const NODE_H = 40;

interface LaidOutNode extends GraphNode {
  px: number;
  py: number;
}

function layout(nodes: GraphNode[]): LaidOutNode[] {
  const byLayer = new Map<string, GraphNode[]>();
  for (const n of nodes) {
    const list = byLayer.get(n.type) ?? [];
    list.push(n);
    byLayer.set(n.type, list);
  }
  const out: LaidOutNode[] = [];
  LAYER_ORDER.forEach((type, rowIndex) => {
    const row = byLayer.get(type) ?? [];
    row.forEach((n, colIndex) => {
      out.push({
        ...n,
        px: n.x ?? colIndex * COL_WIDTH + 60,
        py: n.y ?? rowIndex * ROW_HEIGHT + 40,
      });
    });
  });
  return out;
}

function NodeShape({ type, selected }: { type: GraphNode["type"]; selected: boolean }) {
  const cls = `${styles.nodeShape} ${selected ? styles.nodeSelected : ""}`;
  switch (type) {
    case "actor":
      return <ellipse cx={NODE_W / 2} cy={NODE_H / 2} rx={NODE_W / 2} ry={NODE_H / 2} className={cls} />;
    case "capability":
      return (
        <polygon
          points={`${NODE_W / 2},0 ${NODE_W},${NODE_H / 2} ${NODE_W / 2},${NODE_H} 0,${NODE_H / 2}`}
          className={cls}
        />
      );
    case "use_case":
      return <ellipse cx={NODE_W / 2} cy={NODE_H / 2} rx={NODE_W / 2 - 4} ry={NODE_H / 2 - 2} className={cls} />;
    default:
      return <rect width={NODE_W} height={NODE_H} rx={type === "file" ? 2 : 6} className={cls} />;
  }
}

/** doc/wireframes.md §3.8 — Blueprint Graph. 2D SVG render of real GraphData; 3D and What-If both depend on capability deliberately excluded from this pass (3D engine, Impact Report Overlay), so both toggles render disabled with honest tooltips. */
export function BlueprintGraph() {
  const projectId = usePipelineStore((s) => s.projectId);
  const focusLedger = useAuditNavigationStore((s) => s.focusLedger);
  const openEdit = useNodeEditorStore((s) => s.openEdit);
  const { pushToast } = useToast();

  const [graph, setGraph] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [visibleTypes, setVisibleTypes] = useState<Set<GraphNode["type"]>>(
    new Set(FILTER_OPTIONS.map((f) => f.type)),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [steerOpen, setSteerOpen] = useState(false);
  const [steerInstruction, setSteerInstruction] = useState("");

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    graphApi
      .getGraph(projectId, { include_files: true })
      .then(setGraph)
      .catch((err: unknown) => pushToast({ severity: "error", title: "Could not load graph", body: err instanceof ApiError ? err.message : "Unknown error" }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const laidOut = useMemo(() => layout(graph?.nodes ?? []), [graph]);
  const positionById = useMemo(() => new Map(laidOut.map((n) => [n.id, n])), [laidOut]);
  const visibleNodes = laidOut.filter((n) => visibleTypes.has(n.type));
  const visibleIds = new Set(visibleNodes.map((n) => n.id));
  const visibleEdges = (graph?.edges ?? []).filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target));

  const maxX = Math.max(...visibleNodes.map((n) => n.px + NODE_W + 40), 400);
  const maxY = Math.max(...visibleNodes.map((n) => n.py + NODE_H + 40), 300);

  const selected = laidOut.find((n) => n.id === selectedId) ?? null;

  function toggleFilter(type: GraphNode["type"]) {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  function sendSteer() {
    if (!selected || !steerInstruction.trim()) return;
    socketClient.emit("GRAPH_NODE_STEER", { node_id: selected.id, instruction: steerInstruction });
    pushToast({ severity: "success", title: "Steering instruction sent" });
    setSteerOpen(false);
    setSteerInstruction("");
  }

  const decisionEntryId = (selected?.data as Record<string, unknown> | undefined)?.provenance
    ? ((selected!.data as { provenance?: { decision_entry_id?: string } }).provenance?.decision_entry_id ?? null)
    : null;

  if (loading) return <Spinner />;
  if (!graph || graph.nodes.length === 0) {
    return <EmptyState title="No graph data yet" description="The Blueprint Graph populates as nodes are created in the pipeline." />;
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.modeToggle}>
          <button className={`${styles.modeButton} ${styles.modeButtonActive}`}>2D</button>
          <button className={`${styles.modeButton} ${styles.modeButtonDisabled}`} disabled title="Not yet available — 3D rendering is out of scope for this pass">
            3D
          </button>
        </div>
        <button className={`${styles.modeButton} ${styles.modeButtonDisabled}`} disabled title="Not yet available — requires the Impact Report Overlay, out of scope for this pass">
          What-If: ○
        </button>
      </div>

      <div className={styles.filterRow}>
        {FILTER_OPTIONS.map((f) => (
          <button key={f.type} className={`${styles.chip} ${visibleTypes.has(f.type) ? styles.chipActive : ""}`} onClick={() => toggleFilter(f.type)}>
            {f.label} {visibleTypes.has(f.type) ? "✓" : ""}
          </button>
        ))}
      </div>

      <div className={styles.body}>
        <div className={styles.canvasWrap}>
          <svg width={maxX} height={maxY}>
            {visibleEdges.map((e) => {
              const s = positionById.get(e.source);
              const t = positionById.get(e.target);
              if (!s || !t) return null;
              const cls = e.type === "dependency" ? styles.edgeDependency : e.type === "traceability" ? styles.edgeTraceability : styles.edgeProvenance;
              return (
                <line
                  key={e.id}
                  x1={s.px + NODE_W / 2}
                  y1={s.py + NODE_H}
                  x2={t.px + NODE_W / 2}
                  y2={t.py}
                  className={cls}
                />
              );
            })}
            {visibleNodes.map((n) => (
              <g
                key={n.id}
                className={styles.node}
                transform={`translate(${n.px}, ${n.py})`}
                onClick={() => { setSelectedId(n.id); setSteerOpen(false); }}
              >
                <NodeShape type={n.type} selected={n.id === selectedId} />
                <text x={NODE_W / 2} y={NODE_H / 2 + 4} className={styles.nodeLabel}>
                  {n.name.length > 16 ? `${n.name.slice(0, 14)}…` : n.name}
                </text>
              </g>
            ))}
          </svg>
        </div>

        {selected && (
          <div className={styles.detailPanel}>
            <h3>{selected.name}</h3>
            <p>Type: {selected.type}</p>
            <p>Layer: {selected.layer}</p>
            <p>Status: {selected.status}</p>

            {steerOpen ? (
              <>
                <textarea
                  value={steerInstruction}
                  onChange={(e) => setSteerInstruction(e.target.value)}
                  placeholder="Steering instruction…"
                  style={{ width: "100%", minHeight: 60 }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <Button variant="secondary" onClick={() => setSteerOpen(false)}>Cancel</Button>
                  <Button disabled={!steerInstruction.trim()} onClick={sendSteer}>Send</Button>
                </div>
              </>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                <Button variant="secondary" onClick={() => setSteerOpen(true)}>Steer this node</Button>
                {selected.type !== "file" && (
                  <Button variant="secondary" onClick={() => openEdit(selected.id, selected.type as EditableNodeType)}>
                    Open in Editor
                  </Button>
                )}
                <Button variant="secondary" disabled={!decisionEntryId} onClick={() => decisionEntryId && focusLedger(decisionEntryId)}>
                  View Provenance
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={styles.legend}>
        <span>── dependency</span>
        <span>- - traceability</span>
        <span>·· provenance</span>
      </div>
    </div>
  );
}
