import { env } from "@/config/env";
import type { ClientEventMap, ClientEventName, ServerEventMap, ServerEventName } from "./events";

/**
 * Single WebSocket connection per session, per
 * doc/api_event_contract.md §1.1 (`wss://api/v1/steering/session/{session_id}`).
 * Stores subscribe through this client — no other module opens a socket.
 */

export type SocketStatus = "idle" | "connecting" | "open" | "reconnecting" | "closed";

type Listener<K extends ServerEventName> = (payload: ServerEventMap[K]) => void;

interface IncomingFrame {
  event?: string;
  payload?: unknown;
}

const MAX_RECONNECT_DELAY_MS = 15_000;
const BASE_RECONNECT_DELAY_MS = 1_000;

/** One entry per WS frame sent/received, for the log viewer (`logViewerStore`). */
export interface WsLogEntry {
  direction: "sent" | "received";
  event: string;
  payload: unknown;
}

type WsLogger = (entry: WsLogEntry) => void;

let wsLogger: WsLogger | null = null;

/**
 * logViewerStore registers itself here at startup to avoid a circular
 * import. Deliberately never fires for `LOG_EVENT` itself - that frame is
 * the log viewer's own data arriving, not a protocol event to log (the
 * backend's `_send` applies the same guard - see
 * be/src/bluebox/interfaces/ws/steering_session.py).
 */
export function configureWsLogger(logger: WsLogger): void {
  wsLogger = logger;
}

export class SocketClient {
  private socket: WebSocket | null = null;
  private listeners = new Map<string, Set<(payload: unknown) => void>>();
  private statusListeners = new Set<(status: SocketStatus) => void>();
  private status: SocketStatus = "idle";
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private manuallyClosed = false;
  private authExpired = false;
  private sessionId: string | null = null;
  private token: string | null = null;

  connect(sessionId: string, token: string): void {
    this.sessionId = sessionId;
    this.token = token;
    this.manuallyClosed = false;
    this.authExpired = false;
    this.open();
  }

  disconnect(): void {
    this.manuallyClosed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.socket?.close();
    this.socket = null;
    this.setStatus("closed");
  }

  on<K extends ServerEventName>(event: K, listener: Listener<K>): () => void {
    const set = this.listeners.get(event) ?? new Set();
    set.add(listener as (payload: unknown) => void);
    this.listeners.set(event, set);
    return () => set.delete(listener as (payload: unknown) => void);
  }

  onStatusChange(listener: (status: SocketStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  emit<K extends ClientEventName>(event: K, payload: ClientEventMap[K]): void {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      throw new Error(`Cannot emit "${event}" — socket is not open (status: ${this.status})`);
    }
    this.socket.send(JSON.stringify({ event, payload }));
    wsLogger?.({ direction: "sent", event, payload });
  }

  getStatus(): SocketStatus {
    return this.status;
  }

  private open(): void {
    if (!this.sessionId || !this.token) return;
    this.setStatus(this.reconnectAttempts > 0 ? "reconnecting" : "connecting");

    const url = `${env.wsBaseUrl.replace(/\/$/, "")}/api/v1/steering/session/${this.sessionId}`;
    const socket = new WebSocket(url);
    this.socket = socket;

    socket.onopen = () => {
      this.reconnectAttempts = 0;
      this.setStatus("open");
      this.emitRaw("AUTH_SESSION_INIT", { session_id: this.sessionId!, token: this.token! });
    };

    socket.onmessage = (event) => {
      this.handleMessage(event.data);
    };

    socket.onclose = () => {
      this.socket = null;
      if (this.manuallyClosed || this.authExpired) {
        this.setStatus("closed");
        return;
      }
      this.scheduleReconnect();
    };

    socket.onerror = () => {
      // onclose fires after onerror for native WebSocket; reconnection is handled there.
    };
  }

  private emitRaw(event: string, payload: unknown): void {
    this.socket?.send(JSON.stringify({ event, payload }));
    wsLogger?.({ direction: "sent", event, payload });
  }

  private handleMessage(raw: string): void {
    let frame: IncomingFrame;
    try {
      frame = JSON.parse(raw) as IncomingFrame;
    } catch {
      // eslint-disable-next-line no-console
      console.error("Received non-JSON WS frame, ignoring:", raw);
      return;
    }
    if (!frame.event) return;
    if (frame.event !== "LOG_EVENT") {
      wsLogger?.({ direction: "received", event: frame.event, payload: frame.payload });
    }
    if (frame.event === "AUTH_SESSION_EXPIRED") {
      // The server closes the socket right after this frame — retrying with
      // the same expired token would just repeat forever, so don't reconnect.
      this.authExpired = true;
    }
    const handlers = this.listeners.get(frame.event);
    handlers?.forEach((handler) => handler(frame.payload));
  }

  private scheduleReconnect(): void {
    this.setStatus("reconnecting");
    const delay = Math.min(
      BASE_RECONNECT_DELAY_MS * 2 ** this.reconnectAttempts,
      MAX_RECONNECT_DELAY_MS,
    );
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => this.open(), delay);
  }

  private setStatus(status: SocketStatus): void {
    this.status = status;
    this.statusListeners.forEach((listener) => listener(status));
  }
}

/** App-wide singleton — one socket per browser tab, matching the documented session model. */
export const socketClient = new SocketClient();
