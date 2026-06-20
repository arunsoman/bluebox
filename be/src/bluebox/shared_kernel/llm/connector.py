"""Provider-agnostic pydantic-ai Agent factory.

doc/prd.md SS6.3 requires the LLM integration layer to be swappable across
providers (`LLMClientInterface`). `PROVIDERS` below is the single registry of
what this deployment can talk to; everything else (the `/api/v1/llm/providers`
endpoint, the frontend's AI Config popup, env-var defaults, per-request
header overrides) reads from it.

Two ways a provider can work:
1. **Native** (`pydantic_ai_prefix` set): pydantic-ai already ships a
   `Provider`/`Model` class for it (anthropic, openai, google-gla, groq,
   ollama, ...) and knows how to read its own conventional API-key/base-url
   env vars. We just pass `"<prefix>:<model>"` through to pydantic-ai's own
   `infer_model` - this means any of the ~30 providers pydantic-ai supports
   works the moment its API key env var is set, with zero code changes here.
2. **Generic OpenAI-compatible** (`pydantic_ai_prefix` left `None`): no
   dedicated pydantic-ai class exists (e.g. NVIDIA NIM), but the endpoint
   speaks the OpenAI chat-completions API, so we build an `OpenAIChatModel`
   pointed at `base_url_env`/`api_key_env` ourselves. Adding a new provider
   of this kind is one `PROVIDERS` entry, not a code change.

Model resolution happens in two places, at different times, going through
two different functions:
- `build_agent` binds the env-var default (`BLUEBOX_LLM_MODEL`) once, at
  *import* time - every module's `llm/agents.py` builds its Agents at module
  scope, before any HTTP request (and its headers) exists - via `_build_model`,
  which deliberately stays lazy (a bare `"prefix:model"` string for native
  providers, resolved later by pydantic-ai's own `infer_model`) so that an
  unconfigured default provider's missing API key doesn't crash the app at
  import time; `defer_model_check=True` on the `Agent` keeps this honest.
- `run_structured` resolves the **live** model for *this* call - the
  per-request X-AI-Provider/X-AI-Model header override if present (via
  `interfaces/api/app.py`'s `set_ai_context` middleware ->
  `shared_kernel/llm/context.py` contextvars), else the same env-var default
  - via `_build_live_model`, which eagerly constructs the provider's
  `Provider`+`Model` pair with a shared `httpx.AsyncClient` injected, so the
  log viewer (`shared_kernel/observability/`) can capture the underlying
  HTTP request/response. Passed to `agent.run(model=...)`, pydantic-ai's
  per-call override - the only way a header-driven choice reaches an Agent
  built before the request existed. If eager construction fails (provider
  misconfigured), it degrades to the same lazy string `_build_model` would
  produce, so a test running under `Agent.override(model=TestModel())` -
  which never touches a real provider regardless of what `model=` was asked
  for - is never broken by a missing API key it was never going to use.
"""

import json
import os
import time
import uuid
from contextvars import ContextVar
from dataclasses import dataclass
from typing import Any, TypeVar

import httpx
from pydantic_ai import Agent
from pydantic_ai.exceptions import (
    ModelHTTPError,
    UnexpectedModelBehavior,
    UsageLimitExceeded,
    UserError,
)
from pydantic_ai.models import Model
from pydantic_ai.models.anthropic import AnthropicModel
from pydantic_ai.models.google import GoogleModel
from pydantic_ai.models.groq import GroqModel
from pydantic_ai.models.ollama import OllamaModel
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.anthropic import AnthropicProvider
from pydantic_ai.providers.google import GoogleProvider
from pydantic_ai.providers.groq import GroqProvider
from pydantic_ai.providers.ollama import OllamaProvider
from pydantic_ai.providers.openai import OpenAIProvider
from pydantic_settings import BaseSettings, SettingsConfigDict

from bluebox.shared_kernel.llm.base import LLMResponse
from bluebox.shared_kernel.llm.context import active_model, active_provider
from bluebox.shared_kernel.llm.failures import LLMFailure, LLMFailureMode
from bluebox.shared_kernel.observability.context import current_project_id, current_trace_id
from bluebox.shared_kernel.observability.log_bus import log_bus
from bluebox.shared_kernel.observability.log_event import GLOBAL_PROJECT_ID, LogEvent
from bluebox.shared_kernel.observability.redaction import redact_headers, truncate_body

ResponseT = TypeVar("ResponseT", bound=LLMResponse)


@dataclass(frozen=True)
class ProviderSpec:
    display_name: str
    api_key_env: str
    pydantic_ai_prefix: str | None = None
    base_url_env: str | None = None
    suggested_models: tuple[str, ...] = ()


# Provider id (what the frontend sends as `X-AI-Provider` and what prefixes
# `BLUEBOX_LLM_MODEL`) -> spec. `api_key_env`/`base_url_env` deliberately
# match the variable names already used in `.env` (NVIDIA_API_KEY,
# OLLAMA_BASE_URL, ...) rather than introducing a `BLUEBOX_`-prefixed
# parallel set - pydantic-ai's own native providers already read these
# exact names themselves, so a second naming scheme would just drift.
PROVIDERS: dict[str, ProviderSpec] = {
    "anthropic": ProviderSpec(
        display_name="Anthropic",
        api_key_env="ANTHROPIC_API_KEY",
        pydantic_ai_prefix="anthropic",
        suggested_models=("claude-sonnet-4-6", "claude-opus-4-1", "claude-haiku-4-5"),
    ),
    "openai": ProviderSpec(
        display_name="OpenAI",
        api_key_env="OPENAI_API_KEY",
        pydantic_ai_prefix="openai",
        suggested_models=("gpt-5", "gpt-4o", "gpt-4o-mini"),
    ),
    "google": ProviderSpec(
        display_name="Google AI Studio",
        api_key_env="GOOGLE_API_KEY",
        pydantic_ai_prefix="google",
        suggested_models=("gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"),
    ),
    "groq": ProviderSpec(
        display_name="Groq",
        api_key_env="GROQ_API_KEY",
        pydantic_ai_prefix="groq",
        suggested_models=("llama-3.3-70b-versatile", "mixtral-8x7b-32768"),
    ),
    "ollama": ProviderSpec(
        display_name="Ollama (local/cloud)",
        api_key_env="OLLAMA_API_KEY",
        pydantic_ai_prefix="ollama",
        base_url_env="OLLAMA_BASE_URL",
        suggested_models=("deepseek-v4-flash:cloud", "qwen3:cloud", "llama3.3:cloud"),
    ),
    "nvidia": ProviderSpec(
        display_name="NVIDIA NIM",
        api_key_env="NVIDIA_API_KEY",
        base_url_env="NVIDIA_BASE_URL",
        suggested_models=("meta/llama-3.3-70b-instruct", "meta/llama-3.1-8b-instruct"),
    ),
}


def is_provider_configured(provider_id: str) -> bool:
    spec = PROVIDERS.get(provider_id)
    if spec is None:
        return False
    if not os.getenv(spec.api_key_env):
        return False
    return not spec.base_url_env or bool(os.getenv(spec.base_url_env))


def list_providers() -> list[dict[str, object]]:
    """Backs `GET /api/v1/llm/providers` - the AI Config popup's source of
    truth, so it only ever offers providers that actually have credentials
    set rather than a hardcoded guess."""

    return [
        {
            "provider_id": provider_id,
            "display_name": spec.display_name,
            "configured": is_provider_configured(provider_id),
            "suggested_models": list(spec.suggested_models),
        }
        for provider_id, spec in PROVIDERS.items()
    ]


def _build_model(provider_id: str, model_name: str) -> Model | str:
    """Resolve a `(provider_id, model_name)` pair to whatever
    `Agent(model=...)`/`agent.run(model=...)` accepts. See module docstring
    for the native-vs-generic-OpenAI-compatible split. A `provider_id` absent
    from `PROVIDERS` entirely is passed through unchanged - covers any
    pydantic-ai-native provider we haven't bothered to register (e.g.
    someone selects `mistral:mistral-large-latest` without it being in the
    UI's curated list).
    """

    spec = PROVIDERS.get(provider_id)
    if spec is None or spec.pydantic_ai_prefix is not None:
        prefix = spec.pydantic_ai_prefix if spec else provider_id
        return f"{prefix}:{model_name}"

    return OpenAIChatModel(
        model_name,
        provider=OpenAIProvider(
            base_url=os.getenv(spec.base_url_env or "", ""),
            api_key=os.getenv(spec.api_key_env, ""),
        ),
    )


# Holds the in-flight LLM call's httpx trace (request/response pairs),
# `None` outside of `run_structured`. A module-scope `ContextVar` rather than
# a parameter threaded through every provider/model class - the hooks below
# are wired into `_shared_http_client` once, and httpx has no other way to
# pass call-specific state into them. Per-asyncio-Task isolated, so two
# concurrent `run_structured` calls sharing the one client never see each
# other's trace.
_httpx_trace: ContextVar[list[dict[str, Any]] | None] = ContextVar("_httpx_trace", default=None)


async def _capture_httpx_request(request: httpx.Request) -> None:
    trace = _httpx_trace.get()
    if trace is None:
        return
    trace.append(
        {
            "direction": "request",
            "method": request.method,
            "url": str(request.url),
            "headers": redact_headers(dict(request.headers)),
            "body": truncate_body(request.content),
        }
    )


async def _capture_httpx_response(response: httpx.Response) -> None:
    trace = _httpx_trace.get()
    if trace is None:
        return
    # Caches the body on the response object (`_content`) - the SDK's own
    # later read gets the cached bytes, not a second network call.
    await response.aread()
    trace.append(
        {
            "direction": "response",
            "status_code": response.status_code,
            "headers": redact_headers(dict(response.headers)),
            "body": truncate_body(response.content),
        }
    )


# One client shared by every live LLM call this process makes, for the
# lifetime of the process (consistent with this backend having no other
# shutdown-managed resources yet). An externally-passed `http_client` is
# never force-closed by a `Provider.__aexit__` - only a provider's *own*
# client (built when the caller doesn't pass one) gets closed - so handing
# this same instance to every provider below is safe.
_shared_http_client = httpx.AsyncClient(
    event_hooks={"request": [_capture_httpx_request], "response": [_capture_httpx_response]}
)


def _build_live_model(provider_id: str, model_name: str) -> Model | str:
    """Like `_build_model`, but for an actual call about to happen: eagerly
    builds the provider's `Provider`+`Model` pair with `_shared_http_client`
    injected, so the log viewer can capture the underlying HTTP traffic.
    Falls back to `_build_model`'s lazy passthrough on any construction
    failure (e.g. a missing API key) - see module docstring for why that
    fallback matters for tests running under `Agent.override(...)`.
    """

    spec = PROVIDERS.get(provider_id)
    if spec is None:
        return f"{provider_id}:{model_name}"

    try:
        api_key = os.getenv(spec.api_key_env) or None
        base_url = os.getenv(spec.base_url_env) if spec.base_url_env else None

        if provider_id == "anthropic":
            return AnthropicModel(
                model_name, provider=AnthropicProvider(api_key=api_key, http_client=_shared_http_client)
            )
        if provider_id == "openai":
            return OpenAIChatModel(
                model_name, provider=OpenAIProvider(api_key=api_key, http_client=_shared_http_client)
            )
        if provider_id == "google":
            return GoogleModel(
                model_name, provider=GoogleProvider(api_key=api_key, http_client=_shared_http_client)
            )
        if provider_id == "groq":
            return GroqModel(
                model_name, provider=GroqProvider(api_key=api_key, http_client=_shared_http_client)
            )
        if provider_id == "ollama":
            return OllamaModel(
                model_name,
                provider=OllamaProvider(base_url=base_url, api_key=api_key, http_client=_shared_http_client),
            )
        # Generic OpenAI-compatible (NVIDIA NIM today, any future
        # `pydantic_ai_prefix=None` entry).
        return OpenAIChatModel(
            model_name,
            provider=OpenAIProvider(base_url=base_url, api_key=api_key, http_client=_shared_http_client),
        )
    except UserError:
        return f"{spec.pydantic_ai_prefix or provider_id}:{model_name}"


class LLMSettings(BaseSettings):
    """Reads the active default model id from the environment, formatted
    `"<provider_id>:<model_name>"` where `provider_id` is a `PROVIDERS` key
    (or any pydantic-ai-native provider name)."""

    model_config = SettingsConfigDict(env_prefix="BLUEBOX_LLM_")

    model: str = "anthropic:claude-sonnet-4-6"


def _default_model() -> Model | str:
    provider_id, _, model_name = LLMSettings().model.partition(":")
    return _build_model(provider_id, model_name) if model_name else provider_id


def build_agent(
    output_type: type[ResponseT],
    system_prompt: str,
) -> Agent[None, ResponseT]:
    """Construct a pydantic-ai Agent bound to a single structured response model.

    `output_type` must be one of the `LLMResponse` subclasses defined in a
    module's `llm/responses.py` - pydantic-ai validates every call's output
    against it before it reaches application code.

    The model bound here is only the *default* (`BLUEBOX_LLM_MODEL`) - see
    module docstring for why per-request overrides apply later, in
    `run_structured`, rather than here.
    """

    # defer_model_check: provider clients (Anthropic, OpenAI, ...) validate
    # API keys at model-resolution time. Deferring keeps agent construction
    # itself provider-agnostic; the check happens on first `.run()`. Only
    # applies to the native path - generic OpenAI-compatible `Model`
    # instances build their client eagerly regardless.
    return Agent(
        _default_model(),
        output_type=output_type,
        system_prompt=system_prompt,
        defer_model_check=True,
    )


class LLMCallFailed(Exception):
    """Raised by `run_structured` instead of letting a provider/pydantic-ai
    exception leak upward. Carries a typed `LLMFailure` so callers (the
    not-yet-built state machine / WS layer) always get the same shape
    regardless of which provider failed.
    """

    def __init__(self, failure: LLMFailure) -> None:
        self.failure = failure
        super().__init__(failure.failure_type)


def _active_provider_and_model() -> tuple[str, str]:
    """The provider/model this call should actually use: the per-request
    X-AI-Provider/X-AI-Model header override if present (`shared_kernel/llm/context.py`
    contextvars, set by `interfaces/api/app.py`'s `set_ai_context` middleware),
    else the env-var default (`BLUEBOX_LLM_MODEL`)."""

    provider_id = active_provider.get()
    model_name = active_model.get()
    if provider_id and model_name:
        return provider_id, model_name
    default_provider_id, _, default_model_name = LLMSettings().model.partition(":")
    return default_provider_id, default_model_name


async def _publish_llm_log(
    *,
    stage: int,
    prompt_id: str,
    user_prompt: str,
    provider_id: str,
    model_name: str,
    httpx_trace: list[dict[str, Any]],
    duration_ms: float,
    output: ResponseT | None,
    failure: LLMFailure | None,
) -> None:
    """Publishes one `llm_call` `LogEvent` for the log viewer - both the
    success and failure paths log, tagged with whichever REST request (if
    any) triggered this call, via the `current_project_id`/`current_trace_id`
    contextvars `interfaces/api/app.py`'s logging middleware sets."""

    outcome = "ok" if failure is None else failure.failure_type
    await log_bus.publish(
        LogEvent(
            project_id=current_project_id.get() or GLOBAL_PROJECT_ID,
            trace_id=current_trace_id.get(),
            duration_ms=duration_ms,
            category="llm_call",
            summary=f"LLM {provider_id}:{model_name} stage={stage} -> {outcome} ({duration_ms:.0f}ms)",
            detail={
                "provider": provider_id,
                "model": model_name,
                "stage": stage,
                "prompt_id": prompt_id,
                "prompt": truncate_body(user_prompt),
                "output": truncate_body(json.dumps(output.model_dump(mode="json")))
                if output is not None
                else None,
                "failure": failure.model_dump(mode="json") if failure is not None else None,
                "httpx_trace": httpx_trace,
            },
        )
    )


async def run_structured(
    agent: Agent[None, ResponseT],
    user_prompt: str,
    *,
    stage: int = -1,
) -> ResponseT:
    """The single call boundary every module's `llm/agents.py` wrapper goes
    through. Deliberately does not retry — doc/prd.md SS7.2 "No Silent
    Retry": retrying is a user-facing steering decision, not something the
    LLM client decides on its own. `stage=-1` marks call sites outside the
    numbered 0-9 stage sequence (advisory/governance/chat/code_generation
    side-channels); stage executors pass their real stage number.
    """

    prompt_id = str(uuid.uuid4())
    provider_id, model_name = _active_provider_and_model()
    httpx_trace: list[dict[str, Any]] = []
    trace_token = _httpx_trace.set(httpx_trace)
    start = time.perf_counter()
    output: ResponseT | None = None
    failure: LLMFailure | None = None
    try:
        result = await agent.run(user_prompt, model=_build_live_model(provider_id, model_name))
        output = result.output
        return output
    except UsageLimitExceeded as exc:
        failure = LLMFailure(failure_type="context_overflow", prompt_id=prompt_id, stage=stage)
        raise LLMCallFailed(failure) from exc
    except ModelHTTPError as exc:
        mode: LLMFailureMode = (
            "rate_limit"
            if exc.status_code == 429
            else "timeout"
            if exc.status_code in (408, 504)
            else "malformed_json"
        )
        failure = LLMFailure(failure_type=mode, prompt_id=prompt_id, stage=stage)
        raise LLMCallFailed(failure) from exc
    except UnexpectedModelBehavior as exc:
        failure = LLMFailure(failure_type="malformed_json", prompt_id=prompt_id, stage=stage)
        raise LLMCallFailed(failure) from exc
    finally:
        _httpx_trace.reset(trace_token)
        await _publish_llm_log(
            stage=stage,
            prompt_id=prompt_id,
            user_prompt=user_prompt,
            provider_id=provider_id,
            model_name=model_name,
            httpx_trace=httpx_trace,
            duration_ms=(time.perf_counter() - start) * 1000,
            output=output,
            failure=failure,
        )
