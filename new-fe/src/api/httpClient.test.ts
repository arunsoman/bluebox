import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  configureAuthTokenProvider,
  configureNetworkLogger,
  configureUnauthorizedHandler,
  http,
} from "./httpClient";

function mockFetchOnce(response: Partial<Response> & { jsonBody?: unknown }) {
  const { jsonBody, ...rest } = response;
  const fakeResponse = {
    ok: rest.ok ?? true,
    status: rest.status ?? 200,
    statusText: rest.statusText ?? "OK",
    headers: rest.headers ?? new Headers({ "content-type": "application/json" }),
    text: vi.fn().mockResolvedValue(jsonBody === undefined ? "" : JSON.stringify(jsonBody)),
  } as unknown as Response;
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fakeResponse));
  return fakeResponse;
}

describe("httpClient", () => {
  beforeEach(() => {
    configureAuthTokenProvider(() => null);
    configureUnauthorizedHandler(() => {});
    configureNetworkLogger(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds the request URL with query parameters, skipping undefined values", async () => {
    mockFetchOnce({ jsonBody: { ok: true } });
    await http.get("/api/v1/projects", { status: "active", limit: undefined, offset: 0 });

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const calledUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(calledUrl.pathname).toBe("/api/v1/projects");
    expect(calledUrl.searchParams.get("status")).toBe("active");
    expect(calledUrl.searchParams.has("limit")).toBe(false);
    expect(calledUrl.searchParams.get("offset")).toBe("0");
  });

  it("attaches the bearer token from the configured auth provider", async () => {
    configureAuthTokenProvider(() => "test-token-123");
    mockFetchOnce({ jsonBody: {} });

    await http.get("/api/v1/auth/me");

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-token-123");
  });

  it("throws ApiError with the parsed message on a non-ok response", async () => {
    mockFetchOnce({ ok: false, status: 400, statusText: "Bad Request", jsonBody: { message: "Invalid input", code: "VAL-E01" } });

    await expect(http.get("/api/v1/projects")).rejects.toMatchObject({
      message: "Invalid input",
      status: 400,
      code: "VAL-E01",
    });
  });

  it("throws ApiError instances specifically", async () => {
    mockFetchOnce({ ok: false, status: 500, statusText: "Server Error", jsonBody: {} });
    await expect(http.get("/api/v1/projects")).rejects.toBeInstanceOf(ApiError);
  });

  it("calls the unauthorized handler on a 401 response", async () => {
    const onUnauthorized = vi.fn();
    configureUnauthorizedHandler(onUnauthorized);
    mockFetchOnce({ ok: false, status: 401, statusText: "Unauthorized", jsonBody: {} });

    await expect(http.get("/api/v1/projects")).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("returns undefined for a 204 No Content response without parsing a body", async () => {
    mockFetchOnce({ status: 204 });
    const result = await http.delete("/api/v1/projects/abc");
    expect(result).toBeUndefined();
  });

  it("reports a network log entry with trace id, status, and duration", async () => {
    const onLog = vi.fn();
    configureNetworkLogger(onLog);
    mockFetchOnce({ jsonBody: { ok: true } });

    await http.post("/api/v1/projects", { project_name: "X" });

    expect(onLog).toHaveBeenCalledOnce();
    const entry = onLog.mock.calls[0][0];
    expect(entry.method).toBe("POST");
    expect(entry.status).toBe(200);
    expect(entry.requestBody).toEqual({ project_name: "X" });
    expect(entry.responseBody).toBe(JSON.stringify({ ok: true }));
    expect(typeof entry.traceId).toBe("string");
    expect(entry.traceId.length).toBeGreaterThan(0);
    expect(typeof entry.durationMs).toBe("number");

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers["X-Debug-Trace-Id"]).toBe(entry.traceId);
  });
});
