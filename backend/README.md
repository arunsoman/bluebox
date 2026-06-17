# Collaborative Steering Pipeline

> AI-assisted project planning with human-in-the-loop governance.

A FastAPI-based pipeline that guides collaborative software project definition through 8 stages (Seed -> Ideation -> Actors -> Capabilities -> Use Cases -> User Stories -> Tasks -> Finalization), with real-time streaming, impact analysis, and governance controls.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Technology Stack](#technology-stack)
- [Quick Start](#quick-start)
- [API Documentation](#api-documentation)
- [Development Setup](#development-setup)
- [Testing](#testing)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [License](#license)

---

## Architecture Overview

```
+-----------+     +------------------+     +------------------+
|  Frontend |<--->|  FastAPI (WS)    |<--->|  PipelineOrche   |
| (React)   |     |  + REST API      |     |  (State Machine) |
+-----------+     +------------------+     +--------+---------+
                                                    |
                          +-------------------------+------------------------+
                          |                         |                        |
                   +------v------+        +---------v--------+    +---------v---------+
                   | 8 Stages    |        | Graph Engine     |    | Governance        |
                   | (LLM Exec)  |        | (DAG/Impact)     |    | (CRUD/Revision)   |
                   +------+------+        +---------+--------+    +---------+---------+
                          |                         |                        |
                   +------v------+        +---------v--------+    +---------v---------+
                   | LLM Clients |        | Checkpoint Mgr   |    | Audit Trail       |
                   | (OpenAI...) |        | (S3/MinIO)       |    | (TimescaleDB)     |
                   +-------------+        +------------------+    +-------------------+
```

### Pipeline Stages

| Stage | Name | Description |
|-------|------|-------------|
| 0 | Seed | Extract problem statement, project name, domain signals |
| 1 | Ideation | Generate initial project concepts |
| 2 | Actors | Identify system actors (human, system, external) |
| 3 | Capabilities | Define actor capabilities |
| 4 | Use Cases | Map capabilities to use cases |
| 5 | User Stories | Decompose use cases into stories |
| 6 | Tasks | Break stories into engineering tasks |
| 7 | Finalization | Completeness gate + export validation |

### Key Design Patterns

- **State Machine**: `PipelineOrchestrator` enforces valid state transitions via `VALID_TRANSITIONS`
- **Event Bus**: Async event-driven architecture with Redis Streams (production) and in-memory (testing)
- **Graph Engine**: NetworkX-based DAG for dependency tracking and impact analysis
- **Governance**: 4-step revision loop (submit -> analyze -> consent -> propagate) with budget caps
- **Streaming**: Real-time LLM output streaming via WebSocket `CHUNK_STREAM` events

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | FastAPI + Uvicorn |
| Models | Pydantic v2 |
| ORM | SQLAlchemy 2.0 (async) |
| Database | PostgreSQL 15+ + TimescaleDB |
| Migrations | Alembic |
| Event Bus | Redis Streams (async-local fallback) |
| Cache/Session | Redis |
| Blob Storage | MinIO / S3 |
| LLM Clients | OpenAI + Anthropic (swappable via `LLMClientInterface`) |
| Graph Engine | NetworkX |
| Testing | pytest + pytest-asyncio + httpx |
| Container | Docker + docker-compose |

---

## Quick Start

### Prerequisites

- Docker + Docker Compose
- Python 3.12+ (for local development)
- Make (optional)

### Using Docker Compose (Recommended)

```bash
# Clone and start all services
git clone <repo-url>
cd collaborative-steering-pipeline

# Copy environment file
cp .env.example .env

# Start the full stack
docker-compose up --build

# The API will be available at http://localhost:8000
# OpenAPI docs: http://localhost:8000/docs
# MinIO console: http://localhost:9001 (minioadmin/minioadmin)
```

### Services

| Service | URL | Description |
|---------|-----|-------------|
| FastAPI | http://localhost:8000 | Main application |
| PostgreSQL | localhost:5432 | Primary database (TimescaleDB) |
| Redis | localhost:6379 | Cache, sessions, event bus |
| MinIO | http://localhost:9000 | S3-compatible object storage |
| MinIO Console | http://localhost:9001 | MinIO web UI |

### Health Check

```bash
curl http://localhost:8000/health
```

---

## API Documentation

### REST Endpoints

All REST endpoints are prefixed with `/api/v1`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/blueprint/{project_id}` | Export ProjectBlueprint |
| GET | `/blueprint/{project_id}/completeness` | Check Stage 7 gate |
| GET | `/ledger/{project_id}` | Fetch DecisionLedger |
| GET | `/ledger/{project_id}/entry/{entry_id}` | Fetch specific decision |
| GET | `/audit/{project_id}` | Export audit events |
| POST | `/session` | Create new session |
| GET | `/session/{session_id}/state` | Get state machine status |
| POST | `/checkpoint/restore/{project_id}` | Restore checkpoint |
| GET | `/checkpoint/{project_id}` | List checkpoints |
| POST | `/session/{session_id}/abort` | Abort session |
| GET | `/health` | Health check |

### WebSocket Events

Connect to `/ws/steering/{session_id}` for real-time bidirectional communication.

#### Backend -> Frontend (Server pushes)

| Event | Description |
|-------|-------------|
| `STEERING_PANEL_READY` | Stage boundary reached, awaiting user input |
| `CHUNK_STREAM` | LLM output chunk ready |
| `NODE_UPDATED` | CRUD operation committed |
| `IMPACT_REPORT_READY` | Revision impact report available |
| `CHECKPOINT_RESTORED` | Recovery action completed |
| `STATE_TRANSITION` | State machine changed state |
| `CHAT_RESPONSE` | ContextAgent reply |
| `ERROR` | LLM failure or validation error |

#### Frontend -> Backend (Client sends)

| Event | Description |
|-------|-------------|
| `STEERING_ACTION` | Resume pipeline (accept/modify/replace) |
| `NODE_MANIPULATION` | CRUD operation on a node |
| `CHAT_MESSAGE` | Natural language interaction |
| `PROPAGATION_CONSENT` | Approve/reject impact propagation |
| `INTERRUPT_SIGNAL` | Pause streaming |
| `CHECKPOINT_REQUEST` | Manual checkpoint management |

#### WebSocket Example

```javascript
const ws = new WebSocket("ws://localhost:8000/ws/steering/session-123");

ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    switch (msg.event) {
        case "STEERING_PANEL_READY":
            console.log("Stage", msg.data.stage_id, "ready");
            break;
        case "CHUNK_STREAM":
            console.log("Chunk:", msg.data);
            break;
        case "STATE_TRANSITION":
            console.log("State:", msg.data.from_state, "->", msg.data.to_state);
            break;
    }
};

// Send steering action
ws.send(JSON.stringify({
    event: "STEERING_ACTION",
    data: { action: "accept", stage_id: 0 }
}));
```

---

## Development Setup

### Local Development (without Docker)

```bash
# Create virtual environment
python3.12 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
cp .env.example .env
# Edit .env with your local settings

# Run the application
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Run database migrations (requires PostgreSQL)
alembic upgrade head
```

### Running Tests

```bash
# Run all tests
pytest -v

# Run unit tests only
pytest tests/unit/ -v

# Run integration tests only
pytest tests/integration/ -v

# Run with coverage
pytest --cov=app --cov-report=term-missing

# Run specific test file
pytest tests/unit/test_state_machine.py -v

# Run with async debug
pytest -v --asyncio-mode=auto
```

### Code Quality

```bash
# Format code (if using ruff/black)
ruff format app/ tests/
ruff check app/ tests/

# Type checking (if using mypy)
mypy app/
```

---

## Testing

### Test Structure

```
tests/
├── __init__.py
├── conftest.py           # Shared fixtures (MockLLMClient, PipelineOrchestrator, etc.)
├── unit/
│   ├── __init__.py
│   ├── test_state_machine.py     # State transitions, PipelinePausedError
│   ├── test_graph_engine.py      # DAG ops, traversal, cycles, performance
│   ├── test_governance.py        # CRUD, RevisionEngine, RevisionBudget
│   ├── test_stages.py            # Stage executors (Stage 0, Stage 7 gate)
│   └── test_llm.py               # MockLLMClient, error classification
└── integration/
    ├── __init__.py
    └── test_end_to_end.py        # Full pipeline run, checkpoint create/restore
```

### Key Fixtures (conftest.py)

| Fixture | Description |
|---------|-------------|
| `mock_llm` | MockLLMClient with pre-configured responses |
| `event_bus` | Fresh LocalEventBus |
| `pipeline_orchestrator` | PipelineOrchestrator in INITIALIZED state |
| `graph_service` | Empty DependencyGraphService |
| `revision_engine` | RevisionEngine wired with ImpactAnalyzer + EventBus |

### Test Categories

**Unit Tests:**
- State Machine: All valid/invalid transitions; PipelinePausedError
- Graph Engine: DAG build, traversal, cycle detection; <500ms for 1k nodes
- Governance: 4-step revision loop, budget exhaustion
- Stages: Stage 0 with MockLLMClient, Stage 7 completeness gate
- LLM: MockLLMClient deterministic responses, error classification

**Integration Tests:**
- End-to-end: Full pipeline run with MockLLMClient
- Checkpoint: Create -> modify -> restore -> assert state equality
- WebSocket event flow

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql+asyncpg://user:pass@localhost:5432/pipeline` | Main PostgreSQL connection |
| `TIMESCALEDB_URL` | Same as DATABASE_URL | TimescaleDB audit database |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis connection |
| `S3_ENDPOINT` | `http://localhost:9000` | MinIO/S3 endpoint |
| `S3_BUCKET` | `pipeline-checkpoints` | Checkpoint storage bucket |
| `S3_ACCESS_KEY` | `minioadmin` | S3 access key |
| `S3_SECRET_KEY` | `minioadmin` | S3 secret key |
| `OPENAI_API_KEY` | *(empty)* | OpenAI API key |
| `ANTHROPIC_API_KEY` | *(empty)* | Anthropic API key |
| `DEFAULT_LLM_MODEL` | `gpt-4` | Default LLM model |
| `LLM_TIMEOUT_SECONDS` | `30` | LLM request timeout |
| `MAX_REVISIONS_PER_DECISION` | `5` | Max revision rounds per decision |
| `DEFAULT_AUDIT_BUDGET_MB` | `100` | Audit trail storage budget |
| `AUDIT_RETENTION_DAYS` | `90` | Audit data retention period |
| `DEBUG` | `False` | Enable debug mode |

---

## Project Structure

```
project/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI app factory + lifespan
│   ├── core/
│   │   ├── config.py           # Pydantic Settings
│   │   ├── state_machine.py    # FSM + PipelineOrchestrator
│   │   ├── exceptions.py       # Domain exceptions
│   │   └── events.py           # EventBus abstraction
│   ├── domain/
│   │   ├── models.py           # Pydantic models
│   │   ├── blueprint.py
│   │   ├── nodes.py
│   │   └── ledger.py
│   ├── stages/
│   │   ├── base.py             # BaseStageExecutor (ABC)
│   │   ├── factory.py          # StageExecutorFactory
│   │   ├── streaming.py        # StreamingChunkManager
│   │   ├── context_window.py   # ContextWindowManager
│   │   └── executors/          # Stage 0-7 executors
│   ├── graph/
│   │   ├── dag.py              # DependencyGraphService
│   │   ├── impact.py           # ImpactAnalyzer
│   │   └── sandbox.py          # HypotheticalSandbox
│   ├── governance/
│   │   ├── crud.py             # CRUDNodeService
│   │   ├── revision.py         # RevisionEngine
│   │   └── budget.py           # RevisionBudget
│   ├── llm/
│   │   ├── client.py           # LLMClientInterface (ABC)
│   │   ├── mock.py             # MockLLMClient (testing)
│   │   └── openai_client.py    # OpenAI implementation
│   ├── api/
│   │   ├── routes.py           # REST endpoints
│   │   ├── websocket.py        # WebSocket handler
│   │   └── deps.py             # FastAPI dependencies
│   └── db/
│       ├── base.py             # SQLAlchemy Base
│       ├── models.py           # ORM models
│       └── session.py          # Async session factory
├── alembic/
│   ├── env.py                  # Alembic async config
│   ├── script.py.mako          # Migration template
│   └── versions/               # Migration files
├── tests/
│   ├── conftest.py             # Shared fixtures
│   ├── unit/                   # Unit tests
│   └── integration/            # Integration tests
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Database Schema

### Tables

| Table | Purpose |
|-------|---------|
| `projects` | Stores ProjectBlueprint as JSONB |
| `decision_entries` | Append-only decision ledger |
| `sessions` | Pipeline session state |
| `audit_events` | TimescaleDB hypertable for audit events |
| `checkpoints` | Checkpoint metadata (data in S3) |

### Indexes

- `ix_projects_created_at` — Time-range queries
- `ix_decision_entries_project_id` — Per-project ledger lookup
- `ix_decision_entries_timestamp` — Temporal queries
- `ix_sessions_project_id` — Session lookup by project
- `ix_audit_events_project_timestamp` — Audit trail queries
- `ix_checkpoints_project_id` — Checkpoint listing

---

## Governance & Revision Flow

```
User requests CRUD change
       |
       v
+---------------+    +------------------+    +---------------------+
| CRUDNodeService| -> | RevisionEngine   | -> | ImpactAnalyzer      |
| .apply()       |    | .submit()        |    | .analyze()          |
+---------------+    +--------+---------+    +----------+----------+
                              |                          |
                              v                          v
                     +--------+---------+    +----------+----------+
                     | Store pending    |    | Compute downstream  |
                     | change           |    | + upstream effects  |
                     +--------+---------+    +----------+----------+
                              |                          |
                              v                          v
                     +--------+---------+    +----------+----------+
                     | Emit             | <- | Generate report     |
                     | IMPACT_REPORT_   |    | with stages_to_rerun|
                     | READY            |    +---------------------+
                     +--------+---------+
                              |
                              v
                     +--------+---------+
                     | Await user       |
                     | PROPAGATION_     |
                     | CONSENT          |
                     +--------+---------+
                              |
                    +---------+---------+
                    |                   |
              confirmed=true      confirmed=false
                    |                   |
                    v                   v
              +----------+        +----------+
              | Apply    |        | Discard  |
              | change   |        | change   |
              +----------+        +----------+
```

---

## License

MIT License — see LICENSE file for details.
