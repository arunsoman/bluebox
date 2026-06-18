// =============================================================================
// RightSidebar — Collapsible sidebar (320px) with 3D graph and mini audit trail
// Integrated: PipelineGraph3D (R3F Canvas) + MiniAuditTrail (last 5 events)
// =============================================================================

import { useState, lazy, Suspense } from 'react';
import { ChevronLeft, ChevronRight, Globe, ScrollText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const PipelineGraph3D = lazy(() => import('@/components/graph/PipelineGraph3D'));
const MiniAuditTrail = lazy(() => import('@/components/graph/MiniAuditTrail'));

function GraphFallback() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <Globe className="mx-auto mb-2 h-6 w-6 animate-pulse text-slate-600" />
        <p className="text-xs text-slate-600">Loading 3D Graph...</p>
      </div>
    </div>
  );
}

function AuditFallback() {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-xs text-slate-600">Loading audit trail...</p>
    </div>
  );
}

export default function RightSidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`flex h-full shrink-0 flex-col border-l border-slate-700 bg-slate-900 transition-all duration-300 ${collapsed ? 'w-8' : 'w-[320px]'}`}
    >
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex h-8 w-full items-center justify-center border-b border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white"
      >
        {collapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-1 flex-col overflow-hidden"
          >
            {/* 3D Pipeline Graph */}
            <div className="flex-1 border-b border-slate-800">
              <div className="flex h-7 items-center gap-1.5 border-b border-slate-800/50 px-3">
                <Globe className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Pipeline Graph
                </span>
              </div>
              <div className="h-[calc(100%-1.75rem)]">
                <Suspense fallback={<GraphFallback />}>
                  <PipelineGraph3D />
                </Suspense>
              </div>
            </div>

            {/* Mini Audit Trail */}
            <div className="h-1/3">
              <div className="flex h-7 items-center gap-1.5 border-b border-slate-800/50 px-3">
                <ScrollText className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Recent Events
                </span>
              </div>
              <div className="h-[calc(100%-1.75rem)]">
                <Suspense fallback={<AuditFallback />}>
                  <MiniAuditTrail />
                </Suspense>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
}
