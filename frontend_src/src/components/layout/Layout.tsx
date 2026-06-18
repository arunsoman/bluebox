// =============================================================================
// Layout — 3-column layout with Header, LeftSidebar, MainContent, RightSidebar
// =============================================================================

import { Outlet, useParams } from 'react-router';
import { useEffect } from 'react';
import Header from './Header';
import LeftSidebar from './LeftSidebar';
import RightSidebar from './RightSidebar';
import ChatPanel from './ChatPanel';
import { useEventRouter } from '@/hooks/useEventRouter';
import { sseManager } from '@/lib/sse';

export default function Layout() {
  const { sessionId } = useParams<{ sessionId: string }>();

  // Connect SSE when sessionId is present
  useEffect(() => {
    if (sessionId) {
      sseManager.connect(sessionId);
    }
    return () => {
      if (!sessionId) {
        sseManager.disconnect();
      }
    };
  }, [sessionId]);

  // Route all SSE events to stores
  useEventRouter(sessionId ?? null);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-slate-950">
      <Header />

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar — 280px fixed */}
        <LeftSidebar />

        {/* Main Content — flexible */}
        <main className="flex flex-1 flex-col overflow-hidden bg-slate-950">
          <Outlet />
        </main>

        {/* Right Sidebar — 320px collapsible */}
        <RightSidebar />
      </div>

      {/* Floating Chat Panel */}
      <ChatPanel />
    </div>
  );
}
