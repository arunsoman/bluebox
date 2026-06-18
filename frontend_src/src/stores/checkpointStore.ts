// =============================================================================
// Checkpoint Store — Checkpoint state
// =============================================================================

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Checkpoint } from '@/types/domain';

interface CheckpointState {
  // ── Data from backend ──
  checkpoints: Checkpoint[];

  // ── Local UI state ──
  selectedCheckpointId: string | null;

  // ── Actions ──
  setCheckpoints: (checkpoints: Checkpoint[]) => void;
  addCheckpoint: (checkpoint: Checkpoint) => void;
  selectCheckpoint: (id: string | null) => void;
  clear: () => void;
}

export const useCheckpointStore = create<CheckpointState>()(
  devtools(
    (set) => ({
      checkpoints: [],
      selectedCheckpointId: null,

      setCheckpoints: (checkpoints) => set({ checkpoints }),

      addCheckpoint: (checkpoint) =>
        set((state) => ({
          checkpoints: [...state.checkpoints, checkpoint],
        })),

      selectCheckpoint: (id) => set({ selectedCheckpointId: id }),

      clear: () =>
        set({
          checkpoints: [],
          selectedCheckpointId: null,
        }),
    }),
    { name: 'checkpoint-store' }
  )
);
