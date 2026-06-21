# Fix #2 Applied: WebSocket Events for Onboarding Flow

## Problem
The frontend was stuck on "Submitting input…" because:
1. Backend returned `OnboardingResult` (synchronous) but frontend expected `InputAccepted` (async pattern)
2. Backend never emitted WebSocket events that the frontend was listening for
3. No `input_id` was returned to track the operation

## Solution Applied
Modified the backend to emit WebSocket events during synchronous processing, matching the frontend's expected event sequence.

## Files Modified

### Backend

#### 1. `be/src/bluebox/modules/core_pipeline/application/onboarding_service.py`
- Added `input_id` field to `OnboardingResult`
- Added optional `broadcast_event` callback parameter to `submit_input()`
- Emits events during processing:
  - `INPUT_PROCESSING_STARTED` - with step list
  - `PROCESSING_STEP_COMPLETE` (x3) - after each step completes
  - `RICHNESS_MODE_DETECTED` - already emitted by WS handler
  - `PRD_ANALYSIS_READY` - already emitted by WS handler  
  - `COMPLIANCE_DETECTED` - already emitted by WS handler

#### 2. `be/src/bluebox/interfaces/api/routers/onboarding.py`
- Imported `connection_registry` to access WebSocket connections
- Created `broadcast_event()` helper that pushes events to connected clients
- Passed broadcaster to `OnboardingService.submit_input()`

### Frontend
No changes needed - the frontend already:
- Connects to WebSocket via `useEnsurePipelineConnection` hook
- Listens for all required events in `OnboardingFlow.tsx`
- Expects `input_id` in the response (now provided)

## Event Flow

```
Frontend                                         Backend
   |                                               |
   |-- Connect WS (via hook) ------------------->  |
   |                                               |
   |-- POST /input (with text) ----------------->  |
   |                                               |
   |                                            [Process:classify_richness]
   |                                               |
   |<-- INPUT_PROCESSING_STARTED ---------------  |
   |    (steps: [0,1,2])                          |
   |                                               |
   |                                            [richness done]
   |                                               |
   |<-- PROCESSING_STEP_COMPLETE ----------------  |
   |    (step_index: 0)                            |
   |                                               |
   |                                            [Process:analyze_prd]
   |                                               |
   |<-- PROCESSING_STEP_COMPLETE ----------------  |
   |    (step_index: 1)                            |
   |                                               |
   |                                            [Process:detect_compliance]
   |                                               |
   |<-- PROCESSING_STEP_COMPLETE ----------------  |
   |    (step_index: 2)                            |
   |                                               |
   |<-- RICHNESS_MODE_DETECTED ------------------  |
   |<-- PRD_ANALYSIS_READY (if WELL_FORMED) ----  |
   |<-- COMPLIANCE_DETECTED ---------------------  |
   |                                               |
   |<-- 200 OK (OnboardingResult ---------------  |
   |      with input_id)                           |
   |                                               |
```

## Testing

1. **Start backend:**
   ```bash
   cd /home/arun/IdeaProjects/bluebox/be
   uv run uvicorn bluebox.interfaces.api.app:create_app --factory --reload
   ```

2. **Start frontend:**
   ```bash
   cd /home/arun/IdeaProjects/bluebox/new-fe
   npm run dev
   ```

3. **Login and create a project**

4. **Submit input:**
   - Open browser DevTools → Network tab (for REST) + Console (for WS)
   - Paste a PRD and submit
   - Should see:
     - WebSocket connection established to `/api/v1/steering/session/{projectId}`
     - `INPUT_PROCESSING_STARTED` event with 3 steps
     - Three `PROCESSING_STEP_COMPLETE` events (indices 0, 1, 2)
     - `RICHNESS_MODE_DETECTED` with mode
     - `PRD_ANALYSIS_READY` (if WELL_FORMED)
     - `COMPLIANCE_DETECTED` with findings
     - REST response with `input_id`, `richness`, `compliance`

## Notes

- Events are emitted **synchronously** during the REST request (not background/async)
- Events are pushed via the **existing WebSocket connection** - no separate channel
- The `broadcast_event` callback is optional - existing code paths (e.g., from WebSocket handlers) continue to work without it
- If no WebSocket is connected, broadcasting silently fails (no effect on the REST response)
- The frontend's `InputProcessing` component will now show the 3-step progress bar instead of stuck at "Submitting input…"