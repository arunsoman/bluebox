// =============================================================================
// OptionsPanel — Displays system-generated SteeringOption[] from steeringStore
// Each option: rank, label, confidence badge, rationale, trade-offs
// Bookmark toggle, Select button, Modify button
// "Provide Custom Option" expandable form
// Compare mode: side-by-side comparison of bookmarked options
// =============================================================================

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ChevronUp, GitCompare } from 'lucide-react';
import { useSteeringStore } from '@/stores/steeringStore';
import { pipelineApi } from '@/lib/api';
import { usePipelineStore } from '@/stores/pipelineStore';
import OptionCard from '@/components/shared/OptionCard';

export default function OptionsPanel() {
  const options = useSteeringStore((s) => s.options);
  const selectedOptionId = useSteeringStore((s) => s.selectedOptionId);
  const bookmarkedOptionIds = useSteeringStore((s) => s.bookmarkedOptionIds);
  const comparisonMode = useSteeringStore((s) => s.comparisonMode);
  const sessionId = usePipelineStore((s) => s.sessionId);
  const currentStage = usePipelineStore((s) => s.currentStage);
  const selectOption = useSteeringStore((s) => s.selectOption);
  const toggleBookmark = useSteeringStore((s) => s.toggleBookmark);
  const setComparisonMode = useSteeringStore((s) => s.setComparisonMode);

  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [customRationale, setCustomRationale] = useState('');
  const [modifyOptionId, setModifyOptionId] = useState<string | null>(null);
  const [modifyLabel, setModifyLabel] = useState('');

  const handleSelect = async (optionId: string) => {
    if (!sessionId || !currentStage) return;
    selectOption(optionId);
    await pipelineApi.steer(sessionId, {
      session_id: sessionId,
      action_type: 'ACCEPT',
      stage: currentStage,
      payload: { selected_option_id: optionId },
      timestamp: new Date().toISOString(),
    });
  };

  const handleModifySubmit = async (optionId: string) => {
    if (!sessionId || !currentStage) return;
    await pipelineApi.steer(sessionId, {
      session_id: sessionId,
      action_type: 'MODIFY',
      stage: currentStage,
      payload: { option_id: optionId, modified_label: modifyLabel },
      timestamp: new Date().toISOString(),
    });
    setModifyOptionId(null);
    setModifyLabel('');
  };

  const handleCustomSubmit = async () => {
    if (!sessionId || !currentStage || !customLabel.trim()) return;
    await pipelineApi.steer(sessionId, {
      session_id: sessionId,
      action_type: 'CUSTOM_OPTION',
      stage: currentStage,
      payload: { label: customLabel, rationale: customRationale },
      timestamp: new Date().toISOString(),
    });
    setCustomLabel('');
    setCustomRationale('');
    setShowCustomForm(false);
  };

  const bookmarkedOptions = options.filter((o) => bookmarkedOptionIds.includes(o.option_id));

  if (comparisonMode && bookmarkedOptions.length > 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <GitCompare className="h-4 w-4" />
            Comparing {bookmarkedOptions.length} Bookmarked Options
          </h3>
          <button
            onClick={() => setComparisonMode(false)}
            className="rounded-md border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-600"
          >
            Close Comparison
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {bookmarkedOptions.map((option) => (
            <OptionCard
              key={option.option_id}
              option={option}
              isSelected={selectedOptionId === option.option_id}
              isBookmarked
              onSelect={() => handleSelect(option.option_id)}
              onBookmark={() => toggleBookmark(option.option_id)}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">
          Options Presented ({options.length})
        </h3>
        {bookmarkedOptionIds.length > 0 && (
          <button
            onClick={() => setComparisonMode(!comparisonMode)}
            className="flex items-center gap-1 rounded-md border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-600"
          >
            <GitCompare className="h-3 w-3" />
            Compare ({bookmarkedOptionIds.length})
          </button>
        )}
      </div>

      {/* Options list */}
      <AnimatePresence>
        {options.map((option) => (
          <div key={option.option_id} className="relative">
            <OptionCard
              option={option}
              isSelected={selectedOptionId === option.option_id}
              isBookmarked={bookmarkedOptionIds.includes(option.option_id)}
              onSelect={() => handleSelect(option.option_id)}
              onBookmark={() => toggleBookmark(option.option_id)}
              onModify={() => {
                setModifyOptionId(option.option_id);
                setModifyLabel(option.label);
              }}
            />

            {/* Inline modify form */}
            <AnimatePresence>
              {modifyOptionId === option.option_id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 rounded-md border border-slate-600 bg-slate-800 p-3 space-y-2">
                    <label className="block text-xs font-medium text-slate-300">
                      Modified Label
                      <input
                        type="text"
                        value={modifyLabel}
                        onChange={(e) => setModifyLabel(e.target.value)}
                        className="mt-1 block w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
                      />
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleModifySubmit(option.option_id)}
                        className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setModifyOptionId(null)}
                        className="rounded-md border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </AnimatePresence>

      {/* Custom option */}
      <div className="pt-2">
        <button
          onClick={() => setShowCustomForm(!showCustomForm)}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-slate-600 bg-slate-800/50 py-2 text-xs font-medium text-slate-400 transition-colors hover:border-slate-500 hover:text-slate-300"
        >
          {showCustomForm ? <ChevronUp className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          Provide Custom Option
        </button>

        <AnimatePresence>
          {showCustomForm && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-2 space-y-2 rounded-md border border-slate-600 bg-slate-800 p-3">
                <label className="block text-xs font-medium text-slate-300">
                  Option Label *
                  <input
                    type="text"
                    value={customLabel}
                    onChange={(e) => setCustomLabel(e.target.value)}
                    placeholder="Enter your custom option..."
                    className="mt-1 block w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-300">
                  Rationale
                  <textarea
                    value={customRationale}
                    onChange={(e) => setCustomRationale(e.target.value)}
                    placeholder="Why this option?"
                    rows={2}
                    className="mt-1 block w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={handleCustomSubmit}
                    disabled={!customLabel.trim()}
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                  >
                    Submit Custom Option
                  </button>
                  <button
                    onClick={() => setShowCustomForm(false)}
                    className="rounded-md border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
