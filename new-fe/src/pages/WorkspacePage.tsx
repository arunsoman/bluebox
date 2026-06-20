import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { projectsApi } from "@/api/endpoints/projects";
import { AppShell } from "@/components/shell/AppShell";
import { PanelPlaceholder } from "@/components/shell/PanelPlaceholder";
import { Spinner } from "@/components/common/Spinner";
import { useEnsurePipelineConnection } from "@/hooks/useEnsurePipelineConnection";
import { socketClient } from "@/ws/socketClient";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { SteeringPanelView } from "@/components/steering/SteeringPanelView";
import { FileExplorer } from "@/components/files/FileExplorer";
import { EditorPanel } from "@/components/editor/EditorPanel";
import { AuditPanel } from "@/components/audit/AuditPanel";
import { BlueprintGraph } from "@/components/graph/BlueprintGraph";
import { NodeEditorModal } from "@/components/nodes/NodeEditorModal";
import { AddNodeModal } from "@/components/nodes/AddNodeModal";
import { DeleteNodeModal } from "@/components/nodes/DeleteNodeModal";
import { CompletenessGateModal } from "@/components/gate/CompletenessGateModal";
import { RBACMatrixEditorModal } from "@/components/rbac/RBACMatrixEditorModal";
import { TechStackOptionsModal } from "@/components/techstack/TechStackOptionsModal";
import { MergeConflictModal } from "@/components/workspace/MergeConflictModal";
import { DeploymentModal } from "@/components/deploy/DeploymentModal";
import { CheckpointRestoreModal } from "@/components/checkpoints/CheckpointRestoreModal";
import { usePipelineStore } from "@/stores/pipelineStore";
import { useCompletenessGateStore } from "@/stores/completenessGateStore";
import { useRbacGateStore } from "@/stores/rbacGateStore";
import { useTechStackGateStore } from "@/stores/techStackGateStore";
import { useMergeConflictStore } from "@/stores/mergeConflictStore";
import { useDeploymentStore } from "@/stores/deploymentStore";
import { useCheckpointRestoreStore } from "@/stores/checkpointRestoreStore";
import { useLogViewerStore } from "@/stores/logViewerStore";

export function WorkspacePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { ready, error } = useEnsurePipelineConnection(projectId);
  const [projectName, setProjectName] = useState<string | null>(null);
  const pendingSteering = usePipelineStore((s) => s.pipelineState?.pending_steering ?? false);
  const currentState = usePipelineStore((s) => s.pipelineState?.current_state);
  const gateOpen = useCompletenessGateStore((s) => s.open);
  const showGate = useCompletenessGateStore((s) => s.show);
  const hideGate = useCompletenessGateStore((s) => s.hide);
  const rbacGateOpen = useRbacGateStore((s) => s.open);
  const showRbacGate = useRbacGateStore((s) => s.show);
  const hideRbacGate = useRbacGateStore((s) => s.hide);
  const techStackGateOpen = useTechStackGateStore((s) => s.open);
  const techStackMatrix = useTechStackGateStore((s) => s.matrix);
  const showTechStackGate = useTechStackGateStore((s) => s.show);
  const hideTechStackGate = useTechStackGateStore((s) => s.hide);
  const mergeConflict = useMergeConflictStore((s) => s.conflict);
  const showMergeConflict = useMergeConflictStore((s) => s.show);
  const hideMergeConflict = useMergeConflictStore((s) => s.hide);
  const deployOpen = useDeploymentStore((s) => s.open);
  const hideDeploy = useDeploymentStore((s) => s.hide);
  const checkpointsOpen = useCheckpointRestoreStore((s) => s.open);
  const hideCheckpoints = useCheckpointRestoreStore((s) => s.hide);

  useEffect(() => {
    if (!projectId) return;
    projectsApi.get(projectId).then((p) => setProjectName(p.project_name));
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    useLogViewerStore.getState().setProjectId(projectId);
  }, [projectId]);

  useEffect(() => {
    if (currentState === "FINAL_GATE") showGate();
  }, [currentState, showGate]);

  useEffect(() => {
    if (!ready) return;
    return socketClient.on("RBAC_MODEL_READY", () => showRbacGate());
  }, [ready, showRbacGate]);

  useEffect(() => {
    if (!ready) return;
    return socketClient.on("TECH_STACK_OPTIONS_READY", (matrix) => showTechStackGate(matrix));
  }, [ready, showTechStackGate]);

  useEffect(() => {
    if (!ready) return;
    const unsubscribers = [
      socketClient.on("MERGE_CONFLICT", (info) => showMergeConflict(info)),
      socketClient.on("EDITOR_CONFLICT", (info) => showMergeConflict({ ...info, conflicting_user_id: undefined })),
    ];
    return () => unsubscribers.forEach((u) => u());
  }, [ready, showMergeConflict]);

  if (!ready || projectName === null) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 64 }}>
        {error ? <p>{error}</p> : <Spinner />}
      </div>
    );
  }

  return (
    <>
      <AppShell
        projectName={projectName}
        chatPanel={<ChatPanel />}
        fileExplorer={<FileExplorer />}
        centerPanels={{
          editor: <EditorPanel />,
          steering: <SteeringPanelView />,
          graph: <BlueprintGraph />,
        }}
        centerTabBadge={{ steering: pendingSteering }}
        rightPanel={<PanelPlaceholder name="Live Preview" note="Deferred — out of scope for this pass." />}
        bottomPanels={{
          terminal: <PanelPlaceholder name="Terminal" note="Deferred — out of scope for this pass." />,
          "test-results": <PanelPlaceholder name="Test Results" note="Deferred — out of scope for this pass." />,
          "audit-trail": <AuditPanel />,
        }}
      />
      <NodeEditorModal />
      <AddNodeModal />
      <DeleteNodeModal />
      {gateOpen && <CompletenessGateModal onClose={hideGate} />}
      {rbacGateOpen && <RBACMatrixEditorModal onClose={hideRbacGate} />}
      {techStackGateOpen && techStackMatrix && (
        <TechStackOptionsModal matrix={techStackMatrix} onClose={hideTechStackGate} />
      )}
      {mergeConflict && <MergeConflictModal conflict={mergeConflict} onClose={hideMergeConflict} />}
      {deployOpen && <DeploymentModal onClose={hideDeploy} />}
      {checkpointsOpen && <CheckpointRestoreModal onClose={hideCheckpoints} />}
    </>
  );
}
