/**
 * Centralized runtime config. Fails fast at startup if a required env var
 * is missing, instead of letting `undefined` leak into URLs at call time.
 */
function readEnv(key: string, fallback?: string): string {
  const value = import.meta.env[key] as string | undefined;
  if (value !== undefined && value !== "") return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required environment variable: ${key}`);
}

export const env = {
  apiBaseUrl: readEnv("VITE_API_BASE_URL", "http://localhost:8000"),
  wsBaseUrl: readEnv("VITE_WS_BASE_URL", "ws://localhost:8000"),
  sessionReauthIdleMinutes: Number(
    readEnv("VITE_SESSION_REAUTH_IDLE_MINUTES", "60"),
  ),
} as const;
