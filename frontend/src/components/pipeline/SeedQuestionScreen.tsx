// =============================================================================
// SeedQuestionScreen — Simple seed question form for SEED_ONLY mode
// Input fields for: project name, problem statement, target customer
// Generate button
// Preview of generated seed
// =============================================================================

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sprout, Send, CheckCircle, Loader2 } from 'lucide-react';
import { useSteeringStore } from '@/stores/steeringStore';
import { usePipelineStore } from '@/stores/pipelineStore';
import { pipelineApi } from '@/lib/api';

export default function SeedQuestionScreen() {
  const sessionId = usePipelineStore((s) => s.sessionId);
  const currentStage = usePipelineStore((s) => s.currentStage);

  const [projectName, setProjectName] = useState('');
  const [problemStatement, setProblemStatement] = useState('');
  const [targetCustomer, setTargetCustomer] = useState('');
  const [generating, setGenerating] = useState(false);

  const seedPreview = useSteeringStore((s) => s.minimalistDialogue?.synthesized_seed);

  const handleGenerate = async () => {
    if (!sessionId) return;
    setGenerating(true);
    try {
      await pipelineApi.steer(sessionId, {
        session_id: sessionId,
        action_type: 'CONFIRM_SEED',
        stage: currentStage ?? 'prd_analysis',
        payload: {
          project_name: projectName,
          problem_statement: problemStatement,
          target_customer: { segment: targetCustomer, pain_points: [] },
        },
        timestamp: new Date().toISOString(),
      });
    } finally {
      setGenerating(false);
    }
  };

  const canSubmit = projectName.trim() && problemStatement.trim() && targetCustomer.trim();

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
        className="w-full space-y-6"
      >
        <div className="text-center">
          <Sprout className="mx-auto h-10 w-10 text-emerald-400" />
          <h2 className="mt-4 text-xl font-bold text-white">Create Your Project Seed</h2>
          <p className="mt-2 text-sm text-slate-400">
            Provide the basics and we&apos;ll generate a structured starting point.
          </p>
        </div>

        <div className="space-y-4 rounded-lg border border-slate-700 bg-slate-800/50 p-6">
          {/* Project Name */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Project Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g., E-commerce Platform"
              className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Problem Statement */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Problem Statement <span className="text-red-400">*</span>
            </label>
            <textarea
              value={problemStatement}
              onChange={(e) => setProblemStatement(e.target.value)}
              placeholder="What problem are you solving?"
              rows={4}
              className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none resize-none"
            />
          </div>

          {/* Target Customer */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Target Customer <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={targetCustomer}
              onChange={(e) => setTargetCustomer(e.target.value)}
              placeholder="e.g., Small business owners in North America"
              className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={!canSubmit || generating}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Generate Seed
              </>
            )}
          </button>
        </div>

        {/* Preview */}
        {seedPreview && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-emerald-700/40 bg-emerald-900/20 p-5"
          >
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-emerald-300">
              <CheckCircle className="h-4 w-4" />
              Generated Seed Preview
            </h3>
            <div className="mt-3 space-y-2">
              <p className="text-sm text-slate-300">
                <span className="font-medium text-slate-400">Name:</span> {seedPreview.project_name}
              </p>
              <p className="text-sm text-slate-300">
                <span className="font-medium text-slate-400">Problem:</span> {seedPreview.problem_statement}
              </p>
              <p className="text-sm text-slate-300">
                <span className="font-medium text-slate-400">Target:</span>{' '}
                {seedPreview.target_customer?.segment}
              </p>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
