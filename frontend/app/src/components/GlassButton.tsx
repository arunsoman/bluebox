import { motion } from 'framer-motion';
import type { ReactNode, MouseEventHandler } from 'react';

interface GlassButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost';
  children: ReactNode;
  icon?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  title?: string;
}

export default function GlassButton({
  variant = 'primary',
  children,
  icon,
  iconRight,
  fullWidth = false,
  size = 'md',
  className = '',
  onClick,
  disabled = false,
  type = 'button',
  title,
}: GlassButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center gap-2 font-heading-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#00F5FF] focus:ring-offset-2 focus:ring-offset-[#050A14] disabled:opacity-50 disabled:cursor-not-allowed';

  const variantClasses = {
    primary: 'bg-gradient-to-br from-[#00F5FF] to-[#00D4E5] text-[#050A14] rounded-md shadow-[0_0_20px_rgba(0,245,255,0.2)] hover:shadow-[0_0_30px_rgba(0,245,255,0.35)] hover:brightness-110 active:scale-[0.98]',
    secondary: 'bg-transparent border border-[rgba(0,245,255,0.3)] text-[#00F5FF] rounded-md hover:border-[rgba(0,245,255,0.5)] hover:bg-[rgba(0,245,255,0.05)] active:scale-[0.98]',
    ghost: 'bg-[rgba(10,22,40,0.3)] border border-[rgba(138,180,230,0.08)] text-[#8BA4C7] rounded-md hover:bg-[rgba(10,22,40,0.5)] hover:text-[#E8F0FE] hover:border-[rgba(138,180,230,0.15)] active:scale-[0.98]',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
  };

  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${widthClass} ${className}`}
      onClick={onClick}
      disabled={disabled}
      type={type}
      title={title}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span>{children}</span>
      {iconRight && <span className="flex-shrink-0 ml-auto">{iconRight}</span>}
    </motion.button>
  );
}
