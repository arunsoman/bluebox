#!/usr/bin/env python3
"""Minimal backend runner for Bluebox — works with SQLite, no Docker needed."""

import asyncio
import logging
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

# Load .env before anything else
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env")
except ImportError:
    pass  # dotenv not installed — env vars must be set manually

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)
logger = logging.getLogger("bluebox")


async def init_db():
    """Initialize SQLite database."""
    try:
        from sqlalchemy.ext.asyncio import create_async_engine
        from app.db.base import Base

        engine = create_async_engine("sqlite+aiosqlite:///./pipeline.db")
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        await engine.dispose()
        logger.info("Database initialized (SQLite)")
    except Exception as e:
        logger.warning(f"DB init skipped (tables will be created on first use): {e}")


def create_minimal_app():
    """Create a minimal FastAPI app with just the endpoints we need."""
    from fastapi import FastAPI, WebSocket
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import JSONResponse
    from uuid import uuid4
    from datetime import datetime

    app = FastAPI(
        title="Bluebox — Collaborative Steering Pipeline",
        description="Stateful, human-in-the-loop AI pipeline",
        version="1.0.0",
    )

    # CORS — allow frontend origin + localhost
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:8000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Import provider management and pipeline
    from app.llm.providers import (
        get_available_providers,
        get_active_models,
        set_provider_key,
        get_model_config,
    )
    from app.pipeline.executor import (
        create_executor,
        get_executor,
        remove_executor,
        PipelineEvent,
    )

    # ─── Health ───
    @app.get("/health")
    async def health():
        return {"status": "healthy", "app": "Bluebox", "version": "1.0.0"}

    @app.get("/")
    async def root():
        return {"app": "Bluebox", "version": "1.0.0", "docs": "/docs"}

    # ─── Sessions ───
    sessions = {}

    @app.post("/api/v1/session")
    async def create_session(body: dict = None):
        sid = str(uuid4())
        pid = str(uuid4())
        sessions[sid] = {
            "session_id": sid,
            "project_id": pid,
            "state": "initialized",
            "current_stage": 0,
            "created_at": datetime.utcnow().isoformat(),
            "prd_text": (body or {}).get("prd_text", ""),
            "model_id": (body or {}).get("model_id", ""),
        }
        logger.info(f"Session created: {sid}")
        return {"session_id": sid, "project_id": pid, "status": "created"}

    @app.get("/api/v1/session/{session_id}/state")
    async def get_session_state(session_id: str):
        s = sessions.get(session_id, {})
        return {
            "session_id": session_id,
            "state": s.get("state", "unknown"),
            "current_stage": s.get("current_stage", 0),
            "project_id": s.get("project_id", ""),
        }

    @app.post("/api/v1/session/{session_id}/abort")
    async def abort_session(session_id: str):
        if session_id in sessions:
            sessions[session_id]["state"] = "aborted"
        return {"session_id": session_id, "aborted": True}

    # ─── Blueprint ───
    blueprints = {}

    @app.get("/api/v1/blueprint/{project_id}")
    async def get_blueprint(project_id: str):
        if project_id not in blueprints:
            # Return empty blueprint
            return {
                "project_id": project_id,
                "project_name": "",
                "problem_statement": "",
                "actors": [],
                "capabilities": [],
                "use_cases": [],
                "user_stories": [],
                "task_decomposition": [],
                "tech_stack_profile": None,
                "infrastructure_profile": None,
                "rbac_model": None,
                "completeness_status": "incomplete",
                "version": 1,
            }
        return blueprints[project_id]

    @app.get("/api/v1/blueprint/{project_id}/completeness")
    async def get_completeness(project_id: str):
        bp = blueprints.get(project_id, {})
        return {
            "project_id": project_id,
            "is_complete": bp.get("completeness_status") == "complete",
            "filled_fields": 0,
            "total_fields": 7,
            "missing_mandatory": [],
        }

    # ─── Ledger ───
    ledgers = {}

    @app.get("/api/v1/ledger/{project_id}")
    async def get_ledger(project_id: str):
        return ledgers.get(project_id, {
            "project_id": project_id,
            "entries": [],
            "revision_count": 0,
            "budget_remaining": 5,
        })

    # ─── Audit ───
    @app.get("/api/v1/audit/{project_id}")
    async def get_audit(project_id: str):
        return {"project_id": project_id, "events": []}

    # ─── Checkpoints ───
    @app.get("/api/v1/checkpoint/{project_id}")
    async def list_checkpoints(project_id: str):
        return {"project_id": project_id, "checkpoints": []}

    @app.post("/api/v1/checkpoint/restore/{project_id}")
    async def restore_checkpoint(project_id: str, body: dict = None):
        return {"project_id": project_id, "restored": True}

    # ─── LLM Providers & Models ───
    @app.get("/api/v1/providers")
    async def list_providers():
        return {"providers": get_available_providers()}

    @app.get("/api/v1/models")
    async def list_active_models():
        return {"models": get_active_models()}

    @app.post("/api/v1/providers/{provider_name}/key")
    async def set_key(provider_name: str, body: dict = None):
        api_key = (body or {}).get("api_key", "")
        success = set_provider_key(provider_name, api_key)
        if not success:
            return JSONResponse(
                status_code=400,
                content={"error": f"Invalid provider '{provider_name}' or empty key"},
            )
        logger.info(f"API key set for provider: {provider_name}")
        return {"provider": provider_name, "key_set": True}

    @app.get("/api/v1/models/{model_id}/config")
    async def get_model_configuration(model_id: str):
        config = get_model_config(model_id)
        if not config:
            return JSONResponse(status_code=404, content={"error": f"Model '{model_id}' not found"})
        return config

    # ─── Nodes ───
    # In-memory node storage
    nodes_store = {
        "actors": [
            {"id": "actor-1", "type": "actor", "name": "End Customer", "description": "The primary end user of the application who browses products and places orders.", "actor_type": "human", "state": "system_generated"},
            {"id": "actor-2", "type": "actor", "name": "System Administrator", "description": "Manages the e-commerce platform, monitors performance, and configures settings.", "actor_type": "human", "state": "system_generated"},
            {"id": "actor-3", "type": "actor", "name": "Payment Gateway API", "description": "External payment processing service that handles credit card and digital wallet transactions.", "actor_type": "external", "state": "system_generated"},
            {"id": "actor-4", "type": "actor", "name": "Inventory System", "description": "Automated system that tracks stock levels and updates product availability.", "actor_type": "system", "state": "system_generated"},
            {"id": "actor-5", "type": "actor", "name": "Shipping Carrier API", "description": "External logistics service that calculates shipping rates and tracks deliveries.", "actor_type": "external", "state": "system_generated"},
        ],
        "capabilities": [
            {"id": "cap-1", "type": "capability", "name": "User Authentication", "description": "Handles login, registration, password reset, and session management.", "state": "system_generated"},
            {"id": "cap-2", "type": "capability", "name": "Product Catalog", "description": "Manages product listings, categories, search, and filtering.", "state": "system_generated"},
            {"id": "cap-3", "type": "capability", "name": "Shopping Cart", "description": "Allows adding, removing, and modifying items before checkout.", "state": "system_generated"},
            {"id": "cap-4", "type": "capability", "name": "Order Processing", "description": "Handles the full order lifecycle from placement to fulfillment.", "state": "system_generated"},
            {"id": "cap-5", "type": "capability", "name": "Payment Processing", "description": "Integrates with payment gateways for secure transaction handling.", "state": "system_generated"},
        ],
        "use_cases": [
            {"id": "uc-1", "type": "use_case", "name": "User Login Flow", "description": "End-to-end authentication flow including MFA and password recovery.", "state": "system_generated"},
            {"id": "uc-2", "type": "use_case", "name": "Guest Checkout", "description": "Allows users to purchase without creating an account.", "state": "system_generated"},
            {"id": "uc-3", "type": "use_case", "name": "Product Search & Filter", "description": "Full-text search with faceted filtering by category, price, and rating.", "state": "system_generated"},
            {"id": "uc-4", "type": "use_case", "name": "Order Tracking", "description": "Real-time shipment tracking with notifications.", "state": "system_generated"},
        ],
        "user_stories": [
            {"id": "us-1", "type": "user_story", "name": "Login with email/password", "description": "As a customer, I want to log in with my email and password so I can access my account.", "points": 3, "state": "system_generated"},
            {"id": "us-2", "type": "user_story", "name": "Multi-factor authentication", "description": "As a customer, I want MFA so my account is more secure.", "points": 5, "state": "system_generated"},
            {"id": "us-3", "type": "user_story", "name": "Password reset via email", "description": "As a customer, I want to reset my password via email link.", "points": 3, "state": "system_generated"},
            {"id": "us-4", "type": "user_story", "name": "Credit card payment", "description": "As a customer, I want to pay with my credit card securely.", "points": 8, "state": "system_generated"},
            {"id": "us-5", "type": "user_story", "name": "Full-text product search", "description": "As a customer, I want to search products by keywords.", "points": 5, "state": "system_generated"},
            {"id": "us-6", "type": "user_story", "name": "Shipment tracking", "description": "As a customer, I want to track my order delivery status.", "points": 3, "state": "system_generated"},
        ],
    }

    @app.get("/api/v1/nodes")
    async def list_nodes(
        node_type: str = None,
        search: str = None,
        limit: int = 100,
        offset: int = 0,
    ):
        all_nodes = []
        if node_type:
            all_nodes = nodes_store.get(node_type, [])
        else:
            all_nodes = [n for nodes in nodes_store.values() for n in nodes]

        if search:
            search_lower = search.lower()
            all_nodes = [
                n for n in all_nodes
                if search_lower in n.get("name", "").lower()
                or search_lower in n.get("description", "").lower()
            ]

        total = len(all_nodes)
        paginated = all_nodes[offset:offset + limit]

        return {
            "nodes": paginated,
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    # ─── WebSocket — Debug ping ───
    @app.websocket("/ws/ping")
    async def ping_ws(websocket: WebSocket):
        await websocket.accept()
        await websocket.send_json({"pong": True})
        await websocket.close()

    # ─── WebSocket — Real-time Pipeline Streaming ───
    @app.websocket("/ws/steering/{session_id}")
    async def steering_websocket(websocket: WebSocket, session_id: str):
        await websocket.accept()
        logger.info(f"WebSocket connected for session: {session_id}")

        try:
            # Get session data
            session = sessions.get(session_id, {})
            prd_text = session.get("prd_text", "")

            if not prd_text:
                await websocket.send_json({
                    "event": "ERROR",
                    "data": {"message": "No PRD found for this session. Submit a PRD first."},
                })
                return

            # Send ready signal
            await websocket.send_json({
                "event": "STEERING_PANEL_READY",
                "data": {"stage_id": 0, "status": "initialized", "has_prd": True},
            })

            # Wait for START command from client
            start_received = False
            try:
                msg = await asyncio.wait_for(websocket.receive_json(), timeout=30.0)
                if msg.get("event") == "START_PIPELINE":
                    start_received = True
            except asyncio.TimeoutError:
                await websocket.send_json({
                    "event": "ERROR",
                    "data": {"message": "Timeout waiting for START command"},
                })
                return

            if not start_received:
                return

            # Create pipeline executor
            pid = session.get("project_id", str(uuid4()))
            model_id = session.get("model_id", "") or None
            executor = create_executor(session_id, pid, prd_text, model_id=model_id)

            # Update session state
            session["state"] = "running"
            session["current_stage"] = 0

            # Stream pipeline events
            async for event in executor.run():
                # Convert PipelineEvent to WebSocket message
                ws_msg = {
                    "event": event.event_type,
                    "stage_id": event.stage_id,
                    "data": event.data,
                }

                if event.event_type == "stage_start":
                    ws_msg["event"] = "CHUNK_STREAM"
                    ws_msg["data"] = {
                        "type": "stage_start",
                        "message": event.data.get("message", ""),
                        "stage_id": event.stage_id,
                    }

                elif event.event_type == "stage_chunk":
                    ws_msg["event"] = "CHUNK_STREAM"
                    ws_msg["data"] = {
                        "type": "chunk",
                        **event.data,
                    }

                elif event.event_type == "stage_complete":
                    ws_msg["event"] = "STEERING_PANEL_READY"
                    ws_msg["data"] = {
                        "type": "stage_complete",
                        "stage_id": event.stage_id,
                        **event.data,
                    }
                    # Update session
                    session["current_stage"] = event.stage_id + 1

                elif event.event_type == "steering_required":
                    ws_msg["event"] = "STEERING_REQUIRED"
                    ws_msg["data"] = event.data
                    session["state"] = "awaiting_steering"

                elif event.event_type == "error":
                    ws_msg["event"] = "ERROR"
                    ws_msg["data"] = event.data
                    session["state"] = "failed"

                await websocket.send_json(ws_msg)

            # Pipeline complete
            session["state"] = "completed"
            blueprint = executor.to_blueprint_dict()
            if blueprint:
                blueprints[pid] = blueprint
                logger.info(f"Blueprint stored for project {pid}")

            await websocket.send_json({
                "event": "STEERING_PANEL_READY",
                "data": {
                    "type": "pipeline_complete",
                    "message": "Pipeline complete — Blueprint assembled",
                    "project_id": pid,
                    "blueprint": blueprint,
                },
            })

        except Exception as e:
            logger.error(f"WebSocket error for {session_id}: {e}")
            try:
                await websocket.send_json({
                    "event": "ERROR",
                    "data": {"message": str(e)},
                })
            except Exception:
                pass
        finally:
            logger.info(f"WebSocket closed for session: {session_id}")
            # Clean up executor after a delay
            await asyncio.sleep(60)
            remove_executor(session_id)

    logger.info("FastAPI app created with all endpoints")
    return app


if __name__ == "__main__":
    import uvicorn

    logger.info("=" * 50)
    logger.info("Bluebox Backend Starting")
    logger.info("=" * 50)

    # Initialize DB
    asyncio.run(init_db())

    # Create app
    app = create_minimal_app()

    # Start server
    logger.info("Starting uvicorn on 0.0.0.0:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
