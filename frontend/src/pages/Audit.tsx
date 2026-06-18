import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ReactNode } from 'react';
import {
  Search,
  ChevronUp,
  ChevronDown,
  Eye,
  X,
  Filter,
  ChevronLeft,
  ChevronRight,
  GitCompare,
  Download,
  Clock,
  Activity,
  Wallet,
  CheckCircle2,
  RotateCcw,
  Plus,
  Save,
} from 'lucide-react';
import GlassCard from '@/components/GlassCard';
import StatusBadge from '@/components/StatusBadge';
import GlassButton from '@/components/GlassButton';
import {
  auditEntries,
  checkpoints,
  ACTION_TYPES,
  STATUS_CONFIG,
  formatRelativeTime,
  formatFullDate,
} from './audit-data';
import type { AuditEntry, Checkpoint, AuditStatus, ActionType } from './audit-data';

/* ───────── easing tokens ───────── */
const easeSpring = [0.175, 0.885, 0.32, 1.275] as [number, number, number, number];
const easeEnter = [0, 0, 0.2, 1] as [number, number, number, number];

/* ═══════════════════════════════════
   Types
   ═══════════════════════════════════ */
type SortField = 'runNumber' | 'project' | 'status' | 'stages' | 'durationSeconds' | 'startedAt';
type SortDir = 'asc' | 'desc';

interface SortState {
  field: SortField;
  dir: SortDir;
}

/* ═══════════════════════════════════
   Utility: status mapping for StatusBadge
   ═══════════════════════════════════ */
function toBadgeStatus(s: AuditStatus): 'completed' | 'failed' | 'running' {
  if (s === 'warning') return 'running';
  return s;
}

/* ═══════════════════════════════════
   Stat Card
   ═══════════════════════════════════ */
function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <GlassCard variant="frosted" padding="md" radius="md" hover className="flex items-center gap-4">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${color}15`, color }}
      >
        {icon}
      </div>
      <div>
        <p className="font-body-sm" style={{ color: '#4A6487' }}>
          {label}
        </p>
        <p className="font-mono-lg" style={{ color: '#E8F0FE' }}>
          {value}
        </p>
      </div>
    </GlassCard>
  );
}

/* ═══════════════════════════════════
   Mini Progress Bar
   ═══════════════════════════════════ */
function MiniProgressBar({ current, total }: { current: number; total: number }) {
  const pct = (current / total) * 100;
  return (
    <div className="w-full h-1 rounded-full overflow-hidden mt-1" style={{ backgroundColor: 'rgba(10,22,40,0.6)' }}>
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: '#39FF14' }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.5, ease: easeEnter }}
      />
    </div>
  );
}

/* ═══════════════════════════════════
   Detail Drawer
   ═══════════════════════════════════ */
function DetailDrawer({
  entry,
  onClose,
}: {
  entry: AuditEntry | null;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'summary' | 'diff' | 'impact'>('summary');

  const tabs = [
    { key: 'summary' as const, label: 'Summary' },
    { key: 'diff' as const, label: 'Diff' },
    { key: 'impact' as const, label: 'Impact' },
  ];

  return (
    <AnimatePresence>
      {entry && (
        <>
          {/* Overlay */}
          <motion.div
            className="fixed inset-0 z-40"
            style={{ backgroundColor: 'rgba(5, 10, 20, 0.5)', backdropFilter: 'blur(4px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
          />
          {/* Drawer */}
          <motion.div
            className="fixed top-0 right-0 bottom-0 z-50 overflow-y-auto"
            style={{
              width: 'clamp(360px, 560px, 100vw)',
              background: 'rgba(20, 45, 75, 0.55)',
              backdropFilter: 'blur(40px) saturate(140%)',
              borderLeft: '1px solid rgba(138, 180, 230, 0.12)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 40px rgba(0, 245, 255, 0.05)',
            }}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.4, ease: easeSpring }}
          >
            {entry && (
              <div className="p-6 min-h-full flex flex-col">
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="font-display-md" style={{ color: '#E8F0FE' }}>
                      #{entry.runNumber}
                    </h2>
                    <p className="font-heading-lg mt-1" style={{ color: '#E8F0FE' }}>
                      {entry.project}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <StatusBadge status={toBadgeStatus(entry.status)} size="sm" />
                      <span className="font-body-sm" style={{ color: '#4A6487' }}>
                        {formatFullDate(entry.startedAt)}
                      </span>
                    </div>
                  </div>
                  <GlassButton
                    variant="ghost"
                    size="sm"
                    icon={<X size={16} />}
                    onClick={onClose}
                    className="flex-shrink-0"
                  >
                    Close
                  </GlassButton>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 mb-6 border-b pb-1" style={{ borderColor: 'rgba(138,180,230,0.08)' }}>
                  {tabs.map((tab) => (
                    <button
                      key={tab.key}
                      className="px-4 py-2 font-heading-sm text-sm transition-all duration-200 rounded-t-md relative"
                      style={{
                        color: activeTab === tab.key ? '#00F5FF' : '#4A6487',
                        backgroundColor: activeTab === tab.key ? 'rgba(0,245,255,0.08)' : 'transparent',
                      }}
                      onClick={() => setActiveTab(tab.key)}
                    >
                      {tab.label}
                      {activeTab === tab.key && (
                        <motion.div
                          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                          style={{ backgroundColor: '#00F5FF' }}
                          layoutId="drawer-tab-indicator"
                        />
                      )}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <AnimatePresence mode="wait">
                  {activeTab === 'summary' && (
                    <motion.div
                      key="summary"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.25 }}
                      className="space-y-4 flex-1"
                    >
                      {/* Metadata Card */}
                      <GlassCard variant="frosted" padding="md" radius="md" animated={false}>
                        <h3 className="font-heading-sm mb-3" style={{ color: '#E8F0FE' }}>
                          Metadata
                        </h3>
                        <div className="space-y-2.5">
                          {[
                            ['Run ID', `#${entry.runNumber}`],
                            ['Project', entry.project],
                            ['Status', STATUS_CONFIG[entry.status].label],
                            ['Started', formatFullDate(entry.startedAt)],
                            ['Duration', entry.duration],
                            ['Stages', `${entry.stages}/8`],
                            ['Action', entry.actionType],
                            ['Stage', `Stage ${entry.stage}`],
                            ['Triggered By', entry.user],
                            ['Node', `${entry.nodeType}: ${entry.nodeName}`],
                          ].map(([label, value]) => (
                            <div key={label} className="flex justify-between">
                              <span className="font-body-sm" style={{ color: '#4A6487' }}>
                                {label}
                              </span>
                              <span
                                className={label === 'Run ID' ? 'font-mono-sm' : 'font-body-md'}
                                style={{ color: '#E8F0FE' }}
                              >
                                {value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </GlassCard>

                      {/* Reason */}
                      {entry.reason && (
                        <GlassCard variant="clear" padding="md" radius="md" animated={false}>
                          <h3 className="font-heading-sm mb-2" style={{ color: '#E8F0FE' }}>
                            Reason
                          </h3>
                          <p className="font-body-md" style={{ color: '#8BA4C7' }}>
                            {entry.reason}
                          </p>
                        </GlassCard>
                      )}

                      {/* Stage Progress */}
                      <GlassCard variant="clear" padding="md" radius="md" animated={false}>
                        <h3 className="font-heading-sm mb-3" style={{ color: '#E8F0FE' }}>
                          Stage Progress
                        </h3>
                        <div className="space-y-2">
                          {Array.from({ length: 8 }, (_, i) => (
                            <div key={i} className="flex items-center gap-3">
                              <span
                                className="font-mono-sm w-8 text-right"
                                style={{ color: i < entry.stages ? '#39FF14' : '#4A6487' }}
                              >
                                {i}
                              </span>
                              <span
                                className="font-body-sm flex-1"
                                style={{ color: i < entry.stages ? '#E8F0FE' : '#4A6487' }}
                              >
                                {['Input Parse', 'Intent Detect', 'Actor Discovery', 'Capability Map', 'Use Case Flow', 'Story Decompose', 'Task Generate', 'Blueprint Export'][i]}
                              </span>
                              {i < entry.stages ? (
                                <CheckCircle2 size={14} style={{ color: '#39FF14' }} />
                              ) : (
                                <span className="w-3.5 h-3.5 rounded-full border" style={{ borderColor: '#4A6487' }} />
                              )}
                            </div>
                          ))}
                        </div>
                      </GlassCard>
                    </motion.div>
                  )}

                  {activeTab === 'diff' && (
                    <motion.div
                      key="diff"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.25 }}
                      className="space-y-4 flex-1"
                    >
                      {/* Before / After Diff */}
                      <GlassCard variant="frosted" padding="md" radius="md" animated={false}>
                        <h3 className="font-heading-sm mb-3" style={{ color: '#E8F0FE' }}>
                          Before / After
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <span className="font-body-sm block mb-2" style={{ color: '#FF3366' }}>
                              Before
                            </span>
                            <pre
                              className="font-mono-sm p-3 rounded-md overflow-x-auto"
                              style={{
                                backgroundColor: 'rgba(255,51,102,0.08)',
                                color: '#E8F0FE',
                                border: '1px solid rgba(255,51,102,0.15)',
                              }}
                            >
                              {entry.before || '—'}
                            </pre>
                          </div>
                          <div>
                            <span className="font-body-sm block mb-2" style={{ color: '#39FF14' }}>
                              After
                            </span>
                            <pre
                              className="font-mono-sm p-3 rounded-md overflow-x-auto"
                              style={{
                                backgroundColor: 'rgba(57,255,20,0.08)',
                                color: '#E8F0FE',
                                border: '1px solid rgba(57,255,20,0.15)',
                              }}
                            >
                              {entry.after || '—'}
                            </pre>
                          </div>
                        </div>
                      </GlassCard>
                    </motion.div>
                  )}

                  {activeTab === 'impact' && (
                    <motion.div
                      key="impact"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.25 }}
                      className="flex-1"
                    >
                      <GlassCard variant="frosted" padding="md" radius="md" animated={false}>
                        <h3 className="font-heading-sm mb-3" style={{ color: '#E8F0FE' }}>
                          Impact Report
                        </h3>
                        {entry.impact ? (
                          <div
                            className="p-4 rounded-md font-body-md"
                            style={{
                              backgroundColor: 'rgba(0,245,255,0.06)',
                              border: '1px solid rgba(0,245,255,0.15)',
                              color: '#8BA4C7',
                            }}
                          >
                            {entry.impact}
                          </div>
                        ) : (
                          <p className="font-body-md" style={{ color: '#4A6487' }}>
                            No impact recorded for this entry.
                          </p>
                        )}

                        {/* Action-specific metadata */}
                        <div className="mt-4 space-y-2">
                          <h4 className="font-heading-sm" style={{ color: '#E8F0FE' }}>
                            Decision Details
                          </h4>
                          {[
                            ['Decision Type', entry.actionType],
                            ['Stage', `Stage ${entry.stage}`],
                            ['User', entry.user],
                            ['Node Type', entry.nodeType],
                            ['Node Name', entry.nodeName],
                          ].map(([label, value]) => (
                            <div key={label} className="flex justify-between">
                              <span className="font-body-sm" style={{ color: '#4A6487' }}>
                                {label}
                              </span>
                              <span className="font-body-md" style={{ color: '#E8F0FE' }}>
                                {value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </GlassCard>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Footer */}
                <div className="mt-auto pt-4 flex gap-2 border-t" style={{ borderColor: 'rgba(138,180,230,0.08)' }}>
                  <GlassButton variant="secondary" size="sm" icon={<Download size={14} />}>
                    Export
                  </GlassButton>
                  <GlassButton variant="primary" size="sm" icon={<GitCompare size={14} />}>
                    Compare
                  </GlassButton>
                  <div className="ml-auto">
                    <GlassButton variant="ghost" size="sm" className="text-[#FF3366] hover:text-[#FF3366]">
                      Delete
                    </GlassButton>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ═══════════════════════════════════
   Checkpoint Section
   ═══════════════════════════════════ */
function CheckpointSection() {
  const [items] = useState<Checkpoint[]>(checkpoints);

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display-md" style={{ color: '#E8F0FE' }}>
          Checkpoints
        </h2>
        <GlassButton variant="primary" size="sm" icon={<Plus size={14} />}>
          Create Checkpoint
        </GlassButton>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map((cp, i) => (
          <motion.div
            key={cp.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: easeSpring, delay: i * 0.06 }}
          >
            <GlassCard variant="bordered" padding="md" radius="md" hover className="h-full flex flex-col">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-8 h-8 rounded-md flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(0,245,255,0.1)', color: '#00F5FF' }}
                >
                  <Save size={16} />
                </div>
                <div>
                  <h3 className="font-heading-sm" style={{ color: '#E8F0FE' }}>
                    {cp.name}
                  </h3>
                  <span className="font-body-sm" style={{ color: '#4A6487' }}>
                    Stage {cp.stage}
                  </span>
                </div>
              </div>
              <p className="font-body-md mb-3 flex-1" style={{ color: '#8BA4C7' }}>
                {cp.description}
              </p>
              <div className="flex items-center justify-between">
                <span className="font-body-sm" style={{ color: '#4A6487' }}>
                  {cp.entriesCount} entries
                </span>
                <span className="font-mono-sm" style={{ color: '#4A6487' }}>
                  {formatRelativeTime(cp.timestamp)}
                </span>
              </div>
              <GlassButton
                variant="secondary"
                size="sm"
                icon={<RotateCcw size={14} />}
                className="mt-3 w-full"
              >
                Restore
              </GlassButton>
            </GlassCard>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════
   Filter Pill
   ═══════════════════════════════════ */
function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2, ease: [0.34, 1.56, 0.64, 1] as [number, number, number, number] }}
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-body-sm"
      style={{
        backgroundColor: 'rgba(10, 22, 40, 0.35)',
        border: '1px solid rgba(0, 245, 255, 0.3)',
        color: '#8BA4C7',
      }}
    >
      {label}
      <button
        onClick={onRemove}
        className="ml-1 hover:text-[#00F5FF] transition-colors"
        style={{ color: '#4A6487' }}
      >
        <X size={12} />
      </button>
    </motion.span>
  );
}

/* ═══════════════════════════════════
   Sort Icon
   ═══════════════════════════════════ */
function SortIcon({ field, sort }: { field: SortField; sort: SortState }) {
  const isActive = sort.field === field;
  return (
    <span className="inline-flex flex-col ml-1">
      <ChevronUp
        size={10}
        style={{ color: isActive && sort.dir === 'asc' ? '#00F5FF' : '#4A6487' }}
      />
      <ChevronDown
        size={10}
        style={{ color: isActive && sort.dir === 'desc' ? '#00F5FF' : '#4A6487', marginTop: -4 }}
      />
    </span>
  );
}

/* ═══════════════════════════════════
   Main Audit Page
   ═══════════════════════════════════ */
export default function Audit() {
  /* ── filters ── */
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<ActionType | 'All'>('All');
  const [stageFilter, setStageFilter] = useState<number | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<AuditStatus | 'All'>('All');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  /* ── sort & pagination ── */
  const [sort, setSort] = useState<SortState>({ field: 'runNumber', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  /* ── drawer ── */
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);

  /* ── has any filter ── */
  const hasActiveFilters =
    search || actionFilter !== 'All' || stageFilter !== 'All' || statusFilter !== 'All' || dateStart || dateEnd;

  /* ── clear filters ── */
  const clearFilters = useCallback(() => {
    setSearch('');
    setActionFilter('All');
    setStageFilter('All');
    setStatusFilter('All');
    setDateStart('');
    setDateEnd('');
    setPage(1);
  }, []);

  /* ── toggle sort ── */
  const toggleSort = useCallback(
    (field: SortField) => {
      setSort((prev) => {
        if (prev.field === field) {
          return { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
        }
        return { field, dir: 'desc' };
      });
      setPage(1);
    },
    [],
  );

  /* ── filtered & sorted data ── */
  const filtered = useMemo(() => {
    let data = [...auditEntries];

    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (e) =>
          e.project.toLowerCase().includes(q) ||
          e.nodeName.toLowerCase().includes(q) ||
          e.user.toLowerCase().includes(q) ||
          e.nodeType.toLowerCase().includes(q),
      );
    }

    if (actionFilter !== 'All') {
      data = data.filter((e) => e.actionType === actionFilter);
    }

    if (stageFilter !== 'All') {
      data = data.filter((e) => e.stage === stageFilter);
    }

    if (statusFilter !== 'All') {
      data = data.filter((e) => e.status === statusFilter);
    }

    if (dateStart) {
      const ds = new Date(dateStart).getTime();
      data = data.filter((e) => e.startedAt.getTime() >= ds);
    }

    if (dateEnd) {
      const de = new Date(dateEnd).getTime();
      data = data.filter((e) => e.startedAt.getTime() <= de);
    }

    data.sort((a, b) => {
      const { field, dir } = sort;
      const mul = dir === 'asc' ? 1 : -1;
      if (field === 'runNumber') return (a.runNumber - b.runNumber) * mul;
      if (field === 'project') return a.project.localeCompare(b.project) * mul;
      if (field === 'status') return a.status.localeCompare(b.status) * mul;
      if (field === 'stages') return (a.stages - b.stages) * mul;
      if (field === 'durationSeconds') return (a.durationSeconds - b.durationSeconds) * mul;
      if (field === 'startedAt') return (a.startedAt.getTime() - b.startedAt.getTime()) * mul;
      return 0;
    });

    return data;
  }, [search, actionFilter, stageFilter, statusFilter, dateStart, dateEnd, sort]);

  /* ── paginated ── */
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageSafe = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const start = (pageSafe - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, pageSafe, perPage]);

  /* ── stats ── */
  const stats = useMemo(() => {
    const totalDecisions = auditEntries.length;
    const totalRevisions = auditEntries.filter((e) => e.actionType === 'Modify' || e.actionType === 'Edit' || e.actionType === 'Replace').length;
    const lastCheckpoint = checkpoints[checkpoints.length - 1];
    return {
      totalDecisions,
      totalRevisions,
      budgetRemaining: 2,
      lastCheckpointTime: lastCheckpoint ? formatRelativeTime(lastCheckpoint.timestamp) : '—',
    };
  }, []);

  /* ── row accent border based on status ── */
  const rowBorder = (status: AuditStatus): string => {
    switch (status) {
      case 'failed':
        return 'rgba(255,51,102,0.4)';
      case 'warning':
        return 'rgba(255,184,0,0.4)';
      case 'running':
        return 'rgba(0,245,255,0.4)';
      default:
        return 'transparent';
    }
  };

  return (
    <div className="h-full overflow-y-auto scrollbar-thin p-6">
    <div
      className="w-full"
      style={{
        backgroundImage:
          'repeating-linear-gradient(180deg, transparent, transparent 71px, rgba(0,245,255,0.03) 71px, rgba(0,245,255,0.03) 72px)',
      }}
    >
      {/* ═══════ Page Header ═══════ */}
      <motion.div
        className="flex items-center justify-between mb-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: easeEnter }}
      >
        <div className="flex items-center gap-4">
          <h1 className="font-display-md" style={{ color: '#E8F0FE' }}>
            Audit Trail
          </h1>
          <span
            className="font-mono-sm px-3 py-1 rounded-full"
            style={{
              backgroundColor: 'rgba(10, 22, 40, 0.35)',
              border: '1px solid rgba(0, 245, 255, 0.3)',
              color: '#8BA4C7',
            }}
          >
            {auditEntries.length} runs
          </span>
        </div>
        <div className="flex gap-2">
          <GlassButton variant="ghost" size="sm" icon={<Filter size={14} />}>
            Filter
          </GlassButton>
          <GlassButton variant="ghost" size="sm" icon={<Download size={14} />}>
            Export
          </GlassButton>
        </div>
      </motion.div>

      {/* ═══════ Stats Row ═══════ */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: easeSpring, delay: 0.05 }}
      >
        <StatCard icon={<Activity size={20} />} label="Total Decisions" value={stats.totalDecisions} color="#00F5FF" />
        <StatCard icon={<GitCompare size={20} />} label="Total Revisions" value={stats.totalRevisions} color="#FFB800" />
        <StatCard icon={<Wallet size={20} />} label="Budget Remaining" value={`${stats.budgetRemaining} / 5`} color="#39FF14" />
        <StatCard icon={<Clock size={20} />} label="Last Checkpoint" value={stats.lastCheckpointTime} color="#7B2FFF" />
      </motion.div>

      {/* ═══════ Filter Bar ═══════ */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: easeEnter, delay: 0.1 }}
      >
        <GlassCard variant="frosted" padding="md" radius="md" className="mb-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative" style={{ width: 280 }}>
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#4A6487' }} />
              <input
                type="text"
                placeholder="Search projects, stages..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full font-body-md rounded-md outline-none transition-all duration-200 focus:ring-2 focus:ring-[#00F5FF]"
                style={{
                  backgroundColor: 'rgba(10, 22, 40, 0.5)',
                  border: '1px solid rgba(138, 180, 230, 0.1)',
                  color: '#E8F0FE',
                  padding: '10px 14px 10px 36px',
                }}
              />
            </div>

            {/* Action Type Filter */}
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value as ActionType | 'All');
                setPage(1);
              }}
              className="font-body-md rounded-md outline-none cursor-pointer transition-all duration-200 focus:ring-2 focus:ring-[#00F5FF]"
              style={{
                backgroundColor: 'rgba(10, 22, 40, 0.5)',
                border: '1px solid rgba(138, 180, 230, 0.1)',
                color: '#E8F0FE',
                padding: '10px 14px',
              }}
            >
              <option value="All">All Actions</option>
              {ACTION_TYPES.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>

            {/* Stage Filter */}
            <select
              value={stageFilter === 'All' ? 'All' : String(stageFilter)}
              onChange={(e) => {
                const v = e.target.value;
                setStageFilter(v === 'All' ? 'All' : parseInt(v, 10));
                setPage(1);
              }}
              className="font-body-md rounded-md outline-none cursor-pointer transition-all duration-200 focus:ring-2 focus:ring-[#00F5FF]"
              style={{
                backgroundColor: 'rgba(10, 22, 40, 0.5)',
                border: '1px solid rgba(138, 180, 230, 0.1)',
                color: '#E8F0FE',
                padding: '10px 14px',
              }}
            >
              <option value="All">All Stages</option>
              {Array.from({ length: 8 }, (_, i) => (
                <option key={i} value={i}>
                  Stage {i}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as AuditStatus | 'All');
                setPage(1);
              }}
              className="font-body-md rounded-md outline-none cursor-pointer transition-all duration-200 focus:ring-2 focus:ring-[#00F5FF]"
              style={{
                backgroundColor: 'rgba(10, 22, 40, 0.5)',
                border: '1px solid rgba(138, 180, 230, 0.1)',
                color: '#E8F0FE',
                padding: '10px 14px',
              }}
            >
              <option value="All">All Status</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="warning">Warning</option>
              <option value="running">In Progress</option>
            </select>

            {/* Date Range */}
            <input
              type="date"
              value={dateStart}
              onChange={(e) => {
                setDateStart(e.target.value);
                setPage(1);
              }}
              className="font-body-md rounded-md outline-none transition-all duration-200 focus:ring-2 focus:ring-[#00F5FF]"
              style={{
                backgroundColor: 'rgba(10, 22, 40, 0.5)',
                border: '1px solid rgba(138, 180, 230, 0.1)',
                color: '#E8F0FE',
                padding: '10px 14px',
              }}
            />
            <span className="font-body-sm" style={{ color: '#4A6487' }}>
              to
            </span>
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => {
                setDateEnd(e.target.value);
                setPage(1);
              }}
              className="font-body-md rounded-md outline-none transition-all duration-200 focus:ring-2 focus:ring-[#00F5FF]"
              style={{
                backgroundColor: 'rgba(10, 22, 40, 0.5)',
                border: '1px solid rgba(138, 180, 230, 0.1)',
                color: '#E8F0FE',
                padding: '10px 14px',
              }}
            />

            {/* Clear */}
            {hasActiveFilters && (
              <GlassButton variant="ghost" size="sm" icon={<X size={14} />} onClick={clearFilters}>
                Clear
              </GlassButton>
            )}
          </div>

          {/* Active filter pills */}
          <AnimatePresence>
            {hasActiveFilters && (
              <motion.div
                className="flex flex-wrap items-center gap-2 mt-3 pt-3"
                style={{ borderTop: '1px solid rgba(138, 180, 230, 0.06)' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {search && <FilterPill label={`Search: "${search}"`} onRemove={() => setSearch('')} />}
                {actionFilter !== 'All' && <FilterPill label={`Action: ${actionFilter}`} onRemove={() => setActionFilter('All')} />}
                {stageFilter !== 'All' && <FilterPill label={`Stage: ${stageFilter}`} onRemove={() => setStageFilter('All')} />}
                {statusFilter !== 'All' && <FilterPill label={`Status: ${statusFilter}`} onRemove={() => setStatusFilter('All')} />}
                {dateStart && <FilterPill label={`From: ${dateStart}`} onRemove={() => setDateStart('')} />}
                {dateEnd && <FilterPill label={`To: ${dateEnd}`} onRemove={() => setDateEnd('')} />}
                <button
                  onClick={clearFilters}
                  className="font-body-sm ml-2 hover:underline"
                  style={{ color: '#00F5FF' }}
                >
                  Clear All
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </GlassCard>
      </motion.div>

      {/* ═══════ Main Table ═══════ */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: easeEnter, delay: 0.15 }}
      >
        <GlassCard variant="frosted" padding="none" radius="md" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              {/* Table Header */}
              <thead>
                <tr
                  className="sticky top-0 z-10"
                  style={{
                    backgroundColor: 'rgba(10, 22, 40, 0.65)',
                    backdropFilter: 'blur(40px) saturate(130%)',
                  }}
                >
                  {[
                    { key: 'runNumber' as SortField, label: 'Run #', width: 80 },
                    { key: 'project' as SortField, label: 'Project', width: undefined },
                    { key: 'status' as SortField, label: 'Status', width: 120 },
                    { key: 'stages' as SortField, label: 'Stages', width: 100 },
                    { key: 'durationSeconds' as SortField, label: 'Duration', width: 100 },
                    { key: 'startedAt' as SortField, label: 'Started', width: 140 },
                    { key: null as SortField | null, label: 'Actions', width: 100 },
                  ].map((col) => (
                    <th
                      key={col.label}
                      className={`text-left font-heading-sm text-xs uppercase tracking-wider select-none ${col.key ? 'cursor-pointer hover:text-[#00F5FF]' : ''}`}
                      style={{
                        color: col.key && sort.field === col.key ? '#00F5FF' : '#4A6487',
                        padding: '12px 16px',
                        width: col.width,
                      }}
                      onClick={col.key ? () => toggleSort(col.key as SortField) : undefined}
                    >
                      <div className="flex items-center">
                        {col.label}
                        {col.key && <SortIcon field={col.key} sort={sort} />}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Table Body */}
              <tbody>
                <AnimatePresence mode="popLayout">
                  {paginated.map((entry, index) => (
                    <motion.tr
                      key={entry.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{
                        duration: 0.25,
                        ease: easeSpring,
                        delay: index * 0.03,
                      }}
                      className="group cursor-pointer transition-all duration-200"
                      style={{
                        backgroundColor: 'rgba(10, 22, 40, 0.4)',
                        borderLeft: `3px solid ${rowBorder(entry.status)}`,
                      }}
                      onClick={() => setSelectedEntry(entry)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(16, 36, 65, 0.5)';
                        e.currentTarget.style.transform = 'translateX(4px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(10, 22, 40, 0.4)';
                        e.currentTarget.style.transform = 'translateX(0)';
                      }}
                    >
                      {/* Run # */}
                      <td className="font-mono-sm" style={{ color: '#E8F0FE', padding: '14px 16px' }}>
                        #{entry.runNumber}
                      </td>
                      {/* Project */}
                      <td className="font-body-md max-w-[200px] truncate" style={{ color: '#E8F0FE', padding: '14px 16px' }}>
                        {entry.project}
                      </td>
                      {/* Status */}
                      <td style={{ padding: '14px 16px' }}>
                        <StatusBadge status={toBadgeStatus(entry.status)} size="sm" />
                      </td>
                      {/* Stages */}
                      <td style={{ padding: '14px 16px' }}>
                        <span className="font-mono-sm" style={{ color: '#E8F0FE' }}>
                          {entry.stages}/8
                        </span>
                        <MiniProgressBar current={entry.stages} total={8} />
                      </td>
                      {/* Duration */}
                      <td className="font-mono-sm" style={{ color: '#8BA4C7', padding: '14px 16px' }}>
                        {entry.duration}
                      </td>
                      {/* Started */}
                      <td className="font-body-sm" style={{ color: '#4A6487', padding: '14px 16px' }}>
                        {formatRelativeTime(entry.startedAt)}
                      </td>
                      {/* Actions */}
                      <td style={{ padding: '14px 16px' }}>
                        <div className="flex items-center gap-1">
                          <button
                            className="w-8 h-8 rounded-md inline-flex items-center justify-center transition-all duration-200 hover:bg-[rgba(0,245,255,0.1)]"
                            style={{ color: '#4A6487' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEntry(entry);
                            }}
                            title="View details"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            className="w-8 h-8 rounded-md inline-flex items-center justify-center transition-all duration-200 hover:bg-[rgba(0,245,255,0.1)]"
                            style={{ color: '#4A6487' }}
                            onClick={(e) => e.stopPropagation()}
                            title="Compare"
                          >
                            <GitCompare size={14} />
                          </button>
                          <button
                            className="w-8 h-8 rounded-md inline-flex items-center justify-center transition-all duration-200 hover:bg-[rgba(0,245,255,0.1)]"
                            style={{ color: '#4A6487' }}
                            onClick={(e) => e.stopPropagation()}
                            title="Export log"
                          >
                            <Download size={14} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>

                {paginated.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-16">
                      <div className="flex flex-col items-center">
                        <Search size={32} style={{ color: '#4A6487' }} className="mb-3" />
                        <p className="font-heading-lg mb-1" style={{ color: '#E8F0FE' }}>
                          No matching entries
                        </p>
                        <p className="font-body-md mb-4" style={{ color: '#8BA4C7' }}>
                          Try adjusting your filters to see more results.
                        </p>
                        <GlassButton variant="secondary" size="sm" onClick={clearFilters}>
                          Clear All Filters
                        </GlassButton>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ═══════ Pagination ═══════ */}
          {filtered.length > 0 && (
            <div
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              style={{ borderTop: '1px solid rgba(138, 180, 230, 0.06)' }}
            >
              <span className="font-body-sm" style={{ color: '#4A6487' }}>
                Showing {(pageSafe - 1) * perPage + 1}-{Math.min(pageSafe * perPage, filtered.length)} of{' '}
                {filtered.length}
              </span>

              <div className="flex items-center gap-2">
                {/* Prev */}
                <GlassButton
                  variant="ghost"
                  size="sm"
                  icon={<ChevronLeft size={14} />}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={pageSafe <= 1}
                >
                  Prev
                </GlassButton>

                {/* Page Numbers */}
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className="w-8 h-8 rounded-md font-body-sm transition-all duration-200"
                    style={{
                      backgroundColor: p === pageSafe ? 'rgba(16, 36, 65, 0.5)' : 'rgba(10, 22, 40, 0.35)',
                      border: p === pageSafe ? '1px solid rgba(0, 245, 255, 0.3)' : '1px solid rgba(138, 180, 230, 0.08)',
                      color: p === pageSafe ? '#00F5FF' : '#8BA4C7',
                    }}
                  >
                    {p}
                  </button>
                ))}

                {/* Next */}
                <GlassButton
                  variant="ghost"
                  size="sm"
                  iconRight={<ChevronRight size={14} />}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={pageSafe >= totalPages}
                >
                  Next
                </GlassButton>

                {/* Per page */}
                <select
                  value={perPage}
                  onChange={(e) => {
                    setPerPage(parseInt(e.target.value, 10));
                    setPage(1);
                  }}
                  className="font-body-sm rounded-md outline-none cursor-pointer ml-2"
                  style={{
                    backgroundColor: 'rgba(10, 22, 40, 0.5)',
                    border: '1px solid rgba(138, 180, 230, 0.1)',
                    color: '#E8F0FE',
                    padding: '6px 10px',
                  }}
                >
                  {[10, 25, 50].map((n) => (
                    <option key={n} value={n}>
                      {n}/page
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </GlassCard>
      </motion.div>

      {/* ═══════ Checkpoint Section ═══════ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: easeSpring, delay: 0.25 }}
      >
        <CheckpointSection />
      </motion.div>

      {/* ═══════ Detail Drawer ═══════ */}
      <DetailDrawer entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
    </div>
    </div>
  );
}
