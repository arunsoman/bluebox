import { create } from "zustand";
import { chatApi } from "@/api/endpoints/chat";
import { socketClient } from "@/ws/socketClient";

interface ChatState {
  projectId: string | null;
  messages: ChatMessage[];
  loading: boolean;
  sending: boolean;
  /** One-shot prefill text for the chat input, set by components handing off context (e.g.
   * "Discuss in chat" on a PRD conflict) - ChatPanel consumes it on mount/update then clears it. */
  draftMessage: string | null;
  unsubscribe: (() => void) | null;
  /** Number of mounted ChatPanel instances sharing this store (the docked sidebar panel and
   * ChatPopupModal can both be mounted at once) - teardown() only actually unsubscribes/resets
   * once the last instance unmounts, otherwise closing one would blank the other. */
  refCount: number;
  init: (projectId: string) => Promise<void>;
  send: (text: string, intent?: "command" | "question" | "what_if") => Promise<void>;
  setDraftMessage: (text: string | null) => void;
  teardown: () => void;
}

let idCounter = 0;
function localMessageId(): string {
  idCounter += 1;
  return `local-${idCounter}`;
}

export const useChatStore = create<ChatState>((set, get) => ({
  projectId: null,
  messages: [],
  loading: false,
  sending: false,
  draftMessage: null,
  unsubscribe: null,
  refCount: 0,

  init: async (projectId) => {
    if (get().projectId === projectId) {
      set((s) => ({ refCount: s.refCount + 1 }));
      return;
    }
    get().unsubscribe?.();
    set({ projectId, messages: [], loading: true, refCount: 1 });

    try {
      const history = await chatApi.getHistory(projectId, { limit: 50, include_system: true });
      set({ messages: history.messages, loading: false });
    } catch {
      set({ loading: false });
    }

    const streamBuffers = new Map<string, string>();
    const unsubscribers = [
      socketClient.on("CHAT_RESPONSE", (message) => {
        set((s) => ({ messages: [...s.messages, message] }));
      }),
      socketClient.on("CHAT_STREAM", ({ message_id, delta }) => {
        const buffered = (streamBuffers.get(message_id) ?? "") + delta;
        streamBuffers.set(message_id, buffered);
        set((s) => {
          const idx = s.messages.findIndex((m) => m.message_id === message_id);
          if (idx === -1) {
            const placeholder: ChatMessage = {
              message_id,
              message_type: "system_response",
              sender: "system",
              content: buffered,
              timestamp: new Date().toISOString(),
            };
            return { messages: [...s.messages, placeholder] };
          }
          const next = [...s.messages];
          const existing = next[idx];
          if (existing) next[idx] = { ...existing, content: buffered };
          return { messages: next };
        });
      }),
    ];
    set({ unsubscribe: () => unsubscribers.forEach((u) => u()) });
  },

  send: async (text, intent) => {
    const { projectId } = get();
    if (!projectId) return;
    const optimistic: ChatMessage = {
      message_id: localMessageId(),
      message_type: intent === "command" ? "user_command" : "user_intent",
      sender: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };
    set((s) => ({ messages: [...s.messages, optimistic], sending: true }));
    try {
      await chatApi.sendMessage(projectId, { text, message_type: optimistic.message_type as "user_intent" | "user_command", intent });
    } finally {
      set({ sending: false });
    }
  },

  setDraftMessage: (text) => set({ draftMessage: text }),

  teardown: () => {
    const remaining = get().refCount - 1;
    if (remaining > 0) {
      set({ refCount: remaining });
      return;
    }
    get().unsubscribe?.();
    set({ projectId: null, messages: [], unsubscribe: null, refCount: 0 });
  },
}));
