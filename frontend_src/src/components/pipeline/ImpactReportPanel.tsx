// =============================================================================
// ImpactReportPanel — Severity badge, summary, affected nodes, stages needing
// re-run, invalidated decisions, propagation controls. Per UI Architecture §6.9.
// =============================================================================

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { ImpactSeverity, ImpactType, StageName } from '@/types/domain';
import { useImpactStore } from '@/stores/impactStore';
import { usePipelineStore } from '@/stores/pipelineStore';
import { pipelineApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Zap, Clock, RotateCcw, AlertTriangle, XCircle, CheckCircle,
  ArrowRight, GitCommit, Layers
} from 'lucide-react';

const severityConfig: Record<ImpactSeverity, { color: string; icon: typeof AlertTriangle; label: string }> = {
  LOCAL: {
    color: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300',
    icon: CheckCircle,
    label: 'LOCAL',
  },
  CASCADING: {
    color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300',
    icon: AlertTriangle,
    label: 'CASCADING',
  },
  STRUCTURAL: {
    color: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300',
    icon: XCircle,
    label: 'STRUCTURAL',
  },
};

const impactTypeConfig: Record<ImpactType, { color: string; label: string }> = {
  modified: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300', label: 'modified' },
  deleted: { color: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300', label: 'deleted' },
  requires_rerun: { color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300', label: 'requires rerun' },
  potentially_affected: { color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300', label: 'potentially affected' },
};

function StageBadge({ stage }: { stage: StageName }) {
  return (
    <Badge variant="outline" className="text-xs capitalize">
      <Layers className="mr-1 h-3 w-3" />
      {stage.replace('_', ' ')}
    </Badge>
  );
}

export function ImpactReportPanel() {
  const sessionId = usePipelineStore((s) => s.sessionId);
  const report = useImpactStore((s) => s.currentReport);
  const clearReport = useImpactStore((s) => s.clearReport);

  const [isConfirming, setIsConfirming] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const handleConfirm = useCallback(async () => {
    if (!sessionId || !report) return;
    setIsConfirming(true);
    try {
      await pipelineApi.propagate(sessionId, {
        session_id: sessionId,
        impact_report_id: report.report_id,
        user_confirmed: true,
      });
    } finally {
      setIsConfirming(false);
    }
  }, [sessionId, report]);

  const handleCancel = useCallback(async () => {
    if (!sessionId || !report) return;
    setIsCancelling(true);
    try {
      await pipelineApi.propagate(sessionId, {
        session_id: sessionId,
        impact_report_id: report.report_id,
        user_confirmed: false,
      });
      clearReport();
    } finally {
      setIsCancelling(false);
    }
  }, [sessionId, report, clearReport]);

  if (!report) {
    return (
      <Card className="border-dashed border-slate-300 dark:border-slate-600">
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center text-sm text-slate-500 dark:text-slate-400">
            <Zap className="mx-auto mb-2 h-8 w-8 text-slate-300" />
            Waiting for impact report...
          </div>
        </CardContent>
      </Card>
    );
  }

  const severity = severityConfig[report.severity];
  const SeverityIcon = severity.icon;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
    >
      <Card className="border-2 border-slate-200 dark:border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <Zap className="h-5 w-5 text-amber-500" />
              Impact Report
            </CardTitle>
            <Badge className={`${severity.color} gap-1`}>
              <SeverityIcon className="h-3.5 w-3.5" />
              {severity.label}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Summary */}
          <div className="rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
            {report.plain_summary}
          </div>

          {/* Directly Affected Nodes */}
          {report.directly_affected_nodes.length > 0 && (
            <section>
              <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                <ArrowRight className="h-4 w-4 text-blue-500" />
                Directly Affected Nodes ({report.directly_affected_nodes.length})
              </h4>
              <div className="space-y-1.5">
                {report.directly_affected_nodes.map((node) => {
                  const impact = impactTypeConfig[node.impact_type];
                  return (
                    <motion.div
                      key={node.node_id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center justify-between rounded-md border border-slate-100 px-3 py-2 dark:border-slate-800"
                    >
                      <div className="flex items-center gap-2">
                        <GitCommit className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {node.node_label}
                        </span>
                        <span className="text-xs text-slate-400">({node.node_id})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <StageBadge stage={node.stage} />
                        <Badge className={`${impact.color} text-[10px]`}>{impact.label}</Badge>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Transitively Affected Nodes */}
          {report.transitively_affected_nodes.length > 0 && (
            <section>
              <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                <RotateCcw className="h-4 w-4 text-purple-500" />
                Transitively Affected Nodes ({report.transitively_affected_nodes.length})
              </h4>
              <div className="space-y-1.5">
                {report.transitively_affected_nodes.map((node) => {
                  const impact = impactTypeConfig[node.impact_type];
                  return (
                    <motion.div
                      key={node.node_id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center justify-between rounded-md border border-slate-100 px-3 py-2 dark:border-slate-800"
                    >
                      <div className="flex items-center gap-2">
                        <GitCommit className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          {node.node_label}
                        </span>
                        <span className="text-xs text-slate-400">({node.node_id})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <StageBadge stage={node.stage} />
                        <Badge className={`${impact.color} text-[10px]`}>{impact.label}</Badge>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Stages Needing Re-run */}
          {report.stages_needing_rerun.length > 0 && (
            <section>
              <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                <Layers className="h-4 w-4 text-orange-500" />
                Stages Needing Re-run
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {report.stages_needing_rerun.map((stage) => (
                  <StageBadge key={stage} stage={stage} />
                ))}
              </div>
            </section>
          )}

          {/* Invalidated Decisions */}
          {report.invalidated_decisions.length > 0 && (
            <section>
              <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                <XCircle className="h-4 w-4 text-red-500" />
                Invalidated Decisions ({report.invalidated_decisions.length})
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {report.invalidated_decisions.map((decId) => (
                  <Badge key={decId} variant="outline" className="text-xs text-red-500">
                    {decId}
                  </Badge>
                ))}
              </div>
            </section>
          )}

          {/* Estimated Re-run Time */}
          {report.estimated_rerun_time_seconds !== null && (
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <Clock className="h-4 w-4 text-slate-400" />
              Estimated re-run time:{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {report.estimated_rerun_time_seconds < 60
                  ? `${report.estimated_rerun_time_seconds}s`
                  : `${Math.ceil(report.estimated_rerun_time_seconds / 60)} min`}
              </span>
            </div>
          )}

          <Separator />

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isCancelling || isConfirming}
              className="min-w-[120px]"
            >
              {isCancelling && (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  className="mr-2 h-4 w-4 border-2 border-slate-400 border-t-transparent rounded-full"
                />
              )}
              Cancel & Keep Original
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={isConfirming || isCancelling}
              className="min-w-[140px]"
            >
              {isConfirming && (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  className="mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"
                />
              )}
              Confirm Propagation
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default ImpactReportPanel;
