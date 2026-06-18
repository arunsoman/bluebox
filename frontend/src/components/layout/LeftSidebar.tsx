// =============================================================================
// LeftSidebar — Persistent left sidebar (280px fixed)
// Contains: PipelineProgress, QuickNavigation, Chat toggle
// =============================================================================

import { MessageSquare } from 'lucide-react';
import PipelineProgress from './PipelineProgress';
import QuickNavigation from './QuickNavigation';
import { useChatStore } from '@/stores/chatStore';

export default function LeftSidebar() {
  const toggleChat = useChatStore((s) => s.toggleChat);

  return (
    <aside className="flex h-full w-[280px] flex-col border-r border-slate-700 bg-slate-900">
      <PipelineProgress />

      <div className="my-1 border-t border-slate-800" />

      <QuickNavigation />

      <div className="mt-auto border-t border-slate-800 p-3">
        <button
          onClick={toggleChat}
          className="flex w-full items-center gap-2 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Context Agent
        </button>
      </div>
    </aside>
  );
}
