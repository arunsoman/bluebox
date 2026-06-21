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
 * stage_id. Live backend numbering (be/.../steering_service.py
 * `_STAGE_NAMES`, stage_advance.py's FIRST/LAST_GENERATIVE_STAGE): 2=Actor
 * Discovery, 3=Capability Definition, 4=Use Case, 5=User Story, 6=Task
 * Decomposition. Any other stage_id falls back to the generic renderer.
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
    case 2:
      return <ActorDiscoveryPanel />;
    case 3:
      return <CapabilityDefinitionPanel />;
    case 4:
      return <UseCaseDecompositionPanel />;
    case 5:
      return <StoryDecompositionPanel />;
    case 6:
      return <TaskDecompositionPanel />;
    default:
      return <GenericStagePanel />;
  }
}
