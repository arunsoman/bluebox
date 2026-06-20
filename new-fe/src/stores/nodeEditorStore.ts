import { create } from "zustand";

/**
 * Shared open/close state for the Node Editor modal family (doc/wireframes.md
 * missing-screens §1 and §4.1/§4.2). Any panel (Steering, Blueprint Graph,
 * Completeness Gate) can trigger the same modal stack without prop drilling.
 * Restore/Revert (§4.3) operates on a DecisionEntry pair, not a single node,
 * and is triggered only from the Audit Panel — it has its own local state there.
 */
export type EditableNodeType = "actor" | "capability" | "use_case" | "user_story" | "engineering_task";

interface EditTarget {
  mode: "edit";
  nodeId: string;
  nodeType: EditableNodeType;
}

interface AddTarget {
  mode: "add";
  nodeType: EditableNodeType;
  parentId?: string;
}

interface DeleteTarget {
  mode: "delete";
  nodeId: string;
  nodeType: EditableNodeType;
}

/** "Add Node" is two steps (doc/wireframes.md missing-screens §4.1): pick type+parent, then the full editor opens empty. */
interface PickTarget {
  mode: "pick";
  parentId?: string;
}

export type NodeEditorTarget = EditTarget | AddTarget | DeleteTarget | PickTarget;

interface NodeEditorState {
  target: NodeEditorTarget | null;
  openEdit: (nodeId: string, nodeType: EditableNodeType) => void;
  openAddPicker: (parentId?: string) => void;
  openAdd: (nodeType: EditableNodeType, parentId?: string) => void;
  openDelete: (nodeId: string, nodeType: EditableNodeType) => void;
  close: () => void;
}

export const useNodeEditorStore = create<NodeEditorState>((set) => ({
  target: null,
  openEdit: (nodeId, nodeType) => set({ target: { mode: "edit", nodeId, nodeType } }),
  openAddPicker: (parentId) => set({ target: { mode: "pick", parentId } }),
  openAdd: (nodeType, parentId) => set({ target: { mode: "add", nodeType, parentId } }),
  openDelete: (nodeId, nodeType) => set({ target: { mode: "delete", nodeId, nodeType } }),
  close: () => set({ target: null }),
}));
