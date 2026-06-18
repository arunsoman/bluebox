// =============================================================================
// NodeCard — Reusable card for summary/detail view of any pipeline node
// Used by all steering panels
// =============================================================================

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Bookmark, BookmarkCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Traceability, Confidence } from '@/types/domain';

interface NodeCardProps {
  id: string;
  title: string;
  subtitle?: string;
  type: string;
  typeColor?: string;
  traceability?: Traceability;
  confidence?: Confidence;
  icon: React.ReactNode;
  children: React.ReactNode;
  onBookmark?: () => void;
  isBookmarked?: boolean;
  className?: string;
}

const traceabilityBadge: Record<Traceability, string> = {
  EXPLICIT: 'bg-emerald-900/60 text-emerald-300 border-emerald-700',
  INFERRED: 'bg-amber-900/60 text-amber-300 border-amber-700',
  CANDIDATE: 'bg-slate-800 text-slate-400 border-slate-600',
};

const confidenceBadge: Record<Confidence, string> = {
  high: 'bg-emerald-900/60 text-emerald-300',
  medium: 'bg-amber-900/60 text-amber-300',
  low: 'bg-red-900/60 text-red-300',
};

export default function NodeCard({
  id,
  title,
  subtitle,
  type,
  typeColor = 'bg-blue-900/60 text-blue-300 border-blue-700',
  traceability,
  confidence,
  icon,
  children,
  onBookmark,
  isBookmarked,
  className,
}: NodeCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
      className={cn(
        'rounded-lg border border-slate-700 bg-slate-800/50 overflow-hidden',
        className
      )}
    >
      {/* Summary row — always visible */}
      <div
        className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-slate-800 transition-colors"
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpanded(!expanded); }}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-700 text-slate-300">
          {icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-slate-200">{title}</span>
            <span className={cn('rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider', typeColor)}>
              {type}
            </span>
          </div>
          {subtitle && (
            <p className="truncate text-xs text-slate-400 mt-0.5">{subtitle}</p>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {traceability && (
            <span className={cn('rounded border px-1.5 py-0.5 text-[10px] font-medium', traceabilityBadge[traceability])}>
              {traceability}
            </span>
          )}
          {confidence && (
            <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', confidenceBadge[confidence])}>
              {confidence}
            </span>
          )}
          {onBookmark && (
            <button
              onClick={(e) => { e.stopPropagation(); onBookmark(); }}
              className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-amber-400 transition-colors"
              title={isBookmarked ? 'Remove bookmark' : 'Bookmark'}
            >
              {isBookmarked ? <BookmarkCheck className="h-3.5 w-3.5 text-amber-400" /> : <Bookmark className="h-3.5 w-3.5" />}
            </button>
          )}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          )}
        </div>
      </div>

      {/* Detail panel — expandable */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-700 px-4 py-3">
              <span className="text-[10px] font-mono text-slate-500">{id}</span>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
