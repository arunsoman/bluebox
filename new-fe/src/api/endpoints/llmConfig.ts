/**
 * GET /api/v1/llm/providers - not part of doc/api_event_contract.md (the
 * spec predates this feature). Backs the AI Config popup (Ctrl+M): which
 * providers are usable depends on which API keys are set in the backend's
 * environment, so the popup asks the backend rather than hardcoding a guess.
 */
import { http } from "@/api/httpClient";

export interface AiProviderInfo {
  provider_id: string;
  display_name: string;
  configured: boolean;
  suggested_models: string[];
}

export interface AiProviderListResponse {
  providers: AiProviderInfo[];
}

export const llmConfigApi = {
  getProviders: () => http.get<AiProviderListResponse>("/api/v1/llm/providers"),
};
