import { motion } from 'framer-motion';

export type StatusType = 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'needs-input';

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

const statusConfig: Record<StatusType, { color: string; dotClass: string; label: string; pulse: boolean }> = {
  idle: {
    color: '#4A6487',
    dotClass: 'bg-[#4A6487]',
    label: 'Idle',
    pulse: false,
  },
  running: {
    color: '#00F5FF',
    dotClass: 'bg-[#00F5FF]',
    label: 'Running',
    pulse: true,
  },
  paused: {
    color: '#FFB800',
    dotClass: 'bg-[#FFB800]',
    label: 'Paused',
    pulse: true,
  },
  completed: {
    color: '#39FF14',
    dotClass: 'bg-[#39FF14]',
    label: 'Completed',
    pulse: false,
  },
  failed: {
    color: '#FF3366',
    dotClass: 'bg-[#FF3366]',
    label: 'Failed',
    pulse: true,
  },
  'needs-input': {
    color: '#00F5FF',
    dotClass: 'bg-[#00F5FF]',
    label: 'Needs Input',
    pulse: true,
  },
};

export default function StatusBadge({ status, label, showLabel = true, size = 'md' }: StatusBadgeProps) {
  const config = statusConfig[status];
  const displayLabel = label || config.label;
  const dotSize = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';

  return (
    <div className="inline-flex items-center gap-2">
      <span className="relative flex">
        <span className={`${config.dotClass} ${dotSize} rounded-full inline-block`} />
        {config.pulse && (
          <motion.span
            className={`${config.dotClass} ${dotSize} rounded-full inline-block absolute top-0 left-0`}
            animate={{
              boxShadow: [
                `0 0 4px ${config.color}40`,
                `0 0 12px ${config.color}80`,
                `0 0 4px ${config.color}40`,
              ],
            }}
            transition={{
              duration: status === 'failed' ? 1 : status === 'paused' ? 3 : 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}
      </span>
      {showLabel && (
        <span
          className={size === 'sm' ? 'font-body-sm' : 'font-body-md'}
          style={{ color: config.color }}
        >
          {displayLabel}
        </span>
      )}
    </div>
  );
}
