// =============================================================================
// OptionCard — Reusable card for steering options
// Displays rank, label, confidence, rationale, trade-offs
// =============================================================================

import { motion } from 'framer-motion';
import { Bookmark, BookmarkCheck, Check, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SteeringOption } from '@/types/domain';
import type { Confidence } from '@/types/domain';

interface OptionCardProps {
  option: SteeringOption;
  isSelected?: boolean;
  isBookmarked?: boolean;
  onSelect?: () => void;
  onBookmark?: () => void;
  onModify?: () => void;
  showRank?: boolean;
  className?: string;
}

const confidenceBadge: Record<Confidence, string> = {
  high: 'bg-emerald-900/60 text-emerald-300',
  medium: 'bg-amber-900/60 text-amber-300',
  low: 'bg-red-900/60 text-red-300',
};

export default function OptionCard({
  option,
  isSelected,
  isBookmarked,
  onSelect,
  onBookmark,
  onModify,
  showRank = true,
  className,
}: OptionCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
      className={cn(
        'rounded-lg border bg-slate-800/50 p-4 transition-colors',
        isSelected ? 'border-blue-600 bg-blue-900/20' : 'border-slate-700 hover:border-slate-600',
        className
      )}
    >
      {/* Header: rank + label + confidence */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {showRank && (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-slate-300">
              {option.rank}
            </span>
          )}
          <h4 className="text-sm font-semibold text-slate-200">{option.label}</h4>
        </div>
        <span className={cn('shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold uppercase', confidenceBadge[option.confidence])}>
          {option.confidence}
        </span>
      </div>

      {/* Description */}
      {option.description && (
        <p className="mt-2 text-xs text-slate-400">{option.description}</p>
      )}

      {/* Rationale */}
      {option.rationale && (
        <p className="mt-2 text-xs italic text-slate-500">
          <span className="font-medium text-slate-400">Rationale:</span> {option.rationale}
        </p>
      )}

      {/* Trade-offs */}
      {option.trade_offs.length > 0 && (
        <div className="mt-2 space-y-1">
          {option.trade_offs.map((to, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className="text-emerald-400">+ {to.advantage}</span>
              <span className="text-slate-600">|</span>
              <span className="text-red-400">- {to.disadvantage}</span>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="mt-3 flex items-center gap-2">
        {onSelect && (
          <button
            onClick={onSelect}
            className={cn(
              'flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              isSelected
                ? 'bg-blue-600 text-white hover:bg-blue-500'
                : 'border border-slate-600 bg-slate-700 text-slate-200 hover:bg-slate-600'
            )}
          >
            <Check className="h-3 w-3" />
            {isSelected ? 'Selected' : 'Select'}
          </button>
        )}
        {onModify && (
          <button
            onClick={onModify}
            className="flex items-center gap-1 rounded-md border border-slate-600 bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-600"
          >
            <Pencil className="h-3 w-3" />
            Modify
          </button>
        )}
        {onBookmark && (
          <button
            onClick={onBookmark}
            className="ml-auto rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-700 hover:text-amber-400"
            title={isBookmarked ? 'Remove bookmark' : 'Bookmark'}
          >
            {isBookmarked ? <BookmarkCheck className="h-3.5 w-3.5 text-amber-400" /> : <Bookmark className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
    </motion.div>
  );
}
