// =============================================================================
// DecisionsPage — Decision ledger with summary, filter, chain list, export
// Route: /pipeline/:sessionId/decisions
// =============================================================================

import { useState, useCallback } from 'react';
import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { FileJson, FileText, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { pipelineApi } from '@/lib/api';
import { useDecisionStore } from '@/stores/decisionStore';
import DecisionSummary from '@/components/decisions/DecisionSummary';
import DecisionChain from '@/components/decisions/DecisionChain';

type FilterMode = 'all' | 'active' | 'superseded' | 'system';

const FILTER_OPTIONS: { label: string; value: FilterMode }[] = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Superseded', value: 'superseded' },
  { label: 'System', value: 'system' },
];

export default function DecisionsPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const {
    data: decisionData,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ['decisions', sessionId],
    queryFn: () => {
      if (!sessionId) throw new Error('No session ID');
      return pipelineApi.getDecisions(sessionId);
    },
    enabled: !!sessionId,
    staleTime: 15 * 1000,
  });

  // Sync to store
  const storeSetEntries = useDecisionStore((s) => s.setEntries);
  if (decisionData) {
    storeSetEntries(decisionData.entries);
  }

  // Filter entries locally
  const filteredEntries = (decisionData?.entries ?? []).filter((entry) => {
    if (filterMode === 'active' && entry.status !== 'active') return false;
    if (filterMode === 'superseded' && entry.status !== 'superseded') return false;
    if (filterMode === 'system' && entry.decision_maker !== 'system_authorized') return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        entry.decision_id.toLowerCase().includes(q) ||
        entry.decision_point.toLowerCase().includes(q) ||
        entry.chosen_option?.label?.toLowerCase().includes(q) ||
        entry.stage.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleExport = useCallback(
    async (format: 'json' | 'markdown') => {
      if (!sessionId) return;
      try {
        const response = await fetch(
          `/api/v1/pipeline/${sessionId}/decisions/export?format=${format}`
        );
        if (!response.ok) throw new Error('Export failed');
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `decisions-${sessionId}.${format === 'json' ? 'json' : 'md'}`;
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

  const handleRevert = useCallback(
    (decisionId: string) => {
      // In a full implementation this would call the revert API
      console.log('Revert decision:', decisionId, 'session:', sessionId);
    },
    [sessionId]
  );

  const handleRevise = useCallback(
    (decisionId: string) => {
      // In a full implementation this would open a revision dialog
      console.log('Revise decision:', decisionId, 'session:', sessionId);
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
          <h1 className="text-lg font-semibold text-slate-100">Decision Ledger</h1>
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="mx-auto max-w-5xl space-y-4">
          {/* Summary bar */}
          <DecisionSummary
            total={decisionData?.entries?.length ?? 0}
            userDecisions={decisionData?.total_user_decisions ?? 0}
            systemDecisions={decisionData?.total_system_decisions ?? 0}
            superseded={decisionData?.total_superseded ?? 0}
            reverted={decisionData?.total_reverted ?? 0}
            isLoading={isLoading}
          />

          {/* Filter bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-slate-800 bg-slate-900/60 p-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400" />
              <div className="flex items-center gap-1">
                {FILTER_OPTIONS.map((opt) => {
                  const isActive = filterMode === opt.value;
                  return (
                    <Button
                      key={opt.value}
                      variant={isActive ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setFilterMode(opt.value)}
                      className={
                        isActive
                          ? 'bg-blue-600 text-white hover:bg-blue-700 h-7 text-xs'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800 h-7 text-xs'
                      }
                    >
                      {opt.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-slate-500" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search decisions..."
                className="pl-9 w-full sm:w-64 bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500 focus-visible:ring-blue-500"
              />
            </div>
          </div>

          {/* Fetching indicator */}
          {isFetching && !isLoading && (
            <div className="flex items-center gap-2 text-xs text-blue-400">
              <FileJson className="h-3 w-3 animate-pulse" />
              Refreshing...
            </div>
          )}

          {/* Decision chain */}
          <DecisionChain
            entries={filteredEntries}
            isLoading={isLoading}
            sessionId={sessionId}
            onRevert={handleRevert}
            onRevise={handleRevise}
          />
        </div>
      </div>
    </motion.div>
  );
}
