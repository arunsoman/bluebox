# Dynamic AI Provider/Model Selection

## Overview
The system now supports dynamic per-request AI provider/model selection via HTTP headers from the frontend.

## Architecture

### Frontend (`new-fe/`)

#### 1. Zustand Store (`src/stores/aiStore.ts`)
- Persists provider/model selection in localStorage
- Default: `openai` / `gpt-4o`
- Updated via `setAiConfig(provider, model)`

#### 2. HTTP Client (`src/api/httpClient.ts`)
- Automatically injects headers into every request:
  - `X-AI-Provider: anthropic`
  - `X-AI-Model: claude-sonnet-4-6`
- Single choke point ensures all requests carry the current AI config

### Backend (`be/`)

#### 1. Context Module (`src/bluebox/shared_kernel/llm/context.py`)
- Holds `ContextVar` for provider/model
- Thread-safe, request-local storage

#### 2. Middleware (`src/bluebox/interfaces/api/app.py`)
- Extracts headers from incoming requests
- Sets context vars for duration of request
- Resets after response (no cross-request contamination)

#### 3. Connector (`src/bluebox/shared_kernel/llm/connector.py`)
- `build_agent()` now checks context vars before env vars
- **Resolution order:**
  1. Explicit `model` argument to `build_agent()`
  2. HTTP headers (`X-AI-Provider` + `X-AI-Model`)
  3. Environment variable `BLUEBOX_LLM_MODEL`

## Usage

### Frontend: Change Provider/Model
```typescript
import { useAiStore } from '@/stores/aiStore';

// In a component or store action
const { setAiConfig } = useAiStore();
setAiConfig('google-gla', 'gemini-2.5-pro');

// All subsequent API calls will use: google-gla:gemini-2.5-pro
```

### Backend: Override Per-Call
```python
from bluebox.shared_kernel.llm.connector import build_agent

# Use context-based selection (from headers)
agent = build_agent(MyResponse, "You are helpful...")

# Or override for specific call
agent = build_agent(MyResponse, "You are helpful...", model="openai:gpt-4o")
```

## Files Modified

### Frontend
- ✅ `new-fe/src/stores/aiStore.ts` (NEW)
- ✅ `new-fe/src/api/httpClient.ts` (PATCHED)

### Backend
- ✅ `be/src/bluebox/shared_kernel/llm/context.py` (NEW)
- ✅ `be/src/bluebox/shared_kernel/llm/connector.py` (PATCHED)
- ✅ `be/src/bluebox/interfaces/api/app.py` (PATCHED)

## Testing

### Backend Setup & Run

1. **Navigate to backend directory:**
   ```bash
   cd /home/arun/IdeaProjects/bluebox/be
   ```

2. **Activate the virtual environment (uv managed):**
   ```bash
   source .venv/bin/activate
   ```

3. **Set required environment variables:**
   ```bash
   # Copy example env file
   cp .env.example .env
   
   # Edit .env and set your API keys:
   # BLUEBOX_LLM_MODEL=anthropic:claude-sonnet-4-6
   # ANTHROPIC_API_KEY=your-key-here
   # (or OPENAI_API_KEY, GOOGLE_API_KEY, etc. depending on provider)
   ```

4. **Run the backend:**
   ```bash
   # Development mode with auto-reload
   uv run uvicorn bluebox.interfaces.api.app:create_app --factory --reload --port 8000
   
   # Or using the venv directly:
   .venv/bin/uvicorn bluebox.interfaces.api.app:create_app --factory --reload --port 8000
   ```

5. **Verify it's running:**
   - Open http://localhost:8000/docs to see the Swagger UI
   - Test endpoints directly from the browser

### Frontend Setup & Run

1. **Navigate to frontend directory:**
   ```bash
   cd /home/arun/IdeaProjects/bluebox/new-fe
   ```

2. **Install dependencies (if needed):**
   ```bash
   npm install
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env to point to backend:
   # VITE_API_BASE_URL=http://localhost:8000
   # VITE_WS_BASE_URL=ws://localhost:8000
   ```

4. **Run the frontend:**
   ```bash
   npm run dev
   ```

5. **Test the AI Config Modal:**
   - Open http://localhost:5173
   - Press `Ctrl+M` (or `Cmd+M` on Mac)
   - The AI Provider & Model dialog should appear
   - Select a provider and model
   - Click "Save & Close"
   - All subsequent API calls will use the new configuration

### Verify Headers

Open browser DevTools → Network tab → click any API request → check Request Headers:
- `X-AI-Provider: anthropic` (or your selected provider)
- `X-AI-Model: claude-sonnet-4-6` (or your selected model)

## Rate Limit Handling
The existing `run_structured()` in `connector.py` already handles 429 responses:
- Converts to `LLMFailure(failure_type="rate_limit")`
- Returns 429 status code to frontend
- Frontend `httpClient.ts` does NOT auto-retry (per SS7.2 "No Silent Retry")
- User sees error and can decide to retry or switch provider