"""REST API endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db

router = APIRouter()


@router.get("/blueprint/{project_id}")
async def get_blueprint(project_id: str):
    """Export ProjectBlueprint."""
    return {"project_id": project_id, "status": "not_implemented"}


@router.get("/blueprint/{project_id}/completeness")
async def get_completeness(project_id: str):
    """Check Stage 7 gate completeness."""
    return {"project_id": project_id, "completeness_status": "not_implemented"}


@router.get("/ledger/{project_id}")
async def get_ledger(project_id: str):
    """Fetch DecisionLedger."""
    return {"project_id": project_id, "entries": []}


@router.get("/ledger/{project_id}/entry/{entry_id}")
async def get_ledger_entry(project_id: str, entry_id: str):
    """Fetch specific decision entry."""
    return {"project_id": project_id, "entry_id": entry_id}


@router.get("/audit/{project_id}")
async def get_audit(project_id: str):
    """Export audit events."""
    return {"project_id": project_id, "events": []}


@router.post("/session")
async def create_session():
    """Create new pipeline session."""
    from uuid import uuid4
    session_id = str(uuid4())
    return {"session_id": session_id, "status": "created"}


@router.get("/session/{session_id}/state")
async def get_session_state(session_id: str):
    """Get state machine status."""
    return {"session_id": session_id, "state": "initialized"}


@router.post("/checkpoint/restore/{project_id}")
async def restore_checkpoint(project_id: str, checkpoint_id: str):
    """Restore checkpoint."""
    return {"project_id": project_id, "checkpoint_id": checkpoint_id, "restored": True}


@router.get("/checkpoint/{project_id}")
async def list_checkpoints(project_id: str):
    """List checkpoints."""
    return {"project_id": project_id, "checkpoints": []}


@router.post("/session/{session_id}/abort")
async def abort_session(session_id: str):
    """Abort session."""
    return {"session_id": session_id, "aborted": True}


# ─── LLM Providers & Models ───

@router.get("/providers")
async def list_providers():
    """List all LLM providers with their models and key status."""
    from app.llm.providers import get_available_providers
    return {"providers": get_available_providers()}


@router.get("/models")
async def list_active_models():
    """List models from providers that have keys configured."""
    from app.llm.providers import get_active_models
    return {"models": get_active_models()}


@router.post("/providers/{provider_name}/key")
async def set_provider_key(provider_name: str, body: dict):
    """Set API key for a provider at runtime."""
    from app.llm.providers import set_provider_key as _set_key
    api_key = body.get("api_key", "")
    success = _set_key(provider_name, api_key)
    if not success:
        raise HTTPException(status_code=400, detail=f"Invalid provider '{provider_name}' or empty key")
    return {"provider": provider_name, "key_set": True}


@router.get("/models/{model_id}/config")
async def get_model_configuration(model_id: str):
    """Get configuration for a specific model."""
    from app.llm.providers import get_model_config
    config = get_model_config(model_id)
    if not config:
        raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found")
    return config


@router.get("/nodes")
async def list_nodes(
    node_type: str | None = None,
    search: str | None = None,
    limit: int = 100,
    offset: int = 0,
):
    """List pipeline nodes (actors, capabilities, use_cases, stories, tasks).

    Query params:
        node_type: Filter by type (actor, capability, use_case, story, task)
        search: Search in name/description
        limit: Max results (default 100)
        offset: Pagination offset (default 0)
    """
    # Return empty list — backend implementation would query DB
    # This is the contract the frontend expects
    return {
        "nodes": [],
        "total": 0,
        "limit": limit,
        "offset": offset,
        "node_type": node_type,
    }
