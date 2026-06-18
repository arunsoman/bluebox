// =============================================================================
// Impact Store — Impact analysis state
// =============================================================================

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { ImpactReport } from '@/types/domain';

interface ImpactState {
  // ── Data from backend ──
  currentReport: ImpactReport | null;
  isLoading: boolean;

  // ── Actions ──
  setReport: (report: ImpactReport) => void;
  setLoading: (loading: boolean) => void;
  clearReport: () => void;
  reset: () => void;
}

export const useImpactStore = create<ImpactState>()(
  devtools(
    (set) => ({
      currentReport: null,
      isLoading: false,

      setReport: (report) => set({ currentReport: report, isLoading: false }),
      setLoading: (loading) => set({ isLoading: loading }),
      clearReport: () => set({ currentReport: null }),
      reset: () => set({ currentReport: null, isLoading: false }),
    }),
    { name: 'impact-store' }
  )
);
