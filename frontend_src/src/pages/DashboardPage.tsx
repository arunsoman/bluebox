// =============================================================================
// DashboardPage — Session list with resume functionality
// =============================================================================

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Rocket, Play, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { pipelineApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { usePipelineStore } from '@/stores/pipelineStore';
import type { PipelineSessionDTO } from '@/types/api';

const statusColors: Record<string, { bg: string; text: string; icon: typeof Clock }> = {
  idle: { bg: 'bg-slate-800', text: 'text-slate-400', icon: Clock },
  running: { bg: 'bg-blue-900/50', text: 'text-blue-400', icon: Loader2 },
  paused: { bg: 'bg-amber-900/50', text: 'text-amber-400', icon: Clock },
  completed: { bg: 'bg-emerald-900/50', text: 'text-emerald-400', icon: Play },
  failed: { bg: 'bg-red-900/50', text: 'text-red-400', icon: AlertCircle },
  suspended: { bg: 'bg-slate-800', text: 'text-slate-400', icon: Clock },
  expired: { bg: 'bg-red-950', text: 'text-red-500', icon: AlertCircle },
};

const stageLabels: Record<string, string> = {
  prd_analysis: 'PRD Analysis',
  ideation: 'Ideation',
  actor_discovery: 'Actor Discovery',
  capability_discovery: 'Capability Discovery',
  use_case_discovery: 'Use Case Discovery',
  story_discovery: 'Story Discovery',
  task_decomposition: 'Task Decomposition',
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.userId);
  const role = useAuthStore((s) => s.role);
  const setSession = usePipelineStore((s) => s.setSession);

  // Start new pipeline state
  const [projectName, setProjectName] = useState('');

  // Fetch sessions
  const {
    data: sessions,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['pipeline-sessions', userId],
    queryFn: () => (userId ? pipelineApi.listSessions(userId) : Promise.resolve([])),
    enabled: !!userId,
  });

  const handleStartPipeline = async () => {
    if (!userId || !role) return;
    try {
      const session = await pipelineApi.start({
        user_id: userId,
        project_name: projectName || undefined,
      });
      setSession(session);
      navigate(`/pipeline/${session.session_id}`);
    } catch {
      // Error handled silently; user can retry
    }
  };

  const handleResume = (session: PipelineSessionDTO) => {
    setSession(session);
    navigate(`/pipeline/${session.session_id}`);
  };

  const needsLogin = !userId;

  return (
    <div className="flex h-full flex-col overflow-y-auto p-8">
      <div className="mx-auto w-full max-w-4xl space-y-8">
        {/* Hero */}
        <div className="text-center">
          <h1 className="mb-2 text-3xl font-bold text-white">Collaborative Steering Pipeline</h1>
          <p className="text-sm text-slate-400">
            AI-assisted product discovery with human steering at every stage.
          </p>
        </div>

        {/* Start New Pipeline */}
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
            <Rocket className="h-5 w-5 text-blue-400" />
            Start New Pipeline
          </h2>

          {needsLogin ? (
            <div className="flex items-center gap-2 rounded-md border border-amber-800 bg-amber-950/50 p-4 text-sm text-amber-400">
              <AlertCircle className="h-4 w-4" />
              Please select a user role from the header to begin.
            </div>
          ) : (
            <div className="flex gap-3">
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Project name (optional)..."
                className="flex-1 rounded-md border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleStartPipeline();
                }}
              />
              <button
                onClick={handleStartPipeline}
                className="flex items-center gap-2 rounded-md bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500"
              >
                <Rocket className="h-4 w-4" />
                Start Pipeline
              </button>
            </div>
          )}
        </div>

        {/* Sessions List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Recent Sessions</h2>

          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading sessions...
            </div>
          )}

          {isError && (
            <div className="flex items-center gap-2 rounded-md border border-red-800 bg-red-950/50 p-4 text-sm text-red-400">
              <AlertCircle className="h-4 w-4" />
              Failed to load sessions. Please try again.
            </div>
          )}

          {sessions && sessions.length === 0 && !isLoading && (
            <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900 py-16 text-center">
              <Clock className="mx-auto mb-3 h-10 w-10 text-slate-600" />
              <p className="text-sm font-medium text-slate-400">No sessions yet.</p>
              <p className="text-xs text-slate-500">Start a new pipeline to begin.</p>
            </div>
          )}

          {sessions && sessions.length > 0 && (
            <div className="grid gap-3">
              {sessions.map((session) => {
                const statusConfig = statusColors[session.status] ?? statusColors.idle;
                const StatusIcon = statusConfig.icon;

                return (
                  <div
                    key={session.session_id}
                    className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900 p-4 transition-colors hover:border-slate-600"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">
                          {session.project_id}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusConfig.bg} ${statusConfig.text}`}
                        >
                          <StatusIcon
                            className={`h-3 w-3 ${session.status === 'running' ? 'animate-spin' : ''}`}
                          />
                          {session.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span>ID: {session.session_id}</span>
                        {session.current_stage && (
                          <span>
                            Stage: {stageLabels[session.current_stage] ?? session.current_stage}
                          </span>
                        )}
                        <span>{new Date(session.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleResume(session)}
                      className="flex items-center gap-1.5 rounded-md bg-slate-800 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-slate-700"
                    >
                      <Play className="h-3.5 w-3.5" />
                      {session.status === 'completed' ? 'View' : 'Resume'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
