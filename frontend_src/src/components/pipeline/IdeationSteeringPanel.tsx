// =============================================================================
// IdeationSteeringPanel — Per UI architecture section 6.5
// ProductIdea cards showing: name, one_line_summary, value_proposition,
// target_customer_fit, differentiation
// Each card: rank, confidence badge, rationale, trade-offs (gains/losses)
// Options panel with ranked alternatives
// Select / Modify / Bookmark buttons per option
// =============================================================================

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Lightbulb, Star } from 'lucide-react';
import { useSteeringStore } from '@/stores/steeringStore';
import { usePipelineStore } from '@/stores/pipelineStore';
import { pipelineApi } from '@/lib/api';
import NodeCard from '@/components/shared/NodeCard';
import OptionCard from '@/components/shared/OptionCard';
import type { ProductIdea, ProductIdeaSet, SteeringOption } from '@/types/domain';

export default function IdeationSteeringPanel() {
  const sessionId = usePipelineStore((s) => s.sessionId);
  const currentStage = usePipelineStore((s) => s.currentStage);
  const draftOutput = useSteeringStore((s) => s.draftOutput);
  const options = useSteeringStore((s) => s.options);
  const viewMode = useSteeringStore((s) => s.viewMode);
  const selectedOptionId = useSteeringStore((s) => s.selectedOptionId);
  const bookmarkedOptionIds = useSteeringStore((s) => s.bookmarkedOptionIds);
  const selectOption = useSteeringStore((s) => s.selectOption);
  const toggleBookmark = useSteeringStore((s) => s.toggleBookmark);

  const ideaSet: ProductIdeaSet | null = useMemo(() => {
    if (!draftOutput) return null;
    return (draftOutput as { idea_set?: ProductIdeaSet }).idea_set ?? null;
  }, [draftOutput]);

  const primaryIdea = ideaSet?.primary;
  const alternatives = ideaSet?.alternatives ?? [];

  const sendAction = async (actionType: string, payload: Record<string, unknown> = {}) => {
    if (!sessionId || !currentStage) return;
    await pipelineApi.steer(sessionId, {
      session_id: sessionId,
      action_type: actionType,
      stage: currentStage,
      payload,
      timestamp: new Date().toISOString(),
    });
  };

  const handleSelect = async (option: SteeringOption) => {
    selectOption(option.option_id);
    await sendAction('ACCEPT', { selected_option_id: option.option_id });
  };

  if (!primaryIdea) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-slate-500">Waiting for ideation output...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto space-y-4 p-4">
        {/* Primary Idea */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
            <Lightbulb className="h-4 w-4 text-amber-400" />
            Primary Product Idea
          </h3>

          {viewMode === 'summary' ? (
            <NodeCard
              id={primaryIdea.idea_id}
              title={primaryIdea.name}
              subtitle={primaryIdea.description?.slice(0, 100)}
              type="Product Idea"
              typeColor="bg-amber-900/60 text-amber-300 border-amber-700"
              traceability="EXPLICIT"
              confidence={primaryIdea.confidence}
              icon={<Lightbulb className="h-4 w-4" />}
            >
              <IdeaDetail idea={primaryIdea} />
            </NodeCard>
          ) : (
            <div className="rounded-lg border border-amber-700/40 bg-amber-900/20 p-4">
              <IdeaDetail idea={primaryIdea} />
            </div>
          )}
        </motion.div>

        {/* Alternatives */}
        {alternatives.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Alternative Ideas ({alternatives.length})
            </h3>
            <div className="space-y-2">
              {alternatives.map((idea) => (
                <NodeCard
                  key={idea.idea_id}
                  id={idea.idea_id}
                  title={idea.name}
                  subtitle={idea.description?.slice(0, 100)}
                  type="Alternative"
                  typeColor="bg-slate-800 text-slate-300 border-slate-600"
                  traceability="INFERRED"
                  confidence={idea.confidence}
                  icon={<Star className="h-4 w-4" />}
                >
                  <IdeaDetail idea={idea} />
                </NodeCard>
              ))}
            </div>
          </motion.div>
        )}

        {/* System Options */}
        {options.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
              System Options
            </h3>
            <div className="space-y-2">
              {options.map((option) => (
                <OptionCard
                  key={option.option_id}
                  option={option}
                  isSelected={selectedOptionId === option.option_id}
                  isBookmarked={bookmarkedOptionIds.includes(option.option_id)}
                  onSelect={() => handleSelect(option)}
                  onBookmark={() => toggleBookmark(option.option_id)}
                  onModify={() => sendAction('ASK_ME', { option_id: option.option_id, context: 'modify' })}
                />
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function IdeaDetail({ idea }: { idea: ProductIdea }) {
  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs text-slate-400">{idea.description}</p>
      {idea.source_fragment && (
        <div className="rounded bg-slate-900/60 px-2 py-1.5">
          <span className="text-[10px] font-medium text-slate-500">Source:</span>
          <p className="text-xs text-slate-400 italic">&quot;{idea.source_fragment}&quot;</p>
        </div>
      )}
      {idea.alternatives_considered && idea.alternatives_considered.length > 0 && (
        <div className="mt-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Alternatives Considered
          </span>
          <div className="mt-1 flex flex-wrap gap-1">
            {idea.alternatives_considered.map((alt) => (
              <span
                key={alt.option_id}
                className="rounded bg-slate-700 px-2 py-0.5 text-[10px] text-slate-300"
              >
                {alt.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
