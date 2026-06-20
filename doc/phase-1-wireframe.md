Here is the merged document, combining the comprehensive journey wireframes with the detailed Stage 3→7 navigation flow and granular screen specifications.

---

# Architect / Power User — Complete Journey Wireframes & Event Contract

**Persona:** Developer / Architect  
**Trust Mode:** BALANCED (auto-approve LOW_RISK; pause MEDIUM/HIGH/CRITICAL)  
**Panel Access:** Full — Chat, Steering, File Explorer, Editor, Live Preview, Terminal, Test Results, Blueprint Graph, Audit Panel, RBAC Matrix, Raw JSON  
**Default Layout:** Left Sidebar 320px, Center flex, Right Sidebar 400px, Bottom Panel 200px

---

## 0. Master Flow Chart

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  ARCHITECT JOURNEY — FULL PIPELINE FLOW                                               │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  [LOGIN] ──► [DASHBOARD] ──► [LANDING] ──► [INPUT PROCESSING] ──► [CLASSIFICATION]    │
│     │           │                │              │                      │                  │
│     │           │                │              │                      │                  │
│     ▼           │                │              │                      ▼                  │
│  REST: login    │                │              │              [PRD ANALYSIS]              │
│  WS: AUTH_      │                │              │                      │                  │
│     SESSION_INIT│                │              │                      │                  │
│                 │                │              │                      ▼                  │
│                 │                │              │              [STAGE 0: SEED]          │
│                 │                │              │                      │                  │
│                 │                │              │                      ▼                  │
│                 │                │              │              [STAGE 1: SCALE DIALOGUE] │
│                 │                │              │              [STAGE 1: HOSTING OPTIONS] │
│                 │                │              │                      │                  │
│                 │                │              │                      ▼                  │
│                 │                │              │              [STAGE 2: ACTOR DISCOVERY] │
│                 │                │              │              [STAGE 2: RBAC ADVISOR]    │
│                 │                │              │                      │                  │
│                 │                │              │                      ▼                  │
│                 │                │              │              [STAGE 3: TECH STACK]      │
│                 │                │              │              [STAGE 3: CAPABILITY DEF]  │
│                 │                │              │                      │                  │
│                 │                │              │                      ▼                  │
│                 │                │              │              [STAGE 4: USE CASE DECOMP]   │
│                 │                │              │                      │                  │
│                 │                │              │                      ▼                  │
│                 │                │              │              [STAGE 5: STORY DECOMP]      │
│                 │                │              │                      │                  │
│                 │                │              │                      ▼                  │
│                 │                │              │              [STAGE 6: TASK DECOMP]    │
│                 │                │              │                      │                  │
│                 │                │              │                      ▼                  │
│                 │                │              │              [STAGE 7: COMPLETENESS GATE] │
│                 │                │              │                      │                  │
│                 │                │              │                      ▼                  │
│                 │                │              │              [STAGE 8: CODE GENERATION] │
│                 │                │              │              [3-WAY MERGE if conflicts] │
│                 │                │              │                      │                  │
│                 │                │              │                      ▼                  │
│                 │                │              │              [STAGE 9: RUNTIME / PREVIEW] │
│                 │                │              │              [STAGE 9: TEST EXECUTION]  │
│                 │                │              │                      │                  │
│                 │                │              │                      ▼                  │
│                 │                │              │              [STAGE 10: DEPLOYMENT]    │
│                 │                │              │                      │                  │
│                 │                │              │                      ▼                  │
│                 │                │              │              [EXPORT / DECISION LEDGER]  │
│                 │                │              │                                         │
│  ◄──────────────┴──────────────┴──────────────┴────────────────────────────────────────►│
│  At ANY point: Command Palette (Cmd+Shift+P), Checkpoint Restore, What-If, Revision/Branch │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Login & Persona Selection

### 1.1 Screen: Login / Persona Selection

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                    ┌──────────────────────────────────────┐                 │
│                    │         [Logo 48px]                    │                 │
│                    │   Collaborative Steering Pipeline    │                 │
│                    │                                      │                 │
│                    │  ┌────────────────────────────────┐   │                 │
│                    │  │ Who's building today?          │   │                 │
│                    │  │ (24px/600 Ink #0F172A)         │   │                 │
│                    │  └────────────────────────────────┘   │                 │
│                    │                                      │                 │
│                    │  ┌────────────────────────────────┐   │                 │
│                    │  │ [🔧] Developer / Architect     │   │                 │
│                    │  │    "I want full control and    │   │                 │
│                    │  │     raw JSON, RBAC matrices,   │   │                 │
│                    │  │     and blueprint graphs."     │   │                 │
│                    │  │    Selected: 2px #2563EB border│   │                 │
│                    │  │    bg: rgba(37,99,235,0.04)    │   │                 │
│                    │  └────────────────────────────────┘   │                 │
│                    │                                      │                 │
│                    │  [👤] Citizen Developer / Founder    │                 │
│                    │  [🛡️] Security Engineer               │                 │
│                    │                                      │                 │
│                    │  Authentication Method               │                 │
│                    │  [Password] [🔐 Fingerprint]         │                 │
│                    │  [🎙️ Voice] [🔑 SSO / GitHub]        │                 │
│                    │                                      │                 │
│                    │  Email: [architect@company.com    ] │                 │
│                    │  Password: [••••••••••••••         ] │                 │
│                    │                                      │                 │
│                    │  Trust Mode Default: [BALANCED ●]  │                 │
│                    │  (Auto-approve LOW; pause MED/HIGH)  │                 │
│                    │                                      │                 │
│                    │  [Continue]                          │                 │
│                    │  Primary, #2563EB, 44px height       │                 │
│                    │                                      │                 │
│                    └──────────────────────────────────────┘                 │
│                    480px wide, centered, z:1000                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Intra-Screen Interactions:**
| Element | Trigger | Action | Visual Feedback |
|---------|---------|--------|-----------------|
| Persona Card | Click | Selects Architect | 2px #2563EB border, tint bg |
| Auth Method | Click | Activates method | Underline + highlight |
| Continue | Click | Validates + redirects | Spinner, then dashboard |
| Trust Mode | Hover | Tooltip: "Auto-approves boilerplate" | 280px tooltip |

**Inter-Screen Navigation:**
| From | Action | To | Condition |
|------|--------|-----|-----------|
| Login | Valid auth + Architect persona | Project Dashboard | `pipeline_user` role |
| Login | First-time user | Onboarding Landing | No existing projects |

**API Calls (REST):**
| Method | Path | Request DTO | Response DTO |
|--------|------|-------------|--------------|
| `POST` | `/api/v1/auth/login` | `LoginRequest` { email, password, persona: "architect", trust_mode_default: "BALANCED" } | `LoginResponse` { access_token, refresh_token, user, session_id } |
| `GET` | `/api/v1/auth/me` | — | `UserProfile` { user_id, persona, permissions } |

**WebSocket Events:**
| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| C→S | `AUTH_SESSION_INIT` | `{ session_id, token }` | Authenticate WebSocket |
| S→C | `AUTH_SESSION_OK` | `{ user: UserProfile }` | Auth confirmed |
| S→C | `AUTH_SESSION_EXPIRED` | `{ reason }` | Force re-auth |

---

## 2. Project Dashboard

### 2.1 Screen: Project Dashboard

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Logo]  Architect Dashboard                    [New Project] [🔔] [👤]      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Recent Projects                                                            │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ Dental SaaS MVP                              Stage 6: Task Decomp    │   │
│  │ Last active: 2 hours ago              [🟡] 67% complete, 2 errors   │   │
│  │ Checkpoints: 6  │  Revisions: 3  │  Budget: 2/5 remaining             │   │
│  │ [Resume Session] [Export Ledger] [View Audit] [Archive]              │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ E-Commerce Platform                          Stage 3: Capability Def │   │
│  │ Last active: 1 day ago                  [🟡] 45% complete            │   │
│  │ [Resume Session] [Export Ledger] [View Audit] [Archive]              │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Quick Start                                                                │
│  [🆕 New Project]  [📄 Upload PRD]  [📦 Import Legacy]  [🔁 Clone]          │
│                                                                             │
│  Checkpoint Recovery                                                        │
│  Dental SaaS MVP — 6 checkpoints available  [View Timeline]              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Intra-Screen Interactions:**
| Element | Trigger | Action | Visual Feedback |
|---------|---------|--------|-----------------|
| Project Card | Hover | Shadow lift, border color | 150ms |
| Resume | Click | Restores full IDE state | Loading overlay |
| New Project | Click | Opens Landing screen | Navigate |
| Upload PRD | Click | File picker, then Input Processing | Upload progress |

**API Calls (REST):**
| Method | Path | Request DTO | Response DTO |
|--------|------|-------------|--------------|
| `GET` | `/api/v1/projects` | `ProjectListQuery` { status, sort_by, limit } | `ProjectList` { total, projects[] } |
| `POST` | `/api/v1/projects` | `CreateProjectRequest` { project_name, description, persona: "architect" } | `Project` { project_id, state } |
| `POST` | `/api/v1/projects/{project_id}/resume` | — | `SessionState` |

**WebSocket Events:**
| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| S→C | `PIPELINE_STATE_CHANGED` | `PipelineState` | Full state on resume |

---

## 3. Landing / Empty State

### 3.1 Screen: Empty State (Architect)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Logo]  Collaborative Steering Pipeline        [Chat] [👤] [BALANCED]     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                    ┌──────────────────────────────────────┐                 │
│                    │  Describe what you want to build...  │                 │
│                    │  (28px/600 Ink #0F172A)               │                 │
│                    │                                      │                 │
│                    │  Paste a PRD, type an idea, upload   │                 │
│                    │  a file, or paste a Git URL.        │                 │
│                    │  (14px/400 Slate #475569)            │                 │
│                    │                                      │                 │
│                    │  [Textarea: min-h 120px, max-h 400px]│                 │
│                    │  focus: #2563EB border + glow        │                 │
│                    │                                      │                 │
│                    │  ─────── or upload a file ───────    │                 │
│                    │                                      │                 │
│                    │  [📄 Upload PRD] [📦 Upload ZIP]     │                 │
│                    │  [🔗 Git URL]      [🖼️ Add Image]    │                 │
│                    │                                      │                 │
│                    │  Or start with a template:           │                 │
│                    │  [SaaS] [API] [Mobile Backend]        │                 │
│                    │                                      │                 │
│                    │  ─────────────────────────────────   │                 │
│                    │  [📄 Drag & drop PRD here]            │                 │
│                    │  .md, .txt, .pdf accepted            │                 │
│                    └──────────────────────────────────────┘                 │
│                                                                             │
│  Trust Mode: [BALANCED ●] (Auto-approve LOW; pause MED/HIGH)               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Intra-Screen Interactions:**
| Element | Trigger | Action | Visual Feedback |
|---------|---------|--------|-----------------|
| Textarea | Focus | Border→#2563EB, box-shadow | 150ms |
| Upload PRD | Click | Native file picker | Chip highlight |
| Git URL | Click | Expands to 320px input + Connect | 250ms expand |
| Template | Click | Populates + auto-submits | 600ms delay |

**Inter-Screen Navigation:**
| From | Action | To | Trigger |
|------|--------|-----|---------|
| Landing | Submit text/file/Git | Input Processing | `USER_INPUT` |

**API Calls (REST):**
| Method | Path | Request DTO | Response DTO |
|--------|------|-------------|--------------|
| `POST` | `/api/v1/projects/{project_id}/input` | `RawUserInput` { text, source: "text", trust_mode: "BALANCED" } | `InputAccepted` { input_id, status } |
| `POST` | `/api/v1/projects/{project_id}/upload` | `MultipartFile` | `FileUploadResult` { file_id, classification_hint } |
| `POST` | `/api/v1/projects/{project_id}/git-connect` | `GitConnectRequest` { url, branch } | `GitConnectResult` { legacy_report } |

**WebSocket Events:**
| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| C→S | `USER_INPUT` | `RawUserInput` | Submit initial input |
| S→C | `INPUT_PROCESSING_STARTED` | `{ input_id, steps }` | Show progress |
| S→C | `PROCESSING_STEP_COMPLETE` | `{ step_index, progress_percent }` | Update bar |
| S→C | `RICHNESS_MODE_DETECTED` | `RichnessClassification` | Classification result |

**SSE Stream:**
```
GET /api/v1/projects/{project_id}/input/{input_id}/progress
event: step → { step_index, name, status, progress }
event: classification → { mode, confidence, gaps }
```

---

## 4. Input Processing & Classification

### 4.1 Screen: Input Processing → Richness Classification

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Logo]  Collaborative Steering Pipeline        [Chat] [👤] [BALANCED]     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                    ┌──────────────────────────────┐                         │
│                    │         (+) spinner          │                         │
│                    │   Analyzing your input...    │                         │
│                    │   [████████████░░░░]  65%    │                         │
│                    │                              │                         │
│                    │ ● Receiving input            │                         │
│                    │ ● Scanning compliance...     │                         │
│                    │ ○ Classifying richness   ●   │ ← active pulse        │
│                    │ ○ Analyzing PRD structure    │                         │
│                    │ ○ Preparing next steps       │                         │
│                    └──────────────────────────────┘                         │
│                                                                             │
│  ─── After classification ───                                               │
│                                                                             │
│                    ┌──────────────────────────────┐                         │
│                    │  [🟢] Well-Formed PRD        │                         │
│                    │      Detected        94%       │                         │
│                    │                              │                         │
│                    │  Why this classification?  ▼ │                         │
│                    │    • 4 actors found          │                         │
│                    │    • Capabilities described  │                         │
│                    │    • NFRs present            │                         │
│                    │    • Tech stack signals:     │                         │
│                    │      "Next.js", "PostgreSQL" │                         │
│                    │                              │                         │
│                    │  [Review PRD Analysis →]     │                         │
│                    │  Primary, #2563EB            │                         │
│                    └──────────────────────────────┘                         │
│                                                                             │
│  Compliance Banner (if detected):                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  🔔 Compliance: GDPR, SOC2 detected  [Review Defaults ▼] [Dismiss] │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**API Calls (REST):**
| Method | Path | Request DTO | Response DTO |
|--------|------|-------------|--------------|
| `POST` | `/api/v1/projects/{project_id}/classification/override` | `ClassificationOverride` (if user overrides) | `ClassificationResult` |

**WebSocket Events:**
| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| S→C | `RICHNESS_MODE_DETECTED` | `RichnessClassification` { mode, confidence, gaps, classification_basis } | Routing decision |
| S→C | `PRD_ANALYSIS_READY` | `PRDAnalysisReport` | Full analysis |
| S→C | `COMPLIANCE_DETECTED` | `ComplianceDetectionResult` | Framework chips |

---

## 5. PRD Analysis Report

### 5.1 Screen: PRD Analysis (Architect View)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Logo]  PRD Analysis Report                    [Chat] [👤] [BALANCED]       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PRD Analysis: dental-saas-prd.md                                [Export]  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ▼ Explicit Sections (4)                              [🟢]             │   │
│  │   • Actors and Roles ........................ → Stage 2               │   │
│  │   • API Requirements ........................ → Stage 3               │   │
│  │   • Non-Functional Requirements .............. → Stage 5             │   │
│  │   • Data Model ............................... → Stage 6             │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ ▼ Thin Sections (2)                                  [🟡]             │   │
│  │   • Security Requirements  [Needs detail] [Add detail → Chat]       │   │
│  │   • Deployment Strategy  [Needs detail] [Generate]                  │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ ▼ Missing Sections (1)                               [🔴]             │   │
│  │   • Error Handling Strategy  [Generate] → Minimalist for this only  │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ ▼ Unmapped Sections (2)                              [🔵]             │   │
│  │   • Marketing Requirements  [Map to Stage ▼] [Save as Annotation] [Out of Scope]│
│  │   • Third-Party Integrations [Map to Stage ▼] [Save as Annotation] [Out of Scope]│
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Raw JSON View (Architect only):                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ { "explicit_sections": [...], "unmapped_input": [                   │   │
│  │   { "section_name": "Marketing", "confidence": 0.82,               │   │
│  │     "suggested_action": "custom_annotation" } ] }                   │   │
│  │ [📋 Copy JSON]                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  [← Back]          [Proceed to Stage 1: Actor Discovery →]                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Intra-Screen Interactions:**
| Element | Trigger | Action | Visual Feedback |
|---------|---------|--------|-----------------|
| Section Header | Click | Expand/collapse | 150ms rotate |
| "Add detail" | Click | Chat opens pre-seeded | Slide-in |
| "Map to Stage" | Click | Dropdown Stage 0-9 | 8px dropdown |
| "Save as Annotation" | Click | Creates `CustomAnnotation` | Toast confirmation |
| Raw JSON | Click Copy | Copies to clipboard | CheckCircle 1.5s |

**API Calls (REST):**
| Method | Path | Request DTO | Response DTO |
|--------|------|-------------|--------------|
| `GET` | `/api/v1/projects/{project_id}/state` | — | `PipelineState` |

**WebSocket Events:**
| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| S→C | `PRD_ANALYSIS_READY` | `PRDAnalysisReport` | Full report |
| C→S | `NODE_MANIPULATION` | `{ action: "add", node_type: "custom_annotation", data }` | Save unmapped as annotation |

---

## 6. Stage 0: Seed Validation & Stage 1: Scale / Infrastructure

### 6.1 Screen: Scale Dialogue

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Logo]  Stage 1: Scale & Infrastructure          [Chat] [👤] [BALANCED]     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                    ┌──────────────────────────────┐                         │
│                    │      Define Your Scale         │                         │
│                    ├──────────────────────────────┤                         │
│                    │ Expected total users *         │                         │
│                    │ [ 10,000                   ]   │                         │
│                    │                                │                         │
│                    │ Peak concurrent users *        │                         │
│                    │ [ 500                      ]   │                         │
│                    │  [🔴] Peak concurrent cannot │                         │
│                    │       exceed total users       │                         │
│                    │                                │                         │
│                    │ Monthly budget (USD)           │                         │
│                    │ [ $500                     ]   │                         │
│                    │ [✓] No limit                 │                         │
│                    │                                │                         │
│                    │ Launch timeline *              │                         │
│                    │ [ 3 months            ] [▼]   │                         │
│                    │                                │                         │
│                    │ [ Cancel ] [Generate Options]  │                         │
│                    │ Generate: disabled if invalid  │                         │
│                    └──────────────────────────────┘                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**API Calls (REST):**
| Method | Path | Request DTO | Response DTO |
|--------|------|-------------|--------------|
| `POST` | `/api/v1/projects/{project_id}/scale` | `ScaleInputs` { expected_total_users, peak_concurrent_users, monthly_budget_usd, launch_timeline } | `ScaleValidationResult` { valid, conflicts } |
| `GET` | `/api/v1/projects/{project_id}/scale/options` | `ScaleInputs` | `HostingOptionsMatrix` { scale_persona, options[] } |

**WebSocket Events:**
| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| S→C | `SCALE_INPUT_CONFLICT` | `ScaleInputConflict` | Real-time validation |
| S→C | `HOSTING_OPTIONS_READY` | `HostingOptionsMatrix` | Options generated |
| S→C | `INFRASTRUCTURE_PROFILE_STALE` | `{ profile_id, stale: true }` | Inputs changed |

---

### 6.2 Screen: Hosting Options Matrix

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Hosting Options Matrix                    [Back] [Compare] [Confirm]        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Scale Persona: MEDIUM (1,000–10,000 users, 500 concurrent, $500/mo)       │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ Option A: AWS ECS + RDS (Recommended)                                │   │
│  │ [🟢] Best fit for MEDIUM persona                                     │   │
│  │ Architecture: Containerized microservices on AWS ECS                │   │
│  │ Database: PostgreSQL on RDS Multi-AZ                                │   │
│  │ Cache: ElastiCache Redis                                            │   │
│  │                                                                        │   │
│  │ Cost: Low: $420 | Mid: $580 | High: $840                              │   │
│  │ Basis: on-demand pricing, US-East-1                                  │   │
│  │ Assumptions: 500 concurrent, 2 vCPU per container, 4GB RAM             │   │
│  │ Excludes: Data transfer out, DDoS protection                          │   │
│  │                                                                        │   │
│  │ [🟢] Within budget | [🟢] Auto-scaling                               │   │
│  │ [Select] [Bookmark ☆] [Modify Parameters] [View Raw JSON]              │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ Option B: Vercel + Neon (Serverless)    [🟡 Over budget: $620 mid]    │   │
│  │ Cost: Low: $300 | Mid: $620 | High: $1,200                            │   │
│  │ [🔴] Mid exceeds stated budget by $120                                │   │
│  │ [Select Anyway] [Bookmark ☆] [View Raw JSON]                           │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Comparison: [Option A ▼] vs [Option B ▼] → Side-by-side diff              │
│                                                                             │
│  Architect Note: "I recommend AWS ECS because your scale persona         │
│  requires persistent connections (WebSockets for real-time booking)        │
│  that serverless platforms handle poorly at your price point."            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**API Calls (REST):**
| Method | Path | Request DTO | Response DTO |
|--------|------|-------------|--------------|
| `POST` | `/api/v1/projects/{project_id}/infrastructure/select` | `HostingSelection` { option_id, modified_fields } | `InfrastructureProfile` |
| `GET` | `/api/v1/projects/{project_id}/infrastructure` | — | `InfrastructureProfile` |

**WebSocket Events:**
| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| C→S | `HOSTING_SELECTION` | `HostingSelection` | Select hosting |
| S→C | `INFRASTRUCTURE_PROFILE_STALE` | `{ profile_id, stale: true }` | Scale inputs revised |

---

## 7. Stage 2: Actor Discovery & RBAC Advisor

### 7.1 Screen: Actor Discovery Steering Panel

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [<] Stage 2: Actor Discovery              [x] [?] [Raw JSON] [BALANCED]  │
│ Define who uses your application                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ [Summary | Detail]    Trust: BALANCED (2 auto-approved, 1 paused)           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ◻ Patient                   [LOW] [✓] (auto-approved)                    │
│   Primary end-user, books appointments, views history                        │
│   12 downstream nodes                                                       │
│                                                                             │
│ ◻ Dentist                   [LOW] [✓] (auto-approved)                      │
│   Healthcare provider, manages schedule, views patient records           │
│   8 downstream nodes                                                        │
│                                                                             │
│ ◻ Receptionist              [MEDIUM] [⚠] [★]                             │
│   Staff member, manages bookings on behalf of patients                     │
│   6 downstream nodes                                                        │
│                                                                             │
│ ◻ InsuranceVerifier         [HIGH] [▲] [★] (new)                         │
│   External system actor, verifies coverage before booking                  │
│   4 downstream nodes, touches confidential data                            │
│   [ ] I consent to adding this external dependency                         │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ Why these outputs? Based on your PRD Section "Actors and Roles" plus        │
│ inferred roles from capability descriptions. [Tell me more →]               │
├─────────────────────────────────────────────────────────────────────────────┤
│ [Approve All] [Review Selected] [★ Bookmark] [View Impact Graph]            │
│                                                                             │
│ Approve All: disabled until HIGH consent checkbox checked                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

**API Calls (REST):**
| Method | Path | Request DTO | Response DTO |
|--------|------|-------------|--------------|
| `GET` | `/api/v1/projects/{project_id}/steering/2` | — | `SteeringPanel` { stage_id, draft_output, options, trust_mode } |
| `POST` | `/api/v1/projects/{project_id}/steering` | `SteeringAction` { action_type: "accept", stage_id: 2, payload } | `SteeringResult` |

**WebSocket Events:**
| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| S→C | `STEERING_PANEL_READY` | `SteeringPanel` | Stage boundary |
| C→S | `STEERING_ACTION` | `SteeringAction` | User decision |
| C→S | `BOOKMARK_TOGGLE` | `BookmarkToggle` | Bookmark option |
| S→C | `NODE_COMMITTED` | `CommittedNode` | Actor confirmed |
| S→C | `NODE_PENDING` | `{ node_id, pending_reason }` | Awaiting input |

---

### 7.2 Screen: RBAC Matrix Editor

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ RBAC Matrix Editor — v2                    [Export JSON] [Validate] [Commit]│
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Role Inheritance Graph                                                    │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │  Admin ──▶ Manager ──▶ Employee ──▶ Guest                            │   │
│  │     │         │           │                                            │   │
│  │     └─────────┴───────────┘                                            │   │
│  │  Depth: 3 (limit: 3)  [🟢 No cycles detected]                          │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Permission Matrix                                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ Role        │ Resource        │ Action │ Granted │ Rationale           │ Decision Maker│
│  │ ───────────────────────────────────────────────────────────────────────│   │
│  │ patient     │ /api/appts      │ GET    │ ✓       │ Own data only       │ system        │
│  │ patient     │ /api/appts      │ POST   │ ✓       │ Book for self       │ system        │
│  │ dentist     │ /api/appts      │ GET    │ ✓       │ All patients        │ architect     │
│  │ dentist     │ /api/salaries   │ GET    │ ✓       │ Full access         │ admin         │
│  │ admin       │ /api/salaries   │ GET    │ ✓       │ Full access         │ admin         │
│  │             │                 │        │         │                     │               │
│  │ [🔴 PRIVILEGE ESCALATION DETECTED]                                     │   │
│  │ Admin→Manager→Employee→/api/salaries (transitive chain, depth 3)     │   │
│  │ [View Path] [Remove Inheritance] [Add Guard]                           │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Data Access Matrix                                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ Role          │ Entity    │ Access   │ Rationale        │ Guard        │   │
│  │ ───────────────────────────────────────────────────────────────────────│   │
│  │ patient       │ User      │ Own      │ GDPR req       │ user_id match│   │
│  │ dentist       │ Appt      │ All      │ Provider role  │ practice_id  │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Validation: [🔴] 1 escalation, [🟢] 12 valid, [🟢] 0 cycles               │
│  Commit blocked until escalation resolved.                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**API Calls (REST):**
| Method | Path | Request DTO | Response DTO |
|--------|------|-------------|--------------|
| `GET` | `/api/v1/projects/{project_id}/rbac` | — | `RBACModel` { version, roles, permissions, role_permissions, inheritance_graph } |
| `POST` | `/api/v1/projects/{project_id}/rbac` | `RBACModelUpdate` { version, changes[] } | `RBACModel` |
| `POST` | `/api/v1/projects/{project_id}/rbac/validate` | — | `RBACValidationResult` { valid, inheritance_cycles, privilege_escalations } |
| `POST` | `/api/v1/projects/{project_id}/rbac/commit` | `RBACCommitRequest` { force, rationale } | `RBACCommitResult` { committed_version, audit_event_id } |

**WebSocket Events:**
| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| S→C | `RBAC_MODEL_READY` | `RBACModel` | Model generated |
| S→C | `RBAC_CONFLICT_DETECTED` | `PermissionConflict` | Conflict found |
| S→C | `PRIVILEGE_ESCALATION_FLAGGED` | `EscalationPath` { path, resulting_access, depth, algorithm } | Escalation detected |
| S→C | `RBAC_INHERITANCE_CYCLE_DETECTED` | `{ cycle_path }` | Cycle blocked |
| C→S | `RBAC_STEERING_ACTION` | `{ target, action_type, payload }` | RBAC edit |

---

## 8. Stage 3: Tech Stack & Capability Definition

### 8.1 Screen: Tech Stack Options

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Tech Stack Options                        [Back] [Bookmark] [Confirm]      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Detected Signals: "real-time", "SaaS", "rapid MVP", "React knowledge"       │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ Option A: Next.js 14 + Prisma + PostgreSQL (Recommended)             │   │
│  │ [🟢] Actor compatibility: 95% | Scale fit: MEDIUM→LARGE                │   │
│  │ [🟢] Learning curve: Moderate (React assumed)                          │   │
│  │                                                                      │   │
│  │ Rationale: Full-stack framework reduces API boilerplate.            │   │
│  │ Prisma provides type-safe DB access. PostgreSQL handles complex      │   │
│  │ queries and JSON fields for flexible schemas.                         │   │
│  │                                                                      │   │
│  │ Components:                                                           │   │
│  │ Frontend: Next.js 14 (App Router)    Backend: API Routes + Actions  │   │
│  │ Database: PostgreSQL 15 + Prisma ORM   Cache: Redis (Upstash)        │   │
│  │ Auth: NextAuth.js + JWT                Hosting: Vercel + Railway       │   │
│  │                                                                      │   │
│  │ [Select] [Bookmark ☆] [Customize] [View Raw JSON]                    │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ Option B: FastAPI + React + PostgreSQL                                 │   │
│  │ [🟡] Higher learning curve (Python + React split)                      │   │
│  │ [🟢] Better for ML/data-heavy features                                │   │
│  │ [Select] [Bookmark ☆] [View Raw JSON]                                │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  [Compare Options] → Bookmark Comparison Drawer                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**API Calls (REST):**
| Method | Path | Request DTO | Response DTO |
|--------|------|-------------|--------------|
| `POST` | `/api/v1/projects/{project_id}/tech-stack/select` | `TechStackSelection` { option_id, modified_fields } | `TechStackProfile` |
| `GET` | `/api/v1/projects/{project_id}/tech-stack` | — | `TechStackProfile` |

**WebSocket Events:**
| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| C→S | `TECH_STACK_SELECTION` | `TechStackSelection` | Select stack |
| S→C | `TECH_STACK_OPTIONS_READY` | `TechStackOptionsMatrix` | Options generated |

---

### 8.2 Screen: Capability Definition Steering Panel

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [<] Stage 3: Capability Definition        [x] [?] [Raw JSON] [BALANCED]  │
│ Define what your application can do                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ [Summary | Detail]    Trust: BALANCED (5 auto-approved, 2 paused, 1 CRITICAL)│
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ◻ User Authentication       [LOW] [✓] (auto)                               │
│   Auth layer, 3 downstream files                                            │
│                                                                             │
│ ◻ Appointment Booking       [LOW] [✓] (auto)                               │
│   Standard CRUD, boilerplate                                               │
│                                                                             │
│ ◻ Payment Processing        [CRITICAL] [▲] [★]                             │
│   Security layer, 7 downstream files, touches confidential data            │
│   Access guards required: [ ] I consent to this implementation            │
│   Risk: PCI-DSS scope expansion if not tokenized                           │
│                                                                             │
│ ◻ Insurance Verification  [MEDIUM] [⚠] [☆]                               │
│   Auth layer, 2 downstream files, external API dependency                  │
│                                                                             │
│ ◻ Analytics Dashboard       [LOW] [✓] (auto)                               │
│   Frontend layer, 4 downstream files, read-only aggregations             │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ Why these outputs? Based on your PRD capabilities plus inferred from          │
│ actor goals. [Tell me more →]                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│ [Approve All] [Review Selected] [★ Bookmark] [View Impact Graph]              │
│                                                                             │
│ Bookmarked (2): [Payment Processing] [Insurance Verification]              │
│ [Open Comparison Drawer]                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

**API Calls (REST):**
| Method | Path | Request DTO | Response DTO |
|--------|------|-------------|--------------|
| `GET` | `/api/v1/projects/{project_id}/steering/3` | — | `SteeringPanel` |
| `POST` | `/api/v1/projects/{project_id}/steering` | `SteeringAction` | `SteeringResult` |

**WebSocket Events:**
| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| S→C | `STEERING_PANEL_READY` | `SteeringPanel` | Stage 3 boundary |
| C→S | `STEERING_ACTION` | `SteeringAction` | Accept/Modify/Replace |
| C→S | `BOOKMARK_TOGGLE` | `BookmarkToggle` | Bookmark for comparison |
| S→C | `IMPACT_REPORT_READY` | `ImpactReport` | If revision requested |

---

## 9. Navigation Flow: Stage 3 → 4 → 5 → 6 → 7

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  STAGE 3 → 4 → 5 → 6 → 7  ARCHITECT NAVIGATION FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  [STAGE 3 STEERING: Capability Definition]                                              │
│     │                                                                                   │
│     │ Architect clicks [Approve All] or [Accept] on individual capabilities            │
│     │ Trust Mode BALANCED: LOW_RISK auto-committed, MEDIUM/HIGH/CRITICAL paused        │
│     ▼                                                                                   │
│  C→S: STEERING_ACTION { action_type: "accept", stage_id: 3 }                           │
│     │                                                                                   │
│     │ Backend: State machine transitions AWAITING_STEERING → STAGE_RUNNING                │
│     │ PipelineOrchestrator runs Stage4UseCaseExecutor                                    │
│     │ StreamingChunkManager emits CHUNK_STREAM events (<2s intervals)                    │
│     ▼                                                                                   │
│  S→C: CHUNK_STREAM { chunk_id: "UC-001", node_type: "use_case", ... }                  │
│     │                                                                                   │
│     │ When all use cases streamed, state machine hits Stage 4 boundary                   │
│     ▼                                                                                   │
│  S→C: STEERING_PANEL_READY { stage_id: 4, draft_output: UseCase[] }                    │
│     │                                                                                   │
│     │ IDE auto-activates Steering Panel tab with pulsing orange dot (if not viewed)    │
│     │ Focus steals to Steering Panel unless user typing in Chat (2s rule)               │
│     ▼                                                                                   │
│  [STAGE 4 STEERING: Use Case Decomposition]  ◄── SCREEN 4                               │
│     │                                                                                   │
│     │ Architect reviews use cases, edits preconditions/flow steps, bookmarks           │
│     │ Clicks [Approve All] → triggers Stage 5 Story Decomposition                      │
│     ▼                                                                                   │
│  C→S: STEERING_ACTION { action_type: "accept", stage_id: 4 }                           │
│     │                                                                                   │
│     │ Backend: Stage5StoryExecutor runs, streams UserStory nodes                       │
│     ▼                                                                                   │
│  S→C: STEERING_PANEL_READY { stage_id: 5, draft_output: UserStory[] }                  │
│     │                                                                                   │
│  [STAGE 5 STEERING: Story Decomposition]  ◄── SCREEN 5                                  │
│     │                                                                                   │
│     │ Architect reviews stories, validates AC format, assigns story points             │
│     │ Clicks [Approve All] → triggers Stage 6 Task Decomposition                       │
│     ▼                                                                                   │
│  C→S: STEERING_ACTION { action_type: "accept", stage_id: 5 }                           │
│     │                                                                                   │
│     │ Backend: Stage6TaskExecutor runs, streams EngineeringTask nodes                    │
│     ▼                                                                                   │
│  S→C: STEERING_PANEL_READY { stage_id: 6, draft_output: EngineeringTask[] }            │
│     │                                                                                   │
│  [STAGE 6 STEERING: Task Decomposition]  ◄── SCREEN 6                                   │
│     │                                                                                   │
│     │ Architect reviews tasks, validates access_guards, file_paths, pre/post conditions│
│     │ Clicks [Approve All] → triggers Stage 7 Completeness Gate                        │
│     ▼                                                                                   │
│  C→S: STEERING_ACTION { action_type: "accept", stage_id: 6 }                           │
│     │                                                                                   │
│     │ Backend: Stage7FinalizationExecutor runs validation across all nodes             │
│     ▼                                                                                   │
│  S→C: STEERING_REQUIRED { stage: 7, reason: "completeness_check" } OR                  │
│  S→C: STATE_TRANSITION { from: "STAGE_RUNNING", to: "FINAL_GATE" }                     │
│     │                                                                                   │
│  [STAGE 7: COMPLETENESS GATE]  ◄── SCREEN 7                                             │
│     │                                                                                   │
│     │ Architect fixes errors (via Quick Fix → Node Editor), runs Auto-Fix, or overrides│
│     │ On 100% valid: Clicks [Generate Code] → triggers Stage 8                         │
│     ▼                                                                                   │
│  C→S: STEERING_ACTION { action_type: "accept", stage_id: 7 }  (or implicit on Generate)│
│     │                                                                                   │
│     │ Backend: State machine → CODE_GENERATING                                          │
│     ▼                                                                                   │
│  [STAGE 8: CODE GENERATION]                                                             │
│                                                                                         │
│  AT ANY POINT:                                                                          │
│  • Cmd+Shift+P → Command Palette (steer, revert, checkpoint, why)                       │
│  • /steer in Chat → MID_STAGE_STEER (modifies current streaming node)                   │
│  • Bookmark Comparison Drawer → Side-by-side option comparison                          │
│  • What-If Mode → Blueprint Graph drag simulation                                       │
│  • Checkpoint Restore → Roll back to any prior stage boundary                           │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Stage 4: Use Case Decomposition

### 10.1 Screen: Use Case Decomposition Steering Panel

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [<] Stage 4: Use Case Decomposition       [x] [?] [Raw JSON] [BALANCED]   │
│ Decompose capabilities into user-interaction flows                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ [Summary | Detail]    Trust: BALANCED (6 auto-approved, 3 paused, 1 HIGH)   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ◻ UC-BOOK-001: Appointment Booking          [LOW] [✓] (auto-approved)      │
│   Capability: CAP-BOOK-001 | Primary: Patient | Steps: 5 | Pre: 3         │
│   4 downstream stories                                                      │
│                                                                             │
│ ◻ UC-AUTH-001: User Login                   [LOW] [✓] (auto-approved)        │
│   Capability: CAP-AUTH-001 | Primary: Patient | Steps: 3 | Pre: 2         │
│   3 downstream stories                                                      │
│                                                                             │
│ ◻ UC-PAY-001: Payment Processing            [HIGH] [⚠] [★]                   │
│   Capability: CAP-PAY-001 | Primary: Patient | Steps: 8 | Pre: 4          │
│   Cross-cutting: touches Payment Gateway (external), PCI-DSS scope        │
│   6 downstream stories, 2 downstream tasks (auto-generated preview)         │
│   Risk: Payment logic requires explicit architectural review                │
│                                                                             │
│ ◻ UC-INS-001: Insurance Verification      [MEDIUM] [⚠] [☆]                 │
│   Capability: CAP-BOOK-001 | Primary: Receptionist | Steps: 4 | Pre: 3      │
│   External API dependency (HIPAA-eligible data)                             │
│   2 downstream stories                                                        │
│                                                                             │
│ ◻ UC-ANAL-001: Analytics Dashboard          [LOW] [✓] (auto-approved)        │
│   Capability: CAP-ANAL-001 | Primary: Dentist | Steps: 2 | Pre: 1         │
│   Read-only aggregations, no mutation risk                                  │
│   1 downstream story                                                          │
│                                                                             │
│ ── Paginated: 8 of 12 use cases ── [Previous] [1] [2] [Next]               │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ Why these outputs? Decomposed from 5 approved capabilities using          │
│ TechStackProfile (Next.js + Prisma) actor-compatibility rules.              │
│ [Tell me more →]                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ [Approve All] [Review Selected] [★ Bookmark] [View Impact Graph]            │
│                                                                             │
│ Bookmarked (2): [UC-PAY-001] [UC-INS-001]                                  │
│ [Open Comparison Drawer]                                                    │
│                                                                             │
│ Revision Budget: 4 / 5 remaining  [████████░░░]                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Intra-Screen Interactions:**
| Element | Trigger | Action | Visual Feedback |
|---------|---------|--------|-----------------|
| Summary/Detail Toggle | Click | Switches view mode | Crossfade 150ms |
| Use Case Row | Click | Expands detail card (1 at a time) | 150ms fade-in |
| Row Checkbox | Click | Toggles selection for batch actions | 2px Silver→#2563EB fill |
| Risk Badge | Render | LOW=Success, MED=Warning, HIGH=amber, CRITICAL=Error | Static pill |
| "Steps: N" label | Hover | Tooltip: "Main flow has N steps, M alt flows" | 200px tooltip |
| "Pre: N" label | Hover | Tooltip: "N preconditions defined" | 200px tooltip |
| Bookmark Star | Click | Toggles bookmark state | Star fill toggle |
| Context Window | Click "Tell me more" | Opens Chat with ContextAgent | Chat panel focus |
| Pagination | Click | Loads next page of use cases | 150ms fade |
| Keyboard `↑/↓` | Press | Navigates between rows | Row highlight |
| Keyboard `Enter` | Row focused | Expands detail | Detail card |
| Keyboard `Space` | Row focused | Toggles selection | Checkbox |
| Keyboard `1-4` | Press | Triggers action bar buttons | Button press |

**Inter-Screen Navigation:**
| From | Trigger | To | Condition |
|------|---------|-----|-----------|
| Stage 4 Steering | Click [Approve All] | Stage 5 Streaming → Stage 5 Steering | `STEERING_ACTION` emitted |
| Stage 4 Steering | Click [Modify] on row | Use Case Editor (Node Editor) | `NODE_MANIPULATION(edit)` |
| Stage 4 Steering | Click [Bookmark] | Bookmark Comparison Drawer | Drawer slides from right |
| Stage 4 Steering | Click "View Impact Graph" | Blueprint Graph (filtered to Stage 4) | `GRAPH_NODE_SELECT` |
| Stage 4 Steering | Click "Tell me more" | Chat Panel (ContextAgent) | `CONTEXT_QUESTION` |
| Stage 4 Steering | Click row expand | Detail card with full preconditions/flows | Inline expand |

**API Calls (REST):**
| Method | Path | Request DTO | Response DTO |
|--------|------|-------------|--------------|
| `GET` | `/api/v1/projects/{project_id}/steering/4` | — | `SteeringPanel` { stage_id: 4, draft_output: UseCase[], options, trust_mode, auto_approved_count, paused_count } |
| `POST` | `/api/v1/projects/{project_id}/steering` | `SteeringAction` { action_type: "accept" \| "modify" \| "replace", stage_id: 4, payload: { selected_node_ids, modified_nodes } } | `SteeringResult` { success, decision_id, next_state, impacted_nodes, propagation_required } |
| `GET` | `/api/v1/projects/{project_id}/nodes/{node_id}` | — | `Node` (UseCase) |

**WebSocket Events:**
| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| S→C | `STEERING_PANEL_READY` | `SteeringPanel` { stage_id: 4, draft_output, render_policy } | Stage 4 boundary reached |
| S→C | `CHUNK_STREAM` | `StreamChunk` { chunk_id, node_type: "use_case", node_data, stage_id: 4 } | LLM streaming use case |
| C→S | `STEERING_ACTION` | `SteeringAction` | User accepts/modifies/replaces |
| C→S | `BOOKMARK_TOGGLE` | `BookmarkToggle` { option_id, bookmarked } | Bookmark for comparison |
| C→S | `NODE_MANIPULATION` | `{ action: "edit", node_type: "use_case", node_id, data }` | Inline edit from detail card |
| S→C | `NODE_UPDATED` | `{ node_id, change_type, new_data }` | Use case modified |
| S→C | `NODE_PENDING` | `{ node_id, pending_reason }` | Awaiting user input |
| S→C | `NODE_COMMITTED` | `CommittedNode` | Use case confirmed |
| S→C | `IMPACT_REPORT_READY` | `ImpactReport` | If revision requested |
| S→C | `CHECKPOINT_CREATED` | `Checkpoint` { checkpoint_id, stage: 4 } | Auto-checkpoint |

---

### 10.2 Screen: Use Case Detail Mode (Expanded Card)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ▼ UC-PAY-001: Payment Processing                          [HIGH] [⚠] [★]   │
│ ┌─────────────────────────────────────────────────────────────────────────┐   │
│ │ Capability: CAP-PAY-001 | Layer: Backend | Status: SYSTEM_GENERATED    │   │
│ │                                                                         │   │
│ │ Description:                                                            │   │
│ │ [A patient pays for an appointment via credit card or digital wallet.  │   │
│ │  The system tokenizes card data, processes via Stripe, and records     │   │
│ │  the transaction.]                                                      │   │
│ │                                                                         │   │
│ │ Primary Actor: [Patient ▼] | Secondary: [Receptionist ▼] [System ▼]  │   │
│ │                                                                         │   │
│ │ Preconditions (4):                                                        │   │
│ │ 1. Patient must have a confirmed appointment                            │   │
│ │ 2. Payment amount must be calculated from services + tax                  │   │
│ │ 3. Stripe customer record must exist or be created                     │   │
│ │ 4. Appointment status must be "awaiting_payment"                        │   │
│ │ [+ Add Precondition]                                                      │   │
│ │                                                                         │   │
│ │ Main Flow (8 steps):                                                      │   │
│ │ 1. Patient selects "Pay Now" from appointment card                        │   │
│ │ 2. System displays itemized invoice (services, tax, total)             │   │
│ │ 3. Patient selects payment method (card, wallet, insurance co-pay)        │   │
│ │ 4. System validates payment method (Luhn check, expiry)                │   │
│ │ 5. System creates Stripe PaymentIntent with idempotency key              │   │
│ │ 6. Patient confirms 3D Secure / CVV                                      │   │
│ │ 7. System records transaction in ledger with audit trail                 │   │
│ │ 8. System updates appointment status to "paid" and sends receipt         │   │
│ │ [+ Add Step] [🗑️] [↑] [↓]                                                │   │
│ │                                                                         │   │
│ │ Alternative Flows:                                                        │   │
│ │ Alt 1: Payment declined → Retry with alternative method                   │   │
│ │ Alt 2: Insurance partial coverage → Split payment                         │   │
│ │ [+ Add Alt Flow]                                                          │   │
│ │                                                                         │   │
│ │ Postconditions (3):                                                       │   │
│ │ • Transaction record exists with Stripe payment_intent_id                 │   │
│ │ • Appointment status = "paid"                                             │   │
│ │ • Receipt sent to patient email                                           │   │
│ │                                                                         │   │
│ │ Provenance Chain:                                                         │   │
│ │ ○ Stage 3: CAP-PAY-001 approved (DEC-045)                                │   │
│ │ ↓                                                                         │   │
│ │ ○ Stage 4: UC-PAY-001 generated from capability                           │   │
│ │ [View in Decision Ledger] [View Audit Trail]                            │   │
│ │                                                                         │   │
│ │ [Edit in Node Editor] [Save Changes] [Discard]                            │   │
│ └─────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 10.3 Screen: Use Case Node Editor (Full CRUD)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [◆] Edit Use Case: UC-BOOK-001                           [x] [Validate]    │
│ Capability: Appointment Booking (CAP-BOOK-001)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Basic Info                                                                 │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ Name *            [Appointment Booking                             ]   │   │
│  │ ID                UC-BOOK-001 (read-only)                             │   │
│  │ Layer             [Frontend ▼]                                        │   │
│  │ Status            [SYSTEM_GENERATED ▼]                                │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Description & Context                                                      │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ Description *                                                        │   │
│  │ [A patient books an appointment with a dentist...                   ]   │   │
│  │ min-h:120px, max-h:240px                                               │   │
│  │                                                                      │   │
│  │ Business Context                                                     │   │
│  │ [Supports "Reduce no-shows by 30%" OKR...                          ]   │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Actors & Preconditions                                                     │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ Primary Actor      [Patient ▼]                                        │   │
│  │ Secondary Actors   [Receptionist ▼] [Dentist ▼] [+ Add]              │   │
│  │ Preconditions      [• Patient registered and logged in             ]   │   │
│  │                    [• Dentist has available slots                   ]   │   │
│  │                    [• Service active and not deprecated             ]   │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Main Flow (5 steps)                                                        │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ 1. [Patient selects service from catalog                            ]   │   │
│  │ 2. [System displays available time slots                            ]   │   │
│  │ 3. [Patient selects date and time                                 ]   │   │
│  │ 4. [System validates slot availability in real-time               ]   │   │
│  │ 5. [System creates appointment and sends confirmation             ]   │   │
│  │ [+ Add Step] [🗑️] [↑] [↓]                                            │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Alternative Flows                                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ Alt 1: Slot unavailable                                              │   │
│  │ 4a. [System shows next 3 available slots                            ]   │   │
│  │ 4b. [Patient selects alternative or cancels                         ]   │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Validation Status                                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ [🟢] Name, Description, Primary Actor, Preconditions               │   │
│  │ [🟢] Main Flow: 5 steps (min 3)                                      │   │
│  │ [🟢] Postconditions: 3 items                                         │   │
│  │ [🟢] All required fields complete — ready for commit                 │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Provenance: Generated Stage 3 by LLM (GPT-4) at 14:32:01                 │
│  [View in Decision Ledger] [View Audit Trail]                             │
│                                                                             │
│              [Cancel]  [Delete]  [Save Changes]  [Save & Enrich →]        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**API Calls (REST):**
| Method | Path | Request DTO | Response DTO |
|--------|------|-------------|--------------|
| `GET` | `/api/v1/projects/{project_id}/nodes/{node_id}` | — | `Node` (UseCase) |
| `PUT` | `/api/v1/projects/{project_id}/nodes/{node_id}` | `UpdateNodeRequest` { data, source: "user_edit" } | `Node` |
| `POST` | `/api/v1/projects/{project_id}/nodes/{node_id}/validate` | — | `ValidationResult` { valid, completeness_score, errors, warnings } |

**WebSocket Events:**
| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| C→S | `NODE_MANIPULATION` | `{ action: "edit", node_type: "use_case", node_id, data }` | CRUD operation |
| S→C | `NODE_UPDATED` | `{ node_id, changes, new_version }` | Node modified |
| S→C | `USER_OPTION_INCOHERENT` | `{ option_text, failure_reason, suggestions }` | Validation fail |
| S→C | `IMPACT_REPORT_READY` | `ImpactReport` | Downstream effects |

---

## 11. Stage 5: User Story Decomposition

### 11.1 Screen: Story Decomposition Steering Panel

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [<] Stage 5: User Story Decomposition     [x] [?] [Raw JSON] [BALANCED]    │
│ Decompose use cases into implementable user stories                       │
├─────────────────────────────────────────────────────────────────────────────┤
│ [Summary | Detail]    Trust: BALANCED (12 auto-approved, 5 paused, 2 CRIT)  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ◻ US-BOOK-001: Book appointment as patient    [LOW] [✓] (auto-approved)    │
│   Use Case: UC-BOOK-001 | Points: 5 | Priority: Must Have | AC: 3         │
│   2 downstream tasks                                                        │
│                                                                             │
│ ◻ US-BOOK-002: Reschedule appointment        [LOW] [✓] (auto-approved)      │
│   Use Case: UC-BOOK-001 | Points: 3 | Priority: Should Have | AC: 2      │
│   1 downstream task                                                         │
│                                                                             │
│ ◻ US-AUTH-001: Login with email/password     [MEDIUM] [⚠] [★]              │
│   Use Case: UC-AUTH-001 | Points: 5 | Priority: Must Have | AC: 3         │
│   Auth layer, 3 downstream tasks, JWT middleware required                 │
│                                                                             │
│ ◻ US-PAY-001: Pay with credit card           [CRITICAL] [▲] [★]              │
│   Use Case: UC-PAY-001 | Points: 8 | Priority: Must Have | AC: 4         │
│   Touches CONFIDENTIAL data (card tokens) — PCI-DSS scope                  │
│   [ ] I consent to PCI-DSS scope for this story                            │
│   Access guards required per AC-RB-05                                       │
│   4 downstream tasks (TASK-PAY-BE-001 through TASK-PAY-BE-004)             │
│                                                                             │
│ ◻ US-PAY-002: Pay with insurance co-pay    [MEDIUM] [⚠] [☆]               │
│   Use Case: UC-PAY-001 | Points: 5 | Priority: Should Have | AC: 3         │
│   External API dependency (insurance eligibility check)                      │
│   2 downstream tasks                                                        │
│                                                                             │
│ ◻ US-INS-001: Verify insurance coverage      [MEDIUM] [⚠] [☆]               │
│   Use Case: UC-INS-001 | Points: 5 | Priority: Must Have | AC: 3           │
│   HIPAA-eligible data — requires audit logging                              │
│   2 downstream tasks                                                        │
│                                                                             │
│ ── Paginated: 18 of 24 stories ── [Previous] [1] [2] [3] [Next]            │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ Why these outputs? Decomposed from 8 approved use cases. Story points        │
│ estimated via Fibonacci based on flow complexity and dependency count.     │
│ [Tell me more →]                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ [Approve All] [Review Selected] [★ Bookmark] [View Impact Graph]            │
│                                                                             │
│ Bookmarked (3): [US-PAY-001] [US-PAY-002] [US-INS-001]                     │
│ [Open Comparison Drawer]                                                    │
│                                                                             │
│ Revision Budget: 4 / 5 remaining  [████████░░░]                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Intra-Screen Interactions:**
| Element | Trigger | Action | Visual Feedback |
|---------|---------|--------|-----------------|
| Summary/Detail Toggle | Click | Switches view mode | Crossfade 150ms |
| Story Row | Click | Expands detail card with full AC, dependencies, tech notes | 150ms fade-in |
| Row Checkbox | Click | Toggles selection | 2px Silver→#2563EB fill |
| "AC: N" label | Hover | Tooltip: "N acceptance criteria defined (Given/When/Then)" | 200px tooltip |
| "Points: N" label | Hover | Tooltip: "Fibonacci estimate based on flow complexity" | 200px tooltip |
| CRITICAL Checkbox | Unchecked | Disables "Approve All" | Opacity 0.5, cursor:not-allowed |
| Bookmark Star | Click | Toggles bookmark | Star fill toggle |
| Keyboard `↑/↓` | Press | Navigates rows | Row highlight |
| Keyboard `Enter` | Row focused | Expands detail | Detail card |
| Keyboard `Space` | Row focused | Toggles selection | Checkbox |
| Keyboard `1-4` | Press | Triggers action bar | Button press |

**Inter-Screen Navigation:**
| From | Trigger | To | Condition |
|------|---------|-----|-----------|
| Stage 5 Steering | Click [Approve All] | Stage 6 Streaming → Stage 6 Steering | `STEERING_ACTION` |
| Stage 5 Steering | Click [Modify] on row | User Story Editor (Node Editor) | `NODE_MANIPULATION(edit)` |
| Stage 5 Steering | Click [Bookmark] | Bookmark Comparison Drawer | Drawer slides right |
| Stage 5 Steering | Click "View Impact Graph" | Blueprint Graph (filtered) | `GRAPH_NODE_SELECT` |
| Stage 5 Steering | Click "Tell me more" | Chat Panel (ContextAgent) | `CONTEXT_QUESTION` |

**API Calls (REST):**
| Method | Path | Request DTO | Response DTO |
|--------|------|-------------|--------------|
| `GET` | `/api/v1/projects/{project_id}/steering/5` | — | `SteeringPanel` { stage_id: 5, draft_output: UserStory[], options, trust_mode } |
| `POST` | `/api/v1/projects/{project_id}/steering` | `SteeringAction` { action_type, stage_id: 5, payload } | `SteeringResult` |
| `GET` | `/api/v1/projects/{project_id}/nodes/{node_id}` | — | `Node` (UserStory) |

**WebSocket Events:**
| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| S→C | `STEERING_PANEL_READY` | `SteeringPanel` { stage_id: 5 } | Stage 5 boundary |
| S→C | `CHUNK_STREAM` | `StreamChunk` { node_type: "user_story", stage_id: 5 } | LLM streaming story |
| C→S | `STEERING_ACTION` | `SteeringAction` | User decision |
| C→S | `BOOKMARK_TOGGLE` | `BookmarkToggle` | Bookmark option |
| C→S | `NODE_MANIPULATION` | `{ action: "edit", node_type: "user_story", node_id, data }` | Edit story |
| S→C | `NODE_UPDATED` | `{ node_id, changes }` | Story modified |
| S→C | `NODE_PENDING` | `{ node_id, pending_reason }` | Awaiting input |
| S→C | `NODE_COMMITTED` | `CommittedNode` | Story confirmed |
| S→C | `IMPACT_REPORT_READY` | `ImpactReport` | Revision impact |
| S→C | `REVISION_BUDGET_EXHAUSTED` | `{ budget_id, decision_point }` | Budget exhausted |

---

### 11.2 Screen: User Story Detail Mode (Expanded Card)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ▼ US-PAY-001: Pay with credit card                        [CRITICAL] [▲] [★]│
│ Use Case: UC-PAY-001 | Layer: Backend | Status: SYSTEM_GENERATED          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Title:                                                                    │
│  [As a Patient, I want to pay with a credit card                         ] │
│  [so that my appointment is confirmed instantly.]                            │
│  [🟢] Standard format valid — "As a [role], I want [goal], so that [benefit]"│
│                                                                             │
│  Story Points: [8 ▼] | Priority: [Must Have ▼] | Layer: [Backend ▼]          │
│                                                                             │
│  Acceptance Criteria (4):                                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ AC-1:                                                                  │   │
│  │ Given [a patient with a confirmed appointment and valid card         ] │   │
│  │ When  [they submit payment via Stripe PaymentIntent                  ] │   │
│  │ Then  [the appointment status updates to "paid" and receipt is sent ] │   │
│  │ [🟢] Complete — all clauses present                                    │   │
│  │                                                                        │   │
│  │ AC-2:                                                                  │   │
│  │ Given [a declined card                                               ] │   │
│  │ When  [Stripe returns card_declined                                  ] │   │
│  │ Then  [the system shows error with retry option and logs failure    ] │   │
│  │ [🟢] Complete                                                          │   │
│  │                                                                        │   │
│  │ AC-3:                                                                  │   │
│  │ Given [3D Secure authentication is required                          ] │   │
│  │ When  [the bank challenges the payment                               ] │   │
│  │ Then  [the patient is redirected to auth flow and back to confirmation] │   │
│  │ [🟢] Complete                                                          │   │
│  │                                                                        │   │
│  │ AC-4:                                                                  │   │
│  │ Given [a successful payment                                          ] │   │
│  │ When  [the webhook arrives from Stripe                                 ] │   │
│  │ Then  [the idempotency key prevents duplicate ledger entries          ] │   │
│  │ [🟢] Complete                                                          │   │
│  │                                                                        │   │
│  │ [+ Add Acceptance Criterion]                                           │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Dependencies: [US-BOOK-001] [US-AUTH-001] [CAP-PAY-001]                  │
│  Technical Notes:                                                          │
│  [Use Stripe PaymentIntent with idempotency key. Store card fingerprint   ] │
│  [not full PAN. PCI-DSS SAQ A-EP scope. Webhook signature verification   ] │
│  [required.]                                                               │
│                                                                             │
│  Validation: [🟢] 4 AC complete, [🟢] Title format valid, [🟢] Points set │
│  [🟢] Dependencies resolved, [🟢] Technical notes present                  │
│                                                                             │
│  Provenance: Generated Stage 5 by LLM (GPT-4) at 15:01:15                 │
│  [View in Decision Ledger] [View Audit Trail] [Edit in Node Editor →]      │
│                                                                             │
│              [Save Changes] [Discard]                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 11.3 Screen: User Story Node Editor (Full CRUD)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [▭] Edit User Story: US-AUTH-001                         [x] [Validate]    │
│ Use Case: Login (UC-AUTH-001)                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Basic Info                                                                 │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ Title *        [As a Patient, I want to log in...                  ]   │   │
│  │ ID             US-AUTH-001 (read-only)                                │   │
│  │ Story Points   [5 ▼] (Fibonacci)                                      │   │
│  │ Priority       [Must Have ▼]                                          │   │
│  │ Layer          [Auth ▼]                                               │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Acceptance Criteria (REQUIRED)                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ AC-1:                                                                │   │
│  │ Given [a registered patient with valid credentials                 ]   │   │
│  │ When  [they submit the login form                                  ]   │   │
│  │ Then  [they are authenticated and redirected to dashboard          ]   │   │
│  │ [🟢] Complete — all clauses present                                  │   │
│  │                                                                      │   │
│  │ AC-2:                                                                │   │
│  │ Given [an unregistered email                                       ]   │   │
│  │ When  [submitted                                                   ]   │   │
│  │ Then  [display "Account not found" error with registration link   ]   │   │
│  │ [🟢] Complete                                                          │   │
│  │                                                                      │   │
│  │ AC-3:                                                                │   │
│  │ Given [5 failed login attempts                                     ]   │   │
│  │ When  [the 6th attempt is made                                     ]   │   │
│  │ Then  [account is temporarily locked for 15 minutes               ]   │   │
│  │ [🟢] Complete                                                          │   │
│  │                                                                      │   │
│  │ [+ Add Acceptance Criterion]                                         │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Technical Notes & Dependencies                                           │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ Technical Notes                                                      │   │
│  │ [Use JWT with 15min expiry. Refresh token in httpOnly cookie...     ]   │   │
│  │ Dependencies: [US-AUTH-002] [US-PROF-001] [CAP-BOOK-001]            │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Validation: [🟢] 3 AC defined, [🟢] Title format valid, [🟢] Priority set  │
│  [Run Auto-Enrich] ← AI suggests AC-4: password reset flow                │
│                                                                             │
│              [Cancel]  [Delete]  [Save Changes]  [Save & Enrich →]          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**API Calls (REST):**
| Method | Path | Request DTO | Response DTO |
|--------|------|-------------|--------------|
| `GET` | `/api/v1/projects/{project_id}/nodes/{node_id}` | — | `Node` (UserStory) |
| `PUT` | `/api/v1/projects/{project_id}/nodes/{node_id}` | `UpdateNodeRequest` | `Node` |
| `POST` | `/api/v1/projects/{project_id}/nodes/{node_id}/enrich` | `EnrichRequest` { enrichment_type: "auto" } | `EnrichResult` |

**WebSocket Events:**
| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| C→S | `NODE_MANIPULATION` | `{ action: "edit", node_type: "user_story", node_id, data }` | Save story |
| S→C | `NODE_ENRICHED` | `EnrichResult` | Enrichment applied |
| S→C | `NODE_UPDATED` | `{ node_id, changes }` | Update confirmed |

---

## 12. Stage 6: Task Decomposition

### 12.1 Screen: Task Decomposition Steering Panel

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [<] Stage 6: Task Decomposition           [x] [?] [Raw JSON] [BALANCED]    │
│ Decompose stories into engineering tasks with file paths and access guards  │
├─────────────────────────────────────────────────────────────────────────────┤
│ [Summary | Detail]    Trust: BALANCED (18 auto-approved, 5 paused, 2 CRIT) │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ◻ TASK-AUTH-BE-001: JWT Middleware            [LOW] [✓] (auto-approved)     │
│   Story: US-AUTH-001 | Layer: Backend | Complexity: Low | Est: 4h          │
│   File paths: backend/src/middleware/auth.ts, backend/src/types/jwt.ts    │
│   3 downstream files                                                        │
│                                                                             │
│ ◻ TASK-AUTH-BE-002: Login Route               [MEDIUM] [⚠] [★]              │
│   Story: US-AUTH-001 | Layer: Backend | Complexity: Medium | Est: 8h     │
│   File paths: backend/src/routes/auth.routes.ts, backend/src/services/... │
│   Input validation required (Zod schema), rate limiting guard             │
│   2 downstream files                                                        │
│                                                                             │
│ ◻ TASK-PAY-BE-001: Stripe PaymentIntent       [CRITICAL] [▲] [★]            │
│   Story: US-PAY-001 | Layer: Backend | Complexity: High | Est: 16h          │
│   File paths: backend/src/services/payment.ts, backend/src/routes/...     │
│   Touches CONFIDENTIAL data (card tokens) — PCI-DSS scope                   │
│   [🔴] Access Guards REQUIRED per AC-RB-05                                  │
│   [ ] I consent to PCI-DSS scope for this task                            │
│   Guards: [ ] Authorization header check [ ] Token validation [ ] Audit log │
│   [+ Add Guard]                                                             │
│   5 downstream files                                                        │
│                                                                             │
│ ◻ TASK-PAY-BE-002: Payment Webhook Handler    [HIGH] [⚠] [★]                │
│   Story: US-PAY-001 | Layer: Backend | Complexity: High | Est: 12h          │
│   File paths: backend/src/webhooks/stripe.ts                              │
│   Idempotency key validation, signature verification                        │
│   1 downstream file                                                         │
│                                                                             │
│ ◻ TASK-BOOK-FE-001: Booking Calendar UI      [LOW] [✓] (auto-approved)     │
│   Story: US-BOOK-001 | Layer: Frontend | Complexity: Low | Est: 8h         │
│   File paths: frontend/src/components/BookingCalendar.tsx                  │
│   React component, no data mutation, read-only from API                     │
│   1 downstream file                                                         │
│                                                                             │
│ ── Paginated: 20 of 47 tasks ── [Previous] [1] [2] [3] [Next]              │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ Why these outputs? Decomposed from 18 approved stories using               │
│ TechStackProfile (Next.js + Prisma). Complexity estimated via cyclomatic   │
│ analysis of acceptance criteria + dependency graph depth.                   │
│ [Tell me more →]                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ [Approve All] [Review Selected] [★ Bookmark] [View Impact Graph]             │
│                                                                             │
│ Bookmarked (3): [TASK-PAY-BE-001] [TASK-PAY-BE-002] [TASK-AUTH-BE-002]     │
│ [Open Comparison Drawer]                                                     │
│                                                                             │
│ Revision Budget: 3 / 5 remaining  [███████░░░]                             │
│ [🟡 Warning: Budget low. Use What-If mode for exploration.]                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Intra-Screen Interactions:**
| Element | Trigger | Action | Visual Feedback |
|---------|---------|--------|-----------------|
| Summary/Detail Toggle | Click | Switches view mode | Crossfade 150ms |
| Task Row | Click | Expands detail card with file paths, pre/post conditions, guards | 150ms fade-in |
| Row Checkbox | Click | Toggles selection | 2px Silver→#2563EB fill |
| "Est: Nh" label | Hover | Tooltip: "Estimated hours based on complexity and story points" | 200px tooltip |
| "File paths: N" label | Hover | Tooltip: "N files will be generated in Stage 8" | 200px tooltip |
| Access Guard Checkbox | Click | Toggles guard requirement | Check animation |
| CRITICAL Checkbox | Unchecked | Disables "Approve All" | Opacity 0.5, cursor:not-allowed |
| "+ Add Guard" | Click | Opens guard input inline | Input field appears |
| Bookmark Star | Click | Toggles bookmark | Star fill toggle |
| Keyboard `↑/↓` | Press | Navigates rows | Row highlight |
| Keyboard `Enter` | Row focused | Expands detail | Detail card |
| Keyboard `Space` | Row focused | Toggles selection | Checkbox |
| Keyboard `1-4` | Press | Triggers action bar | Button press |

**Inter-Screen Navigation:**
| From | Trigger | To | Condition |
|------|---------|-----|-----------|
| Stage 6 Steering | Click [Approve All] | Stage 7 Completeness Gate | `STEERING_ACTION` |
| Stage 6 Steering | Click [Modify] on row | Task Editor (Node Editor) | `NODE_MANIPULATION(edit)` |
| Stage 6 Steering | Click [Bookmark] | Bookmark Comparison Drawer | Drawer slides right |
| Stage 6 Steering | Click "View Impact Graph" | Blueprint Graph (filtered) | `GRAPH_NODE_SELECT` |
| Stage 6 Steering | Click "Tell me more" | Chat Panel (ContextAgent) | `CONTEXT_QUESTION` |

**API Calls (REST):**
| Method | Path | Request DTO | Response DTO |
|--------|------|-------------|--------------|
| `GET` | `/api/v1/projects/{project_id}/steering/6` | — | `SteeringPanel` { stage_id: 6, draft_output: EngineeringTask[], options, trust_mode } |
| `POST` | `/api/v1/projects/{project_id}/steering` | `SteeringAction` { action_type, stage_id: 6, payload } | `SteeringResult` |
| `GET` | `/api/v1/projects/{project_id}/nodes/{node_id}` | — | `Node` (EngineeringTask) |

**WebSocket Events:**
| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| S→C | `STEERING_PANEL_READY` | `SteeringPanel` { stage_id: 6 } | Stage 6 boundary |
| S→C | `CHUNK_STREAM` | `StreamChunk` { node_type: "engineering_task", stage_id: 6 } | LLM streaming task |
| C→S | `STEERING_ACTION` | `SteeringAction` | User decision |
| C→S | `BOOKMARK_TOGGLE` | `BookmarkToggle` | Bookmark option |
| C→S | `NODE_MANIPULATION` | `{ action: "edit", node_type: "engineering_task", node_id, data }` | Edit task |
| S→C | `NODE_UPDATED` | `{ node_id, changes }` | Task modified |
| S→C | `NODE_PENDING` | `{ node_id, pending_reason }` | Awaiting input |
| S→C | `NODE_COMMITTED` | `CommittedNode` | Task confirmed |
| S→C | `IMPACT_REPORT_READY` | `ImpactReport` | Revision impact |
| S→C | `REVISION_BUDGET_EXHAUSTED` | `{ budget_id, decision_point }` | Budget exhausted |
| S→C | `CHECKPOINT_CREATED` | `Checkpoint` { checkpoint_id, stage: 6 } | Auto-checkpoint |

---

### 12.2 Screen: Task Detail Mode (Expanded Card)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ▼ TASK-PAY-BE-001: Stripe PaymentIntent                   [CRITICAL] [▲] [★]│
│ Story: US-PAY-001 | Layer: Backend | Status: SYSTEM_GENERATED              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Task Name: [Implement Stripe PaymentIntent with idempotency key           ] │
│  ID: TASK-PAY-BE-001 (read-only) | Complexity: [High ▼] | Est: [16 ▼] hours │
│                                                                             │
│  Preconditions (3):                                                         │
│  1. Stripe SDK installed (stripe npm package)                                │
│  2. STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET env vars set                 │
│  3. Database schema has payments table with idempotency_key column          │
│  [+ Add Precondition]                                                         │
│                                                                             │
│  Postconditions (3):                                                        │
│  1. Valid payment returns { payment_intent_id, status, client_secret }       │
│  2. Invalid payment returns 402 with structured error code                   │
│  3. All requests logged to audit table with IP and timestamp                │
│  [+ Add Postcondition]                                                        │
│                                                                             │
│  File Paths (auto-generated):                                               │
│  [backend/src/services/payment.ts] [backend/src/routes/payment.routes.ts]   │
│  [backend/src/webhooks/stripe.ts] [backend/src/models/payment.ts]            │
│  [+ Add File Path]                                                            │
│                                                                             │
│  Tech Stack Requirements: [Node.js] [Express] [Stripe SDK] [Prisma] [Zod]    │
│                                                                             │
│  Database Schema Changes:                                                     │
│  [ALTER TABLE payments ADD COLUMN idempotency_key VARCHAR(255) UNIQUE;    ] │
│  [ALTER TABLE payments ADD COLUMN stripe_payment_intent_id VARCHAR(255);  ] │
│                                                                             │
│  Access Guards (REQUIRED for confidential data):                              │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ [🔴] This task touches CONFIDENTIAL data (card tokens)                 │   │
│  │      Access Guards REQUIRED per AC-RB-05                               │   │
│  │                                                                        │   │
│  │ [✓] Route must check Authorization: Bearer <token> header              │   │
│  │ [✓] Token must be validated against JWT_SECRET                         │   │
│  │ [✓] Role must be extracted from token payload (patient or receptionist)│   │
│  │ [✓] Failed auth must log to audit table with IP and timestamp          │   │
│  │ [ ] Rate limiting: max 5 payment attempts per minute per user         │   │
│  │ [+ Add Guard]                                                          │   │
│  │                                                                        │   │
│  │ [🟢] 4 of 5 guards defined — meets requirement                         │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Validation: [🟢] Name, Pre, Post, File paths, Access guards, Schema changes │
│  [Run Auto-Enrich] ← AI suggests rate limiting guard and retry logic        │
│                                                                             │
│  Provenance: Generated Stage 6 by LLM (GPT-4) at 15:45:22                  │
│  [View in Decision Ledger] [View Audit Trail] [Edit in Node Editor →]      │
│                                                                             │
│              [Save Changes] [Discard]                                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 13. Stage 7: Completeness Gate

### 13.1 Screen: Completeness Gate (Validation Dashboard)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Stage 7: Completeness Gate                    [Run Auto-Fix] [Override →]     │
│ Validate all mandatory fields before code generation                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Overall Completeness: [███████████████████████░░░░░░░]  78%                │
│  112 of 144 nodes fully validated | 32 nodes with issues                    │
│                                                                             │
│  [🟢] 112 Valid  [🟡] 24 Warnings  [🔴] 8 Errors  [⚪] 0 Deferred            │
│                                                                             │
│  Validation by Stage                                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ Stage 1: Actors        [████████████░░░]  8/10  [🟡] 2 thin               │   │
│  │ Stage 2: Capabilities  [███████████████]  12/12 [🟢] complete             │   │
│  │ Stage 3: Use Cases     [██████████░░░░░]  6/8   [🟡] 2 missing pre      │   │
│  │ Stage 4: Stories       [████████████░░░]  15/18 [🔴] 3 missing AC       │   │
│  │ Stage 5: Tasks         [████████░░░░░░]  22/28 [🔴] 6 missing guards    │   │
│  │ Stage 6: Tech Stack    [████████████░░░]  1/1   [🟢] complete          │   │
│  │ Stage 7: Infra         [████████████░░░]  1/1   [🟡] stale              │   │
│  │ Stage 7: RBAC          [███████████████]  1/1   [🟢] complete          │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Critical Errors (Blocking Export)                                           │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ [🔴] US-AUTH-001: Missing Acceptance Criteria (0 AC, min 1)           │   │
│  │      [Quick Fix] [Edit Story] [Defer with rationale]                   │   │
│  │                                                                        │   │
│  │ [🔴] TASK-PAY-BE-003: Missing Access Guards (0 guards, confidential)   │   │
│  │      [Quick Fix] [Edit Task] [Defer with rationale]                    │   │
│  │                                                                        │   │
│  │ [🔴] UC-BOOK-001: Incomplete Main Flow (2 steps, min 3)              │   │
│  │      [Quick Fix] [Edit Use Case] [Defer with rationale]                │   │
│  │                                                                        │   │
│  │ [🔴] ACT-ADMIN-001: Missing RBAC Link (no RolePermissionEntry)         │   │
│  │      [Quick Fix] [Edit Actor] [Defer with rationale]                   │   │
│  │                                                                        │   │
│  │ [🔴] US-PAY-001: AC-2 missing "Given" clause (incomplete format)       │   │
│  │      [Quick Fix] [Edit Story] [Defer with rationale]                   │   │
│  │                                                                        │   │
│  │ [🔴] TASK-AUTH-BE-001: Missing estimated hours (required for sprint)   │   │
│  │      [Quick Fix] [Edit Task] [Defer with rationale]                    │   │
│  │                                                                        │   │
│  │ [🔴] INF-PROFILE-001: Infrastructure Profile Stale (scale changed)   │   │
│  │      [Re-run Advisor] [Override] [Defer with rationale]                │   │
│  │                                                                        │   │
│  │ [🔴] RBAC-ROLE-001: Missing rationale for /api/salaries GET grant      │   │
│  │      [Quick Fix] [Edit RBAC] [Defer with rationale]                    │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Warnings (Non-Blocking but Recommended)                                    │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ [🟡] CAP-BOOK-001: Thin Description (45 chars, min 50)                 │   │
│  │ [🟡] US-PROF-001: No Dependencies Linked (orphan risk)               │   │
│  │ [🟡] TASK-AUTH-BE-001: Technical Notes Thin (2 lines)                │   │
│  │ [🟡] 21 more warnings... [Expand All]                                    │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Auto-Fix Options                                                           │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ [Run Auto-Fix for All Errors] ← AI attempts to fix all 8 blocking issues│   │
│  │      Requires review before commit. Estimated time: 4 minutes.          │   │
│  │                                                                        │   │
│  │ [Run Auto-Fix for Selected] ← Check individual errors above            │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Export Options (Disabled until 100% or explicit override)                   │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ [Generate Code (Stage 8)]      ← disabled, opacity 0.4                 │   │
│  │ [Export Blueprint JSON]        ← disabled                                │   │
│  │ [Export with Deferred Fields]  ← requires `pipeline_admin` role          │   │
│  │      "8 errors must be resolved or explicitly deferred before           │   │
│  │       code generation can proceed."                                    │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│              [← Back to Stage 6]  [Run Auto-Fix All]  [Override →]            │
│                                    ↑ requires `pipeline_admin` role        │
│                                                                             │
│  [🟢] All 8 errors fixed → [Generate Code →] enabled                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Intra-Screen Interactions:**
| Element | Trigger | Action | Visual Feedback |
|---------|---------|--------|-----------------|
| Stage Bar | Click | Expands to show node-level issues | 400ms height expand |
| Error Row | Click | Opens Node Editor modal for that node | Modal overlay |
| "Quick Fix" | Click | AI suggests fix, opens inline preview | Inline expand |
| "Edit Story/Task/etc" | Click | Opens Node Editor | Modal overlay |
| "Defer with rationale" | Click | Opens rationale input, marks as `DEFERRED` | Inline input |
| "Re-run Advisor" | Click | Triggers Scale/Infra advisor re-run | Spinner |
| "Override" | Click | Requires typed confirmation + admin role | Confirmation modal |
| "Run Auto-Fix All" | Click | Batch AI processing, shows progress per item | Progress bars |
| "Expand All" | Click | Expands all warning rows | Cascade expand |
| Export Buttons | Hover (disabled) | Tooltip: "Resolve 8 errors to enable" | Tooltip |

**Inter-Screen Navigation:**
| From | Trigger | To | Condition |
|------|---------|-----|-----------|
| Completeness Gate | Click error row | Node Editor (contextual) | `NODE_MANIPULATION(edit)` |
| Completeness Gate | Click "Edit Story" | User Story Editor | Modal |
| Completeness Gate | Click "Edit Task" | Task Editor | Modal |
| Completeness Gate | Click "Edit RBAC" | RBAC Matrix Editor | Modal |
| Completeness Gate | Click "Override" | Confirmation Modal | Admin role check |
| Completeness Gate | 100% complete | Stage 8 (Code Generation) | Auto-transition |
| Completeness Gate | Click "Back to Stage 6" | Steering Panel (Stage 6) | `STEERING_ACTION` |
| Completeness Gate | Click "Generate Code" | Code Generation Screen | `CODE_GENERATING` |

**API Calls (REST):**
| Method | Path | Request DTO | Response DTO |
|--------|------|-------------|--------------|
| `GET` | `/api/v1/projects/{project_id}/nodes/{node_id}` | — | `Node` |
| `PUT` | `/api/v1/projects/{project_id}/nodes/{node_id}` | `UpdateNodeRequest` | `Node` |
| `POST` | `/api/v1/projects/{project_id}/nodes/{node_id}/validate` | — | `ValidationResult` { valid, completeness_score, errors, warnings } |
| `POST` | `/api/v1/projects/{project_id}/nodes/{node_id}/enrich` | `EnrichRequest` { enrichment_type: "auto" } | `EnrichResult` |
| `POST` | `/api/v1/projects/{project_id}/generate` | `CodeGenRequest` | `CodeGenStart` |

**WebSocket Events:**
| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| S→C | `STEERING_REQUIRED` | `{ stage: 7, reason: "completeness_check_failed", options }` | Gate blocked |
| S→C | `STATE_TRANSITION` | `{ from: "STAGE_RUNNING", to: "FINAL_GATE" }` | State change |
| C→S | `NODE_MANIPULATION` | `{ action: "edit", node_id, data }` | Fix error |
| S→C | `NODE_UPDATED` | `{ node_id, changes }` | Fix applied |
| S→C | `NODE_ENRICHED` | `EnrichResult` | Auto-fix applied |
| S→C | `CHECKPOINT_CREATED` | `Checkpoint` { checkpoint_id, stage: 6 } | Auto-checkpoint |
| C→S | `CHECKPOINT_REQUEST` | `{ action: "create", label: "Pre-Stage-8" }` | Manual checkpoint |
| S→C | `INFRASTRUCTURE_PROFILE_STALE` | `{ profile_id, stale: true }` | Scale inputs changed |
| S→C | `RBAC_CONFLICT_DETECTED` | `PermissionConflict` | RBAC issue found |
| S→C | `PRIVILEGE_ESCALATION_FLAGGED` | `EscalationPath` | Escalation found |

---

## 14. Stage 8: Code Generation

### 14.1 Screen: Code Generation + Live Editor Streaming

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Stage 8: Code Generation                      [Pause] [Cancel] [BALANCED]    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ ● Generation in progress...  [████████████████████░░░░░░░░░░]  65%    │   │
│  │ 28 of 47 files completed                                               │   │
│  │ Current: backend/src/services/payment.ts (TASK-PAY-BE-003)           │   │
│  │ [Pause] ← emits MID_STAGE_STEER (pause) at chunk boundary             │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  File Explorer (left)          │  Editor (center)                          │
│  ┌────────────────────────┐    │  ┌──────────────────────────────────────┐   │
│  │ ▼ src/                 │    │  │ [🔵] payment.ts (generating...)    │   │
│  │   ▼ backend/           │    │  ├────────────────────────────────────┤   │
│  │     ▼ services/        │    │  │ import { Stripe } from 'stripe';   │   │
│  │       payment.ts [🟢]  │    │  │ import { z } from 'zod';           │   │
│  │       auth.ts    [🟢]  │    │  │                                    │   │
│  │     ▼ routes/          │    │  │ export const processPayment =      │   │
│  │       auth.routes.ts   │    │  │   async (req: Request, res: Response)│   │
│  │       [🟢]             │    │  │   => {                             │   │
│  │     ▼ models/          │    │  │     const schema = z.object({      │   │
│  │       User.ts [🟢]      │    │  │       amount: z.number().positive(),│   │
│  │   ▼ frontend/          │    │  │       currency: z.enum(['USD']),   │   │
│  │     Login.tsx [🟢]     │    │  │     });                            │   │
│  │     Dashboard.tsx [🟡] │    │  │     // @steering: Add idempotency  │   │
│  │                        │    │  │     // key for retry safety        │   │
│  │                        │    │  │     │ ← streaming cursor (2px bar)   │   │
│  └────────────────────────┘    │  └──────────────────────────────────────┘   │
│                                                                             │
│  Bottom Panel: Terminal                                                      │
│  [deps] Resolving dependencies...                                           │
│  [download] ⠼ downloading stripe@12.0.0                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**API Calls (REST):**
| Method | Path | Request DTO | Response DTO |
|--------|------|-------------|--------------|
| `POST` | `/api/v1/projects/{project_id}/generate` | `CodeGenRequest` { target_nodes, include_tests, include_infrastructure } | `CodeGenStart` { generation_id, total_files } |
| `GET` | `/api/v1/projects/{project_id}/generate/status` | — | `CodeGenStatus` { status, files_completed, errors } |
| `GET` | `/api/v1/projects/{project_id}/workspace/files` | `FileListQuery` | `FileTree` |
| `GET` | `/api/v1/projects/{project_id}/workspace/file` | `FileReadRequest` { path } | `FileContent` |

**WebSocket Events:**
| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| S→C | `CODE_GENERATION_STARTED` | `CodeGenStart` | Stage 8 begins |
| S→C | `CODE_FILE_STREAM` | `CodeFileChunk` { file_path, content_delta, layer, task_id } | File chunk |
| S→C | `CODE_FILE_COMPLETE` | `GeneratedFile` { file_path, content_hash, provenance } | File done |
| S→C | `CODE_GENERATION_COMPLETE` | `WorkspaceManifest` | Stage 8 done |
| S→C | `DEPENDENCY_INSTALL_STATUS` | `DependencyInstallStatus` { status, step, progress_percent } | Install progress |
| C→S | `CODE_FILE_STEER` | `{ file_path, action: "accept" \| "reject" \| "modify", instruction }` | File-level steer |
| C→S | `MID_STAGE_STEER` | `{ instruction, action_type: "pause" }` | Pause streaming |
| C→S | `EDITOR_CHANGE` | `{ file_path, change_event }` | User edit during gen |

**SSE Stream:**
```
GET /api/v1/projects/{project_id}/workspace/stream
event: file_start → { file_path, layer, task_id }
event: file_chunk → { file_path, content_delta, offset }
event: file_complete → { file_path, content_hash, size_bytes }
```

---

### 14.2 Screen: 3-Way Merge Conflict Resolution

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🔀 Merge Conflict: auth.routes.ts                               [✕]        │
│ Blueprint revision triggered regeneration. User edits detected.             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐               │
│  │ BASE (Original) │ │ OURS (Your Edits)│ │ THEIRS (New Gen)│               │
│  │ Checkpoint-003  │ │ 15:45:22        │ │ 16:02:18        │               │
│  ├─────────────────┤ ├─────────────────┤ ├─────────────────┤               │
│  │ import ...      │ │ import ...      │ │ import ...      │               │
│  │ + import { z }  │ │ + import { z }  │ │ + import { z }  │               │
│  │                 │ │ + // Added Zod  │ │ + // Added Zod  │               │
│  │                 │ │ + validation    │ │ + validation    │               │
│  │                 │ │                 │ │                 │               │
│  │ [✓ Accept]      │ │ [✓ Accept]      │ │ [✓ Accept]      │               │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘               │
│                                                                             │
│  OUTPUT (Editable) — 1 of 3 conflicts resolved                               │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ import { z } from 'zod';                                             │   │
│  │                                                                        │   │
│  │ function login(req, res) {                                             │   │
│  │   <<<<<<< OURS                                                         │   │
│  │   // Added Zod validation with custom error messages                   │   │
│  │   const schema = z.object({                                            │   │
│  │     email: z.string().email("Invalid email format"),                     │   │
│  │   =======                                                              │   │
│  │   // Added Zod validation with standard errors                         │   │
│  │   const schema = z.object({                                            │   │
│  │     email: z.string().email(),                                         │   │
│  │   >>>>>>> THEIRS                                                       │   │
│  │   });                                                                  │   │
│  │ }                                                                      │   │
│  │                                                                        │   │
│  │ [◄ Previous Conflict] [Next Conflict ►] (2 remaining)                   │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  [Accept Merge] [Cancel & Keep Current] [Restore Pre-Stage-8 Checkpoint]     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**API Calls (REST):**
| Method | Path | Request DTO | Response DTO |
|--------|------|-------------|--------------|
| `GET` | `/api/v1/projects/{project_id}/workspace/diff` | `DiffRequest` { file_path, base_version, compare_version } | `DiffResult` { additions, deletions, modifications } |
| `POST` | `/api/v1/projects/{project_id}/workspace/merge` | `MergeRequest` { file_path, base_content, ours_content, theirs_content, resolution } | `MergeResult` { merged_content, conflicts_remaining } |

**WebSocket Events:**
| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| S→C | `MERGE_CONFLICT` | `MergeConflictInfo` | Conflict detected |
| C→S | `RESOLVE_CONFLICT` | `{ conflict_id, resolution }` | Conflict resolution |
| S→C | `EDITOR_CONFLICT` | `{ file_path, base, ours, theirs }` | Merge conflict |

---

## 15. Stage 9: Runtime, Live Preview & Tests

### 15.1 Screen: Live Preview + Terminal + Test Results

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Stage 9: Runtime & Preview                    [Stop] [Restart] [BALANCED] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Live Preview (right sidebar, 400px)                                        │
│  ┌────────────────────────────────────────┐    │  Terminal (bottom)         │
│  │ [🖥️] [📱] [📱] [↔] Device toggles    │    │  [deps] ✓ Done            │
│  │                                        │    │  [build] ✓ Done           │
│  │     [Dental SaaS Login]                │    │  [runtime] ● Running      │
│  │                                        │    │  [test] ● Running...      │
│  │     Email: [              ]            │    │                            │
│  │     Password: [              ]         │    │  [runtime] Server on :3000 │
│  │     [Login]                            │    │  [test] PASS auth.test.ts  │
│  │                                        │    │  [test] FAIL appointments..│
│  │     [Sign up as new patient]           │    │      Expected: 400         │
│  │                                        │    │      Received: 404         │
│  │  http://localhost:3000        [📋]     │    │      at appointments.routes│
│  └────────────────────────────────────────┘    │                            │
│                                                │  [✓] deps [✓] build [✓] runtime│
│  Editor (center)                               │  [✗] test                  │
│  ┌────────────────────────────────────────┐    │                            │
│  │ [🔵] appointments.routes.ts          │    └────────────────────────────┘
│  │ 41:  expect(status).toBe(400);         │                                 │
│  │ 42:  // @steering: Fix validation      │                                 │
│  │ 43:  //      return 400 for missing    │                                 │
│  │ 44:  //      required fields           │                                 │
│  │                                        │                                 │
│  │  [Submit] [Dismiss]  ← @steering pill  │                                 │
│  └────────────────────────────────────────┘                                 │
│                                                                             │
│  Test Results (bottom tab, active)                                           │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ 47 tests    [███████████████░░░] 92%    4.2s    [2 failures 🔴]      │   │
│  │                                                                        │   │
│  │ ▼ appointments.test.ts                                2 tests           │   │
│  │   ✗ should validate required fields                    234ms           │   │
│  │     Expected: 400    Received: 404                                    │   │
│  │     at validate (src/backend/api/appointments.routes.ts:42:11)        │   │
│  │     [Debug] [Re-run]                                                   │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**API Calls (REST):**
| Method | Path | Request DTO | Response DTO |
|--------|------|-------------|--------------|
| `POST` | `/api/v1/projects/{project_id}/runtime/start` | `RuntimeStartRequest` { environment, hot_reload } | `RuntimeStartResult` { sandbox_id, preview_url, status } |
| `GET` | `/api/v1/projects/{project_id}/runtime/status` | — | `RuntimeStatus` { status, preview_url, port_mappings, uptime_seconds } |
| `POST` | `/api/v1/projects/{project_id}/runtime/command` | `RuntimeCommand` { command, args } | `RuntimeCommandResult` { exit_code, stdout, stderr } |
| `POST` | `/api/v1/projects/{project_id}/tests/run` | `TestRunRequest` { filter, file_pattern } | `TestRunResult` { run_id, status, summary } |
| `GET` | `/api/v1/projects/{project_id}/tests` | `TestListQuery` { run_id, status } | `TestList` { tests, summary } |

**WebSocket Events:**
| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| S→C | `RUNTIME_STARTED` | `{ preview_url, sandbox_id }` | Sandbox ready |
| S→C | `RUNTIME_LOG` | `{ stream, content }` | Runtime output |
| S→C | `HOT_RELOAD` | `{ file_path, reload_type }` | Frontend reload |
| S→C | `TEST_RESULT_STREAM` | `TestResult` { test_name, status, duration_ms, stack_trace } | Individual test |
| S→C | `TEST_RUN_COMPLETED` | `TestSummary` | Suite done |
| C→S | `PREVIEW_FEEDBACK` | `PreviewFeedback` { text, element_selector, feedback_type } | User feedback |
| C→S | `PREVIEW_INTERACTIVE_ELEMENT` | `{ selector, component_path, story_id }` | Click from preview |
| C→S | `RUNTIME_COMMAND` | `RuntimeCommand` | Execute shell |
| C→S | `TEST_RERUN` | `{ test_id }` | Re-run single |
| C→S | `TEST_DEBUG` | `{ test_id }` | Debug test |

**SSE Stream:**
```
GET /api/v1/projects/{project_id}/runtime/logs
event: log → { stream, content, timestamp }
event: status → { status, uptime_seconds }
```

---

## 16. Stage 10: Deployment

### 16.1 Screen: Deployment Configuration

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Stage 10: Deployment Pipeline                 [Back to Preview] [Deploy]    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Target Environment                                                         │
│  [●] Vercel (Production)  [○] AWS Amplify  [○] Netlify  [○] Kubernetes     │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ Vercel Configuration                                                   │   │
│  │ • Project Name: dental-saas-mvp                                        │   │
│  │ • Framework Preset: Next.js                                          │   │
│  │ • Environment Variables:                                               │   │
│  │   DATABASE_URL = [postgresql://...       ]                             │   │
│  │   JWT_SECRET   = [••••••••••••••         ]                             │   │
│  │   STRIPE_KEY   = [••••••••••••••         ]                             │   │
│  │                                                                        │   │
│  │ [Validate Environment] ← checks all required vars present            │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Pre-Deploy Checks                                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ [🟢] All tests passing (47/47)                                         │   │
│  │ [🟢] Build successful (0 errors, 2 warnings)                             │   │
│  │ [🟢] Security scan: no critical vulnerabilities                          │   │
│  │ [🟢] RBAC model compiled into middleware                               │   │
│  │ [🟡] Lighthouse score: 78 (target: 90) — performance                   │   │
│  │ [🔴] No privacy policy page — required for GDPR compliance             │   │
│  │      [Auto-generate from AuditPolicy] [Defer]                            │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  [Deploy to Production] ← disabled if 🔴 checks present                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**API Calls (REST):**
| Method | Path | Request DTO | Response DTO |
|--------|------|-------------|--------------|
| `POST` | `/api/v1/projects/{project_id}/deploy` | `DeployRequest` { target, environment_variables, domain, ssl } | `DeployStart` { deployment_id, preview_url, status } |
| `GET` | `/api/v1/projects/{project_id}/deploy/status` | — | `DeployStatus` { status, build_logs, health_checks, url } |

**WebSocket Events:**
| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| S→C | `DEPLOYING` | `{ deployment_id, stage: "building" }` | Deploy progress |
| S→C | `DEPLOYED` | `{ url, qr_code_url }` | Deploy complete |

---

### 16.2 Screen: Deployment Complete

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │         [🎉 48px]                                                      │   │
│  │         Deployment Complete                                            │   │
│  │                                                                      │   │
│  │         https://dental-saas-mvp.vercel.app                             │   │
│  │         [📋 Copy]                                                      │   │
│  │                                                                      │   │
│  │         ┌─────────────┐                                              │   │
│  │         │ ▄▄▄▄▄▄▄▄▄▄▄ │  ← QR Code 160x160                           │   │
│  │         │ █ ▄▄▄ █ ▀▄ │                                              │   │
│  │         │ █ █▄▀ █ ▄▀ │                                              │   │
│  │         │ █ ▀▄▄ █▄▄▄ │                                              │   │
│  │         └─────────────┘                                              │   │
│  │                                                                      │   │
│  │         [Open App]  [Share]  [View Audit Trail]                      │   │
│  │                                                                      │   │
│  │         Export Artifacts:                                             │   │
│  │         [Download Decision Ledger JSON] [Download RBAC Model JSON]     │   │
│  │         [Download Audit Trail Markdown] [Download Workspace ZIP]       │   │
│  │                                                                      │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│  480px modal, z:1000, backdrop rgba(15,23,42,0.5)                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**API Calls (REST):**
| Method | Path | Request DTO | Response DTO |
|--------|------|-------------|--------------|
| `GET` | `/api/v1/projects/{project_id}/ledger` | `LedgerQuery` | `DecisionLedger` { entries, total_count } |
| `GET` | `/api/v1/projects/{project_id}/audit` | `AuditQuery` | `AuditTrail` { events, total_count } |
| `GET` | `/api/v1/blueprint/{project_id}` | — | `ProjectBlueprint` (full JSON export) |

**WebSocket Events:**
| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| S→C | `PIPELINE_COMPLETE` | `PipelineCompletion` { project_id, committed_nodes, decision_ledger, rbac_model, workspace_manifest, runtime_report } | All stages done |

---

## 17. Cross-Cutting Screens (Accessible at Any Stage)

### 17.1 Screen: Blueprint Graph (What-If Mode)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Blueprint Graph — What-If Mode          [Exit] [Reset] [Commit] [BALANCED] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                    [⬡] Patient (Actor)                                     │
│                        │                                                    │
│                        ▼                                                    │
│              ┌─────────────────┐                                            │
│              │ [◆] Booking     │  ← dragged from "Must Have"               │
│              │   (Capability)  │     to "Nice to Have"                      │
│              │   [Must Have]   │     drop zone: dashed #F59E0B              │
│              └─────────────────┘                                            │
│                    │                                                        │
│                    ▼                                                        │
│              [⬭] Schedule (Use Case) — AFFECTED                              │
│                    │                                                        │
│              ┌─────┴─────┐                                                  │
│              ▼           ▼                                                  │
│         [▭] APPT-001  [▭] APPT-002 — AFFECTED                               │
│              │                                                        │
│         [▱] task-1   [▱] task-2 — AFFECTED                                  │
│              │                                                        │
│         [▯] appts.ts  [▯] auth.ts — AFFECTED                                 │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │  Impact Simulation Overlay                                             │   │
│  │  Node: CAP-BOOK-001 → Priority: nice_to_have                           │   │
│  │  Affected downstream: 12 nodes                                         │   │
│  │  🟢 Success: 3  │  🟡 Warning: 7  │  🔴 Error: 2                        │   │
│  │  Files to regenerate: 4                                                  │   │
│  │  Est. time: ~6 minutes                                                   │   │
│  │  [Recalculate] [Commit Change] [Discard]                             │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Layer filters: [Actors ✓] [Caps ✓] [Stories ✓] [Tasks ✓] [Files ✓]      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**API Calls (REST):**
| Method | Path | Request DTO | Response DTO |
|--------|------|-------------|--------------|
| `GET` | `/api/v1/projects/{project_id}/graph` | `GraphQuery` { node_types, layers, depth } | `GraphData` { nodes, edges, metadata } |
| `POST` | `/api/v1/projects/{project_id}/graph/what-if` | `WhatIfRequest` { node_id, proposed_changes } | `WhatIfResult` { affected_nodes, severity_breakdown, files_to_regenerate } |

**WebSocket Events:**
| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| C→S | `GRAPH_NODE_SELECT` | `{ node_id }` | Focus node |
| C→S | `GRAPH_NODE_STEER` | `{ node_id, instruction }` | Steer from graph |
| C→S | `WHAT_IF_SIMULATE` | `WhatIfRequest` | Run simulation |
| S→C | `WHAT_IF_RESULT` | `WhatIfResult` | Simulation done |
| S→C | `GRAPH_UPDATE` | `{ nodes_added, nodes_removed, nodes_modified }` | Graph changed |

---

### 17.2 Screen: Audit Panel (Decision Ledger + Audit Trail)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Audit Panel              [Decision Ledger | Audit Trail]  [Export JSON]     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Decision Ledger                                                            │
│  ● DEC-045  S3  React → Next.js revision        2h ago    [🟢 active]       │
│  ● DEC-044  S3  PostgreSQL selected             2h ago    [🟢 active]       │
│  ● DEC-043  S2  InsuranceVerifier added          3h ago    [🟢 active]       │
│  ○ DEC-042  S2  Original actor selection       3h ago    [🟢 superseded]    │
│  ● DEC-041  S1  AWS ECS hosting selected         3h ago    [🟢 active]       │
│                                                                             │
│  Expanded DEC-045:                                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ { "decision": "tech_stack_selection", "option_id": "TS-003", ... }    │   │
│  │ Revision chain: Superseded by none                                     │   │
│  │ Impact: 47 nodes affected, 12 files regenerated, ~8 min                │   │
│  │ [Initiate Revision] [View Impact Graph] [View Code Diff]                │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Audit Trail (filtered by: action=steering, stage=3)                        │
│  [steering] S3  Selected Next.js framework      14:32:01  by: architect    │
│  [codegen]  S8  Generated Login.tsx             14:45:22  by: system       │
│  [steering] S3  Modified auth capability        15:01:15  by: architect    │
│    [View Diff] ← before/after modal                                        │
│                                                                             │
│  Search: [Show me all auth layer decisions...]  ← semantic search           │
│  [🟢] ContextAgent: Found 12 decisions, 8 files, 24 audit events            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**API Calls (REST):**
| Method | Path | Request DTO | Response DTO |
|--------|------|-------------|--------------|
| `GET` | `/api/v1/projects/{project_id}/ledger` | `LedgerQuery` { status, stage, layer, search, limit } | `DecisionLedger` { entries, total_count, revision_budget_remaining } |
| `GET` | `/api/v1/projects/{project_id}/ledger/{entry_id}` | — | `DecisionEntry` |
| `POST` | `/api/v1/projects/{project_id}/ledger/revision` | `RevisionRequest` { original_decision_id, new_choice, rationale } | `RevisionResult` { revision_id, impact_report_id, budget_remaining } |
| `POST` | `/api/v1/projects/{project_id}/ledger/revert` | `RevertRequest` { target_decision_id, rationale } | `RevertResult` |
| `GET` | `/api/v1/projects/{project_id}/audit` | `AuditQuery` { session_id, actor_id, action, stage, from_date, to_date } | `AuditTrail` { events, total_count, storage_used } |

**WebSocket Events:**
| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| S→C | `DECISION_LOGGED` | `DecisionEntry` | New decision |
| S→C | `DECISION_SUPERSEDED` | `{ old_id, new_id }` | Decision revised |
| S→C | `DECISION_REVERTED` | `{ reverted_to_id, new_entry_id }` | Decision reverted |
| S→C | `AUDIT_EVENT_WRITTEN` | `AuditEvent` | New audit event |
| S→C | `REVISION_BUDGET_EXHAUSTED` | `{ budget_id, decision_point }` | Budget gone |
| C→S | `AUDIT_FILTER` | `AuditQuery` | Filter request |
| C→S | `REVISION_REQUEST` | `RevisionRequest` | Request revision |

---

### 17.3 Screen: Command Palette

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │  🔍 Type a command or search...                             [✕]        │   │
│  ├────────────────────────────────────────────────────────────────────────┤   │
│  │  NAVIGATION                                                            │   │
│  │  > Open Steering Panel (Stage 6)              ⌘⇧S                    │   │
│  │  > Open Audit Panel                             ⌘⇧A                    │   │
│  │  > Open Blueprint Graph                         ⌘⇧G                    │   │
│  │  > Open Terminal                                ⌘⇧T                    │   │
│  │                                                                        │   │
│  │  ACTIONS                                                               │   │
│  │  > /steer — Modify current node                 ⌘⇧P                    │   │
│  │  > /revert — Revert last decision               ⌘⇧R                    │   │
│  │  > /checkpoint — Create named checkpoint        ⌘⇧C                    │   │
│  │  > /why — Query ContextAgent                    ⌘⇧W                    │   │
│  │                                                                        │   │
│  │  RECENT                                                                │   │
│  │  > Why did you pick PostgreSQL over DynamoDB?                        │   │
│  │  > Compare bookmarked hosting options                                  │   │
│  │  > What is the impact of removing InsuranceVerifier?                   │   │
│  │                                                                        │   │
│  │  Selected: bg:#F8FAFC, 2px left border #2563EB                        │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│  640px wide, z:100, fuzzy search, ArrowUp/Down navigation                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**API Calls (REST):**
| Method | Path | Request DTO | Response DTO |
|--------|------|-------------|--------------|
| `GET` | `/api/v1/projects/{project_id}/commands` | `CommandQuery` { query, context } | `CommandList` { commands[] } |
| `POST` | `/api/v1/projects/{project_id}/commands/execute` | `CommandExecute` { command_id, args, context } | `CommandResult` |

**WebSocket Events:**
| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| C→S | `CHAT_MESSAGE` | `ChatMessage` (command type) | Execute command |
| S→C | `CHAT_RESPONSE` | `ChatMessage` | System reply |

---

### 17.4 Screen: Checkpoint Restore

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Checkpoint Timeline                     [Create Now] [Restore Selected]      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ●───●───●───●───●───●───●───●───●───●                                     │
│  S0   S1   S2   S3   S4   S5   S6   S7   S8   S9                           │
│  │    │    │    │    │    │    │    │    │    │                            │
│  ▼    ▼    ▼    ▼    ▼    ▼    ▼    ▼    ▼    ▼                            │
│ [✓]  [✓]  [✓]  [✓]  [✓]  [✓]  [✓]  [○]  [○]  [○]                          │
│       │         │              │         │                                  │
│       ●         ●              ●         ●                                  │
│    checkpoint-1 checkpoint-2 checkpoint-3 checkpoint-4                     │
│    (manual)     (auto)        (manual)      (auto)                        │
│                                                                             │
│  Selected: checkpoint-3 (Stage 5, manual, 24 nodes)                          │
│  Created: 2024-06-19 15:45:22 by: architect                                  │
│  Stage: 5 — Story Decomposition                                              │
│  Decision Ledger: DEC-001 through DEC-028                                    │
│  [Preview State] [Export Snapshot] [Restore to This Point]                 │
│                                                                             │
│  ⚠️ Restoring will discard all progress after Stage 5.                     │
│  Type "RESTORE CHECKPOINT-3" to confirm: [________________]                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**API Calls (REST):**
| Method | Path | Request DTO | Response DTO |
|--------|------|-------------|--------------|
| `GET` | `/api/v1/projects/{project_id}/checkpoints` | — | `CheckpointList` { checkpoints[] } |
| `POST` | `/api/v1/projects/{project_id}/checkpoints` | `CreateCheckpointRequest` { label, include_workspace } | `Checkpoint` |
| `POST` | `/api/v1/projects/{project_id}/checkpoints/restore` | `RestoreCheckpointRequest` { checkpoint_id, safety_phrase, discard_after } | `RestoreResult` |

**WebSocket Events:**
| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| S→C | `CHECKPOINT_CREATED` | `Checkpoint` | New checkpoint |
| S→C | `CHECKPOINT_RESTORED` | `{ checkpoint_id, restored_from_state }` | Restored |
| C→S | `CHECKPOINT_REQUEST` | `{ action: "create" \| "restore", checkpoint_id }` | Manual checkpoint |
| C→S | `CHECKPOINT_RESTORE_REQUEST` | `RestoreCheckpointRequest` | Restore request |

---

## 18. Master Navigation Matrix: Stage 3 → 4 → 5 → 6 → 7

| Step | Source Screen | Action | Target Screen | Trigger Event | API Call |
|------|---------------|--------|---------------|---------------|----------|
| 3→4 | Stage 3 Steering | Click [Approve All] | Stage 4 Streaming | `STEERING_ACTION` { stage: 3 } | `POST /steering` |
| 3→4 | Backend | LLM streams use cases | Stage 4 Steering | `CHUNK_STREAM` + `STEERING_PANEL_READY` | WS |
| 4→5 | Stage 4 Steering | Click [Approve All] | Stage 5 Streaming | `STEERING_ACTION` { stage: 4 } | `POST /steering` |
| 4→5 | Backend | LLM streams stories | Stage 5 Steering | `CHUNK_STREAM` + `STEERING_PANEL_READY` | WS |
| 5→6 | Stage 5 Steering | Click [Approve All] | Stage 6 Streaming | `STEERING_ACTION` { stage: 5 } | `POST /steering` |
| 5→6 | Backend | LLM streams tasks | Stage 6 Steering | `CHUNK_STREAM` + `STEERING_PANEL_READY` | WS |
| 6→7 | Stage 6 Steering | Click [Approve All] | Stage 7 Gate | `STEERING_ACTION` { stage: 6 } | `POST /steering` |
| 6→7 | Backend | Validation engine runs | Completeness Gate | `STATE_TRANSITION` → `FINAL_GATE` | WS |
| 7→8 | Completeness Gate | Click [Generate Code] | Stage 8 Code Gen | `STEERING_ACTION` { stage: 7 } or implicit | `POST /generate` |
| Any | Any Stage | `/steer` in Chat | Current Stage Steering | `MID_STAGE_STEER` | WS |
| Any | Any Stage | `/revert` in Chat | Audit + Revert Modal | `REVISION_REQUEST` | WS |
| Any | Any Stage | `/checkpoint` in Chat | Checkpoint Restore | `CHECKPOINT_RESTORE_REQUEST` | WS |
| Any | Any Stage | Bookmark | Bookmark Comparison | `BOOKMARK_TOGGLE` | WS |
| Any | Any Stage | What-If drag | Blueprint Graph Sandbox | `WHAT_IF_SIMULATE` | WS + `POST /graph/what-if` |

---

## 19. Master API & Event Summary Table

### 19.1 REST API Calls by Stage

| Stage | Screen | Method | Path | Request DTO | Response DTO |
|-------|--------|--------|------|-------------|--------------|
| Login | Persona Selection | `POST` | `/api/v1/auth/login` | `LoginRequest` | `LoginResponse` |
| Login | Persona Selection | `GET` | `/api/v1/auth/me` | — | `UserProfile` |
| Dashboard | Project List | `GET` | `/api/v1/projects` | `ProjectListQuery` | `ProjectList` |
| Dashboard | New Project | `POST` | `/api/v1/projects` | `CreateProjectRequest` | `Project` |
| Dashboard | Resume | `POST` | `/api/v1/projects/{id}/resume` | — | `SessionState` |
| Landing | Submit Input | `POST` | `/api/v1/projects/{id}/input` | `RawUserInput` | `InputAccepted` |
| Landing | Upload PRD | `POST` | `/api/v1/projects/{id}/upload` | `MultipartFile` | `FileUploadResult` |
| Landing | Git Connect | `POST` | `/api/v1/projects/{id}/git-connect` | `GitConnectRequest` | `GitConnectResult` |
| Classification | Override | `POST` | `/api/v1/projects/{id}/classification/override` | `ClassificationOverride` | `ClassificationResult` |
| PRD Analysis | Get State | `GET` | `/api/v1/projects/{id}/state` | — | `PipelineState` |
| Scale | Submit Scale | `POST` | `/api/v1/projects/{id}/scale` | `ScaleInputs` | `ScaleValidationResult` |
| Scale | Get Options | `GET` | `/api/v1/projects/{id}/scale/options` | `ScaleInputs` | `HostingOptionsMatrix` |
| Hosting | Select | `POST` | `/api/v1/projects/{id}/infrastructure/select` | `HostingSelection` | `InfrastructureProfile` |
| Hosting | Get Profile | `GET` | `/api/v1/projects/{id}/infrastructure` | — | `InfrastructureProfile` |
| Tech Stack | Select | `POST` | `/api/v1/projects/{id}/tech-stack/select` | `TechStackSelection` | `TechStackProfile` |
| Tech Stack | Get Profile | `GET` | `/api/v1/projects/{id}/tech-stack` | — | `TechStackProfile` |
| Steering (all) | Get Panel | `GET` | `/api/v1/projects/{id}/steering/{stage_id}` | — | `SteeringPanel` |
| Steering (all) | Submit | `POST` | `/api/v1/projects/{id}/steering` | `SteeringAction` | `SteeringResult` |
| RBAC | Get Model | `GET` | `/api/v1/projects/{id}/rbac` | — | `RBACModel` |
| RBAC | Update | `POST` | `/api/v1/projects/{id}/rbac` | `RBACModelUpdate` | `RBACModel` |
| RBAC | Validate | `POST` | `/api/v1/projects/{id}/rbac/validate` | — | `RBACValidationResult` |
| RBAC | Commit | `POST` | `/api/v1/projects/{id}/rbac/commit` | `RBACCommitRequest` | `RBACCommitResult` |
| Node CRUD | Get Node | `GET` | `/api/v1/projects/{id}/nodes/{node_id}` | — | `Node` |
| Node CRUD | Create | `POST` | `/api/v1/projects/{id}/nodes` | `CreateNodeRequest` | `Node` |
| Node CRUD | Update | `PUT` | `/api/v1/projects/{id}/nodes/{node_id}` | `UpdateNodeRequest` | `Node` |
| Node CRUD | Delete | `DELETE` | `/api/v1/projects/{id}/nodes/{node_id}` | `DeleteNodeRequest` | `{ deleted }` |
| Node CRUD | Enrich | `POST` | `/api/v1/projects/{id}/nodes/{node_id}/enrich` | `EnrichRequest` | `EnrichResult` |
| Node CRUD | Validate | `POST` | `/api/v1/projects/{id}/nodes/{node_id}/validate` | — | `ValidationResult` |
| Code Gen | Start | `POST` | `/api/v1/projects/{id}/generate` | `CodeGenRequest` | `CodeGenStart` |
| Code Gen | Status | `GET` | `/api/v1/projects/{id}/generate/status` | — | `CodeGenStatus` |
| Workspace | List Files | `GET` | `/api/v1/projects/{id}/workspace/files` | `FileListQuery` | `FileTree` |
| Workspace | Read File | `GET` | `/api/v1/projects/{id}/workspace/file` | `FileReadRequest` | `FileContent` |
| Workspace | Diff | `GET` | `/api/v1/projects/{id}/workspace/diff` | `DiffRequest` | `DiffResult` |
| Workspace | Merge | `POST` | `/api/v1/projects/{id}/workspace/merge` | `MergeRequest` | `MergeResult` |
| Runtime | Start | `POST` | `/api/v1/projects/{id}/runtime/start` | `RuntimeStartRequest` | `RuntimeStartResult` |
| Runtime | Status | `GET` | `/api/v1/projects/{id}/runtime/status` | — | `RuntimeStatus` |
| Runtime | Command | `POST` | `/api/v1/projects/{id}/runtime/command` | `RuntimeCommand` | `RuntimeCommandResult` |
| Tests | Run | `POST` | `/api/v1/projects/{id}/tests/run` | `TestRunRequest` | `TestRunResult` |
| Tests | List | `GET` | `/api/v1/projects/{id}/tests` | `TestListQuery` | `TestList` |
| Graph | Get Graph | `GET` | `/api/v1/projects/{id}/graph` | `GraphQuery` | `GraphData` |
| Graph | What-If | `POST` | `/api/v1/projects/{id}/graph/what-if` | `WhatIfRequest` | `WhatIfResult` |
| Audit | Get Ledger | `GET` | `/api/v1/projects/{id}/ledger` | `LedgerQuery` | `DecisionLedger` |
| Audit | Get Entry | `GET` | `/api/v1/projects/{id}/ledger/{entry_id}` | — | `DecisionEntry` |
| Audit | Revision | `POST` | `/api/v1/projects/{id}/ledger/revision` | `RevisionRequest` | `RevisionResult` |
| Audit | Revert | `POST` | `/api/v1/projects/{id}/ledger/revert` | `RevertRequest` | `RevertResult` |
| Audit | Get Trail | `GET` | `/api/v1/projects/{id}/audit` | `AuditQuery` | `AuditTrail` |
| Checkpoint | List | `GET` | `/api/v1/projects/{id}/checkpoints` | — | `CheckpointList` |
| Checkpoint | Create | `POST` | `/api/v1/projects/{id}/checkpoints` | `CreateCheckpointRequest` | `Checkpoint` |
| Checkpoint | Restore | `POST` | `/api/v1/projects/{id}/checkpoints/restore` | `RestoreCheckpointRequest` | `RestoreResult` |
| Deploy | Start | `POST` | `/api/v1/projects/{id}/deploy` | `DeployRequest` | `DeployStart` |
| Deploy | Status | `GET` | `/api/v1/projects/{id}/deploy/status` | — | `DeployStatus` |
| Export | Blueprint | `GET` | `/api/v1/blueprint/{project_id}` | — | `ProjectBlueprint` |
| Command | List | `GET` | `/api/v1/projects/{id}/commands` | `CommandQuery` | `CommandList` |
| Command | Execute | `POST` | `/api/v1/projects/{id}/commands/execute` | `CommandExecute` | `CommandResult` |

### 19.2 WebSocket Events by Stage

| Stage | Direction | Event | Payload | Trigger |
|-------|-----------|-------|---------|---------|
| All | C→S | `AUTH_SESSION_INIT` | `{ session_id, token }` | WS connect |
| All | S→C | `AUTH_SESSION_OK` | `{ user }` | Auth confirmed |
| All | S→C | `AUTH_SESSION_EXPIRED` | `{ reason }` | Token expiry |
| Landing | C→S | `USER_INPUT` | `RawUserInput` | Submit input |
| Landing | S→C | `INPUT_PROCESSING_STARTED` | `{ input_id, steps }` | Processing begins |
| Landing | S→C | `PROCESSING_STEP_COMPLETE` | `{ step_index, progress }` | Step done |
| Landing | S→C | `RICHNESS_MODE_DETECTED` | `RichnessClassification` | Classification |
| Landing | S→C | `PRD_ANALYSIS_READY` | `PRDAnalysisReport` | PRD parsed |
| Landing | S→C | `COMPLIANCE_DETECTED` | `ComplianceDetectionResult` | Frameworks found |
| Scale | S→C | `SCALE_INPUT_CONFLICT` | `ScaleInputConflict` | Validation fail |
| Scale | S→C | `HOSTING_OPTIONS_READY` | `HostingOptionsMatrix` | Options ready |
| Scale | C→S | `HOSTING_SELECTION` | `HostingSelection` | User selects |
| Scale | S→C | `INFRASTRUCTURE_PROFILE_STALE` | `{ stale: true }` | Inputs changed |
| Tech Stack | S→C | `TECH_STACK_OPTIONS_READY` | `TechStackOptionsMatrix` | Options ready |
| Tech Stack | C→S | `TECH_STACK_SELECTION` | `TechStackSelection` | User selects |
| Actor | S→C | `STEERING_PANEL_READY` | `SteeringPanel` | Stage 2 boundary |
| Actor | C→S | `STEERING_ACTION` | `SteeringAction` | User decision |
| Actor | S→C | `NODE_COMMITTED` | `CommittedNode` | Actor confirmed |
| RBAC | S→C | `RBAC_MODEL_READY` | `RBACModel` | Model generated |
| RBAC | S→C | `PRIVILEGE_ESCALATION_FLAGGED` | `EscalationPath` | Escalation detected |
| RBAC | S→C | `RBAC_INHERITANCE_CYCLE_DETECTED` | `{ cycle_path }` | Cycle blocked |
| RBAC | C→S | `RBAC_STEERING_ACTION` | `{ target, action_type, payload }` | RBAC edit |
| Capability | S→C | `STEERING_PANEL_READY` | `SteeringPanel` | Stage 3 boundary |
| Capability | C→S | `STEERING_ACTION` | `SteeringAction` | User decision |
| Capability | C→S | `BOOKMARK_TOGGLE` | `BookmarkToggle` | Bookmark option |
| Use Case | C→S | `NODE_MANIPULATION` | `{ action, node_type, node_id, data }` | CRUD |
| Use Case | S→C | `NODE_UPDATED` | `{ node_id, changes }` | Update confirmed |
| Use Case | S→C | `USER_OPTION_INCOHERENT` | `{ failure_reason }` | Validation fail |
| Story | C→S | `NODE_MANIPULATION` | `{ action, node_type, node_id, data }` | CRUD |
| Story | S→C | `NODE_ENRICHED` | `EnrichResult` | Enrichment applied |
| Task | S→C | `STEERING_PANEL_READY` | `SteeringPanel` | Stage 6 boundary |
| Task | C→S | `STEERING_ACTION` | `SteeringAction` | User decision |
| Task | S→C | `REVISION_BUDGET_EXHAUSTED` | `{ budget_id }` | Budget gone |
| Task | S→C | `IMPACT_REPORT_READY` | `ImpactReport` | Revision impact |
| Gate | S→C | `STEERING_REQUIRED` | `{ stage: 7, reason }` | Gate blocked |
| Gate | C→S | `NODE_MANIPULATION` | `{ action: "edit", node_id }` | Fix error |
| Code Gen | S→C | `CODE_GENERATION_STARTED` | `CodeGenStart` | Stage 8 begins |
| Code Gen | S→C | `CODE_FILE_STREAM` | `CodeFileChunk` | File chunk |
| Code Gen | S→C | `CODE_FILE_COMPLETE` | `GeneratedFile` | File done |
| Code Gen | S→C | `CODE_GENERATION_COMPLETE` | `WorkspaceManifest` | Stage 8 done |
| Code Gen | S→C | `DEPENDENCY_INSTALL_STATUS` | `DependencyInstallStatus` | Install progress |
| Code Gen | C→S | `CODE_FILE_STEER` | `{ file_path, action, instruction }` | File steer |
| Code Gen | C→S | `MID_STAGE_STEER` | `{ instruction, action_type: "pause" }` | Pause |
| Code Gen | C→S | `EDITOR_CHANGE` | `{ file_path, change_event }` | User edit |
| Code Gen | S→C | `MERGE_CONFLICT` | `MergeConflictInfo` | Conflict detected |
| Code Gen | C→S | `RESOLVE_CONFLICT` | `{ conflict_id, resolution }` | Resolve conflict |
| Runtime | S→C | `RUNTIME_STARTED` | `{ preview_url, sandbox_id }` | Sandbox ready |
| Runtime | S→C | `RUNTIME_LOG` | `{ stream, content }` | Runtime output |
| Runtime | S→C | `HOT_RELOAD` | `{ file_path, reload_type }` | HMR |
| Runtime | S→C | `TEST_RESULT_STREAM` | `TestResult` | Test result |
| Runtime | S→C | `TEST_RUN_COMPLETED` | `TestSummary` | Suite done |
| Runtime | C→S | `PREVIEW_FEEDBACK` | `PreviewFeedback` | User feedback |
| Runtime | C→S | `PREVIEW_INTERACTIVE_ELEMENT` | `{ selector, component_path }` | Click detect |
| Runtime | C→S | `RUNTIME_COMMAND` | `RuntimeCommand` | Shell command |
| Runtime | C→S | `TEST_RERUN` | `{ test_id }` | Re-run test |
| Runtime | C→S | `TEST_DEBUG` | `{ test_id }` | Debug test |
| Deploy | S→C | `DEPLOYING` | `{ deployment_id, stage }` | Deploy progress |
| Deploy | S→C | `DEPLOYED` | `{ url, qr_code_url }` | Deploy complete |
| Graph | C→S | `GRAPH_NODE_SELECT` | `{ node_id }` | Focus node |
| Graph | C→S | `GRAPH_NODE_STEER` | `{ node_id, instruction }` | Steer node |
| Graph | C→S | `WHAT_IF_SIMULATE` | `WhatIfRequest` | Simulate |
| Graph | S→C | `WHAT_IF_RESULT` | `WhatIfResult` | Simulation done |
| Graph | S→C | `GRAPH_UPDATE` | `{ nodes, edges }` | Graph changed |
| Audit | S→C | `DECISION_LOGGED` | `DecisionEntry` | New decision |
| Audit | S→C | `DECISION_SUPERSEDED` | `{ old_id, new_id }` | Revised |
| Audit | S→C | `DECISION_REVERTED` | `{ reverted_to_id }` | Reverted |
| Audit | S→C | `AUDIT_EVENT_WRITTEN` | `AuditEvent` | New event |
| Audit | C→S | `AUDIT_FILTER` | `AuditQuery` | Filter request |
| Audit | C→S | `REVISION_REQUEST` | `RevisionRequest` | Request revision |
| Checkpoint | S→C | `CHECKPOINT_CREATED` | `Checkpoint` | New checkpoint |
| Checkpoint | S→C | `CHECKPOINT_RESTORED` | `{ checkpoint_id }` | Restored |
| Checkpoint | C→S | `CHECKPOINT_REQUEST` | `{ action, checkpoint_id }` | Manage |
| Global | S→C | `PIPELINE_STATE_CHANGED` | `PipelineState` | State change |
| Global | S→C | `STATE_TRANSITION` | `{ from_state, to_state, reason }` | FSM transition |
| Global | S→C | `ERROR` | `PipelineError` | General error |
| Global | S→C | `LLM_FAILURE` | `LLMFailure` | LLM-specific |
| Global | S→C | `TOAST_NOTIFICATION` | `ToastNotification` | Toast push |
| Global | S→C | `BROWSER_TAB_UPDATE` | `{ title }` | Tab title |
| Global | S→C | `SESSION_TIMEOUT_WARNING` | `{ minutes_remaining }` | Timeout warn |
| Global | S→C | `SESSION_EXPIRED` | `{ recovery_available }` | Expired |
| Global | S→C | `PIPELINE_COMPLETE` | `PipelineCompletion` | All done |

### 19.3 SSE Streams by Stage

| Stage | Endpoint | Events | Description |
|-------|----------|--------|-------------|
| Input Processing | `GET /input/{id}/progress` | `step`, `classification` | Processing progress |
| Chat | `GET /chat/stream` | `message_start`, `delta`, `intent_detected`, `message_end` | Streaming chat |
| File Generation | `GET /workspace/stream` | `file_start`, `file_chunk`, `file_complete` | Code streaming |
| Runtime Logs | `GET /runtime/logs` | `log`, `status` | Runtime output |

---

*End of Merged Architect Journey Wireframes & Event Contract*