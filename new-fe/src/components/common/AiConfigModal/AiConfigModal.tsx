import styles from './AiConfigModal.module.css';
import { useState, useEffect, useCallback } from 'react';
import { useAiStore } from '@/stores/aiStore';

interface AiConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AiConfigModal({ isOpen, onClose }: AiConfigModalProps) {
  const {
    provider: currentProvider,
    model: currentModel,
    providers,
    providersLoaded,
    setAiConfig,
    fetchProviders,
  } = useAiStore();
  const [provider, setProvider] = useState(currentProvider);
  const [model, setModel] = useState(currentModel);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Reset form when modal opens, and (re)fetch the provider list so
  // "configured" reflects whatever credentials the backend currently has.
  useEffect(() => {
    if (!isOpen) return;
    setProvider(currentProvider);
    setModel(currentModel);
    setFetchError(null);
    fetchProviders().catch((err) => {
      setFetchError(err instanceof Error ? err.message : 'Failed to load providers');
    });
  }, [isOpen, currentProvider, currentModel, fetchProviders]);

  const handleSave = useCallback(() => {
    setAiConfig(provider, model);
    onClose();
  }, [provider, model, setAiConfig, onClose]);

  const selectedProviderInfo = providers.find((p) => p.provider_id === provider);
  const suggestedModels = selectedProviderInfo?.suggested_models ?? [];

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleSave, onClose]);

  if (!isOpen) return null;

  return (
    <div className={styles['ai-config-modal-overlay']} onClick={onClose}>
      <div className={styles['ai-config-modal']} onClick={(e) => e.stopPropagation()}>
        <div className={styles['ai-config-modal-header']}>
          <h2>AI Provider & Model</h2>
          <button className={styles['ai-config-modal-close']} onClick={onClose} title="Close (Esc)">
            ✕
          </button>
        </div>

        <div className={styles['ai-config-modal-body']}>
          <div className={styles['ai-config-form-group']}>
            <label htmlFor="ai-provider">Provider</label>
            <select
              id="ai-provider"
              value={provider}
              onChange={(e) => {
                const next = e.target.value;
                setProvider(next);
                const nextModels = providers.find((p) => p.provider_id === next)?.suggested_models;
                if (nextModels && nextModels.length > 0) {
                  setModel(nextModels[0]);
                }
              }}
              className={styles['ai-config-select']}
              disabled={!providersLoaded}
            >
              {!providersLoaded && <option>Loading providers…</option>}
              {providers.map((p) => (
                <option key={p.provider_id} value={p.provider_id} disabled={!p.configured}>
                  {p.display_name}
                  {!p.configured ? ' (not configured)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className={styles['ai-config-form-group']}>
            <label htmlFor="ai-model">Model</label>
            <input
              id="ai-model"
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Enter a model id"
              list="ai-config-model-suggestions"
              className={styles['ai-config-select']}
            />
            <datalist id="ai-config-model-suggestions">
              {suggestedModels.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>

          <div className={styles['ai-config-current']}>
            <p>
              <strong>Active:</strong> {currentProvider}:{currentModel}
            </p>
          </div>

          {fetchError && (
            <div className={styles['ai-config-hint']}>
              <p>Could not load provider list: {fetchError}</p>
            </div>
          )}

          <div className={styles['ai-config-hint']}>
            <p>
              <small>
                Press <kbd>Ctrl+M</kbd> to open this dialog. Changes apply to all subsequent API
                requests. Only providers with credentials configured on the backend are
                selectable; type any model id the chosen provider supports.
              </small>
            </p>
          </div>
        </div>

        <div className={styles['ai-config-modal-footer']}>
          <button className={`${styles['ai-config-btn']} ${styles['ai-config-btn-secondary']}`} onClick={onClose}>
            Cancel
          </button>
          <button className={`${styles['ai-config-btn']} ${styles['ai-config-btn-primary']}`} onClick={handleSave}>
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
}
