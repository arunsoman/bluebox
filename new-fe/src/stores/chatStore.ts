import { create } from "zustand";
import { chatApi } from "@/api/endpoints/chat";
import { socketClient } from "@/ws/socketClient";

interface ChatState {
  projectId: string | null;
  messages: ChatMessage[];
  loading: boolean;
  sending: boolean;
  unsubscribe: (() => void) | null;
  init: (projectId: string) => Promise<void>;
  send: (text: string, intent?: "command" | "question" | "what_if") => Promise<void>;
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
  unsubscribe: null,

  init: async (projectId) => {
    if (get().projectId === projectId) return;
    get().unsubscribe?.();
    set({ projectId, messages: [], loading: true });

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

  teardown: () => {
    get().unsubscribe?.();
    set({ projectId: null, messages: [], unsubscribe: null });
  },
}));
