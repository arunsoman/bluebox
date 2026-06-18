// =============================================================================
// Notification Store — Toast notifications
// =============================================================================

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Toast, NotificationChannel } from '@/types/domain';

interface NotificationState {
  // ── Data ──
  toasts: Toast[];
  tabTitle: string;

  // ── Local UI state ──
  channel: NotificationChannel;

  // ── Actions ──
  addToast: (toast: Toast) => void;
  removeToast: (id: string) => void;
  setTabTitle: (title: string) => void;
  setChannel: (channel: NotificationChannel) => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>()(
  devtools(
    (set) => ({
      toasts: [],
      tabTitle: 'Protobox | Collaborative Steering Pipeline',
      channel: 'websocket',

      addToast: (toast) =>
        set((state) => ({
          toasts: [...state.toasts.slice(-9), toast],
        })),

      removeToast: (id) =>
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        })),

      setTabTitle: (title) => set({ tabTitle: title }),
      setChannel: (channel) => set({ channel }),

      clearAll: () => set({ toasts: [] }),
    }),
    { name: 'notification-store' }
  )
);
