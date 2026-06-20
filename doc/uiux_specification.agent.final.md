# Collaborative Steering Pipeline — UI/UX Specification Document

**Version:** 1.0  
**Status:** Draft  
**Date:** 2026-06-19  
**Classification:** Internal — Design & Engineering Reference  
**PRD Cross-Reference:** Collaborative Steering Pipeline PRD v3.1

---

# 1. Introduction & Document Scope

## 1.1 Purpose and Authority

This document is the authoritative UI/UX design specification for the Collaborative Steering Pipeline IDE frontend. It is the single normative reference for all interface design decisions, interaction patterns, visual system parameters, and panel behaviors in the React-based IDE shell. Every frontend component — Chat Panel, Steering Panel, File Explorer, Editor, Live Preview, Terminal, Test Results, Blueprint Graph, and Audit Panel — shall derive its layout, state behavior, and event contract from this specification.

The scope covers all user-facing surfaces: panels, interactions, states, and the visual design system. Cross-cutting concerns — animation timing, color application, responsive breakpoints, accessibility, and persona-based abstraction — are specified in dedicated sections following this introduction.

Cross-references to PRD v3.1 are maintained throughout: Section 16 (User Stories) defines persona classes that drive panel prioritization; Section 17 (Acceptance Criteria) supplies the `AC-XX-XX` tags attached to every normative requirement; Section 22 (IDE Interface Specification) defines functional requirements (`FR-IDE-XX`) and panel event contracts that this document renders into concrete visual and interaction specifications.

| PRD Section | Content | Tag Format |
|---|---|---|
| 16 — User Stories | Persona narratives (PM, Architect, Eng Lead, Security, Power User, Citizen Developer, Founder) | `US-[role]-[NN]` |
| 17 — Acceptance Criteria | Verifiable conditions across all domains | `AC-[domain]-[NN]` |
| 22 — IDE Interface Spec | Functional requirements, layout, patterns, shortcuts | `FR-IDE-[NN]` |

## 1.2 Design Philosophy

**"What vs. How" separation.** Users express intent through natural language ("what"); the system generates implementation ("how"). The interface shall never require users to specify implementation details — file names, dependency versions, API structures — unless they explicitly override a system decision. This governs Chat Panel prompts, Steering Panel option presentations, and Provenance Tooltip explanations.

**Chat-first interaction paradigm.** The Chat Panel is the default and primary input surface. Every session opens with a blank chat input and the prompt: *"Describe what you want to build..."* All other panels are contextual surfaces that open in response to chat-driven events or backend state transitions. Chat history serves as project memory: searchable, versioned, and linked to the Decision Ledger. Referenced by: `FR-IDE-01` through `FR-IDE-05`.

**Progressive disclosure.** Interface complexity scales with user expertise via a persona-based abstraction layer. The `Citizen Developer` persona hides Audit Panel and Blueprint Graph, replaces them with a "Plain English Decision Summarizer," and renders action labels in natural language (`[Looks good!]` vs. `[Accept]`). The `Developer / Architect` persona unlocks all technical panels, raw JSON views, and field-level diffs. Persona is selected at login and changeable mid-session via `Ctrl/Cmd + Shift + P`. Referenced by: `FR-IDE-19`, Section 22.11.

**Zero silent defaults.** Every system action requires explicit user consent, reflected in persistent visual affordances. The state machine enforces this at the protocol level — no stage advances without a `STEERING_ACTION` event — and the IDE renders it as visible pause states, pending-node badges, and confirmation dialogs. Trust Modes (`PARANOID`, `BALANCED`, `AUTO_PILOT`) modulate interruption frequency but never eliminate the consent requirement. Referenced by: `AC-NF-01` through `AC-NF-07`, `AC-ST-01`.

## 1.3 Document Conventions

**ASCII wireframe notation and panel dimension conventions.** Layout diagrams use ASCII box-drawing characters (`┌─┐│└┘`). Dimensions are in CSS pixels (px) for fixed chrome and percentages or flex fractions for responsive regions. The base IDE viewport assumes 1440px × 900px; responsive behavior below 1280px width is noted where applicable. Color references use the semantic palette defined in Section 3 (Design Tokens).

**State notation: [State Name] with entry/exit conditions.** Interface states are written in bracketed Pascal case (e.g., `[AWAITING_STEERING]`, `[STREAMING_CHUNKS]`). Each state specification includes: entry condition (triggering event or action), visual manifestation (UI change), and exit condition (transitioning event). This aligns with the backend state machine defined in PRD Section 7 and consumed via `STATE_TRANSITION` WebSocket events.

**Cross-reference tags linking to PRD acceptance criteria (AC-XX-XX).** Every normative statement carries a cross-reference tag to its originating PRD acceptance criterion (`AC-[domain]-[NN]`). Functional requirement tags use the format `FR-IDE-[NN]` for traceability to PRD Section 22. Where a specification point aggregates multiple AC items, all relevant tags are listed.

# 2. User Personas & Journey Maps

This chapter defines the three primary user personas governing all IDE interface decisions. Every panel visibility rule, trust mode default, language abstraction layer, and interaction pattern in subsequent chapters derives from the boundaries established here. Each persona includes a flow-style journey map with emotional state indicators, a precise UI mode specification, and cross-references to source PRD user stories and acceptance criteria.

---

## 2.1 Persona: Citizen Developer / Non-Technical Founder

### 2.1.1 Demographics, Technical Literacy, Goals, and Pain Points

This composite persona merges PRD Section 16.6 (Citizen Developer) and Section 16.7 (Founder / Non-Technical).

| Attribute | Specification |
|---|---|
| **Technical literacy** | No coding experience; may understand "database" or "API" abstractly but cannot read code, JSON, or configuration files. |
| **Primary goal** | Transform a business process or SaaS idea into a deployed working application within one session (US-CD-01, US-FN-01). |
| **Secondary goal** | Validate via live end-user interaction and provide feedback in plain language (US-CD-02). |
| **Pain point — complexity anxiety** | Technical panels (raw JSON, RBAC matrices, dependency graphs) trigger abandonment anxiety; user fears "breaking something." |
| **Pain point — jargon barrier** | Terms like "Stage 3 Actor Discovery," `EngineeringTask`, `access_guards` block comprehension and erode trust (US-FN-03). |
| **Pain point — decision paralysis** | Multiple technical options cannot be evaluated; leads to random choices or session abandonment. |
| **Motivating emotion** | Excitement about rapid validation; desire for tangible progress without understanding implementation mechanics. |

**Profile:** Ages 25–50; entrepreneurs, small business owners, operations managers, product managers without engineering backgrounds. May have used no-code tools (Airtable, Zapier, Webflow). Device: desktop browser for initiation, mobile for live preview testing.

### 2.1.2 Simplified UI Mode: Hidden Technical Panels, Natural Language Translations, Plain English Decision Summaries

The `PersonaAbstractionLayer` (PRD Section 22.11) enforces a persona-gated view that suppresses all panels requiring technical literacy. Activated on persona selection at login.

**Panel visibility rules:** Audit Panel, RBAC Matrix, Blueprint Graph, and Raw JSON views are hidden. Chat Panel, File Explorer (simplified), Live Preview, and Terminal (collapsed default) remain visible with natural language abstractions.

Hidden panels are replaced by a **Plain English Decision Summarizer**. Example: instead of `RBACModel.version: 2`, the system renders: *"Permissions: Managers can see all data. Employees can only see their own. (Click to change)"*.

SteeringPanel translations: `[Accept]` → `[Looks good!]`; `[Modify]` → `[Change this...]`; `[Replace]` → `[Start over with this]`; `[Authorize]` → `[Yes, go ahead]`. Backend action codes remain unchanged.

File Explorer hover tooltips (AC-CG-10) display plain-language provenance: *"This file handles approval logic because you said managers must approve requests"* — never raw `task_id` references. Layer icons and technical folder taxonomy (e.g., `/backend/routes/`) are suppressed.

### 2.1.3 Journey Map: Discovery → First Prompt → Richness Classification → Live Preview → Iteration → Deployment

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  CITIZEN DEVELOPER — HAPPY PATH JOURNEY MAP                                         │
│  😊 positive / 😰 anxious / 😮 surprised / 😌 relieved                              │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  STEP 1: DISCOVERY                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │ Channel: Social media, referral, or search. Landing: "Describe what you    │   │
│  │ want to build..." in empty Chat Panel.                                      │   │
│  │ Emotional: 😊 Excited — "I can build this without hiring developers"        │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                          │
│                                          ▼                                          │
│  STEP 2: FIRST PROMPT                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │ Input: "I need a form where employees request time off and managers         │   │
│  │ approve it." System extracts actors (Employee, Manager), advances stage.    │   │
│  │ Emotional: 😊 Excited — system understood, no forms required                │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                          │
│                                          ▼                                          │
│  STEP 3: RICHNESS CLASSIFICATION                                                    │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │ Input classified SEED_ONLY → 3-5 clarifying questions in chat: "How many    │   │
│  │ employees?" "Email notifications?" Trust mode: PARANOID pauses each.        │   │
│  │ Emotional: 😰 Anxious (brief) → 😌 Relieved as questions feel conversational │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                          │
│                                          ▼                                          │
│  STEP 4: STEERING (SIMPLIFIED)                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │ "I recommend Next.js because it handles your website and API in one         │   │
│  │ project, saving costs. [Looks good!] [Change this...]" (US-FN-03)           │   │
│  │ Emotional: 😌 Relieved — system explains WHY, not just WHAT                 │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                          │
│                                          ▼                                          │
│  STEP 5: LIVE PREVIEW (STAGE 9)                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │ Live Preview renders login, form, approval dashboard. User clicks through   │   │
│  │ as end-user: submits request, approves as manager.                          │   │
│  │ Emotional: 😮 Surprised → 😊 Excited — "It's actually working!"             │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                          │
│                                          ▼                                          │
│  STEP 6: ITERATION                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │ Chat: "Make the button bigger" → diff preview → [Looks good!] → hot reload  │   │
│  │ (AC-CG-09: NL feedback triggers Revision Request + Impact Report preview)   │   │
│  │ Emotional: 😮 Surprised — "That was fast"                                   │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                          │
│                                          ▼                                          │
│  STEP 7: DEPLOYMENT                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │ "Your app is ready! Live URL and admin login." One-click deployment.        │   │
│  │ Emotional: 😊 Excited — "I built this" (ownership)                          │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.1.4 Key Emotional States: Excitement, Anxiety About Technical Complexity, Relief When System Explains Choices

The emotional arc follows: excitement → anxiety at technical complexity → relief at explanation → delight at live preview. The Simplified UI mode prevents the anxiety spike by eliminating technical surfaces entirely.

| Trigger | Interface Response | Emotional Target |
|---|---|---|
| First steering decision | Plain English explanation of what and why | 😰 → 😌 |
| `SEED_ONLY` classification | Conversational questions, not forms | 😰 → 😊 |
| Live Preview first render | Immediate end-user functionality | 😰 → 😮 |
| Revision request | NL diff preview before any code visible | 😰 → 😌 |
| Error or failure | "Let's try a different approach" — never stack traces | 😰 → 😌 |

---

## 2.2 Persona: Power User / Architect

### 2.2.1 Demographics, Technical Depth, Goals, and Expectations

This composite persona draws from PRD Section 16.2 (Architect) and Section 16.5 (Power User).

| Attribute | Specification |
|---|---|
| **Technical depth** | Senior/staff engineer, CTO, solutions architect. 8+ years. Reads JSON schemas, RBAC models, dependency graphs, IaC. |
| **Primary goal** | Upload a detailed PRD, steer through all nine stages with precise architectural control (US-AR-01..05, US-PU-01..04). |
| **Secondary goal** | Export Decision Ledger as version-controlled JSON (US-PU-02); manage revision budgets (US-PU-04); perform what-if analysis. |
| **Expectation — transparency** | Every decision inspectable: raw JSON, field-level diffs, exact data types, full provenance (FR-IDE-18). |
| **Expectation — granularity** | Pause, modify, bookmark, compare, branch at any stage with full impact analysis before propagation (AC-ST-03, AC-ST-05). |
| **Expectation — no hand-holding** | NL translations are friction; prefers concise technical labels. |

**Profile:** Ages 28–55; senior ICs, tech leads, startup CTOs. Daily drivers: VS Code, JetBrains, Vim. Expects keyboard shortcuts, command palettes, panel customization. Desktop with multiple monitors.

### 2.2.2 Advanced UI Mode: Full Panel Access, Raw JSON Views, RBAC Matrix, Blueprint Graph, Audit Panel, Inline Steering

Activates on "Developer / Architect" persona selection (PRD Section 22.11). All panels visible with native technical presentation.

| Panel | Presentation |
|---|---|
| Chat Panel | All message types; expandable raw event codes |
| Steering Panel | Exact field diffs, data types, `node_id`, risk classification per node |
| File Explorer | Full folder structure, layer color-coded icons, `task_id` provenance links |
| Editor (Monaco) | Syntax highlighting, `// @steering:` inline steering, live diff streaming |
| Live Preview | Sandbox with element inspector, component-to-file traceability |
| Terminal | Full shell, allowlist-guarded destructive commands |
| Test Results | Pass/fail badges, expandable stack traces |
| Blueprint Graph | Interactive 2D/3D graph, what-if drag mode, downstream impact overlay |
| Audit Panel | Full Decision Ledger + Audit Trail, all filters |
| RBAC Matrix | Permission grid with `rationale`, `decision_maker`, inheritance graph |
| Raw JSON | Unformatted `ProjectBlueprint`, `DecisionLedger`, `AuditTrail` |

SteeringPanel shows exact diffs:
```
- framework: "Express.js" (Node.js, backend)
+ framework: "Next.js" (React, fullstack)
Impact: 12 downstream tasks (3 auth, 7 frontend, 2 infra)
```

RBAC Matrix: every `RolePermissionEntry` with `granted`, `rationale`, `decision_maker`, inherited provenance (AC-RB-02, AC-RB-03). Escalation paths flagged with red `#E11D48` pre-commit.

### 2.2.3 Journey Map: PRD Upload → Validation → Stage-by-Stage Steering → Revision/Branching → Code Review → Export

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  POWER USER / ARCHITECT — FULL CONTROL JOURNEY MAP                                  │
│  😊 satisfied / 😤 frustrated / 🤔 focused / 😌 confident                           │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  STEP 1: PRD UPLOAD                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │ Uploads 50-page PRD. PRD Parser extracts actors, capabilities, NFRs;        │   │
│  │ Conflict Scanner runs. Emotional: 🤔 Focused — "Let's see real input"       │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                          │
│                                          ▼                                          │
│  STEP 2: VALIDATION (STAGE 0)                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │ PRDAnalysisReport: thin sections, conflicts, unmapped_input surfaced.       │   │
│  │ User maps unmapped sections to stages (AC-RI-05, AC-RI-06).                 │   │
│  │ Trust: BALANCED — LOW_RISK auto-approved; MEDIUM/HIGH pause.                │   │
│  │ Emotional: 😊 Satisfied — system found issues I'd miss                      │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                          │
│                                          ▼                                          │
│  STEP 3: STAGE-BY-STAGE STEERING                                                    │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │ S1: Scale Dialogue → HostingOptionsMatrix (3-6 options, cost ranges)        │   │
│  │ S2: Actor Discovery → RBAC Matrix + privilege escalation check              │   │
│  │ S3: Capability Extraction → bookmarks 2 options for comparison (US-PU-03)   │   │
│  │ S4+: Task decomposition → paginated SteeringPanel (20 nodes/page)            │   │
│  │ (AC-SC-01..08, AC-RB-01..09, AC-ST-04, AC-ST-05)                            │   │
│  │ Emotional: 🤔 Focused — evaluating trade-offs with full data                │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                          │
│                                          ▼                                          │
│  STEP 4: REVISION / BRANCHING                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │ Revises tech stack (US-AR-02): system computes full impact graph.           │   │
│  │ ImpactReport: 47 affected nodes, 3 layers, 12 files to regenerate.          │   │
│  │ Bookmarks before/after, compares side-by-side (US-PU-03).                   │   │
│  │ RevisionBudget: 3/5 remaining (US-PU-04).                                   │   │
│  │ Emotional: 😌 Confident — "I see exactly what this change costs"            │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                          │
│                                          ▼                                          │
│  STEP 5: CODE REVIEW (STAGE 8)                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │ File Explorer populates; Editor streams live. Reviews provenance headers.   │
│  │ Blueprint Graph traces node-to-file. Inline steering via `// @steering:`.   │   │
│  │ Emotional: 🤔 Focused — verifying code quality                               │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                          │
│                                          ▼                                          │
│  STEP 6: EXPORT                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │ Decision Ledger → JSON → version control (US-PU-02).                        │   │
│  │ Audit Trail → JSON + Markdown (US-SE-01). RBACModel → JSON (US-SE-01).      │   │
│  │ InfraProfile → Terraform + CI/CD YAML (AC-CG-05).                           │   │
│  │ Emotional: 😊 Satisfied — complete audit trail, nothing hidden              │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2.4 Key Workflows: Bookmark Comparison, Revision Budgeting, Checkpoint Management, What-If Analysis

**Bookmark Comparison (US-PU-03, AC-ST-05):** At any steering decision, bookmark options for side-by-side comparison via `Ctrl/Cmd + Shift + P` → "Compare Bookmarks." Cards show option name, downstream impact count, affected layers (Frontend `#2563EB`, Backend `#059669`, Database `#D97706`, Infra `#7C3AED`), cost implications. Commit directly from comparison view.

**Revision Budgeting (US-PU-04, AC-DL-04):** `RevisionBudget` default = 5. Display: segmented indicator in SteeringPanel header (5 segments, deplete on revision). At 1 remaining: amber `#F59E0B` warning. Exhausted: `RevisionBudgetExhausted` modal — extend budget (with impact warning) or commit current state.

**Checkpoint Management (AC-NF-05, AC-NF-06):** Immutable checkpoints at every stage completion. Access: `/checkpoint` or `Ctrl/Cmd + Shift + P` → "View Checkpoints." Timeline: stage name, timestamp, node count, restore button. Restoration rewinds full pipeline state. Requires typed safety phrase confirmation.

**What-If Analysis (FR-IDE-17):** Blueprint Graph toggle enters What-If mode. Dragging a node (e.g., `must_have` → `nice_to_have`) computes simulated impact without commit. Ghost overlay with severity halos: Success `#10B981` (no impact), Warning `#F59E0B` (moderate), Error `#EF4444` (breaking). Commit or discard with one click.

---

## 2.3 Persona: Security Engineer

### 2.3.1 Role Context, Compliance Requirements, and Audit Expectations

This persona derives from PRD Section 16.4 (Security Engineer), interacting primarily with the Governance Module (Section 4.4) and Audit & Recovery Module (Section 4.7).

| Attribute | Specification |
|---|---|
| **Role context** | Security engineer, compliance officer, internal auditor, or external pen-tester reviewing blueprint or codebase security posture. |
| **Primary goal** | Verify RBAC permissions have documented rationale and decision makers (US-SE-03); detect privilege escalation pre-production (US-SE-02); export audit artifacts (US-SE-01). |
| **Secondary goal** | Query audit trail by session, actor, action, timestamp (AC-AT-04); verify diff-based storage and retention compliance (US-SE-04). |
| **Compliance drivers** | GDPR, HIPAA, PCI-DSS, SOC2, ISO27001, CCPA auto-detection (Section 8.3) sets conservative `AuditPolicy` defaults (GDPR → 2555-day retention). |
| **Expectation — immutability** | Audit events never modified or deleted; corrections appear as new events (AC-AT-06). |
| **Expectation — rationale** | Every permission grant: `rationale` + `decision_maker`; every system-authorized decision: `AuditEvent` with `authorization_ref` (AC-RB-02, AC-AT-02). |

**Profile:** Ages 28–50; InfoSec professionals, compliance auditors, risk officers. Uses Splunk, Elastic Security, GRC platforms. Expects CSV/JSON export, timestamp precision, tamper-evident logging.

### 2.3.3 Journey Map: RBAC Review → Privilege Escalation Audit → Decision Ledger Export → Audit Trail Query

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  SECURITY ENGINEER — AUDIT & COMPLIANCE JOURNEY MAP                                 │
│  🔍 analytical / ⚠️ concerned / ✅ assured / 📝 thorough                            │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  STEP 1: RBAC REVIEW                                                                │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │ Audit Panel → RBAC Matrix tab. Reviews every RolePermissionEntry:           │   │
│  │ Role | Resource | Action | Granted | Rationale | Decision Maker | Version    │   │
│  │ (AC-RB-02: granted=true requires non-empty rationale)                       │   │
│  │ Emotional: 🔍 Analytical — systematic permission surface review             │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                          │
│                                          ▼                                          │
│  STEP 2: PRIVILEGE ESCALATION AUDIT                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │ STATIC_ESCALATION_ANALYSIS scans inheritance graph for escalation paths     │   │
│  │ (AC-RB-09: static analysis, documented depth, no dynamic evaluation)        │   │
│  │ Flags: red #E11D48 with path trace — "Role 'Admin' inherits 'Manager'      │   │
│  │ inherits 'Employee' → Admin gains '/api/salaries' via transitive chain"     │   │
│  │ (AC-RB-03: escalation detected before commit; US-SE-02)                     │   │
│  │ Also: inheritance cycles blocked (AC-RB-08), depth bounded to 3             │   │
│  │ (AC-RB-07, configurable to 5).                                              │   │
│  │ Emotional: ⚠️ Concerned (if flags) → 🔍 Analytical (investigating)          │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                          │
│                                          ▼                                          │
│  STEP 3: DECISION LEDGER EXPORT                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │ Export DecisionLedger as JSON (US-PU-02, US-SE-01).                         │   │
│  │ Includes: all decisions, revision chains, superseded entries, budget use.   │   │
│  │ Export RBACModel as JSON (US-SE-01, AC-RB-06).                              │   │
│  │ Format: pretty-printed JSON with schema version header.                     │   │
│  │ Emotional: ✅ Assured — complete evidence for external review               │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                          │
│                                          ▼                                          │
│  STEP 4: AUDIT TRAIL QUERY                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │ Audit Panel → Audit Trail tab. Filters: session_id, actor.user_id, action,  │   │
│  │ timestamp range (AC-AT-04).                                                 │   │
│  │ Reviews before/after diffs for mutating actions (AC-AT-03).                 │   │
│  │ Verifies storage: DIFF/FULL/REFERENCE (AC-AT-07).                           │   │
│  │ Confirms retention compliance (US-SE-04).                                   │   │
│  │ Confirms immutability: no events modified/deleted (AC-AT-06).               │   │
│  │ Emotional: 📝 Thorough — "Audit trail is complete and tamper-evident"       │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.3.4 Key Needs: Decision Rationale Visibility, Before/After State Comparison, Immutable Audit Evidence

**Decision Rationale Visibility:** `rationale` and `decision_maker` columns visible by default in RBAC Matrix (no expand required). Decision Ledger filterable by `metadata.layer = "auth"` for batch review. Audit Panel supports: *"Show me all decisions that affected the auth layer"* (FR-IDE-18).

**Before/After State Comparison:** Every mutating action displays `before_state` / `after_state` side-by-side: removed lines in Error `#EF4444` with strikethrough, added in Success `#10B981`. RBAC diffs render full affected subtree including inherited permission deltas.

**Immutable Audit Evidence:** Exported artifacts include cryptographic integrity hash and schema version. Immutability badge on Audit Trail header: lock icon, tooltip *"Audit events cannot be modified or deleted. Corrections appear as new events."* (AC-AT-06). Tiered storage strategy (DIFF → FULL → REFERENCE) documented in inline info panel (Info `#38BDF8`) with storage policy link.

---

## 2.4 Persona Comparison Matrix

### 2.4.1 Feature Visibility Matrix

| Panel / Feature | Citizen Developer | Power User / Architect | Security Engineer |
|---|---|---|---|
| Chat Panel | Full (NL labels) | Full (technical) | Full (technical) |
| Steering Panel | Abstracted | Full | Read-Only |
| File Explorer | Abstracted | Full | Full (security filter pre-applied) |
| Editor (Monaco) | Hidden | Full | Read-Only |
| Live Preview | Full | Full | Hidden |
| Terminal | Collapsed default | Full | Hidden |
| Test Results | Abstracted | Full | Hidden |
| Blueprint Graph | Hidden | Full | Read-Only |
| Audit Panel | Hidden | Full | **Full + Enhanced** |
| RBAC Matrix | Hidden | Full | **Full + Escalation Analysis** |
| Raw JSON | Hidden | Full | Full |
| Plain English Decision Summarizer | **Full** | Hidden | Hidden |
| Bookmark Comparison | Hidden | Full | Hidden |
| Checkpoint Timeline | Hidden | Full | Read-Only |
| Command Palette | Hidden | Full | Full |
| Revision Budget Indicator | Hidden | Full | Hidden |

### 2.4.2 Trust Mode Defaults per Persona

Trust mode governs pipeline pause behavior at stage boundaries. Each persona receives an optimized default; override permitted in Settings per `project_id`.

| Persona | Default Mode | Behavior | Rationale |
|---|---|---|---|
| **Citizen Developer** | `PARANOID` | Pause at EVERY boundary. All decisions with plain English explanation. | Novices cannot evaluate risk. Every pause is a teaching moment. |
| **Power User / Architect** | `BALANCED` | Auto-approve `LOW_RISK` (CRUD, DTOs). Pause `MEDIUM` (API routes) and `HIGH` (Auth/Security/Data). | Trusts routine tasks; wants control over architecture. |
| **Security Engineer** | `BALANCED` (audit) / `PARANOID` (live build) | Auditing: no execution, pauses irrelevant. Live build: pause all AUTH/SECURITY boundaries. | Auditor, not driver. Trust mode applies only on rebuild or RBAC modify. |

`AccessGuard` (Section 8.4) provides risk classification. Nodes without `access_guards` auto-classify `LOW_RISK`. Tasks touching `confidential` or `restricted` data require non-empty `access_guards` (AC-RB-05), ensuring security-relevant tasks always pause regardless of trust mode.

### 2.4.3 Language Abstraction Levels

The `PersonaAbstractionLayer` (PRD Section 22.11) translates system labels via `(persona, system_label)` dictionary with Power User label as fallback.

| System Label | Citizen Developer | Power User | Security Engineer |
|---|---|---|---|
| `STEERING_PANEL_READY` | "Here's what I found:" | `STEERING_PANEL_READY` | `STEERING_PANEL_READY` |
| `Accept` | `Looks good!` | `[Accept]` | `[Accept] (decision_maker req)` |
| `Modify` | `Change this...` | `[Modify]` | `[Modify]` |
| `Replace` | `Start over with this` | `[Replace]` | `[Replace]` |
| `Authorize` | `Yes, go ahead` | `[Authorize]` | `[Authorize] (rationale req)` |
| `RBACModel.version: 2` | "Permissions: Managers see all. Employees see own." | `RBACModel.version: 2` (full JSON) | `RBACModel.version: 2` + diff + `decision_maker` |
| `PRIVILEGE_ESCALATION_FLAGGED` | "I found a permission issue. Let me fix it." | `PRIVILEGE_ESCALATION_FLAGGED: path={...}` | `PRIVILEGE_ESCALATION_FLAGGED: path={...}, depth={n}` |
| `ImpactReport: 12 nodes` | "This affects 12 parts of your app." | `ImpactReport: 12 nodes, 3 layers, ~4min` | `ImpactReport: 12 nodes, auth_layer={3}` |
| `Stage 3: Actor Discovery` | "Step 3: Finding who uses your app..." | `Stage 3: Actor Discovery` | `Stage 3: Actor Discovery` |
| `EngineeringTask` | "Part of your app that does: [desc]" | `EngineeringTask: {id, layer, deps}` | `EngineeringTask: {id, access_guards, classification}` |
| `RevisionBudget: 3/5` | "Change your mind 3 more times" | `RevisionBudget: 3/5` | Hidden |
| `Checkpoint restored` | "Went back to your previous version" | `Checkpoint {id} restored: S4, 47 nodes` | `Checkpoint {id} restored by {actor} at {ts}` |

Citizen Developer translations validated by readability: Flesch-Kincaid Grade Level ≤ 8 for all natural language strings.

# 3. Information Architecture & IDE Layout

This chapter defines the spatial framework of the IDE — the arrangement, sizing, layering, and responsive behavior of every panel. All subsequent panel specifications (Chapter 5 onward) assume the layout skeleton described here. The structure is derived from PRD Section 22.2 (IDE Layout & Panels) and enforces acceptance criteria AC-CG-12 (full panel inventory), FR-IDE-19 (keyboard shortcuts), and NF-RL-01 (session resume with layout persistence).

---

## 3.1 Global Layout Structure

### 3.1.1 Persistent Chrome: Top Toolbar

The top toolbar (height: 48px; background: #FFFFFF; bottom-border: 1px solid #CBD5E1) is the only chrome element visible in every IDE state.

**Left cluster (x: 16px):** Project name label in 14px/600wt Ink (#0F172A), truncated at 240px with ellipsis; hover reveals full name in a tooltip (z-index: 900). An unsaved indicator (8px circle, Error #EF4444) precedes the name when changes are pending.

**Center cluster:** Pipeline stage badge — a rounded pill (border-radius: 12px, padding: 4px 12px, font: 12px/500wt) with background keyed to stage category. Text reads "Stage {N}: {StageName}".

**Right cluster (right-aligned, padding: 16px):** Three controls at 8px intervals: (1) Save & Exit button (32px height, border: 1px solid #CBD5E1, hover bg #F8FAFC); (2) Settings gear icon (24px touch target, borderless); (3) Trust Mode badge — a 28px pill with mode-keyed background: PARANOID uses Error (#EF4444), BALANCED uses Warning (#F59E0B), AUTO_PILOT uses Success (#10B981), all with White text. Clicking the badge opens a dropdown (z-index: 800) with three mode options. Defaults per persona: PARANOID (Citizen Developer), BALANCED (Power User / Architect), AUTO_PILOT (Security Engineer).

### 3.1.2 Three-Column Responsive Layout

The IDE viewport (height: 100vh minus 48px toolbar) divides into three columns separated by draggable resize handles (4px wide, transparent at rest, hover: #CBD5E1, cursor: col-resize). The `AppShell` layout manager (PRD Section 15.2) maintains panel widths in a Zustand store synced to `localStorage` for cross-session persistence (NF-RL-01).

**Left Sidebar** (default: 320px; min: 260px; max: 480px) contains two vertically-stacked panels: Chat Panel (top, flex-grow: 1, ~65% of sidebar) and File Explorer (bottom, ~35%, collapsible). A horizontal resize handle (4px, cursor: row-resize) separates them. The Chat Panel is the default primary input surface per FR-IDE-01; every session starts with it focused and a blank input showing: *"Describe what you want to build..."*. Toggled via `Ctrl/Cmd + B` (FR-IDE-19).

**Center Column** (flex: 1) hosts a tabbed container (tab bar: 36px, bottom border Cloud #F8FAFC). Tab types: Editor (default when files open), Steering Panel, Blueprint Graph. When `STEERING_PANEL_READY` arrives, the Steering tab auto-activates with a pulsing dot (8px, Warning #F59E0B) until viewed.

**Right Sidebar** (default: 400px; min: 320px; max: 640px) hosts the Live Preview Panel (sandbox iframe per FR-IDE-11). Toggled via `Ctrl/Cmd + Shift + R` (FR-IDE-19). When closed, a floating Preview button (48px circle, bottom-right at 24px offset) allows reopening.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ Toolbar (48px)                                                                          │
│ [●ProjectName...] [Stage 1: Actor Discovery]        [Save & Exit] [⚙] [PARANOID]       │
├──────────┬──────────────────────────────────────────────────────┬───────────────────────┤
│          │                                                      │                       │
│  Chat    │  Tab Bar: [Editor] [Steering Panel] [Blueprint Graph]│                       │
│  Panel   │                                                      │      Live Preview     │
│  (~65%)  ├──────────────────────────────────────────────────────┤       (Sandbox)       │
│          │                                                      │       (~400px)        │
│          │  Editor / SteeringPanel / Blueprint Graph            │                       │
│          │  (Active content area, flex: 1)                      │                       │
│          │                                                      │                       │
├──────────┼──────────────────────────────────────────────────────┤                       │
│ File     │  Bottom Panel (collapsible, ~200px default)          │                       │
│ Explorer │  Tabs: [Terminal] [Test Results] [Audit Trail]       │                       │
│ (~35%)   │                                                      │                       │
│          │                                                      │                       │
└──────────┴──────────────────────────────────────────────────────┴───────────────────────┘
  320px                    flex: 1 (center)                          400px
  (260-480)                                                        (320-640)
```
*Wireframe 1 — Full Desktop Layout (1440px+ viewport). Default panel widths in parentheses. Resize handles at every panel boundary (not drawn). All dimensions in CSS pixels.*

### 3.1.3 Bottom Panel: Terminal / Test Results / Audit Trail

A collapsible bottom panel (default: 200px; min: 120px; max: 480px) sits below the Center Column, spanning from its left edge to the right edge of the Right Sidebar — it does not extend under the Left Sidebar. Three tabs: Terminal (default), Test Results, Audit Trail. Tab bar: 32px. Toggled via `Ctrl/Cmd + Shift + T` (FR-IDE-19). When collapsed, a 32px tab bar sticks to the bottom of the Center Column. Collapse/expand uses a vertical slide (duration: slow 400ms, easing: standard cubic-bezier(0.4,0,0.2,1)). Tab switching uses crossfade (duration: fast 150ms).

### 3.1.4 Panel Resize Behavior

Every resizable boundary implements drag-to-resize. Handles are 4px wide (vertical) or 4px tall (horizontal), invisible at rest, revealing #CBD5E1 on hover (transition: fast 150ms). During drag, a ghost indicator (1px dashed #475569) previews the new position.

| Panel | Property | Default | Minimum | Maximum | Collapse Target |
|---|---|---|---|---|---|
| Left Sidebar | width | 320px | 260px | 480px | 48px (icon bar) |
| Chat Panel | height | 65% of sidebar | 160px | 80% of sidebar | 0px (fully collapsed) |
| File Explorer | height | 35% of sidebar | 80px | 50% of sidebar | 32px (tab bar only) |
| Center Column | width | flex: 1 | 480px | — | — |
| Right Sidebar | width | 400px | 320px | 640px | 48px (icon bar) |
| Bottom Panel | height | 200px | 120px | 480px | 32px (tab bar only) |

*Table 1 — Panel Dimension Constraints. "Collapse Target" indicates the visual state when fully collapsed via toggle or keyboard shortcut. The Center Column has no collapse state — it is the flex-fill region.*

**Collapse-to-icon animation:** when toggled closed, sidebar width animates to 48px over 250ms (normal duration) with easing: exit cubic-bezier(0.4,0,1,1). The 48px state displays a vertical icon bar with one icon per panel at 48px intervals (Ink #0F172A, 20px size; active panel highlighted in Frontend #2563EB). Clicking an icon expands that panel and collapses others in the group. Expand uses easing: enter cubic-bezier(0,0,0.2,1) over 250ms. A visual shake (3px horizontal oscillation, 100ms) signals when a drag reaches a constraint boundary.

---

## 3.2 Panel Hierarchy & Z-Index Rules

### 3.2.1 Z-Index Layering

The IDE uses a strict z-index system scoped to the `AppShell` root (`position: relative`). No component shall declare a z-index outside its assigned tier.

```
Layer:   1000          900           800           100             0
       ┌─────┐     ┌─────┐      ┌─────┐      ┌──────────┐   ┌──────────┐
       │Modal│     │Tooltip│    │Dropdown│   │  Panels  │   │   Base   │
       │Dimmer│    │       │    │        │   │ (Left,   │   │  Layout  │
       │       │    │       │    │        │   │ Center,  │   │ (Toolbar,│
       │Confirm│   │       │    │        │   │ Right,   │   │  Empty   │
       │Dialog │   │       │    │        │   │ Bottom)  │   │  State)  │
       └─────┘     └─────┘      └─────┘      └──────────┘   └──────────┘

       [Modal]     [Tooltip]    [Dropdown]   [Panels]       [Base]
       Container   Container    Container    Container      Layout
```
*Wireframe 2 — Z-Index Stacking Visualization. Higher tiers always render above lower tiers regardless of DOM order. Within a tier, DOM order is the tiebreaker.*

**Base Layout (z-index: 0):** Toolbar, three-column panel grid, and bottom panel. These never overlap by design — the flex layout prevents collisions.

**Panels (z-index: 100):** Floating Preview button (collapsed Right Sidebar), inline chat popovers, Editor minimap overlay, and tab bars render their borders above adjacent content.

**Dropdowns (z-index: 800):** Trust Mode selector, Settings menu, File Explorer context menu (FR-IDE-08), Command Palette (`Ctrl/Cmd + Shift + P`), and all `select`/`autocomplete` popups. Rendered in a portal at the IDE root to escape `overflow: hidden` clipping.

**Floating Tooltips (z-index: 900):** Provenance tooltips (FR-IDE-07), toolbar hover tooltips, file status tooltips, and "Generation in progress..." live tooltips. Offset 4px from anchor; auto-reposition (flip) on viewport edge collision.

**Modals (z-index: 1000):** Confirmation dialogs, Propagation Consent modals, "Unsupported Device" guard, and full-screen overlays. Include a dimmer (bg: #0F172A at 50% opacity, `backdrop-filter: blur(2px)`). Modal content centers with `position: fixed; inset: 0; margin: auto` at max-width: 480px (confirmation), 640px (consent), or 400px (unsupported device).

### 3.2.2 Focus Management

Focus behavior aligns with z-index tiers: only elements in the highest visible tier can hold focus.

**Modal focus locking:** Focus is trapped within the modal container (roving tabindex). `Tab` cycles focusable elements; `Escape` dismisses; clicking the dimmer also dismisses. Focus returns to the trigger element on close. The `FocusTrap` component adds `aria-hidden="true"` to siblings and sets `inert` on the base layout.

**Panel focus stealing:** The Steering Panel tab auto-activates and steals focus on `STEERING_PANEL_READY`, UNLESS the user is actively typing in the Chat input (detected by `document.activeElement === chatInput` within the last 2 seconds). If suppressed, a pulsing badge (8px orange dot, 2s infinite pulse) alerts the user. Live Preview never steals focus. Terminal steals focus only on error-level output requiring intervention (red flash, 3 pulses on the tab).

**Dropdown focus:** Trust Mode and Settings dropdowns trap focus while open. `Escape` closes and returns focus to trigger. `ArrowUp`/`ArrowDown` navigate; `Enter` selects. Clicking outside closes without changing selection.

### 3.2.3 Panel State Persistence

IDE layout state saves per-user and restores on session resume (NF-RL-01). The `IDEStateStore` (Zustand) persists these keys to `localStorage` under `ide-layout-{userId}`:

- `leftSidebarWidth`: integer px (260–480)
- `rightSidebarWidth`: integer px (320–640)
- `chatPanelHeight`: integer px (160–80% of sidebar)
- `bottomPanelHeight`: integer px (120–480)
- `leftSidebarCollapsed`, `rightSidebarCollapsed`, `bottomPanelCollapsed`: boolean
- `activeCenterTab`: 'editor' | 'steering' | 'graph'
- `activeBottomTab`: 'terminal' | 'test-results' | 'audit-trail'
- `trustMode`: 'PARANOID' | 'BALANCED' | 'AUTO_PILOT'

`AppShell` reads these values before first render (synchronous via Zustand `persist` middleware) to prevent layout flash. Missing state uses Table 1 defaults; out-of-bounds values clamp to current constraints. Writes are debounced 500ms to avoid excessive `localStorage` traffic during resize.

---

## 3.3 Responsive Breakpoints

### 3.3.1 Desktop (>=1440px): Full Three-Column Layout

All three columns visible at default widths: Left Sidebar 320px, Right Sidebar 400px, Center Column fills remaining ~720px. All panels render in full form. Persona-based panel visibility (Section 22.11) still applies — Citizen Developers see the simplified panel set — but the three-column spatial layout remains consistent across personas.

### 3.3.2 Laptop (1024–1439px): Two-Column Default with Preview as Overlay

Default layout shows two columns: Left Sidebar (280px) and Center Column (flex: 1). The Right Sidebar is collapsed to its 48px icon-bar state. The Live Preview is accessed via the floating Preview button (48px circle, bottom-right corner), which opens a slide-in overlay at 50% viewport width (min 400px, max 720px, z-index: 100) above the Center Column. A 15% opacity dimmer covers the Center Column behind the overlay. Clicking the dimmer or pressing `Escape` closes it. Animation: slide-in from right (duration: normal 250ms, easing: enter cubic-bezier(0,0,0.2,1)).

The Left Sidebar scales: Chat Panel occupies ~60% of sidebar height (reduced from 65%). The bottom panel defaults to collapsed (32px tab bar) to maximize Editor vertical space.

### 3.3.3 Tablet (768–1023px): Single-Column Stack with Tab-Based Panel Switching

Layout switches to a single-column stack below the toolbar. A horizontal panel switcher bar (40px height, bg: #F8FAFC, border-bottom: 1px solid #CBD5E1) contains five icon buttons: Chat, Files, Editor, Preview, and More (opens a bottom sheet with Terminal, Test Results, Audit Trail, Settings). Only one primary panel is visible at a time; swapping uses a horizontal slide (duration: fast 150ms).

Touch optimizations: all targets minimum 44px × 44px (WCAG 2.5.5). Resize handles are hidden — panels are not manually resizable. The Trust Mode badge shows full text, not just color. Save & Exit shows icon only (no text). Keyboard shortcuts from FR-IDE-19 are preserved; long-press on switcher icons (500ms) reveals a shortcut cheat sheet tooltip.

### 3.3.4 Minimum Supported Viewport: 768px Width

Viewports below 768px display a full-screen "Unsupported Device" modal (z-index: 1000). Content: device icon (48px, Slate #475569), heading "Screen Too Small" (20px/600wt Ink), body text explaining the 768px minimum (14px/400wt Slate), and a "Continue Anyway (Not Recommended)" button that dismisses the modal but adds a persistent warning banner (32px height, bg: #FEF2F2, text: Error #EF4444) reading "Limited functionality — viewport below minimum width."

```
Desktop (>=1440px):
┌──────────┬──────────────────────────┬──────────┐
│  Chat    │      Center Column       │  Preview │
│  Panel   │   (Editor/Steering/Graph)│  (400px) │
│  (320px) │                          │          │
├──────────┤                          ├──────────┤
│  File    │                          │          │
│ Explorer │  Bottom Panel (200px)    │          │
└──────────┴──────────────────────────┴──────────┘

Laptop (1024-1439px):
┌──────────┬──────────────────────────────────────┐
│  Chat    │          Center Column                │
│  Panel   │        (Editor/Steering/Graph)        │
│  (280px) │                                       │
├──────────┤      [Preview overlay on demand]      │
│  File    │                                       │
│ Explorer │                                       │
└──────────┴──────────────────────────────────────┘

Tablet (768-1023px):
┌──────────────────────────────────────────────────┐
│ [Chat] [Files] [Editor] [Preview] [More ▼]       │  ← Panel switcher
├──────────────────────────────────────────────────┤
│                                                  │
│           One panel visible at a time            │
│         (slides horizontally on switch)          │
│                                                  │
└──────────────────────────────────────────────────┘
```
*Wireframe 3 — Responsive Breakpoint Transformations. Desktop: full three-column. Laptop: two-column with collapsed right sidebar. Tablet: single-column with icon-based panel switcher. Below 768px: unsupported-device modal (not shown).*

| Breakpoint | Width Range | Column Layout | Default Visible Panels | Preview Behavior | Resize Handles | Bottom Panel Default |
|---|---|---|---|---|---|---|
| Desktop | >=1440px | Three-column | Chat, File Explorer, Editor, Preview | Persistent sidebar | All active | Expanded (200px) |
| Laptop | 1024–1439px | Two-column | Chat, File Explorer, Editor | Overlay (slide-in) | All active | Collapsed (32px) |
| Tablet | 768–1023px | Single-column + switcher | One at a time (Chat default) | Full-screen panel | Hidden | Collapsed (32px) |
| Unsupported | <768px | Blocked by modal | None | N/A | N/A | N/A |

*Table 2 — Responsive Breakpoint Specifications. "Default Visible Panels" lists panels shown on initial load. "Preview Behavior" describes Live Preview access. "Resize Handles" indicates drag-to-resize availability.*

# 4. Onboarding Flow & Input Modes

This chapter specifies the complete first-run experience — from the empty landing state through input classification, processing visualization, and into the first dialogue flows. Every screen is the user's introduction to the pipeline's collaborative steering philosophy; each element shall communicate transparency, user agency, and zero silent defaults. Cross-references to PRD acceptance criteria AC-RI-01 through AC-RI-08 (Input Richness) and AC-SC-01 through AC-SC-08 (Scaling) are embedded throughout.

---

## 4.1 Empty State / Landing Screen

The Empty State is the first rendered surface after session initialization (`state = INITIALIZED`). Its design imperative is to invite input of any richness level — from a single sentence to a 50-page PRD — without privileging one mode over another. The layout centers vertically and horizontally within the IDE canvas, reserving the top navigation bar (40px height, background Ink #0F172A) and the chat panel (right edge, 360px width, collapsible) as persistent chrome.

### 4.1.1 Visual Design: Centered Prompt Area

The primary prompt area occupies the visual center of the canvas, offset upward by 60px from true center to account for the trust-mode toolbar at the bottom. The container width is 680px max-width, centered horizontally with `margin: 0 auto`.

The invitation headline reads "Describe what you want to build..." in 28px / 1.75rem font-weight 600, color Ink #0F172A, line-height 1.2. Below the headline, a subline in 14px / 0.875rem font-weight 400, color Slate #475569, reads: "Paste a PRD, type an idea, upload a file, or paste a Git URL — the pipeline adapts to your input." Subline top margin is 12px.

The main text input field sits below the subline with 24px top margin. Field specifications: `min-height: 120px`, `max-height: 400px` (auto-expands), `padding: 16px`, `border: 1px solid Silver #CBD5E1`, `border-radius: 12px`, `font-size: 16px`, `line-height: 1.5`, `background: White #FFFFFF`. On focus, border transitions to Frontend #2563EB over `fast 150ms` with `standard cubic-bezier(0.4,0,0.2,1)` easing, and a `box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12)` is applied. Placeholder text color: Silver #CBD5E1 at 70% opacity.

Below the text input, a horizontal divider line (1px, Silver #CBD5E1, full container width) separates the primary input from alternative input affordances, with 20px vertical margin.

```
+------------------------------------------------------------------+
|  [Logo]  Collaborative Steering Pipeline        [Chat] [Profile] |
+------------------------------------------------------------------+
|                                                                   |
|                          +----------------------+                 |
|                          |  Describe what you   |                 |
|                          |  want to build...    |                 |
|                          |                      |                 |
|                          |  Paste a PRD, type   |                 |
|                          |  an idea, upload...  |                 |
|                          +----------------------+                 |
|                          | [Text input area   ] |                 |
|                          |                      |                 |
|                          |                      |                 |
|                          +----------------------+                 |
|                          ---- or upload a file ----               |
|                          [PRD] [Image] [CSV] [ZIP] [Git URL]     |
|                                                                   |
|  [Quick-start templates row: SaaS | Blog | API | Mobile App]      |
|                                                                   |
+------------------------------------------------------------------+
|  Trust Mode:  ( O ) PARANOID  ( O ) BALANCED  ( O ) AUTO_PILOT  |
+------------------------------------------------------------------+
```
*Wireframe 1: Empty State / Landing Screen. Primary text input centered with alternative upload affordances below. Quick-start templates and trust-mode selector occupy the lower portion.*

### 4.1.2 Input Affordances: Text Input, File Upload Zone, Git URL, Voice Input

The alternative input row provides five distinct entry methods, rendered as icon-button chips in a horizontal flex container with 12px gap. Each chip has `height: 40px`, `padding: 0 16px`, `border: 1px solid Silver #CBD5E1`, `border-radius: 8px`, `background: Cloud #F8FAFC`, `font-size: 13px`, `font-weight: 500`, `color: Slate #475569`, and an inline SVG icon (16px) left-aligned with 8px margin to label.

| Chip | Icon | Label | Action |
|------|------|-------|--------|
| PRD upload | Document icon | "Upload PRD" | Opens file picker, accepts `.md`, `.txt`, `.pdf` |
| Image upload | Image icon | "Add Image" | Opens file picker, accepts `.png`, `.jpg`, `.webp` |
| CSV upload | Table icon | "Upload CSV" | Opens file picker, accepts `.csv` — data schema seeding |
| ZIP upload | Archive icon | "Upload ZIP" | Opens file picker, accepts `.zip` — legacy codebase ingestion (AC-LG-01) |
| Git URL | Git branch icon | "Git URL" | Expands inline text field for repository URL |

On hover, chip background transitions to `rgba(37, 99, 235, 0.06)` over `fast 150ms`, border color transitions to Frontend #2563EB. On click, a `file_selected` or `url_entered` event is emitted; the system transitions to `CLASSIFYING` state and the progress visualization (Section 4.2) renders in place of the empty state.

The Git URL chip expands inline to a text input field (`width: 320px`, `height: 36px`) with a "Connect" button (Frontend #2563EB background, White text, `border-radius: 6px`, `padding: 0 12px`). The LegacyIngestor (PRD Section 4.1) triggers upon submission, producing a `LegacyContextReport` before Stage 0–6 execution.

Voice input is reserved for a future release. Its chip renders with `opacity: 0.5` and a "Coming soon" tooltip on hover to set expectation without breaking affordance consistency.

### 4.1.3 Quick-Start Templates

Beneath the upload row, a horizontally scrollable template rail provides one-click seeded prompts. The rail heading reads "Or start with a template" in 12px / 0.75rem, `font-weight: 600`, `text-transform: uppercase`, `letter-spacing: 0.05em`, `color: Slate #475569`, with 16px bottom margin.

Each template card: `width: 180px`, `min-width: 180px`, `height: 96px`, `padding: 16px`, `border: 1px solid Silver #CBD5E1`, `border-radius: 10px`, `background: White #FFFFFF`, `cursor: pointer`. Cards are arranged in a horizontal flex with `gap: 12px` and `overflow-x: auto` with hidden scrollbar.

Available templates (exact set):

| Template | Seeded Prompt Text | Icon Color |
|----------|-------------------|------------|
| "Build a SaaS app" | "I want to build a SaaS application with user authentication, subscription billing, an admin dashboard, and REST API. Target 1,000 users at launch." | Frontend #2563EB |
| "Create a blog" | "Build a content management blog with markdown editor, categories, tags, SEO meta fields, and comment moderation." | Backend #059669 |
| "Design an API" | "Design a RESTful API for a resource management system with CRUD operations, pagination, filtering, rate limiting, and OpenAPI documentation." | Infra #7C3AED |
| "Mobile app backend" | "Create a backend for a mobile app with user registration, push notifications, file upload, and real-time chat over WebSockets." | Database #D97706 |

On hover, card border color transitions to the template's `iconColor`, `box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08)` appears over `fast 150ms`. On click, the seeded prompt populates the main text input, the cursor is positioned at the end of the text, and the submit action is triggered automatically after a `deliberate 600ms` delay (allowing the user to see what was populated before the pipeline proceeds).

### 4.1.4 Trust Mode Selector: PARANOID / BALANCED / AUTO_PILOT Toggle

The trust mode selector anchors the bottom of the empty state, centered horizontally in a toolbar strip of `height: 56px`, `background: White #FFFFFF`, `border-top: 1px solid Silver #CBD5E1`, `padding: 0 24px`. This selector directly implements the Risk-Based Steering Policies (PRD Section 7.3) and determines pause-point behavior throughout the entire pipeline session.

The selector renders as a three-segment pill toggle with `width: 360px`, `height: 36px`, `border-radius: 18px`, `background: Cloud #F8FAFC`, `border: 1px solid Silver #CBD5E1`. Each segment has `width: 120px`, `text-align: center`, `font-size: 12px`, `font-weight: 600`, `line-height: 34px`, `cursor: pointer`.

| Mode | Background (selected) | Text Color (selected) | Behavior | Target User |
|------|----------------------|----------------------|----------|-------------|
| `PARANOID` | Error #EF4444 | White #FFFFFF | Pause at EVERY stage boundary | Novice |
| `BALANCED` | Warning #F59E0B | White #FFFFFF | Auto-approve LOW_RISK; pause for MEDIUM and HIGH | Power User |
| `AUTO_PILOT` | Success #10B981 | White #FFFFFF | Auto-approve LOW and MEDIUM; pause only for CRITICAL | Expert / Engineering Lead |

`PARANOID` is the default for all new sessions. The selected segment's background fills with the mode color over `normal 250ms` with `standard cubic-bezier(0.4,0,0.2,1)` easing. Unselected segments render with `color: Slate #475569` and `background: transparent`.

Each mode label has an accompanying info icon (14px, Slate #475569) that triggers a tooltip on hover. Tooltip specs: `max-width: 280px`, `padding: 12px`, `background: Ink #0F172A`, `color: White #FFFFFF`, `font-size: 12px`, `line-height: 1.5`, `border-radius: 8px`, `box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15)`. Tooltip content for `PARANOID`: "The system will stop at every stage and ask for your confirmation. Recommended when you want full control." Tooltip content for `BALANCED`: "Low-risk items like standard data models are auto-approved. The system asks about APIs, auth, and security decisions." Tooltip content for `AUTO_PILOT`: "Only critical decisions — schema migrations, RBAC changes, payment logic — trigger a pause. Best for experienced users."

The selected trust mode is persisted to `SessionPolicy.trust_policy` and recorded in the `DecisionLedger` as the session's first entry. Mode changes after pipeline start require an explicit confirmation dialog ("Changing trust mode will affect future stage boundaries only. Previous decisions are not affected. Continue?") with "Keep current" and "Apply change" buttons.

---

## 4.2 Input Processing Visualization

When the user submits input (text, file, or URL), the UI transitions from the Empty State to the Input Processing Visualization. This screen occupies the same centered layout but replaces the input affordances with a determinate progress indicator and, upon completion, the Richness Classification results panel. The target transition time from submission to classification complete is `< 2 seconds` (PRD Section 18.1).

### 4.2.1 Progress Indicator: "Analyzing your input..."

The progress indicator renders as a centered card (`width: 520px`, `background: White #FFFFFF`, `border: 1px solid Silver #CBD5E1`, `border-radius: 12px`, `padding: 32px`). A spinner icon (24px, Frontend #2563EB) rotates continuously at 1 revolution per 1.2s using a CSS `animation: spin 1.2s linear infinite`. The heading "Analyzing your input..." renders in 18px / 1.125rem, `font-weight: 600`, `color: Ink #0F172A`, with 16px top margin from the spinner.

Below the heading, a determinate progress bar (`width: 100%`, `height: 6px`, `background: Silver #CBD5E1`, `border-radius: 3px`, `overflow: hidden`) fills from left to right. The fill color is Frontend #2563EB, transitioning width over `normal 250ms` with `standard cubic-bezier(0.4,0,0.2,1)` easing as step completion events arrive via WebSocket.

Step labels render below the progress bar as a vertical stack with 8px spacing. Each label has three states: `pending` (color Silver #CBD5E1), `active` (color Frontend #2563EB, with a pulsing dot indicator), and `complete` (color Success #10B981, with a checkmark icon). The step sequence is fixed:

| Step Index | Label | Typical Duration | WebSocket Event Trigger |
|------------|-------|-----------------|------------------------|
| 1 | "Receiving input" | 50–200ms | `USER_INPUT` acknowledged |
| 2 | "Scanning for compliance signals" | 200–500ms | `ComplianceAutoDetector` complete |
| 3 | "Classifying input richness" | 300–800ms | `RICHNESS_MODE_DETECTED` event ready |
| 4 | "Analyzing PRD structure (if applicable)" | 500–2000ms | `PRD_ANALYSIS_READY` event ready |
| 5 | "Preparing next steps" | 100–300ms | `InputClassified` event emitted |

Steps 1–3 always execute. Step 4 executes conditionally only when the input is classified `WELL_FORMED` and contains structured PRD content. Step 5 is the finalization step that prepares the UI transition to the appropriate dialogue or stage.

```
+------------------------------------------------------------------+
|  [Logo]  Collaborative Steering Pipeline        [Chat] [Profile] |
+------------------------------------------------------------------+
|                                                                   |
|                    +------------------------+                     |
|                    |         (+)            |  <- spinner         |
|                    | Analyzing your input...|                     |
|                    | [=======----] 65%      |  <- progress bar    |
|                    |                        |                     |
|                    | * Receiving input      |  <- complete        |
|                    | * Scanning compliance..|  <- complete        |
|                    | * Classifying richness |  <- active (pulse)  |
|                    | o Analyzing PRD struct |  <- pending         |
|                    | o Preparing next steps |  <- pending         |
|                    +------------------------+                     |
|                                                                   |
+------------------------------------------------------------------+
```
*Wireframe 2: Input Processing Visualization. Determinate progress bar with step labels showing completion state. Active step pulses with Frontend #2563EB color.*

### 4.2.2 Richness Classification Display

Upon `RICHNESS_MODE_DETECTED` event arrival, the progress card expands vertically (`height` transitions over `slow 400ms`) to reveal the classification results panel. The panel has `padding-top: 24px`, separated from the progress section by a 1px Silver #CBD5E1 divider.

The classification badge is the primary visual element. Three badge variants exist, each with distinct background, border, and text color:

| Classification | Badge Text | Background | Border | Text Color |
|---------------|-----------|------------|--------|------------|
| `WELL_FORMED` | "Well-Formed PRD Detected" | `rgba(16, 185, 129, 0.08)` | Success #10B981 | Success #10B981 |
| `MINIMALIST` | "Guided Input Needed" | `rgba(245, 158, 11, 0.08)` | Warning #F59E0B | Warning #F59E0B |
| `SEED_ONLY` | "Seed Builder Required" | `rgba(239, 68, 68, 0.08)` | Error #EF4444 | Error #EF4444 |

Badge dimensions: `padding: 8px 16px`, `border-radius: 20px`, `font-size: 13px`, `font-weight: 600`, `display: inline-flex`, `align-items: center`, with a status dot (8px diameter, filled with border color) preceding the text with 8px margin.

To the right of the badge, the confidence score renders as a percentage (e.g., "94% confidence") in 12px / 0.75rem, `color: Slate #475569`. The confidence threshold for automatic classification (without user override) is `>= 85%`. Below 85%, the badge renders with an additional warning icon and the text "Review suggested" appended.

The `classification_basis` (AC-RI-07) renders as an expandable panel below the badge. The panel header reads "Why this classification?" in 13px, `font-weight: 500`, `color: Frontend #2563EB`, with a chevron icon that rotates 90 degrees on expand. Expanded panel content is a bulleted list of basis statements (e.g., "Detected 4 explicit actors," "Found capability descriptions," "Non-functional requirements section present") in 13px, `color: Slate #475569`, `line-height: 1.6`, with 12px left padding per item.

A primary action button anchors the bottom of the classification panel. Button label varies by classification: `WELL_FORMED` → "Review PRD Analysis", `MINIMALIST` → "Start Guided Input", `SEED_ONLY` → "Build Your Seed". Button specs: `width: 100%`, `height: 44px`, `background: Frontend #2563EB`, `color: White #FFFFFF`, `font-size: 14px`, `font-weight: 600`, `border-radius: 8px`, `border: none`, `cursor: pointer`, `margin-top: 20px`. On hover, background darkens to `#1D4ED8` over `fast 150ms`.

```
+------------------------------------------------------------------+
|  [Logo]  Collaborative Steering Pipeline        [Chat] [Profile] |
+------------------------------------------------------------------+
|                                                                   |
|                    +------------------------+                     |
|                    |  [====COMPLETE====] 100%                    |
|                    |                        |                     |
|                    |  [GREEN] Well-Formed   |  <- badge           |
|                    |  PRD Detected   94%    |                     |
|                    |                        |                     |
|                    |  Why this classific-   |  <- expandable      |
|                    |  > ation?              |                     |
|                    |    * 4 actors found    |                     |
|                    |    * Capabilities      |                     |
|                    |      described         |                     |
|                    |    * NFRs present      |                     |
|                    |                        |                     |
|                    |  [Review PRD Analysis] |  <- CTA button      |
|                    +------------------------+                     |
|                                                                   |
+------------------------------------------------------------------+
```
*Wireframe 3: Richness Classification Results. Classification badge with confidence score, expandable classification basis panel, and primary action button. Green badge indicates WELL_FORMED detection.*

### 4.2.3 PRD Analysis Report

For `WELL_FORMED` inputs, clicking "Review PRD Analysis" transitions the UI to the full `PRDAnalysisReport` view (AC-RI-01, AC-RI-05, AC-RI-06). This view renders as a scrollable panel (`max-height: calc(100vh - 120px)`, `overflow-y: auto`) replacing the classification card in-place.

The report organizes PRD sections into four color-coded categories, each rendered as a collapsible section with a header row:

| Category | Header Color | Icon | Description | AC Reference |
|----------|-------------|------|-------------|--------------|
| Explicit Sections | Success #10B981 | Checkmark | Sections successfully mapped to pipeline stages | AC-RI-01 |
| Thin Sections | Warning #F59E0B | Alert triangle | Sections with insufficient detail — flagged for user attention | AC-RI-01 |
| Missing Sections | Error #EF4444 | X mark | Expected sections not found in the PRD | AC-RI-01 |
| Unmapped Sections | Info #38BDF8 | Question mark | Sections present but not consumed by any pipeline stage | AC-RI-05, AC-RI-06 |

Each section header displays: (a) the category label in 13px / 0.8125rem, `font-weight: 600`; (b) a count badge (`background: headerColor at 8% opacity`, `color: headerColor`, `padding: 2px 8px`, `border-radius: 10px`, `font-size: 11px`); and (c) a chevron for expand/collapse. Expanded content lists individual items in 13px, `color: Slate #475569`, with 8px vertical spacing.

Explicit section items display the PRD section name (e.g., "Actors and Roles," "API Requirements") with a right-aligned stage mapping label (e.g., "→ Stage 2," "→ Stage 3") in `color: Success #10B981`, `font-size: 11px`.

Thin section items display the section name with a "Needs detail" warning label and a one-sentence explanation of what is missing (e.g., "User roles are listed but no permission descriptions found"). A "Add detail" link (Frontend #2563EB, underlined) opens the chat panel pre-seeded with a context-aware prompt.

Missing section items display the expected section name (e.g., "Non-Functional Requirements") with a "Generate" link that triggers the Minimalist Dialogue for that specific section only, allowing targeted gap-filling without reprocessing the entire PRD.

Unmapped section items (AC-RI-06) render with three action buttons per item: "Map to Stage" (dropdown selector), "Save as Annotation" (creates a `CustomAnnotation` node), and "Out of Scope" (flags the section, excludes from pipeline). These actions are recorded in the `DecisionLedger` with full provenance.

---

## 4.3 Dialogue Flows

Dialogue flows activate when the input classification indicates insufficient detail for direct pipeline execution (`MINIMALIST` or `SEED_ONLY`) or when the Scale Advisor detects missing scale signals (AC-SC-01). Each dialogue type has a distinct card-based UI that maintains spatial consistency while adapting interaction complexity to the information being gathered.

### 4.3.1 Minimalist Dialogue UI

The Minimalist Dialogue (AC-RI-02) renders when input is classified `MINIMALIST` — the user has provided a problem statement and at least one actor, but the pipeline needs additional structured information before proceeding to Stage 1.

The dialogue container: `width: 600px`, `background: White #FFFFFF`, `border: 1px solid Silver #CBD5E1`, `border-radius: 12px`, `padding: 0` (internal sections carry their own padding), centered horizontally.

Each question card stacks vertically with `margin-bottom: 16px`. Card specs: `background: Cloud #F8FAFC`, `border: 1px solid Silver #CBD5E1`, `border-radius: 10px`, `padding: 20px`. The card header shows the question number ("Question 1 of 4") in 11px, `font-weight: 600`, `color: Slate #475569`, `text-transform: uppercase`, `letter-spacing: 0.03em`.

The question text renders in 15px / 0.9375rem, `font-weight: 500`, `color: Ink #0F172A`, `line-height: 1.5`. Below the question, the appropriate input widget renders:

- **Free text:** `textarea`, `min-height: 80px`, same styling as the empty-state text input.
- **Single select:** Radio group with 12px spacing, each option in a bordered row (`padding: 12px 16px`, `border-radius: 8px`, selected state: `border-color: Frontend #2563EB`, `background: rgba(37, 99, 235, 0.04)`).
- **Multi-select:** Checkbox group with identical row styling.
- **Numeric:** Number input field with increment/decrement buttons, `width: 120px`.

Each card includes a "Skip" link (Slate #475569, underlined, right-aligned) and an "Override" button (appears only when the system suggests a default answer — renders as a small text button "Use my own answer" that clears the suggested value). Validation messages render below the input in 12px, `color: Error #EF4444`, with a 4px top margin. The dialogue advances when the user clicks "Next" (or "Submit" on the final card), not automatically — enforcing explicit action per AC-ST-01.

### 4.3.2 Seed Builder UI

The Seed Builder (AC-RI-03) activates for `SEED_ONLY` input — a single sentence or product name. It presents 3–5 progressive question cards designed to construct a viable `Stage0Seed` from minimal starting material. The visual chrome extends the Minimalist Dialogue with a progress indicator and back/forward navigation.

The progress indicator sits above the first question card: a horizontal step bar with `width: 100%`, `height: 4px`, `background: Silver #CBD5E1`, `border-radius: 2px`. Completed segments fill with Success #10B981, the active segment fills with Frontend #2563EB, and pending segments remain Silver #CBD5E1. Below the bar, the text "Step 2 of 5 — Defining users" renders in 12px, `color: Slate #475569`.

Navigation buttons anchor the bottom of the container in a flex row with `justify-content: space-between`, `padding: 16px 20px`, `border-top: 1px solid Silver #CBD5E1`. The "Back" button: `height: 40px`, `padding: 0 20px`, `background: transparent`, `border: 1px solid Silver #CBD5E1`, `border-radius: 8px`, `color: Slate #475569`, `font-size: 14px`, `font-weight: 500`. Disabled on the first step. The "Next" button: identical dimensions, `background: Frontend #2563EB`, `border: none`, `color: White #FFFFFF`. On the final step, label changes to "Run Pipeline" and background transitions to Success #10B981.

Back navigation restores previously entered values from `SessionState` cache. Forward navigation validates the current card before advancing; invalid cards shake horizontally (CSS `animation: shake 0.3s ease-in-out`) and display validation errors in `color: Error #EF4444`.

### 4.3.3 Scale Dialogue UI

The Scale Dialogue (AC-SC-01, AC-SC-07) renders when the ScaleInfraAdvisor detects absent scale signals. It is a form-based UI with real-time cross-field validation. The form container: `width: 640px`, same card styling as other dialogues.

```
+------------------------------------------------------------------+
|  [Logo]  Collaborative Steering Pipeline        [Chat] [Profile] |
+------------------------------------------------------------------+
|                                                                   |
|                    +------------------------+                     |
|                    |  Define Your Scale     |                     |
|                    |                        |                     |
|                    |  Expected total users  |                     |
|                    |  [ 10,000          ]   |                     |
|                    |                        |                     |
|                    |  Peak concurrent users |                     |
|                    |  [ 500             ]   |  <- ERROR: cannot   |
|                    |                        |     exceed total    |
|                    |  Monthly budget (USD)  |                     |
|                    |  [ $500            ]   |                     |
|                    |                        |                     |
|                    |  Launch timeline       |                     |
|                    |  [ 3 months    ] [v]   |                     |
|                    |                        |                     |
|                    |  [ Cancel ] [ Generate |                     |
|                    |    Options ]           |                     |
|                    +------------------------+                     |
|                                                                   |
+------------------------------------------------------------------+
```
*Wireframe 4: Scale Dialogue Form. Numeric input fields with real-time cross-field validation. Error state shown for concurrent users exceeding total users (AC-SC-07).*

Form fields (all required, marked with a red asterisk Error #EF4444):

| Field | Input Type | Placeholder | Validation Rule | AC Ref |
|-------|-----------|-------------|-----------------|--------|
| Expected total users at launch | Number input | "e.g., 10,000" | `> 0`, integer | AC-SC-01 |
| Peak concurrent users | Number input | "e.g., 500" | `> 0`, `<= total_users` | AC-SC-07 |
| Monthly infrastructure budget (USD) | Currency input | "e.g., $500" | `>= 0` or "No limit" checkbox | AC-SC-04 |
| Launch timeline | Dropdown | "Select timeline" | Options: "< 1 month", "1–3 months", "3–6 months", "6+ months" | AC-SC-01 |

Real-time cross-field validation (AC-SC-07) executes on every `onBlur` and `onChange` (debounced 300ms). When `concurrent_users > total_users`, the concurrent users field border transitions to Error #EF4444, a validation message "Peak concurrent users cannot exceed total users" renders below in 12px Error #EF4444, and the "Generate Options" button disables (`opacity: 0.5`, `cursor: not-allowed`). The validation state clears automatically when the user corrects the value.

The "Generate Options" button triggers the `ScaleInfraAdvisor` to produce a `HostingOptionsMatrix` (AC-SC-02, AC-SC-03). While generating, the button text changes to "Generating..." with a 16px spinner, and the form fields enter a read-only state (`opacity: 0.6`, `pointer-events: none`). Target generation time: `< 10 seconds` (PRD Section 18.1).

---

## 4.4 Compliance Detection Banner

The Compliance Detection Banner auto-renders immediately below the classification results (Section 4.2.2) whenever the `ComplianceAutoDetector` (PRD Section 4.1) identifies one or more compliance framework signals. The banner is a full-width strip within the centered content column (`max-width: 680px`), `background: Cloud #F8FAFC`, `border: 1px solid Silver #CBD5E1`, `border-radius: 10px`, `padding: 16px 20px`.

### 4.4.1 Auto-Detected Frameworks as Dismissible Banner Chips

The banner header reads "Compliance frameworks detected" in 13px, `font-weight: 600`, `color: Ink #0F172A`, with an info icon (14px, Info #38BDF8) and a dismiss button (X icon, 16px, Slate #475569, right-aligned) that removes the entire banner with a fade-out animation (`opacity: 0` over `fast 150ms`, then `display: none`).

Below the header, framework chips render in a wrapping flex container with `gap: 8px`, `margin-top: 12px`. Each chip corresponds to one detected framework:

| Framework | Chip Background | Chip Border | Chip Text Color | Default Audit Policy Trigger |
|-----------|----------------|-------------|-----------------|------------------------------|
| GDPR | `rgba(239, 68, 68, 0.08)` | Error #EF4444 | Error #EF4444 | Data retention: 2555 days |
| HIPAA | `rgba(239, 68, 68, 0.08)` | Error #EF4444 | Error #EF4444 | Encryption at rest + in transit mandatory |
| PCI-DSS | `rgba(239, 68, 68, 0.08)` | Error #EF4444 | Error #EF4444 | Access logs: 365 days minimum |
| SOC2 | `rgba(245, 158, 11, 0.08)` | Warning #F59E0B | Warning #F59E0B | Audit trail: FULL tier required |
| ISO27001 | `rgba(245, 158, 11, 0.08)` | Warning #F59E0B | Warning #F59E0B | Risk assessment documentation required |
| CCPA | `rgba(56, 189, 248, 0.08)` | Info #38BDF8 | Info #38BDF8 | Consumer data deletion workflow required |

Chip specs: `padding: 6px 12px`, `border-radius: 16px`, `font-size: 12px`, `font-weight: 600`, `display: inline-flex`, `align-items: center`, with an 8px framework icon (shield, lock, or document) preceding the text. Frameworks classified as high-risk (GDPR, HIPAA, PCI-DSS) render with the red error styling; medium-risk (SOC2, ISO27001) with amber warning; and CCPA with blue info to reflect relative implementation complexity.

Each chip is individually dismissible via a small X icon (10px) on its right edge. Dismissing a chip removes that framework from the `AuditPolicy` pre-population list and records the dismissal in the `DecisionLedger` with rationale "User dismissed auto-detected framework."

### 4.4.2 Pre-Populated Audit Policy Defaults with User Review

Beneath the framework chips, a collapsible section labeled "Review audit policy defaults" contains the pre-populated `AuditPolicy` values derived from detected frameworks. This section implements AC-RI-08 and the closed Open Question #7 (PRD Section 19): compliance auto-detection results are user-reviewed before the RBAC Advisor runs.

The audit policy table renders with `width: 100%`, `border-collapse: separate`, `border-spacing: 0`, `font-size: 13px`. Table headers: "Policy Setting" and "Detected Default" in `font-weight: 600`, `color: Slate #475569`, `border-bottom: 1px solid Silver #CBD5E1`, `padding: 8px 0`.

Each row displays a policy setting (e.g., "Data Retention Period," "Encryption Requirement," "Access Log Retention") with its detected default value. Values render in a monospace inline code style (`font-family: monospace`, `background: White #FFFFFF`, `padding: 2px 6px`, `border-radius: 4px`, `font-size: 12px`) for precision. Rows derived from high-risk frameworks have a left border indicator (3px, Error #EF4444).

Each value cell includes an edit pencil icon (14px, Slate #475569, `opacity: 0.5`, hover → `opacity: 1.0` over `fast 150ms`) that transforms the cell into an inline input field for user override. All overrides are validated — for example, a retention period below the framework's minimum triggers a warning: "Value is below [Framework] recommended minimum of [X] days. Override anyway?"

A primary action button "Confirm and Continue to RBAC Advisor" (`width: 100%`, `height: 44px`, `background: Auth #E11D48`, `color: White #FFFFFF`, `border-radius: 8px`, `margin-top: 16px`) commits the `AuditPolicy` to the `DecisionLedger` and triggers the RBAC Advisor flow. The button label changes to "RBAC Advisor starting..." with a spinner for the `< 12 seconds` target RBAC generation time.

---

## Input Mode to UI Response Mapping

The following table maps every supported input mode to its corresponding UI response, dialogue flow, and AC references. This table serves as the single source of truth for frontend routing logic upon `RICHNESS_MODE_DETECTED` event receipt.

| Input Mode | Classification Trigger | Primary UI Response | Secondary UI | Dialogue Flow | PRD AC References |
|-----------|----------------------|--------------------|--------------|---------------|-------------------|
| Free-text description (500+ words, structured) | `WELL_FORMED` | PRD Analysis Report (Section 4.2.3) | Compliance banner (Section 4.4) | None — proceeds to Stage 1 validation | AC-RI-01, AC-RI-04, AC-RI-05, AC-RI-06 |
| Free-text description (50–499 words, partial structure) | `MINIMALIST` | Minimalist Dialogue (Section 4.3.1) | Compliance banner (Section 4.4) | 2–5 structured question cards | AC-RI-02 |
| Single sentence or product name | `SEED_ONLY` | Seed Builder (Section 4.3.2) | Compliance banner (Section 4.4) | 3–5 progressive question cards | AC-RI-03 |
| PRD file upload (.md, .txt, .pdf) | `WELL_FORMED` (typical) or `MINIMALIST` | Same as corresponding text classification | File metadata display (name, size, pages) | Same as corresponding text classification | AC-RI-01, AC-RI-07 |
| Legacy codebase upload (.zip) | `WELL_FORMED` + LegacyContextReport | LegacyContextReport summary panel | PRD Analysis Report for delta features | None — Stages 0–6 rerun with legacy context | AC-LG-01 |
| Git URL | Same as .zip upload path | Repository metadata (stars, language, last commit) | Same as .zip path | Same as .zip path | AC-LG-01 |
| Image upload | Pre-processed to text via vision model, then classified as above | Vision model extraction preview | Same as resulting classification | Same as resulting classification | — |
| CSV upload | Data schema seeding — bypasses richness classifier | Schema preview table with column type inference | "Generate API from schema" CTA | Minimalist Dialogue for API endpoint design | — |

The routing logic executes in the `PipelineStateStore` (PRD Section 6.4): upon `RICHNESS_MODE_DETECTED` event, the store reads `mode` and `gaps` from the event payload, looks up the row in this table, and dispatches the corresponding panel component. If `confidence < 85%`, the store overrides the primary response with a "Review Classification" interstitial that asks the user to confirm the detected mode before proceeding. This interstitial renders as a two-button choice ("Yes, that's right" / "No, let me correct") and records the user's confirmation or correction as a `DecisionLedger` entry with `provenance: "user_override_classification"`.

# 5. Main IDE Panel Specifications

The IDE contains nine functional panels arranged in a three-column layout with a collapsible bottom drawer (Section 4.2). Each panel consumes specific backend events (Section 14.2) and emits user actions (Section 14.1) through a shared WebSocket connection. This chapter specifies every panel's visual architecture, state matrix, interaction model, and event contract. All dimensional values are in pixels at a 1x viewport; color values use the semantic palette (Section 3.2); animation timing uses tokens from Section 3.5.

---

## 5.1 Chat Panel (Primary Input)

The Chat Panel occupies the leftmost column (default width 320px, resizable to 200–480px). It is the default and primary input surface per FR-IDE-01. Every session begins with a blank panel showing the placeholder *"Describe what you want to build..."* in Slate #475569 at 14px/400, centered in the input area.

### 5.1.1 Message Bubble Architecture

Each message renders as a bubble with alignment, color, and border determined by type. Bubble border-radius is 12px for user messages, 8px for system messages. Padding is 12px 16px. Maximum width is 85% of panel content. A 4px left border accent indicates subtype. Consecutive messages from the same sender collapse vertical gap from 16px to 4px. A 24px avatar appears only on the first message of a sender block. Rich cards are collapsible via a 16px chevron; collapsed state shows title and primary action only, reducing height to 48px minimum.

| Message Type | Alignment | Background | Left Border | Font | Prefix |
|---|---|---|---|---|---|
| User Intent | Right | #2563EB at 15% opacity | #2563EB 4px solid | 14px/400, #0F172A | None |
| User Command | Right | #7C3AED at 15% opacity | #7C3AED 4px solid | 14px/500 monospace, #0F172A | `/` slashed |
| User Feedback | Right | #10B981 at 15% opacity | #10B981 4px solid | 14px/400, #0F172A | None |
| System Response | Left | #F8FAFC | #CBD5E1 1px solid | 14px/400, #475569 | None |
| Rich Card | Left | #FFFFFF | Layer color 4px | 13px/400, #0F172A | Collapsible chevron |

### 5.1.2 Rich Chat Bubble Types

Four rich card types render inline, each triggered by a backend event. All cards share shadow `0 1px 3px rgba(15,23,42,0.08)` and 1px Silver border.

**SteeringPanel Card.** Triggered by `STEERING_PANEL_READY`. Header shows stage name (14px/600) and context summary (12px/400 Slate). Body is a scrollable option list (max-height 240px) with radio buttons, titles, rationale text, and impact badges. Action bar: **Accept** (primary, #2563EB), **Modify**, **Replace** (secondary), **Authorize** (tertiary, shown when `requires_authorization` is true). Card entry animation: 250ms slide-up from `translateY(8px)`, standard easing.

**Impact Report Card.** Triggered by `IMPACT_REPORT_READY`. Two-column diff layout: "Before" in Slate, "After" with additions in #10B981 at 10% bg and deletions in #EF4444 at 10% bg with strikethrough. Each row shows node type icon (16px), name (13px/500), severity badge (LOW/MEDIUM/HIGH/CRITICAL), and expand chevron. CRITICAL severity uses a pulsing 2px border at 1.5s cycle.

**Code Stream Card.** Triggered by `CODE_FILE_STREAM`. Embedded Monaco view (max-height 200px). Header: file type icon, path (12px/500 monospace), progress bar (4px, #2563EB fill), **Jump to File** button. Paused state shows semi-transparent "Paused" overlay with **Resume**.

**Test Result Card.** Triggered by `TEST_RESULT_STREAM`. Collapsed: 64px height showing test name (13px/500), pass/fail badge (20px circle, #10B981 or #EF4444), and duration (11px/400). Expanded: assertion output, stack trace with clickable file paths, **Debug** button. Failures render with 2px left border in #EF4444.

### 5.1.3 Command Palette

Typing `/` in the input opens a floating dropdown (240px wide, 280px max-height, positioned above input). Commands filter in real-time.

| Command | Syntax | Trigger | Help Text | Emitted Event |
|---|---|---|---|---|
| `/steer` | `/steer [target] [instruction]` | `/st` | "Modify a node mid-stream" | `MID_STAGE_STEER` |
| `/revert` | `/revert [decision_id]` | `/rev` | "Revert to previous decision" | `REVISION_REQUEST` |
| `/checkpoint` | `/checkpoint [label]` | `/ch` | "Create named checkpoint" | `CHECKPOINT_RESTORE_REQUEST` |
| `/why` | `/why [node_or_file]` | `/wh` | "Ask why — queries ContextAgent" | `CONTEXT_QUESTION` |

Each row is 40px with 12px padding. Hover fills #F8FAFC; selected row uses 2px left border in #2563EB. Keyboard: Up/Down to select, Enter to execute.

### 5.1.4 Chat History

Chat history is a scrollable reverse-ordered list backed by persistent storage. A 200px search input in the header matches message text, commands, and card titles; results highlight terms in #2563EB at 20% opacity. Every steering decision has a clickable chip ("Decision #AUTH-001", 10px/500, #2563EB at 10% bg) navigating to the Audit Panel. The user may ask contextual questions ("Why did you pick PostgreSQL?"); the ContextAgent queries the Decision Ledger and Audit Trail, returning a System Response bubble with cited `DecisionEntry` and `AuditEvent` IDs.

**Chat Panel Wireframe:**

```
+--------------------------------------------------+
| Chat                                    [Q] [=]   |
+--------------------------------------------------+
|                                                   |
|         +------------------------------+          |
|         | I need a SaaS for dentists   |  User   |
|         | to manage appointments       |  Intent |
|         +------------------------------+          |
|                                                   |
|  +-----------------------------------------------+|
|  | System: Great! I'll help you build that.      ||
|  | Let me start with Actor Discovery...           ||
|  +-----------------------------------------------+|
|                                                   |
|  +-----------------------------------------------+|
|  | [SteeringPanel Card]                           ||
|  | Stage 1: Actor Discovery                       ||
|  | o Patient - Primary user                       ||
|  | o Dentist - Provider                           ||
|  | o Receptionist - Staff                         ||
|  | [Accept] [Modify] [Replace] [Authorize]        ||
|  +-----------------------------------------------+|
|                                                   |
|         +------------------------------+          |
|         | /steer add "Insurance...     |  Command|
|         +------------------------------+          |
|                                                   |
|  +-----------------------------------------------+|
|  | [Impact] 3 nodes affected, MED severity       ||
|  | ActorList: +InsuranceVerifier (green)          ||
|  | AuthPolicy: +canVerifyInsurance (amber)        ||
|  +-----------------------------------------------+|
+--------------------------------------------------+
|  Type / for commands...               [Send] [✂]  |
+--------------------------------------------------+
```

---

## 5.2 Steering Panel (Stage Boundary Review)

The Steering Panel is a context-aware overlay in the center column, appearing when `STEERING_PANEL_READY` is emitted. It fills the full center column when active, replacing Editor content. When inactive, it collapses to a floating badge.

### 5.2.1 Collapsed State

The collapsed badge is a 280px x 48px pill at bottom-center of the center column, 16px from bottom, z-index 50. Background: White #FFFFFF, 1px Silver border, shadow `0 4px 12px rgba(15,23,42,0.12)`, border-radius 24px. Content: stage icon (20px, layer-colored), stage name (13px/600), node count badge (10px/500, "12 nodes"), and action indicator. Pending review: pulsing 8px dot in #F59E0B, `scale(1)` to `scale(1.4)`, 1.5s cycle. All auto-approved: static #10B981 dot. Critical nodes pending: pulsing #EF4444 border at 1s cycle.

**Collapsed Steering Panel Wireframe:**

```
+--------------------------------------------------+
|                                                   |
|              (Editor content visible)              |
|                                                   |
|              +-------------------------+          |
|              | [icon] Stage 3: Capab.. |          |
|              |        12 nodes   [●]   |          |
|              +-------------------------+          |
|                ^ floating pill, bottom-center      |
+--------------------------------------------------+
```

### 5.2.2 Expanded State

Clicking the badge (or `auto_expand: true`) expands to fill the center column. Transition: 400ms morph from badge to full size, content fades in at 150ms delay. Four regions stacked vertically:

**Stage Header** (64px fixed): Back button (32px), title (18px/700), description (12px/400 Slate), close button. Background #F8FAFC, 1px bottom border Silver.

**Draft Output List** (flex-grow, scrollable): Node list with Summary/Detail toggle in header.

**Context Window** (max 120px, collapsible): "Why these outputs?" label (11px/600 uppercase), explanation (12px/400), "Tell me more" ContextAgent link.

**Action Bar** (56px fixed, sticky bottom): **Approve All** (primary, shown when all nodes approvable), **Review Selected** (secondary, enabled with 1+ selections), **Bookmark** (tertiary, 36px), trust mode chip ("BALANCED — 8 auto-approved", 11px/500).

**Expanded Steering Panel Wireframe:**

```
+--------------------------------------------------+
| [<] Stage 3: Capability Definition        [x] [?]|
| Define what your application can do                |
+--------------------------------------------------+
| [Summary | Detail]    Trust: BALANCED (8 auto)    |
+--------------------------------------------------+
|                                                   |
| o [◻] User Authentication   [MEDIUM] [⚠] [★]    |
|   Auth layer, 3 downstream files                  |
|                                                   |
| o [◻] Appointment Booking   [LOW] [✓] (auto)    |
|   Standard CRUD, boilerplate                      |
|                                                   |
| o [◻] Payment Processing    [CRITICAL] [▲] [★]  |
|   Security layer, 7 downstream files              |
|   [ ] I consent to this implementation            |
|                                                   |
+--------------------------------------------------+
| Why these outputs? Based on your inputs...        |
+--------------------------------------------------+
| [Approve All] [Review Selected] [★] [Bookmark]    |
+--------------------------------------------------+
```

### 5.2.3 Summary Mode (<500ms Render)

Default view, target <500ms from event to interactive. Paginated list: 20 nodes/page, 56px rows. Each row: 18px checkbox (2px Silver border, checked fills #2563EB), 16px node type icon, name (13px/500, ellipsis at 200px), status icon (16px check/triangle/clock), risk badge (pill, colored by level), 16px bookmark star. Pagination: Previous/page numbers/Next, 28px tall. Keyboard: Page Up/Down, Space toggles selection, Enter opens detail.

### 5.2.4 Detail Mode

Expandable node cards, 1px Silver border, 8px radius, 16px padding. One card expanded at a time. Expanded content: header (name 16px/600, badges), full JSON tree view (12px monospace, max-height 300px), provenance chain (32px circles connected by 2px lines, clickable steps), inline Monaco editor toggled via **Edit** button. **Save** emits `STEERING_ACTION` with `modify`; **Discard** reverts.

### 5.2.5 Trust Mode Integration

Per PRD Section 7.3, the active Trust Policy determines per-node approval behavior.

| Policy | LOW_RISK | MEDIUM | HIGH | CRITICAL | Visual Indicator |
|---|---|---|---|---|---|
| PARANOID | Paused, checkmark | Paused, warning | Paused, warning | Paused, red border + checkbox | Red badge, "All Paused" |
| BALANCED | Auto-approved, green check | Paused, amber | Paused, amber | Paused, red border + checkbox | Amber badge, "N auto-approved" |
| AUTO_PILOT | Auto-approved, green check | Auto-approved, green | Paused, amber | Paused, red border + checkbox | Green badge, "N auto-approved" |

Auto-approved: checkbox pre-checked and disabled, green checkmark badge (16px, #10B981). CRITICAL: 2px left border #EF4444, required consent checkbox ("I consent") must be checked before **Approve All** activates.

### 5.2.6 Bookmark and Comparison

Each option has a 16px star bookmark toggle. Bookmarked items collect in a 320px comparison drawer sliding from right (300ms). Side-by-side layout: two columns showing option title, rationale, affected nodes, risk badges. Differences highlighted: additions in #10B981, removals in #EF4444 with strikethrough, modifications in #F59E0B. **Select This Option** button per column emits `STEERING_ACTION` with chosen ID.

---

## 5.3 File Explorer

The File Explorer occupies the left sidebar below the Chat Panel (full height, split via draggable sash). Auto-populated during Stage 8 per FR-IDE-06. Before Stage 8, shows empty state: 48px document icon (#475569 at 30%) and "Files will appear during code generation" (12px/400).

### 5.3.1 Tree View Architecture

Collapsible tree with workspace root at top. Auto-expands first three levels. Each node: 32px row, 8px left padding per depth level (0/16/32/48px, max 64px). Folder nodes: 12px chevron (right/down), 16px folder icon (#F59E0B, 70% when open), folder name (13px/500). File nodes: 16px layer icon (Section 5.3.2), filename (13px/400), state indicator (Section 5.3.3). Chevron rotation: instant; child appearance: 150ms fade-in. Keyboard: Right expands, Left collapses, Up/Down moves focus, Enter opens.

**File Explorer Wireframe:**

```
+--------------------------------------------------+
| Explorer                              [Refresh]   |
+--------------------------------------------------+
| ▼ src/                                            |
|   ▼ frontend/                            [blue ●] |
|     ▼ components/                                 |
|       Login.tsx                          [blue ✓] |
|       Dashboard.tsx                      [blue ○] |
|       AppointmentCard.tsx                [blue ✓] |
|     ▼ hooks/                                      |
|       useAuth.ts                         [blue ✓] |
|     App.tsx                              [blue ✓] |
|   ▼ backend/                             [green ●]|
|     ▼ api/                                        |
|       auth.routes.ts                     [green ✓]|
|       appointments.routes.ts             [green ▲]|
|     ▼ models/                                     |
|       User.ts                            [green ✓]|
|       Appointment.ts                     [green ✓]|
|   ▼ database/                            [orange ●|
|     schema.sql                           [orange ✓|
|   ▼ infra/                               [purple ●|
|     docker-compose.yml                   [purple ✓|
|   ▼ auth/                                [red ●]  |
|     rbac.config.ts                       [red ✓]  |
|   ▼ tests/                               [yellow ●|
|     auth.test.ts                         [yellow ✓|
|     appointments.test.ts                 [yellow ✗|
+--------------------------------------------------+
```

### 5.3.2 Layer Icon System

Each file displays a 16px layer icon by `layer` metadata set during Stage 8.

| Layer | Shape | Color | Tooltip |
|---|---|---|---|
| Frontend | Circle (filled, 16px) | #2563EB | "Frontend — UI components, hooks, styles" |
| Backend | Square (filled, 14px) | #059669 | "Backend — API routes, controllers, models" |
| Database | Cylinder (14x16px) | #D97706 | "Database — Schema, migrations, queries" |
| Infra | Cloud (16px wide) | #7C3AED | "Infrastructure — Docker, K8s, CI/CD" |
| Auth | Shield (14x16px) | #E11D48 | "Auth — RBAC, JWT, session management" |
| Test | Checkmark in circle (16px) | #CA8A04 | "Test — Unit, integration, e2e" |
| DevOps | Gear (16px) | #78716C | "DevOps — Deployment, monitoring" |
| Security | Lock (12x16px) | #DC2626 | "Security — Encryption, compliance" |

Icons are SVG at 16px with 2px padding. Folder badges: 6px circle top-right of folder icon, colored by plurality layer of contained files.

### 5.3.3 File States

Each row shows a state indicator at the right edge (20px from edge).

| State | Icon | Color | Trigger |
|---|---|---|---|
| Generating | Spinner (12px, 360deg/1s) | #475569 | `CODE_FILE_STREAM` without `CODE_FILE_COMPLETE` |
| Complete | Checkmark in circle (12px) | #10B981 | `CODE_FILE_COMPLETE` received |
| Modified | Solid dot (8px) | #F59E0B | User edits, `EDITOR_CHANGE` emitted |
| Conflict | Warning triangle (12px) | #EF4444 | Backend `NODE_MODIFIED` conflicts with local |
| Stale | Grayed checkmark (12px) | #CBD5E1 | Regenerated since last open |

Priority: Conflict > Stale > Modified > Generating > Complete. Generating-to-Complete transition: 300ms scale-up (0 → 1.2 → 1.0), #10B981 fade-in.

### 5.3.4 Context Menu

Right-click opens a context menu (180px wide, cursor-positioned, shadow `0 4px 16px rgba(15,23,42,0.15)`). Items: 32px tall, 12px padding, 16px leading icon.

| Item | Icon | Action | Event |
|---|---|---|---|
| Steer | Steering wheel (16px, #2563EB) | Opens Chat with file context | `CODE_FILE_STEER` (`modify`) |
| Why | Question circle (16px, #38BDF8) | Opens Audit filtered to file | `AUDIT_FILTER` |
| Diff | Split columns (16px, Slate) | Opens diff viewer | `FILE_OPEN_REQUEST` (`diff`) |
| Regenerate | Refresh arrow (16px, #10B981) | Triggers Stage 8 for file | `CODE_FILE_STEER` (`regenerate`) |

**Regenerate** requires confirmation: 360px modal, "Regenerating will overwrite current content." with **Cancel** and **Confirm Regenerate** (#F59E0B). Menu dismisses on outside click, 100ms fade-out.

### 5.3.5 Provenance Tooltip

Hovering a file (500ms debounce) shows a 360px tooltip below the row (12px offset). Background White, 1px Silver border, 8px radius, shadow `0 4px 16px rgba(15,23,42,0.12)`. Four sections separated by Silver rules:

1. **"Why this file exists"** (11px/600 uppercase header; 12px/400 body): Plain-English from `EngineeringTask.description` + linked `UserStory.title`.
2. **Decision chain** (12px/400): Vertical arrow-prefixed list, e.g., *"→ Capability 'Auth' approved [S3] → Story AUTH-001 → Task AUTH-BE-001 → File generated [S8]"*. Each link navigates to the relevant panel.
3. **Ledger link**: "View in Decision Ledger" button (#2563EB, 12px/500).
4. **Audit link**: "View Audit Trail" button (#38BDF8, 12px/500).

---

## 5.4 Editor (Monaco/CodeMirror)

The Editor occupies the center column when no Steering Panel is active. Monaco instance with syntax highlighting, IntelliSense, and diff. Background matches IDE theme.

### 5.4.1 File Tab Bar

Horizontal tabs at editor top, 36px tall, 1px Silver bottom border, #F8FAFC background. Each tab: 120–200px wide, 12px layer icon, filename (12px/500, ellipsis), modified dot (6px, #F59E0B), close button (14px X, hover-visible). Active tab: 2px bottom border #2563EB, White bg, 12px/600. Tabs are drag-reorderable with 150ms ghost preview; overflow scrolls horizontally or collapses to dropdown.

### 5.4.2 Live Diff Streaming

During Stage 8, files stream via `CODE_FILE_STREAM`. Visual indicators:

- **Progress bar:** 28px bar at editor top, #2563EB at 8% bg, 12px pulsing dot (#2563EB, opacity 0.4→1.0, 1s), "Generation in progress..." (12px/500), **Pause** button. Slides down (250ms enter) on stream start, up on `CODE_FILE_COMPLETE`.
- **Streaming cursor:** 2px vertical bar in #2563EB, 530ms blink, at end of last chunk.
- **Pause:** Emits `MID_STAGE_STEER` (`pause`). Bar text changes to "Paused — click Resume", cursor turns static #F59E0B.
- **Chunk rendering:** `pushEditOperations` appends without re-tokenization; highlighting applies incrementally.

### 5.4.3 Inline Steering

`// @steering: [instruction]` comments parse as `MidSteerSignal`. Visual treatment: comment bg #2563EB at 6% opacity, `@steering:` token bold (14px/600, #2563EB), 16px steering wheel icon in gutter, instruction text in #475569 italic with underline. On Enter, a floating pill appears: **Submit** (24px, #2563EB bg) and **Dismiss** (24px, Silver border). Submit emits `MID_STAGE_STEER`; comments strip before execution but persist until regeneration.

### 5.4.4 Editor Chrome

- **Syntax highlighting:** Full language support (TS, JS, Python, SQL, YAML, Docker, JSON). Keywords #7C3AED, strings #059669, functions #2563EB, comments #94A3B8, numbers #D97706.
- **Line numbers:** 48px gutter, 12px/400 #475569, active line 12px/600 #0F172A.
- **Minimap:** Right side, 80px wide, collapsible via `Ctrl/Cmd+M` or 16px toggle. Collapsed: 4px color bar. Rendering: text at 1/8 scale, colored by syntax.
- **Status bar:** 24px bottom bar. Left: cursor ("Ln 42, Col 7", 11px/400), selection ("Selected 128 bytes", when active). Right: encoding ("UTF-8", 11px), line endings ("LF"/"CRLF", 11px), language ("TypeScript", 11px), layer badge (colored dot + name, 10px/500).

---

## 5.5 Live Preview Panel

The Live Preview occupies the rightmost column (default 400px, resizable 280–640px). Renders the running application per FR-IDE-11.

### 5.5.1 Sandbox Container

Web apps render in an iframe: `sandbox="allow-scripts allow-same-origin"`, filling 100% of panel minus 36px device toolbar. Backend services show a **Service Status Card** (280px centered): Docker name, status indicator (green pulse running / red stopped), port mappings (12px monospace), runtime logs (scrollable, 200px max). Disconnected overlay: #F8FAFC at 90%, 48px plug icon (#475569), "Runtime not started. Complete Stage 8 to launch." (14px/400).

### 5.5.2 Interactive Element Detection

Per FR-IDE-12, clicking a preview element sends `PREVIEW_INTERACTIVE_ELEMENT` via postMessage. The corresponding file highlights in File Explorer (2px pulse border #2563EB, 2s) and opens in Editor (relevant line scrolled with yellow highlight fade, 3s). Right-click shows context menu (160px): **Change this element** (`PREVIEW_FEEDBACK`, "change"), **Add validation here** ("validation"), **Make admin-only** ("rbac"). Items: 32px, 14px icons.

### 5.5.3 Hot Reload Indicator

Frontend file regeneration triggers HMR via WebSocket per FR-IDE-13. Visual feedback: pulse ring from center (40px circle, #10B981 border, opacity 0.6→0, scale 0.5→2.0, 600ms). Full-refresh fallback: 36px countdown banner slides down ("Reloading in 3s..." + **Cancel**), counts 3→2→1→Reloading. Cancel aborts; "Reload paused — click to resume" with **Resume**.

### 5.5.4 Device Frame Toggle

36px toolbar at panel top. Four toggles (32px square, 4px gap): **Desktop** (monitor, 1280px), **Tablet** (tablet, 768px), **Mobile** (phone, 375px), **Full Width** (expand, 100%). Active: 2px bottom border #2563EB, #F8FAFC bg. Iframe width transitions 250ms standard easing, centered with #F8FAFC gutter.

---

## 5.6 Terminal Panel

The Terminal occupies the bottom drawer (default 200px, collapsible to 0px, expandable to 480px). Shell access to workspace runtime.

### 5.6.1 xterm.js Integration

Full xterm.js instance: font "JetBrains Mono" 13px/400, line-height 1.4, block cursor, blink on, 10,000-line scrollback. Color scheme matches IDE theme.

| Token | Light | Dark |
|---|---|---|
| Background | #FFFFFF | #0F172A |
| Foreground | #0F172A | #F8FAFC |
| Cursor | #2563EB | #60A5FA |
| Selection | #2563EB at 20% | #60A5FA at 25% |
| Red | #EF4444 | #F87171 |
| Green | #10B981 | #34D399 |
| Blue | #2563EB | #60A5FA |

Panel header: 28px, #F8FAFC bg, shell name (12px/500), connection dot (8px, #10B981 connected / #EF4444 disconnected), clear/maximize/close controls.

### 5.6.2 Command Interception

Per FR-IDE-15, dangerous commands match a denylist: `rm -rf /`, `rm -rf /*`, `git reset --hard`, `git clean -fd`, `chmod -R 777 /`, `dd if=* of=*`, `mkfs.*`, `> /dev/sda`, fork bomb, any `sudo` prefix. Match triggers a 400px modal: #F59E0B 48px icon, "Dangerous Command Detected" (16px/600), command in monospace (#EF4444 at 5% bg), explanation (13px/400), **Cancel** and **Execute Anyway** (#EF4444, 3-second hold countdown "Execute Anyway (3)" → "Execute Anyway"). Toggle in Settings disables per-session (default on).

### 5.6.3 Interleaved Output Streams

Four output categories, each prefixed with a color-coded tag:

| Stream | Prefix | Color | Source |
|---|---|---|---|
| Dependency Install | `[deps]` | #7C3AED | `DEPENDENCY_INSTALL_STATUS` |
| Build Output | `[build]` | #2563EB | Build stdout/stderr |
| Runtime Logs | `[runtime]` | #10B981 | Dev server stdout/stderr |
| Test Execution | `[test]` | #CA8A04 | `TEST_RESULT_STREAM` |

Prefix: 10 chars wide, right-padded, 12px/500 monospace. Filter bar (28px) with four checkbox chips toggles streams. Lines are timestamped internally (hover shows ISO timestamp); hidden by default. When terminal is hidden, badge on toggle button shows unread error-line count (red circle, 16px).

---

## 5.7 Test Results Panel

Shares bottom drawer with Terminal and Audit, accessed via "Tests" tab. Displays test suite output.

### 5.7.1 Test List

Scrollable list, 40px rows (56px expanded). Grouped by file; group header 32px (folder icon + filename 12px/600 + count badge). Each row: 20px status icon (green check / red X / gray dot), test name (13px/400, ellipsis at 400px), duration (11px/400 Slate, "142ms" or "2.3s"), 12px expand chevron. Expanded: assertion details (12px monospace), expected/actual diff, stack trace with clickable file paths. Failures: 2px left border #EF4444. Pending: 2px left border Silver. Auto-scrolls to first failure.

### 5.7.2 Aggregate Summary Bar

48px bar below tab bar: total count ("47 tests", 14px/600), pass rate (120px progress bar, 8px, #10B981/#EF4444 fill + "92%" 12px/600), total duration ("4.2s", 12px/400), status badge (pill, 24px, 10px/500: "All passing" green / "X failures" red / "Running..." #2563EB pulsing).

### 5.7.3 Re-run and Debug Controls

Per-row buttons (hover-visible, always for failures): **Re-run** (16px refresh, 28px, #2563EB on hover; emits `TEST_RERUN`) and **Debug** (16px bug, 28px, Slate hover; emits `TEST_DEBUG`, opens Editor at test definition, injects `debugger;`). Suite-level: **Run All** (primary, #2563EB) and **Run Failed** (secondary, #EF4444 border, shown when 1+ fail).

---

## 5.8 Blueprint Graph Panel

Occupies center column when activated (toolbar or `Ctrl/Cmd+Shift+G`). Interactive graph with pan, zoom, and node interaction.

### 5.8.1 2D/3D Graph Visualization

Force-directed layout, full center column. Minimap: 160px square, bottom-right, 1px Silver border, 1/8 scale, draggable viewport rect.

| Node Type | Shape | Size | Fill | Border | Icon |
|---|---|---|---|---|---|
| Actor | Hexagon (flat-top) | 48px diameter | Layer color at 20% | 2px solid layer | Person (16px) |
| Capability | Diamond (45deg square) | 56px diagonal | Layer color at 20% | 2px solid layer | Star (14px) |
| Use Case | Ellipse | 64px x 40px | Layer color at 15% | 2px solid layer | Briefcase (14px) |
| User Story | Rounded rectangle | 72px x 32px | Layer color at 15% | 2px solid layer | Book (14px) |
| Eng. Task | Parallelogram (15deg) | 80px x 28px | Layer color at 15% | 2px solid layer | Wrench (12px) |
| File | Document (rounded rect) | 40px x 48px | Layer color at 20% | 2px solid layer | Extension (8px) |

Labels below shape: 10px/500, #0F172A, 80px max, ellipsis. Hover tooltip: 200px card with name, type, layer, status, "Steer this node" button. Selected: 3px outer glow #2563EB at 40%, 4px spread.

**Blueprint Graph Wireframe:**

```
+--------------------------------------------------+
| Blueprint Graph                    [2D] [3D] [?] |
| [Actors ✓] [Caps ✓] [Stories ✓] [Tasks ✓] [Files✓|
+--------------------------------------------------+
|                                                   |
|           [Hex] Patient (Actor)                   |
|               /      \                            |
|              /        \                           |
|      [Dia] Booking   [Dia] Auth                   |
|      (Capability)    (Capability)                 |
|          |               |                        |
|      [Ell] Schedule  [Ell] Login                  |
|      (Use Case)      (Use Case)                   |
|          |               |                        |
|      [Rect] APPT-001 [Rect] AUTH-001              |
|      (Story)          (Story)                     |
|          |               |                        |
|      [Para] task-1    [Para] task-2               |
|          |               |                        |
|      [Doc] appts.ts   [Doc] auth.ts               |
|                                                   |
|                              +---------+          |
|                              | minimap |          |
|                              +---------+          |
+--------------------------------------------------+
| Legend: ── dependency  - - traceability  ·· prov. |
+--------------------------------------------------+
```

### 5.8.2 Edge Types

| Edge Type | Style | Color | Width | Arrowhead |
|---|---|---|---|---|
| Dependency | Solid | #475569 at 60% | 2px | Filled triangle, 8px |
| Traceability | Dashed (8/4px) | #38BDF8 at 50% | 1.5px | Open triangle, 6px |
| Decision Provenance | Dotted (3/3px) | Layer color at 70% | 2px | Filled diamond, 6px |

Edge labels at zoom > 0.7: 9px/400 #475569, White bg, 2px padding. Hover: full opacity, +1px width. Click: 240px relationship card with source/target summaries.

### 5.8.3 Layer Color Coding

Nodes colored by architectural layer using Section 5.3.2 mapping. Applied as: shape border (2px solid), fill (15–20% opacity), label underline (1px, 30% opacity), provenance edge color. Bottom legend (28px): all eight layers as toggleable filters; click hides/shows nodes with 250ms fade.

### 5.8.4 What-If Mode

Activated by "What-If" toggle in header (28px, #2563EB when active). Nodes become draggable with 50ms trailing delay. Drop zones highlight at 48px proximity: dashed 2px #F59E0B border with target label. On drop, impact overlay slides up (300px, 400ms): affected count, severity breakdown, file list, estimated regen time. Affected nodes pulse #F59E0B border at 1s; unaffected dim to 40%. Overlay buttons: **Simulate Impact** (recalculate), **Commit Change** (emits `STEERING_ACTION`), **Discard** (snap-back, 300ms).

---

## 5.9 Audit Panel

Shares bottom drawer via "Audit" tab. Two views: Decision Ledger and Audit Trail.

### 5.9.1 Decision Ledger View

Default tab. Chronological list (newest first) of `DecisionEntry` records. Each row: 48px, 8px status circle (#10B981 active / #CBD5E1 superseded / #EF4444 cancelled), decision ID badge (10px/500 monospace, Cloud bg), stage ref ("Stage 3", 11px/400), summary (12px/400), relative timestamp (11px/400, hover for ISO), expand chevron. Expanded: full JSON tree (12px monospace), linked nodes, revision chain ("Superseded by DEC-057"), **Initiate Revision** button (emits `REVISION_REQUEST`). Superseded: strikethrough summary. Cancelled: #EF4444 left border + "Cancelled: [reason]".

### 5.9.2 Audit Trail View

Chronological (oldest first, append-only). Each event: 40px row with action type badge (pill: steering #2563EB, codegen #10B981, system #475569, error #EF4444), stage ref ("S3"/"S8", 11px monospace), description (12px/400), timestamp (ISO, 11px/400), actor (11px/400 italic). Mutating actions include **View Diff** opening a 640x480px modal with two-column diff (additions #10B981, deletions #EF4444). Filter bar (40px): action type chips, stage dropdown, date range picker, actor input with autocomplete. Active filters as removable chips. Result count: "Showing 47 of 1,234 events" (11px/400).

### 5.9.3 Search and Filter

Semantic search input (240px) accepts natural language: *"Show me all decisions that affected the auth layer"*. Processing: (1) ContextAgent parses intent, extracts filters; (2) filter chips auto-populate ("Layer: auth", "Action: decision"); (3) results update at 250ms debounce; (4) relevance score in hover tooltip, matching terms highlighted. Saved searches dropdown shows last 10 queries. Filter chips: X removes constraint; clicking value cycles alternatives ("auth" → "frontend" → "all").

## 6. Interaction Micro-States & Feedback

Every interface surface shall communicate pipeline state through consistent visual micro-states. This section specifies the indicator system, loading patterns, success confirmations, error surfaces, warning badges, and empty-state illustrations that collectively ensure the user always understands what the system is doing, what has failed, and what action is required. All color values reference the semantic palette defined in Section 2; all timing values use the animation token system.

---

### 6.1 Global State Indicator System

#### 6.1.1 Pipeline State Badge in Toolbar

The primary pipeline state indicator is a colored dot + state name label anchored to the left side of the top toolbar, immediately right of the application logo. The badge shall update within 100 ms of any `PIPELINE_STATE_CHANGED` WebSocket event. The dot diameter is 8 px with a 1.5 px ring; the state name uses the toolbar font stack at 12 px / 500 weight in Ink #0F172A.

The badge supports five discrete visual states mapped directly to the finite state machine (PRD §7.1). Pulse animations for active states use a CSS keyframe: scale 1.0 → 1.4 → 1.0 over 2 s, infinite, with opacity decay on the ring from 0.6 → 0.0.

| Pipeline State | Dot Color | Dot Style | Label Text | PRD Ref |
|---|---|---|---|---|
| `INITIALIZED` | #94A3B8 (Slate 400) | Static fill, no ring | "Ready" | §7.1 |
| `STREAMING` | #10B981 (Success) | Animated pulse, green ring | "Generating…" | §7.1 |
| `AWAITING_STEERING` | #F59E0B (Warning) | Animated pulse, amber ring | "Action Required" | §7.1 |
| `ERROR` | #EF4444 (Error) | Static fill, 2 px red ring | "Error" | §7.2 |
| `FINALIZED` | #2563EB (Frontend) | Static fill, no ring | "Complete" | §7.1 |

The badge occupies a 140 × 28 px bounding box. The 8 px dot sits 10 px from the left edge, vertically centered. The label begins 10 px right of the dot. The badge has 8 px horizontal and 4 px vertical padding, 4 px border-radius, background Cloud #F8FAFC at 80% opacity. State transitions use `background-color` over fast 150 ms with standard easing `cubic-bezier(0.4,0,0.2,1)`.

States not listed (CLASSIFYING, STAGE_RUNNING, IMPACT_ANALYZING, REVISING, CHATTING, CODE_GENERATING, DEPLOYING, DEPLOYED) collapse into `STREAMING` for active-running states and `AWAITING_STEERING` for pause-point states.

#### 6.1.2 Browser Tab Title Updates

The browser tab title shall follow the format `[Status] Stage N — Title` per NF-NT-01. Status prefix values: `[Ready]`, `[Running]`, `[Action Needed]`, `[Error]`, `[Complete]`. The Stage N is the current stage number (0–9); Title is the stage's human-readable name. Examples: `[Action Needed] Stage 3 — Collaborative Steering`, `[Running] Stage 8 — Code Generation`. Title updates execute via `document.title` within 50 ms of `STEERING_PANEL_READY` or `PIPELINE_STATE_CHANGED` event receipt (PRD §14.2, §18.5).

#### 6.1.3 Toast Notification System

Toast notifications provide ephemeral, non-blocking feedback per NF-NT-01 and NF-NT-02.

**Position:** Fixed top-right, 16 px from viewport right, 72 px from viewport top. Width: 360–420 px. Z-index: 5000.

**Auto-dismiss:** Default 5 s. Hovering pauses the timer. Error toasts never auto-dismiss.

**Structure:** 4 px left border in severity color; 16 × 16 px severity icon (12 px padding); title line (14 px / 600); optional body (13 px, Slate #475569); 0–2 text action buttons (12 px, severity-colored). Border-radius: 8 px. Background: White #FFFFFF. Shadow: `0 4px 12px rgba(15,23,42,0.08)`.

| Severity | Left Border | Icon | BG Tone | Auto-Dismiss | Button Style |
|---|---|---|---|---|---|
| Success | #10B981 | CheckCircle | White | 5 s | Green text, hover underline |
| Warning | #F59E0B | AlertTriangle | White | 5 s | Amber text, hover underline |
| Error | #EF4444 | XCircle | #FEF2F2 | Never | Red text, hover underline |
| Info | #38BDF8 | Info | White | 5 s | Blue text, hover underline |

Entrance: slide from right 60 px + fade 0→1 over fast 150 ms, enter easing `cubic-bezier(0,0,0.2,1)`. Exit: slide up 20 px + fade 1→0 over fast 150 ms, exit easing `cubic-bezier(0.4,0,1,1)`. Stacked toasts maintain 8 px vertical gap.

---

### 6.2 Loading States

Every long-running operation displays a loading state communicating progress without blocking unrelated panels.

#### 6.2.1 Skeleton Screens for Panel Content

During initial panel load, skeleton placeholders display instead of blank canvases. Skeleton blocks use #E2E8F0 base with a shimmer gradient `linear-gradient(90deg, #E2E8F0 0%, #F1F5F9 50%, #E2E8F0 100%)` at background-size 200%, animating 1.5 s linear infinite. Each panel's skeleton matches anticipated content: File Explorer shows 8 horizontal bars (16 px height, 60–100% width, 8 px gap); Editor shows a title bar (20 px) plus 12 lines of varying width; Steering Panel shows a header bar (120 × 16 px) plus three content bars (80% width). Border-radius: 4 px. Skeletons fade out over normal 250 ms once real content is ready.

#### 6.2.2 Chunk Streaming Indicator

In `STREAMING_CHUNKS` state, a 320 × 36 px indicator appears at the bottom of the active panel containing: (1) an indeterminate progress bar (3 px height, full width, Frontend #2563EB, sweep animation 1.2 s ease-in-out infinite), (2) a label (12 px, Slate #475569) reading "Generating {entity_type}: {entity_name}…" updated from `CODE_FILE_STREAM` or `NODE_PENDING` event metadata with 100 ms debounce.

#### 6.2.3 Dependency Installation Progress

Dependency installation (Stage 8, AC-CG-06) renders in the Terminal panel via `DEPENDENCY_INSTALL_STATUS` events. Each log line is prefixed with a timestamp in #94A3B8 at 11 px.

| Step Label | Spinner Color | Terminal Prefix | Transition Trigger |
|---|---|---|---|
| "Resolving dependencies…" | #38BDF8 (Info) | `[resolve]` | Logs contain "Resolving" |
| "Downloading packages…" | #2563EB (Frontend) | `[download]` | Logs contain "Downloading" or "fetch" |
| "Linking dependencies…" | #059669 (Backend) | `[link]` | Logs contain "Linking" or "Done" |

A 16 × 16 px spinner (360° rotation, 1 s linear infinite) accompanies the step label. Progress percentage (0–100) appears right-aligned in the terminal header, parsed from package manager output. On failure, the spinner stops, turns Error #EF4444, and error lines render in red from the failure point.

#### 6.2.4 Impact Analysis Loading State

In `IMPACT_ANALYZING` state, the Impact Report panel displays a skeleton graph overlay: semi-transparent backdrop `rgba(248,250,252,0.85)`, centered message "Computing downstream effects…" (14 px / 500), sub-line "Analyzing N nodes…" (12 px, Slate #475569) with N updating in real-time. Existing graph nodes de-saturate to 30% opacity; edges fade to 15%. A pulsing Frontend-colored ring (`#2563EB` at 40% opacity, scale pulse 1.0→1.15→1.0 over 1.5 s) highlights the revised node. Overlay dismisses over normal 250 ms on `IMPACT_REPORT_READY`.

#### 6.2.5 Preview Sandbox Startup Sequence

Sandbox startup (Stage 9, AC-CG-07) uses five sequential steps, each with a number circle (24 × 24 px), step label (13 px), and status icon:

| Step | Label | Active | Complete | Failure |
|---|---|---|---|---|
| 1 | Container starting | Spinner (#38BDF8) | CheckCircle (#10B981) | XCircle (#EF4444) |
| 2 | Installing dependencies | Spinner (#38BDF8) | CheckCircle (#10B981) | XCircle (#EF4444) |
| 3 | Building application | Spinner (#38BDF8) | CheckCircle (#10B981) | XCircle (#EF4444) |
| 4 | Starting dev server | Spinner (#38BDF8) | CheckCircle (#10B981) | XCircle (#EF4444) |
| 5 | Ready for preview | — | CheckCircle (#10B981) | XCircle (#EF4444) |

Completed steps show green checks; active steps show spinning blue icons; future steps show empty circles (2 px border, #CBD5E1). The sequence renders centered in the Live Preview panel on Cloud #F8FAFC background. On Step 5 completion, the overlay fades out over normal 250 ms and the preview iframe fades in.

---

### 6.3 Success States

Success states confirm operation completion. They shall be visually distinct, temporally bounded, and always offer a next action.

#### 6.3.1 File Generated Confirmation

On `CODE_FILE_COMPLETE`, a success toast (§6.1.3) appears with title "File created" in Success #10B981. The body displays the relative file path in 12 px monospace. Two action buttons: "Jump to File" (opens file in Monaco Editor, focuses Editor panel) and "Why this file?" (opens provenance tooltip with `task_id`, `story_id`, `decision_entry_id` per AC-CG-02, AC-CG-10). Auto-dismiss: 5 s unless hovered.

#### 6.3.2 Preview Ready Confirmation

On sandbox readiness, the Live Preview panel auto-reveals: staging overlay fades out, iframe fades in, and a 3 px green border flash animates around the panel (transparent → #10B981 → transparent over 600 ms, standard easing). A status bar (28 px height, #F0FDF4 background) below the iframe displays the preview URL in 12 px monospace with a copy button (16 × 16 px clipboard icon). Clicking copy swaps the icon to CheckCircle for 1.5 s and writes the URL to `navigator.clipboard`.

#### 6.3.3 Deployment Complete Confirmation

On `DEPLOYED`, a success modal appears (480 px wide, centered, z-index 6000, backdrop `rgba(15,23,42,0.5)`). Contents: title "Deployment Complete" (18 px / 600); deployed URL in selectable text with copy button; QR code at 160 × 160 px; two buttons: "Open App" (primary, #2563EB) and "Share" (secondary, bordered). Dismiss via Close button, Escape, or backdrop click.

#### 6.3.4 Stage Completed Celebration

On stage boundary completion, 30–40 particles (4 × 6 px rectangles, colors from the layer palette) burst upward from the pipeline badge, arc under gravity, and fade over 1.2 s. The stage progress bar (200 × 6 px, background #E2E8F0, fill #2563EB, radius 3 px) advances over deliberate 600 ms with standard easing. Both animations are non-blocking.

---

### 6.4 Error States

Error states shall clearly communicate what failed, why, and what the user can do. PRD §10 mandates explicit recovery options; silent retry is prohibited.

| Error Code | Error Name | UI Surface | Severity | Recovery Options | PRD Ref |
|---|---|---|---|---|---|
| LLM-E01 | LLM Timeout | Warning banner + SteeringPanel | Warning | Retry, Modify, Skip, Restore Checkpoint | §10.1 |
| LLM-E02 | Malformed JSON | Partial display + Repair modal | Error | Accept partial, Repair, Discard, Restore | §10.1 |
| LLM-E03 | Context Overflow | Yellow banner + auto-action | Warning | Compress, Override, Restore | §10.1 implied |
| LLM-E04 | Rate Limit | Queue indicator + countdown | Info | Wait, Upgrade, Cancel | §10.1 implied |
| GEN-E01 | Merge Conflict | 3-way diff view | Error | Accept Base, Theirs, Mine, Manual Edit | §17.6 |
| DEP-E01 | Dependency Failure | Terminal + action bar | Error | Retry, Modify Version, Skip, Manual Fix | §10.2 |
| SYS-E01 | General Error | Error modal | Error/Warning | Varies by `recoverable` + `action_options` | §10.3 |

#### 6.4.1 LLM Timeout — Warning Banner

On LLM timeout (>10 s, §9.3), an amber banner appears at the top of the active panel: full width, 56 px height, #FFFBEB background, 4 px left border Warning #F59E0B. Content: AlertTriangle icon (16 px); message "LLM response timed out." (13 px / 500); four buttons: "Retry" (with exponential backoff), "Modify" (editable prompt textarea), "Skip" (marks `deferred`, §10.1), "Restore Checkpoint". Banner persists until action selection or retry success. Silent retry is prohibited per AC-NF-02 and §7.2.

#### 6.4.2 LLM Malformed JSON — Repair Modal

On unparseable JSON, partial data renders in the target panel with a red "Data Incomplete" watermark. A "Repair Options" modal (520 px) opens automatically containing: title "Malformed Response" in Error #EF4444; "Parsed Fragment" (read-only Monaco minimap of valid JSON); "Raw Response" (raw output with syntax error highlighting); "Suggested Fixes" list (clickable rows previewing repairs in a side pane); buttons: "Apply Fix", "Discard", "Restore Checkpoint".

#### 6.4.3 Context Overflow — Compression Banner

On context window limit approach, a yellow banner reads "Context window approaching limit. Compressing context…" with a spinner and progress text "Reducing from N to M tokens…" updating in real-time. Two overrides: "Compress Now" (forces immediate compression) and "Keep Full Context" (overrides, risks truncation). Banner auto-dismisses on compression success; on failure, transitions to Error severity with "Restore Checkpoint".

#### 6.4.4 Rate Limit — Queue Position Indicator

On rate-limit response, a compact panel in the Chat Panel header displays: queue position ("Queue: 12"), exponential backoff countdown ("Retry in 23s…"), and a wait-time progress bar. Countdown updates every second; at zero, displays "Retrying…" with a spinner.

#### 6.4.5 Merge Conflict — 3-Way Diff View

On revision conflict, the Editor panel shows four zones: BASE / THEIRS / MINE (three columns, 33% width each, top 60%) and OUTPUT (full width, bottom 40%). Each zone uses Monaco diff highlighting: green additions, red deletions, amber conflict markers. Output is editable. Four floating buttons: "Accept Base", "Accept Theirs", "Accept Mine", "Manual Edit". "Next / Previous Conflict" navigation resolves conflicts sequentially.

#### 6.4.6 Dependency Install Failure — Terminal + Action Bar

On `DEPENDENCY_INSTALL_STATUS.status = failed`, the Terminal displays error lines in Error #EF4444 from the failure point; preceding lines remain original color. A fixed action bar (48 px, White #FFFFFF, 1 px top border #E2E8F0) at the Terminal bottom holds four buttons: "Retry", "Modify Version" (dependency version editor), "Skip Runtime" (proceeds without Stage 9, §10.2), "Manual Fix" (interactive shell).

#### 6.4.7 General Error Modal

Unclassified errors render a standardized modal receiving: `error_code` (monospace badge), `message` (14 px), `recoverable` (boolean), `action_options` (array of `{label, action_type}`). If `recoverable = true`: title "Something went wrong" in Warning #F59E0B with AlertTriangle. If `recoverable = false`: title "Critical Error" in Error #EF4444 with XCircle. Buttons render dynamically from `action_options`. A "Copy Error Details" link copies the full error payload to clipboard.

---

### 6.5 Warning States

Warning states indicate non-blocking conditions requiring user attention for long-term correctness.

| Warning Condition | Badge Location | Badge Style | Tooltip / Message | Primary Action | PRD Ref |
|---|---|---|---|---|---|
| Infrastructure profile stale | Settings gear icon | Amber dot (6 px) top-right | "Scale inputs changed. Recommendations may be outdated." | "Re-run Advisor" | AC-SC-08 |
| Revision budget exhausted | Audit Panel header | Amber badge "Budget Exhausted" | "All N revision attempts used for this decision point." | "Request Override" or "Restore Checkpoint" | §14.2 |
| Scale input conflict | Scale form field | Red border + inline text | "{conflict_description}" | "Apply Suggested Fix" | §14.2 |
| RBAC inheritance cycle | Commit button area | Red banner, full width | "Cycle detected: {cycle_path}" | "Fix Inheritance" | §14.2 |

#### 6.5.1 Infrastructure Profile Stale

On `INFRASTRUCTURE_PROFILE_STALE` (AC-SC-08), a 6 px amber dot appears on the Settings gear icon. Hover tooltip (240 px, 8 px radius, Cloud #F8FAFC): "Scale inputs changed. Infrastructure recommendations may be outdated." Clicking opens Settings with Infrastructure section pre-expanded and an amber "Re-run Advisor" button.

#### 6.5.2 Revision Budget Exhausted

On `REVISION_BUDGET_EXHAUSTED`, a 400 px modal appears. Title: "Revision Limit Reached" in Warning #F59E0B. Body: "You have used all [N] revision attempts for [decision_point]." Three full-width buttons: "Accept Current" (commits current state), "Request Override" (requires `pipeline_admin` role), "Restore Checkpoint".

#### 6.5.3 Scale Input Conflict

On `SCALE_INPUT_CONFLICT`, inline validation appears on affected Scale Dialogue fields: border transitions to Error #EF4444 (2 px). Below the field: explanation text (12 px, #EF4444) reading "{conflict_description}" and a "Suggested Fix" link that auto-corrects the field to a valid value.

#### 6.5.4 RBAC Inheritance Cycle

On `RBAC_INHERITANCE_CYCLE_DETECTED`, a red banner appears at the RBAC Advisor panel top (full width, 48 px, #FEF2F2 background, 2 px bottom border Error #EF4444). Content: XCircle icon; cycle path in monospace (e.g., `Admin → Manager → Admin`); "Fix Inheritance" button opening the inheritance editor at the cycle. The commit button is disabled (opacity 0.4, `cursor: not-allowed`) while the cycle persists.

---

### 6.6 Empty States

Empty states appear when a panel has no data, never as a blank canvas. Each includes a thematic illustration, descriptive message, and call-to-action where applicable.

| Panel | Trigger | Illustration | Message | Call-to-Action | PRD Ref |
|---|---|---|---|---|---|
| File Explorer | Pre-Stage 8 | Folder, dotted outline (#CBD5E1) | "Your files will appear here after code generation begins." | None | AC-CG-01 |
| Live Preview | Pre-Stage 9 | Browser window, dashed border | "Run your app to see the preview here." | "Start Runtime" (post-Stage 8) | AC-CG-07 |
| Test Results | No tests run | Checklist, empty boxes | "Tests will appear here after you run the test suite." | "Run Tests" (runtime ready) | AC-CG-08 |
| Audit Panel | New project | Notebook, blank pages | "No decisions yet — start building and your decision history will appear here." | None | AC-AT-01 |

#### 6.6.1 File Explorer Empty State

Pre-Stage 8, the File Explorer shows a centered 120 × 120 px SVG folder icon (2 px dotted stroke, #CBD5E1) with the message below in 14 px / 400 Slate #475569, max-width 240 px, centered. Background: Cloud #F8FAFC. On first `CODE_FILE_STREAM`, the empty state fades out over fast 150 ms and the file tree fades in.

#### 6.6.2 Live Preview Empty State

Pre-Stage 9, a 120 × 120 px SVG browser window (dashed border, #CBD5E1) displays with the message "Run your app to see the preview here." If Stage 8 is complete, a "Start Runtime" button (#2563EB, 120 × 36 px, 6 px radius) appears below. On runtime start, the staged loading sequence (§6.2.5) replaces the empty state.

#### 6.6.3 Test Results Empty State

A 120 × 120 px SVG checklist (three empty checkbox squares, #CBD5E1) displays with message "Tests will appear here after you run the test suite." When runtime is ready, "Run Tests" appears. On `TEST_RESULT_STREAM`, empty state transitions to results list with inline pass/fail badges per AC-CG-08.

#### 6.6.4 Audit Panel Empty State

A 120 × 120 px SVG open notebook (blank pages, #CBD5E1) displays with message "No decisions yet — start building and your decision history will appear here." No CTA. Resolves automatically on first `DECISION_LOGGED`; empty state fades out and first entry slides in from top over normal 250 ms.

---

### Summary of Cross-References

All micro-states derive from explicit PRD requirements. The pipeline badge maps to §7.1; toasts implement NF-NT-01/02; error recovery implements §10.1–10.3 and AC-NF-02–07; loading states implement AC-CG-01/06/07; empty states implement AC-CG-01/07/08 and AC-AT-01; warning states implement AC-SC-08, AC-RB-08, and `REVISION_BUDGET_EXHAUSTED`; the 3-way diff implements AC-DL-01. All timing uses the animation token system (fast 150 ms, normal 250 ms, deliberate 600 ms) with standard, enter, and exit easing curves.

# 7. Design System

This chapter defines the complete design token system for the platform interface. All visual, typographic, spatial, and motion specifications established here serve as the normative reference for component implementations in Chapters 8, 9, and 10. Tokens are organized by category: color, typography, spacing, iconography, elevation, and animation. Every token carries a concrete value and an explicit usage context.

---

## 7.1 Color Palette

The color system is organized into four semantic tiers: base colors for general UI surfaces and text, layer colors for module identification, state colors for feedback and alerts, and trust mode badge colors for runtime policy indication. Each tier maintains WCAG AA compliance (4.5:1 minimum contrast ratio for normal text) against its designated background surface.

### 7.1.1 Semantic Base Colors

The base color tier provides the fundamental grayscale spectrum used for text, borders, backgrounds, and disabled states. These five colors shall constitute the only grayscale values permitted in the interface.

**Ink** `#0F172A` serves as the primary text and heading color, producing 18.5:1 contrast against White `#FFFFFF` (WCAG AAA). **Slate** `#475569` handles secondary text and muted labels at 7.2:1 contrast against White (WCAG AA). **Silver** `#CBD5E1` is reserved exclusively for borders, dividers, and disabled states — it shall not be used for readable text on light backgrounds. **Cloud** `#F8FAFC` provides light panel backgrounds and hover states. **White** `#FFFFFF` is the primary canvas background for the light theme.

### 7.1.2 Layer Colors

Layer colors provide instant visual identification for the eight architectural modules. Each module receives a single chromatic anchor that propagates through badges, borders, icons, and terminal color coding: Frontend (Ocean `#2563EB`), Backend (Forest `#059669`), Database (Amber `#D97706`), Infra (Violet `#7C3AED`), Auth (Rose `#E11D48`), Test (Lemon `#CA8A04`), DevOps (Stone `#78716C`), and Security (Crimson `#DC2626`). Each layer color is used at full saturation (`500` level) for badges and active indicators, at `100` level tint (approximately 15% opacity) for background highlights, and at `700` level for hover emphasis.

### 7.1.3 State Colors

State colors communicate system feedback: Success (Emerald `#10B981`) for completed operations and valid inputs, Warning (Amber `#F59E0B`) for degraded operations and pending actions, Error (Rose `#EF4444`) for failures and critical alerts, and Info (Sky `#38BDF8`) for informational messages and loading states. A fifth neutral state at `#94A3B8` covers indeterminate and archived items. Error against White produces 4.6:1 contrast (WCAG AA). Warning against White yields only 2.1:1 and shall be paired with Ink `#0F172A` text when used for readable labels.

### 7.1.4 Trust Mode Badge Colors

The trust mode indicator uses a three-level scale: PARANOID (red `#FEE2E2` background with Crimson `#DC2626` text), BALANCED (amber `#FEF3C7` background with Amber `#D97706` text), and AUTO_PILOT (green `#D1FAE5` background with Forest `#059669` text). These badges are fixed at 96px width by 24px height with a pill shape (12px border radius) and 11px Caption-weight text.

### 7.1.5 Dark Mode Equivalent Palette

All colors map to dark theme variants via CSS custom properties under `data-theme="dark"` on the root `<html>` element. The dark mode canvas uses Ink `#0F172A` as the primary background. Layer and state colors shift to their `400` lightness equivalents to maintain vibrancy against dark surfaces. Raised surfaces use `#1E293B` (slate-800), one level above the Ink canvas.

The following table consolidates the complete color palette across all tiers with hex values and usage contexts.

| Token | Hex | Tier | Usage Context |
|-------|-----|------|---------------|
| Ink | `#0F172A` | Base | Primary text, headings, active icons, dark surfaces |
| Slate | `#475569` | Base | Secondary text, muted labels, placeholder copy |
| Silver | `#CBD5E1` | Base | Borders, dividers, disabled text, input outlines |
| Cloud | `#F8FAFC` | Base | Light panel backgrounds, hover states, table stripes |
| White | `#FFFFFF` | Base | Primary canvas background, elevated surfaces |
| Ocean | `#2563EB` | Layer | Frontend files, UI layer badges, React/Vue components |
| Forest | `#059669` | Layer | API route files, service layer badges, server functions |
| Amber | `#D97706` | Layer | Schema files, migration badges, query modules |
| Violet | `#7C3AED` | Layer | Config files, deployment badges, IaC modules |
| Rose | `#E11D48` | Layer | Auth guards, permission badges, identity providers |
| Lemon | `#CA8A04` | Layer | Test suites, spec files, coverage badges |
| Stone | `#78716C` | Layer | CI/CD configs, pipeline badges, monitoring rules |
| Crimson | `#DC2626` | Layer | Security policy files, vulnerability scan badges |
| Emerald | `#10B981` | State | Completed operations, passing tests, valid inputs |
| Amber-Warning | `#F59E0B` | State | Degraded operations, pending actions, non-blocking errors |
| Rose-Error | `#EF4444` | State | Failed operations, validation errors, critical alerts |
| Sky | `#38BDF8` | State | Informational messages, tips, loading states |
| Neutral | `#94A3B8` | State | Indeterminate states, archived items, placeholders |
| Trust-Paranoid | `#FEE2E2` | Trust | PARANOID mode badge background |
| Trust-Balanced | `#FEF3C7` | Trust | BALANCED mode badge background |
| Trust-AutoPilot | `#D1FAE5` | Trust | AUTO_PILOT mode badge background |

Dark mode mappings for all tokens are shown in the following table.

| Light Token | Light Hex | Dark Token | Dark Hex | Usage |
|-------------|-----------|------------|----------|-------|
| Ink | `#0F172A` | Cloud-DM | `#F8FAFC` | Primary text on dark backgrounds |
| Slate | `#475569` | Silver-DM | `#CBD5E1` | Secondary text on dark backgrounds |
| Silver | `#CBD5E1` | Slate-DM | `#475569` | Borders, dividers on dark backgrounds |
| Cloud | `#F8FAFC` | Surface-Raised | `#1E293B` | Panel backgrounds in dark mode |
| White | `#FFFFFF` | Ink-DM | `#0F172A` | Primary dark canvas background |
| Ocean | `#2563EB` | Ocean-400 | `#60A5FA` | Frontend badge, dark mode |
| Forest | `#059669` | Forest-400 | `#34D399` | Backend badge, dark mode |
| Amber | `#D97706` | Amber-400 | `#FBBF24` | Database badge, dark mode |
| Violet | `#7C3AED` | Violet-400 | `#A78BFA` | Infra badge, dark mode |
| Rose | `#E11D48` | Rose-400 | `#FB7185` | Auth badge, dark mode |
| Lemon | `#CA8A04` | Lemon-400 | `#FACC15` | Test badge, dark mode |
| Stone | `#78716C` | Stone-400 | `#A8A29E` | DevOps badge, dark mode |
| Emerald | `#10B981` | Emerald-400 | `#34D399` | Success indicator, dark mode |
| Amber-Warning | `#F59E0B` | Warning-400 | `#FCD34D` | Warning indicator, dark mode |
| Rose-Error | `#EF4444` | Error-400 | `#F87171` | Error indicator, dark mode |
| Sky | `#38BDF8` | Info-400 | `#7DD3FC` | Info indicator, dark mode |

---

## 7.2 Typography

The type system uses a three-tier font stack with a seven-level type scale. All sizes are specified in pixels with rem equivalents for accessibility scaling.

### 7.2.1 Font Stack

Inter (weights 400, 500, 600, 700) serves all UI text, body copy, and headings. JetBrains Mono (weights 400, 500) serves all code, terminal output, and monospace data displays. Both load with `font-display: swap`. Variable font versions are preferred. A `system-ui` fallback ensures legibility during font loading.

### 7.2.2 Type Scale

The type scale follows a seven-step hierarchy. Every text node in the interface shall resolve to exactly one of these scale steps.

| Token | Size (px) | Size (rem) | Weight | Line Height | Letter Spacing | Usage |
|-------|-----------|------------|--------|-------------|----------------|-------|
| Display | 32px | 2.0rem | 700 | 1.3 | -0.02em | Page titles, hero headings, empty state headers |
| H1 | 24px | 1.5rem | 600 | 1.3 | -0.02em | Panel titles, section headers, dialog headings |
| H2 | 20px | 1.25rem | 600 | 1.3 | -0.01em | Card titles, sub-section headers, sidebar group labels |
| H3 | 16px | 1.0rem | 600 | 1.3 | 0 | Widget titles, table column headers, tab labels |
| Body | 14px | 0.875rem | 400 | 1.6 | 0 | Paragraph text, descriptions, form labels, list items |
| Caption | 12px | 0.75rem | 500 | 1.4 | 0.05em | Timestamps, badges, metadata, helper text, tooltips |
| Mono | 13px | 0.8125rem | 400 | 1.5 | 0 | Code blocks, terminal output, file paths, inline code |

### 7.2.3 Line Heights and Letter Spacing

Headings (Display through H3) use line-height 1.3 for tight vertical rhythm in title stacks. Body text uses 1.6 for extended reading comfort. Code and terminal text uses 1.5 to preserve character alignment across wrapped lines. Letter spacing follows three modes: Tight (`-0.02em`) for Display and H1 to compensate for large glyph size; Normal (`0`) for Body, H2, H3, and Mono; and Wide (`0.05em`) for Caption and uppercase labels to improve small-size legibility.

---

## 7.3 Spacing System

All spacing values derive from a 4px base unit, scaled through multiplication to produce a consistent spatial rhythm. No spacing value outside this scale shall be used except for full-width or full-height layout containers.

### 7.3.1 Base Unit and Scale

| Token | Value (px) | Value (rem) | Tailwind | Usage |
|-------|------------|-------------|----------|-------|
| space-1 | 4px | 0.25rem | p-1 / m-1 | Icon padding, badge internal spacing |
| space-2 | 8px | 0.5rem | p-2 / m-2 | Gap between related inline elements |
| space-3 | 12px | 0.75rem | p-3 / m-3 | Input internal padding, button padding |
| space-4 | 16px | 1.0rem | p-4 / m-4 | Card internal padding, panel inset |
| space-6 | 24px | 1.5rem | p-6 / m-6 | Section separation, modal padding |
| space-8 | 32px | 2.0rem | p-8 / m-8 | Page-level margins, major section gaps |
| space-12 | 48px | 3.0rem | p-12 / m-12 | Layout gutters, sidebar width offsets |
| space-16 | 64px | 4.0rem | p-16 / m-16 | Large layout gaps, empty state padding |
| space-24 | 96px | 6.0rem | p-24 / m-24 | Hero spacing, full-panel breathing room |

### 7.3.2 Panel Padding, Border Radius

Panel interiors follow a three-zone model: 16px (space-4) internal padding on all sides as the default inset; 8px (space-2) between related elements such as button groups and form field stacks; 24px (space-6) between distinct functional sections. Panel headers and footers use 16px horizontal and 12px vertical padding with a 1px Silver `#CBD5E1` divider border.

Four border radius tokens govern all rounded corners: `radius-sm` at 4px for buttons, inputs, and badges; `radius-md` at 8px for cards, panels, and dropdowns; `radius-lg` at 12px for modals and dialogs; and `radius-none` at 0px for code blocks, terminal windows, data tables, and grid cells. Pill-shaped elements (toggle switches, trust mode badges) use a full cap radius equal to half the element height.

---

## 7.4 Iconography

All interface icons are drawn from Lucide React with consistent stroke geometry and semantic mapping. Icons carry semantic meaning and shall not be used decoratively without an accompanying text label or `aria-label` attribute.

### 7.4.1 Icon Set

The platform uses Lucide React as its sole icon library. All icons render as SVG with 2px stroke width, `currentColor` fill inheritance, and `aria-label` on all standalone instances. Size variants are 12px (inline indicators within table cells), 16px (default for buttons, form fields, and navigation), 20px (sidebar navigation icons), and 24px (empty state illustrations and modal header icons).

### 7.4.2 Semantic Icon Mapping

Each major platform action and entity type maps to a specific Lucide icon as shown below. This mapping is normative; alternative icons shall not be substituted.

| Context | Lucide Icon | Size | Color Rule |
|---------|-------------|------|------------|
| Generate | `Sparkles` | 16px | Layer color |
| Steering | `SlidersHorizontal` | 16px | Slate |
| Audit | `ShieldCheck` | 16px | Auth (Rose) |
| Chat | `MessageSquare` | 16px | Info (Sky) |
| Preview | `Eye` | 16px | Slate |
| Terminal | `Terminal` | 16px | Ink |
| Test | `FlaskConical` | 16px | Test (Lemon) |
| Graph | `GitBranch` | 16px | Slate |
| File — Generic | `File` | 16px | Slate |
| File — JavaScript | `FileCode` | 16px | Frontend (Ocean) |
| File — Config | `FileCog` | 16px | Infra (Violet) |
| File — Style | `FileType` | 16px | Infra (Violet) |
| File — Test | `FileCheck` | 16px | Test (Lemon) |
| File — Database | `Database` | 16px | Database (Amber) |
| File — Auth | `FileLock` | 16px | Auth (Rose) |
| Expand | `ChevronRight` | 12px | Slate |
| Collapse | `ChevronDown` | 12px | Slate |
| Close | `X` | 16px | Slate |
| Settings | `Settings` | 16px | Slate |
| Refresh | `RotateCw` | 16px | Info (Sky) |

### 7.4.3 Layer Badge Icons

File explorer tree nodes display an 8px by 8px filled geometric marker before each file name (6px right margin) to indicate layer affiliation. Circles denote runtime-executable layers (Frontend, Backend). Squares denote configuration and data layers (Database, Infra). Auth uses a diamond (rotated 45deg) for immediate security-file distinction. Test uses a triangle to avoid visual conflict with Frontend's blue circle. DevOps uses a hexagon.

---

## 7.5 Shadows & Elevation

The elevation system uses five discrete levels. Every surfaced element shall resolve to exactly one elevation level.

### 7.5.1 Elevation Levels and Shadow Values

| Level | z-index | Background | Shadow Value | Usage |
|-------|---------|------------|--------------|-------|
| Level 0 | 0 | Cloud `#F8FAFC` | none | Flat panels, sidebar, main content area |
| Level 1 | 10 | White `#FFFFFF` | `0 1px 3px rgba(0,0,0,0.08)` | Cards, resting buttons, input fields |
| Level 2 | 20 | White `#FFFFFF` | `0 4px 12px rgba(0,0,0,0.12)` | Floating panels, dropdowns, tooltips |
| Level 3 | 30 | White `#FFFFFF` | `0 12px 40px rgba(0,0,0,0.18)` | Modals, dialogs, popover overlays |
| Level 4 | 40 | White `#FFFFFF` | `0 12px 40px rgba(0,0,0,0.18)` | Toast notifications, urgent overlays |

The z-index scale uses increments of 10 to allow intermediate component-specific layering without collisions. Shadow transitions animate over 250ms with Standard easing when an element changes elevation (e.g., card hover lift). In dark mode, shadow opacity increases by 40%: Level 1 becomes `0 1px 3px rgba(0,0,0,0.12)`, Level 2 becomes `0 4px 12px rgba(0,0,0,0.16)`, and Levels 3-4 become `0 12px 40px rgba(0,0,0,0.24)`.

---

## 7.6 Animation & Motion

The animation system provides a complete token set for duration, easing, and transition patterns. All interface motion shall use these tokens; ad-hoc timing values are prohibited.

### 7.6.1 Duration and Easing Tokens

| Token | Type | Value | Usage Context |
|-------|------|-------|---------------|
| Instant | Duration | 0ms | State toggles, color changes — no perceptible delay |
| Fast | Duration | 150ms | Hover states, focus rings, subtle feedback |
| Normal | Duration | 250ms | Panel transitions, button interactions, dropdowns |
| Slow | Duration | 400ms | Page transitions, sidebar collapse, modal entrance |
| Deliberate | Duration | 600ms | Empty states, onboarding, attention-drawing reveals |
| Standard | Easing | `cubic-bezier(0.4,0,0.2,1)` | Default for all transitions; symmetric ease-in-out |
| Enter | Easing | `cubic-bezier(0,0,0.2,1)` | Elements appearing; fast start, gentle deceleration |
| Exit | Easing | `cubic-bezier(0.4,0,1,1)` | Elements leaving; gradual start, sharp finish |
| Bounce | Easing | `cubic-bezier(0.34,1.56,0.64,1)` | Micro-interactions; 12% overshoot for tactile feel |

Duration selection follows: user-initiated actions use Fast or Normal; system-initiated transitions use Normal or Slow; instructional animations use Deliberate. Standard is the default easing. Enter and Exit are perceptual inverses for directional motion. Bounce is reserved exclusively for toggle switches and playful feedback.

### 7.6.2 Panel Transitions

Three transition patterns handle all panel movement. Slide uses `transform: translateX/Y` over 250ms Normal with Standard easing for sidebar and panel repositioning. Fade uses `opacity` over 150ms Fast with Standard easing for dropdowns, tooltips, and overlays. Scale uses `transform: scale(0.95→1.0)` combined with `opacity` over 200ms with Enter easing for modal and popover entrances. No more than two animating properties shall transition simultaneously.

### 7.6.3 Micro-interactions

| Interaction | Trigger | Animation | Duration | Easing |
|-------------|---------|-----------|----------|--------|
| Button press | `:active` | `scale(0.97)` | 100ms | Standard |
| Button release | `:active` end | `scale(1.0)` | 100ms | Standard |
| Toggle switch | Click | `translateX(16px)` | 200ms | Bounce |
| Loading spinner | Mount | `rotate(360deg)` | 1000ms | Linear, infinite |
| Pulse indicator | Continuous | `opacity: 0.5 → 1.0` | 2000ms | Ease-in-out, infinite |
| Checkbox check | Click | `scale(0.8→1.0)` + stroke dash | 150ms | Enter |
| Input focus | `:focus` | Border color + `box-shadow: 0 0 0 3px` | 150ms | Standard |
| Copy feedback | Click | `scale(1.0→1.1→1.0)` + color flash | 300ms | Bounce |

The button press scales to `0.97` on `:active`, creating a depression effect without layout shift. The toggle switch uses Bounce easing for a satisfying overshoot. The loading spinner rotates at 1 revolution per second with linear easing. The pulse indicator oscillates opacity between 0.5 and 1.0 over 2 seconds for indefinite loading states where a spinner would be too visually aggressive. The input focus ring uses a 3px spread shadow tinted at 20% opacity of the relevant layer color (Info `#38BDF8` for generic inputs, Frontend `#2563EB` for primary action fields).

## 8. Component Library

The component library defines the concrete, implementation-ready specifications for every reusable UI element in the architecture design tool. All components build on the design system tokens defined in Chapter 7 (colors, typography, spacing, animation) and shall be used consistently across the application. Each component specification includes its complete anatomy, all supported variants, every possible state, and exact dimensional and color values.

---

### 8.1 Buttons

Buttons are the primary interactive element for triggering actions. All button variants share a base border-radius of 4px, font-family Inter (medium weight, 14px), and a standard transition of 150ms cubic-bezier(0.4,0,0.2,1) for background-color, border-color, and box-shadow.

#### 8.1.1 Variants

Five button variants are defined. The primary variant uses a filled background in Frontend #2563EB with White #FFFFFF text. The secondary variant is an outlined style with a 1px border in Silver #CBD5E1, Ink #0F172A text, and a transparent background. The ghost variant renders as text-only with no border and no background in the default state, using Ink #0F172A text. The danger variant is filled with Error #EF4444 background and White #FFFFFF text for destructive actions. The icon variant is a square button containing only an icon, available in all size configurations, with a transparent default background and a Silver #CBD5E1 border for the secondary icon style.

#### 8.1.2 Sizes

Three sizes are supported. The sm size has a height of 32px, horizontal padding of 12px, and font-size 12px. The md size has a height of 40px, horizontal padding of 16px, and font-size 14px — this is the default size. The lg size has a height of 48px, horizontal padding of 24px, and font-size 16px. Icon-only buttons use equal width and height matching the chosen size (32px, 40px, or 48px square). All sizes use an internal flex layout with justify-content: center, align-items: center, and a gap of 8px between icon and text when both are present.

#### 8.1.3 States

Each variant supports five states. The default state renders the variant's base colors. The hover state lightens filled backgrounds by 10% (CSS filter: brightness(1.1)) and adds a Cloud #F8FAFC background to ghost and secondary variants. The active state darkens filled backgrounds by 10% (filter: brightness(0.9)) and adds an inset box-shadow of 0 0 0 2px rgba(15,23,42,0.1) to indicate press depth. The disabled state reduces opacity to 40%, removes pointer-events, and maintains the layout dimensions to prevent reflow. The loading state replaces the button text with a 16px spinner animation (CSS rotate, 600ms linear infinite) while maintaining the button's width to prevent layout shift; the button remains non-interactive during loading.

| Variant | Background | Text Color | Border | Hover State | Disabled Opacity |
|---------|-----------|------------|--------|-------------|-----------------|
| Primary | #2563EB | #FFFFFF | none | brightness(1.1) | 40% |
| Secondary | transparent | #0F172A | 1px #CBD5E1 | bg #F8FAFC | 40% |
| Ghost | transparent | #0F172A | none | bg #F8FAFC | 40% |
| Danger | #EF4444 | #FFFFFF | none | brightness(1.1) | 40% |
| Icon | transparent | #475569 | none | bg #F8FAFC | 40% |

---

### 8.2 Inputs

Input components capture user data across the application. All inputs use border-radius 4px, border 1px solid Silver #CBD5E1 in the default state, and transition border-color and box-shadow over 150ms with standard easing. The font-family is Inter at 14px/16px depending on context; code inputs switch to JetBrains Mono.

#### 8.2.1 Text Input

The text input consists of four connected elements arranged vertically: a label (12px, Slate #475569, font-weight 500, margin-bottom 4px), the input field itself (height 40px, padding 0 12px, background White #FFFFFF), optional helper text below (12px, Slate #475569, margin-top 4px), and an error message that replaces helper text when validation fails. The error state applies border-color Error #EF4444, a box-shadow of 0 0 0 3px rgba(239,68,68,0.15), and renders the error message in Error #EF4444 at 12px with a 16px alert-circle icon preceding the text. A character counter shall appear in the bottom-right of the input wrapper when maxLength is specified, displaying current/max count in 12px Slate #475569 text that transitions to Warning #F59E0B at 80% and Error #EF4444 at 100%.

#### 8.2.2 Textarea

The textarea component extends text input with auto-resize behavior: the field height expands automatically as content grows, starting from a minimum of 80px (5 rows) and capped at a max-height of 320px (20 rows). Beyond max-height, native scroll behavior applies. The resize handle is hidden (resize: none). For code input contexts, the font-family switches to JetBrains Mono, font-size reduces to 13px, and line-height becomes 1.6. A subtle background tint of Cloud #F8FAFC distinguishes code textareas from standard textareas.

#### 8.2.3 Select/Dropdown

The select component opens a dropdown panel with border-radius 8px, box-shadow 0 10px 38px rgba(0,0,0,0.12), and max-height 320px with internal scroll. The searchable variant adds an input field at the top of the dropdown for filtering options; search matches highlight the matched substring in Frontend #2563EB. Multi-select renders selected options as removable tag chips in the input field, each chip with border-radius 4px, background Cloud #F8FAFC, border 1px solid Silver #CBD5E1, padding 2px 8px, and a 12px X remove icon. Grouped options display a non-selectable group header in 11px uppercase Slate #475569 text with a 16px top margin separating groups. Keyboard navigation is supported: ArrowUp/ArrowDown to navigate, Enter to select, Escape to close.

#### 8.2.4 File Upload

The file upload component provides a drag-and-drop zone with a dashed border (2px dashed Silver #CBD5E1, border-radius 8px) that transitions to a solid Frontend #2563EB border on drag-over. The zone displays an upload cloud icon (24px, Slate #475569), descriptive text (14px), and accepted file type labels. On file selection, a file list renders below the zone with each item showing: file name (14px Ink #0F172A), file size (12px Slate #475569), a linear progress bar (height 4px, border-radius 2px, filled portion in Frontend #2563EB, track in Cloud #F8FAFC), and a remove button (16px X icon). File type validation rejects disallowed formats with an inline Error #EF4444 message.

| Input Type | Height/Size | Font | Border Radius | Special Features |
|-----------|------------|------|---------------|-----------------|
| Text input | 40px h, pad 12px | Inter 14px | 4px | Char counter, error icon |
| Textarea | min 80px, max 320px | Inter 14px | 4px | Auto-resize, mono mode |
| Code textarea | min 80px, max 320px | JetBrains Mono 13px | 4px | Cloud #F8FAFC bg, lh 1.6 |
| Select | 40px trigger | Inter 14px | 4px (8px panel) | Search, multi chips, groups |
| File upload | 160px drop zone | Inter 14px | 8px | Dashed border, progress bar |

---

### 8.3 Cards

Cards are container components that group related content and actions. All cards share a border-radius of 8px, background White #FFFFFF, border 1px solid Silver #CBD5E1, and a subtle box-shadow of 0 1px 3px rgba(15,23,42,0.06). Padding follows the 4px scale: 16px standard internal padding, 24px for spacious layouts.

#### 8.3.1 Steering Card

The steering card represents a pipeline stage and has a three-part vertical anatomy. The header row displays the stage name in 16px Inter semibold (Ink #0F172A) on the left and a node count badge on the right (12px pill, Cloud #F8FAFC background, Slate #475569 text). The body is a scrollable list of node items with max-height 280px, each item rendered as a horizontal row with a 10px colored dot (layer color), node name in 14px Inter, and a status icon on the far right. The footer contains action buttons — typically a primary "Generate" or "Run" button and a secondary "Configure" button — arranged horizontally with an 8px gap, right-aligned. The entire card has a left-border accent of 4px in the stage's assigned layer color.

#### 8.3.2 Chat Message Card

The chat message card displays a single message in the chat interface. The layout is horizontal: a 32px circular avatar or icon container on the left (background Cloud #F8FAFC, border-radius 50%), and a content column on the right. The content column's top row contains the sender name in 14px Inter medium (Ink #0F172A) and a timestamp in 12px Slate #475569, separated by 8px. Below, the message content renders in 14px Inter (Slate #475569 for assistant, Ink #0F172A for user) and supports inline markdown: bold, italic, code spans (JetBrains Mono, background Cloud #F8FAFC, padding 2px 4px, border-radius 2px), and fenced code blocks. An action row below the content provides buttons for copy, regenerate, and thumbs up/down, rendered as 16px ghost icon buttons in Slate #475569.

#### 8.3.3 Impact Report Card

The impact report card presents the results of a code change analysis. The card header displays "Impact Report" in 16px Inter semibold with a badge indicating the highest severity found (LOW, MEDIUM, HIGH, CRITICAL — see Section 8.5.1 for badge specs). The body renders a diff-style view: affected nodes are listed with file paths in JetBrains Mono 13px, with added lines prefixed by "+" in Success #10B981 and removed lines prefixed by "-" in Error #EF4444. A summary row at the bottom shows total affected nodes count, files changed count, and estimated complexity score, arranged horizontally with divider borders (1px Silver #CBD5E1 vertical lines).

| Card Type | Dimensions | Anatomy Parts | Special Styling |
|-----------|-----------|---------------|-----------------|
| Steering | 320px min-w, flex-col | Header, scrollable body (280px max), footer | Left accent border 4px layer color |
| Chat message | full width, flex-row | Avatar (32px), content col, action row | Supports markdown, code blocks |
| Impact report | full width, flex-col | Header with severity badge, diff body, summary row | +/- line coloring, mono font |

---

### 8.4 Modals & Dialogs

Modals overlay the main content and capture user focus for critical interactions. All modals render with a backdrop overlay (background rgba(15,23,42,0.5), z-index 100, transition opacity 250ms standard easing). The modal container uses border-radius 12px, background White #FFFFFF, box-shadow 0 24px 48px rgba(15,23,42,0.2), and a max-width that varies by modal type. Modal entry animation: translateY(-16px) to translateY(0) with opacity 0 to 1, duration 250ms, easing cubic-bezier(0,0,0.2,1). Exit animation reverses with cubic-bezier(0.4,0,1,1).

#### 8.4.1 Confirmation Modal

The confirmation modal is the standard dialog for user decisions. Its layout is vertically centered: a 48px icon (colored circle with an alert or info icon) at the top, a title in 18px Inter semibold (Ink #0F172A) with 8px top margin, a description in 14px Inter (Slate #475569) with 8px top margin, and a button row at the bottom with 24px top margin containing a secondary button ("Cancel") on the left and a primary button (confirm action) on the right with 12px gap. The modal width is 400px fixed. The close button (X, 16px, top-right corner) shall always be present.

#### 8.4.2 Form Modal

The form modal supports single-step and multi-step configurations. The header contains the modal title (18px Inter semibold) and, for multi-step flows, a progress indicator: a horizontal step bar with segments (each segment 32px wide, 4px height, border-radius 2px; completed segments in Frontend #2563EB, current in Info #38BDF8, upcoming in Cloud #F8FAFC). Step labels appear below in 11px text. The body contains the active step's form fields with vertical 16px spacing. The footer has a "Back" button (hidden on step 1), a "Next" primary button that changes to "Submit" on the final step, and a "Cancel" text button. Validation runs per-step; advancing to the next step is blocked until current step fields are valid. Error messages render inline below offending fields.

#### 8.4.3 Full-Screen Modal

The full-screen modal occupies 95vw by 95vh, border-radius 12px, and is reserved for the 3-way merge conflict resolution interface. The layout divides into three vertical panels: "Base" (left), "Ours" (center), and "Theirs" (right), each 1/3 of the width with 1px Silver #CBD5E1 dividers between them. Each panel has a header bar (48px height, Cloud #F8FAFC background) showing the panel label in 12px uppercase Slate #475569 and a checkbox for "Accept this version." The panel body renders a scrollable code diff view using JetBrains Mono 13px with syntax highlighting. A bottom action bar spans the full width with "Accept Merge" (primary) and "Cancel" (secondary) buttons, plus a conflict counter showing "X of Y conflicts resolved."

| Modal Type | Width | Height | Primary Use Case | Key Elements |
|-----------|-------|--------|-----------------|--------------|
| Confirmation | 400px fixed | auto | Yes/no decisions | Icon, title, desc, 2 buttons |
| Form | 560px max | auto, max 80vh | Data entry, wizard flows | Step bar, form fields, prev/next |
| Full-screen | 95vw | 95vh | 3-way merge conflicts | 3 panels, diff view, merge bar |

---

### 8.5 Badges & Tags

Badges and tags are compact, inline indicators for status, categorization, and metadata. All pill-shaped badges use border-radius 999px (fully rounded), display: inline-flex, align-items: center, gap 6px, padding 2px 10px (with icon) or 4px 10px (text only), and font-size 12px Inter medium. All dot-style tags use a 10px circle plus 6px gap to label text.

#### 8.5.1 Status Badge

The status badge indicates the state of a process or item. Four standard statuses are defined. Generating renders with Info #38BDF8 background at 15% opacity, text in Info #38BDF8, and a 12px animated pulse dot. Complete renders with Success #10B981 background at 15% opacity, text in Success #10B981, and a 12px check-circle icon. Error renders with Error #EF4444 background at 15% opacity, text in Error #EF4444, and a 12px alert-circle icon. Stale renders with Slate #475569 background at 15% opacity, text in Slate #475569, and a 12px clock icon.

#### 8.5.2 Trust Mode Badge

The trust mode badge communicates the active validation mode for a stage. Three modes are defined. PARANOID renders with background Error #EF4444 at 15% opacity, text in Error #EF4444, and a 12px shield-alert icon — this mode requires manual approval for all changes. BALANCED renders with background Warning #F59E0B at 15% opacity, text in Warning #F59E0B, and a 12px shield-half icon — this mode auto-approves low-risk changes. AUTO_PILOT renders with background Success #10B981 at 15% opacity, text in Success #10B981, and a 12px shield-check icon — this mode auto-approves all changes. The badge shall update its color and icon immediately when the trust mode changes, with a 150ms color transition.

#### 8.5.3 Layer Tag

The layer tag identifies which architectural layer a node or file belongs to. Six layer tags are defined, each using a 10px filled circle in the layer color followed by the layer name in 12px Ink #0F172A text. Frontend uses dot color #2563EB. Backend uses #059669. Database uses #D97706. Infra uses #7C3AED. Auth uses #E11D48. Test uses #CA8A04. DevOps uses #78716C. The tag uses no background, no border — only the colored dot and text, making it suitable for dense list views.

| Badge/Tag Type | Background | Text Color | Icon | Size |
|---------------|-----------|------------|------|------|
| Status: generating | rgba(56,189,248,0.15) | #38BDF8 | 12px pulse dot | 12px pill |
| Status: complete | rgba(16,185,129,0.15) | #10B981 | 12px check-circle | 12px pill |
| Status: error | rgba(239,68,68,0.15) | #EF4444 | 12px alert-circle | 12px pill |
| Status: stale | rgba(71,85,105,0.15) | #475569 | 12px clock | 12px pill |
| Trust: PARANOID | rgba(239,68,68,0.15) | #EF4444 | 12px shield-alert | 12px pill |
| Trust: BALANCED | rgba(245,158,11,0.15) | #F59E0B | 12px shield-half | 12px pill |
| Trust: AUTO_PILOT | rgba(16,185,129,0.15) | #10B981 | 12px shield-check | 12px pill |
| Layer tag | transparent | #0F172A | 10px filled dot | 12px inline |

---

### 8.6 Navigation

Navigation components provide orientation and quick access to functionality across the application. All navigation elements use Ink #0F172A as the primary text color and transition color/background over 150ms with standard easing.

#### 8.6.1 Tabs

Tabs use an underline style: the active tab displays a 2px bottom border in Frontend #2563EB, with the tab label in 14px Inter medium and Ink #0F172A color. Inactive tabs have no bottom border and use Slate #475569 text. The tab list container has a 1px bottom border in Silver #CBD5E1 that spans the full width behind the active tab underline. Tabs support the closable variant: a 12px X icon appears to the right of the tab label with 6px left margin, visible on hover or always-visible based on context; clicking removes the tab and activates an adjacent tab. When the total tab width exceeds the container, horizontal scroll is enabled with hidden scrollbars (CSS scrollbar-width: none) and mousewheel/drag-to-scroll support. A fade gradient (16px, White #FFFFFF to transparent) appears at the right edge when scroll overflow is present.

#### 8.6.2 Breadcrumbs

The breadcrumb component displays the project > stage > node hierarchy as a horizontal list of clickable segments. Each segment renders in 14px Inter (Ink #0F172A for clickable segments, Slate #475569 for the current non-clickable segment). Segments are separated by a 16px chevron-right icon in Silver #CBD5E1. Clicking a segment navigates to that hierarchy level. The current (last) segment uses regular font-weight and has no pointer-events. On hover, clickable segments gain an underline decoration and the text color shifts to Frontend #2563EB. The container has no background, no border, and 8px vertical padding.

#### 8.6.3 Command Palette

The command palette is a modal overlay activated by the keyboard shortcut Cmd+Shift+P (Mac) or Ctrl+Shift+P (Windows/Linux). It renders centered on screen with width 640px, border-radius 12px, background White #FFFFFF, and box-shadow 0 24px 48px rgba(15,23,42,0.2). The top section contains a search input (48px height, 16px left padding, 24px search icon in Slate #475569, placeholder "Type a command or search...", border-bottom 1px Silver #CBD5E1). Below, results are grouped by category: "Navigation," "Actions," "Recent," and "Settings." Each category has a sticky header (11px uppercase Slate #475569, Cloud #F8FAFC background, 6px vertical padding). Individual result rows are 40px height with 16px horizontal padding, a 16px icon, the command name in 14px Inter, and the keyboard shortcut aligned to the right in 12px JetBrains Mono with Cloud #F8FAFC background pill. The selected row has background Cloud #F8FAFC and a 2px left border in Frontend #2563EB. Keyboard navigation uses ArrowUp/ArrowDown to move selection, Enter to execute, Escape to close, and the search input filters results in real-time with fuzzy matching on both command name and category.

| Component | Trigger/Layout | Key Interaction | Overflow Handling |
|-----------|---------------|-----------------|-------------------|
| Tabs | Underline style, 2px active | Click to switch, X to close | Horizontal scroll, fade gradient |
| Breadcrumbs | project > stage > node | Click segment to navigate | Text truncation with ellipsis |
| Command palette | Cmd+Shift+P | Fuzzy search, keyboard nav | Scrollable results, 640px fixed |

# 9. Accessibility (WCAG 2.1 AA)

The IDE shall conform to WCAG 2.1 Level AA across all panels, interactions, and content surfaces. Accessibility is a first-class requirement, not a post-hoc audit layer, mandated by PRD functional requirements FR-IDE-19 (keyboard shortcuts) and FR-IDE-20 (WCAG 2.1 AA compliance with screen reader support, high-contrast mode, and keyboard-navigable SteeringPanel options). All specifications in this section are normative and verifiable through automated testing (axe-core, Lighthouse CI) and manual screen-reader validation (NVDA, VoiceOver, JAWS).

---

## 9.1 Keyboard Navigation

Every interactive element — SteeringPanel options, chat input, file explorer nodes, editor tab bars, Blueprint Graph controls, Audit Panel filters — shall be reachable and operable without a pointing device. The keyboard interaction model follows WAI-ARIA Authoring Practices Guide (APG) design patterns for composite widgets.

### 9.1.1 Global Shortcuts

The IDE registers application-level shortcuts via `Cmd` (macOS) or `Ctrl` (Windows/Linux), active in all contexts except when focus is inside a text input, `<textarea>`, or Monaco Editor instance.

| Shortcut | Action | Context | PRD Reference |
|----------|--------|---------|---------------|
| `Cmd/Ctrl + Shift + P` | Open command palette (steer, revert, checkpoint) | Global, suppressed in text inputs | FR-IDE-19 |
| `Cmd/Ctrl + B` | Toggle chat panel | Global, suppressed in text inputs | FR-IDE-19 |
| `Cmd/Ctrl + Shift + E` | Toggle file explorer | Global, suppressed in text inputs | FR-IDE-19 |
| `Cmd/Ctrl + Shift + R` | Toggle live preview | Global, suppressed in text inputs | FR-IDE-19 |
| `Cmd/Ctrl + Shift + T` | Toggle terminal | Global, suppressed in text inputs | FR-IDE-19 |
| `Escape` | Close modal/panel, return focus to trigger | All overlay contexts | §9.1.5 |
| `F6` / `Shift + F6` | Cycle focus across top-level panel regions | Global, no suppression | §9.1.2 |

The command palette renders as a modal dialog centered at `z-index: 100`, traps focus, and exposes a filtered action list. Arrow keys navigate the list, `Enter` executes, `Escape` dismisses returning focus to the invoker.

### 9.1.2 Panel Focus Cycling

The IDE implements landmark-based focus cycling via `F6`. Each press advances focus through: (1) top navigation bar, (2) file explorer, (3) editor/SteeringPanel/Blueprint Graph main area, (4) right-panel group (preview, terminal, audit), (5) chat panel. `Shift + F6` reverses direction. Within each region, `Tab` traverses interactive elements in visual order; `Shift + Tab` reverses. Escape behavior is context-dependent: in modals (command palette, confirmation dialogs), `Escape` dismisses and returns focus to the trigger element; in side panels (chat, file explorer, terminal), `Escape` collapses the panel and restores focus to the editor main area. In the SteeringPanel, `Escape` does not dismiss the panel (explicit decision required per PRD AC-ST-02) but closes any nested popover or detail expansion.

### 9.1.3 Steering Panel Keyboard Operation

The SteeringPanel follows APG Tabs and Dialog patterns. `Tab` moves focus through the panel header, trust mode selector, action button bar, and options list. `Arrow Up` / `Arrow Down` navigate between options. `Enter` selects the focused option. `Space` toggles bookmark state on the focused option (PRD AC-ST-05). Number keys `1` through `4` trigger the button-bar actions left-to-right: `1` = Accept, `2` = Modify, `3` = Bookmark, `4` = Explain. When the options list exceeds the viewport, `Page Up` / `Page Down` scroll by one viewport height; `Home` jumps to first option; `End` jumps to last.

### 9.1.4 Chat Keyboard

The chat `<textarea>` supports multiline composition: `Enter` sends the message; `Shift + Enter` inserts a newline; `Up Arrow` at the start of an empty input recalls the last sent message into edit mode; `Ctrl/Cmd + Up` navigates sent-message history; `Escape` clears the draft. When a new system message arrives, focus stays in the input field (the chat history is a live region, §9.2.2). After sending, focus remains in the input. After streaming completes, focus does not move automatically.

### 9.1.5 Focus Trapping

All modal dialogs implement focus trapping. On open, focus moves to the first focusable element. `Tab` from the last element cycles to the first; `Shift + Tab` from the first cycles to the last. Focus shall not leave the modal boundary while open. On close — via `Escape`, dismissal button, or action completion — focus returns to the trigger element. If the trigger no longer exists in the DOM, focus moves to the nearest logical ancestor. Focus trapping is implemented via a `FocusTrap` component using `MutationObserver` on the modal container to account for dynamically injected content (streaming responses, lazy-loaded options).

---

## 9.2 Screen Reader Support

All panels and interactive elements expose programmatic names, roles, and states through ARIA attributes and semantic HTML. The target screen-reader matrix is NVDA + Firefox (Windows), JAWS + Chrome (Windows), and VoiceOver + Safari (macOS/iOS).

### 9.2.1 ARIA Roles

| Element | ARIA Role | Required Attributes | Purpose |
|---------|-----------|---------------------|---------|
| IDE root container | `main` | `aria-label="Collaborative Steering IDE"` | Primary application landmark for skip-navigation targeting |
| File Explorer panel | `complementary` | `aria-label="File Explorer"` | Sidebar landmark containing the navigable file tree |
| Chat panel | `complementary` | `aria-label="Chat Panel"` | Sidebar landmark containing message history and input |
| Terminal panel | `complementary` | `aria-label="Terminal"` | Sidebar landmark containing command output |
| Live Preview panel | `complementary` | `aria-label="Live Preview"` | Sidebar landmark containing sandboxed application render |
| Audit Panel | `complementary` | `aria-label="Audit Panel"` | Sidebar landmark containing decision ledger and audit trail |
| Command palette | `dialog` | `aria-modal="true"`, `aria-labelledby="cmd-palette-title"` | Modal dialog for global action search and invocation |
| Confirmation dialogs | `dialog` | `aria-modal="true"`, `aria-describedby` pointing to consequence text | Destructive action confirmation with stated consequences |
| SteeringPanel | `dialog` | `aria-modal="false"`, `aria-labelledby="steering-title"` | Stage-boundary decision surface; non-blocking by design |
| Editor tab group | `tablist` | `aria-label="Open Editors"` | Container for editor tab controls |
| Editor tab | `tab` | `aria-selected`, `aria-controls` pointing to tabpanel | Selectable tab controlling visible editor content |
| Editor content area | `tabpanel` | `aria-labelledby` referencing tab ID | Content region for file editing or graph visualization |
| Chat message history | `log` | `aria-live="polite"`, `aria-relevant="additions"` | Announces new incoming messages without interrupting |
| Terminal output | `log` | `aria-live="off"` (user-togglable to polite) | Command output stream; off by default to prevent verbosity |
| Streaming status badge | `status` | `aria-label` reflecting current stage name | Announces stage transitions ("Stage 3: Actor Decomposition in progress") |
| SteeringPanel options list | `radiogroup` | `aria-label="Steering Options"`, `aria-required="true"` | Mutually exclusive selection of a steering action |
| Option card | `radio` | `aria-checked`, `aria-describedby` pointing to impact summary | Selectable option with associated impact description |
| Bookmark toggle | `switch` | `aria-checked`, `aria-label="Bookmark for comparison"` | Toggleable bookmark state per PRD AC-ST-05 |
| File tree item | `treeitem` | `aria-expanded`, `aria-level`, `aria-selected` | Navigable file node with expandable directory support |
| Blueprint Graph canvas | `application` | `aria-label="Blueprint Graph, interactive canvas"`, `aria-activedescendant` | Interactive graph with keyboard-navigable nodes |

### 9.2.2 Live Regions for Streaming

Live regions are implemented as visually hidden `<div>` elements managed by a central `Announcer` service. `aria-live="polite"` announces: chunk arrivals ("Actor Admin generated, 14 of 24 actors"), stage completions ("Stage 4 complete"), file creation events during Stage 8, and trust mode auto-approvals. Polite announcements are debounced at 500ms; events within the window are coalesced into a summary. `aria-live="assertive"` interrupts immediately for: errors ("Context window exceeded. Steering required."), CRITICAL escalations ("RBAC schema change detected. Steering required."), session timeout warnings, and destructive action confirmations. Assertive announcements are never debounced.

### 9.2.3 Semantic HTML

All interactive controls use the correct HTML element for their function. Action triggers use `<button>` with explicit `type` attributes. Navigation uses `<nav>` with `aria-label` distinguishing primary, secondary, and breadcrumb navigation. Content panels use `<section>` with heading elements (`h2`–`h4`). Chat messages use `<article>` with `aria-labelledby` referencing author and timestamp. The SteeringPanel options list uses `<fieldset>` with `<legend>`. Tabbed interfaces use `<button role="tab">` / `<div role="tabpanel">` with `aria-selected` state. The file explorer uses `<ul role="tree">` with `<li role="treeitem">` children per APG Tree View.

### 9.2.4 Descriptive Labels

Icon-only buttons carry `aria-label` in imperative form (e.g., `aria-label="Open file explorer"`, `aria-label="Send message"`, `aria-label="Toggle bookmark"`). Complex controls use `aria-describedby` pointing to supplementary context (the trust mode selector references a paragraph explaining the current mode's behavior). Collapsible sections use `aria-expanded="true|false"` synchronized with visual state; when `false`, controlled content is removed from the accessibility tree via `display: none` or the `hidden` attribute.

---

## 9.3 Visual Accessibility

### 9.3.1 Color Contrast

All text achieves minimum 4.5:1 against background (AA); large text (18pt+ or 14pt bold+) achieves 3:1. Focus indicators achieve 3:1 against adjacent colors. Pre-verified token pairings: Ink `#0F172A` on White `#FFFFFF` = 15.8:1 (AAA); Slate `#475569` on Cloud `#F8FAFC` = 5.6:1 (AA); all layer colors use white text with contrast ratios: Frontend `#2563EB` 5.3:1, Backend `#059669` 4.7:1, Infra `#7C3AED` 5.8:1, Auth `#E11D48` 5.9:1, DevOps `#78716C` 4.6:1 — all meeting AA. Database `#D97706` (3.1:1) and Test `#CA8A04` (3.5:1) use bold text at minimum 12px to qualify as large text; in small-label contexts below 14pt bold, text switches to Ink on a lightened tint. Warning `#F59E0B` (2.0:1) never carries text directly — always paired with Ink or Slate text. Silver `#CBD5E1` is restricted to decorative borders only. Trust mode indicators (PARANOID/BALANCED/AUTO_PILOT) use Error/Warning/Success backgrounds with Ink text overlaid.

### 9.3.2 Focus Indicators

All interactive elements display a visible focus indicator when focused via keyboard: `outline: 2px solid #2563EB` with `outline-offset: 2px`. On blue backgrounds where this would fail adjacent-color contrast, the indicator switches to `outline: 2px solid #F8FAFC`. Focus indicators are suppressed for mouse interactions via `:focus-visible`. Monaco Editor focus styling is overridden through `editor.focusBorder` and `editor.focusActiveBorder` theme tokens set to `#2563EB`.

### 9.3.3 Reduced Motion

When `@media (prefers-reduced-motion: reduce)` is active, all animation durations are set to `0ms` via CSS custom properties (`--duration-*: 0ms`). Panel slide transitions, modal fades, Blueprint Graph node entrances, streaming chunk animations, and skeleton shimmers become instantaneous. Pulsing status indicators switch from `@keyframes pulse` to static color changes on state transition. SteeringPanel hover lift effects are removed; hover is indicated by background color change only. No information is conveyed exclusively through motion.

### 9.3.4 High Contrast Mode

When `@media (prefers-contrast: high)` is active: border widths increase to `2px solid`; backgrounds force pure black/white with accent colors only; focus indicators switch to `3px solid` with `4px offset` using the system `Highlight` color; text uses the system font at minimum `font-weight: 400` with `0.01em` letter-spacing; box-shadows are replaced with `2px solid` borders in accent colors; disabled states use dashed borders at `opacity: 1` instead of reduced opacity; Blueprint Graph connections use distinct dash patterns (solid/dashed/dotted) per layer to preserve distinction when color perception is limited. All adaptations respect the OS-level high-contrast theme choice.

### 9.3.5 Zoom Support

The IDE remains functional at browser zoom up to 200% without horizontal scrolling. At 200% zoom on 1920px (effective 960px), the three-panel layout collapses to two panels with the right group stacking vertically and chat collapsing to a bottom drawer. At 200% zoom on 1366px (effective 683px), the layout collapses to single-panel with a panel switcher tab bar. All text uses `rem`-based sizing for proportional scaling. Minimum touch target at 200% zoom remains `44 x 44px`. Virtual scrolling is employed in file explorer, chat history, terminal output, and audit trail to maintain performance at zoomed levels.

---

## 9.4 Cognitive Accessibility

### 9.4.1 Error Prevention

Destructive actions (file deletion, stage reversion, trust mode changes approving critical items, workspace reset, checkpoint overwrite) require confirmation through a modal stating the action, scope, and consequence in plain language. The primary button executes in warning color (`#EF4444` for destructive); the secondary button cancels and returns focus to the trigger. Undo paths are provided where feasible: file deletions move to a 24-hour trash state; chat deletions show an undo toast for 10 seconds; editor changes maintain a local undo stack. The SteeringPanel displays an Impact Summary badge per PRD AC-ST-02, computed by the DependencyGraph engine before commit, showing downstream file count and risk classification.

### 9.4.2 Consistent Navigation

Panel positions persist across sessions via `localStorage` key `ide-layout-prefs`. The panel order (file explorer left, editor center, right group right, chat right) is fixed — users may collapse or resize but not reorder across the center axis. Navigation patterns are drawn from a constrained vocabulary: tabs (editor, Audit Panel, right-panel group), accordions (file explorer directories, SteeringPanel details, settings), modals (command palette, confirmations, checkpoint restore), and tree views (file explorer, Blueprint Graph hierarchical mode). Each pattern follows the corresponding APG design pattern. The trust mode selector appears in the same location (top navigation bar, right-aligned) with the same three-segment toggle treatment and color coding (red/amber/green) on every relevant screen.

### 9.4.3 Plain Language

All user-facing text achieves minimum Flesch Reading Ease 50 (U.S. 10th-grade level). Technical terms are defined on first use per panel context via underlined decoration with tooltip containing the PRD Section 23 glossary definition. Tooltips trigger on hover and focus, dismissible via `Escape`. A persistent "Glossary" link in the top navigation opens a searchable glossary modal. Error messages follow the three-part format: "What happened" + "Why it matters" + "What to do next" — e.g., "The context window is full. The system cannot process more content without losing earlier context. Click 'Compress Context' to summarize earlier stages, or switch to PARANOID mode for finer-grained control."

### 9.4.4 Timeout Warnings

The session expires after 30 minutes of inactivity (configurable). At 5 minutes before expiry, a non-blocking toast with `role="alert"` and `aria-live="assertive"` announces: "Your session expires in 5 minutes. Click Extend to continue working." The toast contains "Extend Session" (resets timer) and "Save & Exit" (checkpoint save + dashboard redirect). Countdown updates fire at 5, 2, 1 minutes and 30 seconds — each announced via assertive live region. At expiry, auto-save stores workspace state to `localStorage` under `ide-recovery-{projectId}` and redirects to login with: "Your work has been saved. Click here to resume from your last checkpoint." Auto-save fires every 60 seconds during active editing. On reconnection, if recovery data exists, a modal prompts: "Unsaved changes found from your previous session. Restore from recovery or discard?"

---

## 9.5 Accessibility Verification Matrix

| WCAG 2.1 Criterion | Implementation | Verification Method |
|-------------------|----------------|---------------------|
| 1.1.1 Non-text Content | All icons have `aria-label`; images have `alt`; charts have text alternatives | axe-core scan; manual NVDA/VoiceOver check |
| 1.3.1 Info and Relationships | Semantic HTML (`section`, `article`, `nav`, `fieldset`); ARIA roles for custom widgets | axe-core structural scan; W3C HTML validator |
| 1.3.2 Meaningful Sequence | DOM order matches visual order; CSS `order` never overrides logical sequence | Manual keyboard tab-through; axe-core scan |
| 1.4.1 Use of Color | Layer colors supplemented by icons/text; status by shape + color + label | Manual grayscale test; screen-reader announcement check |
| 1.4.3 Contrast (Minimum) | All text 4.5:1+ (AA); large text 3:1+; pre-verified token table (§9.3.1) | Automated contrast audit via axe-core; APCA verification |
| 1.4.4 Resize Text | Browser zoom to 200% functional; `rem`-based typography | Manual 200% zoom test on 1366px and 1920px viewports |
| 1.4.10 Reflow | Responsive breakpoints at 320px CSS pixel equivalent; panel stacking | Browser devtools responsive mode |
| 1.4.11 Non-text Contrast | Focus indicators 3:1 against adjacent; icon fills 3:1 against background | axe-core color-contrast rule; manual inspection |
| 1.4.12 Text Spacing | No text clipping at 1.5x line-height, 2x paragraph spacing, 0.12em letter/word spacing | CSS override test (bookmarklet) |
| 1.4.13 Content on Hover | Tooltips dismissible via Escape; hoverable via pointer; persistent | Manual interaction test |
| 2.1.1 Keyboard | All functions operable via keyboard; global shortcuts (§9.1.1); no keyboard traps except modals | Manual keyboard-only navigation; axe-core |
| 2.1.2 No Keyboard Trap | Focus trapping confined to modals; Escape exits; focus returns on close | Manual tab-cycle test in every modal |
| 2.2.1 Timing Adjustable | Session timeout extendable; auto-save recovery; no automatic content loss | Manual timeout simulation; recovery flow test |
| 2.4.3 Focus Order | Tab order follows visual layout; F6 cycles landmarks; Shift+Tab reverses | Manual keyboard audit |
| 2.4.4 Link Purpose (In Context) | All link text descriptive; `aria-label` supplements where needed | axe-core link-text audit |
| 2.4.6 Headings and Labels | Heading hierarchy logical; form labels visible and associated | axe-core heading-order scan |
| 2.4.7 Focus Visible | 2px solid `#2563EB` outline, 2px offset, `:focus-visible` gated | Visual focus audit on all controls |
| 2.5.3 Label in Name | Visible label text matches accessible name | axe-core label-content-name-mismatch |
| 3.1.1 Language of Page | `lang` attribute set on `<html>` per user locale | W3C validator |
| 3.2.3 Consistent Navigation | Panel positions persisted; same patterns across views; F6 order fixed | Cross-session layout persistence test |
| 3.3.1 Error Identification | Form errors announced via assertive live region; inline error text adjacent | Manual form error test; screen-reader check |
| 3.3.2 Labels or Instructions | All inputs have visible labels or `aria-label`; placeholders not used as labels | axe-core form-field audit |
| 3.3.3 Error Suggestion | Error messages include corrective guidance ("What to do next" pattern) | Manual error-trigger test |
| 3.3.4 Error Prevention (Legal/Financial/Data) | Confirmation dialogs for destructive actions; undo where feasible; consequence stated | Destructive action test suite; undo-path verification |
| 4.1.1 Parsing | Valid HTML5; no duplicate IDs; ARIA roles on valid elements | W3C HTML validator; axe-core |
| 4.1.2 Name, Role, Value | All interactive elements have accessible name, role, and state | axe-core; manual screen-reader inventory |
| 4.1.3 Status Messages | Live regions for streaming (polite/assertive); `status` role for stage badges | Manual screen-reader announcement log |

## 10. Cross-Cutting Concerns

This chapter specifies requirements that permeate every surface of the Modular Enterprise Architecture Workbench. Cross-cutting concerns — real-time collaboration, internationalization, and performance — shape the behavior of the entire application shell and must be satisfied by every component. Each section enumerates measurable, implementation-ready specifications derived from the PRD acceptance criteria, scaling requirements (PRD Section 9.2), and open questions regarding multi-user steering (Open Question #4).

---

### 10.1 Real-Time Collaboration Indicators

The application shell shall include infrastructure for multi-user editing and presence awareness. Full multi-user steering is designated as a future roadmap item (Open Question #4), but the UI foundation must be laid now so that activation requires only backend integration.

#### 10.1.1 Multi-user cursor support: colored cursors with user name labels (future roadmap)

Each collaborator shall be assigned a unique color from the collaboration palette: **Collaborator Blue #3B82F6**, **Teal #14B8A6**, **Amber #F59E0B**, **Rose #F43F5E**, **Violet #8B5CF6**, **Emerald #10B981**. When a remote user moves their mouse over an editable canvas, the local client shall render a 16×16 px arrow SVG cursor at the remote coordinate with a 2 px stroke in the user's color and a 1 px White #FFFFFF outline. A user name label shall float 6 px below-right of the cursor tip using 11px/400 Ink #0F172A text on a Cloud #F8FAFC background with 1 px Silver #CBD5E1 border and 4 px border-radius. The label fades in over **fast 150ms** (enter easing `cubic-bezier(0,0,0.2,1)`) and fades out over **normal 250ms** (exit easing `cubic-bezier(0.4,0,1,1)`) after 2 seconds of cursor inactivity. Position updates shall be throttled to 30 Hz. All cursor rendering is gated behind feature flag `ENABLE_COLLAB_CURSORS` (default `false`).

#### 10.1.2 Presence indicators: avatar stack in toolbar showing active users

The global toolbar (top-right, adjacent to the trust mode badge) shall host an avatar stack showing all connected collaborators. Avatars are 28×28 px circles with -8 px negative margin-left for overlap. Each displays a profile picture or a colored circle (using the user's assigned collaboration color) with two-letter initials in White #FFFFFF at 11px/600, surrounded by a 2 px Cloud #F8FAFC ring. The stack shows a maximum of 5 avatars; beyond that, a "+N" overflow badge appears in Slate #475569. Hovering the stack reveals a tooltip with the full user list, current panel focus, and online status, appearing with **fast 150ms** fade-in and dismissing on mouse leave with **normal 250ms** fade-out. The stack updates in real time via WebSocket presence events; disconnected users are removed within 5 seconds of heartbeat timeout.

#### 10.1.3 Conflict resolution UI: when two users edit simultaneously, merge conflict panel auto-opens

When concurrent edits collide on the same entity node, flow connector, or cost cell, a merge conflict modal shall auto-open centered at 640×480 px on desktop and full-screen below 768 px viewport width. The modal uses z-index 100 (below toasts at z-index 200). The header displays "Merge Conflict" in 16px/600 Ink #0F172A with a Warning #F59E0B triangle-exclamation icon (20×20 px). A two-column diff view shows the local version (left) and remote version (right), labeled with user names and timestamps in Slate #475569 12px/400. Additions are highlighted with a 15% opacity Success #10B981 wash; deletions use 15% opacity Error #EF4444 wash. The bottom action bar contains three buttons: "Accept Mine" (outlined, Ink #0F172A border), "Accept Theirs" (outlined), and "Merge Both" (filled, Frontend #2563EB background, White #FFFFFF text). A "Cancel" text link in Slate #475569 allows deferral; if cancelled, a conflict badge persists on the affected panel tab until resolved. The modal closes with **normal 250ms** fade-out upon any resolution action.

---

### 10.2 Internationalization (i18n)

The application shall support localization across multiple locale families. All user-facing strings, date/time formats, number formats, and layout direction shall be parameterized via a locale configuration object set at initialization.

#### 10.2.1 RTL layout support: mirrored panel order, right-aligned text, flipped icons

For RTL locales (`ar`, `he`, `fa`, `ur`), the shell shall apply mirrored layout via CSS logical properties. The navigation sidebar anchors to the right edge. Panel tabs render in reverse order. Splitter drag direction maps are inverted. All text uses `text-align: start` and `direction: rtl`. Directional icons (arrows, chevrons, flow indicators, trend arrows) are flipped via `transform: scaleX(-1)`; symmetric icons (status dots, checkmarks, shield) are not flipped. The avatar stack reverses overlap direction. RTL is toggled via a single `dir="rtl"` attribute on `<html>`, with all styles using logical properties (`inline-start`, `inline-end`) rather than physical properties (`left`, `right`).

#### 10.2.2 Date/time formatting: locale-aware display, relative time for audit entries

All dates use `Intl.DateTimeFormat` with the current locale. Absolute timestamps render as `MMM DD, YYYY HH:mm` for LTR locales (e.g., "Jan 15, 2025 14:30") with culturally appropriate rearrangement for RTL. Entries under 24 hours old use relative time via `Intl.RelativeTimeFormat` ("just now", "5 minutes ago", "2 hours ago"). Older entries switch to absolute dates. Relative labels auto-refresh every 60 seconds. The default timezone is the user's detected local timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone`, configurable in Settings.

#### 10.2.3 Number formatting: locale-aware separators, currency display for cost estimates

Numeric values use `Intl.NumberFormat` with the active locale for thousands separators, decimal separators, and digit grouping. The Cost Calculator formats monetary values using `Intl.NumberFormat(locale, { style: 'currency', currency: selectedCurrency })` where `selectedCurrency` defaults to `USD` and is user-configurable. Currency symbols render after the number where standard (e.g., `1 234,56 €` for `de-DE`). Percentages use `Intl.NumberFormat(locale, { style: 'percent' })`. All formatting is applied at render time through a shared utility so locale changes take effect immediately without reload.

The following table defines the locale adaptation matrix across four dimensions for all targeted locale families.

| Locale Family | Layout Direction | Date/Time Format | Number Separators | Currency Placement |
|---|---|---|---|---|
| Latin (en-US, en-GB, de-DE, fr-FR, es-ES, it-IT, pt-BR) | LTR, left-aligned | `MMM DD, YYYY` / `DD MMM YYYY` per sub-locale | Thousands: comma or space; Decimal: comma or dot per sub-locale | Before (`$1,234.56`) or after (`1 234,56 €`) |
| Arabic (ar-SA, ar-AE, ar-EG) | RTL, right-aligned, flipped icons | Hijri option; `DD/MMM/YYYY` | Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩); Decimal: comma | After (`١٬٢٣٤٫٥٦ ر.س`) |
| Hebrew (he-IL) | RTL, right-aligned, flipped icons | Hebrew calendar option; `DD.MMM.YYYY` | Thousands: comma; Decimal: dot | After (`1,234.56 ₪`) |
| East Asian (ja-JP, ko-KR, zh-CN, zh-TW) | LTR, left-aligned | Era year (ja-JP); `YYYY年MM月DD日` | Full-width digits option; Thousands: comma | Before (`¥1,234`) or after per sub-locale |
| South Asian (hi-IN, th-TH) | LTR, left-aligned | Buddhist calendar (th-TH); `DD-MM-YYYY` | Indian numbering (lakhs/crores) for hi-IN; Thousands: comma | Before (`₹1,234.56`) |

---

### 10.3 Performance Budgets

The workbench shall adhere to strict performance budgets from PRD Section 18.1. All budgets are worst-case measurements on a target device profile: 2019-era laptop, 2.4 GHz quad-core CPU, 8 GB RAM, mid-range integrated GPU.

#### 10.3.1 First Contentful Paint: <1.5s for IDE shell

The IDE shell (toolbar, sidebar, first panel tab bar) shall achieve FCP under 1.5 seconds from navigation start, measured via Lighthouse on cold cache with Fast 3G throttling. The critical rendering path is optimized by inlining base layout CSS (< 14 KB gzipped), deferring non-critical panels via dynamic `import()`, and preloading the Inter font with `<link rel="preload">`. The monaco-editor dependency (largest chunk) loads asynchronously after FCP via `requestIdleCallback` (200 ms `setTimeout` fallback).

#### 10.3.2 Time to Interactive: <3s for full panel operation

Full interactivity (all panels respond to input within 100 ms) shall be achieved under 3 seconds from navigation start. TTI is measured as the point after FCP when the main thread is idle for 5 seconds with no long tasks (> 50 ms) pending. Panel components use `React.lazy()` with `Suspense` boundaries so only the initially visible panel loads synchronously; others load on first activation. Redux store initialization completes within 2 seconds. WebSocket connection begins after TTI and does not block the interactive timeline.

#### 10.3.3 Panel render budget: all panels render in <1s (AC-CG-12)

Every panel shall complete initial render from mounted to fully painted in under 1 second (AC-CG-12). Measurement: React DevTools Profiler "Render" phase duration from tab activation. Large lists (audit log, deployment history) use `react-window` virtualized scrolling. The Entity Diagram uses a spatial quadtree indexing only viewport-visible nodes plus a 200 px buffer. The Flow Canvas culls off-screen connectors. Table components defer non-critical column rendering (sort indicators, action dropdowns) by one frame via `requestAnimationFrame`.

#### 10.3.4 Animation frame budget: all animations maintain 60fps, no layout thrashing

All animated transitions (panel open/close, tab switch, modal enter/exit, trust mode color transition, tooltip fade, sidebar collapse) shall maintain 60 fps (16.67 ms per frame). Animations shall exclusively use compositor-only properties: `transform` and `opacity`. Animations triggering layout recalculation (`width`, `height`, `top`, `left`, `margin`) or paint are prohibited. Trust mode badge background transitions use `transition: background-color` at **slow 400ms**, acceptable because isolated element color transitions do not cause layout thrashing. All timing uses tokenized values: instant 0ms, fast 150ms, normal 250ms, slow 400ms, deliberate 600ms; standard easing `cubic-bezier(0.4,0,0.2,1)`, enter `cubic-bezier(0,0,0.2,1)`, exit `cubic-bezier(0.4,0,1,1)`. Frequent animation targets (sidebar, floating panels) use `will-change` during animation and remove it after completion to free GPU memory.

The following table consolidates all performance budgets with targets, measurement methods, and PRD references.

| Metric | Target | Measurement Method | PRD Reference |
|---|---|---|---|
| First Contentful Paint (FCP) | < 1.5 s | Lighthouse FCP, cold cache, Fast 3G | PRD Section 18.1 |
| Time to Interactive (TTI) | < 3.0 s | Lighthouse TTI, main thread idle ≥ 5 s | PRD Section 18.1 |
| Panel Initial Render | < 1.0 s | React DevTools Profiler "Render" phase per panel | AC-CG-12 |
| Animation Frame Rate | 60 fps | Chrome DevTools Performance panel, frame timing | PRD Section 18.1 |
| Long Task Threshold | 0 tasks > 50 ms post-TTI | Chrome DevTools "Long Tasks" overlay | PRD Section 18.1 |
| Script Bundle (Initial) | < 200 KB gzipped | webpack-bundle-analyzer, entry chunk | PRD Section 9.2 |
| Monaco Editor Load | Post-FCP, async | Performance.mark around dynamic import | PRD Section 9.2 |
| WebSocket Latency | < 100 ms | Server round-trip, 95th percentile | Open Question #4 |
| Virtualized List Render | < 16 ms per frame | React DevTools Profiler, scroll handler | AC-CG-12 |