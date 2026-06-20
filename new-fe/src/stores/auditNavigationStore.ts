import { create } from "zustand";
import { useIdeLayoutStore } from "@/stores/ideLayoutStore";

/**
 * Cross-panel "jump to Audit Panel, focused on X" links — e.g. Node Editor's
 * "View in Decision Ledger" / "View Full Audit Trail" (doc/wireframes.md
 * missing-screens §1, Provenance & Audit section), or Steering Panel's
 * "View in Decision Ledger" (main wireframes §3.2). The Audit Panel reads
 * this on mount and clears it once applied.
 */
interface AuditNavigationState {
  focusEntryId: string | null;
  focusAuditQuery: Partial<AuditQuery> | null;
  focusLedger: (entryId: string) => void;
  focusTrail: (query: Partial<AuditQuery>) => void;
  clear: () => void;
}

export const useAuditNavigationStore = create<AuditNavigationState>((set) => ({
  focusEntryId: null,
  focusAuditQuery: null,
  focusLedger: (entryId) => {
    set({ focusEntryId: entryId, focusAuditQuery: null });
    useIdeLayoutStore.getState().setActiveBottomTab("audit-trail");
  },
  focusTrail: (query) => {
    set({ focusAuditQuery: query, focusEntryId: null });
    useIdeLayoutStore.getState().setActiveBottomTab("audit-trail");
  },
  clear: () => set({ focusEntryId: null, focusAuditQuery: null }),
}));
