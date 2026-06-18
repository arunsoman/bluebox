import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  Square,
  Trash2,
  Lock,
  Unlock,
  AlertTriangle,
  Check,
  X,
  MessageSquare,
  Send,
  Bot,
  User,
  Zap,
  Copy,
  CheckCheck,
  Terminal,
} from 'lucide-react';
import GlassCard from '@/components/GlassCard';
import StatusBadge from '@/components/StatusBadge';
import GlassButton from '@/components/GlassButton';
import type { StatusType } from '@/components/StatusBadge';
import { usePipelineStore } from '@/store/usePipelineStore';
import { useWebSocketStore } from '@/store/useWebSocketStore';
import type { SteeringMode, PipelineRunState } from '@/types/studio';


/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STAGE_NAMES = [
  'Intent Capture',
  'Requirement Extraction',
  'Actor Discovery',
  'Capability Mapping',
  'Use Case Generation',
  'Story Derivation',
  'Task Decomposition',
  'Blueprint Assembly',
];

const STAGE_DESCRIPTIONS = [
  'Parse free-text user input into structured intent',
  'Extract functional and non-functional requirements',
  'Identify all system actors and their roles',
  'Map actor capabilities and interactions',
  'Generate use cases from capabilities',
  'Derive user stories from use cases',
  'Decompose stories into executable tasks',
  'Assemble final ProjectBlueprint artifact',
];

const STAGE_COLORS = [
  '#00F5FF', '#00F5FF', '#00F5FF', '#7B2FFF',
  '#7B2FFF', '#39FF14', '#39FF14', '#00F5FF',
];

const SEVERITY_ICON: Record<string, string> = {
  info: '▶',
  success: '✓',
  warning: '⚠',
  error: '✕',
  debug: '◆',
};

const SEVERITY_COLOR: Record<string, string> = {
  info: '#00F5FF',
  success: '#39FF14',
  warning: '#FFB800',
  error: '#FF3366',
  debug: '#4A6487',
};

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

/** Left-panel vertical stage node (timeline style) */
function VerticalStageNode({
  stageId,
  name,
  status,
  isActive,
  isSelected,
  progress,
  onClick,
}: {
  stageId: number;
  name: string;
  status: StatusType;
  isActive: boolean;
  isSelected: boolean;
  progress: number;
  onClick: () => void;
}) {
  return (
    <motion.div
      className={`relative flex items-start gap-3 cursor-pointer group rounded-lg p-2 transition-all duration-250 ${
        isActive
          ? 'glass-tinted border-l-[3px] border-l-[#00F5FF]'
          : isSelected
          ? 'glass-bordered'
          : 'hover:bg-[rgba(138,180,230,0.05)]'
      }`}
      style={
        isActive
          ? { boxShadow: 'var(--glow-cyan)' }
          : {}
      }
      onClick={onClick}
      whileHover={{ x: 2 }}
      initial={{ opacity: 0, x: -15 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: stageId * 0.05 }}
    >
      {/* Stage number badge */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center font-mono-sm transition-all duration-200 ${
          isActive
            ? 'bg-[#00F5FF] text-[#050A14]'
            : status === 'completed'
            ? 'bg-[rgba(57,255,20,0.15)] text-[#39FF14]'
            : status === 'failed'
            ? 'bg-[rgba(255,51,102,0.15)] text-[#FF3366]'
            : 'bg-[rgba(15,40,71,0.5)] text-[#4A6487]'
        }`}
      >
        {stageId}
      </div>

      {/* Stage info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`font-heading-sm truncate ${
              isActive ? 'text-text-glow' : 'text-text-primary'
            }`}
          >
            {name}
          </span>
          {isActive && (
            <motion.span
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="text-[#00F5FF] text-xs"
            >
              ▶
            </motion.span>
          )}
        </div>

        {/* Mini status */}
        <div className="mt-0.5">
          <StatusBadge status={status} showLabel={false} size="sm" />
        </div>

        {/* Progress bar for active stage */}
        {isActive && (
          <div className="mt-1.5 h-[3px] bg-[#0F2847] rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{
                background: `linear-gradient(90deg, ${STAGE_COLORS[stageId]}, #00D4E5)`,
              }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        )}
      </div>

      {/* Active pulse ring */}
      {isActive && (
        <motion.div
          className="absolute inset-0 rounded-lg pointer-events-none"
          animate={{
            boxShadow: [
              '0 0 8px rgba(0,245,255,0.1)',
              '0 0 20px rgba(0,245,255,0.25)',
              '0 0 8px rgba(0,245,255,0.1)',
            ],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </motion.div>
  );
}

/** Single terminal log line */
function TerminalLogLine({
  log,
  stageColor,
}: {
  log: { id: string; timestamp: string; stageId: number; severity: string; message: string; isSteeringOpportunity?: boolean };
  stageColor: string;
}) {
  return (
    <motion.div
      className={`font-mono-sm py-1 px-2 rounded flex items-start gap-2 ${
        log.isSteeringOpportunity
          ? 'bg-[rgba(255,184,0,0.08)] border-l-2 border-l-[#FFB800]'
          : ''
      }`}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Timestamp */}
      <span className="text-[#4A6487] flex-shrink-0 select-none">[{log.timestamp}]</span>

      {/* Stage tag */}
      <span
        className="flex-shrink-0 px-1 rounded text-[10px] font-mono-sm"
        style={{
          backgroundColor: `${stageColor}20`,
          color: stageColor,
        }}
      >
        S{log.stageId}
      </span>

      {/* Severity icon */}
      <span
        className="flex-shrink-0 select-none"
        style={{ color: SEVERITY_COLOR[log.severity] || '#4A6487' }}
      >
        {SEVERITY_ICON[log.severity] || '▶'}
      </span>

      {/* Message */}
      <span
        className={`break-all ${
          log.isSteeringOpportunity ? 'text-[#FFB800]' : 'text-text-primary'
        }`}
      >
        {log.message}
      </span>

      {/* Steering opportunity indicator */}
      {log.isSteeringOpportunity && (
        <span className="text-[#FFB800] text-[10px] flex-shrink-0 cursor-pointer hover:underline ml-auto">
          Steer →
        </span>
      )}
    </motion.div>
  );
}

/** Chat message bubble */
function ChatMessage({ role, content }: { role: 'user' | 'assistant'; content: string }) {
  return (
    <div className={`flex gap-2 ${role === 'user' ? 'flex-row-reverse' : ''}`}>
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
          role === 'user' ? 'bg-[rgba(0,245,255,0.2)]' : 'bg-[rgba(123,47,255,0.2)]'
        }`}
      >
        {role === 'user' ? (
          <User className="w-3 h-3 text-[#00F5FF]" />
        ) : (
          <Bot className="w-3 h-3 text-[#7B2FFF]" />
        )}
      </div>
      <div
        className={`max-w-[80%] rounded-lg px-3 py-2 font-body-md text-sm ${
          role === 'user'
            ? 'glass-tinted text-text-primary'
            : 'glass-frosted text-text-secondary'
        }`}
      >
        {content}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Studio Page                                                   */
/* ------------------------------------------------------------------ */

export default function Studio() {
  /* -- Pipeline store (REAL session data) -- */
  const { stages, setStageStatus } = usePipelineStore();
  const sessionId = usePipelineStore((s) => s.sessionId);
  const hasActivePRD = usePipelineStore((s) => s.hasActivePRD);

  /* -- WebSocket logs (REAL data from backend) -- */
  const wsLogs = useWebSocketStore((s) => s.logs);
  const wsIsRunning = useWebSocketStore((s) => s.isRunning);
  const wsProgress = useWebSocketStore((s) => s.progress);
  const wsCurrentStage = useWebSocketStore((s) => s.currentStage);

  /* -- Local state -- */
  const [selectedStage, setSelectedStage] = useState<number>(0);
  const [steeringMode, setSteeringMode] = useState<SteeringMode>('context');
  const [runState, setRunState] = useState<PipelineRunState>('idle');
  const [autoScroll, setAutoScroll] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [steeringText, setSteeringText] = useState('');
  const [showModifyArea, setShowModifyArea] = useState(false);
  const [showReplaceArea, setShowReplaceArea] = useState(false);
  const [copied, setCopied] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  /* -- Refs -- */
  const terminalRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* -- Detect live mode + connect WebSocket -- */
  useEffect(() => {
    if (sessionId && !sessionId.startsWith('local-')) {
      useWebSocketStore.getState().connect(sessionId);
    }
    return () => {
      useWebSocketStore.getState().disconnect();
    };
  }, [sessionId]);

  /* -- Display: always use real WebSocket data -- */
  const displayLogs = wsLogs;
  const displayIsRunning = wsIsRunning;
  const displayIsPaused = false;
  const displayProgress = wsProgress;
  const displayCurrentStage = wsCurrentStage ?? 0;

  /* -- Auto-scroll terminal -- */
  useEffect(() => {
    if (autoScroll && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [displayLogs, autoScroll]);

  /* -- Elapsed timer -- */
  useEffect(() => {
    if (displayIsRunning) {
      timerRef.current = setInterval(() => {
        setElapsed((e) => e + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [displayIsRunning]);

  /* -- Sync run state -- */
  useEffect(() => {
    if (displayIsRunning) setRunState('running');
    else setRunState('idle');
  }, [displayIsRunning]);

  /* -- Update stage status from real or mock pipeline -- */
  useEffect(() => {
    stages.forEach((s) => {
      if (s.id < displayCurrentStage) {
        setStageStatus(s.id, 'completed', 100);
      } else if (s.id === displayCurrentStage && displayIsRunning) {
        setStageStatus(s.id, 'running', displayProgress);
      }
    });
  }, [displayCurrentStage, displayIsRunning, displayProgress, stages.length]);

  /* -- Handlers -- */
  const handleRun = useCallback(() => {
    setElapsed(0);
    setRunState('running');
  }, []);

  const handlePause = useCallback(() => {
    setRunState('paused');
  }, []);

  const handleResume = useCallback(() => {
    setRunState('running');
  }, []);

  const handleStop = useCallback(() => {
    setRunState('stopped');
  }, []);

  const handleCopy = useCallback(() => {
    const text = displayLogs.map((l) => `[${l.timestamp}] [S${l.stageId}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [displayLogs]);

  const handleSendChat = useCallback(() => {
    if (!chatInput.trim()) return;
    setChatMessages((prev) => [...prev, { role: 'user', content: chatInput.trim() }]);
    setChatInput('');
    setTimeout(() => {
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Acknowledged. Processing your input for Stage ${displayCurrentStage}: ${STAGE_NAMES[displayCurrentStage]}. I'll incorporate this into the pipeline execution.`,
        },
      ]);
    }, 600);
  }, [chatInput, displayCurrentStage]);

  const handleSendSteering = useCallback(() => {
    if (!steeringText.trim()) return;
    setSteeringText('');
    setShowModifyArea(false);
    setShowReplaceArea(false);
    setSteeringMode('context');
  }, [steeringText]);

  const formatElapsed = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  /* -- Derived state -- */
  const overallStatus: StatusType =
    runState === 'running'
      ? 'running'
      : runState === 'paused'
      ? 'paused'
      : runState === 'stopped'
      ? 'failed'
      : displayCurrentStage > 0 && displayCurrentStage >= 7
      ? 'completed'
      : 'idle';

  return (
    <div className="flex flex-col h-full gap-4 p-6 overflow-hidden">
      {/* ========== PAGE HEADER ========== */}
      <motion.div
        className="flex-shrink-0 flex items-center justify-between h-14"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0, 0, 0.2, 1] as [number, number, number, number] }}
      >
        <div className="flex items-center gap-3">
          <h1 className="font-display-md text-text-primary">Pipeline Studio</h1>
          {displayIsRunning && (
            <span className="font-body-md text-text-secondary">
              — {STAGE_NAMES[displayCurrentStage]}
            </span>
          )}
          {/* Live / Mock mode indicator */}
          <span
            className="font-mono-sm px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider"
            style={{
              background: 'rgba(57,255,20,0.1)',
              color: '#39FF14',
              border: '1px solid rgba(57,255,20,0.2)',
            }}
          >
            ● Live
          </span>
          {sessionId && (
            <span className="font-mono-sm text-text-tertiary text-[10px]">
              Session: {sessionId.slice(0, 8)}...
            </span>
          )}
        </div>

        <motion.div
          className="flex items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.2 }}
        >
          <GlassButton
            variant="primary"
            icon={<Play className="w-4 h-4" />}
            onClick={runState === 'paused' ? handleResume : handleRun}
            disabled={displayIsRunning}
            size="sm"
          >
            {runState === 'paused' ? 'Resume' : 'Start'}
          </GlassButton>

          <GlassButton
            variant="secondary"
            icon={<Pause className="w-4 h-4" />}
            onClick={handlePause}
            disabled={!displayIsRunning}
            size="sm"
          >
            Pause
          </GlassButton>

          <GlassButton
            variant="ghost"
            icon={<Square className="w-4 h-4" />}
            onClick={handleStop}
            disabled={runState === 'idle'}
            size="sm"
            className="hover:text-[#FF3366] hover:border-[rgba(255,51,102,0.3)]"
          >
            Stop
          </GlassButton>
        </motion.div>
      </motion.div>

      {/* ========== MAIN 3-PANEL LAYOUT ========== */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* ----- LEFT: Pipeline Stage Graph (25%) ----- */}
        <motion.div
          className="w-1/4 min-w-[240px] max-w-[320px] flex flex-col"
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{
            duration: 0.4,
            ease: [0.175, 0.885, 0.32, 1.275] as [number, number, number, number],
          }}
        >
          <GlassCard variant="clear" padding="md" className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <h2 className="font-heading-sm text-text-primary mb-3 flex-shrink-0">Pipeline Graph</h2>
            <div className="flex-1 overflow-y-auto scrollbar-thin space-y-1 pr-1">
              {stages.map((stage) => (
                <div key={stage.id} className="relative">
                  {/* Vertical connector line */}
                  {stage.id > 0 && (
                    <div
                      className="absolute left-[22px] -top-1 w-[2px] h-3"
                      style={{
                        backgroundColor:
                          stage.id <= displayCurrentStage
                            ? stage.id === displayCurrentStage
                              ? '#00F5FF'
                              : '#39FF14'
                            : '#0F2847',
                      }}
                    />
                  )}
                  <VerticalStageNode
                    stageId={stage.id}
                    name={stage.name}
                    status={stage.status}
                    isActive={stage.id === displayCurrentStage && displayIsRunning}
                    isSelected={selectedStage === stage.id}
                    progress={stage.progress}
                    onClick={() => setSelectedStage(stage.id)}
                  />
                </div>
              ))}
            </div>
          </GlassCard>
        </motion.div>

        {/* ----- CENTER: Streaming Terminal (50%) ----- */}
        <motion.div
          className="flex-1 flex flex-col min-w-0 min-h-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <GlassCard variant="frosted" padding="none" className="flex-1 flex flex-col min-h-0 overflow-hidden" animated={false}>
            {/* Terminal header */}
            <div className="flex-shrink-0 h-10 flex items-center justify-between px-4 border-b border-[rgba(138,180,230,0.08)]">
              <div className="flex items-center gap-2">
                <span className="font-heading-sm text-text-primary text-sm">Live Terminal</span>
                {displayIsRunning && (
                  <motion.span
                    className="w-2 h-2 rounded-full bg-[#00F5FF]"
                    animate={{
                      boxShadow: [
                        '0 0 4px rgba(0,245,255,0.4)',
                        '0 0 12px rgba(0,245,255,0.8)',
                        '0 0 4px rgba(0,245,255,0.4)',
                      ],
                    }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  />
                )}
              </div>

              <div className="flex items-center gap-1">
                {/* Interrupt button */}
                {displayIsRunning && (
                  <motion.button
                    className="flex items-center gap-1 px-3 py-1 rounded-md text-xs font-heading-sm bg-[rgba(255,51,102,0.15)] text-[#FF3366] border border-[rgba(255,51,102,0.3)] hover:bg-[rgba(255,51,102,0.25)] transition-all"
                    onClick={handleStop}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    title="Interrupt pipeline"
                  >
                    <motion.span
                      animate={{
                        boxShadow: [
                          '0 0 4px rgba(255,51,102,0.3)',
                          '0 0 12px rgba(255,51,102,0.6)',
                          '0 0 4px rgba(255,51,102,0.3)',
                        ],
                      }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="w-1.5 h-1.5 rounded-full bg-[#FF3366] inline-block"
                    />
                    Interrupt
                  </motion.button>
                )}

                <GlassButton
                  variant="ghost"
                  size="sm"
                  icon={copied ? <CheckCheck className="w-3.5 h-3.5 text-[#39FF14]" /> : <Copy className="w-3.5 h-3.5" />}
                  onClick={handleCopy}
                  className="text-xs px-2 py-1"
                  title="Copy all logs"
                >
                  {copied ? 'Copied' : 'Copy'}
                </GlassButton>

                <GlassButton
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 className="w-3.5 h-3.5" />}
                  onClick={() => useWebSocketStore.getState().clearLogs()}
                  className="text-xs px-2 py-1"
                  title="Clear terminal"
                >
                  Clear
                </GlassButton>

                <GlassButton
                  variant="ghost"
                  size="sm"
                  icon={
                    autoScroll ? (
                      <Lock className="w-3.5 h-3.5 text-[#00F5FF]" />
                    ) : (
                      <Unlock className="w-3.5 h-3.5" />
                    )
                  }
                  onClick={() => setAutoScroll(!autoScroll)}
                  className="text-xs px-2 py-1"
                  title="Toggle auto-scroll"
                >
                  {autoScroll ? 'Lock' : 'Unlock'}
                </GlassButton>

                <GlassButton
                  variant="ghost"
                  size="sm"
                  icon={displayIsPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                  onClick={displayIsPaused ? handleResume : handlePause}
                  disabled={runState === 'idle'}
                  className="text-xs px-2 py-1"
                  title={displayIsPaused ? 'Resume' : 'Pause'}
                >
                  {displayIsPaused ? 'Resume' : 'Pause'}
                </GlassButton>
              </div>
            </div>

            {/* Terminal content */}
            <div
              ref={terminalRef}
              className="scrollbar-terminal p-3 space-y-0.5 flex-1 min-h-0"
              style={{
                overflowY: 'scroll',
                overflowX: 'hidden',
              }}
            >
              {displayLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Terminal className="w-8 h-8 text-[#4A6487] mb-2" />
                  <p className="font-body-md text-text-tertiary">
                    {hasActivePRD ? 'Pipeline initialized — waiting for data...' : 'Submit a PRD on the Dashboard first'}
                  </p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {displayLogs.map((log) => (
                    <TerminalLogLine
                      key={log.id}
                      log={log}
                      stageColor={STAGE_COLORS[log.stageId] || '#00F5FF'}
                    />
                  ))}
                </AnimatePresence>
              )}

              {/* Typing cursor when running */}
              {displayIsRunning && (
                <motion.span
                  className="inline-block w-2 h-4 bg-[#00F5FF] ml-2 align-middle"
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                />
              )}
            </div>
          </GlassCard>
        </motion.div>

        {/* ----- RIGHT: Steering Sidebar (25%) ----- */}
        <motion.div
          className="w-1/4 min-w-[260px] max-w-[360px] flex flex-col"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{
            duration: 0.4,
            ease: [0.175, 0.885, 0.32, 1.275] as [number, number, number, number],
          }}
        >
          <GlassCard
            variant="tinted"
            padding="md"
            className="flex-1 flex flex-col min-h-0 overflow-hidden"
          >
            {/* Steering header */}
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#00F5FF]" />
                <span className="font-heading-sm text-text-primary text-sm">Steering</span>
              </div>
              <div className="flex items-center gap-1">
                {/* Mode toggles */}
                <button
                  onClick={() => setSteeringMode('context')}
                  className={`px-2 py-0.5 rounded text-[10px] font-heading-sm transition-all ${
                    steeringMode === 'context'
                      ? 'bg-[rgba(0,245,255,0.15)] text-[#00F5FF]'
                      : 'text-text-tertiary hover:text-text-secondary'
                  }`}
                >
                  Context
                </button>
                <button
                  onClick={() => setSteeringMode('input')}
                  className={`px-2 py-0.5 rounded text-[10px] font-heading-sm transition-all ${
                    steeringMode === 'input'
                      ? 'bg-[rgba(255,184,0,0.15)] text-[#FFB800]'
                      : 'text-text-tertiary hover:text-text-secondary'
                  }`}
                >
                  Input
                </button>
                <button
                  onClick={() => setSteeringMode('review')}
                  className={`px-2 py-0.5 rounded text-[10px] font-heading-sm transition-all ${
                    steeringMode === 'review'
                      ? 'bg-[rgba(57,255,20,0.15)] text-[#39FF14]'
                      : 'text-text-tertiary hover:text-text-secondary'
                  }`}
                >
                  Review
                </button>
              </div>
            </div>

            {/* Steering content */}
            <div className="flex-1 overflow-y-auto scrollbar-thin space-y-3 min-h-0">
              <AnimatePresence mode="wait">
                {/* ---- MODE: Context ---- */}
                {steeringMode === 'context' && (
                  <motion.div
                    key="context"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-3"
                  >
                    {/* Current stage card */}
                    <div className="glass-bordered rounded-lg p-3">
                      <span className="font-body-sm text-text-tertiary block mb-1">Current Stage</span>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-heading-md text-text-primary text-base">
                          {STAGE_NAMES[displayCurrentStage]}
                        </span>
                        <StatusBadge
                          status={overallStatus}
                          size="sm"
                        />
                      </div>
                      <p className="font-body-sm text-text-secondary text-xs">
                        {STAGE_DESCRIPTIONS[displayCurrentStage]}
                      </p>
                      <div className="mt-2 font-mono-sm text-text-tertiary text-xs">
                        Stage {displayCurrentStage} of 8
                      </div>
                    </div>

                    {/* Progress mini-bar */}
                    <div className="glass-frosted rounded-lg p-3">
                      <span className="font-body-sm text-text-tertiary block mb-2">Progress</span>
                      <div className="flex gap-1">
                        {stages.map((s) => (
                          <div
                            key={s.id}
                            className="flex-1 h-2 rounded-full overflow-hidden"
                            style={{ backgroundColor: '#0F2847' }}
                          >
                            <motion.div
                              className="h-full rounded-full"
                              style={{
                                backgroundColor:
                                  s.id < displayCurrentStage
                                    ? '#39FF14'
                                    : s.id === displayCurrentStage
                                    ? '#00F5FF'
                                    : 'transparent',
                              }}
                              initial={false}
                              animate={{
                                opacity: s.id === displayCurrentStage ? [0.6, 1, 0.6] : 1,
                              }}
                              transition={
                                s.id === displayCurrentStage
                                  ? { duration: 1.5, repeat: Infinity }
                                  : undefined
                              }
                            />
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 font-mono-sm text-text-glow text-xs">
                        {displayProgress}%
                      </div>
                    </div>

                    {/* Status info */}
                    <div className="glass-clear rounded-lg p-3 space-y-2">
                      <div className="flex justify-between">
                        <span className="font-body-sm text-text-tertiary text-xs">Status</span>
                        <StatusBadge status={overallStatus} size="sm" />
                      </div>
                      <div className="flex justify-between">
                        <span className="font-body-sm text-text-tertiary text-xs">Elapsed</span>
                        <span className="font-mono-sm text-text-primary text-xs">
                          {formatElapsed(elapsed)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-body-sm text-text-tertiary text-xs">Log Lines</span>
                        <span className="font-mono-sm text-text-primary text-xs">{displayLogs.length}</span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ---- MODE: Input (Steering Required) ---- */}
                {steeringMode === 'input' && (
                  <motion.div
                    key="input"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-3"
                  >
                    {/* Alert card */}
                    <div className="glass-bordered rounded-lg p-3 border-[rgba(255,184,0,0.4)]">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-5 h-5 text-[#FFB800]" />
                        <span className="font-heading-md text-[#FFB800] text-sm">
                          Input needed at Stage {displayCurrentStage}
                        </span>
                      </div>
                      <p className="font-body-md text-text-primary text-xs mb-2">
                        The system detected ambiguity in {STAGE_NAMES[displayCurrentStage].toLowerCase()}.
                        Your guidance will help resolve the uncertainty.
                      </p>
                      <div className="font-mono-sm text-[#FFB800] text-xs">
                        System confidence: 45%
                      </div>
                    </div>

                    {/* Context */}
                    <div className="glass-frosted rounded-lg p-3">
                      <span className="font-body-sm text-text-tertiary block mb-1 text-xs">Context</span>
                      <div className="font-mono-sm text-text-secondary text-[10px] space-y-0.5 max-h-24 overflow-y-auto scrollbar-thin">
                        <p>&gt; Processing {STAGE_NAMES[displayCurrentStage].toLowerCase()}...</p>
                        <p>&gt; Ambiguity detected in node_data</p>
                        <p>&gt; Awaiting human input</p>
                      </div>
                    </div>

                    {/* Suggestion chips */}
                    <div className="flex flex-wrap gap-1">
                      {['Accept all', 'Refine selection', 'Skip for now'].map((s) => (
                        <button
                          key={s}
                          className="px-2 py-1 rounded-full text-[10px] glass-bordered font-body-sm text-text-secondary hover:text-text-primary hover:border-[rgba(0,245,255,0.4)] transition-all"
                        >
                          {s}
                        </button>
                      ))}
                    </div>

                    {/* Input area */}
                    <textarea
                      value={steeringText}
                      onChange={(e) => setSteeringText(e.target.value)}
                      placeholder="Enter your guidance, clarification, or decision..."
                      className="w-full bg-[rgba(10,22,40,0.5)] backdrop-blur-sm border border-[rgba(138,180,230,0.1)] rounded-lg text-text-primary p-3 font-body-md text-xs resize-none focus:outline-none focus:border-[rgba(0,245,255,0.5)] focus:shadow-[0_0_12px_rgba(0,245,255,0.1)] placeholder:text-[rgba(138,180,230,0.4)] transition-all"
                      rows={3}
                    />

                    {/* Action buttons */}
                    <div className="space-y-2">
                      <GlassButton
                        variant="primary"
                        icon={<Send className="w-3.5 h-3.5" />}
                        onClick={handleSendSteering}
                        fullWidth
                        size="sm"
                      >
                        Send Steering Input
                      </GlassButton>
                      <div className="flex gap-2">
                        <GlassButton
                          variant="secondary"
                          onClick={() => {
                            setShowModifyArea(!showModifyArea);
                            setShowReplaceArea(false);
                          }}
                          size="sm"
                          className="flex-1"
                        >
                          Modify
                        </GlassButton>
                        <GlassButton
                          variant="ghost"
                          onClick={() => {
                            setShowReplaceArea(!showReplaceArea);
                            setShowModifyArea(false);
                          }}
                          size="sm"
                          className="flex-1 text-[#FF3366] hover:text-[#FF3366]"
                        >
                          Replace
                        </GlassButton>
                      </div>
                      <GlassButton
                        variant="ghost"
                        onClick={() => setSteeringMode('context')}
                        fullWidth
                        size="sm"
                      >
                        Skip &amp; Continue
                      </GlassButton>
                    </div>

                    {/* Modify area */}
                    <AnimatePresence>
                      {showModifyArea && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden"
                        >
                          <div className="glass-bordered border-[rgba(255,184,0,0.3)] rounded-lg p-3">
                            <span className="font-body-sm text-[#FFB800] block mb-1 text-xs">Modify</span>
                            <textarea
                              placeholder="Enter your modifications..."
                              className="w-full bg-[rgba(10,22,40,0.5)] border border-[rgba(255,184,0,0.2)] rounded-lg text-text-primary p-2 font-body-md text-xs resize-none focus:outline-none focus:border-[rgba(255,184,0,0.5)] placeholder:text-[rgba(138,180,230,0.4)] transition-all"
                              rows={3}
                            />
                            <GlassButton
                              variant="secondary"
                              size="sm"
                              className="mt-2 w-full"
                              onClick={() => setShowModifyArea(false)}
                            >
                              Apply Modification
                            </GlassButton>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Replace area */}
                    <AnimatePresence>
                      {showReplaceArea && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden"
                        >
                          <div className="glass-bordered border-[rgba(255,51,102,0.3)] rounded-lg p-3">
                            <span className="font-body-sm text-[#FF3366] block mb-1 text-xs">Replace</span>
                            <textarea
                              placeholder="Enter replacement content..."
                              className="w-full bg-[rgba(10,22,40,0.5)] border border-[rgba(255,51,102,0.2)] rounded-lg text-text-primary p-2 font-body-md text-xs resize-none focus:outline-none focus:border-[rgba(255,51,102,0.5)] placeholder:text-[rgba(138,180,230,0.4)] transition-all"
                              rows={3}
                            />
                            <GlassButton
                              variant="ghost"
                              size="sm"
                              className="mt-2 w-full text-[#FF3366] hover:text-[#FF3366]"
                              onClick={() => setShowReplaceArea(false)}
                            >
                              Apply Replacement
                            </GlassButton>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}

                {/* ---- MODE: Review ---- */}
                {steeringMode === 'review' && (
                  <motion.div
                    key="review"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-3"
                  >
                    {/* Summary card */}
                    <div className="glass-frosted rounded-lg p-3 border-t-2 border-t-[#39FF14]">
                      <div className="flex items-center gap-2 mb-2">
                        <Check className="w-5 h-5 text-[#39FF14]" />
                        <span className="font-heading-md text-[#39FF14] text-sm">
                          Stage {displayCurrentStage} Complete
                        </span>
                      </div>
                      <p className="font-body-md text-text-primary text-xs mb-2">
                        {STAGE_NAMES[displayCurrentStage]} completed successfully.
                      </p>
                      <div className="font-mono-sm text-text-secondary text-xs">
                        Generated outputs ready for review.
                      </div>
                    </div>

                    {/* Accept button */}
                    <GlassButton
                      variant="primary"
                      icon={<Check className="w-4 h-4" />}
                      fullWidth
                      size="sm"
                      onClick={() => setSteeringMode('context')}
                    >
                      Approve &amp; Continue
                    </GlassButton>

                    <div className="flex gap-2">
                      <GlassButton
                        variant="secondary"
                        icon={<Zap className="w-3.5 h-3.5" />}
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setSteeringMode('input');
                          setShowModifyArea(true);
                        }}
                      >
                        Edit
                      </GlassButton>
                      <GlassButton
                        variant="ghost"
                        icon={<X className="w-3.5 h-3.5" />}
                        size="sm"
                        className="flex-1 text-[#FF3366] hover:text-[#FF3366]"
                        onClick={handleRun}
                      >
                        Retry
                      </GlassButton>
                    </div>

                    <GlassButton
                      variant="ghost"
                      icon={<MessageSquare className="w-3.5 h-3.5" />}
                      fullWidth
                      size="sm"
                      onClick={() => setShowChat(true)}
                    >
                      Add Comment
                    </GlassButton>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Chat section */}
              {showChat && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="border-t border-[rgba(138,180,230,0.08)] pt-3 mt-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-heading-sm text-text-primary text-xs">Chat</span>
                    <button
                      onClick={() => setShowChat(false)}
                      className="text-text-tertiary hover:text-text-primary transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-2 max-h-40 overflow-y-auto scrollbar-thin pr-1">
                    {chatMessages.map((msg, i) => (
                      <ChatMessage key={i} role={msg.role} content={msg.content} />
                    ))}
                  </div>

                  <div className="flex gap-2 mt-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                      placeholder="Type a message..."
                      className="flex-1 bg-[rgba(10,22,40,0.5)] border border-[rgba(138,180,230,0.1)] rounded-md text-text-primary px-2 py-1.5 font-body-md text-xs focus:outline-none focus:border-[rgba(0,245,255,0.5)] placeholder:text-[rgba(138,180,230,0.4)] transition-all"
                    />
                    <GlassButton
                      variant="primary"
                      size="sm"
                      icon={<Send className="w-3 h-3" />}
                      onClick={handleSendChat}
                    >
                      <span className="sr-only">Send</span>
                    </GlassButton>
                  </div>
                </motion.div>
              )}

              {/* Chat toggle button (when chat is hidden) */}
              {!showChat && (
                <GlassButton
                  variant="ghost"
                  size="sm"
                  icon={<MessageSquare className="w-3.5 h-3.5" />}
                  onClick={() => setShowChat(true)}
                  fullWidth
                  className="mt-1"
                >
                  Open Chat
                </GlassButton>
              )}
            </div>
          </GlassCard>
        </motion.div>
      </div>

      {/* ========== BOTTOM RUN CONTROLS BAR ========== */}
      <motion.div
        className="flex-shrink-0 h-14 glass-elevated rounded-lg flex items-center px-4 gap-6"
        style={{ borderTop: 'var(--border-glow)' }}
        initial={{ opacity: 0, y: 56 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.3,
          ease: [0.175, 0.885, 0.32, 1.275] as [number, number, number, number],
        }}
      >
        {/* Status */}
        <div className="flex items-center gap-2">
          <StatusBadge status={overallStatus} size="md" />
        </div>

        {/* Progress percentage */}
        <div className="flex items-center gap-1">
          <motion.span
            className="font-mono-lg text-text-glow"
            key={displayProgress}
            initial={{ opacity: 0.5, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            {displayProgress}%
          </motion.span>
        </div>

        {/* Stage counter */}
        <div className="flex flex-col">
          <span className="font-body-sm text-text-secondary text-xs">
            Stage {Math.min(displayCurrentStage + 1, 8)} of 8
          </span>
          <span className="font-mono-sm text-text-tertiary text-[10px]">
            {STAGE_NAMES[displayCurrentStage]}
          </span>
        </div>

        {/* Elapsed timer */}
        <div className="flex items-center gap-2">
          <span className="font-mono-sm text-text-tertiary text-xs">Elapsed</span>
          <motion.span
            className="font-mono-md text-text-primary text-sm tabular-nums"
            animate={{ opacity: displayIsRunning ? [1, 0.7, 1] : 1 }}
            transition={displayIsRunning ? { duration: 1, repeat: Infinity } : undefined}
          >
            {formatElapsed(elapsed)}
          </motion.span>
        </div>

        {/* Separator */}
        <div className="flex-1" />

        {/* Bottom controls */}
        <div className="flex items-center gap-2">
          <GlassButton
            variant="ghost"
            size="sm"
            icon={<Terminal className="w-3.5 h-3.5" />}
            className="text-xs"
          >
            Logs
          </GlassButton>

          {/* Mini play/pause/stop in bottom bar */}
          <div className="flex items-center gap-1 border-l border-[rgba(138,180,230,0.08)] pl-2 ml-1">
            {runState !== 'running' ? (
              <GlassButton
                variant="primary"
                size="sm"
                icon={<Play className="w-3.5 h-3.5" />}
                onClick={runState === 'paused' ? handleResume : handleRun}
                className="px-2 py-1"
              >
                <span className="sr-only">Start</span>
              </GlassButton>
            ) : (
              <GlassButton
                variant="secondary"
                size="sm"
                icon={<Pause className="w-3.5 h-3.5" />}
                onClick={handlePause}
                className="px-2 py-1"
              >
                <span className="sr-only">Pause</span>
              </GlassButton>
            )}
            <GlassButton
              variant="ghost"
              size="sm"
              icon={<Square className="w-3.5 h-3.5" />}
              onClick={handleStop}
              disabled={runState === 'idle'}
              className="px-2 py-1 hover:text-[#FF3366]"
            >
              <span className="sr-only">Stop</span>
            </GlassButton>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
