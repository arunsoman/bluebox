"""AuditExportService — export audit trails in multiple formats.

Supports:
  * JSON   — structured export for programmatic consumption
  * Markdown — human-readable, grouped by stage
  * RBAC Model — extract RBAC-related events as a model snapshot
  * Decision Ledger — extract decision events as a ledger
"""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from domain.models import (
    AuditActionType,
    AuditTrailDTO,
    AuditEvent,
    DecisionEntry,
    DecisionLedger,
    DecisionStatus,
    DecisionMaker,
    SteeringOption,
    AuthorizationScope,
    RBACModel,
    Role,
    Permission,
    RolePermissionEntry,
    DataAccessEntry,
    RoleInheritance,
    AuditActorType,
)
from domain.audit.audit_trail import AuditTrail


class AuditExportService:
    """Export audit data in multiple formats for compliance and analysis."""

    def __init__(self, audit_trail: AuditTrail | None = None):
        self._audit = audit_trail or AuditTrail()

    # ------------------------------------------------------------------ #
    # JSON export
    # ------------------------------------------------------------------ #

    async def export_json(self, session_id: str) -> dict[str, Any]:
        """Export all audit events for a session as structured JSON.

        Args:
            session_id: Pipeline session ID.

        Returns:
            Dict with metadata and a list of event dicts.
        """
        dto = await self._audit.query_events(
            session_id,
            self._default_query(),
        )

        return {
            "export_format": "json",
            "session_id": session_id,
            "exported_at": datetime.utcnow().isoformat(),
            "total_events": dto.total,
            "events": [e.model_dump(mode="json") for e in dto.events],
        }

    # ------------------------------------------------------------------ #
    # Markdown export
    # ------------------------------------------------------------------ #

    async def export_markdown(self, session_id: str) -> str:
        """Export audit events as a human-readable Markdown document.

        Events are grouped by pipeline stage and formatted as a timeline.

        Args:
            session_id: Pipeline session ID.

        Returns:
            Markdown-formatted string.
        """
        dto = await self._audit.query_events(
            session_id,
            self._default_query(page_size=1000),
        )

        lines: list[str] = [
            f"# Audit Trail — Session {session_id}",
            "",
            f"**Exported:** {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC",
            f"**Total Events:** {dto.total}",
            "",
            "---",
            "",
        ]

        # Group events by inferred stage
        by_stage: dict[str, list[AuditEvent]] = {}
        for event in dto.events:
            stage = self._infer_stage_from_event(event)
            by_stage.setdefault(stage, []).append(event)

        for stage in sorted(by_stage.keys()):
            events = by_stage[stage]
            lines.append(f"## {stage}")
            lines.append("")

            for event in events:
                ts = event.timestamp.strftime("%H:%M:%S")
                actor = event.actor.actor_type.value
                if event.actor.user_id:
                    actor += f" ({event.actor.user_id[:8]})"
                action = event.action.value

                lines.append(f"### {ts} — {action}")
                lines.append(f"- **Actor:** {actor}")
                if event.target:
                    lines.append(
                        f"- **Target:** {event.target.target_type} "
                        f"`{event.target.target_id}`"
                    )
                if event.before_state:
                    lines.append(f"- **Before:** {json.dumps(event.before_state, indent=2)}")
                if event.after_state:
                    lines.append(f"- **After:** {json.dumps(event.after_state, indent=2)}")
                if event.authorization_ref:
                    lines.append(f"- **Authorization:** {event.authorization_ref}")
                lines.append("")

        lines.append("---")
        lines.append(f"*End of audit trail for session {session_id}*")

        return "\n".join(lines)

    # ------------------------------------------------------------------ #
    # RBAC model export
    # ------------------------------------------------------------------ #

    async def export_rbac_model(self, session_id: str) -> dict[str, Any]:
        """Extract RBAC-related audit events and construct an RBACModel snapshot.

        Args:
            session_id: Pipeline session ID.

        Returns:
            Dict representing the RBAC model derived from audit events.
        """
        # Query RBAC-related events
        rbac_actions = [
            AuditActionType.ROLE_CREATED,
            AuditActionType.ROLE_MODIFIED,
            AuditActionType.PERMISSION_GRANTED,
            AuditActionType.PERMISSION_REVOKED,
            AuditActionType.DATA_ACCESS_GRANTED,
            AuditActionType.DATA_ACCESS_REVOKED,
            AuditActionType.RBAC_MODEL_VERSIONED,
        ]

        all_events: list[AuditEvent] = []
        for action in rbac_actions:
            dto = await self._audit.query_events(
                session_id,
                self._default_query(),
            )
            all_events.extend(
                [e for e in dto.events if e.action == action]
            )

        # De-duplicate by event_id
        seen_ids: set[str] = set()
        rbac_events: list[AuditEvent] = []
        for e in all_events:
            if e.event_id not in seen_ids:
                seen_ids.add(e.event_id)
                rbac_events.append(e)

        # Build RBAC model from events
        roles: list[Role] = []
        permissions: list[Permission] = []
        permission_matrix: list[RolePermissionEntry] = []
        data_access_matrix: list[DataAccessEntry] = []
        role_hierarchy: list[RoleInheritance] = []

        for event in rbac_events:
            after = event.after_state or {}
            if event.action == AuditActionType.ROLE_CREATED:
                role_data = after.get("role", {})
                if role_data:
                    roles.append(Role(**role_data))
            elif event.action == AuditActionType.PERMISSION_GRANTED:
                perm_data = after.get("permission", {})
                entry_data = after.get("entry", {})
                if perm_data:
                    permissions.append(Permission(**perm_data))
                if entry_data:
                    permission_matrix.append(RolePermissionEntry(**entry_data))
            elif event.action == AuditActionType.DATA_ACCESS_GRANTED:
                entry_data = after.get("entry", {})
                if entry_data:
                    data_access_matrix.append(DataAccessEntry(**entry_data))
            elif event.action == AuditActionType.RBAC_MODEL_VERSIONED:
                hierarchy_data = after.get("hierarchy", [])
                for h in hierarchy_data:
                    role_hierarchy.append(RoleInheritance(**h))

        rbac_model = RBACModel(
            model_id=f"audit-derived-{session_id[:8]}",
            project_id=session_id,
            roles=roles,
            permissions=permissions,
            permission_matrix=permission_matrix,
            data_access_matrix=data_access_matrix,
            role_hierarchy=role_hierarchy,
        )

        return {
            "export_format": "rbac_model",
            "session_id": session_id,
            "exported_at": datetime.utcnow().isoformat(),
            "derived_from_event_count": len(rbac_events),
            "rbac_model": rbac_model.model_dump(mode="json"),
        }

    # ------------------------------------------------------------------ #
    # Decision ledger export
    # ------------------------------------------------------------------ #

    async def export_decision_ledger(self, session_id: str) -> dict[str, Any]:
        """Extract decision-related audit events as a decision ledger.

        Args:
            session_id: Pipeline session ID.

        Returns:
            Dict representing the decision ledger derived from audit events.
        """
        decision_actions = [
            AuditActionType.DECISION_LOGGED,
            AuditActionType.DECISION_REVISED,
            AuditActionType.DECISION_SUPERSEDED,
            AuditActionType.DECISION_REVERTED,
            AuditActionType.STEERING_ACCEPTED,
            AuditActionType.STEERING_MODIFIED,
            AuditActionType.STEERING_REPLACED,
        ]

        all_events: list[AuditEvent] = []
        for action in decision_actions:
            dto = await self._audit.query_events(
                session_id,
                self._default_query(),
            )
            all_events.extend(
                [e for e in dto.events if e.action == action]
            )

        # De-duplicate
        seen_ids: set[str] = set()
        decision_events: list[AuditEvent] = []
        for e in all_events:
            if e.event_id not in seen_ids:
                seen_ids.add(e.event_id)
                decision_events.append(e)

        # Sort by timestamp
        decision_events.sort(key=lambda e: e.timestamp)

        # Build entries
        entries: list[DecisionEntry] = []
        for event in decision_events:
            after = event.after_state or {}
            entry_data = after.get("entry", {})
            if entry_data:
                entries.append(DecisionEntry(**entry_data))
            else:
                # Construct a minimal entry from the event itself
                entries.append(
                    DecisionEntry(
                        decision_id=event.event_id,
                        stage=event.target.target_type if event.target else "",
                        decision_point=event.action.value,
                        chosen_option=None,
                        decision_maker=DecisionMaker.USER
                        if event.actor.actor_type == AuditActorType.USER
                        else DecisionMaker.SYSTEM_AUTHORIZED,
                        status=DecisionStatus.ACTIVE,
                        timestamp=event.timestamp,
                    )
                )

        total_user = sum(
            1 for e in entries if e.decision_maker == DecisionMaker.USER
        )
        total_system = sum(
            1 for e in entries if e.decision_maker == DecisionMaker.SYSTEM_AUTHORIZED
        )
        total_superseded = sum(
            1 for e in entries if e.status == DecisionStatus.SUPERSEDED
        )
        total_reverted = sum(1 for e in entries if e.reverted_from is not None)

        return {
            "export_format": "decision_ledger",
            "session_id": session_id,
            "exported_at": datetime.utcnow().isoformat(),
            "derived_from_event_count": len(decision_events),
            "ledger": {
                "session_id": session_id,
                "entries": [e.model_dump(mode="json") for e in entries],
                "total_user_decisions": total_user,
                "total_system_decisions": total_system,
                "total_superseded": total_superseded,
                "total_reverted": total_reverted,
            },
        }

    # ------------------------------------------------------------------ #
    # Helpers
    # ------------------------------------------------------------------ #

    @staticmethod
    def _default_query(page_size: int = 50) -> Any:
        """Build a default AuditQueryDTO."""
        from domain.models import AuditQueryDTO

        return AuditQueryDTO(page=1, page_size=page_size)

    @staticmethod
    def _infer_stage_from_event(event: AuditEvent) -> str:
        """Infer the pipeline stage from an audit event's action and target."""
        action_str = event.action.value
        stage_mapping = {
            "pipeline.": "Pipeline",
            "stage.": "Stage Execution",
            "steering.": "Steering",
            "decision.": "Decision Management",
            "revision.": "Revision",
            "rbac.": "RBAC",
            "infra.": "Infrastructure",
            "tech_stack.": "Tech Stack",
            "node.": "Node",
            "checkpoint.": "Checkpoint",
        }
        for prefix, stage in stage_mapping.items():
            if prefix in action_str:
                return stage
        return "Other"
