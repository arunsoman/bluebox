import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings as SettingsIcon,
  KeyRound,
  Cpu,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Sparkles,
  Server,
  AlertCircle,
  RefreshCw,
  Save,
  Trash2,
} from 'lucide-react';
import GlassCard from '@/components/GlassCard';
import GlassButton from '@/components/GlassButton';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useBackendStatus } from '@/hooks/useBackendStatus';
import { FEATURES } from '@/lib/config';
import type { ProviderInfo, ModelOption } from '@/lib/api';

const easeSpring = [0.175, 0.885, 0.32, 1.275] as [number, number, number, number];

/* ─── provider accent colours ─── */
const PROVIDER_COLORS: Record<string, string> = {
  openai: '#00F5FF',
  anthropic: '#D4A574',
  google: '#4285F4',
  ollama: '#FF6B6B',
  deepseek: '#4DABF7',
};

/* ─── ProviderCard ─── */
function ProviderCard({
  provider,
  isExpanded,
  onToggle,
  pendingKey,
  onKeyChange,
  onSubmitKey,
  selectedModelId,
  onSelectModel,
}: {
  provider: ProviderInfo;
  isExpanded: boolean;
  onToggle: () => void;
  pendingKey: string;
  onKeyChange: (v: string) => void;
  onSubmitKey: () => void;
  selectedModelId: string | null;
  onSelectModel: (modelId: string) => void;
}) {
  const [showKey, setShowKey] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const color = PROVIDER_COLORS[provider.name] || '#8BA4C7';

  const handleSubmit = async () => {
    setSubmitting(true);
    await onSubmitKey();
    setSubmitting(false);
  };

  return (
    <GlassCard
      variant={provider.has_key ? 'bordered' : 'frosted'}
      padding="none"
      radius="lg"
      className="overflow-hidden"
      style={provider.has_key ? { borderLeft: `3px solid ${color}` } : undefined}
    >
      {/* Header — always visible */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-white/[0.02]"
      >
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${color}15`, border: `1px solid ${color}25` }}
        >
          <KeyRound size={18} style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-heading-md text-text-primary" style={{ fontSize: '15px' }}>
              {provider.display_name}
            </h3>
            {provider.has_key && (
              <span
                className="flex items-center gap-1 px-1.5 py-0.5 rounded-full font-body-sm"
                style={{ background: 'rgba(57,255,20,0.1)', color: '#39FF14', fontSize: '10px' }}
              >
                <Check size={8} /> Key Set
              </span>
            )}
            {!provider.requires_key && (
              <span
                className="px-1.5 py-0.5 rounded-full font-body-sm"
                style={{ background: 'rgba(0,245,255,0.08)', color: '#00F5FF', fontSize: '10px' }}
              >
                No Key
              </span>
            )}
          </div>
          <p className="font-body-sm text-text-tertiary mt-0.5">
            {provider.models.length} models available
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={provider.docs_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 rounded-md transition-colors hover:bg-white/5"
            style={{ color: '#4A6487' }}
            title="Get API key"
          >
            <ExternalLink size={14} />
          </a>
          {isExpanded ? (
            <ChevronUp size={16} style={{ color: '#8BA4C7' }} />
          ) : (
            <ChevronDown size={16} style={{ color: '#8BA4C7' }} />
          )}
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: easeSpring }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-4" style={{ borderTop: '1px solid rgba(138,180,230,0.06)' }}>
              {/* API Key input */}
              {provider.requires_key && (
                <div className="pt-4">
                  <label className="font-body-sm text-text-secondary block mb-2">
                    API Key <span className="text-text-tertiary">({provider.key_env_var})</span>
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showKey ? 'text' : 'password'}
                        value={pendingKey}
                        onChange={(e) => onKeyChange(e.target.value)}
                        placeholder={provider.has_key ? 'Key set — enter new to replace' : `Enter ${provider.display_name} API key`}
                        className="w-full px-3 py-2.5 rounded-lg font-mono-sm outline-none transition-all"
                        style={{
                          background: 'rgba(10,22,40,0.5)',
                          border: '1px solid rgba(138,180,230,0.1)',
                          color: '#E8F0FE',
                          fontSize: '12px',
                        }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = `${color}40`; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(138,180,230,0.1)'; }}
                      />
                      <button
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1"
                        style={{ color: '#4A6487' }}
                      >
                        {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    <GlassButton
                      variant="primary"
                      onClick={handleSubmit}
                      disabled={!pendingKey.trim() || submitting}
                      className="flex items-center gap-1.5 px-4"
                    >
                      {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                      <span className="font-heading-sm" style={{ fontSize: '12px' }}>Save</span>
                    </GlassButton>
                  </div>
                  <p className="font-body-sm mt-1.5" style={{ color: '#4A6487', fontSize: '11px' }}>
                    Your key is sent to the backend and never stored in the browser.
                    <a href={provider.docs_url} target="_blank" rel="noopener noreferrer" className="text-[#00F5FF] hover:underline ml-1">Get a key →</a>
                  </p>
                </div>
              )}

              {/* Models grid */}
              <div>
                <h4 className="font-heading-sm text-text-secondary mb-3" style={{ fontSize: '13px' }}>
                  Available Models
                </h4>
                <div className="grid grid-cols-1 gap-2">
                  {provider.models.map((model) => (
                    <ModelRow
                      key={model.id}
                      model={model}
                      isSelected={selectedModelId === model.id}
                      providerColor={color}
                      onSelect={() => onSelectModel(model.id)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}

/* ─── ModelRow ─── */
function ModelRow({
  model,
  isSelected,
  providerColor,
  onSelect,
}: {
  model: ModelOption;
  isSelected: boolean;
  providerColor: string;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className="flex items-center gap-3 p-3 rounded-lg text-left transition-all duration-200 w-full"
      style={{
        background: isSelected ? `${providerColor}10` : 'rgba(10,22,40,0.3)',
        border: isSelected ? `1px solid ${providerColor}40` : '1px solid rgba(138,180,230,0.06)',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.borderColor = 'rgba(138,180,230,0.15)';
      }}
      onMouseLeave={(e) => {
        if (!isSelected) e.currentTarget.style.borderColor = 'rgba(138,180,230,0.06)';
      }}
    >
      <div
        className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
        style={{
          borderColor: isSelected ? providerColor : 'rgba(138,180,230,0.2)',
        }}
      >
        {isSelected && <div className="w-2.5 h-2.5 rounded-full" style={{ background: providerColor }} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-heading-sm text-text-primary" style={{ fontSize: '13px' }}>
            {model.name}
          </span>
          {model.supports_streaming && (
            <span className="font-body-sm px-1 py-0.5 rounded" style={{ background: 'rgba(0,245,255,0.08)', color: '#00F5FF', fontSize: '9px' }}>
              STREAM
            </span>
          )}
          {model.supports_functions && (
            <span className="font-body-sm px-1 py-0.5 rounded" style={{ background: 'rgba(123,47,255,0.08)', color: '#7B2FFF', fontSize: '9px' }}>
              TOOLS
            </span>
          )}
        </div>
        <p className="font-body-sm text-text-tertiary truncate" style={{ fontSize: '11px' }}>
          {model.description}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="font-mono-sm text-text-tertiary" style={{ fontSize: '10px' }}>
          {model.max_tokens.toLocaleString()} tokens
        </p>
        {model.cost_per_1k_input && (
          <p className="font-mono-sm" style={{ color: '#8BA4C7', fontSize: '10px' }}>
            {model.cost_per_1k_input}/1k
          </p>
        )}
      </div>
    </button>
  );
}

/* ================================================================== */
/*  SETTINGS PAGE                                                      */
/* ================================================================== */
export default function Settings() {
  const {
    providers,
    providersLoading,
    providersError,
    selectedModelId,
    pendingKeys,
    fetchProviders,
    setPendingKey,
    submitKey,
    selectModel,
    clearModel,
  } = useSettingsStore();

  const backendStatus = useBackendStatus(30000);
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const handleSelectModel = useCallback(
    (providerName: string, modelId: string) => {
      selectModel(modelId, providerName);
    },
    [selectModel]
  );

  // Get selected model display info
  const selectedModelInfo = selectedModelId
    ? providers
        .flatMap((p) => p.models.map((m) => ({ ...m, provider: p.name, providerDisplay: p.display_name })))
        .find((m) => m.id === selectedModelId)
    : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(0,245,255,0.1)', border: '1px solid rgba(0,245,255,0.2)' }}
          >
            <SettingsIcon size={20} style={{ color: '#00F5FF' }} />
          </div>
          <div>
            <h1 className="font-display-md text-text-primary" style={{ fontSize: '22px' }}>
              Settings
            </h1>
            <p className="font-body-sm text-text-tertiary">Configure LLM providers and model selection</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {backendStatus.status === 'online' && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full font-body-sm" style={{ background: 'rgba(57,255,20,0.1)', color: '#39FF14', fontSize: '11px' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-[#39FF14]" />
              Backend Connected
            </span>
          )}
          {backendStatus.status === 'mock' && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full font-body-sm" style={{ background: 'rgba(255,184,0,0.1)', color: '#FFB800', fontSize: '11px' }}>
              <AlertCircle size={10} />
              Mock Mode
            </span>
          )}
        </div>
      </motion.div>

      {/* Selected Model Banner */}
      <AnimatePresence>
        {selectedModelInfo && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{
              background: 'rgba(0,245,255,0.06)',
              border: '1px solid rgba(0,245,255,0.2)',
            }}
          >
            <Sparkles size={18} style={{ color: '#00F5FF' }} />
            <div className="flex-1">
              <span className="font-body-sm text-text-secondary">
                Active model:{' '}
                <strong className="text-text-primary">{selectedModelInfo.name}</strong>
                {' — '}{selectedModelInfo.providerDisplay}
                {' — '}
                {selectedModelInfo.max_tokens.toLocaleString()} tokens
              </span>
            </div>
            <button
              onClick={clearModel}
              className="p-1.5 rounded-md transition-colors hover:bg-white/5"
              style={{ color: '#FF3366' }}
              title="Clear selection"
            >
              <Trash2 size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Providers list */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: easeSpring }}
        className="space-y-3"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-heading-md text-text-primary flex items-center gap-2">
            <Cpu size={16} style={{ color: '#00F5FF' }} />
            LLM Providers
          </h2>
          <button
            onClick={() => fetchProviders()}
            disabled={providersLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-body-sm transition-all hover:bg-white/5 disabled:opacity-50"
            style={{ color: '#8BA4C7', border: '1px solid rgba(138,180,230,0.1)' }}
          >
            <RefreshCw size={12} className={providersLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {providersError && (
          <div
            className="flex items-center gap-2 px-4 py-3 rounded-lg"
            style={{ background: 'rgba(255,51,102,0.08)', border: '1px solid rgba(255,51,102,0.2)' }}
          >
            <AlertCircle size={16} style={{ color: '#FF3366' }} />
            <span className="font-body-sm" style={{ color: '#FF3366' }}>{providersError}</span>
          </div>
        )}

        {providersLoading && providers.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw size={20} className="animate-spin" style={{ color: '#00F5FF' }} />
            <span className="font-body-sm text-text-secondary ml-3">Loading providers...</span>
          </div>
        ) : (
          providers.map((provider) => (
            <ProviderCard
              key={provider.name}
              provider={provider}
              isExpanded={expandedProvider === provider.name}
              onToggle={() =>
                setExpandedProvider(expandedProvider === provider.name ? null : provider.name)
              }
              pendingKey={pendingKeys[provider.name] || ''}
              onKeyChange={(v) => setPendingKey(provider.name, v)}
              onSubmitKey={() => submitKey(provider.name)}
              selectedModelId={selectedModelId}
              onSelectModel={(modelId) => handleSelectModel(provider.name, modelId)}
            />
          ))
        )}
      </motion.div>

      {/* Connection Info */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <GlassCard variant="clear" padding="md" radius="lg">
          <h3 className="font-heading-sm text-text-secondary mb-3 flex items-center gap-2">
            <Server size={14} />
            Connection Info
          </h3>
          <div className="space-y-2 font-mono-sm" style={{ fontSize: '12px', color: '#4A6487' }}>
            <div className="flex justify-between">
              <span>Backend Status</span>
              <span style={{ color: backendStatus.status === 'online' ? '#39FF14' : backendStatus.status === 'mock' ? '#FFB800' : '#FF3366' }}>
                {backendStatus.status.toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between">
              <span>API Mode</span>
              <span style={{ color: FEATURES.liveApi ? '#39FF14' : '#FFB800' }}>
                {FEATURES.liveApi ? 'LIVE' : 'MOCK'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>WebSocket Mode</span>
              <span style={{ color: FEATURES.liveWebSocket ? '#39FF14' : '#FFB800' }}>
                {FEATURES.liveWebSocket ? 'LIVE' : 'MOCK'}
              </span>
            </div>
            {backendStatus.latency !== null && (
              <div className="flex justify-between">
                <span>Latency</span>
                <span style={{ color: '#00F5FF' }}>{backendStatus.latency}ms</span>
              </div>
            )}
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}
