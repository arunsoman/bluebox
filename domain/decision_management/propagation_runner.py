"""PropagationRunner — executes (or cancels) revision propagation.

After a user consents to an ImpactReport, the runner:
  1. Archives the original decision as superseded.
  2. Creates a new decision entry with the revised choice.
  3. Re-runs affected pipeline stages.
  4. Merges new outputs into session state.
  5. Emits lifecycle events.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from domain.models import (
    ImpactReport,
    DecisionEntry,
    DecisionStatus,
    DecisionMaker,
    SteeringOption,
)
from domain.decision_management.decision_ledger import DecisionLedgerService
from infrastructure.messaging.sse_manager import sse_manager
from infrastructure.persistence.redis.client import cache_session, get_cached_session


class PropagationRunner:
    """Executes propagation of a revised decision through the pipeline."""

    def __init__(self, ledger_service: DecisionLedgerService | None = None):
        self._ledger = ledger_service or DecisionLedgerService()

    # ------------------------------------------------------------------ #
    # Run propagation
    # ------------------------------------------------------------------ #

    async def run_propagation(
        self,
        session_id: str,
        impact_report: ImpactReport,
    ) -> dict[str, Any]:
        """Execute the full propagation of a revised decision.

        Args:
            session_id: Pipeline session ID.
            impact_report: The impact report the user consented to.

        Returns:
            Dict summarizing the propagation results.
        """
        original_id = impact_report.original_decision_id
        new_choice = impact_report.proposed_choice
        affected_stages = impact_report.stages_needing_rerun

        # 1. Emit propagation started
        await sse_manager.emit_propagation_started(session_id, affected_stages)

        # 2. Archive original decision as superseded
        new_decision_id = str(uuid.uuid4())
        await self._ledger.supersede_decision(session_id, original_id, new_decision_id)

        # 3. Create new decision entry with the revised choice
        new_entry = DecisionEntry(
            decision_id=new_decision_id,
            stage=impact_report.directly_affected_nodes[0].node_type
            if impact_report.directly_affected_nodes
            else "unknown",
            decision_point=f"revision:{original_id}",
            options_presented=[],
            chosen_option=new_choice,
            decision_maker=DecisionMaker.USER,
            rationale_accepted=f"Revised from decision {original_id}",
            status=DecisionStatus.ACTIVE,
            timestamp=datetime.utcnow(),
        )
        await self._ledger.log_decision(session_id, new_entry)

        # 4. Re-run affected stages (mark them for re-run)
        # The actual re-run is triggered by the orchestrator
        for stage in affected_stages:
            await sse_manager.emit(
                session_id,
                "STAGE_RERUN_TRIGGERED",
                {"stage": stage, "triggered_by": f"revision:{original_id}"},
            )

        # 5. Update session state — mark invalidated decisions as superseded
        await self._invalidate_downstream_decisions(
            session_id, impact_report.invalidated_decisions
        )

        # 6. Emit propagation complete
        await sse_manager.emit_propagation_complete(session_id)

        return {
            "propagation_id": str(uuid.uuid4()),
            "original_decision_id": original_id,
            "new_decision_id": new_decision_id,
            "affected_stages": affected_stages,
            "invalidated_decisions": impact_report.invalidated_decisions,
            "status": "complete",
            "completed_at": datetime.utcnow().isoformat(),
        }

    # ------------------------------------------------------------------ #
    # Cancel propagation
    # ------------------------------------------------------------------ #

    async def cancel_propagation(
        self,
        session_id: str,
        impact_report_id: str,
    ) -> dict[str, Any]:
        """Cancel a propagation — no changes, original decision stands.

        Args:
            session_id: Pipeline session ID.
            impact_report_id: The impact report being cancelled.

        Returns:
            Cancellation confirmation dict.
        """
        await sse_manager.emit(
            session_id,
            "PROPAGATION_CANCELLED",
            {
                "impact_report_id": impact_report_id,
                "session_id": session_id,
                "timestamp": datetime.utcnow().isoformat(),
            },
        )

        return {
            "impact_report_id": impact_report_id,
            "status": "cancelled",
            "cancelled_at": datetime.utcnow().isoformat(),
            "message": "Original decision stands. No changes applied.",
        }

    # ------------------------------------------------------------------ #
    # Internals
    # ------------------------------------------------------------------ #

    async def _invalidate_downstream_decisions(
        self,
        session_id: str,
        decision_ids: list[str],
    ) -> None:
        """Mark downstream decisions as superseded by the propagation.

        For each invalidated decision, we create a chain link without
        a replacement (they're invalidated by the structural change).
        """
        for decision_id in decision_ids:
            # Fetch the entry first
            entry = await self._ledger.get_entry(session_id, decision_id)
            if entry and entry.status == DecisionStatus.ACTIVE:
                # We supersede it with no direct replacement — the propagation
                # itself is the implicit replacement context.
                await self._ledger.supersede_decision(
                    session_id, decision_id, f"propagation:{session_id}"
                )
