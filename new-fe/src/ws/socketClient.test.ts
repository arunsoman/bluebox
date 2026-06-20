import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configureWsLogger, SocketClient } from "./socketClient";

class FakeWebSocket {
  static OPEN = 1;
  static instances: FakeWebSocket[] = [];

  url: string;
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
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

describe("SocketClient", () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeWebSocket as unknown as typeof WebSocket);
    configureWsLogger(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("connects to the documented per-session URL and sends AUTH_SESSION_INIT on open", () => {
    const client = new SocketClient();
    client.connect("session-123", "token-abc");

    const socket = FakeWebSocket.instances[0];
    expect(socket.url).toContain("/api/v1/steering/session/session-123");

    socket.triggerOpen();
    expect(socket.sent).toHaveLength(1);
    const frame = JSON.parse(socket.sent[0]);
    expect(frame).toEqual({
      event: "AUTH_SESSION_INIT",
      payload: { session_id: "session-123", token: "token-abc" },
    });
    expect(client.getStatus()).toBe("open");
  });

  it("dispatches typed server events to registered listeners", () => {
    const client = new SocketClient();
    client.connect("session-123", "token-abc");
    const socket = FakeWebSocket.instances[0];
    socket.triggerOpen();

    const handler = vi.fn();
    client.on("STAGE_COMPLETED", handler);
    socket.triggerMessage({ event: "STAGE_COMPLETED", payload: { stage: 3, checkpoint_id: "chk-1", node_count: 12 } });

    expect(handler).toHaveBeenCalledWith({ stage: 3, checkpoint_id: "chk-1", node_count: 12 });
  });

  it("throws when emitting before the socket is open", () => {
    const client = new SocketClient();
    client.connect("session-123", "token-abc");
    expect(() => client.emit("CHAT_MESSAGE", { text: "hello", message_type: "user_intent" })).toThrow();
  });

  it("schedules a reconnect with backoff after an unexpected close", () => {
    vi.useFakeTimers();
    const client = new SocketClient();
    client.connect("session-123", "token-abc");
    const firstSocket = FakeWebSocket.instances[0];
    firstSocket.triggerOpen();

    firstSocket.onclose?.();
    expect(client.getStatus()).toBe("reconnecting");

    vi.advanceTimersByTime(1000);
    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it("does not reconnect after an explicit disconnect()", () => {
    vi.useFakeTimers();
    const client = new SocketClient();
    client.connect("session-123", "token-abc");
    FakeWebSocket.instances[0].triggerOpen();

    client.disconnect();
    expect(client.getStatus()).toBe("closed");

    vi.advanceTimersByTime(20_000);
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it("logs outbound and inbound frames via the configured ws logger", () => {
    const onLog = vi.fn();
    configureWsLogger(onLog);
    const client = new SocketClient();
    client.connect("session-123", "token-abc");
    const socket = FakeWebSocket.instances[0];
    socket.triggerOpen();
    onLog.mockClear(); // drop the AUTH_SESSION_INIT entry from connect()

    client.on("STAGE_COMPLETED", () => {});
    socket.triggerMessage({ event: "STAGE_COMPLETED", payload: { stage: 1 } });
    client.emit("CHAT_MESSAGE", { text: "hi", message_type: "user_intent" });

    expect(onLog).toHaveBeenCalledWith({ direction: "received", event: "STAGE_COMPLETED", payload: { stage: 1 } });
    expect(onLog).toHaveBeenCalledWith({
      direction: "sent",
      event: "CHAT_MESSAGE",
      payload: { text: "hi", message_type: "user_intent" },
    });
  });

  it("never logs a LOG_EVENT frame itself, but still dispatches it to listeners", () => {
    const onLog = vi.fn();
    configureWsLogger(onLog);
    const client = new SocketClient();
    client.connect("session-123", "token-abc");
    const socket = FakeWebSocket.instances[0];
    socket.triggerOpen();
    onLog.mockClear();

    const handler = vi.fn();
    client.on("LOG_EVENT", handler);
    socket.triggerMessage({ event: "LOG_EVENT", payload: { log_id: "x" } });

    expect(handler).toHaveBeenCalledWith({ log_id: "x" });
    expect(onLog).not.toHaveBeenCalled();
  });
});
