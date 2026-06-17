import { motion } from 'framer-motion';
import type { StatusType } from './StatusBadge';

export interface PipelineStageData {
  id: number;
  name: string;
  status: StatusType;
  description: string;
  progress?: number;
}

interface PipelineStageNodeProps {
  stage: PipelineStageData;
  index: number;
  showConnector?: boolean;
  connectorStatus?: 'idle' | 'active' | 'completed' | 'failed';
  onClick?: () => void;
}

const statusStyles: Record<StatusType, { bg: string; text: string; glow: string }> = {
  idle: { bg: 'glass-clear', text: 'text-text-tertiary', glow: '' },
  running: { bg: 'glass-tinted', text: 'text-text-glow', glow: 'shadow-glow-cyan' },
  paused: { bg: 'glass-frosted', text: 'text-[#FFB800]', glow: '' },
  completed: { bg: 'glass-frosted', text: 'text-[#39FF14]', glow: '' },
  failed: { bg: 'glass-bordered', text: 'text-[#FF3366]', glow: 'shadow-[0_0_16px_rgba(255,51,102,0.2)]' },
  'needs-input': { bg: 'glass-tinted', text: 'text-text-glow', glow: 'shadow-glow-cyan-strong' },
};

const connectorColors = {
  idle: '#0F2847',
  active: '#00F5FF',
  completed: '#39FF14',
  failed: '#FF3366',
};

export default function PipelineStageNode({
  stage,
  index,
  showConnector = true,
  connectorStatus = 'idle',
  onClick,
}: PipelineStageNodeProps) {
  const style = statusStyles[stage.status];

  return (
    <div className="flex items-center">
      {/* Connector line */}
      {showConnector && index > 0 && (
        <div className="relative w-8 md:w-12 h-0.5 flex-shrink-0 mr-1 md:mr-2">
          <div
            className="absolute inset-0 rounded-full"
            style={{ backgroundColor: connectorColors[connectorStatus], opacity: connectorStatus === 'idle' ? 1 : 0.3 }}
          />
          {connectorStatus === 'active' && (
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{
                background: 'linear-gradient(90deg, transparent, #00F5FF, transparent)',
              }}
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            />
          )}
        </div>
      )}

      {/* Stage node */}
      <motion.div
        className={`relative flex flex-col items-center cursor-pointer group`}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          duration: 0.3,
          delay: index * 0.06,
          ease: [0.34, 1.56, 0.64, 1] as [number, number, number, number],
        }}
        whileHover={{ scale: 1.1 }}
        onClick={onClick}
      >
        {/* Stage circle */}
        <div
          className={`w-14 h-14 md:w-20 md:h-14 rounded-full flex items-center justify-center ${style.bg} ${style.glow} transition-all duration-200 group-hover:shadow-glow-cyan-strong`}
        >
          <span className={`font-mono-lg ${style.text}`}>{stage.id}</span>
        </div>

        {/* Status dot */}
        <div className="absolute -bottom-0.5 -right-0.5">
          <div
            className={`w-3 h-3 rounded-full border-2 border-[#050A14] ${
              stage.status === 'running'
                ? 'bg-[#00F5FF]'
                : stage.status === 'completed'
                ? 'bg-[#39FF14]'
                : stage.status === 'failed'
                ? 'bg-[#FF3366]'
                : stage.status === 'paused'
                ? 'bg-[#FFB800]'
                : 'bg-[#4A6487]'
            }`}
          />
        </div>

        {/* Stage name */}
        <span className="mt-2 font-body-sm text-text-secondary text-center max-w-[70px] md:max-w-[90px] leading-tight hidden md:block">
          {stage.name}
        </span>

        {/* Mini progress bar */}
        {stage.status === 'running' && stage.progress !== undefined && (
          <div className="mt-1.5 w-12 h-0.5 bg-[#0F2847] rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-[#00F5FF] to-[#00D4E5] rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${stage.progress}%` }}
              transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
            />
          </div>
        )}
      </motion.div>
    </div>
  );
}
