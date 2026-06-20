import { create } from "zustand";

/** Shared open/close + payload for TechStackOptionsModal — opened automatically on TECH_STACK_OPTIONS_READY (Stage 3 boundary) or manually via the Toolbar. */
interface TechStackGateState {
  open: boolean;
  matrix: TechStackOptionsMatrix | null;
  show: (matrix?: TechStackOptionsMatrix) => void;
  hide: () => void;
}

export const useTechStackGateStore = create<TechStackGateState>((set, get) => ({
  open: false,
  matrix: null,
  show: (matrix) => set({ open: true, matrix: matrix ?? get().matrix }),
  hide: () => set({ open: false }),
}));
