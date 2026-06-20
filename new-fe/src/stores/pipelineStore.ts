import { create } from "zustand";
import { socketClient, type SocketStatus } from "@/ws/socketClient";
import { useAuthStore } from "@/stores/authStore";

interface PipelineStoreState {
  projectId: string | null;
  sessionId: string | null;
  pipelineState: PipelineState | null;
  socketStatus: SocketStatus;
  connect: (projectId: string, sessionId: string) => void;
  disconnect: () => void;
}

let unsubscribers: Array<() => void> = [];

export const usePipelineStore = create<PipelineStoreState>((set, get) => ({
  projectId: null,
  sessionId: null,
  pipelineState: null,
  socketStatus: "idle",

  connect: (projectId, sessionId) => {
    if (get().sessionId === sessionId && socketClient.getStatus() !== "closed") {
      return;
    }
    unsubscribers.forEach((u) => u());
    unsubscribers = [];

    const token = useAuthStore.getState().accessToken;
    if (!token) throw new Error("Cannot open pipeline socket without an access token");

    set({ projectId, sessionId, pipelineState: null });

    unsubscribers.push(
      socketClient.onStatusChange((socketStatus) => set({ socketStatus })),
      socketClient.on("PIPELINE_STATE_CHANGED", (state) => set({ pipelineState: state })),
      socketClient.on("STATE_TRANSITION", ({ to_state }) =>
        set((s) => (s.pipelineState ? { pipelineState: { ...s.pipelineState, current_state: to_state } } : s)),
      ),
    );

    socketClient.connect(sessionId, token);
  },

  disconnect: () => {
    unsubscribers.forEach((u) => u());
    unsubscribers = [];
    socketClient.disconnect();
    set({ projectId: null, sessionId: null, pipelineState: null, socketStatus: "idle" });
  },
}));

/** Stage states that still belong to the onboarding flow rather than the IDE workspace. */
export function isOnboardingState(state: PipelineState["current_state"] | undefined): boolean {
  return (
    state === undefined ||
    state === "INITIALIZED" ||
    state === "CLASSIFYING" ||
    state === "AWAITING_INPUT_SEED"
  );
}
