// =============================================================================
// App — Router setup with QueryClientProvider
// =============================================================================

import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Shield } from 'lucide-react';
import Layout from './components/layout/Layout';
import DashboardPage from './pages/DashboardPage';
import NewPipelinePage from './pages/NewPipelinePage';
import PipelinePage from './pages/PipelinePage';
import AuditPage from './pages/AuditPage';
import DecisionsPage from './pages/DecisionsPage';
import CheckpointsPage from './pages/CheckpointsPage';
import ExportPage from './pages/ExportPage';

const RBACPage = lazy(() => import('./pages/RBACPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

function RBACFallback() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-500">
      <Shield className="h-8 w-8 animate-pulse" />
      <span>Loading RBAC...</span>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="pipeline/new" element={<NewPipelinePage />} />
          <Route path="pipeline/:sessionId" element={<PipelinePage />} />
          <Route path="pipeline/:sessionId/audit" element={<AuditPage />} />
          <Route path="pipeline/:sessionId/decisions" element={<DecisionsPage />} />
          <Route
            path="pipeline/:sessionId/rbac"
            element={
              <Suspense fallback={<RBACFallback />}>
                <RBACPage />
              </Suspense>
            }
          />
          <Route path="pipeline/:sessionId/checkpoints" element={<CheckpointsPage />} />
          <Route path="pipeline/:sessionId/export" element={<ExportPage />} />
        </Route>
      </Routes>
    </QueryClientProvider>
  );
}