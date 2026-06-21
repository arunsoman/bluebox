import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { ToastProvider } from "@/components/common/Toast/ToastProvider";
import { AiConfigModal } from "@/components/common/AiConfigModal";
import { LogViewerModal } from "@/components/common/LogViewerModal";
import { useAiConfigModal } from "@/hooks/useAiConfigModal";
import { useLogViewerModal } from "@/hooks/useLogViewerModal";
import { useLogViewerStore } from "@/stores/logViewerStore";
import { router } from "@/router";
import { AppLayout } from "./components/layout/AppLayout";

export default function App() {
  const { isOpen, close } = useAiConfigModal();
  const logViewer = useLogViewerModal();

  // Registers httpClient's/socketClient's logger hooks exactly once, for
  // the lifetime of the tab - see logViewerStore.ts's module docstring.
  useEffect(() => {
    useLogViewerStore.getState().init();
  }, []);

  return (
    <ErrorBoundary>
      <ToastProvider>
          <AppLayout>
            <RouterProvider router={router} />
          </AppLayout>
        <AiConfigModal isOpen={isOpen} onClose={close} />
        <LogViewerModal isOpen={logViewer.isOpen} onClose={logViewer.close} />
      </ToastProvider>
    </ErrorBoundary>
  );
}
