"""REST Controller -- all pipeline HTTP endpoints.

Implements every endpoint from Architecture Section 10.1.
All endpoints delegate to application services (no mock/stub data).
Uses FastAPI dependency injection for DB sessions.
"""
from __future__ import annotations

import json
from datetime import datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status, Query, Header
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

# DTOs
from interfaces.api.dto import (
    StartPipelineRequest,
    PipelineSessionDTO,
    SubmitInputRequest,
    SteeringActionDTO,
    RevisionRequestDTO,
    PropagationConsentDTO,
    CheckpointRestoreDTO,
    AuditQueryDTO,
    AuditTrailDTO,
    DecisionLedgerDTO,
    CheckpointListDTO,
    AuthorizationGrantDTO,
    RBACSteeringActionDTO,
)
from domain.models import (
    RichnessClassification,
    ImpactReport,
    InfrastructureProfile,
    TechStackProfile,
    RBACModel,
    SteeringOption,
)

# DB session
from infrastructure.persistence.postgresql.engine import get_session

# Auth middleware
from interfaces.middleware.auth_middleware import (
    require_auth,
    require_pipeline_user,
    require_pipeline_admin,
    require_pipeline_viewer,
)

# Application services
from application.pipeline_service import PipelineService
from application.input_processing_service import InputProcessingService
from application.advisory_service import AdvisoryService
from application.revision_service import RevisionService
from application.audit_service import AuditService
from application.notification_service import NotificationService

router = APIRouter(prefix="/pipeline")

# ---------------------------------------------------------------------------
# Service dependencies -- instantiated per-request so they can use injected DB
# ---------------------------------------------------------------------------

async def _get_pipeline_service() -> PipelineService:
    return PipelineService()

async def _get_input_service() -> InputProcessingService:
    return InputProcessingService()

async def _get_advisory_service() -> AdvisoryService:
    return AdvisoryService()

async def _get_revision_service() -> RevisionService:
    return RevisionService()

async def _get_audit_service() -> AuditService:
    return AuditService()

async def _get_notification_service() -> NotificationService:
    return NotificationService()


PipelineSvcDep = Annotated[PipelineService, Depends(_get_pipeline_service)]
InputSvcDep = Annotated[InputProcessingService, Depends(_get_input_service)]
AdvisorySvcDep = Annotated[AdvisoryService, Depends(_get_advisory_service)]
RevisionSvcDep = Annotated[RevisionService, Depends(_get_revision_service)]
AuditSvcDep = Annotated[AuditService, Depends(_get_audit_service)]
NotifySvcDep = Annotated[NotificationService, Depends(_get_notification_service)]


# ===================================================================
# Pipeline Lifecycle
# ===================================================================

@router.post("/start", response_model=PipelineSessionDTO)
async def start_pipeline(
    req: StartPipelineRequest,
    service: PipelineSvcDep,
) -> PipelineSessionDTO:
    """Start a new pipeline session.

    Args:
        req: StartPipelineRequest with user_id and optional project_name.

    Returns:
        PipelineSessionDTO for the newly created session.
    """
    try:
        return await service.start_pipeline(
            user_id=req.user_id,
            project_name=req.project_name,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start pipeline: {exc}",
        ) from exc


@router.post("/{id}/input", response_model=RichnessClassification)
async def submit_input(
    id: str,
    req: SubmitInputRequest,
    service: PipelineSvcDep,
) -> RichnessClassification:
    """Submit raw user input to a pipeline session.

    Args:
        id: Pipeline session ID.
        req: SubmitInputRequest with text and source.

    Returns:
        RichnessClassification indicating input mode.
    """
    try:
        return await service.submit_input(
            session_id=id,
            text=req.text,
            source=req.source,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process input: {exc}",
        ) from exc


@router.get("/{id}/state", response_model=PipelineSessionDTO)
async def get_pipeline_state(
    id: str,
    service: PipelineSvcDep,
) -> PipelineSessionDTO:
    """Get the current state of a pipeline session.

    Args:
        id: Pipeline session ID.

    Returns:
        PipelineSessionDTO with current session state.
    """
    try:
        return await service.get_state(id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get state: {exc}",
        ) from exc


@router.post("/{id}/steer")
async def steer(
    id: str,
    action: SteeringActionDTO,
    service: PipelineSvcDep,
) -> dict[str, Any]:
    """Submit a steering action for a pipeline session.

    Args:
        id: Pipeline session ID.
        action: SteeringActionDTO with action type and payload.

    Returns:
        Action result dict.
    """
    try:
        return await service.handle_steering_action(id, action)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Steering action failed: {exc}",
        ) from exc


@router.post("/{id}/revise", response_model=ImpactReport)
async def revise(
    id: str,
    req: RevisionRequestDTO,
    revision_svc: RevisionSvcDep,
) -> ImpactReport:
    """Initiate a revision request for a past decision.

    Args:
        id: Pipeline session ID.
        req: RevisionRequestDTO with original_decision_id and new_choice.

    Returns:
        ImpactReport describing downstream effects.
    """
    try:
        if req.new_choice is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="new_choice is required for revision",
            )
        return await revision_svc.initiate_revision(
            session_id=id,
            decision_id=req.original_decision_id,
            new_choice=req.new_choice,
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Revision initiation failed: {exc}",
        ) from exc


@router.post("/{id}/propagate")
async def propagate(
    id: str,
    req: PropagationConsentDTO,
    revision_svc: RevisionSvcDep,
) -> dict[str, Any]:
    """Confirm or cancel propagation of a revision.

    Args:
        id: Pipeline session ID.
        req: PropagationConsentDTO with confirmation.

    Returns:
        Propagation result dict.
    """
    try:
        if req.user_confirmed:
            return await revision_svc.confirm_propagation(id, req.impact_report_id)
        else:
            return await revision_svc.cancel_propagation(id, req.impact_report_id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Propagation handling failed: {exc}",
        ) from exc


@router.post("/{id}/checkpoint/restore", response_model=PipelineSessionDTO)
async def restore_checkpoint(
    id: str,
    req: CheckpointRestoreDTO,
    service: PipelineSvcDep,
) -> PipelineSessionDTO:
    """Restore a pipeline session from a checkpoint.

    Args:
        id: Pipeline session ID.
        req: CheckpointRestoreDTO with checkpoint_id.

    Returns:
        Updated PipelineSessionDTO after restore.
    """
    from domain.state_management.checkpoint_manager import CheckpointManager

    try:
        checkpoint_mgr = CheckpointManager()
        await checkpoint_mgr.restore_checkpoint(id, req.checkpoint_id)
        return await service.get_state(id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Checkpoint restore failed: {exc}",
        ) from exc


@router.get("/{id}/checkpoints", response_model=CheckpointListDTO)
async def list_checkpoints(
    id: str,
) -> CheckpointListDTO:
    """List all checkpoints for a pipeline session.

    Args:
        id: Pipeline session ID.

    Returns:
        CheckpointListDTO with all checkpoints.
    """
    from domain.state_management.checkpoint_manager import CheckpointManager

    try:
        checkpoint_mgr = CheckpointManager()
        return await checkpoint_mgr.list_checkpoints(id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list checkpoints: {exc}",
        ) from exc


# ===================================================================
# Decision Ledger
# ===================================================================

@router.get("/{id}/decisions", response_model=DecisionLedgerDTO)
async def get_decisions(
    id: str,
    audit_svc: AuditSvcDep,
) -> DecisionLedgerDTO:
    """Get the decision ledger for a pipeline session.

    Args:
        id: Pipeline session ID.

    Returns:
        DecisionLedgerDTO with all decision entries.
    """
    try:
        from domain.decision_management.decision_ledger import DecisionLedgerService
        ledger_svc = DecisionLedgerService()
        return await ledger_svc.get_entries(id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get decisions: {exc}",
        ) from exc


@router.get("/{id}/decisions/export")
async def export_decisions(
    id: str,
    audit_svc: AuditSvcDep,
    format: str = Query(default="json", description="Export format: json or csv_meta"),
) -> StreamingResponse:
    """Export the decision ledger.

    Args:
        id: Pipeline session ID.
        format: Export format ("json" or "csv_meta").

    Returns:
        StreamingResponse with the exported data.
    """
    try:
        data = await audit_svc.export_decisions(id, format)
        media_type = "application/json" if format == "json" else "text/plain"
        return StreamingResponse(
            iter([data]),
            media_type=media_type,
            headers={
                "Content-Disposition": f'attachment; filename="decisions-{id}.{format}"',
            },
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Export failed: {exc}",
        ) from exc


# ===================================================================
# Audit Trail
# ===================================================================

async def _audit_query_params(
    action_type: str | None = Query(None),
    actor_id: str | None = Query(None),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
) -> AuditQueryDTO:
    from domain.models import AuditActionType
    action_enum = None
    if action_type:
        try:
            action_enum = AuditActionType(action_type)
        except ValueError:
            pass
    return AuditQueryDTO(
        action_type=action_enum,
        actor_id=actor_id,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
    )


@router.get("/{id}/audit", response_model=AuditTrailDTO)
async def query_audit(
    id: str,
    audit_svc: AuditSvcDep,
    query: AuditQueryDTO = Depends(_audit_query_params),
) -> AuditTrailDTO:
    """Query the audit trail for a pipeline session.

    Args:
        id: Pipeline session ID.
        query: Optional AuditQueryDTO filters.

    Returns:
        AuditTrailDTO with matching events.
    """
    try:
        return await audit_svc.query_audit(id, query)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Audit query failed: {exc}",
        ) from exc


@router.get("/{id}/audit/export")
async def export_audit(
    id: str,
    audit_svc: AuditSvcDep,
    format: str = Query(default="json", description="Export format: json or markdown"),
) -> StreamingResponse:
    """Export the audit trail.

    Args:
        id: Pipeline session ID.
        format: Export format ("json" or "markdown").

    Returns:
        StreamingResponse with the exported data.
    """
    try:
        data = await audit_svc.export_audit(id, format)
        media_type = "application/json" if format == "json" else "text/markdown"
        ext = "json" if format == "json" else "md"
        return StreamingResponse(
            iter([data]),
            media_type=media_type,
            headers={
                "Content-Disposition": f'attachment; filename="audit-{id}.{ext}"',
            },
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Audit export failed: {exc}",
        ) from exc


# ===================================================================
# RBAC
# ===================================================================

@router.get("/{id}/rbac", response_model=RBACModel)
async def get_rbac(
    id: str,
    advisory_svc: AdvisorySvcDep,
) -> RBACModel:
    """Get the RBAC model for a pipeline session.

    Args:
        id: Pipeline session ID.

    Returns:
        RBACModel with roles, permissions, and data access.
    """
    from domain.state_management.pipeline_state import PipelineStateManager

    try:
        state_mgr = PipelineStateManager()
        state = await state_mgr.get_state(id)
        rbac_data = state.get("rbac_model")

        if not rbac_data:
            # Run the RBAC advisor to generate a model
            await advisory_svc.run_rbac_advisor(id)
            state = await state_mgr.get_state(id)
            rbac_data = state.get("rbac_model")

        if not rbac_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No RBAC model found and could not generate one",
            )

        return RBACModel(**rbac_data)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get RBAC model: {exc}",
        ) from exc


@router.get("/{id}/rbac/export")
async def export_rbac(
    id: str,
    audit_svc: AuditSvcDep,
) -> StreamingResponse:
    """Export the RBAC model.

    Args:
        id: Pipeline session ID.

    Returns:
        StreamingResponse with the JSON-exported RBAC model.
    """
    try:
        data = await audit_svc.export_rbac(id)
        return StreamingResponse(
            iter([data]),
            media_type="application/json",
            headers={
                "Content-Disposition": f'attachment; filename="rbac-{id}.json"',
            },
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"RBAC export failed: {exc}",
        ) from exc


# ===================================================================
# Infrastructure & Tech Stack
# ===================================================================

@router.get("/{id}/infrastructure", response_model=InfrastructureProfile)
async def get_infrastructure(
    id: str,
) -> InfrastructureProfile:
    """Get the infrastructure profile for a pipeline session.

    Args:
        id: Pipeline session ID.

    Returns:
        InfrastructureProfile with hosting and cost details.
    """
    from domain.state_management.pipeline_state import PipelineStateManager

    try:
        state_mgr = PipelineStateManager()
        state = await state_mgr.get_state(id)
        profile_data = state.get("infrastructure_profile")

        if not profile_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No infrastructure profile found for this session",
            )

        return InfrastructureProfile(**profile_data)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get infrastructure profile: {exc}",
        ) from exc


@router.get("/{id}/techstack", response_model=TechStackProfile)
async def get_tech_stack(
    id: str,
) -> TechStackProfile:
    """Get the tech stack profile for a pipeline session.

    Args:
        id: Pipeline session ID.

    Returns:
        TechStackProfile with selected technologies.
    """
    from domain.state_management.pipeline_state import PipelineStateManager

    try:
        state_mgr = PipelineStateManager()
        state = await state_mgr.get_state(id)
        profile_data = state.get("tech_stack_profile")

        if not profile_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No tech stack profile found for this session",
            )

        return TechStackProfile(**profile_data)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get tech stack profile: {exc}",
        ) from exc


# ===================================================================
# Authorization & Session
# ===================================================================

@router.post("/{id}/authorize")
async def authorize(
    id: str,
    req: AuthorizationGrantDTO,
    service: PipelineSvcDep,
) -> dict[str, Any]:
    """Grant authorization scope for a pipeline session.

    Args:
        id: Pipeline session ID.
        req: AuthorizationGrantDTO with scope type and optional stage range.

    Returns:
        Authorization confirmation dict.
    """
    try:
        return await service.authorize(id, req)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Authorization failed: {exc}",
        ) from exc


@router.post("/{id}/save-and-exit")
async def save_and_exit(
    id: str,
    service: PipelineSvcDep,
) -> dict[str, Any]:
    """Save the session state and suspend (save-and-exit).

    Args:
        id: Pipeline session ID.

    Returns:
        Dict with suspend confirmation.
    """
    try:
        return await service.save_and_exit(id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Save and exit failed: {exc}",
        ) from exc


@router.post("/{id}/resume", response_model=PipelineSessionDTO)
async def resume_session(
    id: str,
    service: PipelineSvcDep,
) -> PipelineSessionDTO:
    """Resume a previously suspended pipeline session.

    Args:
        id: Pipeline session ID.

    Returns:
        Updated PipelineSessionDTO.
    """
    try:
        return await service.resume_session(id)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Resume failed: {exc}",
        ) from exc


@router.get("", response_model=list[PipelineSessionDTO])
async def list_pipelines(
    service: PipelineSvcDep,
    user_id: str = Query(..., description="User ID to filter sessions"),
) -> list[PipelineSessionDTO]:
    """List all pipeline sessions for a user.

    Args:
        user_id: The user ID.

    Returns:
        List of PipelineSessionDTOs, newest first.
    """
    try:
        return await service.list_sessions(user_id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list sessions: {exc}",
        ) from exc


# ===================================================================
# Blueprint Export
# ===================================================================

@router.get("/{id}/blueprint/export")
async def export_blueprint(
    id: str,
    audit_svc: AuditSvcDep,
) -> StreamingResponse:
    """Export the full project blueprint.

    Args:
        id: Pipeline session ID.

    Returns:
        StreamingResponse with the JSON blueprint.
    """
    try:
        data = await audit_svc.export_blueprint(id)
        return StreamingResponse(
            iter([data]),
            media_type="application/json",
            headers={
                "Content-Disposition": f'attachment; filename="blueprint-{id}.json"',
            },
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Blueprint export failed: {exc}",
        ) from exc


# ===================================================================
# Admin Router (separate -- registered in main.py)
# ===================================================================

admin_router = APIRouter(prefix="/admin")


@admin_router.get("/pipeline/{id}/force-export")
async def force_export(
    id: str,
    audit_svc: AuditSvcDep,
) -> StreamingResponse:
    """Force-export a pipeline blueprint (admin only).

    Bypasses normal checks and exports the current state.

    Args:
        id: Pipeline session ID.

    Returns:
        StreamingResponse with the JSON blueprint.
    """
    try:
        data = await audit_svc.export_blueprint(id)
        return StreamingResponse(
            iter([data]),
            media_type="application/json",
            headers={
                "Content-Disposition": f'attachment; filename="blueprint-{id}-forced.json"',
            },
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Force export failed: {exc}",
        ) from exc
