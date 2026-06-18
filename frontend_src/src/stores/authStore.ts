// =============================================================================
// Auth Store — Deferred login with header-based user selection
// =============================================================================

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface AuthState {
  // ── State ──
  userId: string | null;
  role: 'pipeline_admin' | 'pipeline_user' | 'pipeline_viewer' | null;
  identityVerifiedAt: string | null;
  isReauthRequired: boolean;

  // ── Actions ──
  setUser: (userId: string, role: 'pipeline_admin' | 'pipeline_user' | 'pipeline_viewer') => void;
  clearUser: () => void;
  markReauthRequired: () => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set) => ({
      userId: null,
      role: null,
      identityVerifiedAt: null,
      isReauthRequired: false,

      setUser: (userId, role) =>
        set({ userId, role, identityVerifiedAt: new Date().toISOString(), isReauthRequired: false }),

      clearUser: () =>
        set({ userId: null, role: null, identityVerifiedAt: null, isReauthRequired: false }),

      markReauthRequired: () =>
        set({ isReauthRequired: true }),
    }),
    { name: 'auth-store' }
  )
);
