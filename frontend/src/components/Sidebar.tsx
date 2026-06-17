import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Play,
  Network,
  GitBranch,
  MessageSquare,
  FileCode,
  ScrollText,
  ChevronLeft,
  ChevronRight,
  Settings,
} from 'lucide-react';
import LogoIcon from './icons/LogoIcon';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/studio', icon: Play, label: 'Pipeline Studio' },
  { to: '/explorer', icon: Network, label: 'Node Explorer' },
  { to: '/impact', icon: GitBranch, label: 'Impact Visualizer' },
  { to: '/chat', icon: MessageSquare, label: 'Chat' },
  { to: '/blueprint', icon: FileCode, label: 'Blueprint' },
  { to: '/audit', icon: ScrollText, label: 'Audit Trail' },
];

const bottomNavItems = [
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.aside
      className="relative z-40 flex flex-col h-screen glass-frosted border-r border-[rgba(138,180,230,0.08)] flex-shrink-0"
      style={{ width: collapsed ? 64 : 240 }}
      initial={false}
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
    >
      {/* Logo area */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-[rgba(138,180,230,0.08)] flex-shrink-0">
        <LogoIcon size={collapsed ? 36 : 32} />
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              className="font-orbitron text-sm font-bold text-text-primary whitespace-nowrap overflow-hidden"
            >
              Bluebox
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto scrollbar-thin">
        {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `relative flex items-center gap-3 rounded-md transition-all duration-200 group ${
                  isActive
                    ? 'glass-tinted text-text-glow border-l-[3px] border-l-[#00F5FF]'
                    : 'glass-clear text-text-secondary hover:text-text-primary hover:glass-tinted'
                } ${collapsed ? 'justify-center px-2 py-3' : 'px-4 py-2.5'}`
              }
            >
              <item.icon size={20} className="flex-shrink-0" />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    className="font-heading-sm text-sm whitespace-nowrap overflow-hidden"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
              {/* Tooltip for collapsed state */}
              {collapsed && (
                <div className="absolute left-full ml-2 px-2.5 py-1.5 glass-elevated rounded-md text-xs font-body-sm text-text-primary whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                  {item.label}
                </div>
              )}
            </NavLink>
        ))}
      </nav>

      {/* Bottom nav — Settings */}
      <div className="mt-auto flex-shrink-0">
        {bottomNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg transition-all duration-200 font-body-md ${
                isActive
                  ? 'text-[#00F5FF] glass-tinted border-l-[3px] border-l-[#00F5FF]'
                  : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.03]'
              }`
            }
          >
            <item.icon size={18} className="flex-shrink-0" />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="font-heading-sm text-sm whitespace-nowrap overflow-hidden"
                >
                  {item.label}
                </motion.span>
              )}
            </AnimatePresence>
            {collapsed && (
              <div className="absolute left-full ml-2 px-2.5 py-1.5 glass-elevated rounded-md text-xs font-body-sm text-text-primary whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                {item.label}
              </div>
            )}
          </NavLink>
        ))}
      </div>

      {/* Collapse toggle */}
      <div className="p-2 border-t border-[rgba(138,180,230,0.08)] flex-shrink-0">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center py-2 rounded-md glass-clear hover:glass-tinted text-text-secondary hover:text-text-primary transition-all duration-200"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>
    </motion.aside>
  );
}
