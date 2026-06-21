import { useEffect } from "react";
import { usePipelineStore, isOnboardingState } from "@/stores/pipelineStore";
import { usePrdStore } from "@/stores/prdStore";
import { useToast } from "@/components/common/Toast/ToastContext";
import { ApiError } from "@/api/httpClient";
import { EmptyState } from "@/components/common/EmptyState";
import { LandingScreen } from "./LandingScreen";
import { InputProcessing } from "./InputProcessing";
import { RichnessClassificationView } from "./RichnessClassificationView";
import { ComplianceBanner } from "./ComplianceBanner";
import { PRDAnalysisReport } from "./PRDAnalysisReport";
import { MinimalistDialogueView } from "./MinimalistDialogueView";
import { SeedBuilderView } from "./SeedBuilderView";
import { ScaleDialogueView } from "./ScaleDialogueView";
import { HostingOptionsView } from "./HostingOptionsView";
import styles from "./PRDPanel.module.css";

function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : "Unknown error";
}

/**
 * Workspace "PRD" tab - the project's PRD viewer/editor. If the project
 * hasn't gone through onboarding yet (`isOnboardingState`), this is the
 * onboarding wizard itself (landing input -> processing -> classification
 * -> PRD analysis / dialogue flows -> scale & hosting), now embedded here
 * instead of a standalone route/popup so the user can supply a PRD without
 * leaving the workspace. State lives in `usePrdStore`, not local state, so
 * it survives switching to another center tab and back.
 */
export function PRDPanel() {
  const { pushToast } = useToast();
  const projectId = usePipelineStore((s) => s.projectId);
  const currentState = usePipelineStore((s) => s.pipelineState?.current_state);
  const onboarding = isOnboardingState(currentState);

  const init = usePrdStore((s) => s.init);
  const screen = usePrdStore((s) => s.screen);
  const submitting = usePrdStore((s) => s.submitting);
  const steps = usePrdStore((s) => s.steps);
  const classification = usePrdStore((s) => s.classification);
  const prdReport = usePrdStore((s) => s.prdReport);
  const compliance = usePrdStore((s) => s.compliance);
  const complianceConfirmed = usePrdStore((s) => s.complianceConfirmed);
  const confirmCompliance = usePrdStore((s) => s.confirmCompliance);
  const proceedToScale = usePrdStore((s) => s.proceedToScale);
  const minimalistDialogue = usePrdStore((s) => s.minimalistDialogue);
  const seedDialogue = usePrdStore((s) => s.seedDialogue);
  const scaleConflicts = usePrdStore((s) => s.scaleConflicts);
  const scaleInputs = usePrdStore((s) => s.scaleInputs);
  const hostingOptions = usePrdStore((s) => s.hostingOptions);
  const generatingOptions = usePrdStore((s) => s.generatingOptions);
  const selectingOption = usePrdStore((s) => s.selectingOption);
  const processingError = usePrdStore((s) => s.processingError);
  const clearProcessingError = usePrdStore((s) => s.clearProcessingError);

  const submitText = usePrdStore((s) => s.submitText);
  const uploadFile = usePrdStore((s) => s.uploadFile);
  const connectGit = usePrdStore((s) => s.connectGit);
  const proceedFromClassification = usePrdStore((s) => s.proceedFromClassification);
  const override = usePrdStore((s) => s.override);
  const submitMinimalistResponse = usePrdStore((s) => s.submitMinimalistResponse);
  const submitSeedBuilderStep = usePrdStore((s) => s.submitSeedBuilderStep);
  const scaleSubmit = usePrdStore((s) => s.scaleSubmit);
  const selectHostingOption = usePrdStore((s) => s.selectHostingOption);

  useEffect(() => {
    if (projectId) init(projectId);
  }, [projectId, init]);

  useEffect(() => {
    if (!processingError) return;
    pushToast({ severity: "error", title: "Input processing failed", body: processingError });
    clearProcessingError();
  }, [processingError, pushToast, clearProcessingError]);

  async function handleSubmitText(text: string, trustMode: TrustMode) {
    try {
      await submitText(text, trustMode);
    } catch (err) {
      pushToast({ severity: "error", title: "Could not submit input", body: errorMessage(err) });
    }
  }

  async function handleUploadFile(file: File) {
    try {
      const result = await uploadFile(file);
      if (!result.handled && result.fileName) {
        pushToast({
          severity: "info",
          title: "File received",
          body: `${result.fileName} (${result.fileType}) uploaded — no extractable text returned.`,
        });
      }
    } catch (err) {
      pushToast({ severity: "error", title: "Upload failed", body: errorMessage(err) });
    }
  }

  async function handleConnectGit(url: string) {
    try {
      const result = await connectGit(url);
      pushToast({
        severity: "info",
        title: "Repository connected",
        body: `${result.repo_name}: ${result.legacy_report.existing_actors.length} actors, ${result.legacy_report.existing_api_routes.length} routes detected.`,
      });
    } catch (err) {
      pushToast({ severity: "error", title: "Git connect failed", body: errorMessage(err) });
    }
  }

  async function handleProceedFromClassification(mode: RichnessMode) {
    try {
      await proceedFromClassification(mode);
    } catch (err) {
      pushToast({ severity: "error", title: "Could not load next step", body: errorMessage(err) });
    }
  }

  async function handleOverride(mode: RichnessMode, rationale: string) {
    try {
      await override(mode, rationale);
    } catch (err) {
      pushToast({ severity: "error", title: "Override failed", body: errorMessage(err) });
    }
  }

  async function handleMinimalistSubmit(answers: MinimalistAnswer[]) {
    try {
      const result = await submitMinimalistResponse(answers);
      if (result.status !== "complete") {
        pushToast({ severity: "warning", title: "Some answers need review" });
      }
    } catch (err) {
      pushToast({ severity: "error", title: "Could not submit answers", body: errorMessage(err) });
    }
  }

  async function handleSeedBuilderSubmitStep(
    stepId: string,
    fieldValues: Record<string, unknown>,
    navigation: "next" | "back" | "submit",
  ) {
    try {
      await submitSeedBuilderStep(stepId, fieldValues, navigation);
    } catch (err) {
      pushToast({ severity: "error", title: "Could not submit step", body: errorMessage(err) });
    }
  }

  async function handleScaleSubmit(inputs: ScaleInputs) {
    try {
      await scaleSubmit(inputs);
    } catch (err) {
      pushToast({ severity: "error", title: "Scale validation failed", body: errorMessage(err) });
    }
  }

  async function handleSelectHostingOption(optionId: string) {
    try {
      await selectHostingOption(optionId);
    } catch (err) {
      pushToast({ severity: "error", title: "Could not select hosting option", body: errorMessage(err) });
    }
  }

  if (!projectId) return null;

  if (!onboarding) {
    if (prdReport) {
      return (
        <div className={styles.panel}>
          <PRDAnalysisReport report={prdReport} onProceed={() => {}} />
        </div>
      );
    }
    return (
      <EmptyState
        title="PRD already processed"
        description="This project's PRD was already analyzed earlier in this pipeline run. Re-fetching a previously submitted PRD has no endpoint in the API contract, so it can't be viewed here after the fact."
      />
    );
  }

  return (
    <div className={styles.panel}>
      {compliance && !complianceConfirmed && screen !== "landing" && screen !== "processing" && (
        <ComplianceBanner result={compliance} onConfirm={confirmCompliance} />
      )}

      {screen === "landing" && (
        <LandingScreen
          submitting={submitting}
          onSubmitText={handleSubmitText}
          onUploadFile={handleUploadFile}
          onConnectGit={handleConnectGit}
        />
      )}

      {screen === "processing" && <InputProcessing steps={steps} />}

      {screen === "classification" && classification && (
        <div className={styles.centered}>
          <RichnessClassificationView
            classification={classification}
            submitting={submitting}
            onProceed={handleProceedFromClassification}
            onOverride={handleOverride}
          />
        </div>
      )}

      {screen === "prdAnalysis" && prdReport && (
        <PRDAnalysisReport report={prdReport} onProceed={proceedToScale} />
      )}

      {screen === "minimalist" && minimalistDialogue && (
        <MinimalistDialogueView
          dialogue={minimalistDialogue}
          submitting={submitting}
          onSubmit={handleMinimalistSubmit}
        />
      )}

      {screen === "seedBuilder" && seedDialogue && (
        <SeedBuilderView
          dialogue={seedDialogue}
          submitting={submitting}
          onSubmitStep={handleSeedBuilderSubmitStep}
        />
      )}

      {screen === "scaleDialogue" &&
        (hostingOptions && scaleInputs ? (
          <HostingOptionsView
            matrix={hostingOptions}
            scaleInputs={scaleInputs}
            selecting={selectingOption}
            onSelectOption={handleSelectHostingOption}
          />
        ) : (
          <ScaleDialogueView conflicts={scaleConflicts} generating={generatingOptions} onSubmit={handleScaleSubmit} />
        ))}
    </div>
  );
}
