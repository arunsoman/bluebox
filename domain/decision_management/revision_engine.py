"""RevisionEngine — orchestrates the revision → impact → consent → propagate flow.

When a user wants to change a past decision:
  1. ``initiate_revision`` checks budget, runs impact analysis, emits report.
  2. The user reviews the ImpactReport and gives PropagationConsent.
  3. ``PropagationRunner`` executes the propagation (or cancels it).
  4. ``revert_to`` creates a revert entry for rollback scenarios.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from domain.models import (
    SteeringOption,
    ImpactReport,
    DecisionEntry,
    DecisionMaker,
    DecisionStatus,
)
from domain.decision_management.revision_budget_manager import RevisionBudgetManager
from domain.decision_management.impact_analyzer import ImpactAnalyzer
from infrastructure.messaging.sse_manager import sse_manager


class RevisionEngine:
    """Orchestrates decision revision with budget checking and impact analysis."""

    def __init__(
        self,
        budget_manager: RevisionBudgetManager | None = None,
        impact_analyzer: ImpactAnalyzer | None = None,
    ):
        self._budget_manager = budget_manager or RevisionBudgetManager()
        self._impact_analyzer = impact_analyzer or ImpactAnalyzer()

    # ------------------------------------------------------------------ #
    # Initiate revision
    # ------------------------------------------------------------------ #

    async def initiate_revision(
        self,
        session_id: str,
        decision_id: str,
        new_choice: SteeringOption,
    ) -> ImpactReport:
        """Start a revision request: check budget, analyze impact, emit report.

        Args:
            session_id: Pipeline session ID.
            decision_id: The decision to revise.
            new_choice: The proposed replacement option.

        Returns:
            ImpactReport describing downstream effects.

        Raises:
            RuntimeError: If the revision budget is exhausted.
        """
        # 1. Check revision budget
        budget = await self._budget_manager.get_budget(session_id, decision_id)
        exhaustion = self._budget_manager.check_exhaustion(budget)
        if exhaustion:
            await sse_manager.emit_budget_exhausted(
                session_id, exhaustion.model_dump()
            )
            raise RuntimeError(
                f"Revision budget exhausted for decision {decision_id}. "
                f"Action: {exhaustion.exhaustion_action.value}"
            )

        # 2. Consume one revision
        await self._budget_manager.use_revision(session_id, decision_id)

        # 3. Compute impact
        impact_report = await self._impact_analyzer.compute_impact(
            session_id, decision_id, new_choice
        )

        # 4. Emit impact report event
        await sse_manager.emit_impact_report(
            session_id, impact_report.model_dump(mode="json")
        )

        return impact_report

    # ------------------------------------------------------------------ #
    # Revert
    # ------------------------------------------------------------------ #

    async def revert_to(
        self,
        session_id: str,
        decision_id: str,
    ) -> DecisionEntry:
        """Revert to a previous (superseded) decision.

        Creates a new ACTIVE decision entry that references the reverted-from
        decision.  Emits ``DECISION_REVERTED`` via SSE.

        Args:
            session_id: Pipeline session ID.
            decision_id: The decision entry to revert to.

        Returns:
            The newly created revert decision entry.
        """
        revert_entry = DecisionEntry(
            decision_id=str(uuid.uuid4()),
            stage="revert",
            decision_point=f"revert_to:{decision_id}",
            options_presented=[],
            chosen_option=None,
            decision_maker=DecisionMaker.USER,
            rationale_accepted=f"Reverted to decision {decision_id}",
            status=DecisionStatus.ACTIVE,
            reverted_from=decision_id,
            timestamp=datetime.utcnow(),
        )

        # Persist via the decision ledger service
        from domain.decision_management.decision_ledger import DecisionLedgerService

        ledger_service = DecisionLedgerService()
        await ledger_service.log_decision(session_id, revert_entry)

        # Emit revert event
        await sse_manager.emit(
            session_id,
            "DECISION_REVERTED",
            {
                "decision_id": revert_entry.decision_id,
                "reverted_from": decision_id,
                "session_id": session_id,
                "timestamp": datetime.utcnow().isoformat(),
            },
        )

        return revert_entry
