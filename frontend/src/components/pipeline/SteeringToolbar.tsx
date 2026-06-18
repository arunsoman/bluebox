// =============================================================================
// SteeringToolbar — Per UI architecture section 6.5
// View mode toggle: Summary | Detail
// Page navigation (Prev/Next) if paginated
// Bookmark count badge
// Compare mode toggle
// Action buttons: Accept All, Modify, Replace, Ask Me, Authorize System, Revert
// Each button calls the appropriate API action via pipelineApi.steer()
// NO mock data — reads from steeringStore
// =============================================================================

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  LayoutList, List, ChevronLeft, ChevronRight, Bookmark, GitCompare,
  CheckCircle, HelpCircle, Shield, RotateCcw,
  Search, X
} from 'lucide-react';
import { useSteeringStore } from '@/stores/steeringStore';
import { usePipelineStore } from '@/stores/pipelineStore';
import { pipelineApi } from '@/lib/api';

export default function SteeringToolbar() {
  const sessionId = usePipelineStore((s) => s.sessionId);
  const currentStage = usePipelineStore((s) => s.currentStage);
  const viewMode = useSteeringStore((s) => s.viewMode);
  const currentPage = useSteeringStore((s) => s.currentPage);
  const bookmarkedOptionIds = useSteeringStore((s) => s.bookmarkedOptionIds);
  const comparisonMode = useSteeringStore((s) => s.comparisonMode);
  const currentPanel = useSteeringStore((s) => s.currentPanel);
  const setViewMode = useSteeringStore((s) => s.setViewMode);
  const setPage = useSteeringStore((s) => s.setPage);
  const setComparisonMode = useSteeringStore((s) => s.setComparisonMode);
  const setSearchQuery = useSteeringStore((s) => s.setSearchQuery);

  const [showSearch, setShowSearch] = useState(false);
  const [searchInput, setSearchInput] = useState('');

  const totalPages = currentPanel?.render_policy?.total_pages ?? 1;
  const totalNodes = currentPanel?.render_policy?.total_nodes ?? 0;
  const pageSize = currentPanel?.render_policy?.page_size ?? 20;

  const canSteer = sessionId && currentStage;

  const sendAction = async (actionType: string, payload: Record<string, unknown> = {}) => {
    if (!canSteer) return;
    await pipelineApi.steer(sessionId!, {
      session_id: sessionId!,
      action_type: actionType,
      stage: currentStage!,
      payload,
      timestamp: new Date().toISOString(),
    });
  };

  const handleSearch = (value: string) => {
    setSearchInput(value);
    setSearchQuery(value);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-wrap items-center gap-2 border-b border-slate-700 bg-slate-900/80 px-4 py-2.5 backdrop-blur"
    >
      {/* View mode toggle */}
      <div className="flex items-center rounded-md border border-slate-600 bg-slate-800">
        <button
          onClick={() => setViewMode('summary')}
          className={`flex items-center gap-1 rounded-l-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
            viewMode === 'summary' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LayoutList className="h-3 w-3" />
          Summary
        </button>
        <button
          onClick={() => setViewMode('detail')}
          className={`flex items-center gap-1 rounded-r-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
            viewMode === 'detail' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <List className="h-3 w-3" />
          Detail
        </button>
      </div>

      {/* Page navigation */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1 rounded-md border border-slate-600 bg-slate-800 px-2">
          <button
            onClick={() => setPage(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-slate-200 disabled:opacity-30"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-[3rem] text-center text-xs text-slate-400">
            {currentPage}/{totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
            className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-slate-200 disabled:opacity-30"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Node count */}
      {totalNodes > 0 && (
        <span className="text-xs text-slate-500">
          {Math.min((currentPage - 1) * pageSize + 1, totalNodes)}-
          {Math.min(currentPage * pageSize, totalNodes)} of {totalNodes} nodes
        </span>
      )}

      <div className="ml-auto flex items-center gap-2">
        {/* Search */}
        {showSearch ? (
          <div className="flex items-center gap-1 rounded-md border border-slate-600 bg-slate-800 px-2">
            <Search className="h-3 w-3 text-slate-500" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search nodes..."
              autoFocus
              className="w-32 bg-transparent py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
            />
            <button onClick={() => { setShowSearch(false); handleSearch(''); }} className="text-slate-500 hover:text-slate-300">
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowSearch(true)}
            className="rounded-md border border-slate-600 bg-slate-800 p-1.5 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
            title="Search"
          >
            <Search className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Bookmark count */}
        <button
          onClick={() => setComparisonMode(!comparisonMode)}
          className={`flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
            comparisonMode
              ? 'border-amber-600 bg-amber-900/40 text-amber-300'
              : 'border-slate-600 bg-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Bookmark className="h-3.5 w-3.5" />
          {bookmarkedOptionIds.length > 0 && (
            <span className="rounded-full bg-amber-600 px-1 text-[10px] font-bold text-white">
              {bookmarkedOptionIds.length}
            </span>
          )}
        </button>

        {/* Compare mode */}
        {bookmarkedOptionIds.length >= 2 && (
          <button
            onClick={() => setComparisonMode(!comparisonMode)}
            className={`flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
              comparisonMode
                ? 'border-blue-600 bg-blue-900/40 text-blue-300'
                : 'border-slate-600 bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitCompare className="h-3.5 w-3.5" />
            Compare
          </button>
        )}

        <div className="h-5 w-px bg-slate-700" />

        {/* Action buttons */}
        <button
          onClick={() => sendAction('ACCEPT')}
          className="flex items-center gap-1 rounded-md border border-emerald-700 bg-emerald-900/40 px-2.5 py-1.5 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-900/60"
        >
          <CheckCircle className="h-3.5 w-3.5" />
          Accept All
        </button>

        <button
          onClick={() => sendAction('ASK_ME')}
          className="flex items-center gap-1 rounded-md border border-blue-700 bg-blue-900/40 px-2.5 py-1.5 text-xs font-medium text-blue-300 transition-colors hover:bg-blue-900/60"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          Ask Me
        </button>

        <button
          onClick={() => sendAction('AUTHORIZE_SYSTEM')}
          className="flex items-center gap-1 rounded-md border border-purple-700 bg-purple-900/40 px-2.5 py-1.5 text-xs font-medium text-purple-300 transition-colors hover:bg-purple-900/60"
        >
          <Shield className="h-3.5 w-3.5" />
          Authorize
        </button>

        <button
          onClick={() => sendAction('REVERT')}
          className="flex items-center gap-1 rounded-md border border-slate-600 bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Revert
        </button>
      </div>
    </motion.div>
  );
}
