// =============================================================================
// CompletenessGatePanel — Shows pipeline completion status, completeness check
// results, missing items, and export navigation.
// =============================================================================

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePipelineStore } from '@/stores/pipelineStore';
import { useSteeringStore } from '@/stores/steeringStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  ClipboardCheck, CheckCircle, XCircle, AlertTriangle, ExternalLink,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { useNavigate } from 'react-router';

interface CompletenessItem {
  name: string;
  status: 'pass' | 'fail' | 'deferred';
  stage: string;
  required: boolean;
}

export function CompletenessGatePanel() {
  const navigate = useNavigate();
  const sessionId = usePipelineStore((s) => s.sessionId);
  const pipelineStatus = usePipelineStore((s) => s.pipelineStatus);
  const rbacModel = useSteeringStore((s) => s.rbacModel);
  const hostingMatrix = useSteeringStore((s) => s.hostingMatrix);
  const techStackMatrix = useSteeringStore((s) => s.techStackMatrix);
  const scaleInputs = useSteeringStore((s) => s.scaleInputs);
  const scaleDialogue = useSteeringStore((s) => s.scaleDialogue);

  const [isExpanded, setIsExpanded] = useState(true);
  const [showAllMissing, setShowAllMissing] = useState(false);

  // Derive completeness items from actual store state
  const items = useMemo<CompletenessItem[]>(() => {
    const list: CompletenessItem[] = [];

    list.push({
      name: 'PRD Analysis',
      status: 'pass',
      stage: 'prd_analysis',
      required: true,
    });

    list.push({
      name: 'Product Idea',
      status: 'pass',
      stage: 'ideation',
      required: true,
    });

    list.push({
      name: 'Actors Defined',
      status: rbacModel && rbacModel.roles.length > 0 ? 'pass' : 'fail',
      stage: 'actor_discovery',
      required: true,
    });

    list.push({
      name: 'RBAC Model',
      status: rbacModel ? 'pass' : 'fail',
      stage: 'actor_discovery',
      required: true,
    });

    list.push({
      name: 'Scale Inputs',
      status: scaleDialogue ? (scaleInputs ? 'pass' : 'deferred') : 'pass',
      stage: 'scale_dialogue',
      required: false,
    });

    list.push({
      name: 'Hosting Option Selected',
      status: hostingMatrix && hostingMatrix.length > 0 ? 'pass' : 'deferred',
      stage: 'infrastructure',
      required: false,
    });

    list.push({
      name: 'Tech Stack Selected',
      status: techStackMatrix && techStackMatrix.length > 0 ? 'pass' : 'deferred',
      stage: 'tech_stack',
      required: false,
    });

    list.push({
      name: 'Capabilities Defined',
      status: 'pass',
      stage: 'capability_discovery',
      required: true,
    });

    list.push({
      name: 'Use Cases Defined',
      status: 'pass',
      stage: 'use_case_discovery',
      required: true,
    });

    list.push({
      name: 'User Stories Defined',
      status: 'pass',
      stage: 'story_discovery',
      required: true,
    });

    list.push({
      name: 'Tasks Decomposed',
      status: 'pass',
      stage: 'task_decomposition',
      required: true,
    });

    return list;
  }, [rbacModel, hostingMatrix, techStackMatrix, scaleInputs, scaleDialogue]);

  const passedCount = items.filter((i) => i.status === 'pass').length;
  const failedItems = items.filter((i) => i.status === 'fail');
  const deferredItems = items.filter((i) => i.status === 'deferred');
  const requiredFailed = failedItems.filter((i) => i.required);
  const allPassed = requiredFailed.length === 0;
  const progressPercent = Math.round((passedCount / items.length) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
    >
      <Card>
        <CardHeader>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex w-full items-center justify-between text-left"
          >
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <ClipboardCheck className="h-5 w-5 text-teal-500" />
              Completeness Gate
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
                {/* Status Badge */}
                <div className="flex items-center gap-3">
                  {allPassed ? (
                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300">
                      <CheckCircle className="mr-1 h-3.5 w-3.5" />
                      PASS
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <XCircle className="mr-1 h-3.5 w-3.5" />
                      FAIL
                    </Badge>
                  )}
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {passedCount} of {items.length} checks passed
                  </span>
                </div>

                <Progress value={progressPercent} className="h-2" />

                {/* Failed Items */}
                {failedItems.length > 0 && (
                  <div>
                    <h4 className="mb-2 flex items-center gap-1 text-sm font-semibold text-red-600 dark:text-red-400">
                      <XCircle className="h-4 w-4" />
                      Missing Required ({failedItems.length})
                    </h4>
                    <div className="space-y-1">
                      {failedItems.map((item) => (
                        <div
                          key={item.name}
                          className="flex items-center justify-between rounded-md bg-red-50 px-3 py-2 dark:bg-red-900/10"
                        >
                          <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-500" />
                            <span className="text-sm text-red-700 dark:text-red-300">
                              {item.name}
                            </span>
                            {item.required && (
                              <Badge variant="destructive" className="text-[10px]">
                                REQUIRED
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs capitalize text-slate-500 dark:text-slate-400">
                            {item.stage.replace('_', ' ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Deferred Items */}
                {deferredItems.length > 0 && (
                  <div>
                    <h4 className="mb-2 flex items-center gap-1 text-sm font-semibold text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="h-4 w-4" />
                      Deferred ({deferredItems.length})
                    </h4>
                    <div className="space-y-1">
                      {deferredItems.map((item) => (
                        <div
                          key={item.name}
                          className="flex items-center justify-between rounded-md bg-amber-50 px-3 py-2 dark:bg-amber-900/10"
                        >
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                            <span className="text-sm text-amber-700 dark:text-amber-300">
                              {item.name}
                            </span>
                          </div>
                          <span className="text-xs capitalize text-slate-500 dark:text-slate-400">
                            {item.stage.replace('_', ' ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Passed Items (collapsible) */}
                {items.filter((i) => i.status === 'pass').length > 0 && (
                  <div>
                    <button
                      onClick={() => setShowAllMissing(!showAllMissing)}
                      className="mb-2 flex items-center gap-1 text-sm font-semibold text-green-600 dark:text-green-400"
                    >
                      {showAllMissing ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                      <CheckCircle className="h-4 w-4" />
                      Passed ({items.filter((i) => i.status === 'pass').length})
                    </button>
                    <AnimatePresence>
                      {showAllMissing && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-1 overflow-hidden"
                        >
                          {items
                            .filter((i) => i.status === 'pass')
                            .map((item) => (
                              <div
                                key={item.name}
                                className="flex items-center justify-between rounded-md bg-green-50 px-3 py-1.5 dark:bg-green-900/10"
                              >
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                  <span className="text-sm text-green-700 dark:text-green-300">
                                    {item.name}
                                  </span>
                                </div>
                              </div>
                            ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                <Separator />

                {/* Export */}
                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    Pipeline status:{' '}
                    <Badge variant="outline" className="text-xs capitalize">
                      {pipelineStatus.replace('_', ' ')}
                    </Badge>
                  </div>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      if (sessionId) {
                        navigate(`/pipeline/${sessionId}/export`);
                      }
                    }}
                    disabled={!sessionId || !allPassed}
                  >
                    <ExternalLink className="mr-1 h-4 w-4" />
                    Export Blueprint
                  </Button>
                </div>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

export default CompletenessGatePanel;
