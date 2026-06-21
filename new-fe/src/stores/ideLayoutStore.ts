import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Persisted IDE layout state — UIUX §3.2.3. The spec namespaces the
 * localStorage key per user (`ide-layout-{userId}`); we use a single
 * browser-scoped key since this build is single-tenant-per-browser. Revisit
 * if multi-account-per-browser support is needed.
 */
export type CenterTab = "projects" | "prd" | "steering" | "graph" | "code-gen" | "editor";
export type BottomTab = "terminal" | "test-results" | "audit-trail" | "code-gen";

interface IdeLayoutState {
  leftSidebarWidth: number;
  rightSidebarWidth: number;
  chatPanelHeight: number;
  bottomPanelHeight: number;
  leftSidebarCollapsed: boolean;
  rightSidebarCollapsed: boolean;
  bottomPanelCollapsed: boolean;
  activeCenterTab: CenterTab;
  activeBottomTab: BottomTab;
  trustMode: TrustMode;
  setLeftSidebarWidth: (w: number) => void;
  setRightSidebarWidth: (w: number) => void;
  setChatPanelHeight: (h: number) => void;
  setBottomPanelHeight: (h: number) => void;
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
  toggleBottomPanel: () => void;
  setActiveCenterTab: (tab: CenterTab) => void;
  setActiveBottomTab: (tab: BottomTab) => void;
  setTrustMode: (mode: TrustMode) => void;
}

export const useIdeLayoutStore = create<IdeLayoutState>()(
  persist(
    (set) => ({
      leftSidebarWidth: 320,
      rightSidebarWidth: 400,
      chatPanelHeight: 65,
      bottomPanelHeight: 200,
      leftSidebarCollapsed: false,
      rightSidebarCollapsed: false,
      bottomPanelCollapsed: false,
      activeCenterTab: "prd",
      activeBottomTab: "terminal",
      trustMode: "PARANOID",

      setLeftSidebarWidth: (w) => set({ leftSidebarWidth: Math.min(480, Math.max(260, w)) }),
      setRightSidebarWidth: (w) => set({ rightSidebarWidth: Math.min(640, Math.max(320, w)) }),
      setChatPanelHeight: (h) => set({ chatPanelHeight: Math.min(80, Math.max(20, h)) }),
      setBottomPanelHeight: (h) => set({ bottomPanelHeight: Math.min(480, Math.max(120, h)) }),
      toggleLeftSidebar: () => set((s) => ({ leftSidebarCollapsed: !s.leftSidebarCollapsed })),
      toggleRightSidebar: () => set((s) => ({ rightSidebarCollapsed: !s.rightSidebarCollapsed })),
      toggleBottomPanel: () => set((s) => ({ bottomPanelCollapsed: !s.bottomPanelCollapsed })),
      setActiveCenterTab: (tab) => set({ activeCenterTab: tab }),
      setActiveBottomTab: (tab) => set({ activeBottomTab: tab }),
      setTrustMode: (mode) => set({ trustMode: mode }),
    }),
    { name: "csp_ide_layout" },
  ),
);
