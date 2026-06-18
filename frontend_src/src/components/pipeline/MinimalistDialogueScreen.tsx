// =============================================================================
// MinimalistDialogueScreen — Per UI architecture section 6.4 (Mode B: MINIMALIST)
// Question display with number ("Question X of Y")
// Answer input text area
// Skip / Suggest Answer / Continue buttons
// Inference notice with "Use Inference" button
// Progress bar showing answered/skipped/inferred count
// Live seed preview panel
// "Confirm & Proceed" button
// ALL data from steeringStore.scaleDialogue / minimalistDialogue — NO mock data
// =============================================================================

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle, SkipForward, Sparkles, ArrowRight, CheckCircle,
  Lightbulb, BarChart3
} from 'lucide-react';
import { useSteeringStore } from '@/stores/steeringStore';
import { usePipelineStore } from '@/stores/pipelineStore';
import { pipelineApi } from '@/lib/api';

export default function MinimalistDialogueScreen() {
  const dialogue = useSteeringStore((s) => s.minimalistDialogue);
  const questions = useSteeringStore((s) => s.minimalistQuestions);
  const sessionId = usePipelineStore((s) => s.sessionId);
  const currentStage = usePipelineStore((s) => s.currentStage);

  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [answerInput, setAnswerInput] = useState('');
  const [suggestedAnswer, setSuggestedAnswer] = useState<string | null>(null);

  const sendAction = useCallback(
    async (actionType: string, payload: Record<string, unknown> = {}) => {
      if (!sessionId) return;
      await pipelineApi.steer(sessionId, {
        session_id: sessionId,
        action_type: actionType,
        stage: currentStage ?? 'prd_analysis',
        payload,
        timestamp: new Date().toISOString(),
      });
    },
    [sessionId, currentStage]
  );

  if (!dialogue || questions.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <MessageCircle className="mx-auto h-8 w-8 text-slate-600" />
          <p className="mt-3 text-sm text-slate-500">Loading dialogue questions...</p>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIdx];
  const totalQuestions = questions.length;
  const answers = dialogue.answers ?? [];

  const answeredCount = answers.filter((a) => a.source === 'user').length;
  const skippedCount = answers.filter((a) => a.source === 'deferred').length;
  const inferredCount = answers.filter((a) => a.source === 'inferred').length;
  const progressPercent = totalQuestions > 0 ? (answers.length / totalQuestions) * 100 : 0;

  const handleContinue = async () => {
    if (!currentQuestion || !answerInput.trim()) return;
    await sendAction('ANSWER_QUESTION', {
      question_id: currentQuestion.question_id,
      field: currentQuestion.field,
      answer: answerInput,
    });
    setAnswerInput('');
    setSuggestedAnswer(null);
    if (currentQuestionIdx < totalQuestions - 1) {
      setCurrentQuestionIdx((i) => i + 1);
    }
  };

  const handleSkip = async () => {
    if (!currentQuestion) return;
    await sendAction('SKIP_QUESTION', {
      question_id: currentQuestion.question_id,
      field: currentQuestion.field,
    });
    setAnswerInput('');
    setSuggestedAnswer(null);
    if (currentQuestionIdx < totalQuestions - 1) {
      setCurrentQuestionIdx((i) => i + 1);
    }
  };

  const handleSuggestAnswer = async () => {
    if (!currentQuestion) return;
    setSuggestedAnswer('Loading suggestion...');
    await sendAction('SUGGEST_ANSWER', {
      question_id: currentQuestion.question_id,
      field: currentQuestion.field,
    });
  };

  const handleUseInference = async (field: string) => {
    await sendAction('ACCEPT_INFERENCE', { field });
  };

  const handleConfirmSeed = async () => {
    await sendAction('CONFIRM_SEED', {});
  };

  // Find current answer for this question if already answered
  const currentAnswer = answers.find((a) => a.field === currentQuestion?.field);

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col gap-4 overflow-y-auto p-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-blue-400" />
          Let&apos;s Build Your Project Seed
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Answer a few questions so we can understand your project.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Main dialogue area */}
        <div className="lg:col-span-2 space-y-4">
          <AnimatePresence mode="wait">
            {currentQuestion ? (
              <motion.div
                key={currentQuestion.question_id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="rounded-lg border border-slate-700 bg-slate-800/50 p-5"
              >
                {/* Question header */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="rounded-full bg-blue-900/60 px-2.5 py-0.5 text-xs font-semibold text-blue-300">
                    Question {currentQuestionIdx + 1} of {totalQuestions}
                  </span>
                  {currentQuestion.required && (
                    <span className="rounded bg-red-900/60 px-1.5 py-0.5 text-[10px] font-medium text-red-300">
                      Required
                    </span>
                  )}
                </div>

                <h3 className="text-sm font-medium text-slate-200 mb-1">
                  {currentQuestion.label}
                </h3>
                <p className="text-sm text-slate-400 mb-4">{currentQuestion.question}</p>

                {/* Answer input */}
                <textarea
                  value={answerInput}
                  onChange={(e) => setAnswerInput(e.target.value)}
                  placeholder="Your answer..."
                  rows={4}
                  className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none resize-none"
                />

                {/* Suggested answer */}
                {suggestedAnswer && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-2 rounded-md border border-purple-700/40 bg-purple-900/20 px-3 py-2"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Sparkles className="h-3 w-3 text-purple-400" />
                      <span className="text-xs font-medium text-purple-300">Suggested Answer</span>
                    </div>
                    <p className="text-xs text-slate-400">{suggestedAnswer}</p>
                  </motion.div>
                )}

                {/* Inference notice */}
                {currentAnswer?.source === 'inferred' && (
                  <div className="mt-2 flex items-center gap-2 rounded-md border border-blue-700/40 bg-blue-900/20 px-3 py-2">
                    <Lightbulb className="h-3.5 w-3.5 text-blue-400" />
                    <span className="text-xs text-blue-300">
                      System inferred: &quot;{currentAnswer.answer}&quot; with high confidence
                    </span>
                    <button
                      onClick={() => handleUseInference(currentQuestion.field)}
                      className="ml-auto rounded-md bg-blue-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-blue-500"
                    >
                      Use Inference
                    </button>
                  </div>
                )}

                {/* Action buttons */}
                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={handleSkip}
                    disabled={currentQuestion.required}
                    className="flex items-center gap-1 rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-600 disabled:opacity-30"
                  >
                    <SkipForward className="h-3.5 w-3.5" />
                    Skip
                  </button>
                  <button
                    onClick={handleSuggestAnswer}
                    className="flex items-center gap-1 rounded-md border border-purple-700 bg-purple-900/40 px-3 py-2 text-xs font-medium text-purple-300 transition-colors hover:bg-purple-900/60"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Suggest Answer
                  </button>
                  <button
                    onClick={handleContinue}
                    disabled={!answerInput.trim()}
                    className="ml-auto flex items-center gap-1 rounded-md bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
                  >
                    Continue
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-lg border border-emerald-700/40 bg-emerald-900/20 p-6 text-center"
              >
                <CheckCircle className="mx-auto h-10 w-10 text-emerald-400" />
                <h3 className="mt-3 text-lg font-semibold text-emerald-300">
                  All Questions Answered
                </h3>
                <p className="mt-1 text-sm text-slate-400">
                  Review the seed preview and confirm to proceed.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Progress */}
          <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
                <BarChart3 className="h-3.5 w-3.5" />
                Progress
              </span>
              <span className="text-xs text-slate-500">{Math.round(progressPercent)}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700">
              <motion.div
                className="h-full rounded-full bg-blue-500"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <div className="mt-2 flex gap-4 text-xs text-slate-400">
              <span>{answeredCount} answered</span>
              <span>{skippedCount} skipped</span>
              <span>{inferredCount} inferred</span>
            </div>
          </div>
        </div>

        {/* Seed preview panel */}
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-200 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-amber-400" />
              Synthesized Seed Preview
            </h3>
            {dialogue.synthesized_seed ? (
              <div className="space-y-3">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Project Name</span>
                  <p className="text-sm text-slate-300">
                    {dialogue.synthesized_seed.project_name || '—'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Problem Statement</span>
                  <p className="text-sm text-slate-300">
                    {dialogue.synthesized_seed.problem_statement || '—'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Target Customer</span>
                  <p className="text-sm text-slate-300">
                    {dialogue.synthesized_seed.target_customer?.segment || '—'}
                  </p>
                  {dialogue.synthesized_seed.target_customer?.pain_points && (
                    <ul className="mt-1 space-y-0.5">
                      {dialogue.synthesized_seed.target_customer.pain_points.map((p, i) => (
                        <li key={i} className="text-xs text-slate-500">- {p}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Answer more questions to build the seed preview.</p>
            )}

            <button
              onClick={handleConfirmSeed}
              disabled={!dialogue.synthesized_seed}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-md bg-emerald-600 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              Confirm &amp; Proceed
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
