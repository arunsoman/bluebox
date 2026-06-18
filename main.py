"""Collaborative Steering Pipeline — FastAPI application entry point."""
from __future__ import annotations

from contextlib import asynccontextmanager

import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from config.settings import settings

# Path to frontend build
FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "frontend_dist")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan — init and cleanup."""
    # Startup
    from infrastructure.persistence.postgresql.engine import init_db
    from infrastructure.persistence.timescaledb.engine import init_ts_db
    try:
        await init_db()
    except Exception as e:
        print(f"PostgreSQL init warning: {e}")
    try:
        await init_ts_db()
    except Exception as e:
        print(f"TimescaleDB init warning: {e}")
    yield
    # Shutdown
    from infrastructure.persistence.postgresql.engine import close_db
    from infrastructure.persistence.timescaledb.engine import close_ts_db
    from infrastructure.persistence.redis.client import close_redis
    await close_db()
    await close_ts_db()
    await close_redis()


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Exception Handlers ──────────────────────────────────────────────────────

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": str(exc)},
    )


# ── Health Check ────────────────────────────────────────────────────────────

@app.get("/api/v1/health", tags=["health"])
async def health_check():
    return {"status": "healthy", "version": settings.app_version, "services": {}}


@app.get("/api/v1/metrics", tags=["health"])
async def metrics():
    from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
    return StreamingResponse(
        iter([generate_latest()]),
        media_type=CONTENT_TYPE_LATEST,
    )


# ── Routes will be imported and registered here ─────────────────────────────
# These imports happen at the bottom to avoid circular imports during startup

def _register_routes():
    """Register all route modules. Called after all modules are defined."""
    try:
        from interfaces.api.rest_controller import router as rest_router
        from interfaces.api.rest_controller import admin_router
        from interfaces.api.sse_controller import router as sse_router
        app.include_router(rest_router, prefix="/api/v1")
        app.include_router(admin_router, prefix="/api/v1")
        app.include_router(sse_router, prefix="/api/v1")
    except ImportError as e:
        print(f"Route registration deferred: {e}")


_register_routes()

# ── Static Files (React Frontend) ───────────────────────────────────────────

if os.path.isdir(FRONTEND_DIST):
    # Mount static assets
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")

    @app.get("/", tags=["static"])
    async def serve_root():
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))

    @app.get("/{path:path}", tags=["static"])
    async def serve_spa(path: str):
        """Serve React SPA — return index.html for all non-API routes."""
        # Don't intercept API routes
        if path.startswith("api/") or path.startswith("docs") or path.startswith("openapi"):
            return JSONResponse(status_code=404, content={"detail": "Not found"})
        index_path = os.path.join(FRONTEND_DIST, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        return JSONResponse(status_code=404, content={"detail": "Frontend not built"})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, log_level="info")
