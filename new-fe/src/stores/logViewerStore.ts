import { create } from "zustand";
import { logsApi } from "@/api/endpoints/logs";
import { configureNetworkLogger, type NetworkLogEntry } from "@/api/httpClient";
import { configureWsLogger, socketClient, type WsLogEntry } from "@/ws/socketClient";

/**
 * Backs the Log Viewer modal (Ctrl+Shift+L) - the client-side half of the
 * observability system in be/src/bluebox/shared_kernel/observability/.
 * Merges three sources into one timeline: REST calls captured directly in
 * this tab (`httpClient`'s network logger), WS frames sent/received in
 * this tab (`socketClient`'s ws logger), and everything the backend itself
 * captured (REST received, LLM calls, WS both directions), pushed live as
 * `LOG_EVENT` frames over the same per-project steering socket, plus a
 * `loadHistory` REST call for whatever happened before this tab connected.
 */

// Mirrors be/src/bluebox/shared_kernel/observability/log_event.py's
// GLOBAL_PROJECT_ID - the sentinel for calls with no project in scope yet
// (login, project list) that this store's client-captured entries fall
// back to before a project is set.
const GLOBAL_PROJECT_ID = "_global";

// Mirrors the backend ring buffer's maxlen (log_bus.py) - bounds memory in
// a long-running dev session instead of growing the array forever.
const MAX_ENTRIES = 1000;

interface LogViewerState {
  entries: LogEvent[];
  projectId: string | null;
  connected: boolean;
  initialized: boolean;
  init: () => void;
  setProjectId: (projectId: string) => Promise<void>;
  clear: () => void;
}

function appendEntry(entries: LogEvent[], entry: LogEvent): LogEvent[] {
  return [...entries, entry].slice(-MAX_ENTRIES);
}

function mergeHistory(entries: LogEvent[], history: LogEvent[]): LogEvent[] {
  const seen = new Set(entries.map((e) => e.log_id));
  const merged = [...entries, ...history.filter((e) => !seen.has(e.log_id))];
  merged.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return merged.slice(-MAX_ENTRIES);
}

function fromNetworkEntry(entry: NetworkLogEntry, projectId: string | null): LogEvent {
  return {
    log_id: crypto.randomUUID(),
    project_id: projectId ?? GLOBAL_PROJECT_ID,
    trace_id: entry.traceId,
    timestamp: new Date().toISOString(),
    duration_ms: entry.durationMs,
    category: "http_sent_by_client",
    summary: `${entry.method} ${entry.url} -> ${entry.status} (${entry.durationMs.toFixed(0)}ms)`,
    detail: {
      method: entry.method,
      url: entry.url,
      request_body: entry.requestBody,
      response_status: entry.status,
      response_body: entry.responseBody,
    },
  };
}

function fromWsEntry(entry: WsLogEntry, projectId: string | null): LogEvent {
  const arrow = entry.direction === "sent" ? "client->server" : "server->client";
  return {
    log_id: crypto.randomUUID(),
    project_id: projectId ?? GLOBAL_PROJECT_ID,
    trace_id: null,
    timestamp: new Date().toISOString(),
    duration_ms: null,
    category: entry.direction === "sent" ? "ws_sent_by_client" : "ws_received_by_client",
    summary: `WS ${arrow} ${entry.event}`,
    detail: { event: entry.event, payload: entry.payload },
  };
}

export const useLogViewerStore = create<LogViewerState>((set, get) => ({
  entries: [],
  projectId: null,
  connected: false,
  initialized: false,

  init: () => {
    if (get().initialized) return;
    set({ initialized: true });

    configureNetworkLogger((entry) => {
      set((s) => ({ entries: appendEntry(s.entries, fromNetworkEntry(entry, s.projectId)) }));
    });
    configureWsLogger((entry) => {
      set((s) => ({ entries: appendEntry(s.entries, fromWsEntry(entry, s.projectId)) }));
    });
    socketClient.on("LOG_EVENT", (event) => {
      set((s) => ({ entries: appendEntry(s.entries, event) }));
    });
    socketClient.onStatusChange((status) => set({ connected: status === "open" }));
  },

  setProjectId: async (projectId) => {
    if (get().projectId === projectId) return;
    set({ projectId, entries: [] });
    const history = await logsApi.getLogs(projectId);
    if (get().projectId !== projectId) return; // a newer setProjectId won the race
    set((s) => ({ entries: mergeHistory(s.entries, history) }));
  },

  clear: () => set({ entries: [] }),
}));
