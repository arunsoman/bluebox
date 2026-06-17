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
