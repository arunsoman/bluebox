import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { onboardingApi } from "@/api/endpoints/onboarding";
import { infrastructureApi } from "@/api/endpoints/infra";
import { ApiError } from "@/api/httpClient";
import { socketClient } from "@/ws/socketClient";
import { useToast } from "@/components/common/Toast/ToastContext";
import { useEnsurePipelineConnection } from "@/hooks/useEnsurePipelineConnection";
import { usePipelineStore, isOnboardingState } from "@/stores/pipelineStore";
import { useSteeringStore } from "@/stores/steeringStore";
import { Spinner } from "@/components/common/Spinner";
import { LandingScreen } from "./LandingScreen";
import { InputProcessing, type ProcessingStepView } from "./InputProcessing";
import { RichnessClassificationView } from "./RichnessClassificationView";
import { ComplianceBanner } from "./ComplianceBanner";
import { PRDAnalysisReport } from "./PRDAnalysisReport";
import { MinimalistDialogueView } from "./MinimalistDialogueView";
import { SeedBuilderView } from "./SeedBuilderView";
import { ScaleDialogueView } from "./ScaleDialogueView";
import { HostingOptionsView } from "./HostingOptionsView";

type Screen =
  | "landing"
  | "processing"
  | "classification"
  | "prdAnalysis"
  | "minimalist"
  | "seedBuilder"
  | "scaleDialogue";

export function OnboardingFlow() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const { ready, error: connectionError } = useEnsurePipelineConnection(projectId);
  const pipelineState = usePipelineStore((s) => s.pipelineState);
  const initSteeringStore = useSteeringStore((s) => s.init);

  const [screen, setScreen] = useState<Screen>("landing");
  const [submitting, setSubmitting] = useState(false);
  const [inputId, setInputId] = useState<string | null>(null);
  const [steps, setSteps] = useState<ProcessingStepView[]>([]);
  const [classification, setClassification] = useState<RichnessClassification | null>(null);
  const [prdReport, setPrdReport] = useState<PRDAnalysisReportType | null>(null);
  const [awaitingPrdReport, setAwaitingPrdReport] = useState(false);
  const [compliance, setCompliance] = useState<ComplianceDetectionResult | null>(null);
  const [complianceConfirmed, setComplianceConfirmed] = useState(false);
  const [minimalistDialogue, setMinimalistDialogue] = useState<MinimalistDialogue | null>(null);
  const [seedDialogue, setSeedDialogue] = useState<SeedBuilderDialogue | null>(null);
  const [scaleConflicts, setScaleConflicts] = useState<ScaleInputConflict[]>([]);
  const [scaleInputs, setScaleInputs] = useState<ScaleInputs | null>(null);
  const [hostingOptions, setHostingOptions] = useState<HostingOptionsMatrix | null>(null);
  const [generatingOptions, setGeneratingOptions] = useState(false);
  const [selectingOption, setSelectingOption] = useState(false);

  // Auto-advance to the workspace once the backend's own pipeline state
  // leaves the onboarding stages — the contract has no explicit "advance
  // past onboarding" REST call, so progression is observed, not assumed.
  useEffect(() => {
    if (pipelineState && !isOnboardingState(pipelineState.current_state) && projectId) {
      navigate(`/projects/${projectId}/workspace`, { replace: true });
    }
  }, [pipelineState, projectId, navigate]);

  // Subscribed as soon as the socket is ready — not when the IDE workspace's
  // Steering tab eventually mounts — so STEERING_PANEL_READY (which the mock
  // pipeline can emit while the user is still on these onboarding screens)
  // isn't dropped before anything is listening for it.
  useEffect(() => {
    if (!ready || !projectId) return;
    initSteeringStore(projectId);
  }, [ready, projectId, initSteeringStore]);

  useEffect(() => {
    if (!ready) return;
    const unsubscribers = [
      socketClient.on("INPUT_PROCESSING_STARTED", (payload) => {
        setSteps(
          payload.steps.map((s, i) => ({
            index: s.step_index,
            name: s.name,
            status: i === 0 ? "active" : "pending",
          })),
        );
      }),
      socketClient.on("PROCESSING_STEP_COMPLETE", ({ step_index }) => {
        setSteps((prev) =>
          prev.map((s, i) => {
            if (s.index === step_index) return { ...s, status: "complete" };
            if (i === step_index + 1) return { ...s, status: "active" };
            return s;
          }),
        );
      }),
      socketClient.on("RICHNESS_MODE_DETECTED", (payload) => {
        setClassification(payload);
        setScreen("classification");
      }),
      socketClient.on("PRD_ANALYSIS_READY", (payload) => {
        setPrdReport(payload);
      }),
      socketClient.on("COMPLIANCE_DETECTED", (payload) => {
        setCompliance(payload);
      }),
      socketClient.on("INPUT_PROCESSING_ERROR", (payload) => {
        pushToast({ severity: "error", title: "Input processing failed", body: payload.message });
        setScreen("landing");
      }),
      socketClient.on("SCALE_INPUT_CONFLICT", (payload) => {
        setScaleConflicts((prev) => [...prev, payload]);
        setGeneratingOptions(false);
      }),
      socketClient.on("HOSTING_OPTIONS_READY", (payload) => {
        setHostingOptions(payload);
        setGeneratingOptions(false);
      }),
    ];
    return () => unsubscribers.forEach((u) => u());
  }, [ready, pushToast]);

  useEffect(() => {
    if (awaitingPrdReport && prdReport) {
      setScreen("prdAnalysis");
      setAwaitingPrdReport(false);
      setSubmitting(false);
    }
  }, [awaitingPrdReport, prdReport]);

  if (!ready) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 64 }}>
        {connectionError ? <p>{connectionError}</p> : <Spinner />}
      </div>
    );
  }
  if (!projectId) return null;

  async function handleSubmitText(text: string, trustMode: TrustMode) {
    setSubmitting(true);
    // The POST below stays pending until the backend's richness/PRD/compliance
    // pipeline fully finishes (tens of seconds) - WS events for each stage,
    // including RICHNESS_MODE_DETECTED (which itself advances `screen` past
    // "processing"), arrive throughout that wait. Set "processing" now,
    // synchronously, rather than after the await: setting it post-await would
    // unconditionally clobber whatever screen RICHNESS_MODE_DETECTED already
    // navigated to, re-showing "processing" with no event left to advance it.
    setScreen("processing");
    try {
      const result = await onboardingApi.submitInput(projectId!, {
        source: "text",
        text,
        trust_mode: trustMode,
      });
      setInputId(result.input_id);
    } catch (err) {
      setScreen("landing");
      pushToast({
        severity: "error",
        title: "Could not submit input",
        body: err instanceof ApiError ? err.message : "Unknown error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUploadFile(file: File) {
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await onboardingApi.uploadFile(projectId!, formData);
      if (result.extracted_text) {
        await handleSubmitText(result.extracted_text, "PARANOID");
      } else {
        pushToast({
          severity: "info",
          title: "File received",
          body: `${result.file_name} (${result.file_type}) uploaded — no extractable text returned.`,
        });
      }
    } catch (err) {
      pushToast({
        severity: "error",
        title: "Upload failed",
        body: err instanceof ApiError ? err.message : "Unknown error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConnectGit(url: string) {
    setSubmitting(true);
    try {
      const result = await onboardingApi.connectGit(projectId!, { url });
      pushToast({
        severity: "info",
        title: "Repository connected",
        body: `${result.repo_name}: ${result.legacy_report.existing_actors.length} actors, ${result.legacy_report.existing_api_routes.length} routes detected. Legacy ingestion review UI is not yet implemented in this pass.`,
      });
    } catch (err) {
      pushToast({
        severity: "error",
        title: "Git connect failed",
        body: err instanceof ApiError ? err.message : "Unknown error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleProceedFromClassification(mode: RichnessMode) {
    setSubmitting(true);
    try {
      if (mode === "WELL_FORMED") {
        if (prdReport) {
          setScreen("prdAnalysis");
          setSubmitting(false);
        } else {
          // Stays "submitting" until PRD_ANALYSIS_READY arrives over WS -
          // the awaitingPrdReport/prdReport effect above clears it once the
          // screen actually advances, since there's no REST call here to
          // await: this branch is purely waiting on a WS event that may
          // already be in flight from the earlier /input request.
          setAwaitingPrdReport(true);
        }
      } else if (mode === "MINIMALIST") {
        const dialogue = await onboardingApi.getMinimalistDialogue(projectId!);
        setMinimalistDialogue(dialogue);
        setScreen("minimalist");
        setSubmitting(false);
      } else {
        const dialogue = await onboardingApi.getSeedBuilderDialogue(projectId!);
        setSeedDialogue(dialogue);
        setScreen("seedBuilder");
        setSubmitting(false);
      }
    } catch (err) {
      setSubmitting(false);
      pushToast({
        severity: "error",
        title: "Could not load next step",
        body: err instanceof ApiError ? err.message : "Unknown error",
      });
    }
  }

  async function handleOverride(mode: RichnessMode, rationale: string) {
    if (!inputId) return;
    setSubmitting(true);
    try {
      const result = await onboardingApi.overrideClassification(projectId!, {
        input_id: inputId,
        user_selected_mode: mode,
        rationale,
      });
      setClassification(result);
    } catch (err) {
      pushToast({
        severity: "error",
        title: "Override failed",
        body: err instanceof ApiError ? err.message : "Unknown error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function handleScaleSubmit(inputs: ScaleInputs) {
    setScaleConflicts([]);
    setScaleInputs(inputs);
    setGeneratingOptions(true);
    onboardingApi
      .submitScale(projectId!, inputs)
      .then((result) => {
        if (result.conflicts.length > 0) {
          setScaleConflicts(result.conflicts);
          setGeneratingOptions(false);
          return;
        }
        setScaleInputs(result.sanitized_inputs);
        return onboardingApi.getHostingOptions(projectId!, result.sanitized_inputs).then(setHostingOptions);
      })
      .catch((err: unknown) => {
        pushToast({
          severity: "error",
          title: "Scale validation failed",
          body: err instanceof ApiError ? err.message : "Unknown error",
        });
      })
      .finally(() => setGeneratingOptions(false));
  }

  async function handleSelectHostingOption(optionId: string) {
    setSelectingOption(true);
    try {
      await infrastructureApi.selectHosting(projectId!, { option_id: optionId });
      navigate(`/projects/${projectId}/workspace`);
    } catch (err) {
      pushToast({
        severity: "error",
        title: "Could not select hosting option",
        body: err instanceof ApiError ? err.message : "Unknown error",
      });
    } finally {
      setSelectingOption(false);
    }
  }

  return (
    <div>
      {compliance && !complianceConfirmed && screen !== "landing" && screen !== "processing" && (
        <ComplianceBanner result={compliance} onConfirm={() => setComplianceConfirmed(true)} />
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
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}>
          <RichnessClassificationView
            classification={classification}
            submitting={submitting}
            onProceed={handleProceedFromClassification}
            onOverride={handleOverride}
          />
        </div>
      )}

      {screen === "prdAnalysis" && prdReport && (
        <PRDAnalysisReport report={prdReport} onProceed={() => setScreen("scaleDialogue")} />
      )}

      {screen === "minimalist" && minimalistDialogue && (
        <MinimalistDialogueView
          dialogue={minimalistDialogue}
          submitting={submitting}
          onSubmit={async (answers) => {
            setSubmitting(true);
            try {
              const result = await onboardingApi.submitMinimalistResponse(projectId!, {
                dialogue_id: minimalistDialogue.dialogue_id,
                answers,
              });
              if (result.status === "complete") setScreen("scaleDialogue");
              else pushToast({ severity: "warning", title: "Some answers need review" });
            } catch (err) {
              pushToast({
                severity: "error",
                title: "Could not submit answers",
                body: err instanceof ApiError ? err.message : "Unknown error",
              });
            } finally {
              setSubmitting(false);
            }
          }}
        />
      )}

      {screen === "seedBuilder" && seedDialogue && (
        <SeedBuilderView
          dialogue={seedDialogue}
          submitting={submitting}
          onSubmitStep={async (stepId, fieldValues, navigation) => {
            setSubmitting(true);
            try {
              const result = await onboardingApi.submitSeedBuilderResponse(projectId!, {
                dialogue_id: seedDialogue.dialogue_id,
                step_id: stepId,
                field_values: fieldValues,
                navigation,
              });
              if (navigation === "submit" && result.status === "complete") setScreen("scaleDialogue");
            } catch (err) {
              pushToast({
                severity: "error",
                title: "Could not submit step",
                body: err instanceof ApiError ? err.message : "Unknown error",
              });
            } finally {
              setSubmitting(false);
            }
          }}
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
