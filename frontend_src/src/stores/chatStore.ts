// =============================================================================
// Chat Store — Context agent chat state
// =============================================================================

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { ChatMessage } from '@/types/domain';

interface ChatState {
  // ── Data from backend ──
  messages: ChatMessage[];

  // ── Local UI state ──
  isOpen: boolean;
  inputValue: string;
  isLoading: boolean;

  // ── Actions ──
  addMessage: (message: ChatMessage) => void;
  sendUserMessage: (content: string) => void;
  setInputValue: (value: string) => void;
  toggleChat: () => void;
  openChat: () => void;
  closeChat: () => void;
  setLoading: (loading: boolean) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>()(
  devtools(
    (set) => ({
      messages: [],
      isOpen: false,
      inputValue: '',
      isLoading: false,

      addMessage: (message) =>
        set((state) => ({
          messages: [...state.messages, message],
        })),

      sendUserMessage: (content) => {
        const message: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'user',
          content,
          timestamp: new Date().toISOString(),
        };
        set((state) => ({
          messages: [...state.messages, message],
          inputValue: '',
          isLoading: true,
        }));
      },

      setInputValue: (value) => set({ inputValue: value }),
      toggleChat: () => set((state) => ({ isOpen: !state.isOpen })),
      openChat: () => set({ isOpen: true }),
      closeChat: () => set({ isOpen: false }),
      setLoading: (loading) => set({ isLoading: loading }),
      clearMessages: () => set({ messages: [] }),
    }),
    { name: 'chat-store' }
  )
);
