import { create } from "zustand";
import { onboardingApi } from "@/api/endpoints/onboarding";
import { infrastructureApi } from "@/api/endpoints/infra";
import { socketClient } from "@/ws/socketClient";
import type { ProcessingStepView } from "@/components/onboarding/InputProcessing";

export type PrdScreen =
  | "landing"
  | "processing"
  | "classification"
  | "prdAnalysis"
  | "minimalist"
  | "seedBuilder"
  | "scaleDialogue";

interface PrdState {
  projectId: string | null;
  screen: PrdScreen;
  submitting: boolean;
  inputId: string | null;
  steps: ProcessingStepView[];
  classification: RichnessClassification | null;
  prdReport: PRDAnalysisReportType | null;
  awaitingPrdReport: boolean;
  compliance: ComplianceDetectionResult | null;
  complianceConfirmed: boolean;
  minimalistDialogue: MinimalistDialogue | null;
  seedDialogue: SeedBuilderDialogue | null;
  scaleConflicts: ScaleInputConflict[];
  scaleInputs: ScaleInputs | null;
  hostingOptions: HostingOptionsMatrix | null;
  generatingOptions: boolean;
  selectingOption: boolean;
  /** Surfaced from INPUT_PROCESSING_ERROR; consumed (and cleared) by the panel as a toast. */
  processingError: string | null;
  unsubscribe: (() => void) | null;

  init: (projectId: string) => void;
  clearProcessingError: () => void;
  confirmCompliance: () => void;
  proceedToScale: () => void;
  submitText: (text: string, trustMode: TrustMode) => Promise<void>;
  uploadFile: (file: File) => Promise<{ handled: boolean; fileName?: string; fileType?: string }>;
  connectGit: (url: string) => Promise<GitConnectResult>;
  proceedFromClassification: (mode: RichnessMode) => Promise<void>;
  override: (mode: RichnessMode, rationale: string) => Promise<void>;
  submitMinimalistResponse: (answers: MinimalistAnswer[]) => Promise<DialogueResult>;
  submitSeedBuilderStep: (
    stepId: string,
    fieldValues: Record<string, unknown>,
    navigation: "next" | "back" | "submit",
  ) => Promise<void>;
  scaleSubmit: (inputs: ScaleInputs) => Promise<void>;
  selectHostingOption: (optionId: string) => Promise<void>;
}

/**
 * Backs the workspace's "PRD" tab (PRDPanel) - the entire onboarding wizard
 * (landing input -> processing -> classification -> PRD analysis / dialogue
 * flows -> scale & hosting) lives here instead of component-local state so
 * progress survives switching away to another center tab and back. Same
 * `init()`-once, never-torn-down convention as `steeringStore`/`codeGenStore`.
 */
export const usePrdStore = create<PrdState>((set, get) => ({
  projectId: null,
  screen: "landing",
  submitting: false,
  inputId: null,
  steps: [],
  classification: null,
  prdReport: null,
  awaitingPrdReport: false,
  compliance: null,
  complianceConfirmed: false,
  minimalistDialogue: null,
  seedDialogue: null,
  scaleConflicts: [],
  scaleInputs: null,
  hostingOptions: null,
  generatingOptions: false,
  selectingOption: false,
  processingError: null,
  unsubscribe: null,

  init: (projectId) => {
    if (get().projectId === projectId) return;
    get().unsubscribe?.();

    set({
      projectId,
      screen: "landing",
      submitting: false,
      inputId: null,
      steps: [],
      classification: null,
      prdReport: null,
      awaitingPrdReport: false,
      compliance: null,
      complianceConfirmed: false,
      minimalistDialogue: null,
      seedDialogue: null,
      scaleConflicts: [],
      scaleInputs: null,
      hostingOptions: null,
      generatingOptions: false,
      selectingOption: false,
      processingError: null,
    });

    const unsubscribers = [
      socketClient.on("INPUT_PROCESSING_STARTED", (payload) => {
        set({
          steps: payload.steps.map((s, i) => ({
            index: s.step_index,
            name: s.name,
            status: i === 0 ? "active" : "pending",
          })),
        });
      }),
      socketClient.on("PROCESSING_STEP_COMPLETE", ({ step_index }) => {
        set((s) => ({
          steps: s.steps.map((step, i) => {
            if (step.index === step_index) return { ...step, status: "complete" };
            if (i === step_index + 1) return { ...step, status: "active" };
            return step;
          }),
        }));
      }),
      socketClient.on("RICHNESS_MODE_DETECTED", (payload) => {
        set({ classification: payload, screen: "classification" });
      }),
      socketClient.on("PRD_ANALYSIS_READY", (payload) => {
        set((s) =>
          s.awaitingPrdReport
            ? { prdReport: payload, screen: "prdAnalysis", awaitingPrdReport: false, submitting: false }
            : { prdReport: payload },
        );
      }),
      socketClient.on("COMPLIANCE_DETECTED", (payload) => set({ compliance: payload })),
      socketClient.on("INPUT_PROCESSING_ERROR", (payload) => {
        set({ screen: "landing", processingError: payload.message });
      }),
      socketClient.on("SCALE_INPUT_CONFLICT", (payload) => {
        set((s) => ({ scaleConflicts: [...s.scaleConflicts, payload], generatingOptions: false }));
      }),
      socketClient.on("HOSTING_OPTIONS_READY", (payload) => set({ hostingOptions: payload, generatingOptions: false })),
    ];
    set({ unsubscribe: () => unsubscribers.forEach((u) => u()) });
  },

  clearProcessingError: () => set({ processingError: null }),
  confirmCompliance: () => set({ complianceConfirmed: true }),
  proceedToScale: () => set({ screen: "scaleDialogue" }),

  submitText: async (text, trustMode) => {
    const { projectId } = get();
    if (!projectId) return;
    set({ submitting: true, screen: "processing" });
    try {
      const result = await onboardingApi.submitInput(projectId, { source: "text", text, trust_mode: trustMode });
      set({ inputId: result.input_id });
    } catch (err) {
      set({ screen: "landing" });
      throw err;
    } finally {
      set({ submitting: false });
    }
  },

  uploadFile: async (file) => {
    const { projectId } = get();
    if (!projectId) return { handled: false };
    set({ submitting: true });
    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await onboardingApi.uploadFile(projectId, formData);
      if (result.extracted_text) {
        await get().submitText(result.extracted_text, "PARANOID");
        return { handled: true };
      }
      return { handled: false, fileName: result.file_name, fileType: result.file_type };
    } finally {
      set({ submitting: false });
    }
  },

  connectGit: async (url) => {
    const { projectId } = get();
    if (!projectId) throw new Error("No active project");
    set({ submitting: true });
    try {
      return await onboardingApi.connectGit(projectId, { url });
    } finally {
      set({ submitting: false });
    }
  },

  proceedFromClassification: async (mode) => {
    const { projectId, prdReport } = get();
    if (!projectId) return;
    set({ submitting: true });
    try {
      if (mode === "WELL_FORMED") {
        if (prdReport) {
          set({ screen: "prdAnalysis", submitting: false });
        } else {
          set({ awaitingPrdReport: true });
        }
      } else if (mode === "MINIMALIST") {
        const dialogue = await onboardingApi.getMinimalistDialogue(projectId);
        set({ minimalistDialogue: dialogue, screen: "minimalist", submitting: false });
      } else {
        const dialogue = await onboardingApi.getSeedBuilderDialogue(projectId);
        set({ seedDialogue: dialogue, screen: "seedBuilder", submitting: false });
      }
    } catch (err) {
      set({ submitting: false });
      throw err;
    }
  },

  override: async (mode, rationale) => {
    const { projectId, inputId } = get();
    if (!projectId || !inputId) return;
    set({ submitting: true });
    try {
      const result = await onboardingApi.overrideClassification(projectId, {
        input_id: inputId,
        user_selected_mode: mode,
        rationale,
      });
      set({ classification: result });
    } finally {
      set({ submitting: false });
    }
  },

  submitMinimalistResponse: async (answers) => {
    const { projectId, minimalistDialogue } = get();
    if (!projectId || !minimalistDialogue) throw new Error("No active dialogue");
    set({ submitting: true });
    try {
      const result = await onboardingApi.submitMinimalistResponse(projectId, {
        dialogue_id: minimalistDialogue.dialogue_id,
        answers,
      });
      if (result.status === "complete") set({ screen: "scaleDialogue" });
      return result;
    } finally {
      set({ submitting: false });
    }
  },

  submitSeedBuilderStep: async (stepId, fieldValues, navigation) => {
    const { projectId, seedDialogue } = get();
    if (!projectId || !seedDialogue) return;
    set({ submitting: true });
    try {
      const result = await onboardingApi.submitSeedBuilderResponse(projectId, {
        dialogue_id: seedDialogue.dialogue_id,
        step_id: stepId,
        field_values: fieldValues,
        navigation,
      });
      if (navigation === "submit" && result.status === "complete") set({ screen: "scaleDialogue" });
    } finally {
      set({ submitting: false });
    }
  },

  scaleSubmit: async (inputs) => {
    const { projectId } = get();
    if (!projectId) return;
    set({ scaleConflicts: [], scaleInputs: inputs, generatingOptions: true });
    try {
      const result = await onboardingApi.submitScale(projectId, inputs);
      if (result.conflicts.length > 0) {
        set({ scaleConflicts: result.conflicts });
        return;
      }
      set({ scaleInputs: result.sanitized_inputs });
      const hostingOptions = await onboardingApi.getHostingOptions(projectId, result.sanitized_inputs);
      set({ hostingOptions });
    } finally {
      set({ generatingOptions: false });
    }
  },

  selectHostingOption: async (optionId) => {
    const { projectId } = get();
    if (!projectId) return;
    set({ selectingOption: true });
    try {
      await infrastructureApi.selectHosting(projectId, { option_id: optionId });
    } finally {
      set({ selectingOption: false });
    }
  },
}));
