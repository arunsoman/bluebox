import { useState } from "react";
import { Button } from "@/components/common/Button";
import { useNodeEditorStore, type EditableNodeType } from "@/stores/nodeEditorStore";
import styles from "./NodeDetailCard.module.css";

const EDITABLE_TYPES: string[] = ["actor", "capability", "use_case", "user_story", "engineering_task"];

interface NodeDetailCardProps {
  node: DraftNode;
  onSaveDescription: (newDescription: string) => Promise<void>;
  submitting: boolean;
}

export function NodeDetailCard({ node, onSaveDescription, submitting }: NodeDetailCardProps) {
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState(node.description);
  const openEdit = useNodeEditorStore((s) => s.openEdit);
  const isEditable = EDITABLE_TYPES.includes(node.node_type);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.name}>{node.name}</span>
        <span className={styles.badge}>{node.risk_classification}</span>
        {isEditable && (
          <Button variant="secondary" onClick={() => openEdit(node.node_id, node.node_type as EditableNodeType)}>
            Edit Full Node
          </Button>
        )}
      </div>

      {editing ? (
        <textarea
          className={styles.textarea}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      ) : (
        <p className={styles.description}>{node.description}</p>
      )}

      <pre className={styles.json}>{JSON.stringify(node.full_data ?? node, null, 2)}</pre>

      <div className={styles.actions}>
        {editing ? (
          <>
            <Button variant="secondary" onClick={() => setEditing(false)}>
              Discard
            </Button>
            <Button
              loading={submitting}
              onClick={async () => {
                await onSaveDescription(description);
                setEditing(false);
              }}
            >
              Save
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      </div>
    </div>
  );
}
