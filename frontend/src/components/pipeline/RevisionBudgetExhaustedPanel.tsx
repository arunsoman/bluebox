// =============================================================================
// RevisionBudgetExhaustedPanel — Shows which decision point exhausted its
// budget with exhaustion actions: Escalate Dialogue, Accept Best, Mark Pending.
// =============================================================================

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { RevisionBudget, ExhaustionAction } from '@/types/domain';
import { useDecisionStore } from '@/stores/decisionStore';
import { usePipelineStore } from '@/stores/pipelineStore';
import { pipelineApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle, Clock, MessageSquare, ChevronDown, ChevronUp, AlertTriangle
} from 'lucide-react';

function BudgetCard({
  budget,
  onAction,
  isProcessing,
}: {
  budget: RevisionBudget;
  onAction: (budgetId: string, action: ExhaustionAction) => void;
  isProcessing: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const percentUsed = Math.min(100, Math.round((budget.current_count / budget.max_revisions) * 100));

  const actions: Array<{
    key: ExhaustionAction;
    label: string;
    description: string;
    icon: typeof MessageSquare;
  }> = [
    {
      key: 'escalate_dialogue',
      label: 'Escalate Dialogue',
      description: 'Bring the decision to the user for manual resolution',
      icon: MessageSquare,
    },
    {
      key: 'accept_best',
      label: 'Accept Best',
      description: 'Automatically select the best option so far',
      icon: CheckCircle,
    },
    {
      key: 'mark_pending',
      label: 'Mark Pending',
      description: 'Defer the decision to a later stage',
      icon: Clock,
    },
  ];

  return (
    <Card className="border-amber-200 dark:border-amber-800">
      <CardHeader>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex w-full items-center justify-between text-left"
        >
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-5 w-5" />
            Budget Exhausted: {budget.decision_point}
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
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>
                    {budget.current_count} / {budget.max_revisions} revisions used
                  </span>
                  <Badge variant="destructive" className="text-[10px]">
                    EXHAUSTED
                  </Badge>
                </div>
                <Progress value={percentUsed} className="h-2" />
              </div>

              <Separator />

              <div>
                <h4 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Choose an action
                </h4>
                <div className="space-y-2">
                  {actions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <motion.div key={action.key} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                        <Button
                          variant="outline"
                          className="h-auto w-full justify-start py-3"
                          onClick={() => onAction(budget.budget_id, action.key)}
                          disabled={isProcessing}
                        >
                          <Icon className="mr-2 h-4 w-4 shrink-0" />
                          <div className="text-left">
                            <div className="text-sm font-medium">{action.label}</div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              {action.description}
                            </div>
                          </div>
                        </Button>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

export function RevisionBudgetExhaustedPanel() {
  const sessionId = usePipelineStore((s) => s.sessionId);
  const budgets = useDecisionStore((s) => s.budgets);
  const markBudgetExhausted = useDecisionStore((s) => s.markBudgetExhausted);

  const [processingId, setProcessingId] = useState<string | null>(null);

  const exhaustedBudgets = budgets.filter((b) => b.status === 'exhausted');

  const handleAction = useCallback(
    async (budgetId: string, action: ExhaustionAction) => {
      if (!sessionId) return;
      setProcessingId(budgetId);
      try {
        await pipelineApi.steer(sessionId, {
          session_id: sessionId,
          action_type: 'BUDGET_EXHAUSTION_ACTION',
          stage: '',
          payload: { budget_id: budgetId, action },
          timestamp: new Date().toISOString(),
        });
        markBudgetExhausted(budgetId);
      } finally {
        setProcessingId(null);
      }
    },
    [sessionId, markBudgetExhausted]
  );

  if (exhaustedBudgets.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
      className="space-y-3"
    >
      {exhaustedBudgets.map((budget) => (
        <BudgetCard
          key={budget.budget_id}
          budget={budget}
          onAction={handleAction}
          isProcessing={processingId === budget.budget_id}
        />
      ))}
    </motion.div>
  );
}

export default RevisionBudgetExhaustedPanel;
