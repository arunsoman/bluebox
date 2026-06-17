# Bluebox — Collaborative Steering Pipeline

A stateful, human-in-the-loop system that transforms free-text user input into a rigorous, machine-executable `ProjectBlueprint` through 8 AI-powered stages with human steering at every step.

**Live Demo**: https://27xc2afa36uuk.kimi.page

---

## Monorepo Structure

```
bluebox/
├── backend/          # Python FastAPI backend
│   ├── app/          # 13 pipeline modules, 8 stage executors
│   ├── tests/        # 6 test files (unit + integration)
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── requirements.txt
├── frontend/         # React 19 + TypeScript UI
│   ├── src/
│   │   ├── components/   # Glassmorphism design system
│   │   ├── pages/        # 7 pages (Dashboard, Studio, Explorer, ...)
│   │   ├── store/        # Zustand state management
│   │   └── lib/          # Config, utils
│   ├── package.json
│   └── vite.config.ts
├── netlify.toml      # Netlify deployment config
├── package.json      # Root package.json with npm scripts
├── DEPLOY.md         # Full deployment guide
└── README.md         # This file
```

---

## Quick Start (Local Development)

### Prerequisites
- Node.js 20+
- Python 3.12+
- Docker & Docker Compose (for PostgreSQL + Redis + MinIO)

### 1. Start Infrastructure

```bash
cd backend
cp .env.example .env
docker-compose up -d postgres redis minio
```

### 2. Start Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head        # Run database migrations
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend runs at http://localhost:8000
- API docs: http://localhost:8000/docs
- Health check: http://localhost:8000/health

### 3. Start Frontend

```bash
cd frontend
cp .env.example .env    # Uses localhost:8000 by default
npm install
npm run dev
```

Frontend runs at http://localhost:5173

---

## Deploy to Netlify (Frontend)

### One-Click Deploy

1. Go to [Netlify Dashboard](https://app.netlify.com) → **Add new site → Import from Git**
2. Select your GitHub repo `arunsoman/bluebox`
3. Build settings (Netlify auto-detects from `netlify.toml`):

| Setting | Value |
|---------|-------|
| Base directory | `frontend` |
| Build command | `npm run build` |
| Publish directory | `frontend/dist` |

4. Add environment variables (Site Settings → Environment Variables):

| Key | Value |
|-----|-------|
| `VITE_API_URL` | Your backend URL (e.g., `https://bluebox-api.onrender.com`) |
| `VITE_WS_URL` | Your WebSocket URL (e.g., `wss://bluebox-api.onrender.com`) |
| `VITE_LIVE_WS` | `true` |
| `VITE_LIVE_API` | `true` |

5. Click **Deploy**

### Netlify CLI

```bash
npm install -g netlify-cli
netlify login
netlify init
netlify deploy --build --prod
```

> See [DEPLOY.md](DEPLOY.md) for full deployment options including backend hosting on Render, Railway, Heroku, AWS, and Docker.

---

## Architecture

### Backend (Python FastAPI)

| Module | Description |
|--------|-------------|
| `app/core` | State machine, config, events, exceptions |
| `app/domain` | Pydantic models (Actor, Capability, Blueprint, etc.) |
| `app/stages` | 8 stage executors (Seed → Finalization) |
| `app/llm` | LLM client abstraction (OpenAI + Mock) |
| `app/graph` | DAG engine + impact analysis + sandbox |
| `app/governance` | CRUD + revision engine + budget |
| `app/input` | PRD classifier + analyzer + compliance scanner |
| `app/advisory` | Scale infra + tech stack + RBAC advisors |
| `app/api` | REST endpoints + WebSocket handler |
| `app/audit` | Trail + checkpoint + budget |
| `app/chat` | Orchestrator + agent + intent parser |

### Frontend (React 19 + TypeScript)

| Page | Route | Features |
|------|-------|----------|
| **PRD Input** | `/` | Paste/upload PRD, drag & drop, real-time classification |
| **Dashboard** | `/` (after PRD) | Pipeline overview, 8-stage flow, metrics, activity feed |
| **Pipeline Studio** | `/studio` | Streaming terminal, steering panel, run controls |
| **Node Explorer** | `/explorer` | Filterable entity catalog, detail drawer |
| **Impact Visualizer** | `/impact` | Interactive DAG with React Flow, impact simulation |
| **Chat** | `/chat` | Streaming AI chat, rich content cards |
| **Blueprint Viewer** | `/blueprint` | Hierarchical navigator, completeness validation |
| **Audit Trail** | `/audit` | Decision ledger, checkpoint management |

### Design System

- **5 polymorphic glass variants**: Clear, Frosted, Tinted, Elevated, Bordered
- **Deep cyberpunk dark** with luminous cyan (`#00F5FF`) accents
- **Typography**: Orbitron (headlines) + Inter (body) + JetBrains Mono (code)
- **Animations**: Framer Motion panel entrances, streaming typewriter, pulse glows

---

## Environment Variables

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8000` | Backend REST API URL |
| `VITE_WS_URL` | `ws://localhost:8000` | WebSocket URL |
| `VITE_LIVE_WS` | `false` | Enable real WebSocket |
| `VITE_LIVE_API` | `false` | Enable real API calls |

### Backend (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql+asyncpg://...` | PostgreSQL connection |
| `REDIS_URL` | `redis://...` | Redis connection |
| `CORS_ORIGINS` | `*` | Allowed frontend origins |
| `OPENAI_API_KEY` | (empty) | OpenAI API key |

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/api/v1/blueprint/{project_id}` | Export ProjectBlueprint |
| `GET` | `/api/v1/blueprint/{project_id}/completeness` | Check Stage 7 gate |
| `GET` | `/api/v1/ledger/{project_id}` | Fetch DecisionLedger |
| `POST` | `/api/v1/session` | Create new session |
| `GET` | `/api/v1/session/{session_id}/state` | Get state machine status |
| `WS` | `/ws/steering/{session_id}` | WebSocket steering channel |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui, Framer Motion |
| **Backend** | Python 3.12, FastAPI, SQLAlchemy 2.0, Alembic |
| **Database** | PostgreSQL 15+ (TimescaleDB for audit) |
| **Cache** | Redis 7+ |
| **Storage** | MinIO / S3 |
| **LLM** | OpenAI GPT-4, Anthropic Claude |
| **Testing** | pytest, pytest-asyncio |
| **Deploy** | Netlify (FE), Render/Railway/Heroku/AWS (BE) |

---

## License

MIT
