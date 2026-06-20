import type { EditableNodeType } from "@/stores/nodeEditorStore";

/** A single blocking/critical validation error, flattened for display across the Completeness Gate and Bulk Fix Wizard. Computed client-side — not an API type. */
export interface ErrorRow {
  key: string;
  nodeId: string;
  nodeType: EditableNodeType;
  nodeName: string;
  message: string;
  suggestedFix?: string;
}
