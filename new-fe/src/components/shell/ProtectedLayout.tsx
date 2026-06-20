import { RequireAuth } from "@/components/auth/RequireAuth";
import { GlobalSocketListeners } from "./GlobalSocketListeners";

export function ProtectedLayout() {
  return (
    <>
      <GlobalSocketListeners />
      <RequireAuth />
    </>
  );
}
