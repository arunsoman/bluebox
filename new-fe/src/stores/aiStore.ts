import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { llmConfigApi, type AiProviderInfo } from '@/api/endpoints/llmConfig';

interface AiState {
  provider: string;
  model: string;
  providers: AiProviderInfo[];
  providersLoaded: boolean;
  setAiConfig: (provider: string, model: string) => void;
  fetchProviders: () => Promise<void>;
}

export const useAiStore = create<AiState>()(
  persist(
    (set, get) => ({
      provider: 'openai',
      model: 'gpt-4o',
      providers: [],
      providersLoaded: false,
      setAiConfig: (provider, model) => set({ provider, model }),
      fetchProviders: async () => {
        const { providers } = await llmConfigApi.getProviders();
        set({ providers, providersLoaded: true });

        // First-ever load with no persisted choice pointed at a configured
        // provider yet: default to the first one the backend actually has
        // credentials for, instead of leaving the picker on a dead default.
        const current = get().provider;
        const currentIsConfigured = providers.some(
          (p) => p.provider_id === current && p.configured
        );
        if (!currentIsConfigured) {
          const firstConfigured = providers.find((p) => p.configured);
          if (firstConfigured) {
            set({
              provider: firstConfigured.provider_id,
              model: firstConfigured.suggested_models[0] ?? get().model,
            });
          }
        }
      },
    }),
    {
      name: 'ai-config-storage',
      partialize: (state) => ({ provider: state.provider, model: state.model }),
    }
  )
);
