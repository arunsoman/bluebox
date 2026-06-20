import { useEffect } from "react";
import { useSteeringStore } from "@/stores/steeringStore";
import { usePipelineStore } from "@/stores/pipelineStore";
import { EmptyState } from "@/components/common/EmptyState";
import { ActorDiscoveryPanel } from "./ActorDiscoveryPanel";
import { CapabilityDefinitionPanel } from "./CapabilityDefinitionPanel";
import { UseCaseDecompositionPanel } from "./UseCaseDecompositionPanel";
import { StoryDecompositionPanel } from "./StoryDecompositionPanel";
import { TaskDecompositionPanel } from "./TaskDecompositionPanel";
import { GenericStagePanel } from "./GenericStagePanel";

/**
 * Dispatches to the stage-specific panel for the current SteeringPanel's
 * stage_id (mock_server.py's numbering: 1=Actor Discovery, 2=Capability
 * Definition, 3=Use Case, 4=Story, 5=Task Decomposition). Any other
 * stage_id falls back to the generic renderer.
 */
export function SteeringPanelView() {
  const projectId = usePipelineStore((s) => s.projectId);
  const panel = useSteeringStore((s) => s.panel);
  const init = useSteeringStore((s) => s.init);

  useEffect(() => {
    if (projectId) init(projectId);
  }, [projectId, init]);

  if (!panel) {
    return (
      <EmptyState
        title="Waiting for the next stage boundary"
        description="The Steering Panel populates once the backend has a draft ready for review."
      />
    );
  }

  switch (panel.stage_id) {
    case 1:
      return <ActorDiscoveryPanel />;
    case 2:
      return <CapabilityDefinitionPanel />;
    case 3:
      return <UseCaseDecompositionPanel />;
    case 4:
      return <StoryDecompositionPanel />;
    case 5:
      return <TaskDecompositionPanel />;
    default:
      return <GenericStagePanel />;
  }
}
