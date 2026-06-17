import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import ConnectionStatusPill from './ConnectionStatusPill';
import { usePipelineStore } from '@/store/usePipelineStore';

const routeTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/studio': 'Pipeline Studio',
  '/explorer': 'Node Explorer',
  '/impact': 'Impact Visualizer',
  '/chat': 'Chat',
  '/blueprint': 'Blueprint',
  '/audit': 'Audit Trail',
};

export default function TopBar() {
  const location = useLocation();
  const title = routeTitles[location.pathname] || 'Bluebox';
  const stages = usePipelineStore((s) => s.stages);

  return (
    <motion.header
      className="h-14 flex items-center justify-between px-6 glass-frosted border-b border-[rgba(138,180,230,0.08)] flex-shrink-0 z-30 sticky top-0"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0, 0, 0.2, 1] as [number, number, number, number] }}
    >
      {/* Left: page title */}
      <div className="flex items-center gap-3">
        <h1 className="font-display-md text-text-primary">{title}</h1>
        <span className="text-text-tertiary font-mono-sm">/ bluebox</span>
      </div>

      {/* Center: pipeline status dots */}
      <div className="hidden md:flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="font-body-sm text-text-tertiary mr-2">Pipeline</span>
          <div className="flex items-center gap-1">
            {stages.slice(0, 8).map((stage) => (
              <div key={stage.id} className="relative group cursor-pointer">
                <div
                  className={`w-3 h-3 rounded-full transition-all duration-200 ${
                    stage.status === 'completed'
                      ? 'bg-[#39FF14]'
                      : stage.status === 'running'
                      ? 'bg-[#00F5FF] animate-pulseGlow'
                      : stage.status === 'failed'
                      ? 'bg-[#FF3366]'
                      : stage.status === 'paused'
                      ? 'bg-[#FFB800]'
                      : 'bg-[#4A6487]'
                  }`}
                />
                {/* Tooltip */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 glass-elevated rounded-md text-xs font-mono-sm text-text-primary whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                  S{stage.id}: {stage.name}
                </div>
              </div>
            ))}
          </div>
        </div>
        <ConnectionStatusPill size="sm" />
      </div>

      {/* Right: status summary */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 text-text-tertiary font-body-sm">
          <span>Active: </span>
          <span className="font-mono-sm text-[#00F5FF]">
            {stages.filter((s) => s.status === 'running').length}
          </span>
          <span className="mx-1">|</span>
          <span>Done: </span>
          <span className="font-mono-sm text-[#39FF14]">
            {stages.filter((s) => s.status === 'completed').length}
          </span>
        </div>
      </div>
    </motion.header>
  );
}
