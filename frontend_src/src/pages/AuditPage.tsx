// =============================================================================
// AuditPage — Full audit trail view with filters, storage info, export
// Route: /pipeline/:sessionId/audit
// =============================================================================

import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Download, FileJson, FileText, HardDrive, AlertTriangle, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { pipelineApi } from '@/lib/api';
import { useAuditStore } from '@/stores/auditStore';
import AuditFilters from '@/components/audit/AuditFilters';
import AuditEventList from '@/components/audit/AuditEventList';
import type { AuditFilterValues } from '@/components/audit/AuditFilters';
import type { AuditQueryDTO } from '@/types/api';

const PAGE_SIZE = 20;

export default function AuditPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const storeFilters = useAuditStore((s) => s.filters);
  const storageStrategy = useAuditStore((s) => s.storageStrategy);
  const storageUsedPercent = useAuditStore((s) => s.storageUsedPercent);

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<AuditFilterValues>({
    actionType: storeFilters.actionType,
    actorId: storeFilters.actorId,
    dateFrom: storeFilters.dateRange?.[0] ?? null,
    dateTo: storeFilters.dateRange?.[1] ?? null,
  });

  const buildQuery = useCallback((): AuditQueryDTO => {
    return {
      action_type: filters.actionType ?? undefined,
      actor_id: filters.actorId ?? undefined,
      date_from: filters.dateFrom ?? undefined,
      date_to: filters.dateTo ?? undefined,
      page,
      page_size: PAGE_SIZE,
    };
  }, [filters, page]);

  const {
    data: auditData,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ['audit', sessionId, page, filters],
    queryFn: () => {
      if (!sessionId) throw new Error('No session ID');
      return pipelineApi.queryAudit(sessionId, buildQuery());
    },
    enabled: !!sessionId,
    staleTime: 15 * 1000,
  });

  // Sync store filters
  useEffect(() => {
    useAuditStore.getState().setFilters({
      actionType: filters.actionType,
      actorId: filters.actorId,
      dateRange: filters.dateFrom && filters.dateTo ? [filters.dateFrom, filters.dateTo] : null,
    });
  }, [filters]);

  // Sync storage info from API response into store
  useEffect(() => {
    if (auditData) {
      useAuditStore.getState().setStorageStrategy(auditData.storage_strategy);
      useAuditStore.getState().setStorageUsedPercent(auditData.storage_used_percent);
    }
  }, [auditData]);

  const handleApplyFilters = useCallback((newFilters: AuditFilterValues) => {
    setFilters(newFilters);
    setPage(1);
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({ actionType: null, actorId: null, dateFrom: null, dateTo: null });
    setPage(1);
  }, []);

  const handleExport = useCallback(
    async (format: 'json' | 'markdown') => {
      if (!sessionId) return;
      try {
        const response = await fetch(
          `/api/v1/pipeline/${sessionId}/audit/export?format=${format}`,
          {
            headers: {
              'X-User-Id': useAuditStore.getState().filters.actorId ?? '',
            },
          }
        );
        if (!response.ok) throw new Error('Export failed');
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-${sessionId}.${format === 'json' ? 'json' : 'md'}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } catch (err) {
        console.error('Export failed:', err);
      }
    },
    [sessionId]
  );

  if (!sessionId) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        No session selected
      </div>
    );
  }

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
          <h1 className="text-lg font-semibold text-slate-100">Audit Trail</h1>
          <p className="text-xs text-slate-500 mt-0.5">Session: {sessionId}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => handleExport('json')}
            variant="outline"
            size="sm"
            className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-slate-200"
          >
            <FileJson className="mr-1.5 h-3.5 w-3.5" />
            Export JSON
          </Button>
          <Button
            onClick={() => handleExport('markdown')}
            variant="outline"
            size="sm"
            className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-slate-200"
          >
            <FileText className="mr-1.5 h-3.5 w-3.5" />
            Export MD
          </Button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="mx-auto max-w-5xl space-y-4">
          {/* Filters */}
          <AuditFilters
            initialValues={{
              actionType: filters.actionType,
              actorId: filters.actorId,
              dateFrom: filters.dateFrom,
              dateTo: filters.dateTo,
            }}
            onApply={handleApplyFilters}
            onClear={handleClearFilters}
            disabled={isLoading}
          />

          {/* Storage info */}
          <StorageInfoBar
            usedPercent={storageUsedPercent || auditData?.storage_used_percent || 0}
            strategy={storageStrategy || auditData?.storage_strategy || 'diff'}
            isLoading={isLoading}
          />

          {/* Fetching indicator */}
          {isFetching && !isLoading && (
            <div className="flex items-center gap-2 text-xs text-blue-400">
              <Download className="h-3 w-3 animate-pulse" />
              Refreshing...
            </div>
          )}

          {/* Audit event list */}
          <AuditEventList
            auditData={auditData}
            isLoading={isLoading}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      </div>
    </motion.div>
  );
}

// =============================================================================
// StorageInfoBar — Shows storage usage, strategy badge, retention info
// =============================================================================

interface StorageInfoBarProps {
  usedPercent: number;
  strategy: 'diff' | 'full' | 'reference';
  isLoading: boolean;
}

function StorageInfoBar({ usedPercent, strategy, isLoading }: StorageInfoBarProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 space-y-3">
        <Skeleton className="h-4 w-full max-w-sm bg-slate-800" />
        <Skeleton className="h-2 w-full bg-slate-800" />
      </div>
    );
  }

  const isWarning = usedPercent >= 80;
  const isDanger = usedPercent >= 95;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.2 }}
      className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 space-y-3"
    >
      <div className="flex items-center gap-3 flex-wrap">
        <HardDrive className="h-4 w-4 text-slate-400" />
        <span className="text-sm text-slate-300">
          Storage Usage:{" "}
          <span className={`font-medium ${isDanger ? 'text-rose-400' : isWarning ? 'text-amber-400' : 'text-emerald-400'}`}>
            {usedPercent}%
          </span>
        </span>
        {isWarning && (
          <Badge variant="outline" className="border-amber-600/40 bg-amber-600/10 text-amber-300 gap-1">
            <AlertTriangle className="h-3 w-3" />
            Approaching limit
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-3">
          <Badge
            variant="outline"
            className="border-slate-700 bg-slate-800 text-slate-300 gap-1"
          >
            <Shield className="h-3 w-3" />
            Strategy: {strategy.toUpperCase()}
          </Badge>
          <span className="text-xs text-slate-500">Retention: 90 days</span>
        </div>
      </div>
      <Progress
        value={usedPercent}
        className={`h-2 ${isDanger ? 'bg-rose-900/30' : isWarning ? 'bg-amber-900/30' : 'bg-slate-800'}`}
      />
    </motion.div>
  );
}
