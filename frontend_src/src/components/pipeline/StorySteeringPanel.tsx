// =============================================================================
// StorySteeringPanel — User story cards: "As a [actor], I want [capability] so that [use_case]"
// Acceptance criteria in Given/When/Then format
// Priority badge, story points, dependencies
// Traceability badge
// =============================================================================

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Flag, Link2 } from 'lucide-react';
import { useSteeringStore } from '@/stores/steeringStore';
import { cn } from '@/lib/utils';
import NodeCard from '@/components/shared/NodeCard';
import type { UserStory, UserStorySet, StoryPriority } from '@/types/domain';

const priorityConfig: Record<StoryPriority, { color: string; label: string }> = {
  critical: { color: 'bg-red-900/60 text-red-300 border-red-700', label: 'Critical' },
  high: { color: 'bg-orange-900/60 text-orange-300 border-orange-700', label: 'High' },
  medium: { color: 'bg-amber-900/60 text-amber-300 border-amber-700', label: 'Medium' },
  low: { color: 'bg-slate-800 text-slate-400 border-slate-600', label: 'Low' },
};

export default function StorySteeringPanel() {
  const draftOutput = useSteeringStore((s) => s.draftOutput);

  const result: UserStorySet | null = useMemo(() => {
    if (!draftOutput) return null;
    return (draftOutput as { story_set?: UserStorySet }).story_set ?? null;
  }, [draftOutput]);

  if (!result) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-slate-500">Waiting for story discovery...</p>
      </div>
    );
  }

  const { stories, completeness_percent } = result;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto space-y-4 p-4">
        {/* Completeness */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/30 px-4 py-3"
        >
          <span className="text-sm font-medium text-slate-300">Story Completeness</span>
          <div className="flex items-center gap-2">
            <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-700">
              <motion.div
                className="h-full rounded-full bg-emerald-500"
                initial={{ width: 0 }}
                animate={{ width: `${(completeness_percent ?? 0) * 100}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
            <span className="text-xs font-bold text-emerald-400">
              {Math.round((completeness_percent ?? 0) * 100)}%
            </span>
          </div>
        </motion.div>

        {/* Stories */}
        <div className="space-y-2">
          {stories.map((story, idx) => (
            <StoryCard key={story.story_id} story={story} index={idx} />
          ))}
        </div>
      </div>
    </div>
  );
}

function StoryCard({ story, index }: { story: UserStory; index: number }) {
  const priority = priorityConfig[story.priority];

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.2 }}
    >
      <NodeCard
        id={story.story_id}
        title={`As a ${story.role}, I want ${story.action}`}
        subtitle={`So that ${story.benefit}`}
        type="Story"
        typeColor="bg-indigo-900/60 text-indigo-300 border-indigo-700"
        traceability={story.traceability}
        confidence={story.confidence}
        icon={<BookOpen className="h-4 w-4" />}
      >
        <div className="mt-3 space-y-3">
          {/* Priority badge */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('rounded border px-1.5 py-0.5 text-[10px] font-semibold', priority.color)}>
              {priority.label}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-slate-500">
              <Flag className="h-3 w-3" />
              Priority
            </span>
          </div>

          {/* Acceptance criteria */}
          {story.acceptance_criteria.length > 0 && (
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Acceptance Criteria
              </span>
              <div className="mt-1 space-y-1.5">
                {story.acceptance_criteria.map((ac) => (
                  <div
                    key={ac.criterion_id}
                    className="rounded-md border border-slate-700/50 bg-slate-900/40 px-3 py-2"
                  >
                    <p className="text-[10px] text-slate-500">
                      <span className="font-semibold text-emerald-500">Given</span>{' '}
                      <span className="text-slate-400">{ac.given}</span>
                    </p>
                    <p className="text-[10px] text-slate-500">
                      <span className="font-semibold text-blue-500">When</span>{' '}
                      <span className="text-slate-400">{ac.when}</span>
                    </p>
                    <p className="text-[10px] text-slate-500">
                      <span className="font-semibold text-purple-500">Then</span>{' '}
                      <span className="text-slate-400">{ac.then}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Test specs */}
          {story.test_specs.length > 0 && (
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Test Specs ({story.test_specs.length})
              </span>
              <div className="mt-1 flex flex-wrap gap-1">
                {story.test_specs.map((ts) => (
                  <span
                    key={ts.test_id}
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[10px]',
                      ts.automated ? 'bg-emerald-900/40 text-emerald-300' : 'bg-slate-700 text-slate-300'
                    )}
                  >
                    {ts.test_type}: {ts.description}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Linked use cases */}
          {story.use_case_ids.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Link2 className="h-3 w-3 text-slate-500" />
              <span className="text-[10px] text-slate-500">Use cases:</span>
              <div className="flex flex-wrap gap-1">
                {story.use_case_ids.map((ucid) => (
                  <span key={ucid} className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300 font-mono">
                    {ucid}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </NodeCard>
    </motion.div>
  );
}
