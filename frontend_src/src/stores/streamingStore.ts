// =============================================================================
// Streaming Store — Streaming output state
// =============================================================================

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { StreamChunk, StageName } from '@/types/domain';

interface StreamingState {
  // ── Data from backend ──
  chunks: StreamChunk[];
  currentStage: StageName | null;
  isStreaming: boolean;

  // ── Local UI state ──
  interruptRequested: boolean;

  // ── Actions ──
  appendChunk: (chunk: StreamChunk) => void;
  setStreaming: (active: boolean) => void;
  setCurrentStage: (stage: StageName | null) => void;
  requestInterrupt: () => void;
  clearInterrupt: () => void;
  clearChunks: () => void;
  reset: () => void;
}

export const useStreamingStore = create<StreamingState>()(
  devtools(
    (set) => ({
      chunks: [],
      currentStage: null,
      isStreaming: false,
      interruptRequested: false,

      appendChunk: (chunk) =>
        set((state) => ({ chunks: [...state.chunks, chunk] })),

      setStreaming: (active) => set({ isStreaming: active }),
      setCurrentStage: (stage) => set({ currentStage: stage }),

      requestInterrupt: () => set({ interruptRequested: true }),
      clearInterrupt: () => set({ interruptRequested: false }),

      clearChunks: () => set({ chunks: [] }),

      reset: () =>
        set({
          chunks: [],
          currentStage: null,
          isStreaming: false,
          interruptRequested: false,
        }),
    }),
    { name: 'streaming-store' }
  )
);
