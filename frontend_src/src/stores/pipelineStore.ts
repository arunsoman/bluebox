// =============================================================================
// Pipeline Store — Pipeline session state
// =============================================================================

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { StageName, PipelineStatus, RichnessMode } from '@/types/domain';

interface PipelineState {
  // ── Data from backend ──
  sessionId: string | null;
  projectId: string | null;
  currentStage: StageName | null;
  richnessMode: RichnessMode | null;
  pipelineStatus: PipelineStatus;
  classificationBasis: string[];

  // ── Computed / Derived (manual setters) ──
  isActive: boolean;
  canSteer: boolean;

  // ── Actions ──
  setSession: (session: { session_id: string; project_id: string; user_id: string; current_stage: StageName | null; status: PipelineStatus; richness_mode: RichnessMode | null }) => void;
  setStage: (stage: StageName | null) => void;
  setStatus: (status: PipelineStatus) => void;
  setRichnessMode: (mode: RichnessMode | null) => void;
  setClassificationBasis: (basis: string[]) => void;
  clearSession: () => void;
  computeDerived: () => void;
}

function computeIsActive(status: PipelineStatus): boolean {
  return status !== 'completed' && status !== 'suspended' && status !== 'expired';
}

function computeCanSteer(status: PipelineStatus): boolean {
  return status === 'paused' || status === 'idle';
}

export const usePipelineStore = create<PipelineState>()(
  devtools(
    (set, get) => ({
      sessionId: null,
      projectId: null,
      currentStage: null,
      richnessMode: null,
      pipelineStatus: 'idle',
      classificationBasis: [],
      isActive: false,
      canSteer: true,

      setSession: (session) =>
        set({
          sessionId: session.session_id,
          projectId: session.project_id,
          currentStage: session.current_stage,
          pipelineStatus: session.status,
          richnessMode: session.richness_mode,
          isActive: computeIsActive(session.status),
          canSteer: computeCanSteer(session.status),
        }),

      setStage: (stage) => set({ currentStage: stage }),

      setStatus: (status) =>
        set({
          pipelineStatus: status,
          isActive: computeIsActive(status),
          canSteer: computeCanSteer(status),
        }),

      setRichnessMode: (mode) => set({ richnessMode: mode }),

      setClassificationBasis: (basis) => set({ classificationBasis: basis }),

      clearSession: () =>
        set({
          sessionId: null,
          projectId: null,
          currentStage: null,
          richnessMode: null,
          pipelineStatus: 'idle',
          classificationBasis: [],
          isActive: false,
          canSteer: true,
        }),

      computeDerived: () => {
        const { pipelineStatus } = get();
        set({
          isActive: computeIsActive(pipelineStatus),
          canSteer: computeCanSteer(pipelineStatus),
        });
      },
    }),
    { name: 'pipeline-store' }
  )
);
