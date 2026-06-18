// =============================================================================
// AuditFilters — Filter controls for the audit trail
// Action type dropdown, Actor ID input, Date range pickers
// =============================================================================

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Search, Calendar, X, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AuditActionType } from '@/types/domain';

const ACTION_TYPE_OPTIONS: { label: string; value: AuditActionType | 'all' }[] = [
  { label: 'All Actions', value: 'all' },
  { label: 'Accept', value: 'ACCEPT' },
  { label: 'Modify', value: 'MODIFY' },
  { label: 'Replace', value: 'REPLACE' },
  { label: 'Revert', value: 'REVERT' },
  { label: 'Ask Me', value: 'ASK_ME' },
  { label: 'Authorize System', value: 'AUTHORIZE_SYSTEM' },
  { label: 'Custom Option', value: 'CUSTOM_OPTION' },
  { label: 'Skip Question', value: 'SKIP_QUESTION' },
  { label: 'Answer Question', value: 'ANSWER_QUESTION' },
  { label: 'Confirm Seed', value: 'CONFIRM_SEED' },
  { label: 'Map to Stage', value: 'MAP_TO_STAGE' },
  { label: 'Create Annotation', value: 'CREATE_ANNOTATION' },
  { label: 'Out of Scope', value: 'OUT_OF_SCOPE' },
  { label: 'Dismiss Compliance', value: 'DISMISS_COMPLIANCE' },
];

export interface AuditFilterValues {
  actionType: AuditActionType | null;
  actorId: string | null;
  dateFrom: string | null;
  dateTo: string | null;
}

interface AuditFiltersProps {
  initialValues?: Partial<AuditFilterValues>;
  onApply: (filters: AuditFilterValues) => void;
  onClear: () => void;
  disabled?: boolean;
}

export default function AuditFilters({
  initialValues,
  onApply,
  onClear,
  disabled = false,
}: AuditFiltersProps) {
  const [actionType, setActionType] = useState<AuditActionType | 'all'>(
    initialValues?.actionType ?? 'all'
  );
  const [actorId, setActorId] = useState(initialValues?.actorId ?? '');
  const [dateFrom, setDateFrom] = useState(initialValues?.dateFrom ?? '');
  const [dateTo, setDateTo] = useState(initialValues?.dateTo ?? '');

  const handleApply = useCallback(() => {
    onApply({
      actionType: actionType === 'all' ? null : actionType,
      actorId: actorId.trim() || null,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
    });
  }, [actionType, actorId, dateFrom, dateTo, onApply]);

  const handleClear = useCallback(() => {
    setActionType('all');
    setActorId('');
    setDateFrom('');
    setDateTo('');
    onClear();
  }, [onClear]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
      className="rounded-lg border border-slate-800 bg-slate-900/80 p-4"
    >
      <div className="flex items-center gap-2 mb-4 text-slate-300">
        <Filter className="h-4 w-4" />
        <span className="text-sm font-medium">Filters</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Action Type */}
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-400">Action Type</Label>
          <div className="relative">
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value as AuditActionType | 'all')}
              disabled={disabled}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 appearance-none cursor-pointer"
            >
              {ACTION_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Actor ID */}
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-400">Actor ID</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-slate-500" />
            <Input
              value={actorId}
              onChange={(e) => setActorId(e.target.value)}
              placeholder="Filter by actor..."
              disabled={disabled}
              className="pl-9 bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500 focus-visible:ring-blue-500"
            />
          </div>
        </div>

        {/* Date From */}
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-400">Date From</Label>
          <div className="relative">
            <Calendar className="absolute left-2.5 top-2 h-4 w-4 text-slate-500" />
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              disabled={disabled}
              className="pl-9 bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500 focus-visible:ring-blue-500 [color-scheme:dark]"
            />
          </div>
        </div>

        {/* Date To */}
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-400">Date To</Label>
          <div className="relative">
            <Calendar className="absolute left-2.5 top-2 h-4 w-4 text-slate-500" />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              disabled={disabled}
              className="pl-9 bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500 focus-visible:ring-blue-500 [color-scheme:dark]"
            />
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button
          onClick={handleApply}
          disabled={disabled}
          size="sm"
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Filter className="mr-1.5 h-3.5 w-3.5" />
          Apply Filters
        </Button>
        <Button
          onClick={handleClear}
          disabled={disabled}
          variant="outline"
          size="sm"
          className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-slate-200"
        >
          <X className="mr-1.5 h-3.5 w-3.5" />
          Clear
        </Button>
      </div>
    </motion.div>
  );
}
