// =============================================================================
// PipelineProgress — Visual progress bar showing 7 stages with dots
// =============================================================================

import { usePipelineStore } from '@/stores/pipelineStore';
import type { StageName } from '@/types/domain';

const stages: StageName[] = [
  'prd_analysis',
  'ideation',
  'actor_discovery',
  'capability_discovery',
  'use_case_discovery',
  'story_discovery',
  'task_decomposition',
];

const stageLabels: Record<StageName, string> = {
  prd_analysis: 'PRD',
  ideation: 'Idea',
  actor_discovery: 'Actor',
  capability_discovery: 'Cap',
  use_case_discovery: 'UC',
  story_discovery: 'Story',
  task_decomposition: 'Task',
};

export default function PipelineProgress() {
  const currentStage = usePipelineStore((s) => s.currentStage);
  const pipelineStatus = usePipelineStore((s) => s.pipelineStatus);

  const currentIndex = currentStage ? stages.indexOf(currentStage) : -1;

  return (
    <div className="px-3 py-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
        Pipeline Progress
      </h3>

      {/* Stage dots row */}
      <div className="flex items-center justify-between">
        {stages.map((stage, index) => {
          const isCompleted = index < currentIndex || pipelineStatus === 'completed';
          const isCurrent = index === currentIndex && pipelineStatus !== 'completed';
          let dotClass = 'bg-slate-600 border-slate-500';
          if (isCompleted) dotClass = 'bg-emerald-500 border-emerald-400';
          if (isCurrent) dotClass = 'bg-amber-500 border-amber-400 ring-2 ring-amber-500/30';

          return (
            <div key={stage} className="flex flex-col items-center gap-1">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-bold transition-all ${dotClass}`}
                title={stage}
              >
                {isCompleted ? (
                  <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className={isCurrent ? 'text-white' : 'text-slate-400'}>
                    {index}
                  </span>
                )}
              </div>
              <span className={`text-[9px] ${isCurrent ? 'font-semibold text-amber-400' : isCompleted ? 'text-emerald-400' : 'text-slate-500'}`}>
                {stageLabels[stage]}
              </span>
            </div>
          );
        })}
      </div>

      {/* Connecting line */}
      <div className="relative mx-3.5 -mt-[3.25rem] mb-7 h-0.5">
        <div className="absolute inset-0 bg-slate-700" />
        <div
          className="absolute inset-y-0 left-0 bg-emerald-500 transition-all duration-500"
          style={{
            width: pipelineStatus === 'completed'
              ? '100%'
              : currentIndex > 0
                ? `${(currentIndex / (stages.length - 1)) * 100}%`
                : '0%',
          }}
        />
      </div>
    </div>
  );
}
