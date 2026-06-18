// =============================================================================
// LLMFailurePanel — Shows failure reason and resolution options.
// Options: Retry Same, Retry with User Modifications, Skip with Consent,
// Restore Checkpoint.
// =============================================================================

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSteeringStore } from '@/stores/steeringStore';
import { usePipelineStore } from '@/stores/pipelineStore';
import { pipelineApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertTriangle, RotateCcw, Edit3, SkipForward, History, ChevronDown, ChevronUp
} from 'lucide-react';

type FailureAction = 'retry_same' | 'retry_modify' | 'skip_consent' | 'restore_checkpoint';

export function LLMFailurePanel() {
  const sessionId = usePipelineStore((s) => s.sessionId);
  const llmFailure = useSteeringStore((s) => s.llmFailure);
  const setLlmFailure = useSteeringStore((s) => s.setLlmFailure);

  const [isExpanded, setIsExpanded] = useState(true);
  const [activeAction, setActiveAction] = useState<FailureAction | null>(null);

  const handleAction = useCallback(
    async (action: FailureAction) => {
      if (!sessionId) return;
      setActiveAction(action);

      try {
        switch (action) {
          case 'retry_same':
            await pipelineApi.steer(sessionId, {
              session_id: sessionId,
              action_type: 'RETRY_SAME',
              stage: '',
              payload: {},
              timestamp: new Date().toISOString(),
            });
            break;
          case 'retry_modify':
            await pipelineApi.steer(sessionId, {
              session_id: sessionId,
              action_type: 'RETRY_MODIFY',
              stage: '',
              payload: {},
              timestamp: new Date().toISOString(),
            });
            break;
          case 'skip_consent':
            await pipelineApi.steer(sessionId, {
              session_id: sessionId,
              action_type: 'SKIP_CONSENT',
              stage: '',
              payload: {},
              timestamp: new Date().toISOString(),
            });
            break;
          case 'restore_checkpoint':
            // Handled by CheckpointRestorePanel
            break;
        }
        setLlmFailure(null);
      } catch {
        // Error remains visible
      } finally {
        setActiveAction(null);
      }
    },
    [sessionId, setLlmFailure]
  );

  if (!llmFailure) {
    return null;
  }

  const resolutionOptions = llmFailure.resolution_options ?? [
    'Retry Same',
    'Retry with User Modifications',
    'Skip with Consent',
    'Restore Checkpoint',
  ];

  const optionConfig: Array<{
    key: FailureAction;
    label: string;
    description: string;
    icon: typeof RotateCcw;
    variant: 'default' | 'outline' | 'secondary' | 'ghost';
  }> = [
    {
      key: 'retry_same',
      label: 'Retry Same',
      description: 'Attempt the same LLM call again',
      icon: RotateCcw,
      variant: 'default',
    },
    {
      key: 'retry_modify',
      label: 'Retry with Modifications',
      description: 'Modify parameters and retry',
      icon: Edit3,
      variant: 'outline',
    },
    {
      key: 'skip_consent',
      label: 'Skip with Consent',
      description: 'Skip this step and continue',
      icon: SkipForward,
      variant: 'secondary',
    },
    {
      key: 'restore_checkpoint',
      label: 'Restore Checkpoint',
      description: 'Rollback to a previous checkpoint',
      icon: History,
      variant: 'ghost',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
      className="mb-4"
    >
      <Card className="border-red-200 dark:border-red-800">
        <CardHeader>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex w-full items-center justify-between text-left"
          >
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-red-700 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
              LLM Failure
            </CardTitle>
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-slate-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-slate-400" />
            )}
          </button>
        </CardHeader>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
            >
              <CardContent className="space-y-4">
                <Alert variant="destructive" className="bg-red-50 dark:bg-red-900/20">
                  <AlertDescription className="text-sm">
                    {llmFailure.failure_reason}
                  </AlertDescription>
                </Alert>

                {resolutionOptions.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Resolution Options
                    </h4>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {optionConfig
                        .filter((opt) => resolutionOptions.some((ro) => ro.toLowerCase().includes(opt.key.replace('_', ' '))))
                        .map((opt) => {
                          const Icon = opt.icon;
                          const isActive = activeAction === opt.key;
                          return (
                            <motion.div
                              key={opt.key}
                              whileHover={{ scale: 1.01 }}
                              whileTap={{ scale: 0.99 }}
                            >
                              <Button
                                variant={opt.variant}
                                className="h-auto w-full justify-start py-3"
                                onClick={() => handleAction(opt.key)}
                                disabled={activeAction !== null}
                              >
                                {isActive ? (
                                  <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                                    className="mr-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full"
                                  />
                                ) : (
                                  <Icon className="mr-2 h-4 w-4 shrink-0" />
                                )}
                                <div className="text-left">
                                  <div className="text-sm font-medium">{opt.label}</div>
                                  <div className="text-[10px] opacity-70">{opt.description}</div>
                                </div>
                              </Button>
                            </motion.div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

export default LLMFailurePanel;
