# CLAUDE.md

## Repository State

Mid-rewrite. The old full-stack (`application/`, `domain/`, `infrastructure/`, `interfaces/`, `config/`, `testing/`, old `frontend/`) is deleted from disk but remains in git history. Root `Dockerfile`/`docker-compose.yml` are stale leftovers.

Current source of truth: `doc/`. Active development:

- **`new-fe/`** — React/Vite frontend rebuilt from scratch against `doc/`. No code from old `frontend/`.
- **`be/`** — Python/FastAPI + pydantic-ai backend built against `doc/`. Replaced `mock_server.py`; `new-fe` points at `be/`. No mock server exists.

## `doc/` Spec (Authoritative)

- `doc/prd.md` — product requirements (FR-IDE-09, NF-SC-05, etc.)
- `doc/api_event_contract.md` — REST + WS contract for both `new-fe` and `be`
- `doc/uiux_specification.agent.final.md` — screen/panel layout
- `doc/wireframes.md` — wireframes referenced by UIUX spec

Architecture background: `doc/prd.md` §3+ (modules, state machine, trust modes, RBAC).

## `new-fe/` — Frontend

```bash
cd new-fe
npm install
cp .env.example .env    # point at running be/
npm run dev             # http://localhost:5173
npm run build           # tsc --noEmit && vite build
npm run lint            # eslint, zero warnings
npm run typecheck       # tsc --noEmit
npm test                # vitest run
npx vitest run src/path/to/File.test.tsx
npm run format / format:check
```

**Env:** `VITE_API_BASE_URL` (default `http://localhost:8000`), `VITE_WS_BASE_URL` (default `ws://localhost:8000`), `VITE_SESSION_REAUTH_IDLE_MINUTES` (default `60`).

### Architecture Rules

- **Single network choke points:** `src/api/httpClient.ts` for REST; `src/ws/socketClient.ts` for WS. Never call `fetch` or `new WebSocket()` outside these.
- **No mock data in `src/`:** Screens show loading/error/empty states. Mocking only in tests (`vi.stubGlobal`, fake WS).
- **Out-of-scope panels:** Render `PanelPlaceholder`. If a UI affordance has no endpoint in `api_event_contract.md`, disable it with tooltip: *"Not yet available — this action has no endpoint in the API contract"*.
- **Store lifecycle:** Always-mounted slots (e.g. `workspaceStore`) init/tear down by their component. Tab-switchable panels (e.g. `steeringStore`) init once, never tear down on unmount.
- **DTO contract citations:** Types in `src/api/types/` and `src/ws/events.ts` cite `api_event_contract.md` section. Exceptions: `llmConfig.ts` (`GET /api/v1/llm/providers`) and `LogEvent` — added after contract, no section to cite.
- **AI provider/model per-request:** `X-AI-Provider`/`X-AI-Model` headers from `aiStore` (`httpClient.ts`), settable via `Ctrl+M`/`Cmd+M` (`components/common/AiConfigModal/`). Popup calls `GET /api/v1/llm/providers`. Never hardcode provider list.
- **Styling:** CSS Modules + `src/styles/tokens.css`. Not Tailwind.
- **State:** Zustand only. No React Context for app state.
- **JWT:** `sessionStorage`, not `localStorage`.
- **`@/`** resolves to `new-fe/src`.
- **eslint:** `@typescript-eslint/no-explicit-any: error` for authored code; off for `**/*.d.ts`.

### Structure

- `src/api/` — `httpClient.ts` + `endpoints/*.ts` (auth, projects, onboarding, steering, workspace, graph, nodes, rbac, techStack, infra, checkpoints, branches, audit, codeGen, deploy, tests, runtime, chat, search, session, layout) + `types/*.d.ts`
- `src/ws/` — `socketClient.ts` + `events.ts`
- `src/stores/` — one Zustand store per concern
- `src/components/<area>/` — `auth`, `dashboard`, `onboarding`, `shell` (toolbar, sashes, placeholders), `chat`, `steering`, `files`, `editor`, `nodes`, `gate`, `graph`, `audit`, `common`
- `src/pages/` — `LoginPage`, `DashboardPage`, `OnboardingPage`, `WorkspacePage` in `src/router.tsx` (React Router v6)
- Tests: `*.test.ts(x)` next to code, Vitest + jsdom. `src/test/setup.ts` polyfills `localStorage`/`sessionStorage` (Node 22 shadows jsdom's).

## `be/` — Backend

Python 3.12, FastAPI + pydantic-ai, `uv`.

```bash
cd be
uv sync
cp .env.example .env    # fill at least one provider API key
uv run uvicorn bluebox.interfaces.api.app:create_app --factory --reload  # :8000
uv run pytest tests/ -q
uv run pytest tests/test_foo.py -q
```

`be/.env` loaded by `load_dotenv()` at top of `bluebox/__init__.py` (runs before any submodule). No other env-loading mechanism.

### Structure

- `src/bluebox/interfaces/api/` — `app.py` (factory: CORS, AI context middleware, exception handlers, router registration) + `routers/*.py` (auth, projects, onboarding, steering, nodes, scaling, tech_stack, rbac, chat, codegen, runtime, checkpoints, ledger, audit, `llm_config.py`) + `deps.py` (FastAPI `Depends`, thin services over shared `AppState`) + `auth.py` (JWT, seeded `dev@bluebox.local`/`dev-password`)
- `src/bluebox/interfaces/ws/steering_session.py` — WS route `/api/v1/steering/session/{project_id}`
- `src/bluebox/modules/<area>/` — `core_pipeline`, `input_processing`, `advisory/{rbac,scaling,tech_stack}`, `governance`, `chat`, `code_generation`. Each has `domain/` (state machine, entities, exceptions), `application/` (services), `llm/` (`agents.py` builds pydantic-ai `Agent` per call site at **module-import time**, `requests.py`/`responses.py`)
- `src/bluebox/shared_kernel/` — `llm/`, `infrastructure/in_memory.py` (`AppState` singleton, no DB), `domain/`, `ports.py`
- `tests/` — `test_*_application.py` per module (application layer), `test_api_core_flow.py` / `test_ws_steering_session.py` (HTTP/WS), `test_llm_agents_smoke.py` (every agent against `TestModel`, no network). `test_all_call_sites_covered` fails if new agent not in `CASES`.

### LLM Provider/Model Selection

`shared_kernel/llm/connector.py` `PROVIDERS` registry is single source of truth.

- **Native** (`pydantic_ai_prefix` set): pydantic-ai ships `Provider` (anthropic, openai, google, groq, ollama, ...). Reads conventional env vars (`ANTHROPIC_API_KEY`, `OLLAMA_BASE_URL`/`OLLAMA_API_KEY`). Register as `"<prefix>:<model>"`.
- **Generic OpenAI-compatible** (`pydantic_ai_prefix` = `None`): `base_url_env`/`api_key_env` builds `OpenAIChatModel` manually.

Model resolution:
- `build_agent` binds `BLUEBOX_LLM_MODEL` (format `"<provider_id>:<model>"`) at **module-import time** — before any request/headers exist.
- `run_structured` resolves **per-request override** from `X-AI-Provider`/`X-AI-Model` headers (set into `shared_kernel/llm/context.py` contextvars by `app.py` middleware) and passes to `agent.run(model=...)`. This is the only way header-driven choice reaches an already-built Agent.

### Pipeline State Machine

`modules/core_pipeline/domain/state_machine.py` `PipelineOrchestrator` holds `current_state` (`TRANSITIONS` dict literal; not all states have self-loop, `CLASSIFYING` notably doesn't). Single source of truth, kept in `InMemorySessionRepository` (persists across requests per `project_id` for process lifetime).

`transition()` raises `InvalidStateTransitionError` → HTTP 409 for missing edges. `restore_to()` jumps unconditionally (checkpoint restore, or `OnboardingService` auto-reset when resubmitting from non-`INITIALIZED` state).

### Chunked PRD Analysis

`modules/input_processing/llm/agents.py` `analyze_prd()` sends raw PRD in one LLM call. Too-large documents fail.

`OnboardingService` calls `analyze_prd_adaptive()` (`modules/input_processing/application/chunked_prd_analyzer.py`):

- Under `MAX_TOKENS_PER_CHUNK`: pass-through to `analyze_prd`.
- Over: `chunk_prd` (`modules/input_processing/chunking.py`) splits on markdown headers, token-budgeted, never mid-sentence. Each chunk analyzed via `prd_chunk_analysis_agent`/`analyze_prd_chunk`, then merged into `PRDAnalysisReport`.
- Merge `missing_sections` computed deterministically (no extra LLM): diff which of 10 pipeline stages (0-9) got at least one explicit/thin entry vs full set. Requires every chunk's `mapped_to_stage` use same numbering via `pipeline_stage_reference` table — model-invented numbering gets it wrong (observed with smaller/weaker models; reference helps but doesn't guarantee compliance — model capability limit).
- Chunk whose LLM call fails (`LLMCallFailed`) degrades to "no contribution", doesn't abort whole analysis. No regex fallback.

`classify_richness`/`detect_compliance` still send raw document uncapped — same large-document exposure, known separate gap.

### Log Viewer (Debug Tool)

Not in `api_event_contract.md`. Same precedent as `llm_config.py`.

`shared_kernel/observability/`:
- `log_event.py` — `LogEvent` (categories: REST sent/received, WS sent/received both directions, `llm_call`)
- `log_bus.py` — `LogEventBus` singleton (`log_bus`, in-memory per-project ring buffer `maxlen=1000`, `set_broadcaster()` hook so layer never imports `interfaces/`)
- `context.py` — `current_project_id`/`current_trace_id` contextvars
- `redaction.py` — header-blocklist + body-truncation (redaction before truncation — see docstring)

Three capture points feed `log_bus`, tagged with live contextvars:
1. **REST:** `app.py` `log_http_requests` middleware times `call_next`, buffers response body iterator, publishes `http_received_by_backend`.
2. **LLM/httpx:** `connector.py` `run_structured` resolves *live* model via `_build_live_model` (eagerly constructs `Provider`+`Model` with shared module-scope `httpx.AsyncClient`, event_hooks capture underlying request/response). If construction fails (missing API key), falls back to lazy string (keeps `TestModel` override safe in tests). Publishes `llm_call` on success and failure.
3. **WS:** `steering_session.py` `_send`/`_receive` wrap module's only send/receive points, publish `ws_sent_by_backend`/`ws_received_by_backend`. Guarded so `LOG_EVENT` frame never logs itself. `connection_registry.py` `WSConnectionRegistry` (registered/unregistered per connection) lets `log_bus.publish` push `LOG_EVENT` frame to open steering session. Wired once via `log_bus.set_broadcaster(connection_registry.push_log_event)` in `create_app()` (shared_kernel can't import interfaces).

`GET /api/v1/projects/{project_id}/logs` (`routers/logs.py`) backs initial load; live updates via `LOG_EVENT` frames over same per-project steering WS. Client dispatches by `event` name; `LOG_EVENT` can interleave with `STEERING_PANEL_READY`/etc.

Client side: `httpClient.ts` `configureNetworkLogger` / `socketClient.ts` `configureWsLogger` register callbacks (third/fourth alongside auth), fire on every REST/WS (never for `LOG_EVENT` itself — matching guard). `stores/logViewerStore.ts` registers both, subscribes to `socketClient.on("LOG_EVENT", ...)`, merges client REST, client WS, backend-pushed into sorted, deduped, 1000-entry timeline. `init()` called once from `App.tsx` (idempotent); `setProjectId()` from `WorkspacePage.tsx` on route change. `components/common/LogViewerModal/` + `hooks/useLogViewerModal.ts` (`Ctrl+Shift+L`) mirror `AiConfigModal`/`useAiConfigModal.ts` structure.
