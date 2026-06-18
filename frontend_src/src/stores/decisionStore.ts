// =============================================================================
// Decision Store — Decision ledger state
// =============================================================================

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { DecisionEntry, RevisionBudget } from '@/types/domain';

interface DecisionState {
  // ── Data from backend ──
  entries: DecisionEntry[];
  totalUserDecisions: number;
  totalSystemDecisions: number;
  totalSuperseded: number;
  totalReverted: number;
  budgets: RevisionBudget[];

  // ── Local UI state ──
  selectedEntryId: string | null;
  filter: 'all' | 'active' | 'superseded' | 'system';
  searchQuery: string;

  // ── Actions ──
  setEntries: (entries: DecisionEntry[]) => void;
  addEntry: (entry: DecisionEntry) => void;
  supersedeEntry: (oldId: string, newId: string) => void;
  revertEntry: (revertedToId: string, newEntryId: string) => void;
  selectEntry: (id: string | null) => void;
  setFilter: (filter: 'all' | 'active' | 'superseded' | 'system') => void;
  setSearchQuery: (query: string) => void;
  setBudgets: (budgets: RevisionBudget[]) => void;
  markBudgetExhausted: (budgetId: string) => void;
  clear: () => void;
}

export const useDecisionStore = create<DecisionState>()(
  devtools(
    (set) => ({
      entries: [],
      totalUserDecisions: 0,
      totalSystemDecisions: 0,
      totalSuperseded: 0,
      totalReverted: 0,
      budgets: [],
      selectedEntryId: null,
      filter: 'all',
      searchQuery: '',

      setEntries: (entries) =>
        set({
          entries,
          totalUserDecisions: entries.filter((e) => e.decision_maker === 'user').length,
          totalSystemDecisions: entries.filter((e) => e.decision_maker === 'system_authorized').length,
          totalSuperseded: entries.filter((e) => e.status === 'superseded').length,
          totalReverted: entries.filter((e) => e.reverted_to !== null).length,
        }),

      addEntry: (entry) =>
        set((state) => ({
          entries: [...state.entries, entry],
          ...(entry.decision_maker === 'user'
            ? { totalUserDecisions: state.totalUserDecisions + 1 }
            : { totalSystemDecisions: state.totalSystemDecisions + 1 }),
        })),

      supersedeEntry: (oldId, newId) =>
        set((state) => ({
          entries: state.entries.map((e) =>
            e.decision_id === oldId ? { ...e, status: 'superseded' as const, superseded_by: newId } : e
          ),
          totalSuperseded: state.totalSuperseded + 1,
        })),

      revertEntry: (revertedToId, _newEntryId) =>
        set((state) => ({
          entries: state.entries.map((e) =>
            e.decision_id === revertedToId ? { ...e, status: 'superseded' as const } : e
          ),
          totalReverted: state.totalReverted + 1,
        })),

      selectEntry: (id) => set({ selectedEntryId: id }),
      setFilter: (filter) => set({ filter }),
      setSearchQuery: (query) => set({ searchQuery: query }),

      setBudgets: (budgets) => set({ budgets }),

      markBudgetExhausted: (budgetId) =>
        set((state) => ({
          budgets: state.budgets.map((b) =>
            b.budget_id === budgetId ? { ...b, status: 'exhausted' as const } : b
          ),
        })),

      clear: () =>
        set({
          entries: [],
          totalUserDecisions: 0,
          totalSystemDecisions: 0,
          totalSuperseded: 0,
          totalReverted: 0,
          budgets: [],
          selectedEntryId: null,
          searchQuery: '',
        }),
    }),
    { name: 'decision-store' }
  )
);
