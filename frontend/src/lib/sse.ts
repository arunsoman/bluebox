// =============================================================================
// Collaborative Steering Pipeline — SSE Manager
// Native EventSource wrapper for server-sent events
// =============================================================================

export class SSEManager {
  private es: EventSource | null = null;
  private listeners: Map<string, Set<(data: unknown) => void>> = new Map();
  private currentSessionId: string | null = null;

  /** Connect to SSE stream for a session */
  connect(sessionId: string): void {
    this.disconnect();
    this.currentSessionId = sessionId;
    const es = new EventSource(`/api/v1/pipeline/${sessionId}/events`);
    this.es = es;

    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.event && parsed.data !== undefined) {
          this.emit(parsed.event, parsed.data);
        }
      } catch {
        // Ping or malformed — ignore
      }
    };

    es.onerror = () => {
      // Auto-reconnect is handled natively by EventSource
    };

    es.onopen = () => {
      // Connection established
    };
  }

  /** Subscribe to an event type. Returns unsubscribe function. */
  on(event: string, handler: (data: unknown) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    return () => {
      this.listeners.get(event)?.delete(handler);
    };
  }

  /** Subscribe to all events with a wildcard handler */
  onAny(handler: (event: string, data: unknown) => void): () => void {
    const wrapper = (event: string, data: unknown) => handler(event, data);
    if (!this.listeners.has('__any__')) {
      this.listeners.set('__any__', new Set());
    }
    this.listeners.get('__any__')!.add(wrapper as (data: unknown) => void);
    return () => {
      this.listeners.get('__any__')?.delete(wrapper as (data: unknown) => void);
    };
  }

  private emit(event: string, data: unknown): void {
    this.listeners.get(event)?.forEach((h) => h(data));
    this.listeners.get('__any__')?.forEach((h) => h(data));
  }

  /** Disconnect from SSE stream */
  disconnect(): void {
    if (this.es) {
      this.es.close();
      this.es = null;
    }
    this.currentSessionId = null;
  }

  /** Get current connection state */
  isConnected(): boolean {
    return this.es !== null && this.es.readyState === EventSource.OPEN;
  }

  /** Get the current session ID */
  getSessionId(): string | null {
    return this.currentSessionId;
  }
}

/** Singleton instance */
export const sseManager = new SSEManager();
