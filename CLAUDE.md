# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository state (important context)

This repo is mid-rewrite. The original full-stack implementation (`application/`,
`domain/`, `infrastructure/`, `interfaces/`, `config/`, `testing/`, and the old
`frontend/`) has been deleted from disk but is still present in git history —
`git status` will show it as a large number of deletions. The
`Dockerfile`/`docker-compose.yml` at the repo root are leftovers from that old
stack and currently reference modules that no longer exist; don't treat them as
the current entry point.

The current source of truth is the spec in `doc/`, and the two things being
actively developed against it are:

- **`new-fe/`** — a frontend rebuilt from scratch, driven *only* by the four
  documents in `doc/`. No code was carried over from the old `frontend/`.
- **`be/`** — a real backend (Python, FastAPI + pydantic-ai), built from
  scratch against the same spec. It replaced `mock_server.py` (the old
  single-file FastAPI mock at the repo root, since removed) once enough of
  the contract was implemented for real; `new-fe` now points at `be/`
  instead. There is no mock server anymore — if the backend isn't running,
  `new-fe` shows loading/error states rather than falling back to fixtures.

When asked to add backend functionality, it's real domain logic in `be/`
now, not mock data — there's no separate "extend the mock" scope to weigh
against it.

## The `doc/` spec (authoritative)

Everything in `new-fe/` and `be/` traces back to these four files; read the
relevant section before changing frontend or backend behavior:

- `doc/prd.md` — product requirements (functional/non-functional requirement
  IDs like `FR-IDE-09`, `NF-SC-05` are referenced directly in code/comments).
- `doc/api_event_contract.md` — REST endpoints and WebSocket events, the
  contract both `new-fe` and `be` are built against. Section 10 has a full
  event summary table; section 11 has error codes.
- `doc/uiux_specification.agent.final.md` — screen/panel layout spec.
- `doc/wireframes.md` — wireframes referenced by the UIUX spec.

Architecture/system-design background (modules, state machine, trust modes,
RBAC) is described in `doc/prd.md` §3 ("High-Level System Architecture")
onward.

## `new-fe/` — frontend

```bash
cd new-fe
npm install
cp .env.example .env        # point at a running be/ (see below)
npm run dev                 # vite dev server, http://localhost:5173
npm run build                # tsc --noEmit && vite build — fails on type errors
npm run lint                 # eslint, zero warnings allowed
npm run typecheck             # tsc --noEmit only
npm test                     # vitest run (single run)
npm run test:watch            # vitest watch mode
npx vitest run src/path/to/File.test.tsx   # single test file
npm run format / format:check # prettier
```

Env vars (`.env`, see `.env.example`): `VITE_API_BASE_URL` (default
`http://localhost:8000`), `VITE_WS_BASE_URL` (default `ws://localhost:8000`),
`VITE_SESSION_REAUTH_IDLE_MINUTES` (default `60`).

### Architecture rules specific to this codebase

- **Single network choke points.** Every REST call goes through
  `src/api/httpClient.ts`; every WebSocket connection goes through the
  `socketClient` singleton in `src/ws/socketClient.ts`. Never call `fetch` or
  open a `WebSocket` directly from a component or store — this is what keeps
  "no fabricated data in the UI" enforceable/auditable.
- **No mock data in `src/`.** Screens render loading/error/empty states when
  the backend doesn't respond — never invented content. Mocking only happens
  at test boundaries (`vi.stubGlobal("fetch", ...)`, a fake `WebSocket` in
  tests), never in runtime code.
- **Out-of-scope panels render `PanelPlaceholder`**, not invented UI: Live
  Preview, Terminal, Test Results, Blueprint Graph, Audit Trail are reserved
  layout slots, not implemented. If a UI affordance named in the spec has no
  corresponding endpoint in `api_event_contract.md`, render it disabled with
  the tooltip "Not yet available — this action has no endpoint in the API
  contract" rather than wiring it to a guessed URL.
- **Store lifecycle follows ownership of layout slots.** Stores backing
  always-mounted slots (e.g. `workspaceStore`, owned by `FileExplorer`) are
  initialized/torn down by that slot's component. Stores backing
  tab-switchable panels meant to survive tab switches (e.g. `steeringStore`)
  are only ever `init()`'d, never torn down on unmount.
- **Every DTO cites its contract section.** Types under `src/api/types/` and
  `src/ws/events.ts` should reference the `api_event_contract.md` section they
  were transcribed from. Where the contract names a type without fully
  specifying its fields, document the inferred shape in a comment citing the
  nearest fully-specified analog. The deliberate exceptions are
  `src/api/endpoints/llmConfig.ts` (`GET /api/v1/llm/providers`) — a dev-tool
  endpoint for the AI Config popup below — and the log viewer's `LogEvent`
  (`src/api/types/types.d.ts`, `src/ws/events.ts`'s `LOG_EVENT`,
  `src/api/endpoints/logs.ts`) — both added after the contract was written,
  so neither has a section to cite.
- **AI provider/model is per-request, not a build-time config.** Every REST
  call carries `X-AI-Provider`/`X-AI-Model` headers sourced from `aiStore`
  (`httpClient.ts`), settable via the "AI Provider & Model" popup
  (`Ctrl+M`/`Cmd+M`, `components/common/AiConfigModal/`). The popup calls
  `GET /api/v1/llm/providers` and only allows selecting a provider the
  backend actually has credentials for — never hardcode a provider list in
  the frontend. See the matching `be/` note below for how the header
  actually reaches an LLM call.
- Styling is CSS Modules + design tokens in `src/styles/tokens.css`
  (transcribed from the UIUX spec) — not Tailwind, despite the old `frontend/`
  having used shadcn/Tailwind.
- State management is Zustand only — no React Context for app state.
- JWT is kept in `sessionStorage`, not `localStorage` (deliberate, to limit
  XSS exposure window).
- `@/` resolves to `new-fe/src` (see `vite.config.ts` / `tsconfig.json`).
- `eslint` has `@typescript-eslint/no-explicit-any: error` for authored code,
  but it's turned off for `**/*.d.ts` files since some contract types
  (`SessionState`, `ComplianceDetectionResult`, `ImpactReport`, etc.) are only
  loosely specified in the contract itself.

### Structure

- `src/api/` — `httpClient.ts` (the only fetch boundary) + `endpoints/*.ts`
  (one file per contract area: auth, projects, onboarding, steering, workspace,
  graph, nodes, rbac, techStack, infra, checkpoints, branches, audit, codeGen,
  deploy, tests, runtime, chat, search, session, layout) + `types/*.d.ts`.
- `src/ws/` — `socketClient.ts` (the only WebSocket boundary) + `events.ts`
  (typed event payloads).
- `src/stores/` — one Zustand store per concern (auth, pipeline, steering,
  workspace, chat, ide layout, node editor, completeness gate, audit nav).
- `src/components/<area>/` mirrors the contract's panel structure: `auth`,
  `dashboard`, `onboarding`, `shell` (IDE chrome: toolbar, resizable sashes,
  panel placeholders), `chat`, `steering`, `files`, `editor`, `nodes` (CRUD
  editor forms), `gate` (completeness gate), `graph`, `audit`, `common`.
- `src/pages/` — top-level routed pages (`LoginPage`, `DashboardPage`,
  `OnboardingPage`, `WorkspacePage`), wired in `src/router.tsx` (React Router
  v6, `createBrowserRouter`).
- Tests live next to the code they cover (`*.test.ts(x)`), run with Vitest +
  jsdom. `src/test/setup.ts` polyfills `localStorage`/`sessionStorage` — needed
  because Node 22's built-in `localStorage` global otherwise shadows jsdom's
  and breaks persisted Zustand stores under test.

## `be/` — backend

Python 3.12, FastAPI + pydantic-ai, managed with `uv`. No README yet — this
section is the source of truth for running it.

```bash
cd be
uv sync                     # creates/updates .venv from pyproject.toml/uv.lock
cp .env.example .env        # fill in at least one provider's API key (see below)
uv run uvicorn bluebox.interfaces.api.app:create_app --factory --reload   # http://localhost:8000
uv run pytest tests/ -q     # 226 tests as of this writing
uv run pytest tests/test_foo.py -q   # single file
```

`be/.env` is loaded by `load_dotenv()` at the top of `bluebox/__init__.py`
(the package root, so it runs before any submodule — several modules read
env vars at *import* time, see below) — there is no other env-loading
mechanism, so a var that isn't in `.env`/the process environment is simply
unset, silently.

### Structure

- `src/bluebox/interfaces/api/` — `app.py` (FastAPI factory: CORS, the
  X-AI-Provider/X-AI-Model context middleware, one `@app.exception_handler`
  per domain exception type mapping it to an HTTP status, router
  registration) + `routers/*.py` (one per contract area: auth, projects,
  onboarding, steering, nodes, scaling, tech_stack, rbac, chat, codegen,
  runtime, checkpoints, ledger, audit, plus `llm_config.py` which isn't part
  of the contract — see below) + `deps.py` (FastAPI `Depends` providers,
  thin services constructed per-request over the shared in-memory
  `AppState`) + `auth.py` (JWT issuance/verification, one seeded
  `dev@bluebox.local` / `dev-password` user).
- `src/bluebox/interfaces/ws/steering_session.py` — the one WebSocket route
  (`/api/v1/steering/session/{project_id}`).
- `src/bluebox/modules/<area>/` — one module per contract/domain area
  (`core_pipeline`, `input_processing`, `advisory/{rbac,scaling,tech_stack}`,
  `governance`, `chat`, `code_generation`), each with `domain/` (state
  machine, entities, exceptions), `application/` (services, the things
  `deps.py` constructs), and `llm/` (`agents.py` builds one pydantic-ai
  `Agent` per call site **at module-import time**, `requests.py`/`responses.py`
  are the structured I/O models).
- `src/bluebox/shared_kernel/` — `llm/` (provider-agnostic connector, see
  below), `infrastructure/in_memory.py` (the entire backend's state lives in
  one `AppState` singleton — no database yet), `domain/`, `ports.py`.
- `tests/` — one `test_*_application.py` per module exercising its
  application-layer services directly, `test_api_core_flow.py` /
  `test_ws_steering_session.py` for through-the-HTTP/WS-layer coverage,
  `test_llm_agents_smoke.py` runs every wired agent against
  `pydantic_ai.models.test.TestModel` (no network/API key) and asserts the
  output type — `test_all_call_sites_covered` fails loudly if a new agent is
  added to some module's `agents.py` but not to that file's `CASES` list.

### LLM provider/model selection

`shared_kernel/llm/connector.py`'s `PROVIDERS` registry is the single
source of truth for which providers this deployment can talk to — both
`GET /api/v1/llm/providers` (backs the frontend's AI Config popup) and model
resolution read from it. Two ways a provider entry can work:

1. **Native** (`pydantic_ai_prefix` set): pydantic-ai ships a `Provider`
   class for it already (anthropic, openai, google, groq, ollama, ...) and
   reads its own conventional env vars (e.g. `ANTHROPIC_API_KEY`,
   `OLLAMA_BASE_URL`/`OLLAMA_API_KEY`) — registering it here is just
   `"<prefix>:<model>"` passed through to pydantic-ai's `infer_model`.
2. **Generic OpenAI-compatible** (`pydantic_ai_prefix` left `None`): no
   dedicated pydantic-ai class exists (NVIDIA NIM today), so a
   `base_url_env`/`api_key_env` pair builds an `OpenAIChatModel` by hand.
   Adding a new OpenAI-compatible endpoint is one registry entry, not a code
   change.

Model resolution happens in two places — both go through `_build_model`,
but at different times, which matters:

- `build_agent` binds the env-var default (`BLUEBOX_LLM_MODEL`, formatted
  `"<provider_id>:<model>"`) once, when a module's `llm/agents.py` is
  *imported* — before any HTTP request, and therefore before any
  X-AI-Provider/X-AI-Model header, exists.
- `run_structured` (the only call boundary every `agents.py` wrapper goes
  through) resolves the **active per-request override** from those headers
  (set into `shared_kernel/llm/context.py` contextvars by `app.py`'s
  `set_ai_context` middleware) and passes it to pydantic-ai's *per-call*
  `agent.run(model=...)` override. This is the only way a header-driven
  choice reaches an Agent that was already built before the request
  existed — do not try to make per-request selection work by changing what
  `build_agent` binds at construction time, it can't, since construction
  happens at import time.

### Pipeline state machine

`modules/core_pipeline/domain/state_machine.py`'s `PipelineOrchestrator`
holds `current_state` (a `TRANSITIONS` dict literal — not every state has a
self-loop edge; `CLASSIFYING` notably doesn't) and is the project's single
source of truth, kept in `InMemorySessionRepository` (so it persists across
requests for the same `project_id` for as long as the process runs).
`transition()` raises `InvalidStateTransitionError` (-> HTTP 409) for any
edge not in `TRANSITIONS`; `restore_to()` jumps to any state unconditionally
(checkpoint restore, or `OnboardingService`'s "auto-reset and overwrite"
when a session needs resubmitting input from a state other than
`INITIALIZED`).

### Chunked PRD analysis (large documents)

`modules/input_processing/llm/agents.py`'s `analyze_prd()` sends an entire
raw PRD in one LLM call — fine for the common case, but too large a
document will fail or get truncated by the provider. `OnboardingService`
calls `analyze_prd_adaptive()`
(`modules/input_processing/application/chunked_prd_analyzer.py`) instead:
under `MAX_TOKENS_PER_CHUNK` it's a thin pass-through to `analyze_prd`
unchanged; over it, `modules/input_processing/chunking.py`'s `chunk_prd`
(structural, token-budgeted splitting on markdown header boundaries, never
mid-sentence) breaks the text up, and each chunk is analyzed separately via
the `prd_chunk_analysis_agent`/`analyze_prd_chunk` pair, then merged into
one `PRDAnalysisReport`. The merge's `missing_sections` is computed
deterministically (no extra LLM call) by diffing which of the 10 pipeline
stages (0-9) got at least one explicit/thin entry anywhere against the full
set — this is *why* every chunk request carries a `pipeline_stage_reference`
table: the diff only works if every chunk's `mapped_to_stage` uses the same
numbering, and a model left to invent its own numbering will get it wrong
(observed in practice with smaller/weaker models — the reference table
measurably helps but doesn't guarantee perfect compliance; this is a model-
capability limit, not something fixable in this code). A chunk whose LLM
call fails (`LLMCallFailed`) degrades to "no contribution" rather than
aborting the whole analysis — there's no regex fallback the way a similar
evaluation-only package for a different project (`newllm/`, since deleted)
had. `classify_richness`/`detect_compliance` still send the raw document in
one uncapped shot each and have the same theoretical large-document
exposure — a known, separate, not-yet-addressed gap.

### Log viewer (technical observability)

Not part of `doc/api_event_contract.md` — a debug tool, same precedent as
`llm_config.py`. `shared_kernel/observability/` holds the shared pieces:
`log_event.py`'s `LogEvent` (one `category` per kind of wire-crossing —
REST sent/received, WS sent/received in both directions, `llm_call`),
`log_bus.py`'s `LogEventBus` singleton (`log_bus`, an in-memory per-project
ring buffer, `maxlen=1000`, with a pluggable `set_broadcaster()` hook so
this layer never imports from `interfaces/`), `context.py`'s
`current_project_id`/`current_trace_id` contextvars, and `redaction.py`'s
header-blocklist + body-truncation policy (redaction always runs *before*
truncation — see that module's docstring for why order matters).

Three capture points feed `log_bus`, each tagged with whatever
`project_id`/`trace_id` is live in the contextvars at the time:
- **REST**: `interfaces/api/app.py`'s `log_http_requests` middleware times
  `call_next`, buffers and replays the response body iterator, and
  publishes one `http_received_by_backend` event per request.
- **LLM/httpx**: `shared_kernel/llm/connector.py`'s `run_structured` always
  resolves a *live* model via `_build_live_model` (eagerly constructing
  that provider's `Provider`+`Model` pair with a shared, module-scope
  `httpx.AsyncClient` injected) rather than the lazy `"prefix:model"`
  string `_build_model`/`build_agent` use at import time — that eager
  construction is what lets the client's `event_hooks` capture the
  underlying request/response. If construction fails (missing API key),
  it falls back to the same lazy string, which is what keeps
  `Agent.override(model=TestModel())` (every smoke/integration test) safe
  from ever needing real credentials. One `llm_call` event is published on
  both the success and failure path.
- **WS**: `interfaces/ws/steering_session.py`'s `_send`/`_receive` wrap the
  module's only send/receive choke points, publishing
  `ws_sent_by_backend`/`ws_received_by_backend` — guarded so a `LOG_EVENT`
  frame never logs itself. `interfaces/ws/connection_registry.py`'s
  `WSConnectionRegistry` (registered/unregistered around each WS
  connection's lifetime) is what lets `log_bus.publish` push a live
  `LOG_EVENT` frame to a project's open steering session — wired once via
  `log_bus.set_broadcaster(connection_registry.push_log_event)` in
  `create_app()`, since `shared_kernel` can't import `interfaces/`.

`GET /api/v1/projects/{project_id}/logs` (`interfaces/api/routers/logs.py`)
backs a viewer's initial load; live updates after that arrive as
`LOG_EVENT` frames over the *same* per-project steering WebSocket as every
other event — a client has to dispatch by `event` name (as
`new-fe/src/ws/socketClient.ts` already does) rather than assume strict
message-order, since a `LOG_EVENT` can legitimately interleave with
`STEERING_PANEL_READY`/etc. at any point.

Client side: `httpClient.ts`'s `configureNetworkLogger`/`socketClient.ts`'s
`configureWsLogger` are a third/fourth registration callback alongside the
existing auth ones, firing on every REST call and WS send/receive
respectively (never for `LOG_EVENT` itself — `socketClient.ts` has its own
matching guard). `stores/logViewerStore.ts` is the one thing that registers
both, plus subscribes to `socketClient.on("LOG_EVENT", ...)` directly,
merging all three sources (client REST, client WS, backend-pushed) into one
sorted, deduped, 1000-entry-capped timeline; `init()` is called once from
`App.tsx` (idempotent — guards against the WS singleton's listener set
growing every re-render), `setProjectId()` from `WorkspacePage.tsx`
whenever the route's `projectId` changes (clears the buffer and loads that
project's history). `components/common/LogViewerModal/` +
`hooks/useLogViewerModal.ts` (Ctrl+Shift+L) structurally mirror
`AiConfigModal`/`useAiConfigModal.ts` exactly.
