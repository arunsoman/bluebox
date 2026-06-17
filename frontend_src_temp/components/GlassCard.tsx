import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

export interface GlassCardProps {
  variant?: 'clear' | 'frosted' | 'tinted' | 'elevated' | 'bordered';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  radius?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  glow?: 'none' | 'subtle' | 'strong' | 'cyan' | 'violet';
  hover?: boolean;
  animated?: boolean;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}

const variantClasses: Record<string, string> = {
  clear: 'glass-clear',
  frosted: 'glass-frosted',
  tinted: 'glass-tinted',
  elevated: 'glass-elevated',
  bordered: 'glass-bordered',
};

const paddingClasses: Record<string, string> = {
  none: 'p-0',
  sm: 'p-space-sm',
  md: 'p-space-md',
  lg: 'p-space-lg',
};

const radiusClasses: Record<string, string> = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  full: 'rounded-full',
};

const glowClasses: Record<string, string> = {
  none: '',
  subtle: 'shadow-glow-cyan',
  strong: 'shadow-glow-cyan-strong',
  cyan: 'shadow-glow-cyan',
  violet: 'shadow-glow-violet',
};

export default function GlassCard({
  variant = 'clear',
  padding = 'md',
  radius = 'md',
  glow = 'none',
  hover = true,
  animated = true,
  children,
  className = '',
  onClick,
  style,
}: GlassCardProps) {
  const classes = [
    variantClasses[variant] || variantClasses.clear,
    paddingClasses[padding] || paddingClasses.md,
    radiusClasses[radius] || radiusClasses.md,
    glowClasses[glow] || '',
    hover ? 'cursor-default' : '',
    className,
  ].join(' ');

  const card = (
    <div
      className={classes}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={style}
    >
      {children}
    </div>
  );

  if (animated) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.175, 0.885, 0.32, 1.275] as [number, number, number, number] }}
      >
        {card}
      </motion.div>
    );
  }

  return card;
}
