import { create } from "zustand";
import { authApi } from "@/api/endpoints/auth";
import { configureAuthTokenProvider, configureUnauthorizedHandler, ApiError } from "@/api/httpClient";

/**
 * Access token kept in sessionStorage, not localStorage: scoped to the tab
 * lifetime, smaller XSS persistence window. The contract (doc/api_event_
 * contract.md §1.1) returns a `refresh_token` but documents no refresh
 * endpoint, so there is nothing to silently renew with — on 401 / expiry we
 * log out and require the user to sign in again rather than inventing an
 * undocumented refresh call.
 */
const TOKEN_STORAGE_KEY = "csp_access_token";
const SESSION_ID_STORAGE_KEY = "csp_session_id";

interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  sessionId: string | null;
  status: "idle" | "loading" | "authenticated" | "error";
  error: string | null;
  login: (req: LoginRequest) => Promise<void>;
  logout: () => void;
  /** Restores a session from sessionStorage on app load by re-validating with GET /auth/me. */
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: sessionStorage.getItem(TOKEN_STORAGE_KEY),
  sessionId: sessionStorage.getItem(SESSION_ID_STORAGE_KEY),
  status: "idle",
  error: null,

  login: async (req) => {
    set({ status: "loading", error: null });
    try {
      const response = await authApi.login(req);
      sessionStorage.setItem(TOKEN_STORAGE_KEY, response.access_token);
      sessionStorage.setItem(SESSION_ID_STORAGE_KEY, response.session_id);
      set({
        user: response.user,
        accessToken: response.access_token,
        sessionId: response.session_id,
        status: "authenticated",
      });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Login failed";
      set({ status: "error", error: message });
      throw err;
    }
  },

  logout: () => {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(SESSION_ID_STORAGE_KEY);
    set({ user: null, accessToken: null, sessionId: null, status: "idle", error: null });
  },

  hydrate: async () => {
    const token = get().accessToken;
    if (!token) {
      set({ status: "idle" });
      return;
    }
    set({ status: "loading" });
    try {
      const user = await authApi.me();
      set({ user, status: "authenticated" });
    } catch {
      get().logout();
    }
  },
}));

configureAuthTokenProvider(() => useAuthStore.getState().accessToken);
configureUnauthorizedHandler(() => useAuthStore.getState().logout());
