// =============================================================================
// Header — Logo, stage name, status badge, user selector, save & exit
// =============================================================================

import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Save, LogOut, ChevronDown } from 'lucide-react';
import { usePipelineStore } from '@/stores/pipelineStore';
import { useAuthStore } from '@/stores/authStore';
import { pipelineApi } from '@/lib/api';

const stageLabels: Record<string, string> = {
  prd_analysis: 'PRD Analysis',
  ideation: 'Ideation',
  actor_discovery: 'Actor Discovery',
  capability_discovery: 'Capability Discovery',
  use_case_discovery: 'Use Case Discovery',
  story_discovery: 'Story Discovery',
  task_decomposition: 'Task Decomposition',
};

const statusColors: Record<string, string> = {
  idle: 'bg-zinc-500',
  running: 'bg-blue-500 animate-pulse',
  paused: 'bg-amber-500',
  completed: 'bg-emerald-500',
  failed: 'bg-red-500',
  suspended: 'bg-slate-500',
  expired: 'bg-red-700',
};

export default function Header() {
  const navigate = useNavigate();
  const sessionId = usePipelineStore((s) => s.sessionId);
  const currentStage = usePipelineStore((s) => s.currentStage);
  const pipelineStatus = usePipelineStore((s) => s.pipelineStatus);
  const userId = useAuthStore((s) => s.userId);
  const role = useAuthStore((s) => s.role);
  const setUser = useAuthStore((s) => s.setUser);

  const stageName = currentStage ? stageLabels[currentStage] ?? currentStage : 'No Active Stage';
  const statusClass = statusColors[pipelineStatus] ?? 'bg-zinc-500';

  const handleRoleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      if (value) {
        const [newRole, newUserId] = value.split('|');
        setUser(newUserId, newRole as 'pipeline_admin' | 'pipeline_user' | 'pipeline_viewer');
      }
    },
    [setUser]
  );

  const handleSaveAndExit = useCallback(async () => {
    if (!sessionId) return;
    try {
      await pipelineApi.saveAndExit(sessionId);
      navigate('/');
    } catch {
      // Error is logged; user can retry
    }
  }, [sessionId, navigate]);

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-slate-700 bg-slate-900 px-4 shadow-lg">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <span className="text-lg font-bold text-white">Protobox</span>
        <span className="text-sm text-slate-400">|</span>
        <span className="text-sm font-medium text-slate-300">Collaborative Steering Pipeline</span>
      </div>

      {/* Stage + Status */}
      {currentStage && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-300">{stageName}</span>
          <span className={`inline-block h-2 w-2 rounded-full ${statusClass}`} />
          <span className="text-xs capitalize text-slate-400">{pipelineStatus}</span>
        </div>
      )}

      {/* Right side: User selector + Save */}
      <div className="flex items-center gap-3">
        {/* User selector */}
        <div className="relative flex items-center">
          <select
            value={role && userId ? `${role}|${userId}` : ''}
            onChange={handleRoleChange}
            className="appearance-none rounded-md border border-slate-600 bg-slate-800 py-1.5 pl-3 pr-8 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
          >
            <option value="">Select user...</option>
            <option value="pipeline_admin|admin_001">Admin</option>
            <option value="pipeline_user|user_001">User</option>
            <option value="pipeline_viewer|viewer_001">Viewer</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 h-3 w-3 text-slate-400" />
        </div>

        {/* Save & Exit */}
        {sessionId && (
          <button
            onClick={handleSaveAndExit}
            className="flex items-center gap-1.5 rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700 hover:text-white"
          >
            <Save className="h-3 w-3" />
            Save &amp; Exit
          </button>
        )}

        {/* Logout */}
        {userId && (
          <button
            onClick={() => useAuthStore.getState().clearUser()}
            className="flex items-center gap-1.5 rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
          >
            <LogOut className="h-3 w-3" />
          </button>
        )}
      </div>
    </header>
  );
}
