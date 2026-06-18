"""AuditService -- application-level service for audit trail operations.

Coordinates between the domain-level audit trail, export services, and
the REST controllers. Provides a unified interface for querying and
exporting audit data.
"""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from domain.models import (
    AuditTrailDTO,
    AuditQueryDTO,
    DecisionLedgerDTO,
    RBACModel,
)
from domain.audit.audit_trail import AuditTrail
from domain.audit.audit_query_service import AuditQueryService
from domain.audit.audit_export_service import AuditExportService
from domain.decision_management.decision_ledger import DecisionLedgerService


class AuditService:
    """Application service for audit trail operations."""

    def __init__(
        self,
        audit_trail: AuditTrail | None = None,
        query_service: AuditQueryService | None = None,
        export_service: AuditExportService | None = None,
        ledger_service: DecisionLedgerService | None = None,
    ):
        self._audit = audit_trail or AuditTrail()
        self._query = query_service or AuditQueryService(self._audit)
        self._export = export_service or AuditExportService(self._audit)
        self._ledger = ledger_service or DecisionLedgerService()

    # ------------------------------------------------------------------ #
    # Audit Trail Queries
    # ------------------------------------------------------------------ #

    async def query_audit(self, session_id: str, query: AuditQueryDTO) -> AuditTrailDTO:
        """Query audit events for a session with filters.

        Args:
            session_id: Pipeline session ID.
            query: AuditQueryDTO with optional filters.

        Returns:
            AuditTrailDTO with matching events.
        """
        return await self._audit.query_events(session_id, query)

    # ------------------------------------------------------------------ #
    # Exports
    # ------------------------------------------------------------------ #

    async def export_audit(self, session_id: str, format: str) -> bytes:
        """Export audit trail in the requested format.

        Args:
            session_id: Pipeline session ID.
            format: Export format -- "json" or "markdown".

        Returns:
            Raw bytes of the exported content.
        """
        if format == "json":
            data = await self._export.export_json(session_id)
            return json.dumps(data, indent=2, default=str).encode("utf-8")

        if format == "markdown":
            md = await self._export.export_markdown(session_id)
            return md.encode("utf-8")

        raise ValueError(f"Unsupported audit export format: {format}")

    async def export_decisions(self, session_id: str, format: str) -> bytes:
        """Export decision ledger in the requested format.

        Args:
            session_id: Pipeline session ID.
            format: Export format -- "json" or "csv_meta".

        Returns:
            Raw bytes of the exported content.
        """
        data = await self._ledger.export_ledger(session_id, format)
        return json.dumps(data, indent=2, default=str).encode("utf-8")

    async def export_rbac(self, session_id: str) -> bytes:
        """Export RBAC model derived from audit events.

        Args:
            session_id: Pipeline session ID.

        Returns:
            Raw bytes of the JSON-exported RBAC model.
        """
        data = await self._export.export_rbac_model(session_id)
        return json.dumps(data, indent=2, default=str).encode("utf-8")

    async def export_blueprint(self, session_id: str) -> bytes:
        """Export the full project blueprint.

        Combines the decision ledger, RBAC model, infrastructure profile,
        and tech stack profile into a single blueprint export.

        Args:
            session_id: Pipeline session ID.

        Returns:
            Raw bytes of the JSON-exported blueprint.
        """
        from domain.state_management.pipeline_state import PipelineStateManager

        state_mgr = PipelineStateManager()

        # Gather all components
        session = await state_mgr.get_session(session_id)
        state = await state_mgr.get_state(session_id)
        decisions = await self._ledger.get_entries(session_id)

        audit_data = await self._export.export_json(session_id)

        blueprint = {
            "export_format": "blueprint",
            "session_id": session_id,
            "project_id": session.project_id,
            "exported_at": datetime.utcnow().isoformat(),
            "session": session.model_dump(mode="json"),
            "state_summary": {
                k: v for k, v in state.items()
                if isinstance(v, (str, int, float, bool, list))
            },
            "decision_ledger": {
                "entries": [e.model_dump(mode="json") for e in decisions.entries],
                "total_user_decisions": decisions.total_user_decisions,
                "total_system_decisions": decisions.total_system_decisions,
            },
            "audit_trail": audit_data,
            "components": {
                "infrastructure_profile": state.get("infrastructure_profile"),
                "tech_stack_profile": state.get("tech_stack_profile"),
                "rbac_model": state.get("rbac_model"),
                "project_seed": state.get("project_seed"),
            },
        }

        return json.dumps(blueprint, indent=2, default=str).encode("utf-8")
