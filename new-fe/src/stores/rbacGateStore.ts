import { create } from "zustand";

/** Shared open/close flag for RBACMatrixEditorModal — opened by the Toolbar's "RBAC" button or automatically on RBAC_MODEL_READY (Stage 2). */
interface RbacGateState {
  open: boolean;
  show: () => void;
  hide: () => void;
}

export const useRbacGateStore = create<RbacGateState>((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}));
