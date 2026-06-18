// =============================================================================
// DecisionSummary — Aggregate stats bar: total, user, system, superseded, reverted
// =============================================================================

import { motion } from 'framer-motion';
import { Users, Cpu, RotateCcw, GitPullRequest, GitBranch } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface DecisionSummaryProps {
  total: number;
  userDecisions: number;
  systemDecisions: number;
  superseded: number;
  reverted: number;
  isLoading: boolean;
}

const items = [
  { key: 'total' as const, label: 'Total', icon: GitBranch, color: 'text-blue-400', bg: 'bg-blue-600/10' },
  { key: 'userDecisions' as const, label: 'User', icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-600/10' },
  { key: 'systemDecisions' as const, label: 'System', icon: Cpu, color: 'text-purple-400', bg: 'bg-purple-600/10' },
  { key: 'superseded' as const, label: 'Superseded', icon: GitPullRequest, color: 'text-amber-400', bg: 'bg-amber-600/10' },
  { key: 'reverted' as const, label: 'Reverted', icon: RotateCcw, color: 'text-rose-400', bg: 'bg-rose-600/10' },
];

export default function DecisionSummary({
  total,
  userDecisions,
  systemDecisions,
  superseded,
  reverted,
  isLoading,
}: DecisionSummaryProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <div className="grid grid-cols-5 gap-4">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-16 bg-slate-800" />
              <Skeleton className="h-8 w-12 bg-slate-800" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const values = { total, userDecisions, systemDecisions, superseded, reverted };

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="rounded-lg border border-slate-800 bg-slate-900/60 p-4"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((item, index) => {
          const Icon = item.icon;
          const value = values[item.key];
          return (
            <motion.div
              key={item.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.2 }}
              className={`flex items-center gap-3 rounded-md ${item.bg} p-3`}
            >
              <Icon className={`h-5 w-5 ${item.color}`} />
              <div>
                <div className={`text-lg font-semibold ${item.color}`}>{value}</div>
                <div className="text-xs text-slate-400">{item.label}</div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
