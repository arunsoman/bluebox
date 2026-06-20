## Updated Architecture Document

Here is the updated Architecture document with the IDE and code generation layers woven in:

```markdown
# Collaborative Steering Pipeline — System Architecture Document

**Version:** 1.1  
**Status:** Authoritative  
**Date:** 2026-06-19  
**Classification:** Internal — Engineering & Implementation Reference

---

## 1. Executive Summary

The **Collaborative Steering Pipeline** is a stateful, human-in-the-loop system that transforms free-text user input (from a single sentence to a 50-page PRD) into a rigorous, machine-executable `ProjectBlueprint`. The architecture is designed around a **Modular Monolith** pattern with **Domain-Driven Design (DDD)** principles, enforced by a strict finite state machine.

**v1.1 Clarification:** The system is not a backend-only pipeline. It is the **intelligence layer of an LLM-native IDE**. The final artifact is not a JSON file — it is a **live codebase in a workspace** with a file explorer, editor, terminal, and live preview. The architecture must support bidirectional WebSocket communication between the backend pipeline and the React-based IDE frontend, with real-time code streaming, hot reload, and interactive steering.

The system guarantees **zero silent defaults**, **immutable auditability**, **blueprint completeness**, and now **live code generation** through a mandatory Stage 7 (Completeness Gate) and Stage 8 (Code Generation) before any artifact is exported.

---

## 2. Architectural Goals & Constraints

### 2.1 Primary Goals
| Goal | Architectural Implication |
|------|---------------------------|
| **Zero Silent Defaults** | Every inference requires explicit user consent; state machine enforces pause points. |
| **Blueprint Completeness** | Stage 7 gate blocks export until all mandatory fields are resolved or explicitly deferred. |
| **Live Code Generation** | Stage 8 compiles the blueprint into files; IDE streams files in real-time. |
| **Real-Time Steering** | WebSocket-driven streaming with <2s interrupt granularity; IDE panels react to all events. |
| **Impact Transparency** | Dependency graph engine computes downstream effects before any change is committed. |
| **Immutable Auditability** | Append-only decision ledger + tiered audit trail (DIFF/FULL/REFERENCE). |
| **Context Overflow Resilience** | LLM abstraction layer with token estimation, compression, and two-pass strategies. |
| **What/How Separation** | User steers intent via chat; system generates implementation via code. |

### 2.2 Constraints
- **Stateful Sessions:** The pipeline maintains rich session state; horizontal scaling requires sticky sessions or external state store.
- **Low-Latency Iteration:** The impact analysis loop must complete in <500ms for graphs up to 1,000 nodes.
- **Deterministic Recovery:** Every stage boundary produces an immutable checkpoint.
- **No Distributed Sagas:** A modular monolith is chosen over microservices to avoid distributed transaction overhead for the iterative impact loop.
- **IDE-First:** All backend events must be renderable by the React frontend within <1s.

---

## 3. High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  Web UI      │  │  CLI         │  │  IDE Plugin  │  │  API Clients │    │
│  │  (React/3D)  │  │  (Python/JS) │  │  (VS Code)   │  │  (CI/CD)     │    │
│  │  [PRIMARY]   │  │              │  │              │  │              │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
└─────────┼─────────────────┼─────────────────┼─────────────────┼─────────────┘
          │                 │                 │                 │
          └─────────────────┴────────┬────────┴─────────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │     API GATEWAY / LB        │
                    │  (WebSocket + REST Router)  │
                    └──────────────┬──────────────┘
                                   │
┌──────────────────────────────────▼────────────────────────────────────────┐
│                      COLLABORATIVE STEERING PIPELINE                         │
│                         (Modular Monolith — DDD)                             │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  DOMAIN MODULES (Strictly Isolated)                                  │   │
│  │                                                                      │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────┐ │   │
│  │  │ Input Module │ │ Core Module  │ │Advisor Module│ │ Governance  │ │   │
│  │  │              │ │              │ │              │ │   Module    │ │   │
│  │  │ • PRD Parser │ │ • Stage 0-9  │ │ • Scale/Infra│ │ • Decision  │ │   │
│  │  │ • Richness   │ │   Executors  │ │ • Tech Stack │ │   Ledger    │ │   │
│  │  │   Classifier │ │ • Streaming  │ │ • RBAC       │ │ • Revision  │ │   │
│  │  │ • Compliance │ │   Chunk Mgr  │ │   Advisor    │ │   Engine    │ │   │
│  │  │   Scanner    │ │ • State Mach │ │              │ │ • CRUD Node │ │   │
│  │  │ • Unmapped   │ │ • Context    │ │              │ │   Service   │ │   │
│  │  │   Router     │ │   Window Mgr │ │              │ │             │ │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └─────────────┘ │   │
│  │                                                                      │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────┐ │   │
│  │  │ Chat Module    │ │ Audit Module │ │ Graph Module │ │ Code Gen    │ │   │
│  │  │              │ │              │ │              │ │   Module    │ │   │
│  │  │ • ContextAgent │ │ • Trail Svc  │ │ • DAG Engine │ │ • Generator │ │   │
│  │  │ • ChatOrchestr │ │ • Checkpoint │ │ • Impact Anl │ │ • Workspace │ │   │
│  │  │ • Hypothetical │ │   Manager    │ │ • Cycle Det  │ │   Manager   │ │   │
│  │  │   Sandbox      │ │ • Budget Mgr │ │ • Sandbox    │ │ • Runtime   │ │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ │   Sandbox   │ │   │
│  │                                                      └─────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  CROSS-CUTTING INFRASTRUCTURE                                        │   │
│  │                                                                      │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────┐ │   │
│  │  │ Event Bus    │ │ Service Loc  │ │ LLM Abstrac  │ │ Auth/Sec    │ │   │
│  │  │ (Redis/RMQ)  │ │ (Sync Reads) │ │ tion Layer   │ │ (RBAC/JWT)  │ │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └─────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
┌─────────▼─────────┐  ┌───────────▼──────────┐  ┌──────────▼──────────┐
│  PostgreSQL       │  │  S3 / Blob Storage   │  │  TimescaleDB        │
│  (State DB)       │  │  (Checkpoints /      │  │  (Audit Events)     │
│  • Active State   │  │   Full Snapshots)    │  │  • Append-Only Log  │
│  • DecisionLedger │  │  • Immutable         │  │  • 90-Day Retention │
│  • RBAC Model     │  │  • Versioned         │  │  • Time-Series      │
│  • User Profiles  │  │                      │  │   Queries           │
└───────────────────┘  └──────────────────────┘  └─────────────────────┘
          │
          │
┌─────────▼─────────┐
│  Vector Store     │
│  (Optional RAG)   │
│  • Chat Context   │
│  • PRD Embeddings │
└───────────────────┘
```

---

## 4. Domain Module Specifications

### 4.1 Input Processing Module
**Responsibility:** Ingest, classify, and parse all user input.

**Key Components:**
- `RichnessClassifier`: Determines `WELL_FORMED` | `MINIMALIST` | `SEED_ONLY`. Shows classification basis to user for override.
- `PRDAnalyzer`: Maps explicit PRD sections, flags thin/conflicting statements, identifies `unmapped_input`.
- `ComplianceAutoDetector`: Scans for GDPR, HIPAA, PCI-DSS, SOC2, ISO27001, CCPA. Pre-populates `AuditPolicy` with conservative defaults (e.g., GDPR → 2555-day retention).
- `UnmappedSectionRouter`: Routes unmatched PRD sections to pipeline stages, `CustomAnnotation` nodes, or `OutOfScope`.
- `LegacyIngestor`:
  - Activated when the user provides a Git URL or uploads a `.zip` of existing code.
  - Runs a static analysis pass (AST parsing) to reverse-engineer existing Entities, API Routes, and Database Schemas.
  - Produces a `LegacyContextReport` mapping existing code to Pipeline concepts (e.g., `ExistingActor: "User"`, `ExistingCapability: "Payment"`).
  - **Critical:** Stage 0-6 are re-run with this context. The pipeline never generates code that duplicates or breaks existing functionality.

**State Interactions:**
- Emits `InputClassified` event → triggers `PipelineOrchestrator` transition `INITIALIZED → CLASSIFYING`.
- Emits `PRDAnalysisComplete` event → pre-populates Stage 0 seed.

### 4.2 Core Pipeline Module (Stages 0–9)
**Responsibility:** Execute the sequential stage engine with strict state machine enforcement.

**Key Components:**
- `PipelineOrchestrator`: Single source of truth for `pipeline_state`. Holds current stage index, state machine status, and `ContextWindowManager`.
- `StageExecutorFactory`: Abstract `BaseStageExecutor` with concrete implementations:
  - `Stage0SeedExecutor`
  - `Stage1IdeationExecutor`
  - `Stage2ActorExecutor`
  - `Stage3CapabilityExecutor`
  - `Stage4UseCaseExecutor`
  - `Stage5StoryExecutor`
  - `Stage6TaskExecutor`
  - `Stage7FinalizationExecutor`
  - `Stage8CodeGenerationExecutor` (v1.1 ADD)
  - `Stage9RuntimeExecutor` (v1.1 ADD)
- `StreamingChunkManager`: Serializes LLM output into `StreamChunk`s (1 logical node per chunk). Emits `CHUNK_READY` events at <2s intervals. Checks for interrupt signals at chunk boundaries.
- `ContextWindowManager`: Token estimation, compression strategy, and two-pass summarization for LLM context overflow.

**State Machine (Strict):**
```
[*] → INITIALIZED → CLASSIFYING → (AWAITING_INPUT_SEED | STAGE_RUNNING)
STAGE_RUNNING → STREAMING_CHUNKS → AWAITING_STEERING
AWAITING_STEERING → (STAGE_RUNNING | REVISING | CHATTING)
REVISING → IMPACT_ANALYZING → AWAITING_PROPAGATION_CONSENT → (STAGE_RUNNING | AWAITING_STEERING)
STAGE_RUNNING → STAGE_COMPLETED → FINAL_GATE → (AWAITING_STEERING | FINALIZED)
FINALIZED → CODE_GENERATING → AWAITING_CODE_REVIEW → (CODE_GENERATING | RUNNING)
RUNNING → AWAITING_RUNTIME_FEEDBACK → (STAGE_RUNNING | FINALIZED)
```

**Critical Rule:** No state transition is permitted except via explicit user action or system event. Attempting `run_next_stage()` without a `STEERING_ACTION` throws `PipelinePausedError`.

### 4.3 Advisory Module
**Responsibility:** Proactively fill operational gaps (scale, tech stack, RBAC).

**Key Components:**
- `ScaleInfraAdvisor`:
  - `ScaleDialogue`: Detects missing scale signals, offers `SMALL`/`MEDIUM`/`LARGE` personas.
  - `HostingOptionsMatrix`: Generates 3-6 options with `CostRange` (basis, assumptions, exclusions).
  - `ScaleInputValidator`: Checks logical consistency (e.g., peak concurrent ≤ total launch users).
  - `InfrastructureProfile`: Committed profile; marked `stale` on revision (never auto-updated).
- `TechStackAdvisor`:
  - `SignalDetector`: Detects explicit mentions ("React, Node") or implicit signals ("real-time" → WebSockets).
  - `TechStackOptionsMatrix`: 3-5 options with `actor_compatibility`, `scale_fit`, `learning_curve`.
  - `TechStackProfile`: Component-level selection (frontend, backend, database, cache, etc.).
- `RBACAdvisor`:
  - `RBACModelGenerator`: Builds model from actors, capabilities, use cases.
  - `InheritanceValidator`: Default depth limit 3 (configurable to 5). Mandatory DFS cycle detection.
  - `PrivilegeEscalationAnalyzer`: `STATIC_ESCALATION_ANALYSIS` before commit.

### 4.4 Governance & Manipulation Module
**Responsibility:** Node-level CRUD, revision engine, and impact propagation.

**Key Components:**
- `CRUDNodeService`: Handles **Enrich, Add, Edit, Remove, Deactivate, Restore**.
  - *Critical:* Does not save immediately. Wraps changes in `ProposedChange` and triggers `RevisionEngine`.
- `RevisionEngine`: Orchestrates the 4-step Iterative Impact Loop:
  1. Receives `ProposedChange`.
  2. Calls `DependencyGraphService` → `ImpactReport`.
  3. Stores `ImpactReport`; waits for `PropagationConsent`.
  4. On consent: marks old nodes `superseded`, triggers selective stage rerun.
- `RevisionBranching` (Sandboxed Proposals):
  - The system abandons the rigid "cap of 5."
  - **Parallel What-If:** When a user requests a revision, the system spawns an isolated `ProposalBranch` (lightweight clone of the current state) where the impact analysis and propagation run in a sandbox.
  - The user can spawn unlimited ProposalBranches (e.g., "Option A: PostgreSQL" vs "Option B: DynamoDB") without affecting the main pipeline or consuming a hard budget.
  - **Commit vs. Discard:** The user reviews the sandboxed results and chooses to `COMMIT_BRANCH` (applying changes to the main state) or `DISCARD_BRANCH` (deleting it).
  - This turns "revision anxiety" into "exploration freedom."
- `UserOptionValidator`: Checks upstream contradictions when users add custom nodes.

**Node States:**
| State | Meaning |
|-------|---------|
| `SYSTEM_GENERATED` | Auto-generated by LLM, awaiting user confirmation. |
| `USER_ENRICHED` | User added context/description to existing node. |
| `USER_DEFINED` | User added a brand-new node not generated by system. |
| `SUPERSEDED` | Replaced by a newer version; archived in Decision Ledger. |
| `INFERRED` | System made an assumption; requires explicit confirmation. |
| `DEFERRED` | Explicitly marked as pending by user with rationale. |
| `ORPHANED` | Downstream node whose parent was removed/deactivated. |

### 4.5 Graph & Impact Analysis Module
**Responsibility:** Dependency graph construction, traversal, and sandboxed what-if analysis.

**Key Components:**
- `DependencyGraphService`:
  - Constructs in-memory DAG: `Story → UseCase → Capability → Actor`.
  - **Downstream Traversal:** Given Node ID, returns `directly_affected_nodes` and `transitively_affected_nodes`.
  - **Upstream Traversal:** Identifies which stages must rerun.
  - **Cycle Detection:** DFS-based validation for RBAC inheritance.
- `HypotheticalSandbox`: Clones current state, runs `ImpactAnalyzer` in read-only mode for "What-If" queries. No live state mutation.

**Performance Target:** Impact analysis for graphs up to 1,000 nodes must complete in <500ms.

### 4.6 Chat & Context Agent Module
**Responsibility:** Natural language interface for querying state and executing commands.

**Key Components:**
- `ChatOrchestrator`: Manages WebSocket session lifecycle.
- `ContextAgent` (RAG over State):
  - **Read Commands:** Parses intent ("List all actors touching Order entity") → queries Persistence layer.
  - **Write Commands:** Parses intent ("Add Fraud Detection capability") → maps to `CRUDNodeService`.
  - **What-If Commands:** Routes to `HypotheticalSandbox`.
- `IntentParser`: Maps natural language to structured `NODE_MANIPULATION` or `STEERING_ACTION` events.

### 4.7 Audit & Recovery Module
**Responsibility:** Immutable logging, checkpointing, and budget management.

**Key Components:**
- `AuditTrailService`:
  - Intercepts every service call via decorator.
  - **Tiered Storage:**
    - `DIFF`: Default. Stores deltas only.
    - `FULL`: At stage boundaries. Stores complete state snapshots.
    - `REFERENCE`: At 100% budget capacity. Stores pointers to prior full snapshots + latest diff.
  - **Budget Management:** Default 100MB storage budget, 90-day retention. Auto-switches to `REFERENCE` at capacity.
  - **Storage:** TimescaleDB for time-series query performance.
- `CheckpointManager`:
  - Subscribes to `STAGE_COMPLETED` events.
  - Serializes `PipelineOrchestrator` state + `DecisionLedger` to S3 as immutable `Checkpoint`.
  - Supports manual restore via `POST /checkpoint/restore/{project_id}`.

### 4.8 Code Generation & Runtime Module [v1.1 NEW]
**Responsibility:** Compile the blueprint into executable code, manage the workspace, and run the application.

**Key Components:**
- `CodeGenerator`:
  - Consumes `TaskDecompositionResult` + `TechStackProfile` + `RBACModel` + `InfrastructureProfile`.
  - Selects project template from `templates/` directory based on `TechStackProfile`.
  - Generates files per `EngineeringTask.file_paths` with `ProvenanceHeader` in each file.
  - Emits `CODE_FILE_STREAM` events for real-time IDE streaming.
- `WorkspaceManager`:
  - Manages the IDE file system (virtual or physical).
  - Handles dependency installation (`npm install`, `pip install`).
  - Produces `WorkspaceManifest` with `run_command`, `test_command`, `build_command`.
  - Versions workspace snapshots for diff/rollback.
  - **Implements Three-Way Merge for Regeneration:**
    - When a Blueprint revision triggers Stage 8, the WorkspaceManager does NOT blindly overwrite files.
    - It computes a 3-way diff: `[Base (Original Blueprint)]` vs. `[Current Workspace (User Edits)]` vs. `[New Blueprint (Regenerated)]`.
    - If user edits overlap with blueprint changes, the system emits `MERGE_CONFLICT` and opens a **Conflict Resolution Panel** in the IDE Editor (side-by-side diff).
    - The user must resolve conflicts before the workspace snapshot is finalized.
- `RuntimeSandbox`:
  - Isolated execution environment (iframe, Docker container, or VM).
  - Runs `run_command` from `WorkspaceManifest`.
  - Manages hot reload via WebSocket HMR.
  - Captures test results and streams them to IDE Test Results Panel.
  - Accepts user feedback from Live Preview and routes to `RevisionEngine`.

### 4.9 Deployment Pipeline Module (Stage 10) [v1.2 NEW]
**Responsibility:** Bridge the generated code to production/staging environments.

**Key Components:**
- `DeploymentBridge`: Integrates with Vercel, AWS Amplify, Netlify, or custom Kubernetes clusters via API.
- `EnvironmentConfigurator`: Maps `InfrastructureProfile` to environment variables, secrets, and scaling rules.
- `PreviewURLManager`: Generates unique, shareable URLs (e.g., `project-name.pr-123.vercel.app`) accessible to external stakeholders (not just the local sandbox).

**State Transition:** `RUNNING → AWAITING_DEPLOYMENT_ACTION → DEPLOYING → DEPLOYED`.

---

## 5. Data Architecture

### 5.1 Persistence Strategy

| Store | Purpose | Schema/Format | Retention |
|-------|---------|---------------|-----------|
| **PostgreSQL** | Active state, decision ledger, RBAC model, user profiles | Relational (normalized) | Indefinite |
| **S3/Blob** | Immutable checkpoints, full audit snapshots, PRD uploads, workspace snapshots | JSON (versioned) + binary | Indefinite |
| **TimescaleDB** | Append-only audit events, time-series queries | Time-series hypertable | 90 days |
| **Vector Store** (Optional) | Chat context embeddings, PRD semantic search | Vector embeddings | Session-based |

### 5.2 Core Data Flow

```
User Input → PostgreSQL (Active State)
    ↓
Stage Execution → PostgreSQL (Stage Outputs) + Event Bus (Side Effects)
    ↓
Checkpoint Trigger → S3 (Immutable Snapshot)
    ↓
Audit Event → TimescaleDB (Append-Only)
    ↓
Impact Analysis → In-Memory DAG (Redis/Local) → PostgreSQL (Updated State)
    ↓
Code Generation → WorkspaceManager → File System (Workspace)
    ↓
Runtime → RuntimeSandbox → Live Preview + Test Results
```

### 5.3 The `ProjectBlueprint` Artifact

The final output is a self-contained JSON object requiring zero additional inference:

```json
{
  "project_id": "uuid",
  "project_name": "string",
  "problem_statement": "string",
  "actors": [...],
  "capabilities": [...],
  "use_cases": [...],
  "user_stories": [...],
  "tech_stack_profile": "TechStackProfile | DeferredArtifact",
  "infrastructure_profile": "InfrastructureProfile | DeferredArtifact",
  "rbac_model": "RBACModel | DeferredArtifact",
  "task_decomposition": [...],
  "custom_annotations": [...],
  "decision_ledger_summary": {...},
  "completeness_status": "complete | deferred",
  "completeness_report": {...},
  "workspace_manifest": "WorkspaceManifest | null",
  "runtime_report": "RuntimeReport | null",
  "created_at": "ISO8601",
  "version": 1
}
```

---

## 6. API & Integration Architecture

### 6.1 WebSocket API (Stateful — Real-Time Steering, Chat & Code Streaming)

**Endpoint:** `wss://api/v1/steering/session/{session_id}`

**Connection Lifecycle:**
1. Client opens WebSocket with JWT auth token.
2. Server loads `PipelineOrchestrator` state from PostgreSQL (or creates new).
3. Server emits current state (`STEERING_PANEL_READY` or `STREAMING_CHUNKS` or `CODE_FILE_STREAM`).
4. Bidirectional message exchange until session close.
5. On disconnect: state persisted to PostgreSQL; checkpoint created if at stage boundary.

**Backend → Frontend Events:**
| Event | Payload | Trigger |
|-------|---------|---------|
| `STEERING_PANEL_READY` | `{ stage_id, nodes[], status }` | Stage boundary reached |
| `CHUNK_STREAM` | `{ chunk_id, node_type, node_data, stage_id }` | LLM output chunk ready |
| `NODE_UPDATED` | `{ node_id, node_type, change_type, new_data }` | CRUD operation committed |
| `IMPACT_REPORT_READY` | `{ report_id, directly_affected[], transitively_affected[], stages_to_rerun[] }` | Revision proposed |
| `CHECKPOINT_RESTORED` | `{ checkpoint_id, restored_stage, timestamp }` | Recovery action |
| `STATE_TRANSITION` | `{ from_state, to_state, reason }` | State machine change |
| `CHAT_RESPONSE` | `{ message, intent_matched, action_taken }` | ContextAgent reply |
| `ERROR` | `{ code, message, recoverable, options[] }` | LLM failure or validation error |
| `CODE_FILE_STREAM` | `{ file_path, content_delta, layer, task_id }` | File generation in progress | v1.1 ADD |
| `CODE_FILE_COMPLETE` | `{ file_path, content_hash, size_bytes, provenance }` | File generation done | v1.1 ADD |
| `DEPENDENCY_INSTALL_STATUS` | `{ status, logs }` | Dependency install progress | v1.1 ADD |
| `RUNTIME_STARTED` | `{ preview_url, sandbox_id }` | Application running | v1.1 ADD |
| `TEST_RESULT_STREAM` | `{ test_name, status, duration_ms, stack_trace? }` | Test executed | v1.1 ADD |

**Frontend → Backend Events:**
| Event | Payload | Action |
|-------|---------|--------|
| `STEERING_ACTION` | `{ action: accept\|modify\|replace, stage_id, payload }` | Resume pipeline |
| `NODE_MANIPULATION` | `{ action: add\|edit\|remove\|deactivate\|restore, node_type, node_id, data }` | CRUD operation |
| `CHAT_MESSAGE` | `{ text, intent: command\|question\|what_if }` | Natural language interaction |
| `PROPAGATION_CONSENT` | `{ impact_report_id, confirmed: bool, notes }` | Approve/reject impact propagation |
| `INTERRUPT_SIGNAL` | `{ stage_id, chunk_id }` | Pause streaming at next chunk boundary |
| `CHECKPOINT_REQUEST` | `{ action: create\|restore, checkpoint_id? }` | Manual checkpoint management |
| `CODE_FILE_STEER` | `{ file_path, action: accept\|reject\|modify, instruction? }` | Steer code generation | v1.1 ADD |
| `PREVIEW_FEEDBACK` | `{ text, element_selector? }` | Feedback from live preview | v1.1 ADD |
| `RUNTIME_COMMAND` | `{ command, args[] }` | Execute command in terminal | v1.1 ADD |

### 6.2 REST API (Management & Export)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/blueprint/{project_id}` | Export finalized `ProjectBlueprint` | JWT |
| GET | `/blueprint/{project_id}/completeness` | Check Stage 7 gate status | JWT |
| GET | `/ledger/{project_id}` | Fetch full `DecisionLedger` | JWT |
| GET | `/ledger/{project_id}/entry/{entry_id}` | Fetch specific decision | JWT |
| GET | `/audit/{project_id}?from=&to=&type=` | Export audit events (paginated) | JWT + Admin |
| POST | `/session` | Create new pipeline session | JWT |
| GET | `/session/{session_id}/state` | Get current state machine status | JWT |
| POST | `/checkpoint/restore/{project_id}` | Restore to checkpoint | JWT |
| GET | `/checkpoint/{project_id}` | List available checkpoints | JWT |
| POST | `/session/{session_id}/abort` | Abort session with reason | JWT |
| GET | `/workspace/{project_id}/files` | List workspace files | JWT | v1.1 ADD |
| GET | `/workspace/{project_id}/file/{path}` | Get file content | JWT | v1.1 ADD |
| POST | `/workspace/{project_id}/run` | Start runtime sandbox | JWT | v1.1 ADD |
| POST | `/workspace/{project_id}/test` | Run tests | JWT | v1.1 ADD |

### 6.3 LLM Integration Layer

**Architecture:**
```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│   StageExecutor │────▶│  ContextWindowManager│────▶│  LLMClient      │
│   (Prompt Build)│     │  (Token Strategy)    │     │  (OpenAI/Anthro)│
└─────────────────┘     └──────────────────────┘     └─────────────────┘
         │                                               │
         │                                               │
         ▼                                               ▼
┌─────────────────┐                           ┌─────────────────┐
│ PromptSanitizat │                           │  MockLLMClient  │
│ ionLayer        │                           │  (Test Mode)    │
└─────────────────┘                           └─────────────────┘
```

**ContextWindowManager Strategies:**
| Token Range | Strategy | Description |
|-------------|----------|-------------|
| `< 60k` | Full Context | Pass complete raw context to LLM. |
| `60k – 100k` | Semantic Retrieval (RAG) | Instead of dropping data, the system queries a Vector Store (pgvector) over the Pipeline State. It retrieves only the top-5 most semantically relevant past Decisions, Actors, and Use Cases related to the current task, preserving nuance. |
| `> 100k` | Hybrid (RAG + Compressed) | Retrieve top-10 relevant nodes + pass a dense structured summary of *non-retrieved* nodes. Eliminates the two-pass hallucination risk. |

**LLMClientInterface Failure Modes:**
- `timeout` → Emit `STEERING_REQUIRED` with 4 options: retry, modify, skip, restore checkpoint.
- `malformed_json` → Emit `STEERING_REQUIRED` with parsed partial + repair options.
- `context_overflow` → Trigger `ContextWindowManager` escalation to Two-Pass.
- `rate_limit` → Queue with exponential backoff; notify user via WebSocket.

**Testing Contract:**
- `MockLLMClient` must be injectable in all services.
- `SandboxMode` flag routes all LLM calls to `MockLLMClient` for deterministic testing.
- State Reconstruction Test: Load checkpoint fixture → manipulate → assert ledger state.

### 6.4 IDE Frontend Architecture [v1.1 NEW]

**Responsibility:** The React-based IDE frontend is the sole user-facing surface. It consumes WebSocket events and renders panels.

**Key Components:**
- `AppShell`: Layout manager (resizable panels, tabs, pop-outs).
- `ChatPanel`: Message history, rich bubble rendering, command palette.
- `SteeringPanelComponent`: Docked panel for stage boundary decisions.
- `FileExplorer`: Tree view with layer icons, provenance tooltips.
- `Editor`: Monaco/CodeMirror with live diff streaming, inline steering comments.
- `LivePreview`: iframe/Docker sandbox with interactive element detection.
- `Terminal`: xterm.js with command interception.
- `TestResults`: Pass/fail list with stack traces.
- `BlueprintGraph`: 3D/2D graph visualization (Three.js or D3).
- `AuditPanel`: Decision Ledger + Audit Trail viewer.

**State Management:**
- `IDEStateStore` (Zustand/Redux): Holds current panel layout, open files, chat history.
- `PipelineStateStore`: Mirrors the backend `PipelineOrchestrator` state via WebSocket.
- `WorkspaceStore`: Tracks file tree, generated files, runtime status.

---

## 7. State Machine Deep Dive

### 7.1 States & Valid Transitions

| State | Description | Valid Next States | Trigger |
| --- | --- | --- | --- |
| `INITIALIZED` | Session created, no input yet | `CLASSIFYING` | Input received |
| `CLASSIFYING` | Richness analysis in progress | `AWAITING_INPUT_SEED`, `STAGE_RUNNING` | Classification complete |
| `AWAITING_INPUT_SEED` | Minimalist input needs clarification | `STAGE_RUNNING` | User provides clarification |
| `STAGE_RUNNING` | Stage executor actively processing | `STREAMING_CHUNKS`, `STAGE_COMPLETED` | LLM call initiated / all stages done |
| `STREAMING_CHUNKS` | Receiving chunked LLM output | `AWAITING_STEERING`, `STAGE_RUNNING` | Chunk complete / user interrupt |
| `AWAITING_STEERING` | Paused at stage boundary for user decision | `STAGE_RUNNING`, `REVISING`, `CHATTING` | User accepts / requests edit / asks question |
| `REVISING` | User requested change to past node | `IMPACT_ANALYZING` | Change submitted to RevisionEngine |
| `IMPACT_ANALYZING` | Computing downstream effects | `AWAITING_PROPAGATION_CONSENT` | ImpactReport generated |
| `AWAITING_PROPAGATION_CONSENT` | Waiting for user to approve propagation | `STAGE_RUNNING`, `AWAITING_STEERING` | User confirms / cancels |
| `CHATTING` | User in chat mode (read-only or what-if) | `AWAITING_STEERING` | Chat session complete |
| `STAGE_COMPLETED` | All 7 stages finished | `FINAL_GATE` | Auto-transition |
| `FINAL_GATE` | Stage 7 completeness validation | `AWAITING_STEERING`, `CODE_GENERATING` | Missing fields / all complete |
| `CODE_GENERATING` | Stage 8 generating files | `RESOLVING_CONFLICT`, `AWAITING_CODE_REVIEW` | Files generated / Merge conflict detected |
| `RESOLVING_CONFLICT` | Merge conflict between user edits and regen | `AWAITING_CODE_REVIEW` | User resolves 3-way merge |
| `AWAITING_CODE_REVIEW` | User reviewing generated files | `CODE_GENERATING`, `RUNNING` | User accepts / requests modification |
| `RUNNING` | Stage 9 runtime active | `AWAITING_RUNTIME_FEEDBACK` | Tests pass / preview ready |
| `AWAITING_RUNTIME_FEEDBACK` | User testing live preview | `AWAITING_DEPLOYMENT_ACTION`, `FINALIZED` | User provides feedback / approves |
| `AWAITING_DEPLOYMENT_ACTION` | User configuring deployment target | `DEPLOYING` | User triggers deployment |
| `DEPLOYING` | Pushing code to target environment | `DEPLOYED` | Deployment success |
| `DEPLOYED` | Final state; live URL shared | `[*]` | User signs off |
| `FINALIZED` | Blueprint ready for export | `[*]` | Session complete |d

### 7.2 Enforcement Mechanisms
- **State Transition Validator:** Every transition is validated by `PipelineOrchestrator.validate_transition(from, to, trigger)`. Invalid transitions raise `InvalidStateTransitionError`.
- **Pause Guarantee:** The system cannot proceed from `AWAITING_STEERING` without an explicit `STEERING_ACTION` or `PROPAGATION_CONSENT` event.
- **No Silent Retry:** If LLM fails, the state machine moves to `AWAITING_STEERING` with error context. It never auto-retries.

### 7.3 Risk-Based Steering Policies (Trust Modes)
To prevent "Steering Fatigue," the pipeline supports configurable `TrustPolicies` that override the blanket pause rule:

| Policy | Behavior | Target User |
|--------|----------|-------------|
| `PARANOID` | Pause at EVERY stage boundary. Default for new users. | Novice |
| `BALANCED` | Auto-approve nodes classified as `LOW_RISK` (e.g., CRUD boilerplate, standard DTOs). Pause only for `MEDIUM` (e.g., new API routes) and `HIGH` (e.g., Auth/Security/Data Models). | Power User |
| `AUTO_PILOT` | Auto-approve `LOW` and `MEDIUM`. Pause only for `CRITICAL` (e.g., RBAC changes, Schema migrations, Payment logic). | Expert / Engineering Lead |

**Enforcement:** The `AccessGuard` logic (Section 8.4) is now dual-purpose:
1. Code generation validation (existing).
2. **Steering Frequency** (new). Nodes without `access_guards` are auto-classified as `LOW_RISK`.

---

## 8. Security Architecture

### 8.1 Authentication & Authorization
- **Multi-Auth Support:** Password, Biometric (fingerprint), Voice (per memory of ProtoBox integration — optional if pipeline is standalone).
- **JWT Tokens:** Short-lived access tokens (15 min) + refresh tokens (7 days).
- **Session Binding:** WebSocket connections authenticated via JWT; session state isolated by `project_id` + `user_id`.

### 8.2 RBAC Model (System-Level)
The pipeline itself enforces RBAC for its own operations:
- `pipeline_admin`: Full CRUD, can force export incomplete blueprints.
- `pipeline_user`: Standard steering, cannot override Stage 7 gate.
- `pipeline_viewer`: Read-only access to blueprints and ledger.
- `system`: Internal service account for checkpoint/audit operations.

### 8.3 Data Protection
- **Compliance Auto-Detection:** GDPR, HIPAA, PCI-DSS, SOC2, ISO27001, CCPA.
- **AuditPolicy:** Conservative defaults (e.g., GDPR → 2555-day retention).
- **Encryption:** At-rest (PostgreSQL/TimescaleDB encrypted volumes) + in-transit (TLS 1.3 for WebSocket/REST).
- **Prompt Sanitization:** All free-text inputs sanitized before LLM injection to prevent prompt injection.

### 8.4 Access Guards (Blueprint-Level)
Every `EngineeringTask` touching `confidential` or `restricted` data must have a non-empty `access_guards` list. This is enforced by:
- `Stage6TaskExecutor` (generation-time validation).
- `Stage7FinalizationExecutor` (completeness gate validation).
- `Stage8CodeGenerationExecutor` (compilation into executable middleware).

### 8.5 Live Preview Isolation [v1.1 NEW]
- The `RuntimeSandbox` shall run in an isolated environment (iframe `sandbox` attribute, Docker container, or VM).
- No access to host file system, host network, or other users' sandboxes.
- User-provided runtime commands are validated against an allowlist before execution.

---

## 9. Deployment & Infrastructure

### 9.1 Recommended Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **API Gateway** | NGINX / AWS ALB | WebSocket + REST routing, TLS termination |
| **Application** | Python (FastAPI/Starlette) + Uvicorn | Async-native, excellent WebSocket support, Pydantic integration |
| **State DB** | PostgreSQL 15+ | ACID compliance, JSONB for flexible schema, mature |
| **Audit DB** | TimescaleDB (PostgreSQL extension) | Time-series optimization, SQL interface |
| **Blob Storage** | MinIO (self-hosted) / S3 | Immutable checkpoints, versioned objects, workspace snapshots |
| **Event Bus** | Redis Streams / RabbitMQ | Low-latency pub/sub for internal events |
| **Cache/Session** | Redis | Sticky session state, DAG cache |
| **Vector Store** (Optional) | pgvector / Weaviate (optional) | RAG for chat context |
| **LLM Provider** | OpenAI GPT-4 / Anthropic Claude | Primary; swappable via `LLMClientInterface` |
| **Container** | Docker + Kubernetes | Orchestration, health checks, rolling updates |
| **Observability** | Prometheus + Grafana + Jaeger | Metrics, dashboards, distributed tracing |
| **IDE Frontend** | React 18 + TypeScript + Vite | Component-based, excellent WebSocket client support | v1.1 ADD |
| **Editor** | Monaco Editor | Syntax highlighting, diff view, inline comments | v1.1 ADD |

### 9.2 Scaling Considerations

| Scenario | Strategy |
|----------|----------|
| **Horizontal Scaling** | Sticky sessions (session affinity) or external Redis-backed session store. Stateless API layer behind load balancer. |
| **LLM Bottleneck** | Async queue for LLM calls; `MockLLMClient` for load testing; circuit breaker pattern for provider failures. |
| **Graph Engine** | In-memory DAG cached in Redis; recompute on node change. Sharding by `project_id` for very large blueprints. |
| **Audit Volume** | TimescaleDB chunking by time; `REFERENCE` mode at budget cap; S3 archival for events >90 days. |
| **Checkpoint I/O** | Async S3 upload; compress snapshots (gzip); store only diffs between frequent checkpoints. |
| **Code Generation** | Async file generation; stream via WebSocket; cache templates in memory. | v1.1 ADD |
| **Runtime Sandboxes** | Container-per-user model; auto-cleanup after session expiry; resource quotas (CPU/memory). | v1.1 ADD |

### 9.3 Health & Monitoring

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| WebSocket Latency (p99) | <100ms | >200ms |
| Impact Analysis Time | <500ms | >1s |
| LLM Response Time (p95) | <5s | >10s |
| Stage Completion Rate | >99% | <95% |
| Checkpoint Creation Time | <2s | >5s |
| Audit Trail Lag | <1s | >5s |
| Code Generation (per file) | <3s | >5s | v1.1 ADD |
| Preview Sandbox Start | <5s | >10s | v1.1 ADD |

---

## 10. Error Handling & Recovery

### 10.1 LLM Failure Recovery
When LLM call fails, the system presents four explicit options via WebSocket:
1. **Retry:** Re-execute the same prompt (with backoff).
2. **Modify:** User edits the prompt or context and retries.
3. **Skip:** Skip this stage (marks as `deferred` in Stage 7).
4. **Restore Checkpoint:** Roll back to last known good checkpoint.

### 10.2 Code Generation Failure Recovery [v1.1 NEW]
When Stage 8 fails:
1. **Retry File:** Regenerate the failed file.
2. **Modify Task:** User edits the `EngineeringTask` and regenerates.
3. **Skip File:** Mark file as `user_deferred`; continue with remaining files.
4. **Restore Checkpoint:** Roll back to pre-Stage 8 checkpoint.

Dependency installation failures:
1. **Retry Install:** Re-run installer.
2. **Modify Version:** User specifies alternative dependency version.
3. **Skip Runtime:** Proceed without Stage 9.
4. **Manual Fix:** User opens terminal and fixes manually.

### 10.3 Session Recovery
- **Automatic:** On uncaught exception, state is persisted to PostgreSQL. User reconnects to same `session_id` → state restored.
- **Manual:** User selects checkpoint from `GET /checkpoint/{project_id}` → `POST /checkpoint/restore/{project_id}`.
- **Corruption Guard:** Checkpoints are immutable (S3 versioning). State DB transactions are ACID.

### 10.4 Data Loss Prevention
- **Write-Ahead Logging:** PostgreSQL WAL + TimescaleDB hypertable replication.
- **S3 Versioning:** All checkpoints versioned; deletion requires explicit IAM action.
- **Audit Immutability:** Audit events append-only; no UPDATE/DELETE permissions on TimescaleDB table.
- **Workspace Snapshots:** Every Stage 8 run creates a new S3 snapshot. User may diff between snapshots. | v1.1 ADD

---

## 11. Implementation Roadmap (Phased)

| Phase | Components | Duration | Exit Criteria |
|-------|------------|----------|---------------|
| **P0: Foundation** | Domain Models (Pydantic), PostgreSQL schema, S3 setup, Event Bus wiring | 2 weeks | All models serialized; DB migrations pass. |
| **P1: State Machine** | `PipelineOrchestrator` with strict transitions; unit tests enforce valid/invalid transitions | 2 weeks | 100% state coverage; `PipelinePausedError` tests pass. |
| **P2: Core Pipeline** | Stage Executors 0-7 + `StreamingChunkManager` + `ContextWindowManager` | 3 weeks | End-to-end sandbox run with `MockLLMClient`; interrupt handling works. |
| **P3: Graph Engine** | `DependencyGraphService` + `HypotheticalSandbox` | 2 weeks | Impact analysis <500ms for 1k nodes; cycle detection tests pass. |
| **P4: Advisors** | ScaleInfra, TechStack, RBAC advisors integrated | 2 weeks | Cost ranges include basis/assumptions/exclusions; RBAC blocks cycles. |
| **P5: Governance** | `CRUDNodeService` + `RevisionEngine` + WebSocket CRUD events | 2 weeks | Edit Actor → ImpactReport → Propagation Consent → Selective rerun works E2E. |
| **P6: Chat & Context** | `ChatOrchestrator` + `ContextAgent` + `IntentParser` | 2 weeks | Natural language "Deactivate X" triggers correct CRUD + impact flow. |
| **P7: Stage 7 & Export** | `Stage7FinalizationExecutor` + JSON export + completeness validation | 1 week | Incomplete blueprint blocked; deferred export requires explicit override. |
| **P8: Audit & Recovery** | `AuditTrailService` + `CheckpointManager` + tiered storage | 2 weeks | 90-day retention enforced; 100MB budget auto-switches to REFERENCE. |
| **P9: Code Generation** | `CodeGenerator` + `WorkspaceManager` + templates | 2 weeks | v1.1 ADD: Blueprint → files; provenance headers; dependency install. |
| **P10: Runtime** | `RuntimeSandbox` + Live Preview + Test Runner | 2 weeks | v1.1 ADD: Preview starts; tests pass; hot reload works. |
| **P11: IDE Frontend** | React IDE shell + panels + Monaco + WebSocket client | 3 weeks | v1.1 ADD: All panels render; chat-first interaction; file provenance. |
| **P12: Hardening** | Load testing, security audit, chaos engineering (LLM failures, DB outages) | 2 weeks | p99 latency <100ms; 99.9% stage completion rate. |

**Total Estimated Duration:** 27 weeks (~6.5 months) with a 5-person team (4 backend + 1 frontend). | v1.1 UPDATED

---

## 12. Technology Decision Records (TDR)

### TDR-001: Modular Monolith over Microservices
**Decision:** Use a Modular Monolith with DDD boundaries.  
**Rationale:** The iterative impact loop requires low-latency communication between Orchestrator, Graph Engine, and Revision Engine. Distributed microservices would introduce network overhead and distributed transaction complexity for a single-user-session pipeline.  
**Consequence:** Horizontal scaling requires sticky sessions or external session store. Team must enforce module boundaries via code review.

### TDR-002: WebSocket over SSE for Steering
**Decision:** Use bidirectional WebSocket instead of Server-Sent Events.  
**Rationale:** The user must send complex events (`NODE_MANIPULATION`, `PROPAGATION_CONSENT`, `INTERRUPT_SIGNAL`, `CODE_FILE_STEER`) that exceed simple HTTP POST semantics. WebSocket provides full-duplex, ordered messaging.  
**Consequence:** Requires connection management, heartbeat/ping, and reconnection logic.

### TDR-003: In-Memory DAG with Redis Backup
**Decision:** Build DAG in application memory, backup to Redis.  
**Rationale:** Impact analysis requires graph traversal in <500ms. Persistent graph DB (Neo4j) adds network hop. In-memory + Redis snapshot provides speed with recovery.  
**Consequence:** Large blueprints (>10k nodes) may require sharding or pagination.

### TDR-004: TimescaleDB over Elasticsearch for Audit
**Decision:** Use TimescaleDB (PostgreSQL extension) for audit events.  
**Rationale:** Unified SQL interface with PostgreSQL; time-series optimizations; no additional infrastructure. Append-only hypertables match audit pattern.  
**Consequence:** Full-text search on audit events is weaker than Elasticsearch; acceptable trade-off.

### TDR-005: Pydantic over Protobuf for Domain Models
**Decision:** Use Pydantic v2 for all domain models and API contracts.  
**Rationale:** Native Python integration, excellent JSON serialization, validation, and OpenAPI generation. Aligns with FastAPI stack.  
**Consequence:** Cross-language clients (e.g., mobile) must consume JSON; no binary protocol benefits.

### TDR-006: React IDE over Native Desktop [v1.1 NEW]
**Decision:** Build the IDE as a web-based React application, not a native desktop app.  
**Rationale:** Cross-platform accessibility, no install friction, easy deployment, excellent WebSocket support, rich ecosystem (Monaco, D3, Three.js). Aligns with ProtoBox web-first strategy.  
**Consequence:** Requires reliable internet connection; offline mode is a future roadmap item.

### TDR-007: Container Sandboxes over VMs for Runtime [v1.1 NEW]
**Decision:** Use Docker containers for `RuntimeSandbox`, not full VMs.  
**Rationale:** Faster startup (<5s vs >30s), lower resource overhead, easier orchestration with Kubernetes. Sufficient isolation for web applications.  
**Consequence:** Less isolation than VMs; requires careful seccomp and capability dropping.

---


### Section 14: Event Contract

```markdown
## 14. Event Contract

### 14.1 Inbound Events

| Event Kind | Source | Payload Type | Key Fields |
|---|---|---|---|
| `USER_INPUT` | Chat / voice | `RawUserInput` | `text: str`, `source: str` |
| `STEERING_ACTION` | SteeringPanel UI | `SteeringAction` | `action_type`, `payload`, `timestamp` |
| `REVISION_REQUEST` | Audit Panel UI | `RevisionRequest` | `original_decision_id: str`, `new_choice: SteeringOption` |
| `PROPAGATION_CONSENT` | Impact Report UI | `PropagationConsent` | `impact_report_id: str`, `user_confirmed: bool` |
| `AUTHORIZATION_GRANT` | SteeringPanel UI | `AuthorizationScope` | `scope_type`, `stage_range`, `granted_at` |
| `MID_STAGE_STEER` | SteeringPanel (mid-stream) | `MidSteerSignal` | `instruction: str`, `action_type: str` |
| `CONTEXT_QUESTION` | Context Window UI | `ContextQuestion` | `question: str`, `context_node_id: str \| None` |
| `SCALE_DIALOGUE_RESPONSE` | Scale Dialogue UI | `ScaleInputs` | All scale fields |
| `HOSTING_SELECTION` | Infrastructure Advisor UI | `HostingOptionSelection` | `option_id: str`, `modified_fields: dict \| None` |
| `TECH_STACK_SELECTION` | Tech Stack Advisor UI | `TechStackSelection` | `option_id: str`, `modified_fields: dict \| None` | v3 ADD |
| `RBAC_STEERING_ACTION` | RBAC Advisor UI | `RBACSteeringAction` | `target: str`, `action_type: str`, `payload: dict` |
| `CHECKPOINT_RESTORE_REQUEST` | Checkpoint UI | `CheckpointRestore` | `checkpoint_id: str` | v3 ADD |
| `BOOKMARK_TOGGLE` | SteeringPanel UI | `BookmarkToggle` | `option_id: str`, `bookmarked: bool` | v3 ADD |
| `CODE_FILE_STEER` | Code Generation Panel | `CodeFileSteer` | `file_path: str`, `action: accept\|reject\|modify`, `instruction: str \| None` | v3.1 ADD |
| `PREVIEW_FEEDBACK` | Live Preview Panel | `PreviewFeedback` | `text: str`, `element_selector: str \| None` | v3.1 ADD |
| `RUNTIME_COMMAND` | IDE Terminal | `RuntimeCommand` | `command: str`, `args: list[str]` | v3.1 ADD |

### 14.2 Outbound Events

| Event Kind | When | Payload Type | Key Fields |
|---|---|---|---|
| `RICHNESS_MODE_DETECTED` | After input classification | `RichnessClassification` | `mode: str`, `confidence: str`, `gaps: list[str]`, `classification_basis: list[str]` | v3 MOD |
| `PRD_ANALYSIS_READY` | WELL_FORMED input analysed | `PRDAnalysisReport` | `explicit_sections`, `thin_sections`, `missing_sections`, `conflicts`, `unmapped_input: list[UnmappedSection]` | v3 MOD |
| `SCALE_DIALOGUE_OPENED` | Scale signal absent | `ScaleDialogue` | `questions: list[ScaleQuestion]` |
| `SCALE_INPUT_CONFLICT` | Scale validation failure | `ScaleInputConflict` | `conflict_description: str`, `affected_fields: list[str]` | v3 ADD |
| `HOSTING_OPTIONS_READY` | Scale inputs captured | `HostingOptionsMatrix` | `options: list[HostingOption]`, `scale_persona: str` |
| `TECH_STACK_OPTIONS_READY` | Tech stack signal absent | `TechStackOptionsMatrix` | `options: list[TechStackOption]` | v3 ADD |
| `STEERING_PANEL_READY` | Stage output draft ready | `SteeringPanel` | `stage`, `draft_output`, `options`, `context_window`, `render_policy: SteeringPanelRenderPolicy` | v3 MOD |
| `DECISION_LOGGED` | Decision committed | `DecisionEntry` | Full entry |
| `DECISION_SUPERSEDED` | Decision revised | `dict` | `old_id`, `new_id`, `revision_chain_entry` |
| `DECISION_REVERTED` | Decision reverted | `dict` | `reverted_to_id`, `new_entry_id` | v3 ADD |
| `IMPACT_REPORT_READY` | Revision impact computed | `ImpactReport` | Full report |
| `PROPAGATION_STARTED` | User confirmed propagation | `dict` | `revision_id`, `affected_stages: list[str]` |
| `PROPAGATION_COMPLETE` | Propagation done | `dict` | `revision_id`, `new_nodes`, `superseded_nodes` |
| `NODE_COMMITTED` | Node user-confirmed | `CommittedNode` | `node_id`, `node_type`, `data`, `provenance` |
| `NODE_PENDING` | Node awaiting user input | `PendingNode` | `node_id`, `pending_reason` |
| `RBAC_MODEL_READY` | RBAC Advisor complete | `RBACModel` | Full model |
| `RBAC_CONFLICT_DETECTED` | Permission conflict found | `PermissionConflict` | `conflict_id`, `roles`, `permission`, `description` |
| `PRIVILEGE_ESCALATION_FLAGGED` | Escalation path detected | `EscalationFlag` | `path: list[str]`, `resulting_access: str`, `algorithm: str`, `depth_limit: int` | v3 MOD |
| `RBAC_INHERITANCE_CYCLE_DETECTED` | Cycle detected | `InheritanceCycle` | `cycle_path: list[str]` | v3 ADD |
| `AUDIT_EVENT_WRITTEN` | Any audit event | `AuditEvent` | Full event |
| `STEERING_REQUIRED` | System cannot proceed | `SteeringRequired` | `stage`, `reason`, `options: list[SteeringOption]` |
| `CHECKPOINT_CREATED` | Stage completed | `Checkpoint` | `checkpoint_id`, `stage`, `label` | v3 ADD |
| `CHECKPOINT_RESTORED` | User restored checkpoint | `Checkpoint` | `checkpoint_id`, `restored_from_state: str` | v3 ADD |
| `REVISION_BUDGET_EXHAUSTED` | Budget exhausted | `RevisionBudget` | `budget_id`, `decision_point`, `exhaustion_action` | v3 ADD |
| `USER_OPTION_INCOHERENT` | Validation failure | `UserOptionIncoherent` | `option_text: str`, `failure_reason: str`, `suggestions: list[str]` | v3 ADD |
| `INFRASTRUCTURE_PROFILE_STALE` | Scale inputs revised | `InfrastructureProfile` | `profile_id`, `stale: true` | v3 ADD |
| `CODE_GENERATION_STARTED` | Stage 8 begins | `CodeGenerationStart` | `manifest_id`, `total_files` | v3.1 ADD |
| `CODE_FILE_STREAM` | File being generated | `CodeFileChunk` | `file_path`, `content_delta`, `layer`, `task_id` | v3.1 ADD |
| `CODE_FILE_COMPLETE` | File generation done | `GeneratedFile` | Full file metadata | v3.1 ADD |
| `CODE_GENERATION_COMPLETE` | Stage 8 done | `WorkspaceManifest` | Full manifest | v3.1 ADD |
| `DEPENDENCY_INSTALL_STATUS` | Install progress | `DependencyInstallStatus` | `status: in_progress\|done\|failed`, `logs: str` | v3.1 ADD |
| `RUNTIME_STARTED` | Stage 9 begins | `RuntimeStart` | `preview_url`, `sandbox_id` | v3.1 ADD |
| `TEST_RESULT_STREAM` | Test running | `TestResult` | `test_name`, `status: pass\|fail`, `duration_ms` | v3.1 ADD |
| `PREVIEW_INTERACTIVE_ELEMENT` | User clicked preview | `InteractiveElement` | `selector`, `component_path`, `story_id` | v3.1 ADD |
| `PIPELINE_COMPLETE` | All stages done, all confirmed | `PipelineCompletion` | `project_id`, `committed_nodes`, `decision_ledger`, `rbac_model`, `infrastructure_profile`, `tech_stack_profile`, `workspace_manifest`, `runtime_report` | v3 MOD |
| `SYSTEM_DESIGN_REQUEST` | After task decomposition | `SystemDesignRequest` | `tech_stack`, `task_decomposition`, `rbac_model`, `infrastructure_profile` |

---
```

### Section 15: Architecture

```markdown
## 15. Architecture

### 15.1 Component Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                       collab_steering_pipeline                          │
│                                                                         │
│  ┌───────────────────────┐   ┌─────────────────────────────────────┐   │
│  │ InputClassifier        │   │ ContextAgent                         │   │
│  │ PRDAnalyzer (Mode A)   │   │ (answers questions about state)      │   │
│  │ MinimalistDialogue (B) │   └─────────────────────────────────────┘   │
│  │ SeedBuilder (Mode C)   │                                             │
│  │ ComplianceDetector     │   ┌─────────────────────────────────────┐   │   v3 ADD
│  └──────────┬────────────┘   │ PromptSanitizationLayer              │   │   v3 ADD
│             │                │ (input sanitization before LLM)     │   │   v3 ADD
│             │                └─────────────────────────────────────┘   │   v3 ADD
│             ▼                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    SteeringOrchestrator                            │  │
│  │  Stage runner · pause/resume · mid-stage intercept · auth scope   │  │
│  │  ChunkedStreamingStrategy · ContextWindowManager                  │  │  v3 ADD
│  └────────────────────────┬─────────────────────────────────────────┘  │
│                           │                                             │
│        ┌──────────────────┼────────────────────┐                       │
│        ▼                  ▼                    ▼                       │
│  ┌───────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │ Stages    │  │ ScalingAdvisor  │  │ RBACAdvisor                  │  │
│  │ 0-6       │  │ InfraAdvisor    │  │ PermissionMatrixBuilder      │  │
│  └─────┬─────┘  └─────────────────┘  │ DataAccessMatrixBuilder      │  │
│        │                             │ PrivilegeEscalationChecker   │  │  v3 ADD
│        │                             └─────────────────────────────┘  │
│        │                                                               │
│        ▼                                                               │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Cross-Cutting Services                                            │  │
│  │  DecisionLedger (append-only) · AuditTrail (append-only)          │  │
│  │  RevisionEngine · ImpactAnalyzer · PropagationRunner               │  │
│  │  PipelineState (persistable/resumable) · CheckpointManager           │  │  v3 ADD
│  │  ContextWindowManager · UserOptionValidator · ScaleInputValidator   │  │  v3 ADD
│  │  TechStackAdvisor · RevisionBudgetManager                          │  │  v3 ADD
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │  v3.1 ADD
│  │  Code Generation & Runtime Layer                                   │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐     │  │
│  │  │ CodeGenerator │  │ WorkspaceMgr │  │ RuntimeSandbox       │     │  │
│  │  │ (Task→File)   │  │ (File I/O)   │  │ (Preview/Test/Run)   │     │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘     │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │  v3.1 ADD
│  │  IDE Frontend Layer (React/3D)                                     │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐     │  │
│  │  │ ChatPanel     │  │ FileExplorer │  │ Editor (Monaco)      │     │  │
│  │  │ SteeringPanel │  │ LivePreview  │  │ Terminal             │     │  │
│  │  │ AuditPanel    │  │ BlueprintGraph│  │ TestResults          │     │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘     │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### 15.2 File Layout

```
plugins/collab_steering_pipeline/
├── plugin.yaml
├── __init__.py
├── agent.py                            # Plugin entry point
├── input_classifier.py                 # Richness mode detection
├── compliance_detector.py              # v3 ADD: GDPR/HIPAA/etc. signal detection
├── prd_analyzer.py                     # Mode A: PRD analysis pass
├── minimalist_dialogue.py              # Mode B: structured question sequence
├── seed_builder.py                     # Mode C: seed construction from minimal input
├── steering_orchestrator.py            # Stage runner + pause/resume + auth scope
├── chunked_streaming.py                # v3 ADD: StreamChunk generation + boundary interrupt
├── context_window_manager.py           # v3 ADD: token estimation + LLMCallStrategy selection
├── context_agent.py                    # Answers pipeline context questions
├── scaling_advisor.py                  # Scale dialogue + HostingOptionsMatrix
├── scale_input_validator.py            # v3 ADD: cross-field consistency checks
├── tech_stack_advisor.py               # v3 ADD: TechStackDialogue + TechStackOptionsMatrix
├── rbac_advisor.py                     # RBAC design flow
├── permission_matrix_builder.py        # Role x Permission matrix
├── data_access_matrix_builder.py       # Role x DataEntity matrix
├── privilege_escalation_checker.py     # v3 ADD: STATIC_ESCALATION_ANALYSIS
├── revision_engine.py                  # Revision request handler
├── revision_budget_manager.py          # v3 ADD: budget tracking + exhaustion handling
├── impact_analyzer.py                  # Downstream impact computation
├── propagation_runner.py               # Re-execution of affected stages
├── checkpoint_manager.py               # v3 ADD: checkpoint creation + restore
├── code_generator.py                   # v3.1 ADD: TaskDecomposition → source files
├── workspace_manager.py                # v3.1 ADD: file I/O, dependency install, manifest
├── runtime_sandbox.py                  # v3.1 ADD: preview, test runner, hot reload
├── decision_ledger.py                  # Append-only decision log
├── audit_trail.py                      # Append-only audit event store
├── pipeline_state.py                   # Full state persistence + resumption
├── model.py                            # All domain models
├── steering_panel.py                   # SteeringPanel construction + events
├── steering_panel_render_policy.py     # v3 ADD: summary/detail mode + pagination
├── user_option_validator.py            # v3 ADD: coherence + contradiction checks
├── authorization_manager.py            # Scope parsing, grant tracking
├── prompt_sanitization_layer.py        # v3 ADD: input sanitization before LLM injection
├── testing_contract.py                 # v3 ADD: MockLLMClient + SandboxMode
├── README.md
├── stages/
│   ├── __init__.py
│   ├── base_stage.py
│   ├── ideation_stage.py
│   ├── actor_stage.py
│   ├── capability_stage.py
│   ├── use_case_stage.py
│   ├── story_stage.py
│   ├── task_stage.py
│   ├── code_generation_stage.py        # v3.1 ADD
│   └── runtime_stage.py                # v3.1 ADD
├── ide/                                  # v3.1 ADD: Frontend components
│   ├── __init__.py
│   ├── chat_panel.py
│   ├── steering_panel_component.py
│   ├── file_explorer.py
│   ├── editor.py
│   ├── live_preview.py
│   ├── terminal.py
│   ├── test_results.py
│   ├── blueprint_graph.py
│   └── audit_panel.py
└── templates/                            # v3.1 ADD: Project scaffolds
    ├── nextjs_prisma/
    ├── fastapi_sqlalchemy/
    ├── react_vite/
    └── django_postgres/
```

---
```

### Section 16: User Stories

```markdown
## 16. User Stories

### 16.1 Product Manager

**US-PM-01:** As a PM, I want to paste a rough idea and immediately see ranked product angles with rationale so I can pick the one that matches my vision rather than accept a default.

**US-PM-02:** As a PM with a fully-formed PRD, I want the system to validate my PRD, surface thin sections, and flag conflicts before running the pipeline — not silently accept everything.

**US-PM-03:** As a PM, I want to review the Decision Ledger after the pipeline completes so I can see what the system decided on my behalf and challenge any of those decisions.

**US-PM-04:** As a PM, I want unmapped sections from my PRD to be routable to specific stages or saved as annotations, not silently discarded. **v3 ADD**

### 16.2 Architect

**US-AR-01:** As an architect, I don't know our expected user scale. I want the system to walk me through a scale dialogue and then present hosting options with realistic cost ranges so I can make an informed decision.

**US-AR-02:** As an architect, I want to revise my tech stack choice at any point, see the full impact on downstream tasks, and confirm propagation only if I accept the impact.

**US-AR-03:** As an architect, I want to review the RBAC permission matrix generated from actors and capabilities, modify any row, and have the system detect privilege escalation paths before I commit the model.

**US-AR-04:** As an architect, I want the system to warn me if my scale inputs are logically inconsistent (e.g., more concurrent users than total users) before generating cost estimates. **v3 ADD**

**US-AR-05:** As an architect, if a stage fails repeatedly, I want to restore to a known good checkpoint rather than abandon the entire session. **v3 ADD**

### 16.3 Engineering Lead

**US-EL-01:** As an engineering lead, I want to see `access_guards` on every task that touches sensitive data so I know exactly what permission checks to implement.

**US-EL-02:** As an engineering lead, I want to grant the system pipeline-level authorization, review the Decision Ledger at the end, and revise only the decisions I disagree with.

**US-EL-03:** As an engineering lead, I want the task decomposition SteeringPanel to load quickly even for large projects, with summary views and paginated detail. **v3 ADD**

### 16.4 Security Engineer

**US-SE-01:** As a security engineer, I want to export the full `RBACModel` as JSON and the full `AuditTrail` as JSON so I can include them in a security review.

**US-SE-02:** As a security engineer, I want privilege escalation paths flagged proactively during RBAC design, not discovered post-implementation.

**US-SE-03:** As a security engineer, I want every permission grant to have a `rationale` and `decision_maker` field so I can audit why each permission was granted.

**US-SE-04:** As a security engineer, I want the audit trail to use diff-based storage with a retention policy so I can manage storage costs without losing auditability. **v3 ADD**

**US-SE-05:** As a security engineer, I want role inheritance cycles to be blocked before commit, not discovered during runtime. **v3 ADD**

### 16.5 Power User

**US-PU-01:** As a power user with a one-sentence idea, I want the system to guide me through structured questions, build a seed, and then run the pipeline collaboratively — not produce garbage from sparse input.

**US-PU-02:** As a power user, I want to export the full Decision Ledger as JSON and version-control it alongside the codebase.

**US-PU-03:** As a power user, I want to bookmark options during steering and compare them side-by-side before committing. **v3 ADD**

**US-PU-04:** As a power user, I want a revision budget so I don't get stuck in infinite loops of tweaking the same decision. **v3 ADD**

### 16.6 Citizen Developer [v3.1 NEW]

**US-CD-01:** As a citizen developer with no coding experience, I want to describe a business process in the chat panel (e.g., "I need a form where employees request time off and managers approve it") and have the system generate a complete working application with login, forms, database, and approval workflow — without me writing any code.

**US-CD-02:** As a citizen developer, I want to see the live preview of my application immediately after generation so I can test it as an end-user and provide feedback in plain language.

**US-CD-03:** As a citizen developer, I want to hover over any generated file and see a plain-language explanation of why it exists (e.g., "This file handles the approval logic because you said managers must approve requests").

### 16.7 Founder / Non-Technical [v3.1 NEW]

**US-FN-01:** As a non-technical founder, I want to describe my SaaS idea in a few sentences and have the system generate a complete MVP — including user authentication, payment integration, admin dashboard, and deployment configuration — so I can validate my idea with real users within hours, not months.

**US-FN-02:** As a founder, I want to say "add Stripe payments" in the chat and have the system generate the payment flow, webhook handlers, and database schema updates — showing me a diff before applying changes.

**US-FN-03:** As a founder, I want the system to explain its tech choices in plain language ("I picked Next.js because it handles both your website and your API in one project, saving hosting costs") rather than forcing me to understand frameworks.

---
```

### Section 17: Acceptance Criteria

```markdown
## 17. Acceptance Criteria

### 17.1 Input Richness

- [ ] **AC-RI-01:** A 500-word PRD with actors, capabilities, and NFRs shall be classified `WELL_FORMED` and produce a `PRDAnalysisReport` before Stage 1.
- [ ] **AC-RI-02:** A 50-word input with a problem statement and one actor shall be classified `MINIMALIST` and open the Minimalist Dialogue before Stage 1.
- [ ] **AC-RI-03:** A single sentence or product name shall be classified `SEED_ONLY` and trigger 3-5 seed questions before Stage 1.
- [ ] **AC-RI-04:** A `WELL_FORMED` input shall not trigger Stage 1 ideation option generation. Instead, it shall validate the stated idea.
- [ ] **AC-RI-05:** Sections present in a `WELL_FORMED` PRD that are not consumed by any pipeline stage shall appear in `unmapped_input` and be surfaced to the user.
- [ ] **AC-RI-06:** The user shall be able to map an unmapped section to an existing stage, create a `CustomAnnotation`, or flag it `out_of_scope`. **v3 ADD**
- [ ] **AC-RI-07:** The `PRDAnalysisReport` shall include `classification_basis` explaining why the mode was assigned. **v3 ADD**
- [ ] **AC-RI-08:** The `InputClassifier` shall detect GDPR, HIPAA, PCI-DSS, SOC2, ISO27001, and CCPA signals and pre-populate `AuditPolicy` defaults. **v3 ADD**
- [ ] **AC-LG-01:** If a user uploads an existing codebase, the system shall generate a `LegacyContextReport` and map existing endpoints to `Capabilities` before suggesting new features.

### 17.2 Scaling and Infrastructure

- [ ] **AC-SC-01:** Absence of any scale signal in the input shall trigger the Scale Dialogue before Stage 1 proceeds.
- [ ] **AC-SC-02:** The `HostingOptionsMatrix` shall contain at least 3 and at most 6 options relevant to the stated scale persona.
- [ ] **AC-SC-03:** Every `HostingOption` shall include `estimated_monthly_cost_usd` as a `CostRange` with `low_usd`, `mid_usd`, `high_usd`, `basis`, `assumptions`, and `excludes`.
- [ ] **AC-SC-04:** An option whose `mid_usd` exceeds the user's stated budget shall be flagged `over_budget`.
- [ ] **AC-SC-05:** Cost estimates shall be visually labelled "indicative only" in the Hosting Options UI.
- [ ] **AC-SC-06:** The selected hosting option shall be committed to `InfrastructureProfile` and recorded in the `DecisionLedger`.
- [ ] **AC-SC-07:** The `ScaleInputValidator` shall detect logically impossible inputs (e.g., concurrent > total users) and surface `SCALE_INPUT_CONFLICT` before matrix generation. **v3 ADD**
- [ ] **AC-SC-08:** Revising `ScaleInputs` after hosting selection shall mark `InfrastructureProfile.stale: true` and emit `INFRASTRUCTURE_PROFILE_STALE`. **v3 ADD**

### 17.3 Tech Stack

- [ ] **AC-TS-01:** Absence of tech stack signal shall trigger the Tech Stack Dialogue after Stage 2. **v3 ADD**
- [ ] **AC-TS-02:** The `TechStackOptionsMatrix` shall contain 3-5 options with `actor_compatibility`, `scale_fit`, `learning_curve`, and `rationale`. **v3 ADD**
- [ ] **AC-TS-03:** The selected tech stack shall be committed to `TechStackProfile` and recorded in the `DecisionLedger`. **v3 ADD**
- [ ] **AC-TS-04:** `TechStackProfile` shall be available as input to Stage 6 task decomposition. **v3 ADD**

### 17.4 RBAC

- [ ] **AC-RB-01:** Every actor confirmed in Stage 2 shall produce at least one `RBACActorHint` that seeds the RBAC Advisor.
- [ ] **AC-RB-02:** Every `RolePermissionEntry` with `granted: true` shall have a non-empty `rationale` and a `decision_maker` field.
- [ ] **AC-RB-03:** A privilege escalation path shall be detected and surfaced as a `PRIVILEGE_ESCALATION_FLAGGED` event before the RBAC model is committed.
- [ ] **AC-RB-04:** Every revision to the RBAC model shall increment `RBACModel.version` and write an `RBAC_MODEL_VERSIONED` audit event.
- [ ] **AC-RB-05:** Every `EngineeringTask` that touches a `confidential` or `restricted` data entity shall have at least one `access_guard` populated from the `RBACModel`.
- [ ] **AC-RB-06:** The `RBACModel` shall be exportable as valid JSON.
- [ ] **AC-RB-07:** Role inheritance depth shall be bounded to 3 by default (configurable to 5). **v3 ADD**
- [ ] **AC-RB-08:** Any inheritance cycle shall be detected and blocked before commit, surfacing `RBAC_INHERITANCE_CYCLE_DETECTED`. **v3 ADD**
- [ ] **AC-RB-09:** Privilege escalation detection shall use `STATIC_ESCALATION_ANALYSIS` with documented depth limit and shall not evaluate dynamic conditions. **v3 ADD**

### 17.5 Audit Trail

- [ ] **AC-AT-01:** Every steering action (Accept, Modify, Replace, Authorize) shall produce an `AuditEvent` written before the action is applied.
- [ ] **AC-AT-02:** Every system-authorized decision shall have an `AuditEvent` with `authorization_ref` pointing to the `DecisionLedger` entry.
- [ ] **AC-AT-03:** Every RBAC permission grant and revocation shall produce an `AuditEvent` with `before_state` and `after_state`.
- [ ] **AC-AT-04:** The `AuditTrail` shall be queryable by `session_id`, `actor.user_id`, `action`, and `timestamp` range.
- [ ] **AC-AT-05:** The `AuditTrail` shall be exportable as JSON and Markdown.
- [ ] **AC-AT-06:** Audit events shall never be modified or deleted. Corrections appear as new events referencing the original.
- [ ] **AC-AT-07:** The audit store shall use tiered storage (`DIFF`, `FULL`, `REFERENCE`) with a default retention of 90 days and a default storage budget of 100MB per session. **v3 ADD**
- [ ] **AC-AT-08:** At 80% storage budget, a warning shall be surfaced. At 100%, the system shall auto-switch to `REFERENCE` strategy. **v3 ADD**

### 17.6 Steering

- [ ] **AC-ST-01:** The pipeline shall not advance from any stage without a user steering action.
- [ ] **AC-ST-02:** A `MID_STAGE_STEER` signal during streaming shall pause at the next `StreamChunk` boundary and open the SteeringPanel with partial output. **v3 MOD**
- [ ] **AC-ST-03:** All five steering actions shall be functional at every stage boundary.
- [ ] **AC-ST-04:** The `SteeringPanel` shall support summary mode (<500ms) and detail mode (<1s) with pagination (20 nodes/page). **v3 ADD**
- [ ] **AC-ST-05:** The user shall be able to bookmark options and view them in comparison mode. **v3 ADD**
- [ ] **AC-ST-06:** User-provided options shall pass `UserOptionValidator` coherence and contradiction checks. **v3 ADD**

### 17.7 No Fallback

- [ ] **AC-NF-01:** No stage shall produce committed output without a user steering action.
- [ ] **AC-NF-02:** An LLM failure shall surface `STEERING_REQUIRED` — never a silent retry or default output.
- [ ] **AC-NF-03:** Sparse/ambiguous input shall trigger clarifying questions, not low-confidence candidates.
- [ ] **AC-NF-04:** No committed node shall contain placeholder text without being explicitly marked `user_pending`.
- [ ] **AC-NF-05:** The system shall create a checkpoint at every stage completion. **v3 ADD**
- [ ] **AC-NF-06:** The user shall be able to restore to any prior checkpoint with full pipeline state recovery. **v3 ADD**
- [ ] **AC-NF-07:** LLM failures shall present `LLMFailureResolution` options: retry same, retry modified, skip with consent, restore checkpoint. **v3 ADD**

### 17.8 Decision Ledger

- [ ] **AC-DL-01:** The user shall be able to revise any `DecisionEntry` and see an `ImpactReport` before propagation.
- [ ] **AC-DL-02:** The revision chain shall be preserved indefinitely.
- [ ] **AC-DL-03:** The user shall be able to revert to a previously superseded decision with a clean `REVERT` action. **v3 ADD**
- [ ] **AC-DL-04:** Each decision point shall have a `RevisionBudget` (default 5). Exhaustion shall surface `RevisionBudgetExhausted`. **v3 ADD**

### 17.9 Code Generation & IDE [v3.1 NEW]

- [ ] **AC-CG-01:** Stage 8 shall generate at least one file per `EngineeringTask` in the IDE workspace, mapped to `file_paths` from Stage 6.
- [ ] **AC-CG-02:** Every generated file shall contain a Provenance Header linking to `task_id`, `story_id`, `decision_entry_id`, and `checkpoint_id`.
- [ ] **AC-CG-03:** The user shall be able to reject, modify, or accept individual files during Stage 8 streaming without blocking the entire stage.
- [ ] **AC-CG-04:** The `RBACModel` shall be compiled into executable auth middleware (e.g., route guards, permission checks) in Stage 8.
- [ ] **AC-CG-05:** The `InfrastructureProfile` shall be compiled into infrastructure-as-code files (Terraform, Docker, CI/CD YAML) in Stage 8.
- [ ] **AC-CG-06:** Dependency installation shall run automatically after Stage 8 and surface errors in the IDE terminal panel.
- [ ] **AC-CG-07:** Stage 9 shall execute `run_command` and render the application in a Live Preview Panel within the IDE.
- [ ] **AC-CG-08:** Stage 9 shall run `test_command` and surface pass/fail results in a Test Results Panel.
- [ ] **AC-CG-09:** Natural language feedback in the Live Preview (e.g., "make the button bigger") shall trigger a Revision Request with Impact Report and Code Diff Preview before application.
- [ ] **AC-CG-10:** The IDE shall support hover-over-file explanations showing the plain-language reason for the file's existence, derived from the Decision Ledger.
- [ ] **AC-CG-11:** A citizen developer with zero coding knowledge shall be able to generate a working CRUD application from a single sentence description within one session.
- [ ] **AC-CG-12:** The IDE layout shall include: Chat Panel, Steering Panel, File Explorer, Editor (Monaco), Live Preview, Terminal, Test Results, Blueprint Graph, and Audit Panel.

---

## 18. Non-Functional Requirements

### 18.1 Performance

| Requirement | Target |
|---|---|
| Input richness classification | < 2 seconds |
| PRD Analysis Pass (WELL_FORMED) | < 8 seconds |
| Minimalist Dialogue (per question) | < 1 second to render |
| Hosting Options Matrix generation | < 10 seconds |
| Tech Stack Options Matrix generation | < 8 seconds | v3 ADD |
| RBAC Advisor (role + permission matrix) | < 12 seconds |
| SteeringPanel render (summary mode) | < 500ms from draft ready | v3 MOD |
| SteeringPanel render (detail mode) | < 1 second per node expansion | v3 ADD |
| Impact Report computation | < 5 seconds |
| Audit event write latency | < 100ms |
| Checkpoint creation | < 2 seconds | v3 ADD |
| Context window token estimation | < 500ms | v3 ADD |
| Code generation (per file) | < 3 seconds | v3.1 ADD |
| Dependency installation | < 60 seconds | v3.1 ADD |
| Live preview hot reload | < 2 seconds | v3.1 ADD |
| IDE panel render (all panels) | < 1 second | v3.1 ADD |

### 18.2 Reliability

**NF-RL-01:** The pipeline shall be resumable across sessions — if the user closes the app, the next session restores the exact SteeringPanel state.

**NF-RL-02:** The `DecisionLedger` and `AuditTrail` are persisted atomically with the pipeline state. A crash does not corrupt either.

**NF-RL-03:** Checkpoints shall be immutable and stored with the same atomicity guarantees as the pipeline state. **v3 ADD**

**NF-RL-04:** The IDE workspace shall be versioned. Every code generation run creates a new workspace snapshot. The user may diff between snapshots. **v3.1 ADD**

### 18.3 Security

**NF-SC-01:** No user input shall be executed as code.

**NF-SC-02:** The `DecisionLedger` and `AuditTrail` are user-scoped and not accessible across projects without explicit sharing.

**NF-SC-03:** Cost estimates are never stored as financial commitments and are clearly labelled as indicative.

**NF-SC-04:** All user-provided free-text shall be sanitized before LLM injection via the `PromptSanitizationLayer`. **v3 ADD**

**NF-SC-05:** Session resume after idle time shall require re-authentication if idle exceeds `session_reauth_idle_minutes` (default 60). **v3 ADD**

**NF-SC-06:** The Live Preview sandbox shall be isolated (iframe sandbox, container, or VM) with no access to the host file system or network except via explicit proxy. **v3.1 ADD**

### 18.4 Session Management [v3 NEW]

**NF-SM-01:** `SessionPolicy` shall define:
- `idle_suspend_minutes`: 30 (pipeline state persisted, resources released, session resumable).
- `idle_expire_days`: 30 (pipeline state archived, further resume requires explicit restore).
- `session_reauth_idle_minutes`: 60 (re-authentication required after this idle period).

**NF-SM-02:** A `SAVE_AND_EXIT` explicit action shall be available at every SteeringPanel.

**NF-SM-03:** The pipeline waits indefinitely for user input within a live session, but does not hold compute resources indefinitely.

### 18.5 Notifications [v3 NEW]

**NF-NT-01:** `NotificationPolicy` shall support:
- In-app toast notification (always on).
- Browser tab title update (e.g., "[Ready] Collaborative Steering Pipeline").
- Optional webhook callback URL (for headless/API usage).

**NF-NT-02:** `STEERING_PANEL_READY` shall be pushed over WebSocket in addition to the existing pull-based event contract.

**NF-NT-03:** `session.notification_channel` shall be configurable as `Literal["websocket", "polling", "webhook"]`.

### 18.6 Testing Contract [v3 NEW]

**NF-TS-01:** The plugin shall be fully testable in sandbox mode without consuming external LLM API tokens.

**NF-TS-02:** A `MockLLMClient` shall be provided with configurable failure modes: `timeout`, `malformed_json`, `empty_response`, `context_overflow`.

**NF-TS-03:** A `SandboxMode` flag on `PipelineState` shall route all LLM calls to `MockLLMClient`.

**NF-TS-04:** A test fixture library with pre-generated stage input/output pairs covering all richness modes shall be provided.

**NF-TS-05:** All failure modes defined in `MockLLMClient` shall have corresponding acceptance criteria test cases.

**NF-TS-06:** Code generation tests shall verify that `WorkspaceManifest` files are written to the correct paths and contain valid Provenance Headers. **v3.1 ADD**

**NF-TS-07:** Runtime tests shall verify that the Live Preview sandbox starts, tests execute, and user feedback triggers the correct revision pipeline. **v3.1 ADD**

---

## 19. Open Questions

1. **Node-level authorization:** Should authorization be grantable at the node level — "handle actor descriptions but ask me about actor types"?
2. **Revision concurrency:** If the user triggers two revisions from different stages simultaneously, how should the system serialize propagation to avoid graph conflicts?
3. **Post-delivery ledger lock:** After the blueprint is handed to `system_design`, should the `DecisionLedger` become read-only?
4. **Multi-user steering:** In a team setting, can two users both steer the pipeline — with conflicts resolved through a vote or role priority system?
5. ~~Cost estimate refresh: If the user revises the scale persona after a hosting option is selected, should the system automatically recompute cost estimates and re-open the Infrastructure Advisor?~~ **CLOSED v3:** The system marks the profile `stale` and surfaces `STEERING_REQUIRED`; re-running is user-initiated, not automatic.
6. ~~RBAC inheritance depth: How many levels of role inheritance should the system support before flagging complexity?~~ **CLOSED v3:** Default 3, configurable to 5. Cycle detection mandatory.
7. ~~Compliance framework detection: Should the system auto-detect applicable compliance frameworks (GDPR, HIPAA) from the input and pre-populate the `AuditPolicy` accordingly?~~ **CLOSED v3:** Yes. Keyword + context detection in `InputClassifier`. Pre-populated defaults user-reviewed before RBAC Advisor runs.
8. **Chunk size tuning:** What is the optimal `StreamChunk` size for each stage? Should it be fixed (e.g., 1 node per chunk) or adaptive based on node complexity? **v3 NEW**
9. **Code generation granularity:** Should the system generate one file per `EngineeringTask`, or batch multiple tasks into a single file? How do we handle file size limits for generated code? **v3.1 NEW**
10. **Live preview isolation:** For server-side rendered applications, should the Live Preview use a local dev server or a remote sandbox? What are the security implications of each? **v3.1 NEW**
11. **Citizen developer guardrails:** How do we prevent non-technical users from generating applications with security vulnerabilities (e.g., SQL injection, XSS) when they cannot review code? Should the system auto-insert security patterns? **v3.1 NEW**

---
## 20. Success Metrics

| Metric | Target | Measurement |
|---|---|---|
| User steering rate (boundary) | 100% | Stages advanced only via explicit user action |
| Decision Ledger coverage | 100% | Committed nodes with DecisionEntry / total committed nodes |
| RBAC model adoption | > 70% | Pipelines that produce a committed RBACModel / total pipelines |
| Privilege escalation catch rate | > 95% | Flagged paths / known escalation paths (regression test suite) |
| Hosting option selection rate | > 85% | Pipelines that commit an InfrastructureProfile / total pipelines |
| Tech stack selection rate | > 85% | Pipelines that commit a TechStackProfile / total pipelines | v3 ADD |
| Cost estimate accuracy | ± 30% of actual first-month bill | Sampled post-deployment comparison |
| Revision usage | > 20% of sessions | Sessions with ≥ 1 revision / total sessions |
| Propagation completeness | > 95% | Nodes that changed / nodes predicted to change | v3 ADD |
| Propagation precision | > 85% | Nodes predicted to change that actually changed / total nodes that changed | v3 ADD |
| Audit Trail completeness | 100% | AuditEvents written / actions performed (regression tested) |
| User satisfaction (collaborative feel) | > 4.2 / 5 | Post-session survey |
| Checkpoint restore usage | > 5% of failed sessions | Sessions with checkpoint restore / sessions with stage failure | v3 ADD |
| Revision budget exhaustion rate | < 10% of decision points | Budgets exhausted / total decision points | v3 ADD |
| Code generation success rate | > 95% | Workspaces with successful Stage 8 / total sessions | v3.1 ADD |
| Live preview uptime | > 99% | Preview sandbox availability during Stage 9 | v3.1 ADD |
| Citizen developer completion rate | > 80% | Non-technical users who reach Stage 9 / total non-technical users | v3.1 ADD |
| File provenance coverage | 100% | Generated files with Provenance Header / total generated files | v3.1 ADD |

---
## 21. Testing Contract

### 21.1 MockLLMClient

```python
class MockLLMClient:
    """Test-only LLM client that simulates responses and failures."""

    failure_mode: Literal["none", "timeout", "malformed_json", "empty_response", "context_overflow"] = "none"
    stage_fixtures: dict[str, StageFixture]  # Pre-generated input/output pairs per stage

    def call(self, prompt: str, stage: str) -> LLMResponse:
        if self.failure_mode == "timeout":
            raise LLMTimeoutError()
        if self.failure_mode == "malformed_json":
            return LLMResponse(text="not valid json", parsed=None)
        if self.failure_mode == "empty_response":
            return LLMResponse(text="", parsed=None)
        if self.failure_mode == "context_overflow":
            raise LLMContextOverflowError(token_count=200000, limit=100000)
        return self.stage_fixtures[stage].expected_output
```

### 21.2 SandboxMode

```python
class PipelineState(BaseModel):
    # ... existing fields ...
    sandbox_mode: bool = False          # When True, all LLM calls route to MockLLMClient
    mock_llm_config: MockLLMConfig | None
```

### 21.3 Test Fixture Library

The test fixture library shall contain pre-generated pairs for:
- All three richness modes (WELL_FORMED, MINIMALIST, SEED_ONLY)
- All six pipeline stages (0-6)
- All advisor modules (Scaling, Tech Stack, RBAC)
- All failure modes (timeout, malformed_json, empty_response, context_overflow)
- Checkpoint restore scenarios
- Revision budget exhaustion scenarios
- **Code generation scenarios (v3.1):** Next.js scaffold, FastAPI scaffold, React+Vite scaffold
- **Runtime scenarios (v3.1):** Successful test run, failing test, preview sandbox start
- **Citizen developer scenarios (v3.1):** Single-sentence CRUD app generation

### 21.4 Acceptance Criteria Test Coverage

| Test Case | Fixture | Failure Mode | AC Covered |
|---|---|---|---|
| Well-formed PRD | `fixture_prd_well_formed.json` | none | AC-RI-01, AC-RI-04 |
| Minimalist input | `fixture_minimalist.json` | none | AC-RI-02 |
| Seed-only input | `fixture_seed_only.json` | none | AC-RI-03 |
| LLM timeout | `fixture_stage_1.json` | timeout | AC-NF-02 |
| LLM malformed JSON | `fixture_stage_2.json` | malformed_json | AC-NF-02 |
| LLM empty response | `fixture_stage_3.json` | empty_response | AC-NF-02 |
| Context overflow | `fixture_large_project.json` | context_overflow | AC-NF-02, AC-NF-06 |
| Checkpoint restore | `fixture_checkpoint.json` | none | AC-NF-05, AC-NF-06 |
| Revision budget exhaustion | `fixture_revision_budget.json` | none | AC-DL-04 |
| RBAC inheritance cycle | `fixture_rbac_cycle.json` | none | AC-RB-08 |
| Scale input conflict | `fixture_scale_conflict.json` | none | AC-SC-07 |
| Tech stack selection | `fixture_tech_stack.json` | none | AC-TS-01–AC-TS-04 |
| Audit storage budget | `fixture_audit_budget.json` | none | AC-AT-07, AC-AT-08 |
| SteeringPanel pagination | `fixture_large_stage_6.json` | none | AC-ST-04 |
| User option incoherent | `fixture_bad_option.json` | none | AC-ST-06 |
| Compliance detection | `fixture_compliance.json` | none | AC-RI-08 |
| Mid-stage chunk interrupt | `fixture_chunked_stream.json` | none | AC-ST-02 |
| Infrastructure staleness | `fixture_stale_infra.json` | none | AC-SC-08 |
| RBAC privilege escalation | `fixture_escalation.json` | none | AC-RB-09 |
| Session suspend/resume | `fixture_session.json` | none | NF-SM-01, NF-RL-01 |
| Notification push | `fixture_notification.json` | none | NF-NT-02 |
| Prompt sanitization | `fixture_injection.json` | none | NF-SC-04 |
| **Code generation — Next.js** | `fixture_codegen_nextjs.json` | none | AC-CG-01, AC-CG-02 | v3.1 ADD |
| **Code generation — RBAC compile** | `fixture_codegen_rbac.json` | none | AC-CG-04 | v3.1 ADD |
| **Code generation — Infra compile** | `fixture_codegen_infra.json` | none | AC-CG-05 | v3.1 ADD |
| **Runtime — preview start** | `fixture_runtime_preview.json` | none | AC-CG-07 | v3.1 ADD |
| **Runtime — test execution** | `fixture_runtime_tests.json` | none | AC-CG-08 | v3.1 ADD |
| **Citizen developer — CRUD** | `fixture_citizen_crud.json` | none | AC-CG-11 | v3.1 ADD |
| **IDE — hover provenance** | `fixture_ide_provenance.json` | none | AC-CG-10 | v3.1 ADD |
| **Code diff preview** | `fixture_code_diff.json` | none | AC-CG-09 | v3.1 ADD |

---
## 22. IDE Interface Specification [v3.1 NEW]

### 22.1 Overview

The Collaborative Steering Pipeline is not a backend service that produces a JSON document. It is the **intelligence engine of an LLM-native IDE**. The user-facing surface is an integrated development environment where the primary interaction modality is **natural language chat**, and the primary output is **runnable code in a live workspace**.

This section defines the IDE layout, interaction patterns, panel behaviors, and the contract between the pipeline backend and the IDE frontend. All backend events defined in Section 14 are consumed by the IDE frontend to render panels, update state, and stream code.

**Key Principle:** The IDE is the **only** user-facing surface. There is no separate "admin panel," "report viewer," or "export tool." The Decision Ledger, Audit Trail, Blueprint Graph, Code Editor, Live Preview, and Chat Panel are all panels within the same IDE window.

### 22.2 IDE Layout & Panels

The IDE shall use a **flexible panel layout** (inspired by VS Code / JetBrains) with the following panels:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Toolbar: [Project Name] [Stage: Actor Discovery] [Save & Exit] [Settings] │
├──────────┬──────────────────────────────────────────────────┬─────────────┤
│          │                                                  │             │
│  Chat    │  Editor / SteeringPanel / Blueprint Graph        │  Live       │
│  Panel   │  (Tabbed, context-aware)                         │  Preview    │
│  (Primary│                                                  │  (Sandbox)  │
│   Input) │                                                  │             │
│          │                                                  │             │
│          │                                                  │             │
├──────────┼──────────────────────────────────────────────────┤             │
│  File    │  Terminal / Test Results / Audit Trail           │             │
│  Explorer│  (Bottom panel, collapsible)                     │             │
│          │                                                  │             │
└──────────┴──────────────────────────────────────────────────┴─────────────┘
```

#### Panel Specifications

| Panel | Purpose | Backend Events Consumed | User Actions Emitted |
|---|---|---|---|
| **Chat Panel** | Primary input modality. Natural language + command palette. | `CHAT_RESPONSE`, `STEERING_PANEL_READY`, `ERROR` | `USER_INPUT`, `CHAT_MESSAGE`, `STEERING_ACTION` |
| **Steering Panel** | Stage boundary review. Accept/Modify/Replace/Authorize. | `STEERING_PANEL_READY`, `IMPACT_REPORT_READY`, `NODE_PENDING` | `STEERING_ACTION`, `REVISION_REQUEST`, `PROPAGATION_CONSENT` |
| **File Explorer** | Workspace file tree. Auto-populated from Stage 8. | `CODE_FILE_GENERATED`, `CODE_FILE_MODIFIED`, `CODE_FILE_REJECTED` | `CODE_FILE_STEER`, `FILE_OPEN_REQUEST` |
| **Editor** | Monaco/CodeMirror with syntax highlighting. Opens files from File Explorer. | `CODE_FILE_STREAM` (for live generation), `NODE_UPDATED` | `EDITOR_CHANGE`, `INLINE_STEER` |
| **Live Preview** | Sandbox rendering of the running application. | `RUNTIME_STARTED`, `PREVIEW_INTERACTIVE_ELEMENT` | `PREVIEW_FEEDBACK`, `PREVIEW_CLICK` |
| **Terminal** | Shell access to the workspace. Dependency install logs, build output. | `DEPENDENCY_INSTALL_STATUS`, `RUNTIME_COMMAND` | `RUNTIME_COMMAND` |
| **Test Results** | Pass/fail list with stack traces. | `TEST_RESULT_STREAM`, `TEST_RUN_COMPLETED` | `TEST_RERUN`, `TEST_DEBUG` |
| **Blueprint Graph** | 3D/2D visualization of the pipeline graph (actors, capabilities, stories). | `NODE_COMMITTED`, `NODE_MODIFIED`, `NODE_PENDING` | `GRAPH_NODE_SELECT`, `GRAPH_NODE_STEER` |
| **Audit Panel** | Decision Ledger + Audit Trail viewer. Searchable, filterable. | `AUDIT_EVENT_WRITTEN`, `DECISION_LOGGED`, `DECISION_SUPERSEDED` | `AUDIT_FILTER`, `REVISION_REQUEST` |

### 22.11 Persona-Based Abstraction Layer
The IDE UI dynamically renders panels based on the user's selected persona (set at login):

- **Citizen Developer / Founder:**
  - Hides the "Audit Panel," "RBAC Matrix," and "Blueprint Graph" entirely.
  - Replaces them with a **"Plain English Decision Summarizer"**. E.g., instead of showing `"RBACModel.version: 2"`, it shows `"Permissions: Managers can see all data. Employees can only see their own. (Click to change)"`.
  - SteeringPanel options are translated into natural language: `[Accept]` becomes `[Looks good!]`; `[Modify]` becomes `[Change this...]`.
  
- **Developer / Architect:**
  - Unlocks all technical panels (Graph, Audit, Raw JSON, RBAC Matrix).
  - SteeringPanel shows exact field diffs and data types.

### 22.3 Chat-First Interaction Patterns

**FR-IDE-01:** The Chat Panel is the **default and primary** input surface. Every session starts with a blank chat panel and a prompt: *"Describe what you want to build..."*

**FR-IDE-02:** The Chat Panel supports three message types:
- **User Intent:** Free-text description of what the user wants (e.g., "I need a SaaS for dentists to manage appointments").
- **User Command:** Structured commands prefixed with `/` (e.g., `/steer`, `/revert`, `/checkpoint`, `/why`).
- **User Feedback:** Replies to system questions or reactions to preview elements (e.g., "The login page looks good but make the button blue").

**FR-IDE-03:** The system shall render **rich chat bubbles** for backend events:
- `STEERING_PANEL_READY` → Collapsible card with options, rationale, and action buttons (Accept, Modify, Replace, Authorize).
- `IMPACT_REPORT_READY` → Diff-style visualization of affected nodes with severity coloring.
- `CODE_FILE_STREAM` → Inline code snippet with syntax highlighting and a "Jump to File" button.
- `TEST_RESULT_STREAM` → Inline pass/fail badge with expandable stack trace.

**FR-IDE-04:** The Chat Panel history is **project memory**. It is searchable, versioned, and linked to the Decision Ledger. The user may ask "Why did you pick PostgreSQL?" and the `ContextAgent` (Section 15.1) shall answer by querying the Decision Ledger and Audit Trail.

**FR-IDE-05:** The Chat Panel shall support **multimodal input** (future roadmap):
- Voice input (leveraging ProtoBox voice capabilities from memory).
- File upload (PRD, image, CSV).
- Screen capture from Live Preview (annotated with feedback).

### 22.4 File Explorer & Provenance

**FR-IDE-06:** The File Explorer shall auto-populate during Stage 8 (Code Generation) as files are streamed from the backend. Files shall appear with icons indicating their layer (`frontend`, `backend`, `database`, `infra`, `auth`, `test`, `devops`, `security`).

**FR-IDE-07:** Hovering over any file in the File Explorer shall display a **Provenance Tooltip**:
- **Why this file exists:** Plain-language explanation derived from the `EngineeringTask` description and linked `UserStory`.
- **Decision chain:** "This file was generated because you approved the 'User Authentication' capability in Stage 3, which produced Story AUTH-001, which decomposed into Task AUTH-BE-001."
- **Decision Ledger link:** Clickable reference to the exact `DecisionEntry`.
- **Audit Trail link:** Clickable reference to the `CODE_FILE_GENERATED` event.

**FR-IDE-08:** Right-clicking a file shall show a context menu:
- **Steer:** "Modify this file..." → opens chat with file context.
- **Why:** "Why does this file exist?" → opens Audit Panel filtered to this file.
- **Diff:** "Show last change" → opens diff viewer.
- **Regenerate:** "Regenerate from task" → triggers Stage 8 for this file only.

### 22.5 Editor & Inline Steering

**FR-IDE-09:** The Editor shall support **inline steering** via comments:
- User types `// @steering: Add input validation` in a file → system parses this as a `MidSteerSignal` targeting the current file.
- User types `// @steering: Use Zod instead of Yup` → system triggers Stage 6 (Task Decomposition) for validation layer + Stage 8 (regenerate file) + diff preview.
- All inline steering comments are stripped from generated code before execution.

**FR-IDE-10:** The Editor shall support **live diff streaming** during Stage 8. As the backend generates a file, the Editor shows the content appearing in real-time with a "Generation in progress..." indicator. The user may click "Pause" to interrupt at the next chunk boundary.

### 22.6 Live Preview & Interactive Steering

**FR-IDE-11:** The Live Preview Panel shall render the application in an isolated sandbox (iframe with `sandbox="allow-scripts allow-same-origin"` for web apps, or Docker container for backend services).

**FR-IDE-12:** The user may interact with the Live Preview as an end-user. Clicking an element shall:
- Highlight the corresponding component in the File Explorer and Editor.
- Show a context menu: "Change this element", "Add validation here", "Make this admin-only".
- Any selection emits `PREVIEW_INTERACTIVE_ELEMENT` to the backend with the element selector and component path.

**FR-IDE-13:** The Live Preview shall support **hot reload**. When Stage 8 regenerates a frontend file, the preview updates without full page refresh (via WebSocket HMR protocol).

### 22.7 Terminal & Runtime

**FR-IDE-14:** The Terminal Panel shall show:
- Dependency installation logs (`npm install`, `pip install`).
- Build output (`npm run build`).
- Runtime logs (dev server stdout/stderr).
- Test execution output.

**FR-IDE-15:** The user may type commands in the Terminal, but the system shall intercept commands that could break the workspace (e.g., `rm -rf`, `git reset --hard`) and require confirmation.

### 22.8 Blueprint Graph Visualization

**FR-IDE-16:** The Blueprint Graph Panel shall render the pipeline state as an interactive 3D or 2D graph:
- Nodes: Actors, Capabilities, Use Cases, Stories, Tasks, Files.
- Edges: Dependencies, traceability links, decision provenance.
- Colors: Layer-based (frontend=blue, backend=green, database=orange, infra=purple, auth=red).
- The user may click any node to see its details, steer it, or see its downstream impact.

**FR-IDE-17:** The Blueprint Graph shall support **what-if mode**: the user may drag a node to a different position (e.g., move a capability from "must_have" to "nice_to_have") and see the simulated impact before committing.

### 22.9 Audit Panel

**FR-IDE-18:** The Audit Panel shall display:
- **Decision Ledger view:** Chronological list of all decisions with status (active, superseded, cancelled). Clickable to initiate revision.
- **Audit Trail view:** Filterable by action type, stage, timestamp. Shows before/after diffs for mutating actions.
- **Search:** "Show me all decisions that affected the auth layer" → filters by `target.target_type` and `metadata.layer`.

### 22.10 Keyboard Shortcuts & Accessibility

**FR-IDE-19:** The IDE shall support keyboard shortcuts for power users:
- `Ctrl/Cmd + Shift + P` → Command palette (steer, revert, checkpoint, etc.).
- `Ctrl/Cmd + B` → Toggle chat panel.
- `Ctrl/Cmd + Shift + E` → Toggle file explorer.
- `Ctrl/Cmd + Shift + R` → Toggle live preview.
- `Ctrl/Cmd + Shift + T` → Toggle terminal.

**FR-IDE-20:** The IDE shall be accessible (WCAG 2.1 AA compliant) with screen reader support for all panels, high-contrast mode, and keyboard-navigable SteeringPanel options.

---


## 23. Glossary

| Term | Definition |
|------|------------|
| **ProjectBlueprint** | The final, self-contained artifact containing all specifications for downstream LLM code generation. |
| **SteeringPanel** | The UI/UX boundary where the system pauses and presents stage outputs for user review. |
| **StreamChunk** | A discrete, logical unit of LLM output (e.g., one Actor, one Task) delivered incrementally. |
| **ImpactReport** | A structured analysis of downstream effects caused by a proposed node change. |
| **PropagationConsent** | Explicit user approval required before the RevisionEngine commits downstream changes. |
| **DeferredArtifact** | A placeholder indicating a field was explicitly skipped by user choice, with mandatory rationale. |
| **DecisionLedger** | An append-only log of every user decision, system recommendation, and authorization. |
| **Checkpoint** | An immutable snapshot of the entire pipeline state at a stage boundary. |
| **AuditTrail** | A time-ordered, append-only record of all system actions and state changes. |
| **ContextWindowManager** | The LLM abstraction layer managing token budgets, compression, and summarization. |
| **WorkspaceManifest** | The generated file inventory with run/test/build commands. | v1.1 ADD |
| **ProvenanceHeader** | Comment block in generated files linking to the Decision Ledger. | v1.1 ADD |
| **RuntimeSandbox** | Isolated environment where generated code runs and is previewed. | v1.1 ADD |

---

## 24. Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-17 | System Architect | Initial consolidated architecture document derived from PRD, Interaction Framework, and Backend Specification. |
| 1.1 | 2026-06-19 | System Architect | Added IDE Frontend Layer, Code Generation & Runtime Module, Stage 8-9 state machine, What/How separation doctrine, and updated implementation roadmap. |
