import { create } from "zustand";

/** Shared open/close flag for CheckpointRestoreModal — opened via the Toolbar or the `/checkpoint` chat command (CHECKPOINT_RESTORE_REQUEST). */
interface CheckpointRestoreState {
  open: boolean;
  show: () => void;
  hide: () => void;
}

export const useCheckpointRestoreStore = create<CheckpointRestoreState>((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}));
