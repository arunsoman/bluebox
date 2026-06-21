import { create } from "zustand";

/** Shared open/close flag for ChatPopupModal — opened from anywhere that wants to hand the
 * user off to the assistant with context pre-filled (e.g. PRDAnalysisReport's "Discuss in
 * chat" per-conflict action), without navigating away from the panel that triggered it. Same
 * open/show/hide convention as completenessGateStore and the other gate/modal stores. */
interface ChatPopupState {
  open: boolean;
  show: () => void;
  hide: () => void;
}

export const useChatPopupStore = create<ChatPopupState>((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}));
