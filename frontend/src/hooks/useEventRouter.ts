// =============================================================================
// Event Router — Routes all SSE events to the correct Zustand store
// Complete routing table from UI architecture document §4.2
// =============================================================================

import { useEffect, useRef } from 'react';
import { sseManager } from '@/lib/sse';
import { usePipelineStore } from '@/stores/pipelineStore';
import { useSteeringStore } from '@/stores/steeringStore';
import { useDecisionStore } from '@/stores/decisionStore';
import { useAuditStore } from '@/stores/auditStore';
import { useStreamingStore } from '@/stores/streamingStore';
import { useCheckpointStore } from '@/stores/checkpointStore';
import { useImpactStore } from '@/stores/impactStore';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { useChatStore } from '@/stores/chatStore';
import type { StageName, ImpactReport, SteeringPanel, AuditEvent, Checkpoint, RichnessMode } from '@/types/domain';

export function useEventRouter(sessionId: string | null) {
  const handlersRegistered = useRef(false);

  // Get store setters directly (stable refs)
  const pipelineSetStage = usePipelineStore((s) => s.setStage);
  const pipelineSetStatus = usePipelineStore((s) => s.setStatus);
  const pipelineSetRichnessMode = usePipelineStore((s) => s.setRichnessMode);
  const pipelineSetClassificationBasis = usePipelineStore((s) => s.setClassificationBasis);
  const pipelineComputeDerived = usePipelineStore((s) => s.computeDerived);

  const steeringSetPanel = useSteeringStore((s) => s.setPanel);
  const steeringSetPrdAnalysis = useSteeringStore((s) => s.setPrdAnalysis);
  const steeringSetScaleDialogue = useSteeringStore((s) => s.setScaleDialogue);
  const steeringSetScaleConflict = useSteeringStore((s) => s.setScaleConflict);
  const steeringSetHostingMatrix = useSteeringStore((s) => s.setHostingMatrix);
  const steeringSetTechStackMatrix = useSteeringStore((s) => s.setTechStackMatrix);
  const steeringSetRbacModel = useSteeringStore((s) => s.setRbacModel);
  const steeringSetRbacConflict = useSteeringStore((s) => s.setRbacConflict);
  const steeringSetEscalationFlag = useSteeringStore((s) => s.setEscalationFlag);
  const steeringSetInheritanceCycle = useSteeringStore((s) => s.setInheritanceCycle);
  const steeringSetInfraStale = useSteeringStore((s) => s.setInfraStale);
  const steeringSetSteeringRequired = useSteeringStore((s) => s.setSteeringRequired);
  const steeringSetLlmFailure = useSteeringStore((s) => s.setLlmFailure);
  const steeringSetComplianceDetected = useSteeringStore((s) => s.setComplianceDetected);
  const steeringSetValidationError = useSteeringStore((s) => s.setValidationError);
  const steeringSetMinimalistDialogue = useSteeringStore((s) => s.setMinimalistDialogue);

  const decisionAddEntry = useDecisionStore((s) => s.addEntry);
  const decisionSupersedeEntry = useDecisionStore((s) => s.supersedeEntry);
  const decisionRevertEntry = useDecisionStore((s) => s.revertEntry);
  const decisionMarkBudgetExhausted = useDecisionStore((s) => s.markBudgetExhausted);

  const auditAppendEvent = useAuditStore((s) => s.appendEvent);

  const streamingAppendChunk = useStreamingStore((s) => s.appendChunk);
  const streamingSetStreaming = useStreamingStore((s) => s.setStreaming);
  const streamingClearChunks = useStreamingStore((s) => s.clearChunks);
  const streamingSetCurrentStage = useStreamingStore((s) => s.setCurrentStage);

  const checkpointAddCheckpoint = useCheckpointStore((s) => s.addCheckpoint);

  const impactSetReport = useImpactStore((s) => s.setReport);
  const impactSetLoading = useImpactStore((s) => s.setLoading);

  const authMarkReauthRequired = useAuthStore((s) => s.markReauthRequired);

  const notificationAddToast = useNotificationStore((s) => s.addToast);
  const notificationSetTabTitle = useNotificationStore((s) => s.setTabTitle);

  const chatAddMessage = useChatStore((s) => s.addMessage);
  const chatSetLoading = useChatStore((s) => s.setLoading);

  useEffect(() => {
    if (!sessionId || handlersRegistered.current) return;

    // ── ROUTING TABLE: Every event mapped to its store handler ──

    const unsubRichnessMode = sseManager.on('RICHNESS_MODE_DETECTED', (data: unknown) => {
      const payload = data as { mode: string; classification_basis: string[] };
      pipelineSetRichnessMode(payload.mode as RichnessMode);
      pipelineSetClassificationBasis(payload.classification_basis);
    });

    const unsubPrdAnalysis = sseManager.on('PRD_ANALYSIS_READY', (data: unknown) => {
      steeringSetPrdAnalysis(data as Parameters<typeof steeringSetPrdAnalysis>[0]);
    });

    const unsubSteeringPanel = sseManager.on('STEERING_PANEL_READY', (data: unknown) => {
      const payload = data as SteeringPanel;
      pipelineSetStage(payload.stage);
      pipelineSetStatus('paused');
      pipelineComputeDerived();
      steeringSetPanel(payload);
      notificationSetTabTitle(`[Ready] ${payload.stage}`);
      notificationAddToast({
        id: crypto.randomUUID(),
        type: 'info',
        title: 'Steering Panel Ready',
        message: `${payload.stage} output is ready for your review.`,
      });
    });

    const unsubStageStarted = sseManager.on('STAGE_STARTED', (data: unknown) => {
      const payload = data as { stage: StageName };
      pipelineSetStatus('running');
      pipelineComputeDerived();
      streamingSetStreaming(true);
      streamingClearChunks();
      streamingSetCurrentStage(payload.stage);
    });

    const unsubStageCompleted = sseManager.on('STAGE_COMPLETED', (data: unknown) => {
      pipelineSetStatus('paused');
      pipelineComputeDerived();
      streamingSetStreaming(false);
      if ((data as Record<string, unknown>)?.checkpoint) {
        checkpointAddCheckpoint((data as { checkpoint: Checkpoint }).checkpoint);
      }
    });

    const unsubStageFailed = sseManager.on('STAGE_FAILED', (data: unknown) => {
      const payload = data as { reason: string };
      pipelineSetStatus('failed');
      pipelineComputeDerived();
      streamingSetStreaming(false);
      notificationAddToast({
        id: crypto.randomUUID(),
        type: 'error',
        title: 'Stage Failed',
        message: payload.reason,
      });
    });

    const unsubPipelineComplete = sseManager.on('PIPELINE_COMPLETE', () => {
      pipelineSetStatus('completed');
      pipelineSetStage(null);
      pipelineComputeDerived();
      notificationAddToast({
        id: crypto.randomUUID(),
        type: 'success',
        title: 'Pipeline Complete',
        message: 'All stages have been completed and confirmed.',
      });
    });

    // ── Streaming ──
    const unsubStreamChunk = sseManager.on('STREAM_CHUNK', (data: unknown) => {
      streamingAppendChunk(data as Parameters<typeof streamingAppendChunk>[0]);
    });

    // ── Decisions ──
    const unsubDecisionLogged = sseManager.on('DECISION_LOGGED', (data: unknown) => {
      decisionAddEntry(data as Parameters<typeof decisionAddEntry>[0]);
    });

    const unsubDecisionSuperseded = sseManager.on('DECISION_SUPERSEDED', (data: unknown) => {
      const payload = data as { old_id: string; new_id: string };
      decisionSupersedeEntry(payload.old_id, payload.new_id);
    });

    const unsubDecisionReverted = sseManager.on('DECISION_REVERTED', (data: unknown) => {
      const payload = data as { reverted_to_id: string; new_entry_id: string };
      decisionRevertEntry(payload.reverted_to_id, payload.new_entry_id);
    });

    // ── Impact ──
    const unsubImpactReport = sseManager.on('IMPACT_REPORT_READY', (data: unknown) => {
      impactSetReport(data as ImpactReport);
      impactSetLoading(false);
    });

    const unsubPropagationStarted = sseManager.on('PROPAGATION_STARTED', (data: unknown) => {
      const payload = data as { affected_stages: string[] };
      pipelineSetStatus('running');
      pipelineComputeDerived();
      notificationAddToast({
        id: crypto.randomUUID(),
        type: 'info',
        title: 'Propagation Started',
        message: `Re-running stages: ${payload.affected_stages.join(', ')}`,
      });
    });

    const unsubPropagationComplete = sseManager.on('PROPAGATION_COMPLETE', () => {
      pipelineSetStatus('paused');
      pipelineComputeDerived();
      notificationAddToast({
        id: crypto.randomUUID(),
        type: 'success',
        title: 'Propagation Complete',
        message: 'All affected stages have been updated.',
      });
    });

    // ── Audit ──
    const unsubAuditEvent = sseManager.on('AUDIT_EVENT_WRITTEN', (data: unknown) => {
      auditAppendEvent(data as AuditEvent);
    });

    // ── Checkpoints ──
    const unsubCheckpointCreated = sseManager.on('CHECKPOINT_CREATED', (data: unknown) => {
      checkpointAddCheckpoint(data as Checkpoint);
    });

    const unsubCheckpointRestored = sseManager.on('CHECKPOINT_RESTORED', (data: unknown) => {
      const payload = data as { label: string };
      pipelineSetStatus('paused');
      pipelineComputeDerived();
      notificationAddToast({
        id: crypto.randomUUID(),
        type: 'warning',
        title: 'Checkpoint Restored',
        message: `Restored to ${payload.label}. Post-checkpoint decisions marked superseded.`,
      });
    });

    // ── Budget ──
    const unsubBudgetExhausted = sseManager.on('REVISION_BUDGET_EXHAUSTED', (data: unknown) => {
      const payload = data as { budget_id: string; decision_point: string };
      decisionMarkBudgetExhausted(payload.budget_id);
      notificationAddToast({
        id: crypto.randomUUID(),
        type: 'warning',
        title: 'Revision Budget Exhausted',
        message: `Decision point "${payload.decision_point}" has reached its revision limit.`,
      });
    });

    // ── Validation ──
    const unsubUserOptionIncoherent = sseManager.on('USER_OPTION_INCOHERENT', (data: unknown) => {
      const payload = data as { failure_reason: string; suggestion?: string };
      steeringSetValidationError(payload);
      notificationAddToast({
        id: crypto.randomUUID(),
        type: 'error',
        title: 'Invalid Option',
        message: payload.failure_reason,
      });
    });

    // ── Advisors ──
    const unsubScaleDialogue = sseManager.on('SCALE_DIALOGUE_OPENED', (data: unknown) => {
      const payload = data as { questions: Array<{ field: string; label: string }> };
      steeringSetScaleDialogue(payload);
    });

    const unsubScaleConflict = sseManager.on('SCALE_INPUT_CONFLICT', (data: unknown) => {
      const payload = data as { conflict_description: string; affected_fields: string[] };
      steeringSetScaleConflict(payload);
    });

    const unsubHostingOptions = sseManager.on('HOSTING_OPTIONS_READY', (data: unknown) => {
      const payload = data as { options: unknown[] };
      steeringSetHostingMatrix(payload.options as Parameters<typeof steeringSetHostingMatrix>[0]);
    });

    const unsubTechStackOptions = sseManager.on('TECH_STACK_OPTIONS_READY', (data: unknown) => {
      const payload = data as { options: unknown[] };
      steeringSetTechStackMatrix(payload.options as Parameters<typeof steeringSetTechStackMatrix>[0]);
    });

    const unsubRbacModel = sseManager.on('RBAC_MODEL_READY', (data: unknown) => {
      steeringSetRbacModel(data as Parameters<typeof steeringSetRbacModel>[0]);
    });

    const unsubRbacConflict = sseManager.on('RBAC_CONFLICT_DETECTED', (data: unknown) => {
      const payload = data as { conflict_id: string; roles: string[]; permission: string };
      steeringSetRbacConflict(payload);
    });

    const unsubPrivilegeEscalation = sseManager.on('PRIVILEGE_ESCALATION_FLAGGED', (data: unknown) => {
      const payload = data as { path: string; resulting_access: string; algorithm: string; depth_limit: number; conditions_evaluated: boolean };
      steeringSetEscalationFlag(payload);
    });

    const unsubInheritanceCycle = sseManager.on('RBAC_INHERITANCE_CYCLE_DETECTED', (data: unknown) => {
      const payload = data as { cycle_check_passed: boolean; cycle_path?: string[] };
      steeringSetInheritanceCycle(payload);
    });

    const unsubInfraStale = sseManager.on('INFRASTRUCTURE_PROFILE_STALE', (data: unknown) => {
      const payload = data as { stale: boolean };
      steeringSetInfraStale(payload);
    });

    // ── Steering ──
    const unsubSteeringRequired = sseManager.on('STEERING_REQUIRED', (data: unknown) => {
      const payload = data as { reason: string; details?: string };
      pipelineSetStatus('paused');
      pipelineComputeDerived();
      steeringSetSteeringRequired(payload);
      notificationAddToast({
        id: crypto.randomUUID(),
        type: 'warning',
        title: 'Steering Required',
        message: payload.reason,
      });
    });

    // ── LLM ──
    const unsubLlmFailure = sseManager.on('LLM_FAILURE_RESOLUTION', (data: unknown) => {
      const payload = data as { failure_reason: string; resolution_options?: string[] };
      steeringSetLlmFailure(payload);
    });

    // ── Chat ──
    const unsubContextResponse = sseManager.on('CONTEXT_RESPONSE', (data: unknown) => {
      const payload = data as { answer: string };
      chatAddMessage({
        id: crypto.randomUUID(),
        role: 'system',
        content: payload.answer,
        timestamp: new Date().toISOString(),
      });
      chatSetLoading(false);
    });

    // ── Session ──
    const unsubSessionSuspended = sseManager.on('SESSION_SUSPENDED', () => {
      pipelineSetStatus('suspended');
      pipelineComputeDerived();
    });

    const unsubSessionExpired = sseManager.on('SESSION_EXPIRED', () => {
      pipelineSetStatus('expired');
      pipelineComputeDerived();
      authMarkReauthRequired();
    });

    // ── Compliance ──
    const unsubCompliance = sseManager.on('COMPLIANCE_DETECTED', (data: unknown) => {
      const payload = data as { detected_compliance_frameworks: string[]; pre_populated_defaults: Record<string, unknown> };
      steeringSetComplianceDetected({
        frameworks: payload.detected_compliance_frameworks,
        defaults: payload.pre_populated_defaults,
      });
    });

    // ── Minimalist Dialogue ──
    const unsubMinimalistDialogue = sseManager.on('MINIMALIST_DIALOGUE_UPDATE', (data: unknown) => {
      const payload = data as Parameters<typeof steeringSetMinimalistDialogue>[0];
      steeringSetMinimalistDialogue(payload);
    });

    handlersRegistered.current = true;

    return () => {
      unsubRichnessMode();
      unsubPrdAnalysis();
      unsubSteeringPanel();
      unsubStageStarted();
      unsubStageCompleted();
      unsubStageFailed();
      unsubPipelineComplete();
      unsubStreamChunk();
      unsubDecisionLogged();
      unsubDecisionSuperseded();
      unsubDecisionReverted();
      unsubImpactReport();
      unsubPropagationStarted();
      unsubPropagationComplete();
      unsubAuditEvent();
      unsubCheckpointCreated();
      unsubCheckpointRestored();
      unsubBudgetExhausted();
      unsubUserOptionIncoherent();
      unsubScaleDialogue();
      unsubScaleConflict();
      unsubHostingOptions();
      unsubTechStackOptions();
      unsubRbacModel();
      unsubRbacConflict();
      unsubPrivilegeEscalation();
      unsubInheritanceCycle();
      unsubInfraStale();
      unsubSteeringRequired();
      unsubLlmFailure();
      unsubContextResponse();
      unsubSessionSuspended();
      unsubSessionExpired();
      unsubCompliance();
      unsubMinimalistDialogue();
      handlersRegistered.current = false;
    };
  }, [
    sessionId,
    pipelineSetStage,
    pipelineSetStatus,
    pipelineSetRichnessMode,
    pipelineSetClassificationBasis,
    pipelineComputeDerived,
    steeringSetPanel,
    steeringSetPrdAnalysis,
    steeringSetScaleDialogue,
    steeringSetScaleConflict,
    steeringSetHostingMatrix,
    steeringSetTechStackMatrix,
    steeringSetRbacModel,
    steeringSetRbacConflict,
    steeringSetEscalationFlag,
    steeringSetInheritanceCycle,
    steeringSetInfraStale,
    steeringSetSteeringRequired,
    steeringSetLlmFailure,
    steeringSetComplianceDetected,
    steeringSetValidationError,
    steeringSetMinimalistDialogue,
    decisionAddEntry,
    decisionSupersedeEntry,
    decisionRevertEntry,
    decisionMarkBudgetExhausted,
    auditAppendEvent,
    streamingAppendChunk,
    streamingSetStreaming,
    streamingClearChunks,
    streamingSetCurrentStage,
    checkpointAddCheckpoint,
    impactSetReport,
    impactSetLoading,
    authMarkReauthRequired,
    notificationAddToast,
    notificationSetTabTitle,
    chatAddMessage,
    chatSetLoading,
  ]);
}
