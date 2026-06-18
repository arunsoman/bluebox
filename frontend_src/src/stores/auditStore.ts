// =============================================================================
// Audit Store — Audit trail state
// =============================================================================

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { AuditEvent, AuditActionType, StorageStrategy } from '@/types/domain';

interface AuditFilters {
  actionType: AuditActionType | null;
  actorId: string | null;
  dateRange: [string, string] | null;
}

interface AuditState {
  // ── Data from backend ──
  events: AuditEvent[];
  totalEvents: number;
  storageStrategy: StorageStrategy;
  storageUsedPercent: number;

  // ── Local UI state ──
  filters: AuditFilters;

  // ── Actions ──
  setEvents: (events: AuditEvent[], total: number) => void;
  appendEvent: (event: AuditEvent) => void;
  setStorageStrategy: (strategy: StorageStrategy) => void;
  setStorageUsedPercent: (percent: number) => void;
  setFilters: (filters: Partial<AuditFilters>) => void;
  clear: () => void;
}

export const useAuditStore = create<AuditState>()(
  devtools(
    (set) => ({
      events: [],
      totalEvents: 0,
      storageStrategy: 'diff',
      storageUsedPercent: 0,
      filters: {
        actionType: null,
        actorId: null,
        dateRange: null,
      },

      setEvents: (events, total) => set({ events, totalEvents: total }),

      appendEvent: (event) =>
        set((state) => ({
          events: [event, ...state.events].slice(0, 10000),
          totalEvents: state.totalEvents + 1,
        })),

      setStorageStrategy: (strategy) => set({ storageStrategy: strategy }),
      setStorageUsedPercent: (percent) => set({ storageUsedPercent: percent }),

      setFilters: (filters) =>
        set((state) => ({
          filters: { ...state.filters, ...filters },
        })),

      clear: () =>
        set({
          events: [],
          totalEvents: 0,
          storageStrategy: 'diff',
          storageUsedPercent: 0,
          filters: { actionType: null, actorId: null, dateRange: null },
        }),
    }),
    { name: 'audit-store' }
  )
);
