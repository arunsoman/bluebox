# Bluebox — Collaborative Steering Pipeline

A stateful, human-in-the-loop system that transforms free-text user input into a rigorous, machine-executable `ProjectBlueprint`.

## Monorepo Structure

```
bluebox/
├── backend/     # Python FastAPI backend
│   ├── app/     # Pipeline modules
│   ├── tests/   # Test suite
│   └── ...
├── frontend/    # React + TypeScript UI (glassmorphism theme)
│   ├── src/     # Source code
│   └── ...
└── README.md
```

## Quick Start

### Backend
```bash
cd backend
cp .env.example .env
docker-compose up -d
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Architecture

- **Backend**: FastAPI, PostgreSQL/TimescaleDB, Redis, WebSocket streaming
- **Frontend**: React 19, TypeScript, Tailwind CSS, shadcn/ui, glassmorphism design
