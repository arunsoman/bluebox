// =============================================================================
// NewPipelinePage — Input entry page per UI architecture section 6.2
// Large text area for PRD/idea input
// Source selector: Chat | File Upload | API
// "Analyze Input" button -> calls pipelineApi.start({ user_id }) then
//   pipelineApi.submitInput(sessionId, { text, source })
// After classification, show RichnessClassificationPanel with mode badge,
//   confidence, basis list
// "Override" buttons to change mode
// "Proceed" button -> navigates to /pipeline/:sessionId
// =============================================================================

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Rocket, FileText, MessageSquare, Upload, Cloud, ArrowRight,
  Sparkles, Loader2, CheckCircle, AlertTriangle
} from 'lucide-react';
import { usePipelineStore } from '@/stores/pipelineStore';
import { useAuthStore } from '@/stores/authStore';
import { pipelineApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { RichnessMode, RichnessClassification } from '@/types/domain';

const sourceOptions = [
  { id: 'chat' as const, label: 'Chat', icon: <MessageSquare className="h-4 w-4" /> },
  { id: 'file_upload' as const, label: 'File Upload', icon: <Upload className="h-4 w-4" /> },
  { id: 'api' as const, label: 'API', icon: <Cloud className="h-4 w-4" /> },
];

const modeLabels: Record<RichnessMode, string> = {
  WELL_FORMED: 'Well-Formed PRD',
  MINIMALIST: 'Minimalist Input',
  SEED_ONLY: 'Seed Required',
};

const modeDescriptions: Record<RichnessMode, string> = {
  WELL_FORMED: 'Your input is detailed. We will run full PRD analysis.',
  MINIMALIST: 'Your input is brief. We will ask clarifying questions.',
  SEED_ONLY: 'Your input is minimal. We need key details to proceed.',
};

const modeColors: Record<RichnessMode, string> = {
  WELL_FORMED: 'bg-emerald-900/60 text-emerald-300 border-emerald-700',
  MINIMALIST: 'bg-amber-900/60 text-amber-300 border-amber-700',
  SEED_ONLY: 'bg-blue-900/60 text-blue-300 border-blue-700',
};

export default function NewPipelinePage() {
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.userId);
  const setSession = usePipelineStore((s) => s.setSession);
  const setRichnessMode = usePipelineStore((s) => s.setRichnessMode);

  const [inputText, setInputText] = useState('');
  const [source, setSource] = useState<'chat' | 'file_upload' | 'api'>('chat');
  const [analyzing, setAnalyzing] = useState(false);
  const [classification, setClassification] = useState<RichnessClassification | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = useCallback(async () => {
    if (!inputText.trim() || !userId) return;
    setAnalyzing(true);
    setError(null);

    try {
      // Step 1: Start pipeline session
      const session = await pipelineApi.start({ user_id: userId });
      setSessionId(session.session_id);

      // Sync store
      setSession({
        session_id: session.session_id,
        project_id: session.project_id,
        user_id: session.user_id,
        current_stage: session.current_stage,
        status: session.status,
        richness_mode: session.richness_mode,
      });

      // Step 2: Submit input
      const result = await pipelineApi.submitInput(session.session_id, {
        text: inputText,
        source,
      });

      setClassification(result);
      setRichnessMode(result.mode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze input');
    } finally {
      setAnalyzing(false);
    }
  }, [inputText, source, userId, setSession, setRichnessMode]);

  const handleOverride = useCallback(async (newMode: RichnessMode) => {
    if (!sessionId || !inputText.trim()) return;
    setAnalyzing(true);
    try {
      const result = await pipelineApi.submitInput(sessionId, {
        text: inputText,
        source,
        override_mode: newMode,
      } as { text: string; source: 'chat' | 'file_upload' | 'api'; override_mode?: RichnessMode });
      setClassification(result);
      setRichnessMode(result.mode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Override failed');
    } finally {
      setAnalyzing(false);
    }
  }, [sessionId, inputText, source, setRichnessMode]);

  const handleProceed = () => {
    if (sessionId) {
      navigate(`/pipeline/${sessionId}`);
    }
  };

  return (
    <div className="flex h-full flex-col items-center overflow-y-auto p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
        className="w-full max-w-3xl space-y-6"
      >
        {/* Header */}
        <div className="text-center">
          <Rocket className="mx-auto h-10 w-10 text-blue-400" />
          <h1 className="mt-4 text-2xl font-bold text-white">Start New Pipeline</h1>
          <p className="mt-2 text-sm text-slate-400">
            Enter your product idea, PRD, or concept and we&apos;ll analyze it.
          </p>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2 rounded-lg border border-red-700 bg-red-900/30 px-4 py-3 text-sm text-red-300">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step 1: Input */}
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-200">
            <FileText className="h-4 w-4 text-slate-400" />
            Step 1: Enter Your Input
          </h2>

          {/* Source selector */}
          <div className="mb-4 flex gap-2">
            {sourceOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSource(opt.id)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition-colors',
                  source === opt.id
                    ? 'border-blue-600 bg-blue-900/40 text-blue-300'
                    : 'border-slate-600 bg-slate-700 text-slate-400 hover:bg-slate-600'
                )}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>

          {/* Text area */}
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Paste your PRD, idea, or concept here...&#10;(Supports: .txt, .md, .pdf, .docx descriptions)"
            rows={10}
            className="w-full resize-none rounded-md border border-slate-600 bg-slate-900 px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
          />

          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {inputText.length.toLocaleString()} characters
            </span>
            <button
              onClick={handleAnalyze}
              disabled={!inputText.trim() || analyzing || !userId}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
            >
              {analyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Analyze Input
                </>
              )}
            </button>
          </div>

          {!userId && (
            <p className="mt-2 text-xs text-amber-400">
              Please select a user from the header dropdown first.
            </p>
          )}
        </div>

        {/* Step 2: Classification */}
        <AnimatePresence>
          {classification && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="rounded-lg border border-slate-700 bg-slate-800/50 p-5"
            >
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-200">
                <CheckCircle className="h-4 w-4 text-emerald-400" />
                Step 2: Classification Result
              </h2>

              <div className="space-y-4">
                {/* Mode badge + confidence */}
                <div className="flex flex-wrap items-center gap-3">
                  <span className={cn('rounded-md border px-3 py-1.5 text-sm font-semibold', modeColors[classification.mode])}>
                    {modeLabels[classification.mode]}
                  </span>
                  <span className={cn(
                    'rounded px-2 py-1 text-xs font-bold uppercase',
                    classification.confidence === 'high' ? 'bg-emerald-900/60 text-emerald-300'
                      : classification.confidence === 'medium' ? 'bg-amber-900/60 text-amber-300'
                        : 'bg-red-900/60 text-red-300'
                  )}>
                    Confidence: {classification.confidence}
                  </span>
                </div>

                <p className="text-sm text-slate-400">
                  {modeDescriptions[classification.mode]}
                </p>

                {/* Basis list */}
                {classification.classification_basis.length > 0 && (
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Basis
                    </span>
                    <ul className="mt-2 space-y-1.5">
                      {classification.classification_basis.map((basis, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                          {basis}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Override buttons */}
                <div className="flex flex-wrap gap-2 pt-2">
                  <span className="text-xs text-slate-500 self-center">Override:</span>
                  {(Object.keys(modeLabels) as RichnessMode[])
                    .filter((m) => m !== classification.mode)
                    .map((mode) => (
                      <button
                        key={mode}
                        onClick={() => handleOverride(mode)}
                        disabled={analyzing}
                        className={cn(
                          'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:opacity-90 disabled:opacity-50',
                          modeColors[mode]
                        )}
                      >
                        {modeLabels[mode]}
                      </button>
                    ))}
                </div>

                {/* Proceed */}
                <div className="flex justify-end pt-3">
                  <button
                    onClick={handleProceed}
                    className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
                  >
                    Proceed
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
