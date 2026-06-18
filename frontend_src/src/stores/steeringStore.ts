// =============================================================================
// Steering Store — Steering panel state
// =============================================================================

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  SteeringPanel,
  SteeringOption,
  PRDAnalysisReport,
  MinimalistDialogueResult,
  MinimalistQuestion,
  ScaleInputs,
  HostingOption,
  TechStackOption,
  RBACModel,
  InfrastructureProfile,
  TechStackProfile,
} from '@/types/domain';

interface SteeringState {
  // ── Data from backend ──
  currentPanel: SteeringPanel | null;
  draftOutput: Record<string, unknown> | null;
  options: SteeringOption[];
  prdAnalysis: PRDAnalysisReport | null;
  minimalistDialogue: MinimalistDialogueResult | null;
  minimalistQuestions: MinimalistQuestion[];
  scaleDialogue: { questions: Array<{ field: string; label: string }> } | null;
  scaleConflict: { conflict_description: string; affected_fields: string[] } | null;
  hostingMatrix: HostingOption[] | null;
  techStackMatrix: TechStackOption[] | null;
  rbacModel: RBACModel | null;
  rbacConflict: { conflict_id: string; roles: string[]; permission: string } | null;
  escalationFlag: { path: string; resulting_access: string; algorithm: string; depth_limit: number; conditions_evaluated: boolean } | null;
  inheritanceCycle: { cycle_check_passed: boolean; cycle_path?: string[] } | null;
  infraStale: boolean;
  techStackProfile: TechStackProfile | null;
  infrastructureProfile: InfrastructureProfile | null;
  steeringRequired: { reason: string; details?: string } | null;
  llmFailure: { failure_reason: string; resolution_options?: string[] } | null;
  complianceDetected: { frameworks: string[]; defaults: Record<string, unknown> } | null;
  validationError: { failure_reason: string; suggestion?: string } | null;
  scaleInputs: ScaleInputs | null;

  // ── Local UI state ──
  selectedOptionId: string | null;
  bookmarkedOptionIds: string[];
  viewMode: 'summary' | 'detail';
  currentPage: number;
  comparisonMode: boolean;
  searchQuery: string;

  // ── Actions ──
  setPanel: (panel: SteeringPanel | null) => void;
  setDraftOutput: (output: Record<string, unknown> | null) => void;
  setOptions: (options: SteeringOption[]) => void;
  setPrdAnalysis: (report: PRDAnalysisReport) => void;
  setMinimalistDialogue: (dialogue: MinimalistDialogueResult | null) => void;
  setMinimalistQuestions: (questions: MinimalistQuestion[]) => void;
  setScaleDialogue: (dialogue: { questions: Array<{ field: string; label: string }> } | null) => void;
  setScaleConflict: (conflict: { conflict_description: string; affected_fields: string[] } | null) => void;
  setHostingMatrix: (options: HostingOption[] | null) => void;
  setTechStackMatrix: (options: TechStackOption[] | null) => void;
  setRbacModel: (model: RBACModel | null) => void;
  setRbacConflict: (conflict: { conflict_id: string; roles: string[]; permission: string } | null) => void;
  setEscalationFlag: (flag: { path: string; resulting_access: string; algorithm: string; depth_limit: number; conditions_evaluated: boolean } | null) => void;
  setInheritanceCycle: (cycle: { cycle_check_passed: boolean; cycle_path?: string[] } | null) => void;
  setInfraStale: (payload: { stale: boolean } | null) => void;
  setTechStackProfile: (profile: TechStackProfile | null) => void;
  setInfrastructureProfile: (profile: InfrastructureProfile | null) => void;
  setSteeringRequired: (payload: { reason: string; details?: string } | null) => void;
  setLlmFailure: (failure: { failure_reason: string; resolution_options?: string[] } | null) => void;
  setComplianceDetected: (payload: { frameworks: string[]; defaults: Record<string, unknown> } | null) => void;
  setValidationError: (error: { failure_reason: string; suggestion?: string } | null) => void;
  setScaleInputs: (inputs: ScaleInputs | null) => void;
  selectOption: (optionId: string | null) => void;
  toggleBookmark: (optionId: string) => void;
  setViewMode: (mode: 'summary' | 'detail') => void;
  setPage: (page: number) => void;
  setComparisonMode: (enabled: boolean) => void;
  setSearchQuery: (query: string) => void;
  clearPanel: () => void;
}

export const useSteeringStore = create<SteeringState>()(
  devtools(
    (set) => ({
      // Data from backend
      currentPanel: null,
      draftOutput: null,
      options: [],
      prdAnalysis: null,
      minimalistDialogue: null,
      minimalistQuestions: [],
      scaleDialogue: null,
      scaleConflict: null,
      hostingMatrix: null,
      techStackMatrix: null,
      rbacModel: null,
      rbacConflict: null,
      escalationFlag: null,
      inheritanceCycle: null,
      infraStale: false,
      techStackProfile: null,
      infrastructureProfile: null,
      steeringRequired: null,
      llmFailure: null,
      complianceDetected: null,
      validationError: null,
      scaleInputs: null,

      // Local UI state
      selectedOptionId: null,
      bookmarkedOptionIds: [],
      viewMode: 'summary',
      currentPage: 1,
      comparisonMode: false,
      searchQuery: '',

      // Actions
      setPanel: (panel) => set({ currentPanel: panel, options: panel?.options ?? [] }),
      setDraftOutput: (output) => set({ draftOutput: output }),
      setOptions: (options) => set({ options }),
      setPrdAnalysis: (report) => set({ prdAnalysis: report }),
      setMinimalistDialogue: (dialogue) => set({ minimalistDialogue: dialogue }),
      setMinimalistQuestions: (questions) => set({ minimalistQuestions: questions }),
      setScaleDialogue: (dialogue) => set({ scaleDialogue: dialogue }),
      setScaleConflict: (conflict) => set({ scaleConflict: conflict }),
      setHostingMatrix: (options) => set({ hostingMatrix: options }),
      setTechStackMatrix: (options) => set({ techStackMatrix: options }),
      setRbacModel: (model) => set({ rbacModel: model }),
      setRbacConflict: (conflict) => set({ rbacConflict: conflict }),
      setEscalationFlag: (flag) => set({ escalationFlag: flag }),
      setInheritanceCycle: (cycle) => set({ inheritanceCycle: cycle }),
      setInfraStale: (payload) => set({ infraStale: payload?.stale ?? false }),
      setTechStackProfile: (profile) => set({ techStackProfile: profile }),
      setInfrastructureProfile: (profile) => set({ infrastructureProfile: profile }),
      setSteeringRequired: (payload) => set({ steeringRequired: payload }),
      setLlmFailure: (failure) => set({ llmFailure: failure }),
      setComplianceDetected: (payload) => set({ complianceDetected: payload }),
      setValidationError: (error) => set({ validationError: error }),
      setScaleInputs: (inputs) => set({ scaleInputs: inputs }),
      selectOption: (optionId) => set({ selectedOptionId: optionId }),
      toggleBookmark: (optionId) =>
        set((state) => ({
          bookmarkedOptionIds: state.bookmarkedOptionIds.includes(optionId)
            ? state.bookmarkedOptionIds.filter((id) => id !== optionId)
            : [...state.bookmarkedOptionIds, optionId],
        })),
      setViewMode: (mode) => set({ viewMode: mode }),
      setPage: (page) => set({ currentPage: page }),
      setComparisonMode: (enabled) => set({ comparisonMode: enabled }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      clearPanel: () =>
        set({
          currentPanel: null,
          draftOutput: null,
          options: [],
          selectedOptionId: null,
          bookmarkedOptionIds: [],
          currentPage: 1,
          comparisonMode: false,
          searchQuery: '',
        }),
    }),
    { name: 'steering-store' }
  )
);
