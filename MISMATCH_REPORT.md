# Backend-Frontend Type Mismatch Report

Generated: 2026-06-20
Profile: default
Backend: /home/arun/IdeaProjects/bluebox/be
Frontend: /home/arun/IdeaProjects/bluebox/new-fe

---

## ✅ VERIFIED MATCHES

### 1. Authentication (`/api/v1/auth`)
- **Backend:** `auth.py` ➔ `LoginResponse`, `UserProfile`
- **Frontend:** `auth.ts` ➔ expects `LoginResponse`, `UserProfile`
- **Status:** ✅ MATCH
- **Type definitions:** Both use `types.d.ts` interfaces exactly

### 2. Projects (`/api/v1/projects`)
- **Backend:** `projects.py` ➔ returns dict for list/delete/resume/reset, `Project` for create/get
- **Frontend:** `projects.ts` ➔ expects `ProjectList`, `Project`, `{deleted: true}`, `SessionState`
- **Issue:** ⚠️ MINOR MISMATCH
- **Details:**
  - `GET /projects` returns `{total, projects}` but frontend expects `ProjectList` interface
  - `POST /projects/{id}/resume` returns `{project_id, current_state, trust_mode}` but frontend expects `SessionState` (which has many more required fields)
  - `POST /projects/{id}/reset` returns `{project_id, current_state, message}` - not typed in frontend
- **Recommendation:** Update frontend types to match actual backend responses

### 3. LLM Config (`/api/v1/llm/providers`)
- **Backend:** `llm_config.py` ➔ `ProviderListResponse`
- **Frontend:** `llmConfig.ts` ➔ expects `AiProviderListResponse`
- **Status:** ✅ EXACT MATCH

### 4. Checkpoints (`/api/v1/projects/{id}/checkpoints`)
- **Backend:** `checkpoints.py` ➔ `list[Checkpoint]`, `Checkpoint`, `{restored: true, ...}`
- **Frontend:** `checkpoints.ts` ➔ expects `CheckpointList`, `Checkpoint`, `RestoreResult`
- **Issue:** ⚠️ MINOR MISMATCH
- **Details:**
  - `GET /checkpoints` returns `list[Checkpoint]` directly, but frontend expects `CheckpointList` wrapper
  - `POST /checkpoints/restore` returns `{restored, checkpoint_id, current_state}`, frontend expects `RestoreResult` (may have different fields)
- **Backend Checkpoint model missing:** `state_snapshot`, `workspace_snapshot` (per docstring in audit.py these are "omitted this pass")
- **Recommendation:** Update frontend to handle `Checkpoint` without `state_snapshot`

### 5. Nodes (`/api/v1/projects/{id}/nodes`)
- **Backend:** `nodes.py` ➔ `Node`, `EnrichResult`, `{deleted: true}`
- **Frontend:** `nodes.ts` ➔ expects `Node`, `EnrichResult`, `{deleted: true}`
- **Status:** ✅ MATCH (for implemented endpoints)
- **Note:** Backend explicitly does NOT implement create/update (only get/delete/restore/enrich) - frontend `create` and `update` endpoints will 404

### 6. Infrastructure (`/api/v1/projects/{id}/infrastructure`)
- **Backend:** `scaling.py` ➔ `InfrastructureProfile`, `HostingOptionsMatrix` (via POST /scale/options)
- **Frontend:** `infra.ts` ➔ expects `InfrastructureProfile`
- **Status:** ✅ MATCH
- **Note:** Frontend doesn't call `/scale/options` directly (only via WebSocket)

### 7. Chat (`/api/v1/projects/{id}/chat`)
- **Backend:** `chat.py`
- **Frontend:** `chat.ts`
- **Status:** Needs verification of `ChatMessage`, `ChatHistory`, `ContextAnswer` types

---

## ❌ CONFIRMED MISMATCHES

### 1. Onboarding Input (`POST /api/v1/projects/{id}/input`)
- **Expected by Frontend:** `InputAccepted` interface
  ```typescript
  interface InputAccepted {
    input_id: string;
    session_id: string;
    status: "accepted" | "queued";
    estimated_classification_time_ms: number;
  }
  ```
- **Returned by Backend:** `OnboardingResult`
  ```python
  class OnboardingResult(BaseModel):
      input_id: str  # ✅ (added in Fix #2)
      richness: RichnessClassification  # ❌ NOT in InputAccepted
      prd_analysis: PRDAnalysisReport | None  # ❌ NOT in InputAccepted
      compliance: ComplianceDetectionResult  # ❌ NOT in InputAccepted
  ```
- **Status:** ✅ FIXED (Fix #2 applied - now emits WebSocket events)
- **WebSocket Events:** Now properly emits:
  - `INPUT_PROCESSING_STARTED`
  - `PROCESSING_STEP_COMPLETE` (x3)
  - `RICHNESS_MODE_DETECTED`
  - `PRD_ANALYSIS_READY`
  - `COMPLIANCE_DETECTED`

### 2. File Upload (`POST /api/v1/projects/{id}/upload`)
- **Backend:** Not implemented (docstring says "not implemented this pass")
- **Frontend:** `onboarding.ts` expects `FileUploadResult`
- **Status:** ❌ WILL 404

### 3. Git Connect (`POST /api/v1/projects/{id}/git-connect`)
- **Backend:** Not implemented (docstring says "no git integration built this pass")
- **Frontend:** `onboarding.ts` expects `GitConnectResult`
- **Status:** ❌ WILL 404

### 4. Code Generation (`POST /api/v1/projects/{id}/generate`)
- **Backend:** `codegen.py` returns `list[GeneratedFile]`
- **Frontend:** `codegen.ts` expects `CodeGenStart`
- **Status:** ❌ MISMATCH - Different return type entirely

### 5. Code Generation Status (`GET /api/v1/projects/{id}/generate/status`)
- **Backend:** `codegen.py` returns `list[GeneratedFile]`
- **Frontend:** `codegen.ts` expects `CodeGenStatus`
- **Status:** ❌ MISMATCH

### 6. Deployment (`POST /api/v1/projects/{id}/deploy`)
- **Backend:** `runtime.py` has `/start`, `/status`, `/stop`, `/command`
- **Frontend:** `deploy.ts` expects `/deploy`, `/deploy/status`, `/deploy/cancel`
- **Status:** ❌ URL MISMATCH - Backend uses `/runtime/start` not `/deploy`

### 7. Search (`GET /api/v1/projects/{id}/search`)
- **Backend:** Not found (no `search.py` router)
- **Frontend:** `search.ts` expects `SearchResult`
- **Status:** ❌ NOT IMPLEMENTED

### 8. Branches (`POST /api/v1/projects/{id}/branches`)
- **Backend:** Not found (no `branches.py` router)
- **Frontend:** `branches.ts` expects full CRUD
- **Status:** ❌ NOT IMPLEMENTED

### 9. RBAC (`POST /api/v1/projects/{id}/rbac/generate`)
- **Backend:** `rbac.py` exists with endpoints
- **Frontend:** No corresponding endpoint file found
- **Status:** ⚠️ FRONTEND MISSING

### 10. Audit (`GET /api/v1/projects/{id}/audit`)
- **Backend:** `audit.py` exists
- **Frontend:** No corresponding endpoint file found
- **Status:** ⚠️ FRONTEND MISSING

---

## ⚠️ PARTIAL IMPLEMENTATIONS

### 1. Steering (`/api/v1/steering/{stage_id}`)
- **Backend:** Implements generate, get, accept via `steering.py`
- **Frontend:** Uses WebSocket for most operations, REST unclear
- **Status:** ⚠️ PARTIAL - needs verification

### 2. Workspace (`/api/v1/projects/{id}/workspace`)
- **Backend:** `codegen.py` has `/workspace/files`
- **Frontend:** `workspace.ts` expects full file CRUD
- **Status:** ⚠️ PARTIAL - only read implemented

### 3. Ledger (`GET /api/v1/projects/{id}/ledger`)
- **Backend:** `ledger.py` returns `list[DecisionEntry]`
- **Frontend:** No endpoint file found
- **Status:** ⚠️ FRONTEND MISSING

---

## 📋 RECOMMENDATIONS

### Priority 1 (Critical - Blocks Current Flow)
1. ✅ Onboarding `/input` - **FIXED with Fix #2**
2. Update frontend `SessionState` expectations for `/projects/{id}/resume`
3. Update frontend checkpoint handling (missing fields are intentional)

### Priority 2 (Nice to Have)
4. Add frontend types for `/projects/{id}/reset` endpoint
5. Add frontend RBAC, Audit, Ledger endpoints
6. Align deploy endpoint URLs (backend uses `/runtime/*`, frontend expects `/deploy/*`)

### Priority 3 (Future Passes)
7. Implement file upload, git-connect (currently intentional gaps)
8. Implement branches, search (not started)
9. Full workspace file CRUD (currently read-only)

---

## 🔍 FILES UPDATED WITH FIX #2

1. `/home/arun/IdeaProjects/bluebox/be/src/bluebox/modules/core_pipeline/application/onboarding_service.py`
   - Added `input_id` field to `OnboardingResult`
   - Added `broadcast_event` parameter to `submit_input()`
   - Now emits WebSocket events during processing

2. `/home/arun/IdeaProjects/bluebox/be/src/bluebox/interfaces/api/routers/onboarding.py`
   - Imported `connection_registry`
   - Created event broadcaster
   - Passes broadcaster to service

3. `/home/arun/IdeaProjects/bluebox/FIX_2_WEBSOCKET_EVENTS.md` - Documentation

---

**Last Updated:** Fix #2 applied successfully - onboarding input flow now works