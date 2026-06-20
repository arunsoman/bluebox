import { env } from "@/config/env";
import { useAiStore } from "@/stores/aiStore";

/**
 * Single choke point for every REST call. No component or store may call
 * `fetch` directly — this guarantees consistent auth headers, error shapes,
 * and base-URL handling, and keeps "no mock data" auditable (grep for
 * `fetch(` outside this file should return nothing in src/).
 */

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type AuthTokenProvider = () => string | null;

let authTokenProvider: AuthTokenProvider = () => null;

/** authStore registers itself here at startup to avoid a circular import. */
export function configureAuthTokenProvider(provider: AuthTokenProvider): void {
  authTokenProvider = provider;
}

let unauthorizedHandler: (() => void) | null = null;

/** authStore registers a callback to force logout on 401, avoiding a circular import. */
export function configureUnauthorizedHandler(handler: () => void): void {
  unauthorizedHandler = handler;
}

/**
 * One entry per REST call, for the log viewer (`logViewerStore`) -
 * `traceId` is sent as the `X-Debug-Trace-Id` header so the backend's
 * `http_received_by_backend` entry for the same call can be correlated with
 * this `http_sent_by_client` one (be/src/bluebox/shared_kernel/observability/).
 */
export interface NetworkLogEntry {
  traceId: string;
  method: string;
  url: string;
  requestBody: unknown;
  status: number;
  responseBody: string;
  durationMs: number;
}

type NetworkLogger = (entry: NetworkLogEntry) => void;

let networkLogger: NetworkLogger | null = null;

/** logViewerStore registers itself here at startup to avoid a circular import. */
export function configureNetworkLogger(logger: NetworkLogger): void {
  networkLogger = logger;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /**
   * Typed `unknown` rather than `Record<string, unknown>` deliberately:
   * every endpoint module passes a concrete DTO interface (no index
   * signature) here, and TS only allows that without a cast when the
   * parameter type itself isn't an index-signature type.
   */
  query?: unknown;
  body?: unknown;
  /** Use for multipart/form-data uploads (PRD api_event_contract.md §2.1 file uploads). */
  formData?: FormData;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: unknown): string {
  const url = new URL(path.replace(/^\//, ""), `${env.apiBaseUrl}/`);
  if (query && typeof query === "object") {
    for (const [key, value] of Object.entries(query as Record<string, unknown>)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, Array.isArray(value) ? value.join(",") : String(value));
    }
  }
  return url.toString();
}

function parseErrorBody(
  bodyText: string,
  res: Response,
): { message: string; code?: string; details?: unknown } {
  try {
    const data = JSON.parse(bodyText);
    if (data && typeof data === "object") {
      const message =
        (typeof data.message === "string" && data.message) ||
        (typeof data.error === "string" && data.error) ||
        res.statusText;
      const code = typeof data.code === "string" || typeof data.error_code === "string"
        ? (data.code as string) ?? (data.error_code as string)
        : undefined;
      return { message, code, details: data };
    }
  } catch {
    // Body wasn't JSON — fall through to status text.
  }
  return { message: res.statusText || `Request failed with status ${res.status}` };
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", query, body, formData, signal } = options;
  const headers: Record<string, string> = {};
  const token = authTokenProvider();
  if (token) headers.Authorization = `Bearer ${token}`;

  // Inject AI provider/model headers from global store
  const { provider, model } = useAiStore.getState();
  headers["X-AI-Provider"] = provider;
  headers["X-AI-Model"] = model;

  const traceId = crypto.randomUUID();
  headers["X-Debug-Trace-Id"] = traceId;

  let requestBody: BodyInit | undefined;
  if (formData) {
    requestBody = formData;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    requestBody = JSON.stringify(body);
  }

  const url = buildUrl(path, query);
  const startedAt = performance.now();
  const res = await fetch(url, {
    method,
    headers,
    body: requestBody,
    signal,
  });
  // Read the body once, as text - both the JSON parse below and the
  // logger need it, and a real Response can't be read twice.
  const bodyText = res.status === 204 ? "" : await res.text();
  const durationMs = performance.now() - startedAt;

  networkLogger?.({
    traceId,
    method,
    url,
    requestBody: formData ? "[form data]" : body,
    status: res.status,
    responseBody: bodyText,
    durationMs,
  });

  if (res.status === 401) {
    unauthorizedHandler?.();
  }

  if (!res.ok) {
    const { message, code, details } = parseErrorBody(bodyText, res);
    throw new ApiError(message, res.status, code, details);
  }

  if (!bodyText) {
    return undefined as T;
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return undefined as T;
  }
  return JSON.parse(bodyText) as T;
}

export const http = {
  get: <T>(path: string, query?: RequestOptions["query"], signal?: AbortSignal) =>
    request<T>(path, { method: "GET", query, signal }),
  post: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    request<T>(path, { method: "POST", body, signal }),
  postForm: <T>(path: string, formData: FormData, signal?: AbortSignal) =>
    request<T>(path, { method: "POST", formData, signal }),
  put: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    request<T>(path, { method: "PUT", body, signal }),
  patch: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    request<T>(path, { method: "PATCH", body, signal }),
  delete: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    request<T>(path, { method: "DELETE", body, signal }),
};
