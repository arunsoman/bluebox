// =============================================================================
// TaskSteeringPanel — Engineering task cards grouped by story
// Each task: title, layer badge, task_type, file_paths, implementation_sketch, effort_points
// Test specs section
// Access guards display
// Pagination if >20 tasks
// =============================================================================

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Hammer, Code, Database, Cloud, Shield, Beaker, GitBranch, Server,
  Lock, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useSteeringStore } from '@/stores/steeringStore';
import { cn } from '@/lib/utils';
import NodeCard from '@/components/shared/NodeCard';
import type {
  EngineeringTask, TaskDecompositionResult,
  TaskLayer, TaskType,
} from '@/types/domain';

const layerConfig: Record<TaskLayer, { icon: React.ReactNode; color: string }> = {
  frontend: { icon: <Code className="h-3.5 w-3.5" />, color: 'bg-blue-900/60 text-blue-300 border-blue-700' },
  backend: { icon: <Server className="h-3.5 w-3.5" />, color: 'bg-emerald-900/60 text-emerald-300 border-emerald-700' },
  database: { icon: <Database className="h-3.5 w-3.5" />, color: 'bg-purple-900/60 text-purple-300 border-purple-700' },
  infra: { icon: <Cloud className="h-3.5 w-3.5" />, color: 'bg-orange-900/60 text-orange-300 border-orange-700' },
  auth: { icon: <Shield className="h-3.5 w-3.5" />, color: 'bg-red-900/60 text-red-300 border-red-700' },
  test: { icon: <Beaker className="h-3.5 w-3.5" />, color: 'bg-cyan-900/60 text-cyan-300 border-cyan-700' },
  devops: { icon: <GitBranch className="h-3.5 w-3.5" />, color: 'bg-pink-900/60 text-pink-300 border-pink-700' },
  security: { icon: <Lock className="h-3.5 w-3.5" />, color: 'bg-rose-900/60 text-rose-300 border-rose-700' },
};

const taskTypeColor: Record<TaskType, string> = {
  CREATE: 'bg-emerald-900/60 text-emerald-300',
  UPDATE: 'bg-amber-900/60 text-amber-300',
  DELETE: 'bg-red-900/60 text-red-300',
  CONFIGURE: 'bg-blue-900/60 text-blue-300',
  TEST: 'bg-cyan-900/60 text-cyan-300',
  DOCUMENT: 'bg-slate-800 text-slate-400',
};

const PAGE_SIZE = 20;

export default function TaskSteeringPanel() {
  const draftOutput = useSteeringStore((s) => s.draftOutput);
  const [currentPage, setCurrentPage] = useState(1);

  const result: TaskDecompositionResult | null = useMemo(() => {
    if (!draftOutput) return null;
    return (draftOutput as { task_result?: TaskDecompositionResult }).task_result ?? null;
  }, [draftOutput]);

  if (!result) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-slate-500">Waiting for task decomposition...</p>
      </div>
    );
  }

  const { decompositions, total_tasks, layer_distribution } = result;

  // Flatten all tasks
  const allTasks = useMemo(() => {
    const tasks: Array<{ task: EngineeringTask; storyId: string }> = [];
    for (const decomp of decompositions) {
      for (const task of decomp.tasks) {
        tasks.push({ task, storyId: decomp.story_id });
      }
    }
    return tasks;
  }, [decompositions]);

  const totalPages = Math.max(1, Math.ceil(allTasks.length / PAGE_SIZE));
  const pageTasks = allTasks.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto space-y-4 p-4">
        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-slate-700 bg-slate-800/30 p-4"
        >
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sm font-medium text-slate-300">
              Total Tasks: <span className="text-blue-400">{total_tasks}</span>
            </span>
            {layer_distribution && Object.entries(layer_distribution).map(
              ([layer, count]) =>
                count > 0 && (
                  <span
                    key={layer}
                    className={cn(
                      'flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium',
                      layerConfig[layer as TaskLayer]?.color ?? 'bg-slate-800 text-slate-400'
                    )}
                  >
                    {layerConfig[layer as TaskLayer]?.icon}
                    {layer}: {count}
                  </span>
                )
            )}
          </div>
        </motion.div>

        {/* Tasks */}
        <div className="space-y-2">
          {pageTasks.map(({ task, storyId }, idx) => (
            <TaskCard key={task.task_id} task={task} storyId={storyId} index={idx} />
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="rounded-md border border-slate-600 bg-slate-700 p-1.5 text-slate-300 hover:bg-slate-600 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs text-slate-400">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="rounded-md border border-slate-600 bg-slate-700 p-1.5 text-slate-300 hover:bg-slate-600 disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TaskCard({
  task,
  storyId,
  index,
}: {
  task: EngineeringTask;
  storyId: string;
  index: number;
}) {
  const layer = layerConfig[task.layer];

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02, duration: 0.15 }}
    >
      <NodeCard
        id={task.task_id}
        title={task.title}
        subtitle={task.description?.slice(0, 120)}
        type={task.layer}
        typeColor={layer.color}
        icon={layer.icon}
      >
        <div className="mt-3 space-y-3">
          {/* Task type + meta */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase', taskTypeColor[task.task_type])}>
              {task.task_type}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Story: {storyId}</span>
            {task.estimated_hours !== null && (
              <span className="flex items-center gap-1 text-[10px] text-slate-500">
                <Hammer className="h-3 w-3" />
                {task.estimated_hours}h
              </span>
            )}
          </div>

          {/* Description */}
          <p className="text-xs text-slate-400">{task.description}</p>

          {/* Acceptance criteria */}
          {task.acceptance_criteria.length > 0 && (
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Acceptance Criteria
              </span>
              <ul className="mt-1 space-y-0.5">
                {task.acceptance_criteria.map((ac, i) => (
                  <li key={i} className="text-xs text-slate-400">- {ac}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Dependencies */}
          {task.dependencies.length > 0 && (
            <div className="flex items-center gap-1.5">
              <GitBranch className="h-3 w-3 text-slate-500" />
              <span className="text-[10px] text-slate-500">Depends on:</span>
              <div className="flex flex-wrap gap-1">
                {task.dependencies.map((dep) => (
                  <span key={dep} className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300 font-mono">
                    {dep}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </NodeCard>
    </motion.div>
  );
}
