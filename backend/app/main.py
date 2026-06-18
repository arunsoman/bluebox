"""FastAPI application factory with lifespan management."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.websockets import WebSocket

from app.api.routes import router as api_router
from app.api.websocket import websocket_steering
from app.core.config import settings
import app.db.models  # noqa: F401 — ensure models are registered with Base
from app.core.exceptions import (
    BudgetExhaustedError,
    CompletenessGateError,
    InvalidStateTransitionError,
    PipelineError,
    PipelinePausedError,
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context manager.

    Startup:
        - Initialize database tables
        - Connect to Redis
        - Initialize event bus

    Shutdown:
        - Close all connections
    """
    logger.info("\u250f" + "━" * 40)
    logger.info("┃  %s starting up...", settings.APP_NAME)
    logger.info("┃  Debug: %s", settings.DEBUG)
    logger.info("┃  Database: %s", settings.DATABASE_URL.split("@")[-1])
    logger.info("┃  Redis: %s", settings.REDIS_URL)
    logger.info("\u2517" + "━" * 40)

    # Startup: init DB tables
    try:
        from app.db.base import Base
        from app.db.session import async_engine
        async with async_engine.begin() as conn:
            # In production, use Alembic migrations instead of create_all
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database engine initialized")
    except Exception as exc:
        logger.warning("Database init skipped (will retry): %s", exc)

    # Startup: connect Redis
    try:
        import redis.asyncio as redis
        app.state.redis = redis.from_url(settings.REDIS_URL)
        await app.state.redis.ping()
        logger.info("Redis connected")
    except Exception as exc:
        logger.warning("Redis connection skipped: %s", exc)
        app.state.redis = None

    # Startup: init event bus
    from app.core.events import EventBus
    app.state.event_bus = EventBus()
    logger.info("Event bus initialized")

    yield  # Application runs here

    # Shutdown
    logger.info("Shutting down %s...", settings.APP_NAME)
    if app.state.redis:
        await app.state.redis.close()
        logger.info("Redis connection closed")


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------

def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title=settings.APP_NAME,
        description="Collaborative Steering Pipeline — AI-assisted project planning with human-in-the-loop governance.",
        version="1.0.0",
        lifespan=lifespan,
    )

    # CORS middleware — parse comma-separated origins or allow all with *
    cors_origins = (
        [o.strip() for o in settings.CORS_ORIGINS.split(",")]
        if settings.CORS_ORIGINS != "*"
        else ["*"]
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include REST router
    app.include_router(api_router, prefix="/api/v1")

    # Mount WebSocket endpoint
    @app.websocket("/ws/steering/{session_id}")
    async def steering_websocket(websocket: WebSocket, session_id: str):
        await websocket_steering(websocket, session_id)

    # Health check
    @app.get("/health")
    async def health_check():
        return {
            "status": "healthy",
            "app": settings.APP_NAME,
            "version": "1.0.0",
        }

    # Root endpoint
    @app.get("/")
    async def root():
        return {
            "app": settings.APP_NAME,
            "version": "1.0.0",
            "docs": "/docs",
        }

    # Exception handlers for PipelineError subclasses
    @app.exception_handler(InvalidStateTransitionError)
    async def invalid_transition_handler(request: Request, exc: InvalidStateTransitionError):
        return JSONResponse(
            status_code=409,
            content={
                "error": "invalid_state_transition",
                "from_state": exc.from_state,
                "to_state": exc.to_state,
                "message": str(exc),
            },
        )

    @app.exception_handler(PipelinePausedError)
    async def pipeline_paused_handler(request: Request, exc: PipelinePausedError):
        return JSONResponse(
            status_code=423,
            content={
                "error": "pipeline_paused",
                "message": str(exc),
                "options": ["steering_action", "restore_checkpoint", "abort"],
            },
        )

    @app.exception_handler(CompletenessGateError)
    async def completeness_gate_handler(request: Request, exc: CompletenessGateError):
        return JSONResponse(
            status_code=422,
            content={
                "error": "completeness_gate_blocked",
                "message": str(exc),
                "options": ["fill_missing_fields", "defer_fields", "override"],
            },
        )

    @app.exception_handler(BudgetExhaustedError)
    async def budget_exhausted_handler(request: Request, exc: BudgetExhaustedError):
        return JSONResponse(
            status_code=429,
            content={
                "error": "budget_exhausted",
                "message": str(exc),
                "escalation_options": exc.escalation_options,
            },
        )

    @app.exception_handler(PipelineError)
    async def pipeline_error_handler(request: Request, exc: PipelineError):
        return JSONResponse(
            status_code=500,
            content={
                "error": "pipeline_error",
                "message": str(exc),
            },
        )

    return app


# Global app instance for uvicorn
app = create_app()
