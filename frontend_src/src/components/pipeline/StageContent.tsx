// =============================================================================
// StageContent — Switch component that renders the correct panel based on stage
// =============================================================================

import { usePipelineStore } from '@/stores/pipelineStore';
import type { StageName } from '@/types/domain';
import PrdAnalysisScreen from './PrdAnalysisScreen';
import MinimalistDialogueScreen from './MinimalistDialogueScreen';
import SeedQuestionScreen from './SeedQuestionScreen';
import IdeationSteeringPanel from './IdeationSteeringPanel';
import ActorSteeringPanel from './ActorSteeringPanel';
import CapabilitySteeringPanel from './CapabilitySteeringPanel';
import UseCaseSteeringPanel from './UseCaseSteeringPanel';
import StorySteeringPanel from './StorySteeringPanel';
import TaskSteeringPanel from './TaskSteeringPanel';

function InputEntryFlow() {
  const richnessMode = usePipelineStore((s) => s.richnessMode);

  switch (richnessMode) {
    case 'WELL_FORMED':
      return <PrdAnalysisScreen />;
    case 'MINIMALIST':
      return <MinimalistDialogueScreen />;
    case 'SEED_ONLY':
      return <SeedQuestionScreen />;
    default:
      return (
        <div className="flex h-full items-center justify-center">
          <p className="text-sm text-slate-500">Waiting for input classification...</p>
        </div>
      );
  }
}

export default function StageContent() {
  const currentStage = usePipelineStore((s) => s.currentStage);

  if (!currentStage) {
    return <InputEntryFlow />;
  }

  const stageMap: Record<StageName, React.ReactNode> = {
    prd_analysis: <PrdAnalysisScreen />,
    ideation: <IdeationSteeringPanel />,
    actor_discovery: <ActorSteeringPanel />,
    capability_discovery: <CapabilitySteeringPanel />,
    use_case_discovery: <UseCaseSteeringPanel />,
    story_discovery: <StorySteeringPanel />,
    task_decomposition: <TaskSteeringPanel />,
  };

  return stageMap[currentStage] ?? <InputEntryFlow />;
}
