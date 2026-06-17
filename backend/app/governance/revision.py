"""RevisionEngine — 4-step iterative impact loop."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from app.domain.models import ImpactReport, ProposedChange

if TYPE_CHECKING:
    from app.core.events import EventBus
    from app.graph.impact import ImpactAnalyzer

logger = logging.getLogger(__name__)


class RevisionEngine:
    """4-step iterative impact loop.

    1. **submit** — receives a *ProposedChange* and stores it.
    2. **ImpactAnalyzer.analyze** — computes downstream/upstream effects.
    3. **IMPACT_REPORT_READY** — emitted via *EventBus*; awaits consent.
    4. **consent** — user approves or rejects propagation.

    The engine **never** auto-commits.  Every change must pass through
    ``consent(confirmed=True)`` before propagation.
    """

    def __init__(
        self,
        impact_analyzer: ImpactAnalyzer,
        event_bus: EventBus,
    ) -> None:
        self.impact_analyzer = impact_analyzer
        self.event_bus = event_bus
        self._pending_changes: dict[str, ProposedChange] = {}
        self._impact_reports: dict[str, ImpactReport] = {}

    async def submit(self, change: ProposedChange) -> None:
        """Receive a *ProposedChange*, analyse impact, and emit report."""
        self._pending_changes[change.change_id] = change

        # Step 2: compute impact
        report = await self.impact_analyzer.analyze(change)
        self._impact_reports[change.change_id] = report

        logger.info(
            "Impact report %s ready for change %s: %d directly, %d transitively affected",
            report.report_id,
            change.change_id,
            len(report.directly_affected),
            len(report.transitively_affected),
        )

        # Step 3: emit and wait for consent
        await self.event_bus.emit("IMPACT_REPORT_READY", report.model_dump())

    async def consent(
        self, change_id: str, confirmed: bool, notes: str = ""
    ) -> None:
        """Approve or reject a pending change."""
        report = self._impact_reports.get(change_id)
        change = self._pending_changes.get(change_id)

        if not report or not change:
            raise ValueError(f"Unknown change: {change_id}")

        payload: dict = {
            "change_id": change_id,
            "confirmed": confirmed,
            "notes": notes,
        }

        if confirmed:
            payload["stages_to_rerun"] = report.stages_to_rerun

        await self.event_bus.emit("PROPAGATION_CONSENT", payload)

        logger.info(
            "Propagation %s for change %s (notes: %s)",
            "approved" if confirmed else "rejected",
            change_id,
            notes,
        )

        # Cleanup — change is resolved
        del self._pending_changes[change_id]
        del self._impact_reports[change_id]

    def get_pending_change(self, change_id: str) -> ProposedChange | None:
        return self._pending_changes.get(change_id)

    def get_impact_report(self, change_id: str) -> ImpactReport | None:
        return self._impact_reports.get(change_id)

    def list_pending(self) -> list[str]:
        return list(self._pending_changes.keys())
