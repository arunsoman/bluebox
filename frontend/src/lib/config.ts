/**
 * Frontend configuration — reads from Vite environment variables.
 *
 * In development (vite):     uses `.env` or `.env.local` in frontend/
 * In production (Netlify):   uses build-time env vars set in Netlify dashboard
 *
 * All env vars exposed to the browser must be prefixed with VITE_.
 */

// API base URL — points to the backend
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// WebSocket base URL — falls back to same host as API
export const WS_BASE_URL = import.meta.env.VITE_WS_URL || API_BASE_URL.replace(/^http/, 'ws');

// API version prefix
export const API_PREFIX = '/api/v1';

// Full REST API URL
export const API_URL = `${API_BASE_URL}${API_PREFIX}`;

// Full WebSocket URL
export const WS_URL = `${WS_BASE_URL}/ws`;

// App info
export const APP_NAME = 'Bluebox — Collaborative Steering Pipeline';
export const APP_VERSION = '1.0.0';

// Feature flags (set via env to enable/disable features)
export const FEATURES = {
  // Enable real WebSocket connection (false = use mock data)
  liveWebSocket: import.meta.env.VITE_LIVE_WS === 'true',
  // Enable real API calls (false = use mock data)
  liveApi: import.meta.env.VITE_LIVE_API === 'true',
  // Show debug panels
  debug: import.meta.env.VITE_DEBUG === 'true',
};

// Environment
export const IS_PRODUCTION = import.meta.env.PROD;
export const IS_DEVELOPMENT = import.meta.env.DEV;
