/**
 * doc/api_event_contract.md §1 — Authentication & Session
 * SSO, biometric, voice deferred per approved scope; UI renders disabled.
 */
import { http } from "@/api/httpClient";

export const authApi = {
  login: (body: LoginRequest) =>
    http.post<LoginResponse>("/api/v1/auth/login", body),

  me: () => http.get<UserProfile>("/api/v1/auth/me"),

  /** Guest session — limited 24h, no export/checkpoint */
  guest: () => http.post<GuestSession>("/api/v1/auth/guest"),
};
