import { create } from "zustand";

/** Open/close + payload for MergeConflictModal — shown when regeneration (CODE_FILE_COMPLETE) lands on a file with unsaved local edits, or a MERGE_CONFLICT/EDITOR_CONFLICT WS event arrives. */
interface MergeConflictState {
  conflict: MergeConflictInfo | null;
  show: (conflict: MergeConflictInfo) => void;
  hide: () => void;
}

export const useMergeConflictStore = create<MergeConflictState>((set) => ({
  conflict: null,
  show: (conflict) => set({ conflict }),
  hide: () => set({ conflict: null }),
}));
