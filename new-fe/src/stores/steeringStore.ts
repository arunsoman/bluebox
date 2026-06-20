import { create } from "zustand";
import { steeringApi } from "@/api/endpoints/steering";
import { socketClient } from "@/ws/socketClient";

interface SteeringState {
  projectId: string | null;
  panel: SteeringPanel | null;
  selectedNodeIds: Set<string>;
  bookmarkedOptionIds: Set<string>;
  mode: "summary" | "detail";
  expandedNodeId: string | null;
  submitting: boolean;
  unsubscribe: (() => void) | null;
  init: (projectId: string) => void;
  toggleSelect: (nodeId: string) => void;
  toggleBookmark: (optionId: string) => void;
  setMode: (mode: "summary" | "detail") => void;
  setExpanded: (nodeId: string | null) => void;
  submitAction: (actionType: SteeringOptionType, payload: SteeringActionPayload) => Promise<void>;
  teardown: () => void;
}

export const useSteeringStore = create<SteeringState>((set, get) => ({
  projectId: null,
  panel: null,
  selectedNodeIds: new Set(),
  bookmarkedOptionIds: new Set(),
  mode: "summary",
  expandedNodeId: null,
  submitting: false,
  unsubscribe: null,

  init: (projectId) => {
    if (get().projectId === projectId) return;
    get().unsubscribe?.();
    set({ projectId, panel: null, selectedNodeIds: new Set(), expandedNodeId: null });

    const unsubscribers = [
      socketClient.on("STEERING_PANEL_READY", (panel) => {
        set({ panel, mode: panel.render_policy.default_mode, selectedNodeIds: new Set() });
      }),
      socketClient.on("NODE_UPDATED", ({ node_id, new_data }) => {
        set((s) => {
          if (!s.panel) return s;
          return {
            panel: {
              ...s.panel,
              draft_output: s.panel.draft_output.map((n) =>
                n.node_id === node_id ? { ...n, ...new_data } : n,
              ),
            },
          };
        });
      }),
    ];
    set({ unsubscribe: () => unsubscribers.forEach((u) => u()) });
  },

  toggleSelect: (nodeId) =>
    set((s) => {
      const next = new Set(s.selectedNodeIds);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return { selectedNodeIds: next };
    }),

  toggleBookmark: (optionId) => {
    set((s) => {
      const next = new Set(s.bookmarkedOptionIds);
      const bookmarked = !next.has(optionId);
      if (bookmarked) next.add(optionId);
      else next.delete(optionId);
      try {
        socketClient.emit("BOOKMARK_TOGGLE", { option_id: optionId, bookmarked });
      } catch {
        // socket not connected — bookmark stays local-only until reconnect.
      }
      return { bookmarkedOptionIds: next };
    });
  },

  setMode: (mode) => set({ mode }),
  setExpanded: (nodeId) => set({ expandedNodeId: nodeId }),

  submitAction: async (actionType, payload) => {
    const { projectId, panel } = get();
    if (!projectId || !panel) return;
    set({ submitting: true });
    try {
      await steeringApi.submitAction(projectId, {
        action_type: actionType,
        stage_id: panel.stage_id,
        payload,
        timestamp: new Date().toISOString(),
      });
      set({ selectedNodeIds: new Set() });
    } finally {
      set({ submitting: false });
    }
  },

  teardown: () => {
    get().unsubscribe?.();
    set({ projectId: null, panel: null, unsubscribe: null });
  },
}));
