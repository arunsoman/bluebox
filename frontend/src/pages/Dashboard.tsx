import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Play,
  ClipboardCheck,
  Download,
  Terminal,
  CheckCircle,
  XCircle,
  FileCheck,
  Hand,
  Info,
  Plus,
  Upload,
  RefreshCw,
  Server,
  AlertTriangle,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import GlassCard from '@/components/GlassCard';
import StatusBadge from '@/components/StatusBadge';
import GlassButton from '@/components/GlassButton';
import ConnectionStatusPill from '@/components/ConnectionStatusPill';
import PipelineStageNode from '@/components/PipelineStageNode';
import PRDInput from '@/components/PRDInput';
import { usePipelineStore } from '@/store/usePipelineStore';
import { useWebSocketStore } from '@/store/useWebSocketStore';
import { useBackendStatus } from '@/hooks/useBackendStatus';
import { usePipelineData } from '@/hooks/usePipelineData';
import { FEATURES } from '@/lib/config';
import type { ActivityEvent } from '@/store/usePipelineStore';

const activityIcons: Record<ActivityEvent['type'], typeof Play> = {
  stage_complete: CheckCircle,
  stage_start: Play,
  stage_fail: XCircle,
  blueprint_complete: FileCheck,
  steering_input: Hand,
  system: Info,
};

const activityColors: Record<ActivityEvent['type'], string> = {
  stage_complete: '#39FF14',
  stage_start: '#00F5FF',
  stage_fail: '#FF3366',
  blueprint_complete: '#7B2FFF',
  steering_input: '#FFB800',
  system: '#4A6487',
};

/* ------------------------------------------------------------------ */
/*  Animated counter hook                                               */
/* ------------------------------------------------------------------ */
function useCountUp(target: number, duration = 800, startOnMount = true) {
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!startOnMount) return;
    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(Math.round(target * eased));
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, startOnMount]);

  return val;
}

/* ================================================================== */
/*  DASHBOARD                                                          */
/* ================================================================== */
export default function Dashboard() {
  const navigate = useNavigate();
  const stages = usePipelineStore((s) => s.stages);
  const metrics = usePipelineStore((s) => s.metrics);
  const throughput24h = usePipelineStore((s) => s.throughputData24h);
  const activityFeed = usePipelineStore((s) => s.activityFeed);
  const systemStatus = usePipelineStore((s) => s.systemStatus);
  const hasActivePRD = usePipelineStore((s) => s.hasActivePRD);
  const prdClassification = usePipelineStore((s) => s.prdClassification);
  const submitPRD = usePipelineStore((s) => s.submitPRD);
  const classifyPRD = usePipelineStore((s) => s.classifyPRD);
  const resetPRD = usePipelineStore((s) => s.resetPRD);
  const wsStatus = useWebSocketStore((s) => s.status);

  const actualProjectId = usePipelineStore((s) => s.projectId);
  const { loading: dataLoading, error: dataError, refresh } = usePipelineData(actualProjectId ?? undefined);
  const backendStatus = useBackendStatus(30000);

  /* ── Auto-refresh when PRD is submitted ── */
  useEffect(() => {
    if (hasActivePRD && FEATURES.liveApi && actualProjectId) {
      refresh();
    }
  }, [hasActivePRD, actualProjectId, refresh]);

  const activeCount = useCountUp(metrics.activePipelines, 800);
  const completedCount = useCountUp(metrics.completedBlueprints, 800);

  const throughputData = throughput24h;

  const healthRadius = 20;
  const healthCircumference = 2 * Math.PI * healthRadius;
  const healthOffset = healthCircumference - (metrics.pipelineHealth / 100) * healthCircumference;

  const activeStageIndex = stages.findIndex((s) => s.status === 'running');

  /* animation helpers */
  const staggerContainer = {
    hidden: {},
    show: { transition: { staggerChildren: 0.08 } },
  };
  const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, ease: [0.175, 0.885, 0.32, 1.275] as [number, number, number, number] },
    },
  };

  /* ── PRD Entry Point ── */
  if (!hasActivePRD) {
    return (
      <div className="h-full overflow-y-auto scrollbar-thin">
        <div className="flex items-center justify-center min-h-full py-8">
          <PRDInput onSubmit={submitPRD} classifyPRD={classifyPRD} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin p-6">
    <div className="space-y-6">
      {/* ── Loading Banner ── */}
      <AnimatePresence>
        {dataLoading && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg"
            style={{
              background: 'rgba(0,245,255,0.08)',
              border: '1px solid rgba(0,245,255,0.2)',
            }}
          >
            <RefreshCw size={14} className="animate-spin" style={{ color: '#00F5FF' }} />
            <span className="font-body-sm" style={{ color: '#00F5FF' }}>
              Fetching pipeline data from backend...
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Error Banner ── */}
      <AnimatePresence>
        {dataError && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg"
            style={{
              background: 'rgba(255,51,102,0.08)',
              border: '1px solid rgba(255,51,102,0.2)',
            }}
          >
            <AlertTriangle size={14} style={{ color: '#FF3366' }} />
            <span className="font-body-sm flex-1" style={{ color: '#FF3366' }}>
              {dataError}
            </span>
            <button
              onClick={refresh}
              className="font-body-sm px-2 py-0.5 rounded hover:bg-white/5"
              style={{ color: '#FF3366', border: '1px solid rgba(255,51,102,0.2)' }}
            >
              Retry
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── PRD Info Bar ── */}
      {prdClassification && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg"
          style={{
            background: 'rgba(10,22,40,0.5)',
            border: '1px solid rgba(138,180,230,0.1)',
          }}
        >
          <FileCheck size={14} style={{ color: '#00F5FF' }} />
          <span className="font-body-sm text-text-secondary">
            <strong className="text-text-primary">PRD submitted</strong>
            {' — '}
            {prdClassification.wordCount} words, classified as{' '}
            <span
              className="px-1.5 py-0.5 rounded"
              style={{
                background:
                  prdClassification.category === 'WELL_FORMED'
                    ? 'rgba(57,255,20,0.1)'
                    : prdClassification.category === 'MINIMALIST'
                    ? 'rgba(255,184,0,0.1)'
                    : 'rgba(0,245,255,0.1)',
                color:
                  prdClassification.category === 'WELL_FORMED'
                    ? '#39FF14'
                    : prdClassification.category === 'MINIMALIST'
                    ? '#FFB800'
                    : '#00F5FF',
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
              }}
            >
              {prdClassification.category.replace('_', ' ')}
            </span>
            {' — '}
            <span className="text-text-tertiary">
              {(prdClassification.confidence * 100).toFixed(0)}% confidence
            </span>
          </span>
        </motion.div>
      )}

      {/* ── Go to Studio CTA ── */}
      {hasActivePRD && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-5 py-3 rounded-xl cursor-pointer"
          style={{
            background: 'rgba(0,245,255,0.08)',
            border: '1px solid rgba(0,245,255,0.25)',
          }}
          onClick={() => navigate('/studio')}
          whileHover={{ scale: 1.005 }}
        >
          <Play size={18} style={{ color: '#00F5FF' }} />
          <div className="flex-1">
            <span className="font-heading-sm text-text-primary">Pipeline is running</span>
            <span className="font-body-sm text-text-tertiary ml-2">Click here to go to the Pipeline Studio</span>
          </div>
          <span className="font-heading-sm" style={{ color: '#00F5FF' }}>Open Studio &rarr;</span>
        </motion.div>
      )}

      {/* --- Section 1: Page Header --- */}
      <motion.div
        className="flex items-center justify-between"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0, 0, 0.2, 1] as [number, number, number, number] }}
      >
        <h1 className="font-display-lg text-text-primary">Dashboard</h1>
        <div className="flex items-center gap-3">
          <GlassButton variant="primary" icon={<Plus size={16} />} onClick={resetPRD}>
            New Pipeline
          </GlassButton>
        </div>
      </motion.div>

      {/* --- Section 2: Metrics Row (4 cards) --- */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        {/* Metric 1: Active Pipelines */}
        <motion.div variants={fadeUp}>
          <GlassCard variant="tinted" padding="md" hover>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-body-sm text-text-tertiary">Active Pipelines</p>
                <p className="font-display-xl text-text-glow mt-1">{activeCount}</p>
                <p className="font-body-sm text-text-tertiary mt-0.5">Currently running</p>
              </div>
              {wsStatus === 'connected' && (
                <motion.span
                  className="w-2 h-2 rounded-full bg-[#00F5FF]"
                  animate={{ boxShadow: ['0 0 4px #00F5FF60', '0 0 12px #00F5FFA0', '0 0 4px #00F5FF60'] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
            </div>
            <div className="mt-3 h-0.5 bg-[#0F2847] rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-[#00F5FF] to-[#00D4E5] rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((metrics.activePipelines / 10) * 100, 100)}%` }}
                transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
              />
            </div>
          </GlassCard>
        </motion.div>

        {/* Metric 2: Completed Blueprints */}
        <motion.div variants={fadeUp}>
          <GlassCard variant="frosted" padding="md" hover>
            <p className="font-body-sm text-text-tertiary">Completed Blueprints</p>
            <p className="font-display-xl text-text-primary mt-1">{completedCount}</p>
            <p className="font-body-sm text-text-tertiary mt-0.5">All time</p>
          </GlassCard>
        </motion.div>

        {/* Metric 3: Avg Stage Time */}
        <motion.div variants={fadeUp}>
          <GlassCard variant="frosted" padding="md" hover>
            <p className="font-body-sm text-text-tertiary">Avg. Stage Time</p>
            <p className="font-display-xl text-text-primary mt-1">{metrics.avgStageTime}</p>
            <p className="font-body-sm text-text-tertiary mt-0.5">Per stage across all runs</p>
          </GlassCard>
        </motion.div>

        {/* Metric 4: Pipeline Health */}
        <motion.div variants={fadeUp}>
          <GlassCard variant="bordered" padding="md" hover>
            <div className="flex items-center gap-4">
              <div>
                <p className="font-body-sm text-text-tertiary">Pipeline Health</p>
                <p className="font-display-xl text-[#39FF14] mt-1">{metrics.pipelineHealth}%</p>
                <p className="font-body-sm text-text-tertiary mt-0.5">Success rate</p>
              </div>
              <svg width="52" height="52" viewBox="0 0 52 52" className="flex-shrink-0">
                <circle
                  cx="26"
                  cy="26"
                  r={healthRadius}
                  fill="none"
                  stroke="#0F2847"
                  strokeWidth="4"
                />
                <motion.circle
                  cx="26"
                  cy="26"
                  r={healthRadius}
                  fill="none"
                  stroke="#39FF14"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={healthCircumference}
                  transform="rotate(-90 26 26)"
                  initial={{ strokeDashoffset: healthCircumference }}
                  animate={{ strokeDashoffset: healthOffset }}
                  transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
                />
              </svg>
            </div>
          </GlassCard>
        </motion.div>
      </motion.div>

      {/* --- Section 3: Pipeline Flow Visualizer --- */}
      <GlassCard variant="tinted" padding="lg">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-heading-md text-text-primary">Pipeline Flow</h2>
          <StatusBadge status={stages.some((s) => s.status === 'running') ? 'running' : 'idle'} />
        </div>
        <div className="flex items-center justify-center overflow-x-auto pb-4">
          <div className="flex items-center">
            {stages.map((stage, i) => {
              let connectorStatus: 'idle' | 'active' | 'completed' | 'failed' = 'idle';
              if (i < activeStageIndex) connectorStatus = 'completed';
              else if (i === activeStageIndex) connectorStatus = 'active';

              return (
                <PipelineStageNode
                  key={stage.id}
                  stage={stage}
                  index={i}
                  showConnector={i > 0}
                  connectorStatus={connectorStatus}
                  onClick={() => navigate(`/studio?stage=${stage.id}`)}
                />
              );
            })}
          </div>
        </div>
      </GlassCard>

      {/* --- Section 4: Stage Status Grid (8 cards) --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stages.map((stage, i) => {
          const stageCardVariant =
            stage.status === 'running'
              ? 'tinted'
              : stage.status === 'failed'
              ? 'bordered'
              : 'frosted';

          return (
            <motion.div
              key={stage.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                delay: i * 0.06,
                ease: [0.175, 0.885, 0.32, 1.275] as [number, number, number, number],
              }}
            >
              <GlassCard variant={stageCardVariant} padding="md" hover onClick={() => navigate(`/studio?stage=${stage.id}`)}>
                {/* Header */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-mono-sm text-[#00F5FF] bg-[rgba(0,245,255,0.12)] px-2 py-0.5 rounded-full">
                    S{stage.id}
                  </span>
                  <span className="font-heading-sm text-text-primary flex-1 truncate">{stage.name}</span>
                  <StatusBadge status={stage.status} showLabel={false} size="sm" />
                </div>

                {/* Progress bar */}
                <div className="h-1 bg-[#0F2847] rounded-full overflow-hidden mb-3">
                  <motion.div
                    className={`h-full rounded-full ${
                      stage.status === 'completed'
                        ? 'bg-[#39FF14]'
                        : stage.status === 'failed'
                        ? 'bg-[#FF3366]'
                        : 'bg-gradient-to-r from-[#00F5FF] to-[#00D4E5]'
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${stage.progress}%` }}
                    transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
                  />
                </div>

                {/* Status info */}
                <div className="flex items-center justify-between mb-3">
                  <p className="font-body-sm text-text-tertiary line-clamp-1">{stage.description}</p>
                  <span
                    className="font-mono-sm px-1.5 py-0.5 rounded flex-shrink-0 ml-2"
                    style={{
                      fontSize: '10px',
                      color:
                        stage.status === 'completed'
                          ? '#39FF14'
                          : stage.status === 'running'
                          ? '#00F5FF'
                          : stage.status === 'failed'
                          ? '#FF3366'
                          : '#4A6487',
                      background:
                        stage.status === 'completed'
                          ? 'rgba(57,255,20,0.08)'
                          : stage.status === 'running'
                          ? 'rgba(0,245,255,0.08)'
                          : stage.status === 'failed'
                          ? 'rgba(255,51,102,0.08)'
                          : 'rgba(138,180,230,0.05)',
                    }}
                  >
                    {stage.status === 'completed' ? 'DONE' : stage.status === 'running' ? `${stage.progress}%` : stage.status === 'failed' ? 'FAIL' : 'WAIT'}
                  </span>
                </div>

                {/* Footer */}
                <p className="font-body-sm text-[#00F5FF] hover:underline cursor-pointer">
                  View Details &rarr;
                </p>
              </GlassCard>
            </motion.div>
          );
        })}
      </div>

      {/* --- Section 5: Throughput Chart --- */}
      <GlassCard variant="frosted" padding="lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading-md text-text-primary">Pipeline Throughput</h2>
          <span className="font-body-sm text-text-tertiary">24h</span>
        </div>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={throughputData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="cyanGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00F5FF" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#00F5FF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(138,180,230,0.06)" />
              <XAxis
                dataKey="time"
                tick={{ fill: '#4A6487', fontSize: 11, fontFamily: 'Inter, sans-serif' }}
                axisLine={{ stroke: 'rgba(138,180,230,0.08)' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#4A6487', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
                axisLine={{ stroke: 'rgba(138,180,230,0.08)' }}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: 'rgba(20, 45, 75, 0.9)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(138, 180, 230, 0.12)',
                  borderRadius: '8px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                }}
                labelStyle={{ color: '#8BA4C7', fontSize: 12, fontFamily: 'Inter, sans-serif' }}
                itemStyle={{ color: '#E8F0FE', fontSize: 13, fontFamily: 'JetBrains Mono, monospace' }}
                formatter={(value: number) => [`${value} pipelines`, 'Throughput']}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#00F5FF"
                strokeWidth={2}
                fill="url(#cyanGradient)"
                dot={{ r: 3, fill: '#00F5FF', strokeWidth: 0 }}
                activeDot={{ r: 6, fill: '#00F5FF', strokeWidth: 2, stroke: '#050A14' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      {/* --- Section 6: Quick Actions + Activity Feed + System Status --- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Quick Actions */}
        <div className="lg:col-span-5">
          <GlassCard variant="clear" padding="lg">
            <h2 className="font-heading-md text-text-primary mb-4">Quick Actions</h2>
            <div className="space-y-2">
              {[
                { label: 'Start New Pipeline', icon: <Play size={18} />, variant: 'primary' as const, action: () => navigate('/studio') },
                { label: 'Upload Requirements Doc', icon: <Upload size={18} />, variant: 'secondary' as const, action: undefined },
                { label: 'Review Pending Approvals', icon: <ClipboardCheck size={18} />, variant: 'ghost' as const, action: undefined, badge: 2 },
                { label: 'Export Latest Blueprint', icon: <Download size={18} />, variant: 'ghost' as const, action: undefined },
                { label: 'View System Logs', icon: <Terminal size={18} />, variant: 'ghost' as const, action: undefined },
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05, ease: [0, 0, 0.2, 1] as [number, number, number, number] }}
                >
                  <GlassButton
                    variant={item.variant}
                    fullWidth
                    icon={item.icon}
                    iconRight={
                      item.badge ? (
                        <span className="bg-[rgba(255,184,0,0.15)] text-[#FFB800] text-xs font-mono-sm px-2 py-0.5 rounded-full">
                          {item.badge}
                        </span>
                      ) : (
                        <span className="text-text-tertiary text-xs">&rarr;</span>
                      )
                    }
                    className="justify-between text-left"
                    onClick={item.action}
                  >
                    {item.label}
                  </GlassButton>
                </motion.div>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Activity Feed */}
        <div className="lg:col-span-4">
          <GlassCard variant="frosted" padding="lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading-md text-text-primary">Recent Activity</h2>
              <button
                onClick={() => navigate('/audit')}
                className="font-body-sm text-[#00F5FF] hover:underline"
              >
                View All &rarr;
              </button>
            </div>
            <div className="max-h-[320px] overflow-y-auto scrollbar-thin space-y-0">
              {activityFeed.map((event, i) => {
                const EventIcon = activityIcons[event.type];
                return (
                  <motion.div
                    key={event.id}
                    className="flex gap-3 py-3 border-b border-[rgba(138,180,230,0.06)] last:border-0"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.04, ease: [0, 0, 0.2, 1] as [number, number, number, number] }}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      <EventIcon
                        size={14}
                        style={{ color: activityColors[event.type] }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-body-md text-text-primary truncate">{event.title}</p>
                        <p className="font-body-sm text-text-tertiary whitespace-nowrap">{event.timestamp}</p>
                      </div>
                      <p className="font-body-sm text-text-secondary mt-0.5 line-clamp-2">
                        {event.description}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </GlassCard>
        </div>

        {/* System Status */}
        <div className="lg:col-span-3">
          <GlassCard variant="clear" padding="lg">
            <h2 className="font-heading-sm text-text-primary mb-3">System Status</h2>
            <div className="mb-3">
              <ConnectionStatusPill size="md" />
            </div>

            {/* Backend Status */}
            <div className="flex items-center gap-2 mb-3 px-2 py-1.5 rounded"
              style={{ background: 'rgba(10,22,40,0.4)' }}
            >
              <Server size={12} style={{ color: '#8BA4C7' }} />
              <span className="font-body-sm text-text-tertiary">Backend:</span>
              {backendStatus.status === 'online' && (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#39FF14]" />
                  <span className="font-body-sm text-[#39FF14]">Online</span>
                  {backendStatus.latency !== null && (
                    <span className="font-mono-sm text-text-tertiary">({backendStatus.latency}ms)</span>
                  )}
                </>
              )}
              {backendStatus.status === 'offline' && (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF3366]" />
                  <span className="font-body-sm text-[#FF3366]">Offline</span>
                </>
              )}
              {backendStatus.status === 'checking' && (
                <>
                  <RefreshCw size={10} className="animate-spin" style={{ color: '#FFB800' }} />
                  <span className="font-body-sm text-[#FFB800]">Checking...</span>
                </>
              )}
              {backendStatus.status === 'mock' && (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FFB800]" />
                  <span className="font-body-sm text-[#FFB800]">Mock Mode</span>
                </>
              )}
            </div>

            <p className="font-body-sm text-text-tertiary mb-4">
              Last sync: {systemStatus.lastSync}
            </p>
            <div className="space-y-2.5">
              {([
                { key: 'api', label: 'API' },
                { key: 'websocket', label: 'WebSocket' },
                { key: 'database', label: 'Database' },
                { key: 'queue', label: 'Queue' },
              ] as const).map((item) => {
                const healthy = systemStatus[item.key];
                return (
                  <div key={item.key} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <motion.span
                        className={`w-2 h-2 rounded-full ${healthy ? 'bg-[#39FF14]' : 'bg-[#FF3366]'}`}
                        animate={
                          healthy
                            ? { boxShadow: ['0 0 4px #39FF1460', '0 0 10px #39FF14A0', '0 0 4px #39FF1460'] }
                            : { boxShadow: ['0 0 4px #FF336660', '0 0 10px #FF3366A0', '0 0 4px #FF336660'] }
                        }
                        transition={{ duration: healthy ? 2 : 1, repeat: Infinity, ease: 'easeInOut' }}
                      />
                      <span className="font-body-md text-text-secondary">{item.label}</span>
                    </div>
                    <span className={`font-body-sm ${healthy ? 'text-[#39FF14]' : 'text-[#FF3366]'}`}>
                      {healthy ? 'Operational' : 'Degraded'}
                    </span>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
    </div>
  );
}