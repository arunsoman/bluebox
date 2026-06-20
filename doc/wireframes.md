I'll create a comprehensive wireframe document covering all screens with their intra-screen interactions and inter-screen navigation flows. Given the complexity, this will be a detailed specification.

---

# Collaborative Steering Pipeline — Complete Screen Wireframes & Interaction Map

## Document Map
1. [Onboarding Screens](#1-onboarding-screens)
   - 1.1 [Empty State / Landing](#11-empty-state--landing)
   - 1.2 [Input Processing](#12-input-processing-visualization)
   - 1.3 [Richness Classification](#13-richness-classification-display)
   - 1.4 [PRD Analysis Report](#14-prd-analysis-report)
   - 1.5 [Minimalist Dialogue](#15-minimalist-dialogue)
   - 1.6 [Seed Builder](#16-seed-builder)
   - 1.7 [Scale Dialogue](#17-scale-dialogue)
2. [Main IDE Shell](#2-main-ide-shell)
   - 2.1 [Global Layout](#21-global-layout-structure)
   - 2.2 [Toolbar](#22-top-toolbar)
3. [Primary Panels](#3-primary-panels)
   - 3.1 [Chat Panel](#31-chat-panel)
   - 3.2 [Steering Panel](#32-steering-panel)
   - 3.3 [File Explorer](#33-file-explorer)
   - 3.4 [Editor](#34-editor)
   - 3.5 [Live Preview](#35-live-preview)
   - 3.6 [Terminal](#36-terminal)
   - 3.7 [Test Results](#37-test-results)
   - 3.8 [Blueprint Graph](#38-blueprint-graph)
   - 3.9 [Audit Panel](#39-audit-panel)
4. [Overlays & Modals](#4-overlays--modals)
   - 4.1 [Command Palette](#41-command-palette)
   - 4.2 [Confirmation Dialogs](#42-confirmation-dialogs)
   - 4.3 [Impact Report Overlay](#43-impact-report-overlay)
   - 4.4 [Bookmark Comparison Drawer](#44-bookmark-comparison-drawer)
   - 4.5 [Settings](#45-settings)
   - 4.6 [Checkpoint Restore](#46-checkpoint-restore)
5. [Inter-Screen Navigation Matrix](#5-inter-screen-navigation-matrix)

---

## 1. Onboarding Screens

### 1.1 Empty State / Landing

**Layout (Desktop ≥1440px):**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Logo]  Collaborative Steering Pipeline                    [Chat] [Profile] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                                                                             │
│                    ┌──────────────────────────────────┐                       │
│                    │  Describe what you want to     │                       │
│                    │  build...                      │                       │
│                    │  (28px/600 Ink #0F172A)        │                       │
│                    ├──────────────────────────────────┤                       │
│                    │  Paste a PRD, type an idea,    │                       │
│                    │  upload a file, or paste a     │                       │
│                    │  Git URL — the pipeline adapts.  │                       │
│                    │  (14px/400 Slate #475569)       │                       │
│                    ├──────────────────────────────────┤                       │
│                    │                                  │                       │
│                    │  [Text input area              ] │  ← Main Input         │
│                    │  min-h:120px, max-h:400px        │                       │
│                    │  border:1px Silver, radius:12px  │                       │
│                    │  focus→Frontend #2563EB glow     │                       │
│                    │                                  │                       │
│                    ├──────────────────────────────────┤                       │
│                    │  ──────── or upload a file ──────│                       │
│                    │                                  │                       │
│                    │ [📄PRD] [🖼️Img] [📊CSV] [📦ZIP] [🔗Git] │  ← Chips           │
│                    │  40px chips, gap:12px              │                       │
│                    │  hover→Frontend bg tint            │                       │
│                    ├──────────────────────────────────┤                       │
│                    │  Or start with a template        │                       │
│                    │  ┌────────┐┌────────┐┌────────┐  │                       │
│                    │  │ SaaS   ││ Blog   ││ API    │  │  ← Template Cards    │
│                    │  │ 180x96 ││ 180x96 ││ 180x96 │  │                       │
│                    │  └────────┘└────────┘└────────┘  │                       │
│                    └──────────────────────────────────┘                       │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  Trust Mode:  (●) PARANOID  (○) BALANCED  (○) AUTO_PILOT  [ⓘ] [ⓘ] [ⓘ]     │
│  360px pill toggle, 36px height, mode-colored fills                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Intra-Screen Actions:**
| Element | Trigger | Action | Visual Feedback |
|---------|---------|--------|-----------------|
| Text Input | Click/Focus | Border→Frontend #2563EB, box-shadow glow | 150ms transition |
| Text Input | Type 500+ chars | Auto-expands to max-h:400px | Smooth height transition |
| Upload Chips | Hover | bg→`rgba(37,99,235,0.06)`, border→Frontend | 150ms transition |
| Upload Chips | Click | Opens native file picker or expands Git URL field | Chip expands to input |
| Git URL Chip | Click | Expands inline to 320px input + "Connect" button | 250ms expand |
| Template Cards | Hover | border→template color, shadow appears | 150ms, `0 2px 8px rgba` |
| Template Cards | Click | Populates main input, auto-submits after 600ms delay | Input flash + submit |
| Trust Mode Segments | Click | Fills segment with mode color, others clear | 250ms bg transition |
| Trust Mode Info Icons | Hover | Tooltip: 280px max, Ink bg, White text | 150ms fade |
| Profile Icon | Click | Opens account dropdown | Dropdown z:800 |

**Inter-Screen Navigation:**
| From | Action | To | Condition |
|------|--------|-----|-----------|
| Landing | Submit text/file/Git URL | Input Processing | `USER_INPUT` emitted |
| Landing | Click Template | Input Processing | Auto-populated + submitted |
| Landing | Trust Mode change (post-start) | Confirmation Dialog | "Changing mode affects future boundaries only" |

---

### 1.2 Input Processing Visualization

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Logo]  Collaborative Steering Pipeline                    [Chat] [Profile] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                    ┌──────────────────────────────┐                         │
│                    │            (+)               │  ← 24px spinner         │
│                    │   Analyzing your input...    │  ← 18px/600 Ink         │
│                    │   [████████████░░░░]  65%    │  ← 6px determinate bar  │
│                    │                              │                         │
│                    │ ● Receiving input            │  ← Success #10B981 ✓   │
│                    │ ● Scanning compliance...     │  ← Success #10B981 ✓   │
│                    │ ○ Classifying richness   ●   │  ← Frontend #2563EB pulse│
│                    │ ○ Analyzing PRD structure    │  ← Silver #CBD5E1 pending│
│                    │ ○ Preparing next steps       │  ← Silver #CBD5E1 pending│
│                    └──────────────────────────────┘                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Intra-Screen Actions:**
| Element | Trigger | Action | Visual Feedback |
|---------|---------|--------|-----------------|
| Progress Bar | WebSocket event | Width increases per step | 250ms width transition |
| Step Labels | Status change | `pending`→`active`→`complete` | Color + icon morph |
| Active Step | Continuous | 8px dot pulses: `scale(1)`→`scale(1.4)`, 1.5s cycle | CSS animation |
| Spinner | Mount | 360° rotation, 1.2s linear infinite | CSS animation |

**Inter-Screen Navigation:**
| From | Trigger | To | Condition |
|------|---------|-----|-----------|
| Input Processing | `RICHNESS_MODE_DETECTED` | Richness Classification | Step 3 complete |
| Input Processing | `PRD_ANALYSIS_READY` | PRD Analysis Report | WELL_FORMED + Step 4 complete |

---

### 1.3 Richness Classification Display

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Logo]  Collaborative Steering Pipeline                    [Chat] [Profile] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                    ┌──────────────────────────────┐                         │
│                    │   [========COMPLETE====] 100% │                         │
│                    │                              │                         │
│                    │  [🟢] Well-Formed PRD       │  ← Classification Badge │
│                    │      Detected        94%     │                         │
│                    │  bg:rgba(16,185,129,0.08)    │                         │
│                    │  border:Success #10B981      │                         │
│                    │                              │                         │
│                    │  Why this classification?  ▼ │  ← Expandable panel     │
│                    │    • 4 actors found          │                         │
│                    │    • Capabilities described    │                         │
│                    │    • NFRs present            │                         │
│                    │                              │                         │
│                    │  [Review PRD Analysis]       │  ← Primary CTA          │
│                    │  100% w, 44px h, Frontend bg │                         │
│                    └──────────────────────────────┘                         │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  🔔 Compliance frameworks detected                              [✕] │   │
│  │                                                                     │   │
│  │  [🛡️ GDPR] [🛡️ HIPAA] [🛡️ SOC2] [🔒 PCI-DSS]                  │   │
│  │  Dismissible chips, framework-colored                             │   │
│  │                                                                     │   │
│  │  [Review audit policy defaults ▼]                                 │   │
│  │  Policy Setting        │ Detected Default                          │   │
│  │  ─────────────────────────────────────────────────────────────────  │   │
│  │  Data Retention        │ 2555 days                                 │   │
│  │  Encryption Required   │ Yes (at-rest + in-transit)                │   │
│  │  Access Log Retention  │ 365 days                                  │   │
│  │                                                                     │   │
│  │  [Confirm and Continue to RBAC Advisor]                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Intra-Screen Actions:**
| Element | Trigger | Action | Visual Feedback |
|---------|---------|--------|-----------------|
| Classification Badge | Render | bg tinted at 8% opacity, border colored | Static |
| Confidence Score | <85% | Warning icon + "Review suggested" appended | Inline append |
| Expandable Panel | Click chevron | Expands to show basis list | 400ms height transition |
| Basis List Items | Render | Bulleted list, 13px Slate, 12px left pad | Static |
| CTA Button | Hover | bg darkens to `#1D4ED8` | 150ms transition |
| Compliance Banner | Click ✕ | Banner fades out, `display:none` | 150ms opacity→0 |
| Framework Chips | Click ✕ | Individual chip removed, recorded in DecisionLedger | Chip fade-out |
| Audit Policy Table | Click pencil | Cell transforms to inline input | Inline edit mode |
| Audit Policy Value | Below minimum | Warning: "Value below [Framework] minimum" | Inline validation |

**Inter-Screen Navigation:**
| From | Trigger | To | Condition |
|------|---------|-----|-----------|
| Classification | Click "Review PRD Analysis" | PRD Analysis Report | `WELL_FORMED` mode |
| Classification | Click "Start Guided Input" | Minimalist Dialogue | `MINIMALIST` mode |
| Classification | Click "Build Your Seed" | Seed Builder | `SEED_ONLY` mode |
| Classification | Click "Confirm and Continue" | RBAC Advisor / Stage 1 | Compliance confirmed |

---

### 1.4 PRD Analysis Report

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Logo]  Collaborative Steering Pipeline                    [Chat] [Profile] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PRD Analysis Report                                    [Export] [Close]    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ▼ Explicit Sections (4)                              [🟢]             │   │
│  │   • Actors and Roles ........................ → Stage 2               │   │
│  │   • API Requirements ........................ → Stage 3               │   │
│  │   • Non-Functional Requirements .............. → Stage 5             │   │
│  │   • Data Model ............................... → Stage 6             │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ ▼ Thin Sections (2)                                  [🟡]             │   │
│  │   • Security Requirements  [Needs detail: No threat model found]      │   │
│  │     [Add detail] → opens chat with context                            │   │
│  │   • Deployment Strategy  [Needs detail: No scaling targets]          │   │
│  │     [Add detail]                                                      │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ ▼ Missing Sections (1)                               [🔴]             │   │
│  │   • Error Handling Strategy  [Generate] → Minimalist for this only │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ ▼ Unmapped Sections (2)                              [🔵]             │   │
│  │   • Marketing Requirements  [Map to Stage ▼] [Save as Annotation] [Out of Scope]│
│  │   • Third-Party Integrations [Map to Stage ▼] [Save as Annotation] [Out of Scope]│
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  [← Back to Classification]          [Proceed to Stage 1: Actor Discovery] │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Intra-Screen Actions:**
| Element | Trigger | Action | Visual Feedback |
|---------|---------|--------|-----------------|
| Section Headers | Click | Expand/collapse section, chevron rotates 90° | 150ms rotate |
| Explicit Item | Hover | "→ Stage N" label highlights | Color→Success |
| Thin Item "Add detail" | Click | Chat panel opens, pre-seeded with context | Chat slide-in |
| Missing Item "Generate" | Click | Triggers Minimalist Dialogue for that section | Modal overlay |
| Unmapped "Map to Stage" | Click | Dropdown: Stage 0-9 | 8px dropdown |
| Unmapped "Save as Annotation" | Click | Creates `CustomAnnotation` node | Toast confirmation |
| Unmapped "Out of Scope" | Click | Flags section, excludes from pipeline | Strikethrough + badge |
| Proceed Button | Click | Validates all sections → Stage 1 | 400ms morph to Stage 1 |

**Inter-Screen Navigation:**
| From | Trigger | To | Condition |
|------|---------|-----|-----------|
| PRD Analysis | Click "Proceed" | Stage 1 (Actor Discovery) | All sections resolved |
| PRD Analysis | Click "Add detail" | Chat Panel (overlay) | Contextual question |
| PRD Analysis | Click "Generate" | Minimalist Dialogue | Gap-filling mode |

---

### 1.5 Minimalist Dialogue

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Logo]  Collaborative Steering Pipeline                    [Chat] [Profile] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                    ┌──────────────────────────────┐                         │
│                    │ QUESTION 1 OF 4                │                         │
│                    ├──────────────────────────────┤                         │
│                    │ Who are the primary users of   │                         │
│                    │ this application?              │                         │
│                    │ (15px/500 Ink)                 │                         │
│                    ├──────────────────────────────┤                         │
│                    │ [                          ] │  ← Free text textarea   │
│                    │ min-h:80px, same as landing    │                         │
│                    ├──────────────────────────────┤                         │
│                    │ [○] Patients (end users)       │  ← Radio option        │
│                    │ [○] Healthcare providers       │                         │
│                    │ [○] Administrators               │                         │
│                    ├──────────────────────────────┤                         │
│                    │              [Skip]  [Next →]  │                         │
│                    │  Skip: Slate underlined        │                         │
│                    │  Next: Frontend bg, White text │                         │
│                    └──────────────────────────────┘                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Intra-Screen Actions:**
| Element | Trigger | Action | Visual Feedback |
|---------|---------|--------|-----------------|
| Question Card | Invalid + Next | Card shakes horizontally, 300ms | `animation: shake` |
| Textarea | Type | Auto-resize, validation clears | Border→Silver |
| Radio Option | Click | Selected: border→Frontend, bg→`rgba(37,99,235,0.04)` | 150ms |
| Skip Link | Click | Advances without answer, recorded as skipped | Fade to next |
| Next Button | Click | Validates → advances to next card | Slide transition |
| Next Button (final) | Click | Label→"Submit", submits all answers | 600ms deliberate |

**Inter-Screen Navigation:**
| From | Trigger | To | Condition |
|------|---------|-----|-----------|
| Minimalist | Submit final answer | Stage 1 (Actor Discovery) | All questions answered |
| Minimalist | Skip all | Stage 1 with `deferred` flags | User skipped |

---

### 1.6 Seed Builder

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Logo]  Collaborative Steering Pipeline                    [Chat] [Profile] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                    ┌──────────────────────────────┐                         │
│                    │ Step 2 of 5 — Defining users   │                         │
│                    │ [██████░░░░░░░░░░]             │  ← Step bar            │
│                    ├──────────────────────────────┤                         │
│                    │ What is the main job your      │                         │
│                    │ users need to get done?        │                         │
│                    ├──────────────────────────────┤                         │
│                    │ [Free text input             ] │                         │
│                    ├──────────────────────────────┤                         │
│                    │ [Override: "Use my own..."]   │  ← If system suggests  │
│                    ├──────────────────────────────┤                         │
│                    │ [← Back]    [Next →]         │                         │
│                    │ Back: disabled on step 1       │                         │
│                    │ Next: Frontend bg              │                         │
│                    └──────────────────────────────┘                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Intra-Screen Actions:**
| Element | Trigger | Action | Visual Feedback |
|---------|---------|--------|-----------------|
| Step Bar | Advance | Completed→Success, Active→Frontend, Pending→Silver | Fill transition |
| Back Button | Click | Restores previous values from cache | Slide back |
| Next Button (final) | Click | Label→"Run Pipeline", bg→Success #10B981 | Color transition |
| Override Button | Click | Clears suggested default, enables free input | Field flash |

**Inter-Screen Navigation:**
| From | Trigger | To | Condition |
|------|---------|-----|-----------|
| Seed Builder | Click "Run Pipeline" | Stage 0 (Seed Validation) | Seed constructed |

---

### 1.7 Scale Dialogue

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Logo]  Collaborative Steering Pipeline                    [Chat] [Profile] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                    ┌──────────────────────────────┐                         │
│                    │      Define Your Scale         │                         │
│                    ├──────────────────────────────┤                         │
│                    │ Expected total users *         │                         │
│                    │ [ 10,000                   ]   │                         │
│                    │                                │                         │
│                    │ Peak concurrent users *        │                         │
│                    │ [ 500                      ]   │  ← ERROR: cannot exceed │
│                    │  Peak concurrent users cannot  │     total users         │
│                    │  exceed total users            │     (12px Error #EF4444)│
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

**Intra-Screen Actions:**
| Element | Trigger | Action | Visual Feedback |
|---------|---------|--------|-----------------|
| Number Input | `onBlur`/`onChange` | Cross-field validation executes | Debounced 300ms |
| Concurrent > Total | Validation | Border→Error #EF4444, message appears, button disables | 150ms |
| Correction | User fixes | Validation clears, border→Silver, button enables | 150ms |
| "Generate Options" | Click | Button text→"Generating...", spinner, fields read-only | 16px spinner |
| "No limit" checkbox | Click | Disables budget input | Opacity 0.6 |

**Inter-Screen Navigation:**
| From | Trigger | To | Condition |
|------|---------|-----|-----------|
| Scale Dialogue | Generate complete | Hosting Options Matrix | `< 10s` generation |
| Scale Dialogue | Click Cancel | Landing / Chat | Session reset |

---

## 2. Main IDE Shell

### 2.1 Global Layout Structure

**Desktop (≥1440px):**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Toolbar (48px)                                                              │
│ [●ProjectName...] [Stage 3: Capability Def]        [Save & Exit] [⚙] [BALANCED]│
├──────────┬──────────────────────────────────────────────────────┬───────────┤
│          │                                                      │           │
│  Chat    │  Tab Bar: [Editor] [Steering Panel●] [Blueprint Graph]│  Live     │
│  Panel   │                                                      │  Preview  │
│  (~65%)  ├──────────────────────────────────────────────────────┤  (Sandbox)│
│          │                                                      │  (~400px) │
│          │  Editor / SteeringPanel / Blueprint Graph            │           │
│          │  (Active content area, flex: 1)                      │           │
│          │                                                      │           │
├──────────┼──────────────────────────────────────────────────────┤           │
│ File     │  Bottom Panel (collapsible, ~200px default)          │           │
│ Explorer │  Tabs: [Terminal] [Test Results] [Audit Trail]     │           │
│ (~35%)   │                                                      │           │
│          │                                                      │           │
└──────────┴──────────────────────────────────────────────────────┴───────────┘
  320px                    flex: 1 (center)                          400px
  (260-480)                                                        (320-640)
```

**Laptop (1024–1439px):**
```
┌──────────┬──────────────────────────────────────────────────────┐
│  Chat    │          Center Column                                │
│  Panel   │        (Editor/Steering/Graph)                        │
│  (280px) │                                                       │
├──────────┤      [Preview overlay on demand]                      │
│  File    │                                                       │
│ Explorer │                                                       │
└──────────┴──────────────────────────────────────────────────────┘
```

**Tablet (768–1023px):**
```
┌─────────────────────────────────────────────────────────────────┐
│ [Chat] [Files] [Editor] [Preview] [More ▼]       ← Panel switcher│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│           One panel visible at a time                           │
│         (slides horizontally on switch)                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Intra-Screen Actions (Global):**
| Element | Trigger | Action | Visual Feedback |
|---------|---------|--------|-----------------|
| Resize Handles | Drag | Panel resizes with ghost indicator | 1px dashed #475569 preview |
| Sidebar Toggle | `Ctrl/Cmd+B` | Collapses to 48px icon bar | 250ms width animation |
| Icon Bar | Click icon | Expands panel, collapses others | 250ms enter easing |
| Tab Bar | Click tab | Switches center content | 150ms crossfade |
| Bottom Panel | `Ctrl/Cmd+Shift+T` | Collapses to 32px tab bar | 400ms vertical slide |
| Floating Preview | Click (collapsed right) | Slides in overlay at 50% width | 250ms slide from right |

---

### 2.2 Top Toolbar

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [●] MyProjectName...  [Stage 3: Capability Definition]  [Save & Exit] [⚙] [BALANCED] │
│  ↑ unsaved indicator        ↑ stage badge (pill)              ↑ trust mode    │
│  8px circle, Error #EF4444  bg keyed to stage category        28px pill,     │
│                             border-radius:12px                Warning #F59E0B│
└─────────────────────────────────────────────────────────────────────────────┘
```

**Intra-Screen Actions:**
| Element | Trigger | Action | Visual Feedback |
|---------|---------|--------|-----------------|
| Project Name | Hover | Tooltip: full name (z:900) | 150ms fade |
| Unsaved Indicator | Pending changes | 8px red dot appears | Static |
| Stage Badge | Click | Dropdown: jump to any stage | z:800 dropdown |
| Save & Exit | Click | Persists state, redirects to dashboard | Button press |
| Settings Gear | Click | Opens Settings modal | 250ms fade modal |
| Trust Mode | Click | Dropdown: PARANOID/BALANCED/AUTO_PILOT | z:800 dropdown |

---

## 3. Primary Panels

### 3.1 Chat Panel

**Layout:**
```
┌────────────────────────────────────────┐
│ Chat                           [Q] [=] │
├────────────────────────────────────────┤
│                                        │
│         ┌────────────────────┐         │
│         │ I need a SaaS for  │  User   │
│         │ dentists to manage │  Intent │
│         │ appointments       │  (Right)│
│         │ bg:#2563EB 15%     │         │
│         │ border-left:4px #2563EB       │
│         └────────────────────┘         │
│                                        │
│  ┌────────────────────────────────────┐│
│  │ System: Great! I'll help you build ││
│  │ that. Let me start with Actor      ││
│  │ Discovery...                       ││
│  │ bg:#F8FAFC, border:1px Silver    ││
│  └────────────────────────────────────┘│
│                                        │
│  ┌────────────────────────────────────┐│
│  │ [SteeringPanel Card]               ││
│  │ Stage 1: Actor Discovery           ││
│  │ ○ Patient - Primary user         ││
│  │ ○ Dentist - Provider               ││
│  │ ○ Receptionist - Staff             ││
│  │ [Accept] [Modify] [Replace]        ││
│  │ [Authorize]                        ││
│  │ shadow:0 1px 3px rgba, collapsible ││
│  └────────────────────────────────────┘│
│                                        │
│         ┌────────────────────┐         │
│         │ /steer add "Insur│ Command │
│         │ ance..."           │ (Right) │
│         │ bg:#7C3AED 15%     │         │
│         │ border-left:4px #7C3AED       │
│         │ font:monospace 14px/500        │
│         └────────────────────┘         │
│                                        │
│  ┌────────────────────────────────────┐│
│  │ [Impact] 3 nodes affected, MED    ││
│  │ severity                           ││
│  │ ActorList: +InsuranceVerifier (gr) ││
│  │ AuthPolicy: +canVerify (amber)     ││
│  └────────────────────────────────────┘│
│                                        │
├────────────────────────────────────────┤
│ Type / for commands...     [Send] [✂] │
│ ↑ placeholder, 14px/400 Slate         │
└────────────────────────────────────────┘
```

**Intra-Screen Actions:**
| Element | Trigger | Action | Visual Feedback |
|---------|---------|--------|-----------------|
| Chat Input | Type `/` | Command palette dropdown opens | 240px wide, 280px max-h |
| Command Palette | Type | Filters commands in real-time | Highlight match in #2563EB |
| Command Row | Hover | bg→#F8FAFC, 2px left border #2563EB | 150ms |
| Command Row | `Enter` | Executes command | Dropdown closes |
| Message Bubble | Consecutive same sender | Gap collapses 16px→4px | Layout shift |
| Rich Card | Click chevron | Collapses to 48px (title + primary action) | 250ms height |
| Steering Card | Entry | Slide-up from `translateY(8px)` | 250ms, standard easing |
| Send Button | Click | Emits `CHAT_MESSAGE` | Button press scale |
| Search | Click [Q] | Search input overlays header | 200px input fade-in |
| History | `Ctrl/Cmd+Up` | Recalls last sent message | Inline replace |

**Inter-Screen Navigation:**
| From | Trigger | To | Condition |
|------|---------|-----|-----------|
| Chat | `/steer` | Steering Panel (focus) | `MID_STAGE_STEER` event |
| Chat | `/revert` | Audit Panel + Confirmation | `REVISION_REQUEST` event |
| Chat | `/checkpoint` | Checkpoint Restore Modal | `CHECKPOINT_RESTORE_REQUEST` |
| Chat | `/why` | Audit Panel (filtered) | `CONTEXT_QUESTION` event |
| Chat | Click "Jump to File" in Code Card | Editor (file opened) | `FILE_OPEN_REQUEST` |
| Chat | Click "Why this file?" in Toast | Audit Panel (provenance) | Audit filter |

---

### 3.2 Steering Panel

**Expanded State:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [<] Stage 3: Capability Definition        [x] [?]                          │
│ Define what your application can do                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ [Summary | Detail]    Trust: BALANCED (8 auto-approved)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ◻ User Authentication       [MEDIUM] [⚠] [★]                              │
│   Auth layer, 3 downstream files                                           │
│                                                                             │
│ ◻ Appointment Booking       [LOW] [✓] (auto-approved)                      │
│   Standard CRUD, boilerplate                                               │
│                                                                             │
│ ◻ Payment Processing        [CRITICAL] [▲] [★]                           │
│   Security layer, 7 downstream files                                       │
│   [ ] I consent to this implementation                                     │
│                                                                             │
│ ◻ Insurance Verification    [MEDIUM] [⚠] [☆]                              │
│   Auth layer, 2 downstream files                                           │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ Why these outputs? Based on your inputs... [Tell me more]                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ [Approve All] [Review Selected] [★ Bookmark]                                │
│                                                                             │
│ Approve All: primary, disabled if CRITICAL unchecked                        │
│ Review Selected: secondary, enabled if 1+ selections                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Detail Mode (Expanded Node):**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ▼ Payment Processing                                    [MEDIUM] [CRITICAL]  │
│ ┌─────────────────────────────────────────────────────────────────────────┐   │
│ │ {                                       │                               │   │
│ │   "id": "CAP-PAY-001",                   │  Provenance Chain:           │   │
│ │   "name": "Payment Processing",          │  ○ Stage 2: Actor Discovery  │   │
│ │   "layer": "auth",                       │  ↓                            │   │
│ │   "classification": "CRITICAL",          │  ○ Stage 3: Capability Def    │   │
│ │   "access_guards": ["stripe_key"],       │  ↓                            │   │
│ │   "downstream": 7                        │  ○ Story PAY-001 approved    │   │
│ │ }                                         │  ↓                            │   │
│ │                                           │  ○ Task PAY-BE-001           │   │
│ │ [Edit in Monaco]                          │                               │   │
│ │                                           │ [View in Decision Ledger]    │   │
│ │ [Save] [Discard]                          │ [View Audit Trail]             │   │
│ └─────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Collapsed State:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│              (Editor content visible)                                       │
│                                                                             │
│              +-------------------------+                                    │
│              │ [icon] Stage 3: Capab.. │                                    │
│              │        12 nodes   [●]   │  ← pulsing amber dot              │
│              +-------------------------+                                    │
│                ^ floating pill, bottom-center, 280x48px                     │
│                z-index:50, shadow:0 4px 12px rgba                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Intra-Screen Actions:**
| Element | Trigger | Action | Visual Feedback |
|---------|---------|--------|-----------------|
| Summary/Detail Toggle | Click | Switches view mode | Crossfade 150ms |
| Node Row | Click | Expands detail card (1 at a time) | 150ms fade-in |
| Checkbox | Click | Toggles selection | 2px Silver→#2563EB fill |
| Risk Badge | Render | Colored pill: LOW=Success, MED=Warning, CRITICAL=Error | Static |
| CRITICAL Checkbox | Unchecked | Disables "Approve All" | Opacity 0.5, cursor:not-allowed |
| Bookmark Star | Click | Toggles bookmark state | Star fill toggle |
| Context Window | Click "Tell me more" | Opens Chat with ContextAgent | Chat panel focus |
| Back Button | Click | Returns to previous stage view | Slide transition |
| Close Button | Click | Collapses to floating badge | 400ms morph |
| Keyboard `1-4` | Press | Triggers action bar buttons 1-4 | Button press |
| Keyboard `Space` | Focus on row | Toggles bookmark | Star toggle |

**Inter-Screen Navigation:**
| From | Trigger | To | Condition |
|------|---------|-----|-----------|
| Steering | Click [Approve All] | Next Stage / Streaming | `STEERING_ACTION` emitted |
| Steering | Click [Modify] | Editor (inline) or Chat | `STEERING_ACTION` with modify |
| Steering | Click [Bookmark] | Bookmark Comparison Drawer | Drawer slides from right |
| Steering | Click "View in Decision Ledger" | Audit Panel (Decision Ledger) | Filtered to entry |
| Steering | Click "View Audit Trail" | Audit Panel (Audit Trail) | Filtered to events |
| Steering | Click [Edit in Monaco] | Editor (file opened) | Relevant file |

---

### 3.3 File Explorer

**Layout:**
```
┌────────────────────────────────────────┐
│ Explorer                      [Refresh]│
├────────────────────────────────────────┤
│ ▼ src/                                  │
│   ▼ frontend/                  [🔵 ●]   │
│     ▼ components/                         │
│       Login.tsx                [🔵 ✓]   │
│       Dashboard.tsx            [🔵 ○]   │
│       AppointmentCard.tsx      [🔵 ✓]   │
│     ▼ hooks/                            │
│       useAuth.ts               [🔵 ✓]   │
│     App.tsx                    [🔵 ✓]   │
│   ▼ backend/                   [🟢 ●]   │
│     ▼ api/                              │
│       auth.routes.ts           [🟢 ✓]   │
│       appointments.routes.ts   [🟢 ▲]   │
│     ▼ models/                           │
│       User.ts                  [🟢 ✓]   │
│   ▼ database/                  [🟠 ●]   │
│     schema.sql                 [🟠 ✓]   │
│   ▼ infra/                     [🟣 ●]   │
│     docker-compose.yml         [🟣 ✓]   │
│   ▼ auth/                      [🔴 ●]   │
│     rbac.config.ts             [🔴 ✓]   │
│   ▼ tests/                     [🟡 ●]   │
│     auth.test.ts               [🟡 ✓]   │
│     appointments.test.ts       [🟡 ✗]   │
└────────────────────────────────────────┘
```

**Intra-Screen Actions:**
| Element | Trigger | Action | Visual Feedback |
|---------|---------|--------|-----------------|
| Folder Chevron | Click | Expands/collapses directory | Instant rotate, 150ms child fade |
| File Row | Click | Opens file in Editor | Active highlight in tree |
| File Row | Hover (500ms debounce) | Provenance Tooltip appears | 360px tooltip below row |
| File Row | Right-click | Context Menu opens | 180px wide, cursor-positioned |
| State Icon | Render | Spinner/Check/Dot/Triangle/Grayed | Priority: Conflict>Stale>Modified>Gen>Complete |
| Layer Icon | Render | 16px shape colored by layer | Static |
| Folder Badge | Render | 6px dot top-right, plurality color | Static |
| Refresh | Click | Re-scans workspace | Spinner 360° 1s |

**Context Menu:**
```
┌─────────────────┐
│ [⚙] Steer       │ → Opens Chat with file context
│ [?] Why         │ → Opens Audit filtered to file
│ [◫] Diff        │ → Opens diff viewer
│ [↻] Regenerate  │ → Confirmation modal → Stage 8
└─────────────────┘
```

**Inter-Screen Navigation:**
| From | Trigger | To | Condition |
|------|---------|-----|-----------|
| File Explorer | Click file | Editor (tab opened) | `FILE_OPEN_REQUEST` |
| File Explorer | Right-click → Steer | Chat Panel (pre-seeded) | `CODE_FILE_STEER` |
| File Explorer | Right-click → Why | Audit Panel | `AUDIT_FILTER` by file |
| File Explorer | Right-click → Diff | Editor (diff mode) | `FILE_OPEN_REQUEST` diff |
| File Explorer | Right-click → Regenerate | Confirmation Modal | `CODE_FILE_STEER` regenerate |

---

### 3.4 Editor

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [🔵] Login.tsx    [🟢] auth.routes.ts    [🟠] schema.sql        [+] [▼]      │
│  ↑ active tab: 2px bottom #2563EB, White bg                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1  │ import React from 'react';                                            │
│  2  │ // @steering: Add input validation                                    │
│  3  │ //      ↑ bg:#2563EB 6% opacity, @steering bold #2563EB             │
│  4  │ //      ↑ 16px steering wheel icon in gutter                        │
│  5  │ import { useAuth } from '../hooks/useAuth';                           │
│  6  │                                                                       │
│  7  │ export const Login = () => {                                          │
│  8  │   const { login } = useAuth();                                        │
│  9  │   return (                                                            │
│  10 │     <form>                                                            │
│  11 │       <input type="email" />                                          │
│  12 │       <input type="password" />                                       │
│  13 │     </form>                                                           │
│  14 │   );                                                                  │
│  15 │ };                                                                    │
│     │                                                                       │
│     │ [Submit] [Dismiss]  ← floating pill at steering comment              │
│     │ 24px buttons, appear on Enter at @steering line                      │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ Ln 12, Col 7    Sel 128 bytes    UTF-8    LF    TypeScript    [🔵 Frontend]│
│  ↑ 24px status bar, 11px/400                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Streaming State:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [🔵] Login.tsx (generating...)                                   [Pause]     │
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ● Generation in progress...                                    [Pause]   │ │
│ │ [████████████████████░░░░░░░░░░]  65%                                   │ │
│ │ 28px bar, #2563EB at 8% bg, 12px pulsing dot                            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ...existing code...                                                        │
│  │ const [email, setEmail] = useState('');    ← streaming cursor         │
│  │ const [password, setPassword] = useState('');                          │
│  │ // cursor: 2px vertical bar #2563EB, 530ms blink                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Intra-Screen Actions:**
| Element | Trigger | Action | Visual Feedback |
|---------|---------|--------|-----------------|
| Tab | Click | Activates file | 2px bottom border #2563EB |
| Tab | Drag | Reorders tabs | 150ms ghost preview |
| Tab Close | Click | Closes tab, activates adjacent | Tab slides out |
| Tab Modified Dot | Unsaved changes | 6px amber dot | Static |
| Progress Bar | `CODE_FILE_STREAM` | Slides down, fills per chunk | 250ms slide |
| Pause Button | Click | Emits `MID_STAGE_STEER` (pause) | Text→"Paused", cursor static |
| Resume Button | Click | Resumes streaming | Text→"Generating...", cursor blinks |
| Streaming Cursor | Active | 2px vertical bar, 530ms blink | CSS animation |
| `@steering` Comment | Enter | Floating pill appears | Submit/Dismiss buttons |
| Submit Pill | Click | Emits `MID_STAGE_STEER` | Comment persists until regen |
| Monaco Minimap | Toggle (`Ctrl/Cmd+M`) | 80px wide collapsible | 4px color bar when collapsed |
| Status Bar Layer Badge | Click | Opens layer filter | Dropdown |

**Inter-Screen Navigation:**
| From | Trigger | To | Condition |
|------|---------|-----|-----------|
| Editor | Click "Jump to File" from Chat | File Explorer (highlight) + Editor (focus) | Cross-panel sync |
| Editor | `CODE_FILE_STREAM` complete | File Explorer (checkmark appears) | State sync |
| Editor | `@steering` Submit | Chat Panel (acknowledgment) | `MID_STAGE_STEER` |

---

### 3.5 Live Preview

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Live Preview                    [🖥️] [📱] [📱] [↔]                          │
│  ↑ Device toggles: Desktop/Tablet/Mobile/Full                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────────────────────────────┐                                │
│  │                                        │                                │
│  │     [Dental SaaS Login]                │                                │
│  │                                        │                                │
│  │     Email: [              ]            │                                │
│  │     Password: [              ]         │                                │
│  │                                        │                                │
│  │     [Login]                            │                                │
│  │                                        │                                │
│  │     [Sign up as new patient]           │                                │
│  │                                        │                                │
│  └────────────────────────────────────────┘                                │
│  ↑ iframe: sandbox="allow-scripts allow-same-origin"                       │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ http://localhost:3000                                    [📋]               │
│  ↑ 28px status bar, 12px monospace, copy button                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Disconnected State:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                           [🔌 48px icon, Slate]                             │
│                                                                             │
│                   Runtime not started.                                      │
│                   Complete Stage 8 to launch.                               │
│                                                                             │
│                         [Start Runtime]  ← post-Stage 8                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Sandbox Startup Sequence:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                    ① Container starting      [✓]                          │
│                    ② Installing dependencies   [✓]                          │
│                    ③ Building application      [↻]  ← spinning               │
│                    ④ Starting dev server       [○]                          │
│                    ⑤ Ready for preview         [○]                          │
│                                                                             │
│                    24px number circles, step labels 13px                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Intra-Screen Actions:**
| Element | Trigger | Action | Visual Feedback |
|---------|---------|--------|-----------------|
| Device Toggle | Click | Iframe width transitions | 250ms width, centered |
| Active Device | Render | 2px bottom border #2563EB, #F8FAFC bg | Static |
| Iframe Element | Click | Highlights in Editor + File Explorer | 2px pulse border #2563EB, 2s |
| Iframe Element | Right-click | Context menu: Change/Validation/RBAC | 160px menu |
| Hot Reload | Triggered | Pulse ring from center | 40px circle, #10B981, 600ms |
| Full Refresh | Fallback | Countdown banner slides down | 3→2→1→Reloading |
| Cancel Refresh | Click | Aborts reload, shows "Reload paused" | Banner text change |
| Copy URL | Click | Copies to clipboard, icon→CheckCircle | 1.5s CheckCircle |
| Start Runtime | Click | Initiates Stage 9 | Overlay→startup sequence |

**Inter-Screen Navigation:**
| From | Trigger | To | Condition |
|------|---------|-----|-----------|
| Live Preview | Click element | Editor (relevant line) + File Explorer | `PREVIEW_INTERACTIVE_ELEMENT` |
| Live Preview | Right-click → "Change this" | Chat Panel (pre-seeded) | `PREVIEW_FEEDBACK` |
| Live Preview | Right-click → "Make admin-only" | Steering Panel (RBAC) | `PREVIEW_FEEDBACK` rbac |
| Live Preview | Startup complete | Editor (file tree sync) | `RUNTIME_STARTED` |

---

### 3.6 Terminal

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Terminal                    [● Connected]    [Clear] [Maximize] [Close]       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ [resolve] Resolving dependencies...                                         │
│ [download] ⠼ downloading @types/react@18.2.0                              │
│ [download] ⠼ downloading prisma@5.0.0                                       │
│ [link] Linking dependencies...                                              │
│ [build] > next build                                                        │
│ [build] info  - Creating an optimized production build...                     │
│ [runtime] ready - started server on 0.0.0.0:3000, url: http://localhost:3000  │
│ [test] PASS  auth.test.ts                                                   │
│ [test] FAIL  appointments.test.ts                                           │
│      Expected: 200                                                          │
│      Received: 404                                                          │
│                                                                             │
│  ↑ 13px JetBrains Mono, color-coded prefixes                                 │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ [✓] deps  [✓] build  [✓] runtime  [✗] test    ← Filter bar                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Intra-Screen Actions:**
| Element | Trigger | Action | Visual Feedback |
|---------|---------|--------|-----------------|
| Filter Chips | Click | Toggles stream visibility | Check/uncheck |
| Dangerous Command | Type `rm -rf /` | Modal intercepts | 400px warning modal |
| Clear Button | Click | Clears terminal buffer | Instant clear |
| Maximize | Click | Expands to full bottom panel | 250ms height |
| Connection Dot | Status | Green #10B981 connected / Red #EF4444 disconnected | Static |
| Timestamp Hover | Hover line | Shows ISO timestamp | Tooltip |

**Inter-Screen Navigation:**
| From | Trigger | To | Condition |
|------|---------|-----|-----------|
| Terminal | Dangerous command modal | Confirmation Dialog | Intercept |
| Terminal | `DEPENDENCY_INSTALL_STATUS` failed | Dependency Failure Action Bar | Error state |
| Terminal | Click test failure | Test Results Panel (focus) | Auto-scroll to fail |

---

### 3.7 Test Results

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Test Results                                                    [Run All]   │
├─────────────────────────────────────────────────────────────────────────────┤
│ 47 tests    [███████████████░░░] 92%    4.2s    [All passing 🟢]            │
│  ↑ 48px summary bar                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ ▼ auth.test.ts                                        3 tests               │
│   ✓ should authenticate valid user                    142ms               │
│   ✓ should reject invalid credentials                  89ms                │
│   ✓ should refresh token                               201ms               │
│                                                                             │
│ ▼ appointments.test.ts                                2 tests               │
│   ✓ should create appointment                          156ms               │
│   ✗ should validate required fields                    234ms               │
│     Expected: 400                                                        │
│     Received: 200                                                        │
│     at validate (src/backend/api/appointments.routes.ts:42:11)             │
│     [Debug] [Re-run]                                                       │
│                                                                             │
│  ↑ 40px rows, 56px expanded, green/red left border                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Intra-Screen Actions:**
| Element | Trigger | Action | Visual Feedback |
|---------|---------|--------|-----------------|
| Test Row | Click | Expands to show assertion diff | 150ms height expand |
| Fail Row | Render | 2px left border #EF4444 | Static |
| Pass Row | Render | 2px left border #10B981 | Static |
| Debug Button | Click | Opens Editor at test definition, injects `debugger;` | Editor focus |
| Re-run Button | Click | Emits `TEST_RERUN` | Button spinner |
| Run All | Click | Executes full suite | Primary button press |
| Run Failed | Click | Executes only failures | Secondary button (shown if 1+ fail) |
| Stack Trace Link | Click | Opens file in Editor at line | Editor scroll + highlight |

**Inter-Screen Navigation:**
| From | Trigger | To | Condition |
|------|---------|-----|-----------|
| Test Results | Click Debug | Editor (test file, line highlighted) | `TEST_DEBUG` |
| Test Results | Click stack trace | Editor (source file) | `FILE_OPEN_REQUEST` |
| Test Results | Click Re-run | Terminal (execution output) | `TEST_RERUN` |

---

### 3.8 Blueprint Graph

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Blueprint Graph                    [2D] [3D] [?]  [What-If: ○]              │
│ [Actors ✓] [Caps ✓] [Stories ✓] [Tasks ✓] [Files ✓]  ← Layer filters      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│           [⬡] Patient (Actor)                                             │
│               /      \                                                      │
│              /        \                                                     │
│      [◆] Booking   [◆] Auth                                                 │
│      (Capability)    (Capability)                                           │
│          |               |                                                  │
│      [⬭] Schedule  [⬭] Login                                                │
│      (Use Case)      (Use Case)                                             │
│          |               |                                                  │
│      [▭] APPT-001 [▭] AUTH-001                                              │
│      (Story)          (Story)                                               │
│          |               |                                                  │
│      [▱] task-1    [▱] task-2                                               │
│          |               |                                                  │
│      [▯] appts.ts   [▯] auth.ts                                             │
│                                                                             │
│                              +---------+                                    │
│                              | minimap |  ← 160px square, bottom-right      │
│                              +---------+                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ Legend: ── dependency  - - traceability  ·· provenance                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

**What-If Mode:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [What-If: ●]  Drag nodes to simulate changes                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│      [◆] Booking  ← dragged to "nice_to_have"                              │
│           ↓                                                                 │
│      ┌─────────────────────────────────────┐                                │
│      │  Impact Overlay                     │                                │
│      │  Affected: 12 nodes                 │                                │
│      │  Severity: 3 Success, 7 Warning, 2 Error│                              │
│      │  Files to regenerate: 4              │                                │
│      │  Est. time: ~4min                    │                                │
│      │  [Simulate Impact] [Commit Change] [Discard]│                        │
│      └─────────────────────────────────────┘                                │
│                                                                             │
│  Affected nodes pulse #F59E0B border; unaffected dim to 40%               │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Intra-Screen Actions:**
| Element | Trigger | Action | Visual Feedback |
|---------|---------|--------|-----------------|
| Node | Hover | 200px tooltip: name, type, layer, status, "Steer" button | 150ms fade |
| Node | Click | 3px outer glow #2563EB at 40%, 4px spread | Selection |
| Node (What-If) | Drag | 50ms trailing delay, drop zone highlights at 48px | Dashed #F59E0B border |
| Edge | Hover | Full opacity, +1px width | 150ms |
| Edge | Click | 240px relationship card | Slide-up |
| Layer Filter | Click | Toggles visibility, 250ms fade | Fade in/out |
| 2D/3D Toggle | Click | Switches rendering mode | Crossfade |
| What-If Toggle | Click | Enables drag mode, header turns #2563EB | 150ms |
| Minimap | Drag viewport rect | Pans main view | Real-time sync |

**Inter-Screen Navigation:**
| From | Trigger | To | Condition |
|------|---------|-----|-----------|
| Graph | Click "Steer this node" | Steering Panel or Chat | `GRAPH_NODE_STEER` |
| Graph | Click node | Audit Panel (node provenance) | Filtered audit |
| Graph | Commit Change (What-If) | Impact Overlay → Steering Panel | `STEERING_ACTION` |

---

### 3.9 Audit Panel

**Decision Ledger View:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Audit Panel              [Decision Ledger | Audit Trail]  [Export JSON]       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ● DEC-042  Stage 3  Selected React + Node.js stack         2h ago    ▼    │
│   ● DEC-041  Stage 3  Selected PostgreSQL database         2h ago    ▼    │
│   ● DEC-040  Stage 2  Added InsuranceVerifier actor        3h ago    ▼    │
│   ○ DEC-039  Stage 2  Selected Patient, Dentist...       3h ago    ▼    │
│   (superseded)                                                              │
│                                                                             │
│  ↑ 48px rows, 8px status circle, 10px ID badge, 11px timestamp             │
│                                                                             │
│ Expanded DEC-042:                                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐   │
│ │ { "decision": "tech_stack_selection", "option_id": "TS-003", ... }    │   │
│ │ Linked nodes: 3                                                         │   │
│ │ Revision chain: Superseded by none                                      │   │
│ │ [Initiate Revision]                                                   │   │
│ └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│ Search: [Show me all auth layer decisions...]  ← semantic search          │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Audit Trail View:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [steering] [codegen] [system] [error]  Stage: [All ▼]  Date: [Range]        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ [steering] S3  Selected React framework        14:32:01  by: architect    │
│ [codegen]  S8  Generated Login.tsx             14:45:22  by: system       │
│ [steering] S3  Modified auth capability        15:01:15  by: architect    │
│   [View Diff]                                                             │
│                                                                             │
│  ↑ 40px rows, action type badge (pill), stage ref, description, actor     │
│                                                                             │
│ Showing 47 of 1,234 events                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Intra-Screen Actions:**
| Element | Trigger | Action | Visual Feedback |
|---------|---------|--------|-----------------|
| Tab Toggle | Click | Switches Ledger/Trail view | Crossfade 150ms |
| Status Circle | Render | Active=#10B981, Superseded=#CBD5E1, Cancelled=#EF4444 | Static |
| Expand Chevron | Click | Reveals full JSON + revision chain | 150ms height |
| Initiate Revision | Click | Emits `REVISION_REQUEST` | Confirmation modal |
| View Diff | Click | Opens 640×480 modal, two-column diff | Modal fade-in |
| Filter Chips | Click | Toggles action type filter | Active/deactive |
| Stage Dropdown | Select | Filters by stage | Dropdown close |
| Date Range | Select | Filters by timestamp | Calendar picker |
| Semantic Search | Type | Parses intent, auto-populates filter chips | 250ms debounce |
| Export JSON | Click | Downloads JSON file | Browser download |

**Inter-Screen Navigation:**
| From | Trigger | To | Condition |
|------|---------|-----|-----------|
| Audit | Click "Initiate Revision" | Steering Panel (contextual) | `REVISION_REQUEST` |
| Audit | Click linked node | Blueprint Graph (node focused) | `GRAPH_NODE_SELECT` |
| Audit | Click "View Diff" | Editor (diff modal) | Diff view |
| Audit | Semantic search result | Chat Panel (ContextAgent answer) | `CONTEXT_QUESTION` |

---

## 4. Overlays & Modals

### 4.1 Command Palette

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                    ┌──────────────────────────────────────┐                 │
│                    │  🔍 Type a command or search...      │                 │
│                    │  48px input, 16px left pad           │                 │
│                    ├──────────────────────────────────────┤                 │
│                    │  NAVIGATION                          │                 │
│                    │  > Open Steering Panel      ⌘⇧S    │                 │
│                    │  > Open Audit Panel         ⌘⇧A    │                 │
│                    │                                    │                 │
│                    │  ACTIONS                             │                 │
│                    │  > Steer current node       ⌘⇧P    │                 │
│                    │  > Revert last decision     ⌘⇧R    │                 │
│                    │  > Create checkpoint        ⌘⇧C    │                 │
│                    │                                    │                 │
│                    │  RECENT                              │                 │
│                    │  > Why did you pick PostgreSQL?      │                 │
│                    │                                    │                 │
│                    └──────────────────────────────────────┘                 │
│                    640px wide, 12px radius, z:100                          │
│                                                                             │
│  Selected row: bg:#F8FAFC, 2px left border #2563EB                        │
│  Shortcut: 12px JetBrains Mono, Cloud bg pill                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Intra-Screen Actions:**
| Element | Trigger | Action | Visual Feedback |
|---------|---------|--------|-----------------|
| Input | Type | Fuzzy filters results in real-time | Highlight match #2563EB |
| Arrow Up/Down | Keyboard | Navigates selection | Row highlight |
| Enter | Keyboard | Executes selected command | Palette closes |
| Escape | Keyboard | Closes palette | 250ms fade-out |

**Inter-Screen Navigation:**
| From | Trigger | To | Condition |
|------|---------|-----|-----------|
| Command Palette | Select "Open Steering" | Steering Panel (focus) | Tab activation |
| Command Palette | Select "Steer" | Chat Panel (pre-seeded) | `MID_STAGE_STEER` |
| Command Palette | Select "Revert" | Audit Panel + confirmation | `REVISION_REQUEST` |

---

### 4.2 Confirmation Dialogs

**Standard Confirmation:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                    ┌────────────────────────────┐                           │
│                    │         [⚠️ 48px]            │                           │
│                    │                            │                           │
│                    │  Confirm Action              │                           │
│                    │  (18px/600 Ink)              │                           │
│                    │                            │                           │
│                    │  Are you sure you want to    │                           │
│                    │  regenerate auth.routes.ts?  │                           │
│                    │  This will overwrite current │                           │
│                    │  content.                    │                           │
│                    │  (14px/400 Slate)            │                           │
│                    │                            │                           │
│                    │  [Cancel]    [Confirm]       │                           │
│                    │   secondary   primary        │                           │
│                    │                            │                           │
│                    │  [✕]  ← top-right close      │                           │
│                    └────────────────────────────┘                           │
│                    400px wide, z:1000, backdrop blur                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Destructive Confirmation (3-second hold):**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                    ┌────────────────────────────┐                           │
│                    │         [🔴 48px]            │                           │
│                    │                            │                           │
│                    │  Dangerous Command Detected  │                           │
│                    │                            │                           │
│                    │  `rm -rf /`                  │                           │
│                    │  bg:#EF4444 5%, monospace    │                           │
│                    │                            │                           │
│                    │  This command will delete all  │                           │
│                    │  files in the workspace.     │                           │
│                    │                            │                           │
│                    │  [Cancel]  [Execute Anyway (3)]│                         │
│                    │              ↑ 3s countdown    │                           │
│                    │              #EF4444 bg      │                           │
│                    └────────────────────────────┘                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Intra-Screen Actions:**
| Element | Trigger | Action | Visual Feedback |
|---------|---------|--------|-----------------|
| Backdrop | Click | Dismisses modal | 250ms fade |
| Escape | Keyboard | Dismisses modal | Focus returns to trigger |
| Cancel | Click | Closes, no action | Fade-out |
| Confirm | Click | Executes action | Fade-out |
| Dangerous Hold | 3s countdown | Button enables after 3s | Number counts down |
| Close X | Click | Dismisses | Fade-out |

---

### 4.3 Impact Report Overlay

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Impact Report                                          [✕]         │   │
│  │  12 nodes affected across 3 layers. Est. regen time: ~4min.         │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │                                                                     │   │
│  │  BEFORE                          AFTER                              │   │
│  │  ─────────────                   ─────────────                      │   │
│  │  framework: "Express.js"    →    framework: "Next.js"               │   │
│  │  (Node.js, backend)              (React, fullstack)                   │   │
│  │                                  +12 downstream tasks               │   │
│  │                                  (3 auth, 7 frontend, 2 infra)        │   │
│  │                                                                     │   │
│  │  Affected Nodes:                                                    │   │
│  │  [🟢] Login.tsx (frontend)       [🟡] auth.middleware.ts (auth)    │   │
│  │  [🟡] User.ts (backend)          [🔴] payment.gateway.ts (CRITICAL)│   │
│  │                                                                     │   │
│  │  [Cancel]  [Approve Propagation]                                    │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  640px wide, z:1000, centered                                              │
│  Additions: #10B981 bg 10%; Deletions: #EF4444 bg 10% + strikethrough     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Inter-Screen Navigation:**
| From | Trigger | To | Condition |
|------|---------|-----|-----------|
| Impact Report | Click "Approve" | Stage Running (propagation) | `PROPAGATION_CONSENT` true |
| Impact Report | Click "Cancel" | Steering Panel (no change) | `PROPAGATION_CONSENT` false |

---

### 4.4 Bookmark Comparison Drawer

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  (Editor content visible)                                                   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────┐ ← slides from │
│  │  Bookmark Comparison                          [✕]     │   right, 320px │
│  ├─────────────────────────────────────────────────────────┤   300ms      │
│  │                                                         │                │
│  │  ┌──────────────┐      ┌──────────────┐                │                │
│  │  │ Option A     │      │ Option B     │                │                │
│  │  │ PostgreSQL   │      │ DynamoDB     │                │                │
│  │  │              │      │              │                │                │
│  │  │ Scale fit:   │      │ Scale fit:   │                │                │
│  │  │ LARGE ✓      │      │ LARGE ✓      │                │                │
│  │  │              │      │              │                │                │
│  │  │ Affected:    │      │ Affected:    │                │                │
│  │  │ 12 nodes     │      │ 47 nodes     │                │                │
│  │  │              │      │              │                │                │
│  │  │ [Select A]   │      │ [Select B]   │                │                │
│  │  └──────────────┘      └──────────────┘                │                │
│  │                                                         │                │
│  │  Differences:                                           │                │
│  │  - framework: "Express.js"  + framework: "Next.js"     │                │
│  │  (deletions red strikethrough, additions green)        │                │
│  │                                                         │                │
│  └─────────────────────────────────────────────────────────┘                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 4.5 Settings

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                    ┌────────────────────────────┐                           │
│                    │  ⚙️ Settings                 │                           │
│                    │  (18px/600)                  │                           │
│  ├────────────────────────────────────────────────┤                           │
│  │  General                                       │                           │
│  │    [Persona: Developer ▼]                      │                           │
│  │    [Theme: Light ● Dark ○ System]              │                           │
│  │    [Language: English ▼]                      │                           │
│  │                                                │                           │
│  │  Trust Mode                                    │                           │
│  │    PARANOID  [○]  BALANCED  [●]  AUTO_PILOT [○]│                           │
│  │                                                │                           │
│  │  Notifications                                 │                           │
│  │    [✓] In-app toasts                           │                           │
│  │    [✓] Browser tab title                       │                           │
│  │    [ ] Webhook callbacks                       │                           │
│  │                                                │                           │
│  │  Infrastructure                                │                           │
│  │    ⚠️ Profile stale. [Re-run Advisor]          │                           │
│  │                                                │                           │
│  │  Keyboard Shortcuts                            │                           │
│  │    Cmd+Shift+P → Command Palette               │                           │
│  │    ...                                         │                           │
│  │                                                │                           │
│  │              [Cancel]    [Save Changes]        │                           │
│  └────────────────────────────────────────────────┘                           │
│  480px wide, z:1000                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 4.6 Checkpoint Restore

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                    ┌────────────────────────────┐                           │
│                    │  ↩️ Restore Checkpoint      │                           │
│                    │                            │                           │
│  ├────────────────────────────────────────────────┤                           │
│  │  Timeline:                                     │                           │
│  │                                                │                           │
│  │  ● Stage 1: Actor Discovery                    │                           │
│  │    Checkpoint-001    2h ago    3 nodes    [Restore]│                         │
│  │                                                │                           │
│  │  ● Stage 3: Capability Definition                │                           │
│  │    Checkpoint-003    1h ago    12 nodes   [Restore]│                         │
│  │                                                │                           │
│  │  ● Stage 5: Story Decomposition                  │                           │
│  │    Checkpoint-005    30min ago  24 nodes  [Restore]│                         │
│  │                                                │                           │
│  │  [Cancel]                                      │                           │
│  │                                                │                           │
│  │  Safety Phrase: [________________]             │                           │
│  │  Type "RESTORE CHECKPOINT" to confirm          │                           │
│  └────────────────────────────────────────────────┘                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Inter-Screen Navigation Matrix

### 5.1 Global Navigation (All Screens)

| Trigger | Source | Destination | Event/Action | Notes |
|---------|--------|-------------|------------|-------|
| `Ctrl/Cmd+Shift+P` | Any | Command Palette | Modal overlay | Focus trapped |
| `Ctrl/Cmd+B` | Any | Chat Panel toggle | `leftSidebarCollapsed` flip | Persists layout |
| `Ctrl/Cmd+Shift+E` | Any | File Explorer toggle | `leftSidebarCollapsed` flip | If chat closed, opens files |
| `Ctrl/Cmd+Shift+R` | Any | Live Preview toggle | `rightSidebarCollapsed` flip | Overlay on laptop |
| `Ctrl/Cmd+Shift+T` | Any | Terminal toggle | `bottomPanelCollapsed` flip | Bottom panel |
| `Ctrl/Cmd+Shift+G` | Any | Blueprint Graph | Center tab switch | Activates graph tab |
| `F6` / `Shift+F6` | Any | Cycle panel focus | Landmark rotation | Toolbar→Files→Editor→Right→Chat |
| `Escape` | Modal | Close modal, return focus | Dismiss | All modals |
| `Escape` | Sidebar | Collapse panel | `collapsed=true` | Editor receives focus |
| Stage Badge click | Toolbar | Stage jump dropdown | z:800 dropdown | Jump to any completed stage |

### 5.2 Onboarding Flow Navigation

| Step | Screen | Next Screen | Trigger | Back Allowed? |
|------|--------|-------------|---------|---------------|
| 1 | Landing | Input Processing | Submit input | No |
| 2 | Input Processing | Richness Classification | `RICHNESS_MODE_DETECTED` | No |
| 3 | Richness Classification | PRD Analysis | "Review PRD Analysis" | Yes (to landing) |
| 3 | Richness Classification | Minimalist Dialogue | "Start Guided Input" | Yes |
| 3 | Richness Classification | Seed Builder | "Build Your Seed" | Yes |
| 4 | PRD Analysis | Stage 1 (IDE) | "Proceed to Stage 1" | Yes |
| 4 | Minimalist Dialogue | Stage 1 (IDE) | Submit final answer | Yes (per question) |
| 4 | Seed Builder | Stage 0 (IDE) | "Run Pipeline" | Yes (per step) |
| 5 | Scale Dialogue | Hosting Options | "Generate Options" | Yes |

### 5.3 IDE Panel Navigation (Inter-Panel)

| Source Panel | Action | Target Panel | Event | Visual Bridge |
|--------------|--------|--------------|-------|---------------|
| Chat | `/steer` | Steering Panel | `MID_STAGE_STEER` | Steering tab auto-activates |
| Chat | `/revert` | Audit Panel | `REVISION_REQUEST` | Audit tab opens, entry highlighted |
| Chat | `/checkpoint` | Checkpoint Modal | `CHECKPOINT_RESTORE_REQUEST` | Modal overlay |
| Chat | `/why` | Audit Panel | `CONTEXT_QUESTION` | Audit opens, filtered |
| Chat | Click "Jump to File" | Editor + File Explorer | `FILE_OPEN_REQUEST` | File tree highlights, editor opens |
| Chat | Click "Why this file?" | Audit Panel | Provenance query | Audit filtered to file |
| Steering | Click [Approve] | Editor / Streaming | `STEERING_ACTION` | Next stage or code streaming |
| Steering | Click [Modify] | Chat | `STEERING_ACTION` | Chat opens with context |
| Steering | Click [Bookmark] | Bookmark Drawer | `BOOKMARK_TOGGLE` | Drawer slides from right |
| Steering | Click "View Ledger" | Audit Panel | Navigation | Audit tab, Decision Ledger view |
| Steering | Click "View Audit" | Audit Panel | Navigation | Audit tab, Audit Trail view |
| File Explorer | Click file | Editor | `FILE_OPEN_REQUEST` | Tab opens, syntax highlight |
| File Explorer | Right-click → Steer | Chat | `CODE_FILE_STEER` | Chat opens, file context |
| File Explorer | Right-click → Why | Audit | `AUDIT_FILTER` | Audit opens, file filtered |
| File Explorer | Right-click → Diff | Editor | `FILE_OPEN_REQUEST` (diff) | Diff view opens |
| Editor | `@steering` Submit | Chat | `MID_STAGE_STEER` | Chat acknowledgment |
| Editor | Click "Jump to File" from Chat | File Explorer | Sync | Tree highlights file |
| Live Preview | Click element | Editor + File Explorer | `PREVIEW_INTERACTIVE_ELEMENT` | 2px pulse border on file |
| Live Preview | Right-click → "Change" | Chat | `PREVIEW_FEEDBACK` | Chat pre-seeded |
| Live Preview | Right-click → "Make admin-only" | Steering Panel | `PREVIEW_FEEDBACK` (rbac) | RBAC context |
| Terminal | Dangerous command | Confirmation Modal | Intercept | Modal blocks execution |
| Terminal | Test failure click | Test Results | Auto-focus | Scroll to failure |
| Test Results | Click Debug | Editor | `TEST_DEBUG` | File opens, `debugger;` injected |
| Test Results | Click Stack Trace | Editor | `FILE_OPEN_REQUEST` | Scroll to line, highlight |
| Blueprint Graph | Click "Steer" | Steering Panel / Chat | `GRAPH_NODE_STEER` | Contextual steering |
| Blueprint Graph | Click node | Audit | Filtered audit | Node provenance |
| Blueprint Graph | Commit Change | Impact Overlay | `STEERING_ACTION` | Impact→Steering flow |
| Audit | Click "Initiate Revision" | Steering Panel | `REVISION_REQUEST` | Contextual stage |
| Audit | Click linked node | Blueprint Graph | `GRAPH_NODE_SELECT` | Graph centers on node |
| Audit | Click "View Diff" | Editor | Diff modal | Side-by-side diff |
| Audit | Semantic search | Chat | `CONTEXT_QUESTION` | ContextAgent answer |

### 5.4 Modal-to-Panel Navigation

| Modal | Action | Target | Condition |
|-------|--------|--------|-----------|
| Command Palette | "Open Steering" | Steering Panel (center tab) | Immediate |
| Command Palette | "Open Audit" | Audit Panel (bottom tab) | Immediate |
| Command Palette | "Steer" | Chat Panel | Pre-seeded |
| Confirmation | Confirm Regenerate | Editor + File Explorer | File re-streams |
| Impact Report | Approve | Editor / Streaming | Propagation begins |
| Impact Report | Cancel | Steering Panel | No change |
| Bookmark Drawer | Select Option | Steering Panel | `STEERING_ACTION` with option |
| Checkpoint Restore | Confirm | Landing / Stage N | Full state rewind |
| Settings | Save | All panels | Persona changes hide/show panels |

### 5.5 State-Driven Auto-Navigation

| Backend Event | Source | Auto-Opens | Focus Steal? | Visual Alert |
|---------------|--------|------------|--------------|--------------|
| `STEERING_PANEL_READY` | Backend | Steering Panel (center tab) | Yes, unless typing in Chat | Pulsing orange dot on tab |
| `IMPACT_REPORT_READY` | Backend | Impact Report Overlay | Yes | Modal overlay |
| `CODE_FILE_STREAM` | Backend | Editor (if file open) | No | Progress bar slides down |
| `CODE_FILE_COMPLETE` | Backend | File Explorer (checkmark) | No | Checkmark scale animation |
| `TEST_RESULT_STREAM` | Backend | Test Results (if failure) | No | Auto-scroll to first fail |
| `RUNTIME_STARTED` | Backend | Live Preview | No | Green border flash 600ms |
| `ERROR` | Backend | Chat Panel (error bubble) | No | Red toast + assertive announce |
| `CHECKPOINT_RESTORED` | Backend | Landing / Current Stage | No | Toast confirmation |
| `REVISION_BUDGET_EXHAUSTED` | Backend | Revision Budget Modal | Yes | Modal overlay |

---

## 6. Responsive Transformation Map

| Breakpoint | Layout Change | Panel Behavior | Preview Behavior | Resize Handles |
|------------|---------------|----------------|------------------|----------------|
| **Desktop ≥1440px** | Three-column | All visible | Persistent sidebar (400px) | All active |
| **Laptop 1024-1439px** | Two-column | Right sidebar collapsed to 48px icon bar | Floating overlay (50% width, slide-in) | All active |
| **Tablet 768-1023px** | Single-column + switcher | One panel visible at a time | Full-screen panel when selected | Hidden |
| **<<768px** | Unsupported modal | Blocked by modal | N/A | N/A |

**Panel Switcher (Tablet):**
```
┌─────────────────────────────────────────────────────────────────┐
│ [💬 Chat] [📁 Files] [📝 Editor] [👁 Preview] [⋯ More ▼]          │
│  40px height, 44px touch targets, horizontal scroll             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│              (Selected panel renders full-screen)               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**More Menu (Tablet):**
```
┌─────────────────────────────────────────────────────────────────┐
│ Terminal | Test Results | Audit Trail | Settings | Blueprint Graph│
│  Bottom sheet, 320px height, slide-up                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Animation & Transition Specification

| Transition | Duration | Easing | Properties | Context |
|------------|----------|--------|------------|---------|
| Panel slide (sidebar) | 250ms | `cubic-bezier(0,0,0.2,1)` | `width` | Sidebar expand/collapse |
| Panel slide (bottom) | 400ms | `cubic-bezier(0.4,0,0.2,1)` | `height` | Bottom panel |
| Tab crossfade | 150ms | `cubic-bezier(0.4,0,0.2,1)` | `opacity` | Center tab switch |
| Modal enter | 250ms | `cubic-bezier(0,0,0.2,1)` | `translateY(-16px)→0`, `opacity` | All modals |
| Modal exit | 250ms | `cubic-bezier(0.4,0,1,1)` | Reverse | All modals |
| Drawer slide | 300ms | `cubic-bezier(0,0,0.2,1)` | `translateX(100%)→0` | Bookmark drawer |
| Toast enter | 150ms | `cubic-bezier(0,0,0.2,1)` | `translateX(60px)`, `opacity` | Notifications |
| Toast exit | 150ms | `cubic-bezier(0.4,0,1,1)` | `translateY(-20px)`, `opacity` | Notifications |
| Steering morph | 400ms | `cubic-bezier(0.4,0,0.2,1)` | `width`, `height`, `border-radius` | Badge→Full |
| Code streaming | 250ms | `cubic-bezier(0.4,0,0.2,1)` | `translateY(-28px)` | Progress bar |
| Hot reload pulse | 600ms | `cubic-bezier(0.4,0,0.2,1)` | `scale`, `opacity` | Live Preview |
| File checkmark | 300ms | `cubic-bezier(0.4,0,0.2,1)` | `scale(0)→1.2→1.0` | File Explorer |
| Empty state fade | 150ms | `cubic-bezier(0.4,0,0.2,1)` | `opacity` | Panel first content |
| Skeleton shimmer | 1500ms | linear | `background-position` | Loading states |
| Spinner rotation | 1200ms | linear | `rotate(360deg)` | Infinite |

---

I'll create the missing screens for **Node Editing**, **Enrichment**, and **Sanity Check / Validation**. These are critical CRUD and governance surfaces from the PRD.

---

# Collaborative Steering Pipeline — Missing Screen Wireframes

## Document Map
1. [Node Editor Modal](#1-node-editor-modal)
   - 1.1 [Use Case Editor](#11-use-case-editor)
   - 1.2 [User Story Editor](#12-user-story-editor)
   - 1.3 [Task Editor](#13-task-editor)
   - 1.4 [Actor / Capability Editor](#14-actor--capability-editor)
2. [Enrichment Panel](#2-enrichment-panel)
3. [Sanity Check & Validation Dashboard](#3-sanity-check--validation-dashboard)
   - 3.1 [Completeness Gate (Stage 7)](#31-completeness-gate-stage-7)
   - 3.2 [Node Validation Inspector](#32-node-validation-inspector)
   - 3.3 [Bulk Fix Wizard](#33-bulk-fix-wizard)
4. [Node CRUD Context Flows](#4-node-crud-context-flows)

---

## 1. Node Editor Modal

**Universal Layout (adapts per node type):**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │  [◆] Edit Use Case: UC-BOOK-001                           [✕]        │   │
│  │  Capability: Appointment Booking (CAP-BOOK-001)                      │   │
│  ├────────────────────────────────────────────────────────────────────────┤   │
│  │                                                                        │   │
│  │  Basic Info                                                            │   │
│  │  ┌────────────────────────────────────────────────────────────────────┐ │   │
│  │  │ Name *            [Appointment Booking                            │ │   │
│  │  │                   ]                                                │ │   │
│  │  │ ID                UC-BOOK-001 (read-only)                         │ │   │
│  │  │ Layer             [Frontend ▼]                                     │ │   │
│  │  │ Status            [SYSTEM_GENERATED ▼]                             │ │   │
│  │  └────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                        │   │
│  │  Description & Context                                                 │   │
│  │  ┌────────────────────────────────────────────────────────────────────┐ │   │
│  │  │ Description *                                                      │ │   │
│  │  │ [A patient books an appointment with a dentist through...         │ │   │
│  │  │  the web interface, selecting date, time, and service.           │ │   │
│  │  │  The system checks availability and confirms instantly.]           │ │   │
│  │  │ min-h:120px, max-h:240px                                           │ │   │
│  │  │                                                                    │ │   │
│  │  │ Business Context                                                     │ │   │
│  │  │ [This supports the "Reduce no-shows by 30%" OKR from the         │ │   │
│  │  │  Q2 planning session. Currently handled via phone calls.]        │ │   │
│  │  └────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                        │   │
│  │  Actors & Preconditions                                                │   │
│  │  ┌────────────────────────────────────────────────────────────────────┐ │   │
│  │  │ Primary Actor      [Patient ▼]                                     │ │   │
│  │  │ Secondary Actors   [Receptionist ▼] [Dentist ▼] [+ Add Actor]     │ │   │
│  │  │                    Multi-select chips, removable                      │ │   │
│  │  │                                                                    │ │   │
│  │  │ Preconditions                                                      │ │   │
│  │  │ [• Patient must be registered and logged in                       │ │   │
│  │  │  • Dentist must have available slots in their calendar           │ │   │
│  │  │  • Service must be active and not deprecated]                     │ │   │
│  │  │ Numbered list, auto-formatted                                       │ │   │
│  │  └────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                        │   │
│  │  Flow Steps (Main + Alternatives)                                      │   │
│  │  ┌────────────────────────────────────────────────────────────────────┐ │   │
│  │  │ Main Flow                                                          │ │   │
│  │  │ 1. [Patient selects service from catalog]                         │ │   │
│  │  │ 2. [System displays available time slots]                         │ │   │
│  │  │ 3. [Patient selects date and time]                                │ │   │
│  │  │ 4. [System validates slot availability in real-time]              │ │   │
│  │  │ 5. [System creates appointment and sends confirmation]          │ │   │
│  │  │ [+ Add Step]  [🗑️] [↑] [↓]                                        │ │   │
│  │  │                                                                    │ │   │
│  │  │ Alternative Flows                                                  │ │   │
│  │  │ ┌────────────────────────────────────────────────────────────────┐ │ │   │
│  │  │ │ Alt 1: Slot unavailable                                        │ │ │   │
│  │  │ │ 4a. [System shows next 3 available slots]                    │ │ │   │
│  │  │ │ 4b. [Patient selects alternative or cancels]                 │ │ │   │
│  │  │ │ [+ Add Alt Flow]                                             │ │ │   │
│  │  │ └────────────────────────────────────────────────────────────────┘ │ │   │
│  │  └────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                        │   │
│  │  Postconditions & Success Criteria                                     │   │
│  │  ┌────────────────────────────────────────────────────────────────────┐ │   │
│  │  │ Postconditions                                                     │ │   │
│  │  │ [• Appointment record exists in database with status "confirmed"  │ │   │
│  │  │  • Patient receives email confirmation                           │ │   │
│  │  │  • Dentist calendar is updated with blocked time]                  │ │   │
│  │  │                                                                    │ │   │
│  │  │ Success Criteria                                                   │ │   │
│  │  │ [• Booking completes in < 3 clicks                              │ │   │
│  │  │  • No double-bookings occur (concurrency test required)          │ │   │
│  │  │  • 99.9% availability check accuracy]                            │ │   │
│  │  └────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                        │   │
│  │  Validation Status                                                       │   │
│  │  ┌────────────────────────────────────────────────────────────────────┐ │   │
│  │  │ [🟢] Name: present    [🟢] Description: present                   │ │   │
│  │  │ [🟢] Actors: 2+ found [🟡] Preconditions: 2/3 complete           │ │   │
│  │  │ [🟢] Flow: 5+ steps   [🔴] Postconditions: missing payment check   │ │   │
│  │  │                                                                    │ │   │
│  │  │ [Run Auto-Enrich] ← AI suggests missing fields                   │ │   │
│  │  └────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                        │   │
│  │  Provenance & Audit                                                      │   │
│  │  ┌────────────────────────────────────────────────────────────────────┐ │   │
│  │  │ Generated: Stage 3 by LLM (GPT-4) at 14:32:01                    │ │   │
│  │  │ Last edited: by architect at 15:45:22                              │ │   │
│  │  │ Decision: DEC-042 (Tech stack selection)                           │ │   │
│  │  │ [View in Decision Ledger] [View Full Audit Trail]                  │ │   │
│  │  └────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                        │   │
│  │              [Cancel]  [Save Changes]  [Save & Enrich →]             │   │
│  │                                                                        │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│  720px max-width, 90vh max-height, scrollable, z:1000                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.1 Use Case Editor

**Required Fields per PRD AC:**
- `name` (string, required)
- `id` (string, read-only, auto-generated)
- `description` (text, required, min 50 chars)
- `primary_actor` (reference to Actor node, required)
- `secondary_actors` (array of Actor references)
- `preconditions` (array of strings, required, min 1)
- `main_flow` (ordered array of steps, required, min 3 steps)
- `alternative_flows` (array of named step sequences)
- `postconditions` (array of strings, required, min 1)
- `success_criteria` (array of strings)
- `layer` (enum: frontend/backend/database/infra/auth/test)
- `status` (enum: system_generated/user_enriched/user_defined/superseded/inferred/deferred/orphaned)

**Validation Rules:**
| Field | Rule | Error Message |
|-------|------|---------------|
| Name | Non-empty, unique within capability | "Name required and must be unique" |
| Description | Min 50 chars | "Description too brief (min 50 chars)" |
| Primary Actor | Must reference valid Actor node | "Primary actor must be a confirmed Actor" |
| Preconditions | Min 1 item | "At least one precondition required" |
| Main Flow | Min 3 steps | "Main flow must have at least 3 steps" |
| Postconditions | Min 1 item | "At least one postcondition required" |

**Intra-Screen Actions:**
| Element | Trigger | Action | Visual Feedback |
|---------|---------|--------|-----------------|
| Name Input | Blur | Uniqueness check against sibling use cases | Inline validation |
| Actor Select | Select | Validates actor exists in Stage 2 output | Dropdown with actor avatars |
| Flow Step | Drag handle | Reorders steps | Ghost preview, 150ms |
| Flow Step | Click 🗑️ | Removes step, renumbers | Fade out, cascade renumber |
| "+ Add Step" | Click | Inserts new step at end | Slide in, auto-focus |
| "+ Add Alt Flow" | Click | Creates new alternative flow block | Expandable card |
| Validation Row | Click | Scrolls to offending field | Field border flashes #EF4444 |
| "Run Auto-Enrich" | Click | AI suggests missing fields | Loading spinner, then field populate |
| "Save & Enrich" | Click | Saves then opens Enrichment Panel | Modal→Panel transition |

**Inter-Screen Navigation:**
| From | Trigger | To | Condition |
|------|---------|-----|-----------|
| Use Case Editor | Click "View in Decision Ledger" | Audit Panel (filtered) | `DEC-042` focused |
| Use Case Editor | Click "View Full Audit Trail" | Audit Panel (Audit Trail tab) | Events filtered |
| Use Case Editor | Save + `IMPACT_REPORT_READY` | Impact Report Overlay | Downstream effects |
| Use Case Editor | Click "Save & Enrich" | Enrichment Panel | Post-save enrichment |

---

### 1.2 User Story Editor

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [▭] Edit User Story: US-AUTH-001                              [✕]        │
│  Use Case: Login (UC-AUTH-001)                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Basic Info                                                                 │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Title *        [As a Patient, I want to log in with email/password    │ │
│  │                so that I can access my appointment history]           │ │
│  │                Standard format enforced: "As a [role], I want [goal] │ │
│  │                so that [benefit]"                                      │ │
│  │ ID             US-AUTH-001 (read-only)                                 │ │
│  │ Story Points   [5 ▼] (1, 2, 3, 5, 8, 13, 21)                           │ │
│  │ Priority       [Must Have ▼] (Must Have / Should Have / Could Have)   │ │
│  │ Layer          [Auth ▼]                                                │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  Acceptance Criteria (AC) — REQUIRED                                        │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ AC-1: [Given a registered patient with valid credentials             │ │
│  │       When they submit the login form                                 │ │
│  │       Then they are authenticated and redirected to dashboard]        │ │
│  │       [🗑️] [↑] [↓]                                                   │ │
│  │                                                                        │ │
│  │ AC-2: [Given an unregistered email                                    │ │
│  │       When submitted                                                  │ │
│  │       Then display "Account not found" error with registration link]  │ │
│  │       [🗑️] [↑] [↓]                                                   │ │
│  │                                                                        │ │
│  │ AC-3: [Given 5 failed login attempts                                  │ │
│  │       When the 6th attempt is made                                    │ │
│  │       Then account is temporarily locked for 15 minutes]              │ │
│  │       [🗑️] [↑] [↓]                                                   │ │
│  │                                                                        │ │
│  │ [+ Add Acceptance Criterion]                                           │ │
│  │                                                                        │ │
│  │ [🟢] 3 AC defined (min 1 required)                                    │ │
│  │ [🔴] AC-2 missing "Given" clause — incomplete format                  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  Technical Notes & Dependencies                                            │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Technical Notes                                                        │ │
│  │ [Use JWT with 15min expiry. Refresh token stored in httpOnly cookie. │ │
│  │  Password hashing: bcrypt with cost factor 12.]                       │ │
│  │                                                                        │ │
│  │ Dependencies                                                           │ │
│  │ [US-AUTH-002] [US-PROF-001] [CAP-BOOK-001]                            │ │
│  │ Multi-select of upstream stories/capabilities, draggable chips           │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  Validation Status                                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ [🟢] Title format valid    [🟢] Story points assigned                 │ │
│  │ [🟢] Priority set          [🔴] Acceptance Criteria: 3 defined, 1 error │ │
│  │ [🟢] Dependencies resolved [🟡] Technical notes: present but thin      │ │
│  │                                                                        │ │
│  │ [Run Auto-Enrich] ← AI fixes AC-2 format, expands technical notes    │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│              [Cancel]  [Delete Story]  [Save Changes]  [Save & Enrich →]  │
│                        ↑ Danger button, #EF4444, requires confirmation    │
└─────────────────────────────────────────────────────────────────────────────┘
```

**User Story Validation Rules (PRD AC Enforcement):**
| Field | Rule | Error Message | PRD Ref |
|-------|------|---------------|---------|
| Title | Must match "As a [actor], I want [goal], so that [benefit]" | "User story must follow standard format" | AC-ST-06 |
| Acceptance Criteria | Min 1, each must have Given/When/Then | "AC required. Each must have Given/When/Then" | AC-CG-01 |
| AC Format | Each AC must contain all three clauses | "AC-{N} missing {clause} clause" | AC-NF-04 |
| Story Points | Must be Fibonacci number | "Story points must be Fibonacci (1,2,3,5,8,13,21)" | — |
| Priority | Must be Must/Should/Could Have | "Priority required" | — |
| Dependencies | Must reference existing nodes | "Dependency {id} not found in blueprint" | AC-ST-06 |

**AC Format Validator (Inline):**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ AC Format Checker (real-time)                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Given: [✓] "Given a registered patient..."                              │ │
│ │ When:  [✓] "When they submit the login form..."                         │ │
│ │ Then:  [✓] "Then they are authenticated..."                             │ │
│ │                                                                         │ │
│ │ [🟢] Complete AC format — all clauses present                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ If incomplete:                                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Given: [✗] Missing — start with "Given..."                              │ │
│ │ When:  [✓] "When submitted..."                                          │ │
│ │ Then:  [✓] "Then display..."                                            │ │
│ │                                                                         │ │
│ │ [🔴] Incomplete AC — add "Given" clause                                  │ │
│ │ [Auto-Fix] ← AI suggests Given clause based on story context            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 1.3 Task Editor

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [▱] Edit Engineering Task: TASK-AUTH-BE-001                   [✕]        │
│  User Story: US-AUTH-001 (Login)                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Basic Info                                                                 │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Task Name *    [Implement JWT authentication middleware               │ │
│  │                for email/password login]                              │ │
│  │ ID             TASK-AUTH-BE-001 (read-only)                            │ │
│  │ Layer          [Backend ▼]                                             │ │
│  │ Status         [SYSTEM_GENERATED ▼]                                   │ │
│  │ Estimated Hrs  [8 ▼] (1, 2, 4, 8, 16, 24, 40)                         │ │
│  │ Complexity     [Medium ▼] (Low / Medium / High / Critical)              │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  Pre & Post Conditions — REQUIRED                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Preconditions                                                          │ │
│  │ [• User model must have email and password_hash fields               │ │
│  │  • Bcrypt library must be installed (package.json)                    │ │
│  │  • Environment variables JWT_SECRET and JWT_EXPIRY must be set]       │ │
│  │  [+ Add Precondition]                                                  │ │
│  │                                                                        │ │
│  │ Postconditions                                                         │ │
│  │ [• Valid credentials return {access_token, refresh_token, user}      │ │
│  │  • Invalid credentials return 401 with structured error object         │ │
│  │  • Token payload contains user_id, role, and exp timestamp]          │ │
│  │  [+ Add Postcondition]                                                 │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  Implementation Details                                                      │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ File Paths (auto-generated from Stage 8)                               │ │
│  │ [backend/src/middleware/auth.ts] [backend/src/routes/auth.routes.ts]  │ │
│  │ [backend/src/services/auth.service.ts]                                │ │
│  │ Editable — user can add/remove paths                                   │ │
│  │                                                                        │ │
│  │ Tech Stack Requirements                                                │ │
│  │ [Node.js] [Express] [JWT] [Bcrypt] [Prisma]                            │ │
│  │ Auto-populated from TechStackProfile, editable                         │ │
│  │                                                                        │ │
│  │ Database Schema Changes                                                │ │
│  │ [ALTER TABLE users ADD COLUMN password_hash VARCHAR(255);             │ │
│  │  ALTER TABLE users ADD COLUMN refresh_token VARCHAR(255);]            │ │
│  │ Monaco editor, SQL syntax highlighting                                  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  Access Guards (Security) — REQUIRED for confidential data                  │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ [🔴] This task touches CONFIDENTIAL data (user credentials)            │ │
│  │      Access Guards REQUIRED per AC-RB-05                              │ │
│  │                                                                        │ │
│  │ Access Guards                                                          │ │
│  │ [• Route must check Authorization: Bearer <token> header            │ │
│  │  • Token must be validated against JWT_SECRET                          │ │
│  │  • Role must be extracted from token payload                           │ │
│  │  • Failed auth must log to audit table with IP and timestamp]         │ │
│  │  [+ Add Guard]                                                         │ │
│  │                                                                        │ │
│  │ [🟢] 4 access guards defined — meets requirement                       │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  Validation Status                                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ [🟢] Name: present        [🟢] Pre: 3 items                           │ │
│  │ [🟢] Post: 3 items        [🟢] File paths: 3 defined                   │ │
│  │ [🟢] Access guards: 4     [🟡] Schema changes: present but unreviewed │ │
│  │ [🔴] Estimated hours: not set — required for sprint planning           │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│              [Cancel]  [Delete Task]  [Save Changes]  [Save & Enrich →]  │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Task Validation Rules:**
| Field | Rule | Error Message | PRD Ref |
|-------|------|---------------|---------|
| Preconditions | Min 1 item | "At least one precondition required" | AC-NF-04 |
| Postconditions | Min 1 item | "At least one postcondition required" | AC-NF-04 |
| File Paths | Min 1 path, must match layer | "At least one file path required" | AC-CG-01 |
| Access Guards | Required if task touches confidential/restricted data | "Access guards required for confidential data" | AC-RB-05 |
| Estimated Hours | Must be set | "Estimated hours required for sprint planning" | — |
| Complexity | Must be set | "Complexity required for risk assessment" | — |

---

### 1.4 Actor / Capability Editor

**Actor Editor:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [⬡] Edit Actor: ACT-PATIENT-001                               [✕]        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Basic Info                                                                 │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Actor Name *   [Patient]                                               │ │
│  │ ID             ACT-PATIENT-001 (read-only)                              │ │
│  │ Type           [Primary ▼] (Primary / Secondary / System / External)    │ │
│  │ Layer          [Auth ▼]                                                │ │
│  │ Icon           [👤 ▼] (emoji selector)                                 │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  Profile & Motivations                                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Description                                                            │ │
│  │ [A person seeking dental care who uses the platform to book,         │ │
│  │  manage, and review their appointments.]                               │ │
│  │                                                                        │ │
│  │ Goals (What they want to achieve)                                      │ │
│  │ [• Book appointments quickly                                          │ │
│  │  • Receive reminders before visits                                     │ │
│  │  • View treatment history and invoices]                                │ │
│  │                                                                        │ │
│  │ Pain Points (Current frustrations)                                     │ │
│  │ [• Long phone wait times                                              │ │
│  │  • Unclear appointment availability                                     │ │
│  │  • No digital payment options]                                          │ │
│  │                                                                        │ │
│  │ Technical Proficiency                                                  │ │
│  │ [Low ▼] (Low / Medium / High) — affects UI complexity decisions        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  Permissions & RBAC (linked to RBACModel)                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Role Name          [patient]                                           │ │
│  │ Permissions        [can_book_appointment] [can_view_own_history]       │ │
│  │                    [can_cancel_appointment] [can_pay_invoice]          │ │
│  │                    [+ Add Permission]                                    │ │
│  │                                                                        │ │
│  │ Data Access Level  [Own Data Only ▼] (None / Own / Department / All)   │ │
│  │                                                                        │ │
│  │ [🟢] Actor linked to RBACModel v2                                     │ │
│  │ [View RBAC Matrix] [View Permission Rationale]                           │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  Validation Status                                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ [🟢] Name: present        [🟢] Type: set                              │ │
│  │ [🟢] Goals: 3 defined     [🟡] Pain points: 2/3 recommended            │ │
│  │ [🟢] RBAC linked          [🟢] Data access level: defined              │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│              [Cancel]  [Delete Actor]  [Save Changes]  [Save & Enrich →]   │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Capability Editor:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [◆] Edit Capability: CAP-BOOK-001                               [✕]        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Basic Info                                                                 │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Capability Name * [Appointment Booking]                                │ │
│  │ ID              CAP-BOOK-001 (read-only)                                │ │
│  │ Layer           [Frontend ▼]                                           │ │
│  │ Priority        [Must Have ▼] (Must / Should / Could / Won't Have)     │ │
│  │ Status          [SYSTEM_GENERATED ▼]                                   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  Scope & Boundaries                                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Description                                                            │ │
│  │ [The system allows patients to book dental appointments online,       │ │
│  │  selecting dentist, service, date, and time. Includes real-time       │ │
│  │  availability checking and instant confirmation.]                      │ │
│  │                                                                        │ │
│  │ In Scope                                                               │ │
│  │ [• Online booking via web and mobile                                  │ │
│  │  • Real-time availability display                                        │ │
│  │  • Email/SMS confirmation                                               │ │
│  │  • Calendar sync for dentists]                                          │ │
│  │                                                                        │ │
│  │ Out of Scope (explicitly excluded)                                     │ │
│  │ [• Walk-in appointments (handled by Receptionist manually)            │ │
│  │  • Phone booking (legacy system, not migrated)                          │ │
│  │  • Insurance pre-authorization (Phase 2)]                             │ │
│  │                                                                        │ │
│  │ Business Value                                                         │ │
│  │ [Reduces no-shows by 30%, cuts receptionist workload by 50%,          │ │
│  │  improves patient satisfaction scores.]                                 │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  Linked Use Cases (downstream)                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ [UC-BOOK-001] Patient books appointment                                │ │
│  │ [UC-BOOK-002] Patient reschedules appointment                          │ │
│  │ [UC-BOOK-003] Patient cancels appointment                              │ │
│  │ [+ Link Use Case] ← search existing or create new                      │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  Validation Status                                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ [🟢] Name: present        [🟢] Description: detailed                   │ │
│  │ [🟢] In scope: defined    [🟢] Out of scope: explicit                  │ │
│  │ [🟢] Business value: set  [🟢] Linked use cases: 3                    │ │
│  │ [🟢] Priority: Must Have  [🟢] All required fields complete              │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│              [Cancel]  [Delete Capability]  [Save Changes]  [Save & Enrich] │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Enrichment Panel

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │  ✨ Enrich: User Story US-AUTH-001                          [✕]        │   │
│  │  "Login with email and password"                                       │   │
│  ├────────────────────────────────────────────────────────────────────────┤   │
│  │                                                                        │   │
│  │  Current State                                                         │   │
│  │  ┌────────────────────────────────────────────────────────────────┐   │   │
│  │  │ Title:     As a Patient, I want to log in...                    │   │   │
│  │  │ AC Count:  3 (AC-1, AC-2, AC-3)                                 │   │   │
│  │  │ Tech Notes: Present but thin (2 lines)                          │   │   │
│  │  │ Dependencies: 2 linked                                          │   │   │
│  │  │ Completeness Score: 72%                                         │   │   │
│  │  └────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                        │   │
│  │  Suggested Enrichments (AI-generated, user-reviewed)                 │   │
│  │  ┌────────────────────────────────────────────────────────────────┐   │   │
│  │  │ [✓] Add technical detail to AC-1: specify JWT expiry (15min)  │   │   │
│  │  │ [✓] Add AC-4: "Given a locked account, When valid credentials │   │   │
│  │  │     are submitted, Then account unlocks and logs in"          │   │   │
│  │  │ [✓] Add dependency: US-SEC-001 (Password policy)                │   │   │
│  │  │ [ ] Expand technical notes with error handling strategy         │   │   │
│  │  │ [ ] Add performance criterion: "Login completes in < 500ms"    │   │   │
│  │  │                                                                    │   │   │
│  │  │ [Select All] [Deselect All]                                       │   │   │
│  │  └────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                        │   │
│  │  Preview of Enriched Story                                             │   │
│  │  ┌────────────────────────────────────────────────────────────────┐   │   │
│  │  │ As a Patient, I want to log in with email/password...          │   │   │
│  │  │                                                                │   │   │
│  │  │ AC-1 (enriched): Given a registered patient...                 │   │   │
│  │  │      → JWT access_token expires in 15 minutes, refresh_token   │   │   │
│  │  │        in 7 days. Both stored in httpOnly cookies.              │   │   │
│  │  │                                                                │   │   │
│  │  │ AC-4 (new): Given a locked account after 5 failed attempts...  │   │   │
│  │  │                                                                │   │   │
│  │  │ [🟢] Completeness Score: 91% (+19%)                             │   │   │
│  │  └────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                        │   │
│  │  Impact Analysis                                                       │   │
│  │  ┌────────────────────────────────────────────────────────────────┐   │   │
│  │  │ Enriching this story will affect:                              │   │   │
│  │  │ • Task TASK-AUTH-BE-001 (JWT middleware) — content update     │   │   │
│  │  │ • Task TASK-AUTH-BE-002 (Login route) — add unlock endpoint   │   │   │
│  │  │ • New Task: TASK-AUTH-BE-005 (Account unlock service) — ADD   │   │   │
│  │  │ • Test TEST-AUTH-001 — add unlock test case                     │   │   │
│  │  │                                                                │   │   │
│  │  │ [View Full Impact Graph]                                         │   │   │
│  │  └────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                        │   │
│  │              [Cancel]  [Apply Selected Enrichments]                  │   │
│  │                        ↑ Emits ENRICH_NODE + IMPACT_REPORT           │   │
│  │                                                                        │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│  640px wide, z:1000, scrollable                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Intra-Screen Actions:**
| Element | Trigger | Action | Visual Feedback |
|---------|---------|--------|-----------------|
| Suggestion Checkbox | Toggle | Includes/excludes from apply | Check animation |
| Select All | Click | Checks all suggestions | Cascade check |
| Deselect All | Click | Unchecks all | Cascade uncheck |
| Preview Panel | Scroll | Shows before/after diff | Static render |
| Impact Row | Hover | Highlights affected node in Blueprint Graph | Cross-panel sync |
| "View Full Impact" | Click | Opens Impact Report Overlay | Modal overlay |
| Apply Button | Click | Emits `ENRICH_NODE`, shows progress | Button spinner, then toast |

**Inter-Screen Navigation:**
| From | Trigger | To | Condition |
|------|---------|-----|-----------|
| Enrichment | Click "View Full Impact" | Impact Report Overlay | Downstream analysis |
| Enrichment | Apply + impact | Steering Panel | If user consent required |
| Enrichment | Apply (no impact) | Chat confirmation | Toast + chat bubble |

---

## 3. Sanity Check & Validation Dashboard

### 3.1 Completeness Gate (Stage 7)

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │  🔍 Stage 7: Completeness Gate                              [✕]        │   │
│  │  Validate all mandatory fields before code generation                  │   │
│  ├────────────────────────────────────────────────────────────────────────┤   │
│  │                                                                        │   │
│  │  Overall Completeness                                                    │   │
│  │  ┌────────────────────────────────────────────────────────────────┐   │   │
│  │  │ [███████████████████████░░░░░░░]  78% Complete               │   │   │
│  │  │ 112 of 144 nodes fully validated | 32 nodes have issues      │   │   │
│  │  │                                                                │   │   │
│  │  │ [🟢] 112 Valid  [🟡] 24 Warnings  [🔴] 8 Errors  [⚪] 0 Deferred│   │   │
│  │  └────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                        │   │
│  │  Validation by Stage                                                     │   │
│  │  ┌────────────────────────────────────────────────────────────────┐   │   │
│  │  │ Stage 1: Actors        [████████████░░░]  8/10  [🟡] 2 thin    │   │   │
│  │  │ Stage 2: Capabilities  [███████████████]  12/12 [🟢] complete  │   │   │
│  │  │ Stage 3: Use Cases     [██████████░░░░░]  6/8   [🟡] 2 missing pre│   │   │
│  │  │ Stage 4: Stories       [████████████░░░]  15/18 [🔴] 3 missing AC│   │   │
│  │  │ Stage 5: Tasks         [████████░░░░░░]  22/28 [🔴] 6 missing  │   │   │
│  │  │                      pre/post conditions                         │   │   │
│  │  │ Stage 6: Tech Stack    [████████████░░░]  1/1   [🟢] complete   │   │   │
│  │  │ Stage 7: Infra         [████████████░░░]  1/1   [🟡] stale      │   │   │
│  │  │ Stage 7: RBAC          [███████████████]  1/1   [🟢] complete   │   │   │
│  │  │                                                                │   │   │
│  │  │ Click any stage to expand issue details                          │   │   │
│  │  └────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                        │   │
│  │  Critical Errors (Blocking Export)                                       │   │
│  │  ┌────────────────────────────────────────────────────────────────┐   │   │
│  │  │ [🔴] US-AUTH-001: Missing Acceptance Criteria                   │   │   │
│  │  │      User story has 0 AC. Minimum 1 required.                  │   │   │
│  │  │      [Quick Fix] [Edit Story] [Defer with rationale]            │   │   │
│  │  │                                                                │   │   │
│  │  │ [🔴] TASK-PAY-BE-003: Missing Access Guards                     │   │   │
│  │  │      Task touches CONFIDENTIAL data (payment cards) but has 0   │   │   │
│  │  │      access_guards. Required per AC-RB-05.                      │   │   │
│  │  │      [Quick Fix] [Edit Task] [Defer with rationale]             │   │   │
│  │  │                                                                │   │   │
│  │  │ [🔴] UC-BOOK-001: Incomplete Main Flow                          │   │   │
│  │  │      Only 2 steps defined. Minimum 3 required for use case.    │   │   │
│  │  │      [Quick Fix] [Edit Use Case] [Defer with rationale]         │   │   │
│  │  │                                                                │   │   │
│  │  │ [🔴] ACT-ADMIN-001: Missing RBAC Link                           │   │   │
│  │  │      Actor has no linked RolePermissionEntry in RBACModel.       │   │   │
│  │  │      [Quick Fix] [Edit Actor] [Defer with rationale]            │   │   │
│  │  └────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                        │   │
│  │  Warnings (Non-Blocking but Recommended)                               │   │
│  │  ┌────────────────────────────────────────────────────────────────┐   │   │
│  │  │ [🟡] CAP-BOOK-001: Thin Description (45 chars, min 50)         │   │   │
│  │  │ [🟡] US-PROF-001: No Dependencies Linked                        │   │   │
│  │  │ [🟡] TASK-AUTH-BE-001: Technical Notes Thin (2 lines)         │   │   │
│  │  │ [🟡] INF-PROFILE-001: Infrastructure Profile Stale             │   │   │
│  │  │      Scale inputs changed since generation. Re-run advised.      │   │   │
│  │  │ [🟡] 20 more warnings... [Expand All]                           │   │   │
│  │  └────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                        │   │
│  │  Auto-Fix Options                                                        │   │
│  │  ┌────────────────────────────────────────────────────────────────┐   │   │
│  │  │ [Run Auto-Fix for All Errors] ← AI attempts to fix all blocking │   │   │
│  │  │      issues. Requires review before commit.                      │   │   │
│  │  │                                                                │   │   │
│  │  │ [Run Auto-Fix for Selected] ← Check individual errors above    │   │   │
│  │  └────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                        │   │
│  │  Export Options (Disabled until 100% or explicit override)              │   │
│  │  ┌────────────────────────────────────────────────────────────────┐   │   │
│  │  │ [Generate Code (Stage 8)]      ← disabled, opacity 0.4        │   │   │
│  │  │ [Export Blueprint JSON]        ← disabled                      │   │   │
│  │  │ [Export with Deferred Fields]  ← requires admin override       │   │   │
│  │  │      "8 errors must be resolved or explicitly deferred before   │   │   │
│  │  │       code generation can proceed."                              │   │   │
│  │  └────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                        │   │
│  │              [← Back to Stage 6]  [Run Auto-Fix All]  [Override →]   │   │
│  │                                    ↑ requires `pipeline_admin` role  │   │
│  │                                                                        │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│  800px wide, 90vh max-height, z:1000                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Intra-Screen Actions:**
| Element | Trigger | Action | Visual Feedback |
|---------|---------|--------|-----------------|
| Stage Bar | Click | Expands to show node-level issues | 400ms height expand |
| Error Row | Click | Opens Node Editor modal for that node | Modal overlay |
| "Quick Fix" | Click | AI suggests fix, opens inline preview | Inline expand |
| "Edit Story/Task/etc" | Click | Opens Node Editor | Modal overlay |
| "Defer with rationale" | Click | Opens rationale input, marks as `DEFERRED` | Inline input |
| "Run Auto-Fix All" | Click | Batch AI processing, shows progress per item | Progress bars |
| "Override" | Click | Requires typed confirmation + admin role | Confirmation modal |
| Export Buttons | Hover (disabled) | Tooltip: "Resolve 8 errors to enable" | Tooltip |

**Inter-Screen Navigation:**
| From | Trigger | To | Condition |
|------|---------|-----|-----------|
| Completeness Gate | Click error row | Node Editor (contextual) | CRUD modal |
| Completeness Gate | Click "Edit Story" | User Story Editor | Modal |
| Completeness Gate | Click "Edit Task" | Task Editor | Modal |
| Completeness Gate | Click "Override" | Confirmation Modal | Admin role check |
| Completeness Gate | 100% complete | Stage 8 (Code Generation) | Auto-transition |
| Completeness Gate | Click "Back to Stage 6" | Steering Panel (Stage 6) | `STEERING_ACTION` |

---

### 3.2 Node Validation Inspector

**Inline panel (opens from Blueprint Graph or File Explorer):**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │  🔍 Validation Inspector: US-AUTH-001                       [✕]        │   │
│  ├────────────────────────────────────────────────────────────────────────┤   │
│  │                                                                        │   │
│  │  Field Completeness                                                      │   │
│  │  ┌────────────────────────────────────────────────────────────────┐   │   │
│  │  │ Field              │ Status │ Value          │ Required │ PRD Ref  │   │   │
│  │  │ ───────────────────────────────────────────────────────────────│   │   │
│  │  │ title              │ 🟢     │ "As a Patient..." │ Yes   │ AC-ST-06│   │   │
│  │  │ acceptance_criteria│ 🟢     │ 3 items           │ Yes   │ AC-CG-01│   │   │
│  │  │ ac_format_valid    │ 🔴     │ AC-2 missing Given│ Yes   │ AC-NF-04│   │   │
│  │  │ story_points       │ 🟢     │ 5                 │ Yes   │ —       │   │   │
│  │  │ priority           │ 🟢     │ Must Have         │ Yes   │ —       │   │   │
│  │  │ dependencies       │ 🟡     │ 2 linked (1 stale)│ No    │ —       │   │   │
│  │  │ technical_notes    │ 🟡     │ 2 lines (thin)    │ No    │ —       │   │   │
│  │  │ layer              │ 🟢     │ Auth              │ Yes   │ —       │   │   │
│  │  │ provenance_chain   │ 🟢     │ DEC-042 → DEC-045 │ Yes   │ AC-CG-02│   │   │
│  │  └────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                        │   │
│  │  PRD Acceptance Criteria Mapping                                         │   │
│  │  ┌────────────────────────────────────────────────────────────────┐   │   │
│  │  │ AC-CG-01: Generated files must have Provenance Header            │   │   │
│  │  │      → 🟢 Linked to DEC-042, checkpoint-003                    │   │   │
│  │  │ AC-NF-04: No committed node with placeholder text              │   │   │
│  │  │      → 🔴 AC-2 has placeholder "[TODO: add Given clause]"      │   │   │
│  │  │ AC-RB-05: Confidential tasks require access_guards             │   │   │
│  │  │      → N/A (story, not task)                                    │   │   │
│  │  │ AC-ST-06: User options pass coherence check                      │   │   │
│  │  │      → 🟢 Title format valid, no contradictions                  │   │   │
│  │  └────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                        │   │
│  │  [Edit Node]  [Run Auto-Fix]  [Mark as Deferred]                     │   │
│  │                                                                        │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│  560px wide, z:900                                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 3.3 Bulk Fix Wizard

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │  🔧 Bulk Fix Wizard — 8 Errors Selected                      [✕]        │   │
│  ├────────────────────────────────────────────────────────────────────────┤   │
│  │                                                                        │   │
│  │  Step 1: Review Errors                                                   │   │
│  │  ┌────────────────────────────────────────────────────────────────┐   │   │
│  │  │ [✓] US-AUTH-001: Missing AC (3 errors)                        │   │   │
│  │  │ [✓] TASK-PAY-BE-003: Missing Access Guards (1 error)           │   │   │
│  │  │ [✓] UC-BOOK-001: Incomplete Flow (2 errors)                    │   │   │
│  │  │ [✓] ACT-ADMIN-001: Missing RBAC Link (1 error)               │   │   │
│  │  │ [✓] US-PROF-001: No Dependencies (1 warning → error)           │   │   │
│  │  │                                                                │   │   │
│  │  │ [Deselect All] [Select All]                                     │   │   │
│  │  └────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                        │   │
│  │  Step 2: Choose Fix Strategy                                             │   │
│  │  ┌────────────────────────────────────────────────────────────────┐   │   │
│  │  │ (●) AI Auto-Fix — system generates fixes, review required     │   │   │
│  │  │ (○) Template Fill — apply standard templates to missing fields │   │   │
│  │  │ (○) Manual Edit — open each node in editor sequentially       │   │   │
│  │  │ (○) Defer All — mark all as deferred with batch rationale     │   │   │
│  │  └────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                        │   │
│  │  Step 3: Preview Fixes                                                   │   │
│  │  ┌────────────────────────────────────────────────────────────────┐   │   │
│  │  │ US-AUTH-001:                                                    │   │   │
│  │  │   + AC-4 added: "Given a locked account, When..."               │   │   │
│  │  │   + Technical notes expanded with error handling               │   │   │
│  │  │                                                                │   │   │
│  │  │ TASK-PAY-BE-003:                                                │   │   │
│  │  │   + Access guards added: PCI-DSS validation, token encryption  │   │   │
│  │  │                                                                │   │   │
│  │  │ [← Previous] [Apply All Fixes →]                                │   │   │
│  │  └────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                        │   │
│  │  Step 4: Impact & Confirm                                                │   │
│  │  ┌────────────────────────────────────────────────────────────────┐   │   │
│  │  │ Applying fixes will affect:                                     │   │   │
│  │  │ • 8 nodes updated                                               │   │   │
│  │  │ • 3 new tasks generated (from new ACs)                          │   │   │
│  │  │ • 2 test files need updates                                     │   │   │
│  │  │ • Estimated regen time: 6 minutes                               │   │   │
│  │  │                                                                │   │   │
│  │  │ [Cancel] [Confirm and Apply]                                      │   │   │
│  │  └────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                        │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│  640px wide, z:1000, multi-step form modal                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Node CRUD Context Flows

### 4.1 Add Node Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  Trigger: Chat "/add node" OR Blueprint Graph right-click "Add Node"         │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │  ➕ Add New Node                                              [✕]        │   │
│  ├────────────────────────────────────────────────────────────────────────┤   │
│  │                                                                        │   │
│  │  Node Type                                                               │   │
│  │  [○] Actor  [○] Capability  [○] Use Case  [○] User Story  [○] Task     │   │
│  │  [○] Custom Annotation                                                   │   │
│  │                                                                        │   │
│  │  Parent Node (auto-detected from context)                                │   │
│  │  [Capability: Appointment Booking (CAP-BOOK-001) ▼]                     │   │
│  │                                                                        │   │
│  │  [Continue to Editor →]                                                  │   │
│  │                                                                        │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  → Opens Node Editor (empty) with parent pre-linked                         │
│  → On Save: UserOptionValidator runs coherence check                        │
│  → If invalid: Inline error, "Fix" or "Override validation"                   │
│  → If valid: Emits NODE_MANIPULATION(add) → Impact Report → Propagation    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Delete / Deactivate Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  Trigger: Node Editor "Delete" button OR Blueprint Graph "Remove"            │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │  ⚠️ Delete Node: TASK-AUTH-BE-001                             [✕]        │   │
│  ├────────────────────────────────────────────────────────────────────────┤   │
│  │                                                                        │   │
│  │  This node has 4 downstream dependencies:                                │   │
│  │  • TEST-AUTH-001 (test file)                                          │   │
│  │  • auth.routes.ts (generated file)                                    │   │
│  │  • US-AUTH-001 (parent story) — will orphan this task                  │   │
│  │                                                                        │   │
│  │  Choose action:                                                          │   │
│  │  (●) Delete — permanently remove node and all downstream files        │   │
│  │  (○) Deactivate — keep node but mark inactive (preserves history)      │   │
│  │  (○) Replace — delete this, create new node to replace it             │   │
│  │                                                                        │   │
│  │  [Cancel]  [Confirm Delete] ← #EF4444, requires typed confirmation    │   │
│  │                                                                        │   │
│  │  Type "DELETE TASK-AUTH-BE-001" to confirm: [________________]        │   │
│  │                                                                        │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  → On Confirm: Emits NODE_MANIPULATION(remove) → Impact Report              │
│  → Downstream nodes marked ORPHANED or auto-relinked if Replace selected   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Restore / Revert Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  Trigger: Audit Panel "Revert" OR Command Palette "/revert"                 │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │  ↩️ Revert to Previous Version                                [✕]        │   │
│  ├────────────────────────────────────────────────────────────────────────┤   │
│  │                                                                        │   │
│  │  Current: DEC-045 (React + Node.js, selected 2h ago)                     │   │
│  │  Revert to: DEC-042 (Next.js + Prisma, selected 3h ago)               │   │
│  │                                                                        │   │
│  │  Diff Preview:                                                           │   │
│  │  ┌────────────────────┐  ┌────────────────────┐                          │   │
│  │  │ BEFORE (Current)   │  │ AFTER (Revert)     │                          │   │
│  │  │ framework: React   │  │ framework: Next.js │                          │   │
│  │  │ database: PostgreSQL│  │ database: Prisma   │                          │   │
│  │  │ hosting: AWS EC2   │  │ hosting: Vercel    │                          │   │
│  │  └────────────────────┘  └────────────────────┘                          │   │
│  │                                                                        │   │
│  │  Impact: 47 nodes affected, 12 files to regenerate, ~8 min               │   │
│  │                                                                        │   │
│  │  [Cancel]  [Confirm Revert] ← requires typed "REVERT DEC-042"          │   │
│  │                                                                        │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  → On Confirm: Emits REVISION_REQUEST → Impact Report → Propagation       │
│  → New DecisionEntry created: DEC-046 (REVERT action)                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Updated Inter-Screen Navigation Matrix (Additions)

| Source | Action | Target | Event | Notes |
|--------|--------|--------|-------|-------|
| Blueprint Graph | Right-click → "Add Node" | Add Node Modal | `NODE_MANIPULATION(add)` | Pre-selects type |
| Blueprint Graph | Right-click → "Edit" | Node Editor | `NODE_MANIPULATION(edit)` | Contextual form |
| Blueprint Graph | Right-click → "Remove" | Delete/Deactivate Modal | `NODE_MANIPULATION(remove)` | Shows impact |
| Blueprint Graph | Right-click → "Enrich" | Enrichment Panel | `ENRICH_NODE` | AI suggestions |
| Blueprint Graph | Click node | Node Validation Inspector | `VALIDATE_NODE` | Inline panel |
| File Explorer | Right-click → "Steer" | Node Editor | `CODE_FILE_STEER` | File-level edit |
| Steering Panel | Detail mode → "Edit" | Node Editor | `NODE_MANIPULATION(edit)` | Full form |
| Steering Panel | "Save & Enrich" | Enrichment Panel | `ENRICH_NODE` | Post-save |
| Audit Panel | "Initiate Revision" | Node Editor | `REVISION_REQUEST` | With historical context |
| Audit Panel | "Revert" | Revert Modal | `REVISION_REQUEST` | Diff preview |
| Completeness Gate | Click error | Node Editor | `NODE_MANIPULATION(edit)` | Jump to field |
| Completeness Gate | "Quick Fix" | Inline fix OR Node Editor | `AUTO_FIX` | AI-generated |
| Completeness Gate | "Run Auto-Fix All" | Bulk Fix Wizard | `BULK_FIX` | Multi-step |
| Enrichment Panel | "Apply" | Impact Report | `ENRICH_NODE` + impact | If downstream effect |
| Node Editor | "Save & Enrich" | Enrichment Panel | `ENRICH_NODE` | Post-save flow |
| Node Editor | "Delete" | Delete Modal | `NODE_MANIPULATION(remove)` | Impact warning |
| Node Editor | "View RBAC Matrix" | Audit Panel (RBAC tab) | Navigation | Filtered view |
| Node Editor | "View Decision Ledger" | Audit Panel (Ledger tab) | Navigation | Filtered view |
| Validation Inspector | "Edit Node" | Node Editor | `NODE_MANIPULATION(edit)` | Full form |
| Validation Inspector | "Run Auto-Fix" | Enrichment Panel | `AUTO_FIX` | AI suggestions |
| Bulk Fix Wizard | "Confirm" | Impact Report | `BULK_FIX` | Batch impact |
| Command Palette | "/add" | Add Node Modal | `NODE_MANIPULATION(add)` | Type selection |
| Command Palette | "/revert" | Revert Modal | `REVISION_REQUEST` | Last decision |

---

## 6. Validation Rule Summary by Node Type

| Node Type | Required Fields | Format Rules | PRD AC |
|-----------|----------------|------------|--------|
| **Actor** | name, type, description | Unique name, valid type enum | AC-RI-01 |
| **Capability** | name, description, priority | In/Out of scope explicit | AC-ST-06 |
| **Use Case** | name, description, primary_actor, preconditions, main_flow, postconditions | Flow min 3 steps, pre/post min 1 each | AC-NF-04 |
| **User Story** | title, acceptance_criteria, story_points, priority | Title format: "As a... I want... so that...", AC min 1 with Given/When/Then | AC-CG-01, AC-NF-04, AC-ST-06 |
| **Task** | name, preconditions, postconditions, file_paths, complexity | Access guards if confidential data, pre/post min 1 each | AC-RB-05, AC-NF-04 |
| **RBAC Role** | name, permissions, rationale | Non-empty rationale per permission | AC-RB-02 |
| **Tech Stack** | framework, database, hosting | Valid enum values | AC-TS-03 |
| **Infrastructure** | hosting_option, scale_persona | Cost range with basis/assumptions | AC-SC-03 |

---

I'll do a systematic gap analysis against the PRD v3.1 and UI/UX Specification, then create the missing screens.

---

# Gap Analysis Report — Screen Inventory vs. PRD & UI/UX Spec

## 1. Gap Summary Matrix

| # | Missing Screen | PRD Ref | UI/UX Spec Ref | Severity | Status |
|---|---------------|---------|----------------|----------|--------|
| 1 | **Persona Selection / Login** | §8.1 Multi-Auth | §2.4 Persona Comparison | 🔴 Critical | Missing |
| 2 | **RBAC Matrix Editor** | §4.3 RBACAdvisor, AC-RB-01..09 | §2.3.4, §5.3.4 | 🔴 Critical | Missing |
| 3 | **Hosting Options Matrix** | §17.2 AC-SC-02..03 | §4.3.3 Scale Dialogue | 🔴 Critical | Missing |
| 4 | **Tech Stack Options Matrix** | §17.3 AC-TS-01..04 | §4.3 (implied) | 🔴 Critical | Missing |
| 5 | **3-Way Merge Conflict** | §10.2 Code Gen Failure | §6.4.5 | 🔴 Critical | Missing |
| 6 | **Project Dashboard / Session List** | §8.2 Session Mgmt | §3.1.1 Toolbar | 🟡 High | Missing |
| 7 | **What-If Analysis Mode (Full)** | §2.2.4 | §5.8.4 | 🟡 High | Partial |
| 8 | **Revision Budget / Branching Manager** | §2.2.4, AC-DL-04 | §5.2.6, §6.5.2 | 🟡 High | Partial |
| 9 | **Context Agent / "Why" Explorer** | §4.6 Chat Module | §5.1.3, FR-IDE-04 | 🟡 High | Missing |
| 10 | **Legacy Codebase Ingestion** | §4.1 LegacyIngestor, AC-LG-01 | §4.1.2 ZIP/Git | 🟡 High | Missing |
| 11 | **Deployment Pipeline (Stage 10)** | §4.9 DeploymentBridge | §6.3.3 | 🟡 High | Missing |
| 12 | **Global Search / Find Anything** | §4.6 ContextAgent | §5.9.3, §9.1.1 | 🟡 High | Missing |
| 13 | **Notification Center** | §18.5 NF-NT-01..03 | §6.1.3 Toast System | 🟡 High | Missing |
| 14 | **Checkpoint Timeline (Full)** | §2.2.4, AC-NF-05..06 | §5.2.6, §6.4 | 🟡 High | Partial |
| 15 | **Export Configuration** | §6.2 REST API | §2.3.4 Export | 🟡 High | Missing |
| 16 | **LLM Failure Recovery Modal** | §10.1 LLM-E01..04 | §6.4.1..6.4.4 | 🟡 High | Partial |
| 17 | **Collaboration / Conflict Resolution** | §10.1.3 | §10.1 Real-Time | 🟡 High | Missing |
| 18 | **Unsupported Device Modal** | — | §3.3.4 | 🟢 Medium | Missing |
| 19 | **Keyboard Shortcut Cheat Sheet** | FR-IDE-19 | §9.1.1 | 🟢 Medium | Missing |
| 20 | **Glossary / Help Panel** | §23 Glossary | §9.4.3 | 🟢 Medium | Missing |
| 21 | **Session Timeout / Recovery** | §18.4 NF-SM-01..03 | §9.4.4 | 🟢 Medium | Missing |
| 22 | **Cost Calculator / Budget View** | §17.2 AC-SC-03 | §10.2.3 | 🟢 Medium | Missing |
| 23 | **Theme Preview / Accessibility** | — | §7.1.5, §9.3 | 🟢 Medium | Missing |
| 24 | **Infrastructure Profile Re-run** | §17.2 AC-SC-08 | §6.5.1 | 🟢 Medium | Missing |

---

Now I'll create the **Critical and High severity missing screens**:

---

# Missing Screen Wireframes — Gap Closure

## 1. Persona Selection & Authentication

### 1.1 Login / Persona Selection
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                    ┌──────────────────────────────────────┐                 │
│                    │         [Logo 48px]                    │                 │
│                    │   Collaborative Steering Pipeline    │                 │
│                    │                                      │                 │
│                    │  ┌────────────────────────────────┐   │                 │
│                    │  │ Who's building today?          │   │                 │
│                    │  │ (24px/600 Ink)                 │   │                 │
│                    │  └────────────────────────────────┘   │                 │
│                    │                                      │                 │
│                    │  [👤] Citizen Developer / Founder    │   │                 │
│                    │      "I have an idea, no code needed"  │   │                 │
│                    │      bg:#F8FAFC, border:1px Silver     │   │                 │
│                    │      hover→border:Frontend #2563EB     │   │                 │
│                    │                                      │                 │
│                    │  [🔧] Developer / Architect          │   │                 │
│                    │      "I want full control and raw JSON" │   │                 │
│                    │                                      │   │                 │
│                    │  [🛡️] Security Engineer               │   │                 │
│                    │      "I need to audit and verify RBAC" │   │                 │
│                    │                                      │                 │
│                    │  ┌────────────────────────────────┐   │                 │
│                    │  │ Authentication Method            │   │                 │
│                    │  │                                  │   │                 │
│                    │  │ [Password]  [🔐 Fingerprint]    │   │                 │
│                    │  │ [🎙️ Voice]  [🔑 SSO / GitHub]    │   │                 │
│                    │  │                                  │   │                 │
│                    │  │ Email: [                      ]  │   │                 │
│                    │  │ Password: [                  ]   │   │                 │
│                    │  │                                  │   │                 │
│                    │  │ [Continue]                       │   │                 │
│                    │  │                                  │   │                 │
│                    │  │ [Continue as Guest — Limited]    │   │                 │
│                    │  └────────────────────────────────┘   │                 │
│                    │                                      │                 │
│                    │  Trust Mode Default: PARANOID        │   │                 │
│                    │  (Changeable after login)            │   │                 │
│                    │                                      │                 │
│                    └──────────────────────────────────────┘                 │
│                    480px wide, centered, z:1000                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Intra-Screen Actions:**
| Element | Trigger | Action | Visual Feedback |
|---------|---------|--------|-----------------|
| Persona Card | Hover | Border→Frontend, shadow appears | 150ms |
| Persona Card | Click | Selected: 2px border Frontend, bg tint | 150ms |
| Auth Method | Click | Active method highlighted, others muted | 150ms |
| Fingerprint | Click | Triggers WebAuthn API, shows scanner animation | Spinner |
| Voice | Click | Triggers voice enrollment (ProtoBox integration) | Waveform viz |
| Continue | Click | Validates → Dashboard or Onboarding | Loading spinner |
| Guest | Click | Limited session, no persistence, PARANOID only | Warning toast |

**Inter-Screen Navigation:**
| From | Trigger | To | Condition |
|------|---------|-----|-----------|
| Login | Valid auth + Citizen Dev | Landing (Empty State) | First session |
| Login | Valid auth + Architect | Dashboard (Project List) | Existing projects |
| Login | Valid auth + Security | Audit Dashboard | Security-focused landing |

---

## 2. RBAC Matrix Editor

### 2.1 RBAC Matrix (Full Screen)
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ RBAC Matrix Editor                    [Export JSON] [Validate] [Commit]     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Role Inheritance Graph (collapsible top panel)                         │ │
│  │                                                                      │ │
│  │  Admin ──▶ Manager ──▶ Employee ──▶ Guest                             │ │
│  │     │         │           │                                          │ │
│  │     └─────────┴───────────┘                                          │ │
│  │  [🔴 Cycle detected: Admin → Manager → Admin] ← BLOCKS COMMIT      │ │
│  │  Depth: 3 (limit: 3)                                               │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  Permission Matrix                                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Role          │ Resource        │ Action   │ Granted │ Rationale     │ Decision Maker│ │
│  │ ───────────────────────────────────────────────────────────────────────│ │
│  │ patient       │ /api/appointments│ GET      │ ✓       │ Own data only │ system        │ │
│  │ patient       │ /api/appointments│ POST     │ ✓       │ Book for self │ system        │ │
│  │ patient       │ /api/appointments│ DELETE   │ ✗       │ N/A           │ N/A           │ │
│  │ dentist       │ /api/appointments│ GET      │ ✓       │ All patients  │ architect     │ │
│  │ dentist       │ /api/appointments│ PUT      │ ✓       │ Reschedule    │ architect     │ │
│  │ admin         │ /api/salaries    │ GET      │ ✓       │ Full access   │ admin         │ │
│  │               │                 │          │         │               │               │ │
│  │ [🔴 PRIVILEGE ESCALATION]                                              │ │
│  │ admin inherits Manager → inherits Employee → gains /api/salaries via    │ │
│  │ transitive chain. Depth: 3. Path: Admin→Manager→Employee→/api/salaries│ │
│  │ [View Path] [Remove Inheritance] [Add Guard]                           │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  Data Access Matrix                                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Role          │ Entity          │ Access   │ Rationale     │ Guard       │ │
│  │ ───────────────────────────────────────────────────────────────────────│ │
│  │ patient       │ User            │ Own      │ GDPR req      │ user_id match│ │
│  │ dentist       │ Appointment     │ All      │ Provider role │ practice_id │ │
│  │ receptionist  │ Payment         │ None     │ PCI-DSS limit │ blocked     │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  [Add Role] [Add Resource] [Add Permission] [Run Escalation Check]         │
│                                                                             │
│  Validation Status: [🔴] 1 cycle, [🔴] 1 escalation, [🟢] 12 valid        │
│  Commit blocked until resolved.                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Intra-Screen Actions:**
| Element | Trigger | Action | Visual Feedback |
|---------|---------|--------|-----------------|
| Matrix Cell | Click | Inline edit: dropdown or checkbox | Inline input |
| Granted Toggle | Click | ✓/✗ toggle, requires rationale if ✓ | Checkbox animation |
| Rationale Cell | Click | Inline textarea, min 20 chars | Border→Frontend |
| Inheritance Graph | Click node | Selects role, highlights matrix rows | Row highlight |
| Escalation Flag | Click | Expands path trace, red border | 150ms expand |
| "Remove Inheritance" | Click | Breaks link, re-runs validation | Graph updates |
| "Add Guard" | Click | Opens guard editor modal | Modal overlay |
| "Run Escalation Check" | Click | DFS analysis, highlights all paths | Spinner→results |
| Commit Button | Click (blocked) | Shake + "Resolve 1 cycle, 1 escalation" | Shake animation |

**Inter-Screen Navigation:**
| From | Trigger | To | Condition |
|------|---------|-----|-----------|
| RBAC Matrix | Click "View Path" | Blueprint Graph (filtered) | Role node focused |
| RBAC Matrix | Click "View in Audit" | Audit Panel (RBAC events) | Filtered trail |
| RBAC Matrix | Valid commit | Stage 4+ (pipeline resumes) | `RBAC_STEERING_ACTION` |
| RBAC Matrix | Click "Export JSON" | Browser download | `RBACModel` JSON |

---

## 3. Hosting Options Matrix

### 3.1 Hosting Options
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Hosting Options Matrix                [Back to Scale] [Confirm Selection]   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Scale Persona: MEDIUM (1,000–10,000 users, 500 concurrent, $500/mo)       │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │  [Re-run Advisor] ← if INFRASTRUCTURE_PROFILE_STALE                   │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ Option A: AWS ECS + RDS (Recommended)                                │   │
│  │ ┌────────────────────────────────────────────────────────────────┐   │   │
│  │ │ [🟢] Best fit for your scale persona                            │   │   │
│  │ │                                                                  │   │   │
│  │ │ Architecture: Containerized microservices on AWS ECS              │   │   │
│  │ │ Database: PostgreSQL on RDS Multi-AZ                              │   │   │
│  │ │ Cache: ElastiCache Redis                                          │   │   │
│  │ │ CDN: CloudFront                                                   │   │   │
│  │ │                                                                  │   │   │
│  │ │ Estimated Monthly Cost:                                           │   │   │
│  │ │ Low: $420    Mid: $580    High: $840                               │   │   │
│  │ │ [Indicative only — basis: on-demand pricing, US-East-1]         │   │   │
│  │ │ Assumptions: 500 concurrent, 2 vCPU per container, 4GB RAM        │   │   │
│  │ │ Excludes: Data transfer out, DDoS protection, premium support    │   │   │
│  │ │                                                                  │   │   │
│  │ │ [🟢] Within budget ($500)    [🟢] Auto-scaling enabled           │   │   │
│  │ │                                                                  │   │   │
│  │ │ [Select This Option] [Bookmark ☆] [Modify Parameters]               │   │   │
│  │ └────────────────────────────────────────────────────────────────┘   │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ Option B: Vercel + Neon (Serverless)    [🟡 Over budget: $620 mid]   │   │
│  │ ┌────────────────────────────────────────────────────────────────┐   │   │
│  │ │ Architecture: Next.js on Vercel, Neon serverless Postgres       │   │   │
│  │ │ Cost: Low: $300    Mid: $620    High: $1,200                    │   │   │
│  │ │ [🔴] Mid exceeds stated budget by $120                             │   │   │
│  │ │ [Select Anyway] [Bookmark ☆]                                      │   │   │
│  │ └────────────────────────────────────────────────────────────────┘   │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ Option C: Self-Managed VPS (Budget)                                  │   │
│  │ Cost: Low: $80    Mid: $150    High: $300                            │   │
│  │ [🟡] Manual scaling — requires DevOps expertise                     │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Comparison: [Option A ▼] vs [Option B ▼] → Side-by-side diff view         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Tech Stack Options Matrix

### 4.1 Tech Stack Selection
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Tech Stack Options                    [Back] [Confirm Selection]            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Detected Signals: "real-time", "SaaS", "rapid MVP"                          │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ Option A: Next.js + Prisma + PostgreSQL (Recommended)                │   │
│  │ ┌────────────────────────────────────────────────────────────────┐   │   │
│  │ │ [🟢] Best actor compatibility (Patient: 95%, Dentist: 90%)      │   │   │
│  │ │ [🟢] Scale fit: MEDIUM to LARGE                                  │   │   │
│  │ │ [🟢] Learning curve: Moderate (React knowledge assumed)         │   │   │
│  │ │                                                                  │   │   │
│  │ │ Rationale: Full-stack framework reduces API boilerplate.         │   │   │
│  │ │ Prisma provides type-safe DB access. PostgreSQL handles         │   │   │
│  │ │ complex queries and JSON fields for flexible schemas.            │   │   │
│  │ │                                                                  │   │   │
│  │ │ Components:                                                       │   │   │
│  │ │ Frontend: Next.js 14 (App Router)                                  │   │   │
│  │ │ Backend: API Routes + Server Actions                               │   │   │
│  │ │ Database: PostgreSQL 15 + Prisma ORM                               │   │   │
│  │ │ Cache: Redis (Upstash)                                             │   │   │
│  │ │ Auth: NextAuth.js + JWT                                            │   │   │
│  │ │ Hosting: Vercel (frontend) + Railway (DB)                          │   │   │
│  │ │                                                                  │   │   │
│  │ │ [Select] [Bookmark ☆] [Customize]                                   │   │   │
│  │ └────────────────────────────────────────────────────────────────┘   │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ Option B: FastAPI + React + PostgreSQL                                 │   │
│  │ [🟡] Higher learning curve (Python + React split)                    │   │
│  │ [🟢] Better for ML/data-heavy features (future-proof)                │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  [Compare Options] → Bookmark Comparison Drawer (existing)                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. 3-Way Merge Conflict Resolution

### 5.1 Merge Conflict Modal (Full Screen)
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │  🔀 Merge Conflict: auth.routes.ts                          [✕]        │   │
│  │  Blueprint revision triggered regeneration. User edits detected.       │   │
│  ├────────────────────────────────────────────────────────────────────────┤   │
│  │                                                                        │   │
│  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐         │   │
│  │  │ BASE (Original) │ │ OURS (Your Edits)│ │ THEIRS (New Gen)│         │   │
│  │  │ Checkpoint-003  │ │ 15:45:22        │ │ 16:02:18        │         │   │
│  │  ├─────────────────┤ ├─────────────────┤ ├─────────────────┤         │   │
│  │  │ import ...      │ │ import ...      │ │ import ...      │         │   │
│  │  │                 │ │ + import { z }  │ │ + import { z }  │         │   │
│  │  │ function login()│ │ function login()│ │ function login()│         │   │
│  │  │ {               │ │ {               │ │ {               │         │   │
│  │  │   // basic auth │ │   // basic auth │ │   // basic auth │         │   │
│  │  │   return jwt;   │ │   return jwt;   │ │   return jwt;   │         │   │
│  │  │ }               │ │ }               │ │ }               │         │   │
│  │  │                 │ │ + // Added Zod  │ │ + // Added Zod  │         │   │
│  │  │                 │ │ + validation    │ │ + validation    │         │   │
│  │  │                 │ │ + const schema =│ │ + const schema =│         │   │
│  │  │                 │ │ +   z.object({  │ │ +   z.object({  │         │   │
│  │  │                 │ │ +     email:... │ │ +     email:... │         │   │
│  │  │                 │ │ +   });         │ │ +   });         │         │   │
│  │  │                 │ │                 │ │                 │         │   │
│  │  │ [✓ Accept]      │ │ [✓ Accept]      │ │ [✓ Accept]      │         │   │
│  │  └─────────────────┘ └─────────────────┘ └─────────────────┘         │   │
│  │                                                                        │   │
│  │  OUTPUT (Editable) — 1 of 3 conflicts resolved                         │   │
│  │  ┌────────────────────────────────────────────────────────────────┐   │   │
│  │  │ import { z } from 'zod';                                       │   │   │
│  │  │                                                                │   │   │
│  │  │ function login(req, res) {                                     │   │   │
│  │  │   // basic auth                                                │   │   │
│  │  │   <<<<<<< OURS                                                 │   │   │
│  │  │   // Added Zod validation with custom error messages           │   │   │
│  │  │   const schema = z.object({                                    │   │   │
│  │  │     email: z.string().email("Invalid email format"),           │   │   │
│  │  │   =======                                                      │   │   │
│  │  │   // Added Zod validation with standard errors                 │   │   │
│  │  │   const schema = z.object({                                    │   │   │
│  │  │     email: z.string().email(),                                 │   │   │
│  │  │   >>>>>>> THEIRS                                               │   │   │
│  │  │   });                                                          │   │   │
│  │  │   return jwt;                                                  │   │   │
│  │  │ }                                                              │   │   │
│  │  │                                                                │   │   │
│  │  │ [◄ Previous Conflict] [Next Conflict ►] (2 remaining)         │   │   │
│  │  └────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                        │   │
│  │  [Accept Merge] [Cancel & Keep Current] [Restore Pre-Stage-8 Checkpoint]│   │
│  │                                                                        │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│  95vw x 95vh, z:1000, Monaco diff in each panel                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Project Dashboard

### 6.1 Dashboard / Project List
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Logo]  Dashboard                    [New Project] [🔔] [⚙] [👤 Profile]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Recent Sessions                                                            │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ Dental SaaS MVP                    Stage 8: Code Generation          │   │
│  │ Last active: 2 hours ago           [🟢] 94% complete               │   │
│  │ [Resume Session] [Export] [Archive]                                  │   │
│  │                                                                        │   │
│  │ E-Commerce Platform                Stage 3: Capability Definition    │   │
│  │ Last active: 1 day ago             [🟡] 45% complete, 2 errors      │   │
│  │ [Resume Session] [Export] [Archive]                                  │   │
│  │                                                                        │   │
│  │ Legacy Migration: CRM              Stage 0: Legacy Ingestion         │   │
│  │ Last active: 3 days ago           [🔴] Stale — inputs changed       │   │
│  │ [Resume Session] [Re-run Advisor] [Archive]                          │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Quick Start                                                                │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ [🆕 New Project]  [📄 Upload PRD]  [📦 Import Legacy Codebase]       │   │
│  │ [🗂️ From Template]  [🔁 Clone Existing]                              │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Checkpoints & Recovery                                                     │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ Dental SaaS MVP — 5 checkpoints available                            │   │
│  │ [View Timeline] [Restore from Checkpoint]                            │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. What-If Analysis Mode (Full Screen)

### 7.1 What-If Sandbox
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Blueprint Graph — What-If Mode        [Exit What-If] [Reset] [Commit]     │
│ [Drag nodes to simulate changes. Ghost overlay shows impact.]               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                    [⬡] Patient (Actor)                                    │
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
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  Impact Simulation Overlay                                             │ │
│  │  ┌────────────────────────────────────────────────────────────────┐   │ │
│  │  │ Node: CAP-BOOK-001 → Priority: nice_to_have                   │   │ │
│  │  │                                                                  │   │ │
│  │  │ Affected downstream: 12 nodes                                    │   │ │
│  │  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│   │ │
│  │  │ 🟢 Success (no impact):  3 nodes  │ Frontend layer              │   │ │
│  │  │ 🟡 Warning (moderate):   7 nodes  │ Backend, Database layers     │   │ │
│  │  │ 🔴 Error (breaking):    2 nodes  │ Auth layer (cascade failure)│   │ │
│  │  │                                                                  │   │ │
│  │  │ Files to regenerate: 4                                           │   │ │
│  │  │ Est. regeneration time: ~6 minutes                                │   │ │
│  │  │                                                                  │   │ │
│  │  │ [🟡] Auth layer impact: Booking capability removal breaks        │   │ │
│  │  │      patient authentication flow for appointment scheduling.      │   │ │
│  │  │      Recommend: Keep as "Must Have" or add alternative auth.      │   │ │
│  │  │                                                                  │   │ │
│  │  │ [Recalculate] [Commit Change] [Discard]                          │   │ │
│  │  └────────────────────────────────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  Legend: ── dependency  - - traceability  ·· provenance  ~~ what-if        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Revision Budget & Branching Manager

### 8.1 Revision Manager
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Revision & Branching Manager          [New Branch] [Compare] [Commit]       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Active Branch: main (DEC-042..DEC-045)                                     │
│  Revision Budget: 3 / 5 remaining  [███████░░░]                            │
│  [🟡 Warning: Budget low. Use What-If mode to explore without cost.]      │
│                                                                             │
│  Branch Timeline                                                            │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ main                                                                 │   │
│  │ ├── DEC-042: Selected Next.js + Prisma (Stage 3)                     │   │
│  │ ├── DEC-043: Added InsuranceVerifier actor (Stage 2)                 │   │
│  │ ├── DEC-044: Chose AWS ECS hosting (Stage 1)                         │   │
│  │ └── DEC-045: React → Next.js (Stage 3) ← CURRENT                   │   │
│  │                                                                      │   │
│  │ Branches:                                                            │   │
│  │ ┌────────────────────────────────────────────────────────────────┐   │   │
│  │ │ branch-1: "PostgreSQL vs DynamoDB"                               │   │   │
│  │ │ Created: 1h ago  │ Nodes: 47  │ Status: Open  │ [Switch] [Merge] [Delete]│   │   │
│  │ │                                                                  │   │   │
│  │ │ Changes:                                                         │   │   │
│  │ │ - database: "PostgreSQL" → "DynamoDB"                            │   │   │
│  │ │ - Impact: 12 tasks affected, 3 files to regen                    │   │   │
│  │ │                                                                  │   │   │
│  │ │ [🟢] No conflicts with main                                      │   │   │
│  │ └────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  │ ┌────────────────────────────────────────────────────────────────┐   │   │
│  │ │ branch-2: "Add Stripe Payments"                                  │   │   │
│  │ │ Created: 30min ago │ Nodes: 8   │ Status: Open  │ [Switch] [Merge] [Delete]│   │   │
│  │ │                                                                  │   │   │
│  │ │ Changes:                                                         │   │   │
│  │ │ - New capability: CAP-PAY-001 (Payment Processing)               │   │   │
│  │ │ - New actor: PaymentGateway (external)                           │   │   │
│  │ │ - Impact: 8 new tasks, 0 conflicts                               │   │   │
│  │ │                                                                  │   │   │
│  │ │ [🟢] Clean addition, no conflicts                                │   │   │
│  │ └────────────────────────────────────────────────────────────────┘   │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  [🟡] Budget Exhausted Modal Trigger: At 0/5, show override request        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Context Agent / "Why" Explorer

### 9.1 Why Panel (Slide-out)
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  (Main content visible)                                                       │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────┐ ← slides from  │
│  │  ❓ Why: PostgreSQL?                           [✕]     │   right, 400px │
│  ├─────────────────────────────────────────────────────────┤                │
│  │                                                         │                │
│  │  Question: "Why did you pick PostgreSQL over DynamoDB?"   │                │
│  │                                                         │                │
│  │  Answer (from ContextAgent):                            │                │
│  │  ┌────────────────────────────────────────────────────┐ │                │
│  │  │ PostgreSQL was selected at Stage 3 (DEC-042)      │ │                │
│  │  │ because:                                            │ │                │
│  │  │                                                     │ │                │
│  │  │ 1. Scale fit: Your MEDIUM persona (1,000-10,000   │ │                │
│  │  │    users) benefits from ACID transactions and       │ │                │
│  │  │    complex relational queries (appointment          │ │                │
│  │  │    scheduling with dentist availability).          │ │                │
│  │  │                                                     │ │                │
│  │  │ 2. Actor compatibility: Dentist role requires        │ │                │
│  │  │    reporting queries (patient history, revenue)   │ │                │
│  │  │    that are inefficient in NoSQL.                  │ │                │
│  │  │                                                     │ │                │
│  │  │ 3. Cost: At your $500/mo budget, RDS db.t3.medium │ │                │
│  │  │    ($45/mo) is cheaper than DynamoDB on-demand    │ │                │
│  │  │    at 500 concurrent users ($78/mo).                │ │                │
│  │  │                                                     │ │                │
│  │  │ 4. Team skill: TechStackProfile detected no        │ │                │
│  │  │    NoSQL expertise in your team signals.            │ │                │
│  │  │                                                     │ │                │
│  │  │ Source: Decision Ledger DEC-042, TechStackAdvisor   │ │                │
│  │  │ rationale, ScaleInfraAdvisor cost matrix.           │ │                │
│  │  │                                                     │ │                │
│  │  │ [View DEC-042 in Audit] [View Cost Matrix]          │ │                │
│  │  │ [Change this decision →]                            │ │                │
│  │  └────────────────────────────────────────────────────┘ │                │
│  │                                                         │                │
│  │  Related Questions:                                     │                │
│  │  • "Why Next.js and not Express?"                       │                │
│  │  • "Why is InsuranceVerifier an actor?"                 │                │
│  │  • "What if I switch to DynamoDB?" → What-If mode      │                │
│  │                                                         │                │
│  └─────────────────────────────────────────────────────────┘                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Legacy Codebase Ingestion

### 10.1 Legacy Ingestion Screen
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Legacy Codebase Ingestion             [Cancel] [Analyze]                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Input Method                                                               │
│  [📦 Upload ZIP]  [🔗 Git URL]  [📁 Connect Repo]                          │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ Git URL: [https://github.com/acme/legacy-crm       ] [Connect]       │   │
│  │                                                                        │   │
│  │ Repository Metadata (fetched):                                         │   │
│  │ • Language: Java (Spring Boot)                                         │   │
│  │ • Last commit: 2024-03-15                                              │   │
│  │ • Stars: 12  │  Forks: 3                                               │   │
│  │ • Detected frameworks: Spring Boot, Hibernate, MySQL                   │   │
│  │                                                                        │   │
│  │ [🟢] Repository accessible. Ready to analyze.                          │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Analysis Progress (after Connect)                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ [████████████░░░░░░] 65%                                               │   │
│  │ • Parsing Java AST...                                                  │   │
│  │ • Extracting entities: User, Order, Product (12 found)               │   │
│  │ • Extracting API routes: /api/users, /api/orders (24 found)          │   │
│  │ • Mapping to pipeline concepts...                                      │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Legacy Context Report (after analysis)                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ Mapped to Pipeline:                                                    │   │
│  │ • ExistingActor: "User" → ACT-USER-001 (mapped)                        │   │
│  │ • ExistingActor: "Admin" → ACT-ADMIN-001 (mapped)                      │   │
│  │ • ExistingCapability: "Order Management" → CAP-ORDER-001 (mapped)      │   │
│  │ • ExistingCapability: "Product Catalog" → CAP-PROD-001 (mapped)        │   │
│  │                                                                        │   │
│  │ New Features to Add (delta):                                           │   │
│  │ • [+] Payment Processing (not found in legacy)                       │   │
│  │ • [+] Real-time Notifications (not found in legacy)                    │   │
│  │ • [+] Analytics Dashboard (not found in legacy)                      │   │
│  │                                                                        │   │
│  │ Conflicts Detected:                                                    │   │
│  │ • [⚠️] Legacy uses MySQL, but new infra profile suggests PostgreSQL    │   │
│  │   [Keep MySQL] [Switch to PostgreSQL] [Decide Later]                    │   │
│  │                                                                        │   │
│  │ [Proceed to Stage 0 with Legacy Context]                               │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 11. Deployment Pipeline (Stage 10)

### 11.1 Deployment Configuration
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Deployment Pipeline                   [Back to Preview] [Deploy]             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Target Environment                                                           │
│  [○] Vercel (Production)  [○] AWS Amplify  [○] Netlify  [○] Kubernetes   │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ Vercel Configuration                                                   │   │
│  │ • Project Name: dental-saas-mvp                                        │   │
│  │ • Framework Preset: Next.js                                            │   │
│  │ • Environment Variables:                                               │   │
│  │   DATABASE_URL = [postgresql://...       ]                             │   │
│  │   JWT_SECRET   = [••••••••••••••         ]                             │   │
│  │   STRIPE_KEY   = [••••••••••••••         ]                             │   │
│  │                                                                        │   │
│  │ [Validate Environment] ← checks all required vars present              │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Pre-Deploy Checks                                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ [🟢] All tests passing (47/47)                                         │   │
│  │ [🟢] Build successful (0 errors, 2 warnings)                             │   │
│  │ [🟢] Security scan: no critical vulnerabilities                        │   │
│  │ [🟢] RBAC model compiled into middleware                               │   │
│  │ [🟡] Lighthouse score: 78 (target: 90) — performance                   │   │
│  │ [🔴] No privacy policy page — required for GDPR compliance             │   │
│  │      [Auto-generate from AuditPolicy] [Defer]                          │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  [Deploy to Production] ← disabled if 🔴 checks present                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 11.2 Deployment Complete
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
│  │         [Open App]  [Share]  [View Audit Trail]                        │   │
│  │                                                                      │   │
│  │         Next Steps:                                                   │   │
│  │         • [Set up custom domain]                                      │   │
│  │         • [Configure monitoring]                                      │   │
│  │         • [Invite team members]                                       │   │
│  │                                                                      │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│  480px modal, z:1000, backdrop rgba(15,23,42,0.5)                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 12. Global Search / Find Anything

### 12.1 Global Search Overlay
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │  🔍 Search anything...                                      [✕]        │   │
│  │  640px wide, 48px input, z:100                                         │   │
│  ├────────────────────────────────────────────────────────────────────────┤   │
│  │                                                                        │   │
│  │  Recent Searches                                                         │   │
│  │  • "auth layer decisions"                                              │   │
│  │  • "why postgres"                                                      │   │
│  │  • "patient actor"                                                     │   │
│  │                                                                        │   │
│  │  Results (typing "auth"):                                                │   │
│  │  ┌────────────────────────────────────────────────────────────────┐   │   │
│  │  │ DECISIONS (3)                                                   │   │   │
│  │  │ • DEC-042: Selected Next.js + Node.js (auth layer: JWT)        │   │   │
│  │  │ • DEC-045: Added access guards to TASK-AUTH-BE-001             │   │   │
│  │  │ • DEC-051: RBAC model v2 committed                             │   │   │
│  │  │                                                                  │   │   │
│  │  │ FILES (4)                                                       │   │   │
│  │  │ • auth.routes.ts (backend)                                      │   │   │
│  │  │ • auth.middleware.ts (backend)                                │   │   │
│  │  │ • rbac.config.ts (auth)                                       │   │   │
│  │  │ • useAuth.ts (frontend)                                       │   │   │
│  │  │                                                                  │   │   │
│  │  │ NODES (2)                                                       │   │   │
│  │  │ • ACT-ADMIN-001: Admin actor                                    │   │   │
│  │  │ • CAP-AUTH-001: Authentication capability                       │   │   │
│  │  │                                                                  │   │   │
│  │  │ AUDIT EVENTS (12)                                               │   │   │
│  │  │ • steering: S3, Selected auth framework (14:32:01)              │   │   │
│  │  │ • codegen: S8, Generated auth.middleware.ts (14:45:22)          │   │   │
│  │  └────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                        │   │
│  │  [View all results in Audit Panel]                                     │   │
│  │                                                                        │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 13. Notification Center

### 13.1 Notification Drawer
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  (Main content visible)                                                       │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────┐ ← slides from  │
│  │  🔔 Notifications                                [✕] [Clear All]       │   right │
│  ├─────────────────────────────────────────────────────────┤                │
│  │                                                         │                │
│  │  Unread (3)                                             │                │
│  │  ┌────────────────────────────────────────────────────┐ │                │
│  │  │ [🟢] Stage 3 complete — Capability Definition      │ │                │
│  │  │      2 minutes ago                                 │ │                │
│  │  │      [View Steering Panel]                         │ │                │
│  │  │                                                    │ │                │
│  │  │ [🟡] Infrastructure Profile Stale                    │ │                │
│  │  │      Scale inputs changed. Recommend re-running.   │ │                │
│  │  │      [Re-run Advisor]                              │ │                │
│  │  │                                                    │ │                │
│  │  │ [🔴] LLM Timeout — Stage 6 paused                   │ │                │
│  │  │      Action required: retry, modify, skip, or      │ │                │
│  │  │      restore checkpoint.                           │ │                │
│  │  │      [Resolve]                                     │ │                │
│  │  └────────────────────────────────────────────────────┘ │                │
│  │                                                         │                │
│  │  Earlier Today                                          │                │
│  │  ┌────────────────────────────────────────────────────┐ │                │
│  │  │ [🟢] File generated: Login.tsx                     │ │                │
│  │  │ [🟢] File generated: auth.routes.ts                │ │                │
│  │  │ [🟢] Runtime started: http://localhost:3000        │ │                │
│  │  └────────────────────────────────────────────────────┘ │                │
│  │                                                         │                │
│  │  [Notification Settings] ← webhook, sound, desktop     │                │
│  │                                                         │                │
│  └─────────────────────────────────────────────────────────┘                │
│  360px wide, z:900                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 14. Checkpoint Timeline (Full View)

### 14.1 Checkpoint Manager
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Checkpoint Timeline                   [Create Now] [Restore Selected]        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  ●───●───●───●───●───●───●───●───●───●                               │   │
│  │  S0   S1   S2   S3   S4   S5   S6   S7   S8   S9                     │   │
│  │  │    │    │    │    │    │    │    │    │    │                      │   │
│  │  │    │    │    │    │    │    │    │    │    │                      │   │
│  │  ▼    ▼    ▼    ▼    ▼    ▼    ▼    ▼    ▼    ▼                      │   │
│  │ [✓]  [✓]  [✓]  [✓]  [✓]  [✓]  [✓]  [✓]  [✓]  [○]                  │   │
│  │      │         │              │         │                            │   │
│  │      ●         ●              ●         ●                            │   │
│  │   checkpoint-1  checkpoint-2  checkpoint-3  checkpoint-4           │   │
│  │   (manual)      (auto)        (manual)      (auto)                   │   │
│  │                                                                      │   │
│  │  Selected: checkpoint-3 (Stage 5, manual, 24 nodes)                │   │
│  │  ┌────────────────────────────────────────────────────────────────┐   │   │
│  │  │ Created: 2024-06-19 15:45:22 by: architect                     │   │   │
│  │  │ Stage: 5 — Story Decomposition                                   │   │   │
│  │  │ Nodes: 24 committed, 0 pending, 0 deferred                       │   │   │
│  │  │ Decision Ledger: DEC-001 through DEC-028                         │   │   │
│  │  │                                                                  │   │   │
│  │  │ [Preview State] [Export Snapshot] [Restore to This Point]        │   │   │
│  │  │                                                                  │   │   │
│  │  │ ⚠️ Restoring will discard all progress after Stage 5.           │   │   │
│  │  │    Type "RESTORE CHECKPOINT-3" to confirm: [__________]         │   │   │
│  │  └────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 15. LLM Failure Recovery Modal

### 15.1 LLM Timeout Recovery
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │  ⚠️ LLM Response Timed Out                                  [✕]        │   │
│  │  Stage 6: Task Decomposition — Chunk 14 of 28                          │   │
│  ├────────────────────────────────────────────────────────────────────────┤   │
│  │                                                                        │   │
│  │  The LLM did not respond within 10 seconds. This may be due to:       │   │
│  │  • High load on the provider                                          │   │
│  │  • Complex prompt requiring more processing time                        │   │
│  │  • Network connectivity issues                                         │   │
│  │                                                                        │   │
│  │  Last successful chunk: TASK-AUTH-BE-001 (JWT middleware)              │   │
│  │  Next expected: TASK-AUTH-BE-002 (Login route)                         │   │
│  │                                                                        │   │
│  │  Choose how to proceed:                                                │   │
│  │  ┌────────────────────────────────────────────────────────────────┐   │   │
│  │  │ [🔄 Retry] — Re-execute same prompt with exponential backoff     │   │   │
│  │  │      Backoff: 2^3 = 8 seconds. Attempt 3 of 5.                  │   │   │
│  │  │                                                                  │   │   │
│  │  │ [✏️ Modify] — Edit the prompt or context and retry              │   │   │
│  │  │      Opens prompt editor with last context                       │   │   │
│  │  │                                                                  │   │   │
│  │  │ [⏭️ Skip] — Mark remaining tasks as deferred, continue to Stage 7│   │   │
│  │  │      ⚠️ 14 tasks will be marked DEFERRED. Requires rationale.   │   │   │
│  │  │                                                                  │   │   │
│  │  │ [↩️ Restore Checkpoint] — Roll back to last known good state    │   │   │
│  │  │      Last checkpoint: Stage 5 (checkpoint-2) at 15:30:00        │   │   │
│  │  └────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                        │   │
│  │  [Cancel] — Keep paused, decide later                                 │   │
│  │                                                                        │   │
│  │  🔴 Silent retry is disabled per AC-NF-02. You must choose an action. │   │
│  │                                                                        │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│  520px wide, z:1000                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 16. Collaboration / Multi-User Conflict

### 16.1 Merge Conflict (Multi-User)
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │  👥 Merge Conflict: Actor "Patient"                           [✕]        │   │
│  │  You and architect both edited this node simultaneously.                 │   │
│  ├────────────────────────────────────────────────────────────────────────┤   │
│  │                                                                        │   │
│  │  ┌─────────────────────┐  ┌─────────────────────┐                      │   │
│  │  │ YOUR VERSION (You)  │  │ THEIR VERSION       │                      │   │
│  │  │ 15:45:22            │  │ (architect) 15:47:18│                      │   │
│  │  ├─────────────────────┤  ├─────────────────────┤                      │   │
│  │  │ Goals:              │  │ Goals:              │                      │   │
│  │  │ • Book appointments │  │ • Book appointments │                      │   │
│  │  │ • View history      │  │ • View history      │                      │   │
│  │  │ • Pay invoices      │  │ • Pay invoices      │                      │   │
│  │  │ • [NEW] Video consult│  │ • [NEW] Family accounts│                   │   │
│  │  │                     │  │                     │                      │   │
│  │  │ Pain Points:        │  │ Pain Points:        │                      │   │
│  │  │ • Long wait times   │  │ • Long wait times   │                      │   │
│  │  │                     │  │ • No reminder emails│                      │   │
│  │  └─────────────────────┘  └─────────────────────┘                      │   │
│  │                                                                        │   │
│  │  [Accept Mine]  [Accept Theirs]  [Merge Both]  [Cancel]                │   │
│  │                                                                        │   │
│  │  [🟡] Conflict badge persists on Actor node until resolved            │   │
│  │                                                                        │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│  640px wide, z:1000                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 17. Unsupported Device Modal

### 17.1 Screen Too Small
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │                    [📱 48px icon, Slate #475569]                     │   │
│  │                                                                      │   │
│  │                    Screen Too Small                                  │   │
│  │                    (20px/600 Ink)                                    │   │
│  │                                                                      │   │
│  │                    The Collaborative Steering Pipeline               │   │
│  │                    requires a minimum viewport width of 768px.       │   │
│  │                    (14px/400 Slate)                                  │   │
│  │                                                                      │   │
│  │                    Current: 375px × 812px (iPhone)                   │   │
│  │                    Required: 768px+ width                            │   │
│  │                                                                      │   │
│  │                    [Continue Anyway (Not Recommended)]                 │   │
│  │                    ← 40px button, Secondary style                   │   │
│  │                                                                      │   │
│  │                    ⚠️ Limited functionality — viewport below minimum    │   │
│  │                                                                      │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│  400px modal, z:1000, centered                                              │
│                                                                             │
│  If "Continue Anyway":                                                        │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │  ⚠️ Limited functionality — viewport below minimum width             │   │
│  │  32px height, bg:#FEF2F2, text:Error #EF4444, persistent banner      │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 18. Keyboard Shortcut Cheat Sheet

### 18.1 Shortcut Overlay
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │  ⌨️ Keyboard Shortcuts                                      [✕]        │   │
│  ├────────────────────────────────────────────────────────────────────────┤   │
│  │                                                                        │   │
│  │  Global                                                                │   │
│  │  Cmd+Shift+P    Open Command Palette                                  │   │
│  │  Cmd+B          Toggle Chat Panel                                     │   │
│  │  Cmd+Shift+E    Toggle File Explorer                                  │   │
│  │  Cmd+Shift+R    Toggle Live Preview                                   │   │
│  │  Cmd+Shift+T    Toggle Terminal                                       │   │
│  │  Cmd+Shift+G    Toggle Blueprint Graph                                │   │
│  │  F6 / Shift+F6  Cycle panel focus                                     │   │
│  │  Escape         Close modal / Collapse panel                          │   │
│  │                                                                        │   │
│  │  Chat Panel                                                            │   │
│  │  Enter          Send message                                          │   │
│  │  Shift+Enter    New line in message                                   │   │
│  │  ↑ (empty)      Recall last message                                   │   │
│  │  Cmd+↑          Navigate message history                              │   │
│  │  /              Open command palette in chat                          │   │
│  │                                                                        │   │
│  │  Steering Panel                                                        │   │
│  │  ↑ / ↓          Navigate options                                      │   │
│  │  Enter          Select focused option                                   │   │
│  │  Space          Toggle bookmark                                       │   │
│  │  1-4            Trigger action bar buttons                         │   │
│  │  Page Up/Down   Scroll list                                           │   │
│  │                                                                        │   │
│  │  Editor                                                                │   │
│  │  Cmd+M          Toggle minimap                                        │   │
│  │  Cmd+S          Save file                                             │   │
│  │  Cmd+/          Toggle comment                                        │   │
│  │                                                                        │   │
│  │  [Print] [Reset to Defaults]                                          │   │
│  │                                                                        │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│  560px wide, z:1000, two-column layout on desktop                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 19. Glossary / Help Panel

### 19.1 Help Drawer
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌─────────────────────────────────────────────────────────┐ ← slides from  │
│  │  📖 Help & Glossary                              [✕] │   right, 400px │
│  ├─────────────────────────────────────────────────────────┤                │
│  │                                                         │                │
│  │  Search: [What is a Capability?                    ]   │                │
│  │                                                         │                │
│  │  ┌────────────────────────────────────────────────────┐ │                │
│  │  │ Capability                                           │ │                │
│  │  │                                                      │ │                │
│  │  │ A high-level business function that the system       │ │                │
│  │  │ provides. Capabilities are decomposed into Use Cases,│ │                │
│  │  │ then User Stories, then Engineering Tasks.           │ │                │
│  │  │                                                      │ │                │
│  │  │ Example: "Appointment Booking" is a capability       │ │                │
│  │  │ that includes use cases like "Schedule Appointment"  │ │                │
│  │  │ and "Cancel Appointment."                             │ │                │
│  │  │                                                      │ │                │
│  │  │ Related: Use Case, User Story, Actor                  │ │                │
│  │  │ [View in Blueprint Graph]                             │ │                │
│  │  └────────────────────────────────────────────────────┘ │                │
│  │                                                         │                │
│  │  Quick Links:                                           │                │
│  │  • Onboarding Tour (replay)                              │                │
│  │  • PRD Writing Guide                                     │                │
│  │  • Acceptance Criteria Best Practices                    │                │
│  │  • RBAC Design Patterns                                  │                │
│  │  • Contact Support                                       │                │
│  │                                                         │                │
│  └─────────────────────────────────────────────────────────┘                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 20. Session Timeout / Recovery

### 20.1 Timeout Warning
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  [Top-right toast, z:5000]                                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │  ⏰ Session Expires in 5 Minutes                              [Extend] │   │
│  │  Your work has been auto-saved. Click Extend to continue working.      │   │
│  │  [Save & Exit]                                                          │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│  Amber left border, auto-dismisses on Extend click                          │
│                                                                             │
│  At 1 minute:                                                                 │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │  ⏰ Session Expires in 1 Minute!                               [Extend] │   │
│  │  [Save & Exit]                                                          │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│  Red left border, assertive live region announcement                          │
│                                                                             │
│  At expiry:                                                                   │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │  🔒 Session Expired                                           [Login]  │   │
│  │  Your work has been saved. Click here to resume from your last        │   │
│  │  checkpoint.                                                            │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│  Full-screen overlay, z:1000                                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 21. Infrastructure Profile Re-run

### 21.1 Stale Profile Warning
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │  ⚠️ Infrastructure Profile Outdated                           [✕]        │   │
│  ├────────────────────────────────────────────────────────────────────────┤   │
│  │                                                                        │   │
│  │  Your scale inputs have changed since the hosting options were        │   │
│  │  generated. The current profile may not reflect your needs.             │   │
│  │                                                                        │   │
│  │  Previous: 1,000 users, 500 concurrent, $500/mo                        │   │
│  │  Current:  10,000 users, 2,000 concurrent, $2,000/mo                   │   │
│  │                                                                        │   │
│  │  [Re-run Scale Advisor] ← primary action                              │   │
│  │  [Keep Current Profile] ← secondary, marks as manually overridden     │   │
│  │  [Defer Decision] ← marks stale, continues with warning              │   │
│  │                                                                        │   │
│  │  [🟡] This warning will persist until profile is updated or overridden │   │
│  │                                                                        │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│  480px modal, z:1000, triggered by INFRASTRUCTURE_PROFILE_STALE               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Updated Master Navigation Matrix (Additions)

| Source | Action | Target | Event | Condition |
|--------|--------|--------|-------|-----------|
| Login | Select Citizen Dev | Landing (Empty State) | `persona=citizen` | First session |
| Login | Select Architect | Dashboard | `persona=architect` | Existing projects |
| Login | Select Security | Audit Dashboard | `persona=security` | Security landing |
| Dashboard | Click "New Project" | Landing (Empty State) | `session=new` | Fresh start |
| Dashboard | Click "Resume" | IDE (restored state) | `session=resume` | `NF-RL-01` |
| Dashboard | Click "Import Legacy" | Legacy Ingestion | `LEGACY_INGEST` | ZIP/Git upload |
| Landing | Submit input | Input Processing | `USER_INPUT` | Any input |
| Input Processing | `RICHNESS_MODE_DETECTED` | Classification | Auto | — |
| Classification | WELL_FORMED | PRD Analysis | User click | — |
| Classification | MINIMALIST | Minimalist Dialogue | User click | — |
| Classification | SEED_ONLY | Seed Builder | User click | — |
| PRD Analysis | Proceed | Stage 1 (IDE) | `STAGE_RUNNING` | All resolved |
| Minimalist | Submit | Stage 1 (IDE) | `STAGE_RUNNING` | Complete |
| Seed Builder | Run Pipeline | Stage 0 (IDE) | `STAGE_RUNNING` | Seed built |
| Scale Dialogue | Generate | Hosting Options | `HOSTING_OPTIONS_READY` | Valid inputs |
| Hosting Options | Select | Tech Stack Options | `TECH_STACK_OPTIONS_READY` | Hosting committed |
| Tech Stack Options | Select | Stage 2 (IDE) | `STAGE_RUNNING` | Stack committed |
| IDE | `STEERING_PANEL_READY` | Steering Panel | Auto-open | Stage boundary |
| Steering | Accept | Next Stage / Streaming | `STEERING_ACTION` | — |
| Steering | Modify | Node Editor | `NODE_MANIPULATION(edit)` | Contextual |
| Steering | Bookmark | Bookmark Drawer | `BOOKMARK_TOGGLE` | Comparison |
| Steering | Impact | Impact Report Overlay | `IMPACT_REPORT_READY` | Revision |
| Node Editor | Save | Validation Inspector | `NODE_COMMITTED` | Post-save |
| Node Editor | Save & Enrich | Enrichment Panel | `ENRICH_NODE` | AI suggest |
| Enrichment | Apply | Impact Report | `ENRICH_NODE` | Downstream effect |
| Blueprint Graph | Add Node | Add Node Modal | `NODE_MANIPULATION(add)` | — |
| Blueprint Graph | Edit | Node Editor | `NODE_MANIPULATION(edit)` | — |
| Blueprint Graph | Remove | Delete Modal | `NODE_MANIPULATION(remove)` | Impact warn |
| Blueprint Graph | What-If | What-If Sandbox | `HYPOTHETICAL_SANDBOX` | Drag mode |
| What-If | Commit | Steering Panel | `STEERING_ACTION` | Apply change |
| File Explorer | Steer | Node Editor | `CODE_FILE_STEER` | File context |
| File Explorer | Regenerate | Confirmation | `CODE_FILE_STEER` | Regen |
| Editor | `@steering` | Chat | `MID_STAGE_STEER` | Inline |
| Editor | Merge Conflict | 3-Way Merge | `MERGE_CONFLICT` | Stage 8 regen |
| Live Preview | Click element | Editor + File Explorer | `PREVIEW_INTERACTIVE_ELEMENT` | Highlight |
| Live Preview | Feedback | Chat | `PREVIEW_FEEDBACK` | Pre-seeded |
| Terminal | Dangerous cmd | Confirmation Modal | Intercept | Blocked |
| Test Results | Debug | Editor | `TEST_DEBUG` | Inject debugger |
| Audit | Revert | Revert Modal | `REVISION_REQUEST` | Diff preview |
| Audit | Initiate Revision | Node Editor | `REVISION_REQUEST` | Historical |
| RBAC Matrix | Commit blocked | Error shake | `RBAC_INHERITANCE_CYCLE` | Resolve first |
| RBAC Matrix | Valid commit | Stage 4+ | `RBAC_STEERING_ACTION` | Resume |
| Completeness Gate | Error | Node Editor | `NODE_MANIPULATION(edit)` | Jump to field |
| Completeness Gate | Auto-Fix | Bulk Fix Wizard | `BULK_FIX` | Batch |
| Completeness Gate | 100% | Stage 8 | `CODE_GENERATING` | Auto-transition |
| Stage 8 | File stream | Editor | `CODE_FILE_STREAM` | Real-time |
| Stage 8 | Conflict | 3-Way Merge | `MERGE_CONFLICT` | User edits |
| Stage 9 | Runtime ready | Live Preview | `RUNTIME_STARTED` | Green flash |
| Stage 9 | Test fail | Test Results | `TEST_RESULT_STREAM` | Auto-scroll |
| Stage 10 | Deploy | Deployment Complete | `DEPLOYED` | Modal |
| Global | `Cmd+Shift+P` | Command Palette | Modal | Any context |
| Global | Search | Global Search | Overlay | Fuzzy find |
| Global | Notification | Notification Drawer | Slide-out | History |
| Global | Help | Help Drawer | Slide-out | Glossary |
| Global | Timeout warning | Timeout Toast | Assertive | 5min, 1min |
| Global | Session expired | Login overlay | Full-screen | Redirect |
| Settings | Persona change | IDE layout refresh | `personaChange` | Panel hide/show |
| Settings | Theme change | CSS `data-theme` | `themeChange` | Immediate |
| Revision Manager | New Branch | What-If Sandbox | `BRANCH_CREATE` | Isolated |
| Revision Manager | Merge | Impact Report | `BRANCH_MERGE` | Conflict check |
| Context Agent | "Why" query | Why Panel | `CONTEXT_QUESTION` | Slide-out |
| Legacy Ingestion | Proceed | Stage 0 with context | `LEGACY_CONTEXT` | Mapped |

---

*End of Gap Analysis & Missing Screen Wireframes*