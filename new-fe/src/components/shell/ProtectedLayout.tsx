import { RequireAuth } from "@/components/auth/RequireAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { LayoutProvider } from "@/components/layout/LayoutContext";
import { GlobalSocketListeners } from "./GlobalSocketListeners";

export function ProtectedLayout() {
  return (
    <LayoutProvider>
      <AppLayout>
        <GlobalSocketListeners />
        <RequireAuth />
      </AppLayout>
    </LayoutProvider>
  );
}
