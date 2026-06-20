import { create } from "zustand";

/** Shared open/close flag for CompletenessGateModal — opened by the Toolbar's "Completeness" button or automatically on reaching Stage 7 (FINAL_GATE). */
interface CompletenessGateState {
  open: boolean;
  show: () => void;
  hide: () => void;
}

export const useCompletenessGateStore = create<CompletenessGateState>((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}));
