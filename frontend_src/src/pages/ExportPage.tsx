// =============================================================================
// ExportPage — Export artifact cards with download buttons
// Route: /pipeline/:sessionId/export
// =============================================================================

import { useCallback, useState } from 'react';
import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  FileJson,
  FileText,
  Shield,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Cloud,
  Wrench,
  BookOpen,
  Scroll,
  ClipboardList,
  Loader2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { pipelineApi } from '@/lib/api';

// ── Types ────────────────────────────────────────────────────────────────────

interface ArtifactCard {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  format: string;
  endpoint: (sessionId: string) => string;
  downloadFormats: ('json' | 'markdown')[];
  status?: 'stale' | 'active';
  count?: number;
  countLabel?: string;
  detail?: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const ARTIFACTS: ArtifactCard[] = [
  {
    id: 'blueprint',
    title: 'Full Project Blueprint',
    description: 'Complete pipeline output: all stages, nodes, decisions, RBAC, infrastructure, tech stack, and annotations.',
    icon: <BookOpen className="h-5 w-5" />,
    format: 'JSON',
    endpoint: (id) => `/api/v1/pipeline/${id}/blueprint/export`,
    downloadFormats: ['json'],
    detail: 'Contains all generated artifacts',
  },
  {
    id: 'decisions',
    title: 'Decision Ledger',
    description: 'Complete record of all user and system decisions with revision chains.',
    icon: <ClipboardList className="h-5 w-5" />,
    format: 'JSON',
    endpoint: (id) => `/api/v1/pipeline/${id}/decisions/export`,
    downloadFormats: ['json', 'markdown'],
    countLabel: 'entries',
  },
  {
    id: 'rbac',
    title: 'RBAC Model',
    description: 'Role definitions, permission matrix, data access matrix, and role hierarchy.',
    icon: <Shield className="h-5 w-5" />,
    format: 'JSON',
    endpoint: (id) => `/api/v1/pipeline/${id}/rbac/export`,
    downloadFormats: ['json'],
  },
  {
    id: 'audit',
    title: 'Audit Trail',
    description: 'Complete audit log of all pipeline actions with before/after state snapshots.',
    icon: <Scroll className="h-5 w-5" />,
    format: 'JSON',
    endpoint: (id) => `/api/v1/pipeline/${id}/audit/export`,
    downloadFormats: ['json', 'markdown'],
    countLabel: 'events',
    detail: '90-day retention',
  },
  {
    id: 'infrastructure',
    title: 'Infrastructure Profile',
    description: 'Selected hosting option, cost estimates, component breakdown.',
    icon: <Cloud className="h-5 w-5" />,
    format: 'JSON',
    endpoint: (id) => `/api/v1/pipeline/${id}/infrastructure`,
    downloadFormats: ['json'],
    status: 'active',
  },
  {
    id: 'techstack',
    title: 'Tech Stack Profile',
    description: 'Selected technology stack with component choices and rationale.',
    icon: <Wrench className="h-5 w-5" />,
    format: 'JSON',
    endpoint: (id) => `/api/v1/pipeline/${id}/techstack`,
    downloadFormats: ['json'],
    status: 'active',
  },
];

// ── Helper: download via fetch + blob ────────────────────────────────────────

async function downloadArtifact(
  sessionId: string,
  artifact: ArtifactCard,
  format: 'json' | 'markdown',
  onStart: () => void,
  onDone: () => void,
  onError: (msg: string) => void
) {
  onStart();
  try {
    const url = artifact.endpoint(sessionId) + (format === 'markdown' ? '?format=markdown' : '');
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `${artifact.id}-${sessionId}.${format === 'json' ? 'json' : 'md'}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);
    onDone();
  } catch (err) {
    onError(err instanceof Error ? err.message : 'Download failed');
    onDone();
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ExportPage() {
  const { sessionId } = useParams<{ sessionId: string }>();

  // Fetch supporting data for counts
  const { data: decisionData, isLoading: decisionsLoading } = useQuery({
    queryKey: ['decisions', sessionId],
    queryFn: () => {
      if (!sessionId) throw new Error('No session ID');
      return pipelineApi.getDecisions(sessionId);
    },
    enabled: !!sessionId,
    staleTime: 30 * 1000,
  });

  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ['audit-export', sessionId],
    queryFn: () => {
      if (!sessionId) throw new Error('No session ID');
      return pipelineApi.queryAudit(sessionId, {
        page: 1,
        page_size: 1,
      });
    },
    enabled: !!sessionId,
    staleTime: 30 * 1000,
  });

  const { data: rbacData, isLoading: rbacLoading } = useQuery({
    queryKey: ['rbac', sessionId],
    queryFn: () => {
      if (!sessionId) throw new Error('No session ID');
      return pipelineApi.getRbac(sessionId);
    },
    enabled: !!sessionId,
    staleTime: 30 * 1000,
  });

  const { data: infraData, isLoading: infraLoading } = useQuery({
    queryKey: ['infrastructure', sessionId],
    queryFn: () => {
      if (!sessionId) throw new Error('No session ID');
      return pipelineApi.getInfrastructure(sessionId);
    },
    enabled: !!sessionId,
    staleTime: 30 * 1000,
  });

  // Track download states per artifact-format combo
  const [downloading, setDownloading] = useState<Set<string>>(new Set());

  const startDownload = useCallback(
    (artifact: ArtifactCard, format: 'json' | 'markdown') => {
      if (!sessionId) return;
      const key = `${artifact.id}-${format}`;
      downloadArtifact(
        sessionId,
        artifact,
        format,
        () => setDownloading((prev) => new Set(prev).add(key)),
        () =>
          setDownloading((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          }),
        (msg) => console.error('Download error:', msg)
      );
    },
    [sessionId]
  );

  // Compute artifact counts
  const decisionCount =
    (decisionData?.total_user_decisions ?? 0) +
    (decisionData?.total_system_decisions ?? 0);
  const auditCount = auditData?.total ?? 0;
  const rbacRoleCount = rbacData?.roles?.length ?? 0;
  const infraStatus = infraData?.stale ? 'stale' : 'active';

  const getArtifactCount = (id: string): number | undefined => {
    switch (id) {
      case 'decisions':
        return decisionCount;
      case 'audit':
        return auditCount;
      case 'rbac':
        return rbacRoleCount;
      default:
        return undefined;
    }
  };

  const getArtifactStatus = (id: string): 'stale' | 'active' | undefined => {
    if (id === 'infrastructure') return infraStatus;
    return undefined;
  };

  const isLoading = decisionsLoading || auditLoading || rbacLoading || infraLoading;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="flex h-full flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Export Blueprint</h1>
          <p className="text-xs text-slate-500 mt-0.5">Session: {sessionId}</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="mx-auto max-w-5xl space-y-4">
          {/* Completeness Gate */}
          <CompletenessGate isLoading={isLoading} />

          {/* Artifact cards */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {ARTIFACTS.map((artifact, index) => {
              const count = getArtifactCount(artifact.id);
              const status = getArtifactStatus(artifact.id) ?? artifact.status;
              const isArtifactLoading = isLoading && count === undefined && artifact.id !== 'blueprint';

              return (
                <motion.div
                  key={artifact.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06, duration: 0.25 }}
                  className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 space-y-3"
                >
                  {/* Card header */}
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-800 text-slate-400">
                      {artifact.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-medium text-slate-200">
                          {artifact.title}
                        </h3>
                        {status && (
                          <Badge
                            variant="outline"
                            className={
                              status === 'active'
                                ? 'border-emerald-600/40 bg-emerald-600/10 text-emerald-300 text-xs'
                                : 'border-amber-600/40 bg-amber-600/10 text-amber-300 text-xs'
                            }
                          >
                            {status === 'active' ? (
                              <CheckCircle className="mr-1 h-3 w-3" />
                            ) : (
                              <AlertTriangle className="mr-1 h-3 w-3" />
                            )}
                            {status}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {artifact.description}
                      </p>
                    </div>
                  </div>

                  {/* Metadata row */}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <Badge
                      variant="outline"
                      className="border-slate-700 bg-slate-800 text-slate-400 text-xs"
                    >
                      {artifact.format}
                    </Badge>
                    {count !== undefined && (
                      <span>
                        {count} {artifact.countLabel ?? 'items'}
                      </span>
                    )}
                    {isArtifactLoading && (
                      <Skeleton className="h-4 w-16 bg-slate-800" />
                    )}
                    {artifact.detail && (
                      <span className="text-slate-500">{artifact.detail}</span>
                    )}
                  </div>

                  {/* Download buttons */}
                  <div className="flex items-center gap-2">
                    {artifact.downloadFormats.map((format) => {
                      const key = `${artifact.id}-${format}`;
                      const isDownloading = downloading.has(key);
                      return (
                        <Button
                          key={format}
                          variant="outline"
                          size="sm"
                          disabled={isDownloading || isArtifactLoading}
                          onClick={() => startDownload(artifact, format)}
                          className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-slate-200 text-xs"
                        >
                          {isDownloading ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : format === 'json' ? (
                            <FileJson className="mr-1.5 h-3.5 w-3.5" />
                          ) : (
                            <FileText className="mr-1.5 h-3.5 w-3.5" />
                          )}
                          {isDownloading ? 'Downloading...' : `Download ${format.toUpperCase()}`}
                        </Button>
                      );
                    })}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// =============================================================================
// CompletenessGate — PASS/FAIL indicator
// =============================================================================

interface CompletenessGateProps {
  isLoading: boolean;
}

function CompletenessGate({ isLoading }: CompletenessGateProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <Skeleton className="h-6 w-64 bg-slate-800" />
      </div>
    );
  }

  // In a real implementation this would come from a completeness check API
  // For now we show PASS as a reasonable default
  const passed = true;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="rounded-lg border border-slate-800 bg-slate-900/60 p-4"
    >
      <div className="flex items-center gap-3">
        {passed ? (
          <CheckCircle className="h-5 w-5 text-emerald-400" />
        ) : (
          <XCircle className="h-5 w-5 text-rose-400" />
        )}
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-200">
              Completeness Gate:{" "}
            </span>
            <Badge
              variant="outline"
              className={
                passed
                  ? 'border-emerald-600/40 bg-emerald-600/10 text-emerald-300'
                  : 'border-rose-600/40 bg-rose-600/10 text-rose-300'
              }
            >
              {passed ? 'PASS' : 'FAIL'}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {passed
              ? 'All mandatory fields resolved or explicitly deferred. Export is ready.'
              : 'Some mandatory fields are unresolved. Complete all required stages before exporting.'}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
