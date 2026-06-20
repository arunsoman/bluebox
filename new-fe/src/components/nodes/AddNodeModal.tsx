import { useEffect, useState } from "react";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { useNodeEditorStore, type EditableNodeType } from "@/stores/nodeEditorStore";
import { usePipelineStore } from "@/stores/pipelineStore";
import { graphApi } from "@/api/endpoints/graph";
import styles from "./EditorForms.module.css";

const NODE_TYPES: { value: EditableNodeType; label: string }[] = [
  { value: "actor", label: "Actor" },
  { value: "capability", label: "Capability" },
  { value: "use_case", label: "Use Case" },
  { value: "user_story", label: "User Story" },
  { value: "engineering_task", label: "Task" },
];

/** doc/wireframes.md missing-screens §4.1 — Add Node Flow (step 1: pick type + parent, step 2: full editor opens empty). */
export function AddNodeModal() {
  const target = useNodeEditorStore((s) => s.target);
  const close = useNodeEditorStore((s) => s.close);
  const openAdd = useNodeEditorStore((s) => s.openAdd);
  const projectId = usePipelineStore((s) => s.projectId);
  const [nodeType, setNodeType] = useState<EditableNodeType>("actor");
  const [parentName, setParentName] = useState<string | null>(null);

  const parentId = target?.mode === "pick" ? target.parentId : undefined;

  useEffect(() => {
    if (!projectId || !parentId) return;
    graphApi.getGraph(projectId).then((g) => {
      const parent = g.nodes.find((n) => n.id === parentId);
      setParentName(parent?.name ?? parentId);
    });
  }, [projectId, parentId]);

  if (target?.mode !== "pick") return null;

  return (
    <Modal title="➕ Add New Node" onClose={close} width={480}>
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Node Type</h3>
        <div className={styles.sectionBody}>
          {NODE_TYPES.map((t) => (
            <label key={t.value} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="radio" name="nodeType" checked={nodeType === t.value} onChange={() => setNodeType(t.value)} />
              {t.label}
            </label>
          ))}
        </div>
      </div>

      {parentId && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Parent Node</h3>
          <div className={styles.readonly}>{parentName ?? parentId}</div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
        <Button variant="secondary" onClick={close}>Cancel</Button>
        <Button onClick={() => openAdd(nodeType, parentId)}>Continue to Editor →</Button>
      </div>
    </Modal>
  );
}
