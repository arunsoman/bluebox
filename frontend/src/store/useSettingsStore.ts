/**
 * Settings store — manages LLM provider keys, model selection, and app config.
 *
 * Keys are stored in memory only (not persisted to localStorage for security).
 * The selected model is persisted to localStorage.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { listProviders, setProviderKey } from '@/lib/api';
import { FEATURES } from '@/lib/config';
import type { ProviderInfo } from '@/lib/api';

interface SettingsState {
  providers: ProviderInfo[];
  providersLoading: boolean;
  providersError: string | null;
  selectedModelId: string | null;
  selectedProvider: string | null;
  pendingKeys: Record<string, string>;

  fetchProviders: () => Promise<void>;
  setPendingKey: (provider: string, key: string) => void;
  submitKey: (provider: string) => Promise<boolean>;
  selectModel: (modelId: string, provider: string) => void;
  clearModel: () => void;
}

const MOCK_PROVIDERS: ProviderInfo[] = [
  {
    name: 'openai', display_name: 'OpenAI', has_key: false, requires_key: true,
    key_env_var: 'OPENAI_API_KEY', docs_url: 'https://platform.openai.com/api-keys',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable multimodal model', max_tokens: 128000, supports_streaming: true, supports_functions: true, cost_per_1k_input: '$5.00', cost_per_1k_output: '$15.00' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast, affordable for most tasks', max_tokens: 128000, supports_streaming: true, supports_functions: true, cost_per_1k_input: '$0.15', cost_per_1k_output: '$0.60' },
      { id: 'gpt-4', name: 'GPT-4', description: 'Original GPT-4', max_tokens: 8192, supports_streaming: true, supports_functions: true, cost_per_1k_input: '$30.00', cost_per_1k_output: '$60.00' },
    ],
  },
  {
    name: 'anthropic', display_name: 'Anthropic', has_key: false, requires_key: true,
    key_env_var: 'ANTHROPIC_API_KEY', docs_url: 'https://console.anthropic.com/settings/keys',
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude 4 Sonnet', description: 'Best balance of speed and intelligence', max_tokens: 200000, supports_streaming: true, supports_functions: true, cost_per_1k_input: '$3.00', cost_per_1k_output: '$15.00' },
      { id: 'claude-opus-4-20250514', name: 'Claude 4 Opus', description: 'Highest capability for complex tasks', max_tokens: 200000, supports_streaming: true, supports_functions: true, cost_per_1k_input: '$15.00', cost_per_1k_output: '$75.00' },
    ],
  },
  {
    name: 'google', display_name: 'Google AI', has_key: false, requires_key: true,
    key_env_var: 'GOOGLE_API_KEY', docs_url: 'https://aistudio.google.com/app/apikey',
    models: [
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: "Google's most capable model", max_tokens: 1000000, supports_streaming: true, supports_functions: true, cost_per_1k_input: '$1.25', cost_per_1k_output: '$10.00' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Fast multimodal model', max_tokens: 1000000, supports_streaming: true, supports_functions: true, cost_per_1k_input: '$0.10', cost_per_1k_output: '$0.40' },
    ],
  },
  {
    name: 'ollama', display_name: 'Ollama Cloud', has_key: false, requires_key: true,
    key_env_var: 'OLLAMA_API_KEY', docs_url: 'https://ollama.com/signin',
    models: [
      { id: 'deepseek-v4-flash:cloud', name: 'DeepSeek V4 Flash', description: 'Fast cloud model via Ollama Cloud', max_tokens: 64000, supports_streaming: true, supports_functions: false, cost_per_1k_input: '$0.14', cost_per_1k_output: '$0.28' },
      { id: 'glm-5:cloud', name: 'GLM 5', description: 'Zhipu GLM-5 via Ollama Cloud', max_tokens: 32000, supports_streaming: true, supports_functions: false, cost_per_1k_input: '$0.10', cost_per_1k_output: '$0.25' },
      { id: 'qwen-3:cloud', name: 'Qwen 3', description: 'Alibaba Qwen-3 via Ollama Cloud', max_tokens: 128000, supports_streaming: true, supports_functions: false, cost_per_1k_input: '$0.12', cost_per_1k_output: '$0.30' },
    ],
  },
  {
    name: 'deepseek', display_name: 'DeepSeek', has_key: false, requires_key: true,
    key_env_var: 'DEEPSEEK_API_KEY', docs_url: 'https://platform.deepseek.com/api_keys',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek V3', description: 'General purpose chat', max_tokens: 64000, supports_streaming: true, supports_functions: true, cost_per_1k_input: '$0.14', cost_per_1k_output: '$0.28' },
      { id: 'deepseek-reasoner', name: 'DeepSeek R1', description: 'Reasoning-specialized', max_tokens: 64000, supports_streaming: true, supports_functions: true, cost_per_1k_input: '$0.55', cost_per_1k_output: '$2.19' },
    ],
  },
];

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      providers: [],
      providersLoading: false,
      providersError: null,
      selectedModelId: null,
      selectedProvider: null,
      pendingKeys: {},

      fetchProviders: async () => {
        set({ providersLoading: true, providersError: null });
        try {
          if (FEATURES.liveApi) {
            try {
              const data = await listProviders();
              set({ providers: data.providers, providersLoading: false });
              return;
            } catch {
              /* Backend unreachable — fall through to mock */
            }
          }
          set({ providers: MOCK_PROVIDERS, providersLoading: false });
        } catch (err) {
          set({
            providersError: err instanceof Error ? err.message : 'Failed to load providers',
            providersLoading: false,
          });
        }
      },

      setPendingKey: (provider: string, key: string) =>
        set((state) => ({ pendingKeys: { ...state.pendingKeys, [provider]: key } })),

      submitKey: async (provider: string) => {
        const key = get().pendingKeys[provider];
        if (!key?.trim()) return false;
        try {
          if (FEATURES.liveApi) {
            await setProviderKey(provider, key.trim());
          }
          await get().fetchProviders();
          set((state) => {
            const pk = { ...state.pendingKeys };
            delete pk[provider];
            return { pendingKeys: pk };
          });
          return true;
        } catch (err) {
          set({ providersError: err instanceof Error ? err.message : 'Failed to set key' });
          return false;
        }
      },

      selectModel: (modelId: string, provider: string) =>
        set({ selectedModelId: modelId, selectedProvider: provider }),

      clearModel: () => set({ selectedModelId: null, selectedProvider: null }),
    }),
    {
      name: 'bluebox-settings',
      partialize: (state) => ({
        selectedModelId: state.selectedModelId,
        selectedProvider: state.selectedProvider,
      }),
    }
  )
);
