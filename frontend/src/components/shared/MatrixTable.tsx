// =============================================================================
// MatrixTable — Reusable matrix/table component for RBAC permission and
// data access matrices.
// =============================================================================

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface MatrixColumn<T = string> {
  key: string;
  label: string;
  meta?: T;
}

export interface MatrixRow<T = string> {
  key: string;
  label: string;
  meta?: T;
}

interface MatrixTableProps<R = string, C = string> {
  rows: MatrixRow<R>[];
  columns: MatrixColumn<C>[];
  renderCell: (row: MatrixRow<R>, column: MatrixColumn<C>) => ReactNode;
  cornerLabel?: string;
  highlightRow?: string | null;
  highlightColumn?: string | null;
  className?: string;
  compact?: boolean;
}

export function MatrixTable<R, C>({
  rows,
  columns,
  renderCell,
  cornerLabel = '',
  highlightRow = null,
  highlightColumn = null,
  className,
  compact = false,
}: MatrixTableProps<R, C>) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th
              className={cn(
                'border border-slate-200 bg-slate-50 text-left font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
                compact ? 'px-2 py-1' : 'px-3 py-2'
              )}
            >
              {cornerLabel}
            </th>
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'border border-slate-200 bg-slate-50 text-center font-semibold text-slate-700 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
                  compact ? 'px-2 py-1 text-xs' : 'px-3 py-2',
                  highlightColumn === col.key && 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
                )}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <motion.tr
              key={row.key}
              initial={false}
              animate={{
                backgroundColor:
                  highlightRow === row.key ? 'rgba(251, 191, 36, 0.05)' : 'transparent',
              }}
              transition={{ duration: 0.15 }}
              className={cn(
                'transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50',
                highlightRow === row.key && 'bg-amber-50/50 dark:bg-amber-900/10'
              )}
            >
              <td
                className={cn(
                  'border border-slate-200 font-medium text-slate-800 dark:border-slate-700 dark:text-slate-200',
                  compact ? 'px-2 py-1' : 'px-3 py-2'
                )}
              >
                {row.label}
              </td>
              {columns.map((col) => (
                <td
                  key={`${row.key}-${col.key}`}
                  className={cn(
                    'border border-slate-200 text-center dark:border-slate-700',
                    compact ? 'px-2 py-1' : 'px-3 py-2'
                  )}
                >
                  {renderCell(row, col)}
                </td>
              ))}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default MatrixTable;
