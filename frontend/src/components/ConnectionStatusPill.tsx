import { motion } from 'framer-motion';
import { useWebSocketStore } from '@/store/useWebSocketStore';

interface ConnectionStatusPillProps {
  size?: 'sm' | 'md' | 'lg';
}

export default function ConnectionStatusPill({ size = 'sm' }: ConnectionStatusPillProps) {
  const status = useWebSocketStore((s) => s.status);

  const config = {
    connected: {
      dotColor: '#39FF14',
      label: 'Live',
      bgClass: 'bg-[rgba(57,255,20,0.1)]',
      borderClass: 'border-[rgba(57,255,20,0.3)]',
      textClass: 'text-[#39FF14]',
      pulse: true,
    },
    connecting: {
      dotColor: '#FFB800',
      label: 'Connecting...',
      bgClass: 'bg-[rgba(255,184,0,0.1)]',
      borderClass: 'border-[rgba(255,184,0,0.3)]',
      textClass: 'text-[#FFB800]',
      pulse: true,
    },
    disconnected: {
      dotColor: '#FF3366',
      label: 'Offline',
      bgClass: 'bg-[rgba(255,51,102,0.1)]',
      borderClass: 'border-[rgba(255,51,102,0.3)]',
      textClass: 'text-[#FF3366]',
      pulse: false,
    },
  };

  const c = config[status];

  const sizeClasses = {
    sm: 'px-2.5 py-1 text-xs gap-1.5',
    md: 'px-3 py-1.5 text-sm gap-2',
    lg: 'px-4 py-2 text-base gap-2.5',
  };

  const dotSize = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5',
  };

  return (
    <div
      className={`inline-flex items-center rounded-full border ${c.bgClass} ${c.borderClass} ${c.textClass} ${sizeClasses[size]}`}
    >
      <span className="relative flex">
        <span
          className={`${dotSize[size]} rounded-full`}
          style={{ backgroundColor: c.dotColor }}
        />
        {c.pulse && (
          <motion.span
            className={`${dotSize[size]} rounded-full absolute top-0 left-0`}
            style={{ backgroundColor: c.dotColor }}
            animate={{
              scale: [1, 1.8, 1],
              opacity: [0.8, 0, 0.8],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}
      </span>
      <span className="font-mono-sm whitespace-nowrap">{c.label}</span>
    </div>
  );
}
