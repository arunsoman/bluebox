"""LLM provider management — models, keys, and configuration."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ModelInfo:
    """Information about an available LLM model."""

    id: str
    name: str
    provider: str
    description: str = ""
    max_tokens: int = 4096
    supports_streaming: bool = True
    supports_functions: bool = False
    cost_per_1k_input: Optional[str] = None
    cost_per_1k_output: Optional[str] = None


@dataclass
class ProviderConfig:
    """Configuration for an LLM provider."""

    name: str
    display_name: str
    key_env_var: str
    base_url_env_var: Optional[str] = None
    models: list[ModelInfo] = field(default_factory=list)
    requires_key: bool = True
    key_prefix: str = ""
    docs_url: str = ""


# ─── Built-in provider definitions ───

OPENAI_MODELS = [
    ModelInfo("gpt-4o", "GPT-4o", "openai", "Most capable multimodal model", 128000, True, True, "$5.00", "$15.00"),
    ModelInfo("gpt-4o-mini", "GPT-4o Mini", "openai", "Fast, affordable for most tasks", 128000, True, True, "$0.15", "$0.60"),
    ModelInfo("gpt-4-turbo", "GPT-4 Turbo", "openai", "Legacy high-capability model", 128000, True, True, "$10.00", "$30.00"),
    ModelInfo("gpt-4", "GPT-4", "openai", "Original GPT-4", 8192, True, True, "$30.00", "$60.00"),
    ModelInfo("gpt-3.5-turbo", "GPT-3.5 Turbo", "openai", "Fast and cost-effective", 16384, True, True, "$0.50", "$1.50"),
]

ANTHROPIC_MODELS = [
    ModelInfo("claude-sonnet-4-20250514", "Claude 4 Sonnet", "anthropic", "Best balance of speed and intelligence", 200000, True, True, "$3.00", "$15.00"),
    ModelInfo("claude-opus-4-20250514", "Claude 4 Opus", "anthropic", "Highest capability for complex tasks", 200000, True, True, "$15.00", "$75.00"),
    ModelInfo("claude-3-5-sonnet-20241022", "Claude 3.5 Sonnet", "anthropic", "Fast and capable", 200000, True, True, "$3.00", "$15.00"),
    ModelInfo("claude-3-5-haiku-20241022", "Claude 3.5 Haiku", "anthropic", "Fastest Claude model", 200000, True, False, "$0.80", "$4.00"),
]

GOOGLE_MODELS = [
    ModelInfo("gemini-2.5-pro", "Gemini 2.5 Pro", "google", "Google's most capable model", 1000000, True, True, "$1.25", "$10.00"),
    ModelInfo("gemini-2.0-flash", "Gemini 2.0 Flash", "google", "Fast multimodal model", 1000000, True, True, "$0.10", "$0.40"),
    ModelInfo("gemini-1.5-pro", "Gemini 1.5 Pro", "google", "Long context model", 2000000, True, True, "$1.25", "$5.00"),
]

OLLAMA_MODELS = [
    ModelInfo("llama3.3", "Llama 3.3", "ollama", "Meta's Llama 3.3 (local)", 128000, True, False, "Free", "Free"),
    ModelInfo("llama3.2", "Llama 3.2", "ollama", "Meta's Llama 3.2 (local)", 128000, True, False, "Free", "Free"),
    ModelInfo("qwen2.5", "Qwen 2.5", "ollama", "Alibaba's Qwen 2.5 (local)", 128000, True, False, "Free", "Free"),
    ModelInfo("mistral", "Mistral", "ollama", "Mistral 7B (local)", 32768, True, False, "Free", "Free"),
    ModelInfo("codellama", "Code Llama", "ollama", "Code-specialized Llama (local)", 16384, True, False, "Free", "Free"),
    ModelInfo("phi4", "Phi-4", "ollama", "Microsoft's Phi-4 (local)", 16384, True, False, "Free", "Free"),
]

DEEPSEEK_MODELS = [
    ModelInfo("deepseek-chat", "DeepSeek V3", "deepseek", "General purpose chat", 64000, True, True, "$0.14", "$0.28"),
    ModelInfo("deepseek-reasoner", "DeepSeek R1", "deepseek", "Reasoning-specialized", 64000, True, True, "$0.55", "$2.19"),
]

PROVIDERS: dict[str, ProviderConfig] = {
    "openai": ProviderConfig(
        name="openai",
        display_name="OpenAI",
        key_env_var="OPENAI_API_KEY",
        models=OPENAI_MODELS,
        key_prefix="sk-",
        docs_url="https://platform.openai.com/api-keys",
    ),
    "anthropic": ProviderConfig(
        name="anthropic",
        display_name="Anthropic",
        key_env_var="ANTHROPIC_API_KEY",
        models=ANTHROPIC_MODELS,
        key_prefix="sk-ant-",
        docs_url="https://console.anthropic.com/settings/keys",
    ),
    "google": ProviderConfig(
        name="google",
        display_name="Google AI",
        key_env_var="GOOGLE_API_KEY",
        base_url_env_var="GOOGLE_BASE_URL",
        models=GOOGLE_MODELS,
        docs_url="https://aistudio.google.com/app/apikey",
    ),
    "ollama": ProviderConfig(
        name="ollama",
        display_name="Ollama (Local)",
        key_env_var="OLLAMA_HOST",
        base_url_env_var="OLLAMA_HOST",
        models=OLLAMA_MODELS,
        requires_key=False,
        docs_url="https://ollama.com/library",
    ),
    "deepseek": ProviderConfig(
        name="deepseek",
        display_name="DeepSeek",
        key_env_var="DEEPSEEK_API_KEY",
        base_url_env_var="DEEPSEEK_BASE_URL",
        models=DEEPSEEK_MODELS,
        docs_url="https://platform.deepseek.com/api_keys",
    ),
}


# ─── Runtime provider key storage ───
# In production, use a proper secrets manager. This is in-memory for simplicity.
_user_provider_keys: dict[str, str] = {}


def get_available_providers() -> list[dict]:
    """Return all providers with their available models and key status."""
    result = []
    for key, provider in PROVIDERS.items():
        # Check if key is set (env or runtime)
        env_key = os.environ.get(provider.key_env_var, "")
        runtime_key = _user_provider_keys.get(key, "")
        has_key = bool(env_key or runtime_key)

        result.append({
            "name": provider.name,
            "display_name": provider.display_name,
            "has_key": has_key,
            "requires_key": provider.requires_key,
            "key_env_var": provider.key_env_var,
            "docs_url": provider.docs_url,
            "models": [
                {
                    "id": m.id,
                    "name": m.name,
                    "description": m.description,
                    "max_tokens": m.max_tokens,
                    "supports_streaming": m.supports_streaming,
                    "supports_functions": m.supports_functions,
                    "cost_per_1k_input": m.cost_per_1k_input,
                    "cost_per_1k_output": m.cost_per_1k_output,
                }
                for m in provider.models
            ],
        })
    return result


def get_active_models() -> list[dict]:
    """Return only models from providers that have keys configured."""
    result = []
    for key, provider in PROVIDERS.items():
        env_key = os.environ.get(provider.key_env_var, "")
        runtime_key = _user_provider_keys.get(key, "")
        if env_key or runtime_key or not provider.requires_key:
            for m in provider.models:
                result.append({
                    "id": m.id,
                    "name": m.name,
                    "provider": provider.name,
                    "provider_display": provider.display_name,
                    "description": m.description,
                    "max_tokens": m.max_tokens,
                    "cost_per_1k_input": m.cost_per_1k_input,
                    "cost_per_1k_output": m.cost_per_1k_output,
                })
    return result


def set_provider_key(provider_name: str, api_key: str) -> bool:
    """Set a provider API key at runtime."""
    if provider_name not in PROVIDERS:
        return False
    if not api_key.strip():
        return False
    _user_provider_keys[provider_name] = api_key.strip()
    return True


def get_provider_key(provider_name: str) -> str:
    """Get the effective API key for a provider (env > runtime)."""
    provider = PROVIDERS.get(provider_name)
    if not provider:
        return ""
    env_key = os.environ.get(provider.key_env_var, "")
    runtime_key = _user_provider_keys.get(provider_name, "")
    return env_key or runtime_key


def get_model_config(model_id: str) -> dict | None:
    """Get configuration for a specific model."""
    for provider in PROVIDERS.values():
        for model in provider.models:
            if model.id == model_id:
                return {
                    "id": model.id,
                    "name": model.name,
                    "provider": provider.name,
                    "provider_display": provider.display_name,
                    "api_key": get_provider_key(provider.name),
                    "base_url": os.environ.get(provider.base_url_env_var, "") if provider.base_url_env_var else "",
                    "max_tokens": model.max_tokens,
                }
    return None
