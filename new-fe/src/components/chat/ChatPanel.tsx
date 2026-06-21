import { useEffect, useRef, useState } from "react";
import { useChatStore } from "@/stores/chatStore";
import { usePipelineStore } from "@/stores/pipelineStore";
import { useCheckpointRestoreStore } from "@/stores/checkpointRestoreStore";
import { useToast } from "@/components/common/Toast/ToastContext";
import { socketClient } from "@/ws/socketClient";
import { checkpointsApi } from "@/api/endpoints/checkpoints";
import { ApiError } from "@/api/httpClient";
import { Spinner } from "@/components/common/Spinner";
import { MessageBubble } from "./MessageBubble";
import { CommandPalette } from "./CommandPalette";
import type { ChatCommand } from "./chatCommands";
import styles from "./ChatPanel.module.css";

export function ChatPanel() {
  const projectId = usePipelineStore((s) => s.projectId);
  const init = useChatStore((s) => s.init);
  const teardown = useChatStore((s) => s.teardown);
  const messages = useChatStore((s) => s.messages);
  const loading = useChatStore((s) => s.loading);
  const sending = useChatStore((s) => s.sending);
  const send = useChatStore((s) => s.send);
  const draftMessage = useChatStore((s) => s.draftMessage);
  const setDraftMessage = useChatStore((s) => s.setDraftMessage);
  const showCheckpoints = useCheckpointRestoreStore((s) => s.show);
  const { pushToast } = useToast();

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (projectId) void init(projectId);
    return () => teardown();
  }, [projectId, init, teardown]);

  // One-shot prefill from another component (e.g. PRDAnalysisReport's "Discuss in chat") -
  // seed the input then clear the store field so it doesn't refire on the next render.
  useEffect(() => {
    if (draftMessage === null) return;
    setInput(draftMessage);
    setDraftMessage(null);
  }, [draftMessage, setDraftMessage]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  function handleCommandSelect(cmd: ChatCommand) {
    setInput(cmd.command + " ");
  }

  async function handleSubmit() {
    const text = input.trim();
    if (!text) return;
    setInput("");

    if (text.startsWith("/steer ")) {
      try {
        socketClient.emit("MID_STAGE_STEER", {
          stage_id: 0,
          instruction: text.slice("/steer ".length),
          action_type: "modify",
        });
      } catch {
        // socket not open yet — fall through to a normal chat send so the
        // instruction is still recorded somewhere visible to the user.
        await send(text, "command");
      }
      return;
    }
    if (text.startsWith("/why ")) {
      socketClient.emit("CONTEXT_QUESTION", { question: text.slice("/why ".length) });
      await send(text, "question");
      return;
    }
    if (text === "/checkpoint" || text.startsWith("/checkpoint ")) {
      if (!projectId) return;
      const label = text.slice("/checkpoint".length).trim() || undefined;
      try {
        const checkpoint = await checkpointsApi.create(projectId, { label, include_workspace: true });
        pushToast({ severity: "success", title: "Checkpoint created", body: checkpoint.label });
        showCheckpoints();
      } catch (err) {
        pushToast({ severity: "error", title: "Could not create checkpoint", body: err instanceof ApiError ? err.message : "Unknown error" });
      }
      await send(text, "command");
      return;
    }
    await send(text, text.startsWith("/") ? "command" : undefined);
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>Chat</div>
      <div className={styles.messages} ref={scrollRef}>
        {loading && (
          <div className={styles.loadingRow}>
            <Spinner size={20} />
          </div>
        )}
        {!loading && messages.length === 0 && (
          <p className={styles.placeholder}>Describe what you want to build...</p>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.message_id} message={m} />
        ))}
      </div>
      <div className={styles.inputArea}>
        {input.startsWith("/") && <CommandPalette query={input} onSelect={handleCommandSelect} />}
        <textarea
          className={styles.textarea}
          placeholder="Type / for commands…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSubmit();
            }
          }}
        />
        <button className={styles.sendButton} disabled={sending || !input.trim()} onClick={handleSubmit}>
          Send
        </button>
      </div>
    </div>
  );
}
