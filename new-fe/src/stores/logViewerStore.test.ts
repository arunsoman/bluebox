import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { useLogViewerStore } from "./logViewerStore";
import { http } from "@/api/httpClient";
import { socketClient } from "@/ws/socketClient";

class FakeWebSocket {
  static OPEN = 1;
  static instances: FakeWebSocket[] = [];

  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor() {
    FakeWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 3;
    this.onclose?.();
  }

  triggerOpen() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  triggerMessage(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }
}

function mockFetchOnce(jsonBody: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({ "content-type": "application/json" }),
      text: vi.fn().mockResolvedValue(JSON.stringify(jsonBody)),
    } as unknown as Response),
  );
}

function logEvent(overrides: Partial<LogEvent> = {}): LogEvent {
  return {
    log_id: crypto.randomUUID(),
    project_id: "proj-1",
    trace_id: null,
    timestamp: new Date().toISOString(),
    duration_ms: null,
    category: "http_received_by_backend",
    summary: "x",
    detail: {},
    ...overrides,
  };
}

describe("logViewerStore", () => {
  // `socketClient` is a true singleton (one WS per browser tab) and
  // `init()` is explicitly designed to be idempotent against that - it must
  // be called exactly once here too, or every test after the first would
  // register another LOG_EVENT listener on the same shared instance.
  beforeAll(() => {
    useLogViewerStore.getState().init();
  });

  beforeEach(() => {
    useLogViewerStore.setState({ entries: [], projectId: null, connected: false });
    FakeWebSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeWebSocket as unknown as typeof WebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    socketClient.disconnect();
  });

  it("appends an entry when httpClient reports a real REST call", async () => {
    mockFetchOnce({ ok: true });

    await http.get("/api/v1/projects");

    const entries = useLogViewerStore.getState().entries;
    expect(entries).toHaveLength(1);
    expect(entries[0].category).toBe("http_sent_by_client");
    expect(entries[0].summary).toContain("GET");
    expect(entries[0].summary).toContain("200");
  });

  it("appends a backend-pushed LOG_EVENT frame received over the WS singleton", () => {
    socketClient.connect("session-1", "token-1");
    const ws = FakeWebSocket.instances[0];
    ws.triggerOpen(); // also sends AUTH_SESSION_INIT, logged as its own ws_sent_by_client entry

    const pushed = logEvent({ log_id: "pushed-1", summary: "from backend" });
    ws.triggerMessage({ event: "LOG_EVENT", payload: pushed });

    const entries = useLogViewerStore.getState().entries;
    expect(entries.filter((e) => e.log_id === "pushed-1")).toHaveLength(1);
  });

  it("init() is idempotent - calling it twice does not double-subscribe to LOG_EVENT", () => {
    useLogViewerStore.getState().init();
    socketClient.connect("session-1", "token-1");
    const ws = FakeWebSocket.instances[0];
    ws.triggerOpen();

    ws.triggerMessage({ event: "LOG_EVENT", payload: logEvent({ log_id: "pushed-2" }) });

    // exactly one copy - a double-subscribed listener would append it twice
    expect(useLogViewerStore.getState().entries.filter((e) => e.log_id === "pushed-2")).toHaveLength(1);
  });

  it("tracks connection status via the socket singleton", () => {
    socketClient.connect("session-1", "token-1");
    expect(useLogViewerStore.getState().connected).toBe(false);

    FakeWebSocket.instances[0].triggerOpen();
    expect(useLogViewerStore.getState().connected).toBe(true);
  });

  it("setProjectId clears entries and loads history for the new project", async () => {
    useLogViewerStore.setState({ entries: [logEvent({ log_id: "stale", project_id: "old-project" })] });
    mockFetchOnce([logEvent({ project_id: "proj-2", log_id: "h1", timestamp: "2026-01-01T00:00:00.000Z" })]);

    await useLogViewerStore.getState().setProjectId("proj-2");

    const entries = useLogViewerStore.getState().entries;
    // the stale entry from the previous project is gone; the history entry
    // is present (the GET /logs call itself also logs a benign extra entry,
    // which is correct behavior, not asserted away here)
    expect(entries.some((e) => e.log_id === "stale")).toBe(false);
    expect(entries.some((e) => e.log_id === "h1")).toBe(true);
  });

  it("merges loaded history with entries that arrived before it resolved, sorted by timestamp, deduped by log_id", async () => {
    mockFetchOnce([logEvent({ log_id: "h1", timestamp: "2026-01-01T00:00:00.000Z" })]);

    const promise = useLogViewerStore.getState().setProjectId("proj-3");
    // an entry (e.g. a live LOG_EVENT) arrives while history is still loading
    useLogViewerStore.setState((s) => ({
      entries: [...s.entries, logEvent({ log_id: "live-1", timestamp: "2026-01-01T00:00:05.000Z" })],
    }));
    await promise;

    const ids = useLogViewerStore.getState().entries.map((e) => e.log_id);
    expect(ids).toContain("h1");
    expect(ids).toContain("live-1");
    expect(ids.filter((id) => id === "h1")).toHaveLength(1); // not duplicated by the merge
    expect(ids.indexOf("h1")).toBeLessThan(ids.indexOf("live-1")); // sorted by timestamp
  });

  it("clear() empties the entry list", () => {
    useLogViewerStore.setState({ entries: [logEvent()] });
    useLogViewerStore.getState().clear();
    expect(useLogViewerStore.getState().entries).toEqual([]);
  });
});
