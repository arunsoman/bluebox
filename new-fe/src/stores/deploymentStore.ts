import { create } from "zustand";

/** Shared open/close flag for DeploymentModal — opened manually via the Toolbar (Stage 10 has no automatic trigger in this pass since Stage 9 Runtime/Preview is out of scope). */
interface DeploymentGateState {
  open: boolean;
  show: () => void;
  hide: () => void;
}

export const useDeploymentStore = create<DeploymentGateState>((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}));
