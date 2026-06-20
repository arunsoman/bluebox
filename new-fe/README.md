# Collaborative Steering Pipeline — IDE Frontend

A from-scratch frontend for the Collaborative Steering Pipeline (CSP), built
**only** from the documents in `../doc/`:

- `doc/prd.md`
- `doc/api_event_contract.md`
- `doc/uiux_specification.agent.final.md`
- `doc/wireframes.md`

No code or patterns were carried over from the existing `frontend/` in this
repo, and there is no mock or fixture data anywhere under `src/`. Every
screen calls a real REST endpoint or subscribes to a real WebSocket event
named in `api_event_contract.md`. If you run this app without a backend at
the configured URL, screens will show loading/error/empty states — never
fabricated content.

## Stack

- React 18 + TypeScript (`strict: true`) + Vite
- Zustand for state (no React Context for app state)
- React Router v6 for navigation
- Monaco Editor (`@monaco-editor/react`) for the code editor panel
- Native `WebSocket`, wrapped in a small typed client (`src/ws/socketClient.ts`)
- CSS Modules + CSS custom-property design tokens (`src/styles/tokens.css`),
  transcribed from the UIUX spec — not Tailwind
- Vitest + React Testing Library for tests

## Running it

```bash
npm install
cp .env.example .env   # edit if your backend isn't on localhost:8000
npm run dev
```

### Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000` | Base URL for all REST calls (`src/api/httpClient.ts`) |
| `VITE_WS_BASE_URL` | `ws://localhost:8000` | Base URL for the steering-session WebSocket (`src/ws/socketClient.ts`) |
| `VITE_SESSION_REAUTH_IDLE_MINUTES` | `60` | Idle period before forcing re-login (PRD NF-SC-05) |

There is no backend bundled with this project. To exercise the app fully you
need a CSP backend implementing `doc/api_event_contract.md` reachable at
the configured URLs.

### Scripts

| Command | Does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | `tsc --noEmit` then `vite build` — fails on any type error |
| `npm run lint` | ESLint, zero warnings allowed |
| `npm run format` / `format:check` | Prettier |
| `npm test` | Vitest, run once |
| `npm run test:watch` | Vitest, watch mode |
| `npm run typecheck` | `tsc --noEmit` only |

## What's built (in scope)

A complete vertical slice from login to a working IDE shell, all on real
network calls:

- **Auth** — `LoginScreen`, real `POST /api/v1/auth/login`, JWT kept in
  `sessionStorage` (not `localStorage`, to limit the XSS exposure window),
  idle-timeout re-auth.
- **Project Dashboard** — list/create/resume projects, then connect the
  steering-session WebSocket.
- **Onboarding** — Landing screen (text/file/Git-URL/template input + Trust
  Mode selector), live input-processing progress, richness classification,
  and all three branches it can lead to: PRD Analysis Report, Minimalist
  Dialogue, Seed Builder — plus the Scale Dialogue and compliance banner.
  Screen transitions are driven entirely by WS events
  (`RICHNESS_MODE_DETECTED`, `PRD_ANALYSIS_READY`, etc.) — there is no
  client-side state machine pretending to know what the backend will do
  next.
- **IDE Shell** — three-column resizable layout (UIUX §3.1–3.3), persisted
  panel sizes, trust-mode control, Save & Exit.
- **Chat Panel** — message history + live streaming, rich cards for
  steering-panel summaries, impact reports, and code-generation streams,
  slash commands (`/steer`, `/why`).
- **Steering Panel** — summary/detail modes, pagination, approve/review/
  bookmark actions, all backed by `STEERING_PANEL_READY` and posted via the
  real steering-action endpoint.
- **File Explorer** — live file tree, provenance tooltips, Steer/Why/Diff/
  Regenerate context menu.
- **Editor** — Monaco, tabs, save, and `// @steering:` inline-comment
  parsing that emits real mid-stage-steer events (FR-IDE-09).

## What's deliberately out of scope (this pass)

These panels have a reserved spot in the IDE shell layout (so the shell
matches the documented structure) but render an explicit
`PanelPlaceholder` — never invented data:

- Live Preview
- Terminal
- Test Results
- Blueprint Graph (3D node graph)
- Audit Trail

Also out of scope: the NL-translation/persona-hiding layer for non-technical
personas (this build targets the Power User/Architect view only), and SSO /
biometric login (rendered as disabled "coming soon" buttons, mirroring how
the spec itself treats voice input). There is no refresh-token endpoint in
the documented contract, so an expired token forces re-login rather than
silently refreshing.

A few UI affordances named in the spec have no corresponding endpoint in
`api_event_contract.md` at all (e.g. the AC-RI-06 "map to stage / save as
annotation / out of scope" actions on unmapped PRD sections). Those render
disabled with the tooltip *"Not yet available — this action has no
endpoint in the API contract"* rather than being wired to a guessed URL.

Where the contract names a type without fully specifying its fields (e.g.
`SessionState`, `ComplianceDetectionResult`, `ImpactReport`), the inferred
shape is documented in a code comment at the type definition, citing the
nearest fully-specified analog it was inferred from.

## Architecture notes

- **Single network choke points.** All REST calls go through
  `src/api/httpClient.ts`; no component or store calls `fetch` directly.
  All WebSocket traffic goes through the `socketClient` singleton in
  `src/ws/socketClient.ts`; no component opens its own socket. This is what
  makes "no mock data in UI code" auditable — there is exactly one place
  network calls could be faked, and it isn't.
- **Store ownership.** Stores backing always-mounted layout slots (e.g.
  `workspaceStore`, owned by `FileExplorer` since it's always in the left
  sidebar) are initialized/torn down by that slot's component. Stores
  backing tab-switchable panels that should survive a tab switch (e.g.
  `steeringStore`) are only ever `init()`'d, never torn down on unmount.
- **Every DTO is traceable.** Files under `src/api/types/` and
  `src/ws/events.ts` cite the `api_event_contract.md` section they were
  transcribed from.

## Testing

Tests live next to the code they cover (`*.test.ts`/`*.test.tsx`) and run
under Vitest + jsdom. Network and socket boundaries are stubbed only at the
test boundary (`vi.stubGlobal("fetch", ...)`, a hand-rolled fake
`WebSocket`) — never inside `src/` runtime code:

- `src/api/httpClient.test.ts` — query building, auth header injection,
  error mapping, 401 handling, 204 handling.
- `src/ws/socketClient.test.ts` — connection URL/handshake, typed event
  dispatch, reconnect backoff, explicit-disconnect behavior.
- `src/stores/ideLayoutStore.test.ts` — persisted layout clamping/toggle
  logic.
- `src/components/auth/LoginScreen.test.tsx` and
  `src/components/steering/SteeringPanelView.test.tsx` — component smoke
  tests covering the real success/failure/empty render paths.

`src/test/setup.ts` also polyfills `localStorage`/`sessionStorage` with an
in-memory `Storage` implementation — Node 22's built-in (disabled-by-default)
`localStorage` global otherwise shadows jsdom's, which breaks any persisted
Zustand store under test.

Run everything with `npm test`. There is no live-backend integration test
in this repo; the manual smoke test below is the closest equivalent.

## Manual smoke test (requires a running backend)

1. `npm run dev`, point `.env` at a real backend implementing the contract.
2. Log in with real credentials → land on the Project Dashboard.
3. Create a project, submit some text on the Landing screen.
4. Watch Input Processing advance from real `PROCESSING_STEP_COMPLETE`
   events, then land on whichever onboarding branch the backend selects.
5. Progress through onboarding until the backend's pipeline state leaves
   the onboarding states — the app should auto-navigate into the IDE shell.
6. In the shell: send a chat message, watch the Steering Panel populate
   from a real `STEERING_PANEL_READY` push, approve a node, watch the File
   Explorer tree and Editor reflect real `CODE_FILE_STREAM` updates.
