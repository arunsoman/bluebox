// =============================================================================
// ChatPanel — Floating chat panel (context agent)
// =============================================================================

import { useRef, useEffect } from 'react';
import { X, Send, Bot, User } from 'lucide-react';
import { useChatStore } from '@/stores/chatStore';

export default function ChatPanel() {
  const isOpen = useChatStore((s) => s.isOpen);
  const messages = useChatStore((s) => s.messages);
  const inputValue = useChatStore((s) => s.inputValue);
  const isLoading = useChatStore((s) => s.isLoading);
  const closeChat = useChatStore((s) => s.closeChat);
  const setInputValue = useChatStore((s) => s.setInputValue);
  const sendUserMessage = useChatStore((s) => s.sendUserMessage);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    sendUserMessage(inputValue.trim());
  };

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex h-[480px] w-[380px] flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700 bg-slate-800 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-blue-400" />
          <span className="text-sm font-medium text-white">Context Agent</span>
        </div>
        <button
          onClick={closeChat}
          className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Bot className="mb-2 h-8 w-8 text-slate-600" />
            <p className="text-xs text-slate-500">
              Ask me about the pipeline, actors, capabilities, or any design decision.
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                msg.role === 'user' ? 'bg-blue-600' : 'bg-slate-700'
              }`}
            >
              {msg.role === 'user' ? (
                <User className="h-3 w-3 text-white" />
              ) : (
                <Bot className="h-3 w-3 text-blue-400" />
              )}
            </div>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'border border-slate-700 bg-slate-800 text-slate-200'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-700">
              <Bot className="h-3 w-3 text-blue-400" />
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2">
              <div className="flex gap-1">
                <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500" style={{ animationDelay: '0ms' }} />
                <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500" style={{ animationDelay: '150ms' }} />
                <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-slate-700 bg-slate-800 p-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask about this stage..."
            className="flex-1 rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="flex items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-white transition-colors hover:bg-blue-500 disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
}
