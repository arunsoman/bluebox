import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { ToastProvider } from "@/components/common/Toast/ToastProvider";
import { AiConfigModal } from "@/components/common/AiConfigModal";
import { LogViewerModal } from "@/components/common/LogViewerModal";
import { useAiConfigModal } from "@/hooks/useAiConfigModal";
import { useLogViewerModal } from "@/hooks/useLogViewerModal";
import { useLogViewerStore } from "@/stores/logViewerStore";
import { useAiStore } from "@/stores/aiStore";
import { router } from "@/router";

export default function App() {
  const { isOpen, close } = useAiConfigModal();
  const logViewer = useLogViewerModal();

  // Registers httpClient's/socketClient's logger hooks exactly once, for
  // the lifetime of the tab - see logViewerStore.ts's module docstring.
  useEffect(() => {
    useLogViewerStore.getState().init();
  }, []);

  // aiStore's persisted default (provider: "openai", model: "gpt-4o") is
  // just a UI placeholder, not a guarantee the backend actually has that
  // provider's API key configured - until now, the only thing that ever
  // corrected it was opening the AI Config modal (Ctrl+M), so every request
  // a user makes before ever touching that modal sends headers for a
  // provider that may not work, and every AI-backed feature fails with a
  // generic "Internal Server Error" (observed live: every LLM call failing
  // with X-AI-Provider: openai while OPENAI_API_KEY was unset). Running the
  // same fetch-and-auto-correct-to-a-configured-provider logic once here
  // means a fresh session is never silently stuck on a dead default.
  useEffect(() => {
    useAiStore.getState().fetchProviders().catch(() => {});
  }, []);

  return (
    <ErrorBoundary>
      <ToastProvider>
        <RouterProvider router={router} />
        <AiConfigModal isOpen={isOpen} onClose={close} />
        <LogViewerModal isOpen={logViewer.isOpen} onClose={logViewer.close} />
      </ToastProvider>
    </ErrorBoundary>
  );
}
