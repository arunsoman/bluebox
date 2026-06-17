# Deployment Guide — Bluebox

This guide covers deploying the Bluebox monorepo's frontend and backend to various platforms.

---

## Architecture Overview

```
                    +-------------------+
                    |   Netlify (FE)    |
                    |  Static Hosting   |
                    |  your-site.netlify|
                    +--------+----------+
                             | HTTPS
                             v
                    +--------+----------+
                    |   Backend (BE)    |
                    |  FastAPI + WS     |
                    |  Render/Railway/  |
                    |  Heroku/AWS/self  |
                    +-------------------+
                             |
                    +--------+----------+
                    |  PostgreSQL       |
                    |  Redis            |
                    +-------------------+
```

---

## 1. Frontend — Netlify

### Option A: Netlify UI (Click-to-Deploy)

1. Go to https://app.netlify.com and click **"Add new site" → "Import an existing project"**
2. Connect your GitHub repo (`arunsoman/bluebox`)
3. Configure build settings:

| Setting | Value |
|---------|-------|
| Base directory | `frontend` |
| Build command | `npm run build` |
| Publish directory | `frontend/dist` |

4. Click **Deploy Site**
5. Add environment variables (Site Settings → Environment Variables):

| Key | Value (for production) |
|-----|----------------------|
| `VITE_API_URL` | `https://your-backend-url.com` |
| `VITE_WS_URL` | `wss://your-backend-url.com` |
| `VITE_LIVE_WS` | `true` |
| `VITE_LIVE_API` | `true` |

### Option B: Netlify CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Initialize (first time)
netlify init
# Select "Create & configure a new site"
# Choose your team, site name

# Set environment variables
netlify env:set VITE_API_URL https://your-backend-url.com
netlify env:set VITE_WS_URL wss://your-backend-url.com
netlify env:set VITE_LIVE_WS true
netlify env:set VITE_LIVE_API true

# Deploy
netlify deploy --build --prod
```

### Option C: Drag & Drop (Manual)

```bash
cd frontend
npm install
npm run build
# This creates frontend/dist/

# Then drag the frontend/dist folder to https://app.netlify.com/drop
```

### Important: SPA Routing

The `netlify.toml` in the repo root already includes SPA redirect rules:

```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

If deploying via **Netlify UI** (not CLI), you may need to add this redirect manually:
1. Site Settings → Build & Deploy → Redirects
2. Add: `/*` → `/index.html` with status `200`

---

## 2. Backend — Options

The backend is a FastAPI app that needs:
- Python 3.12+
- PostgreSQL 15+
- Redis 7+
- (Optional) S3-compatible storage for checkpoints

### Option A: Render (Recommended — Free Tier)

1. Go to https://render.com and sign up
2. Click **New + → Web Service**
3. Connect your GitHub repo
4. Configure:

| Setting | Value |
|---------|-------|
| Name | `bluebox-api` |
| Root Directory | `backend` |
| Environment | `Python 3` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |

5. Add environment variables (Advanced → Environment Variables):
   - Copy all variables from `backend/.env.example`
   - Set `DATABASE_URL` to your PostgreSQL URL
   - Set `REDIS_URL` to your Redis URL
   - Set `CORS_ORIGINS` to your Netlify frontend URL (e.g., `https://bluebox-abc123.netlify.app`)

6. Create PostgreSQL: **New + → PostgreSQL** → note the connection string
7. Create Redis: **New + → Redis** → note the connection string

### Option B: Railway (Free Tier Available)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init --name bluebox-api

# Add PostgreSQL
railway add --database postgres

# Add Redis
railway add --database redis

# Set environment variables
railway variables -c
# Paste contents of backend/.env, Railway auto-fills DB/Redis URLs

# Deploy
railway up
```

### Option C: Heroku

```bash
# Install Heroku CLI and login
heroku login

# Create app
heroku create bluebox-api

# Add PostgreSQL
heroku addons:create heroku-postgresql:mini

# Set config vars
heroku config:set CORS_ORIGINS=https://your-netlify-site.netlify.app
heroku config:set OPENAI_API_KEY=sk-your-key
# ... set other vars from backend/.env

# Deploy
heroku stack:set container  # if using Dockerfile
git subtree push --prefix backend heroku main
```

### Option D: Docker (Self-Hosted / VPS)

```bash
cd backend

# Build image
docker build -t bluebox-api .

# Run with env file
docker run -d \
  --name bluebox-api \
  --env-file .env \
  -p 8000:8000 \
  bluebox-api

# Or use docker-compose (includes Postgres + Redis + MinIO)
docker-compose up -d
```

### Option E: AWS (EC2 / ECS / EKS)

See `backend/infra/aws/` for Terraform/CDK templates (if available).

General approach:
```bash
# 1. Launch EC2 instance (Amazon Linux 2023, t3.medium+)
# 2. Install Docker
sudo yum install docker -y
sudo systemctl start docker

# 3. Run the backend container
docker run -d \
  --name bluebox-api \
  -p 80:8000 \
  -e DATABASE_URL=postgresql+asyncpg://... \
  -e REDIS_URL=redis://... \
  -e CORS_ORIGINS=https://your-netlify-site.netlify.app \
  bluebox-api
```

---

## 3. Connecting Frontend + Backend

After deploying both, you need to connect them:

### 1. Get your backend URL
- Render: `https://bluebox-api.onrender.com`
- Railway: `https://bluebox-api.up.railway.app`
- Heroku: `https://bluebox-api.herokuapp.com`

### 2. Update frontend environment variables

In **Netlify dashboard** (or via CLI):

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://bluebox-api.onrender.com` |
| `VITE_WS_URL` | `wss://bluebox-api.onrender.com` |
| `VITE_LIVE_WS` | `true` |
| `VITE_LIVE_API` | `true` |

> **Note**: Use `wss://` (secure WebSocket) when the backend is HTTPS. Use `ws://` for HTTP.

### 3. Update backend CORS

In **backend environment variables**:

| Key | Value |
|-----|-------|
| `CORS_ORIGINS` | `https://your-netlify-site.netlify.app` |

For multiple origins (e.g., preview deploys):
```
CORS_ORIGINS=https://bluebox-prod.netlify.app,https://deploy-preview-*.netlify.app
```

### 4. Redeploy frontend

Netlify auto-redeploys when you update env vars. Or trigger manually:
```bash
netlify deploy --prod
```

---

## 4. Full Local Development Setup

```bash
# 1. Clone repo
git clone https://github.com/arunsoman/bluebox.git
cd bluebox

# 2. Start backend dependencies (PostgreSQL + Redis + MinIO)
cd backend
cp .env.example .env  # edit with your values
docker-compose up -d postgres redis minio

# 3. Install backend dependencies
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# 4. Run database migrations
alembic upgrade head

# 5. Start backend server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 6. In a new terminal, start frontend
cd ../frontend
cp .env.example .env  # defaults work for local dev
npm install
npm run dev

# 7. Open browser
open http://localhost:5173
```

---

## 5. Environment Variable Reference

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8000` | Backend REST API base URL |
| `VITE_WS_URL` | `ws://localhost:8000` | WebSocket server URL |
| `VITE_LIVE_WS` | `false` | Enable real WebSocket (not mock) |
| `VITE_LIVE_API` | `false` | Enable real API calls (not mock) |
| `VITE_DEBUG` | `false` | Show debug panels |

### Backend (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql+asyncpg://...` | PostgreSQL connection |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis connection |
| `CORS_ORIGINS` | `*` | Allowed frontend origins (comma-separated) |
| `FRONTEND_URL` | `http://localhost:5173` | Frontend URL for redirects |
| `OPENAI_API_KEY` | (empty) | OpenAI API key |
| `LLM_TIMEOUT_SECONDS` | `30` | LLM request timeout |

---

## 6. Troubleshooting

### CORS errors in browser
- Check `CORS_ORIGINS` on backend matches your frontend URL exactly
- Ensure `https://` not `http://` for production
- No trailing slash

### WebSocket connection fails
- Backend must support WebSocket (check `/health` endpoint)
- Use `wss://` for HTTPS backends, `ws://` for HTTP
- Some platforms (Render free tier) sleep after inactivity — first WS connect may take 30s

### Frontend shows "This page could not be found"
- Check SPA redirect in `netlify.toml` or Netlify dashboard
- Ensure redirect status is `200` (not `301`)

### Backend won't start
- Check `DATABASE_URL` format: must use `postgresql+asyncpg://` driver
- PostgreSQL must be 15+ with asyncpg support
- Check logs: `docker-compose logs -f api` or platform dashboard

### API calls return 404
- Backend routes are prefixed with `/api/v1` — ensure frontend uses this prefix
- Check `API_PREFIX` in `frontend/src/lib/config.ts`

---

## 7. Production Checklist

- [ ] Backend CORS origins restricted to frontend URL (not `*`)
- [ ] Frontend `VITE_API_URL` points to production backend
- [ ] WebSocket uses `wss://` (secure)
- [ ] `DEBUG=false` on backend
- [ ] Database migrations run (`alembic upgrade head`)
- [ ] LLM API keys set and have sufficient quota
- [ ] Redis configured for session/cache storage
- [ ] S3/MinIO configured for checkpoint storage
- [ ] Health check endpoint works (`/health`)
- [ ] Logging configured and forwarded to monitoring
- [ ] Rate limiting enabled on API endpoints
- [ ] SSL/TLS certificates valid on both frontend and backend
