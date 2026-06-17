"""Unit tests for governance: CRUDNodeService, RevisionEngine, RevisionBudget.

Tests cover:
- CRUDNodeService.apply() creates ProposedChange
- RevisionEngine 4-step loop (submit -> analyze -> consent)
- RevisionBudget exhaustion
- Propagation consent confirmed/cancelled
"""

from __future__ import annotations

import pytest

from app.core.events import LocalEventBus
from app.core.exceptions import BudgetExhaustedError
from app.domain.models import CRUDNodeAction, ProposedChange
from app.graph.dag import DependencyGraphService
from app.graph.impact import ImpactAnalyzer
from app.governance.budget import RevisionBudget
from app.governance.crud import CRUDNodeService
from app.governance.revision import RevisionEngine


# ---------------------------------------------------------------------------
# CRUDNodeService
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestCRUDNodeService:
    async def test_apply_creates_proposed_change(self, event_bus, graph_service):
        impact_analyzer = ImpactAnalyzer(graph_service)
        revision = RevisionEngine(impact_analyzer, event_bus)
        crud = CRUDNodeService(revision, graph_service)

        change = await crud.apply(
            action=CRUDNodeAction.ADD,
            node_type="actor",
            node_id="act-1",
            data={"name": "Test Actor", "description": "Test"},
        )

        assert isinstance(change, ProposedChange)
        assert change.action == "add"
        assert change.node_type == "actor"
        assert change.node_id == "act-1"
        assert change.node_data["name"] == "Test Actor"

    async def test_apply_with_edit_action(self, event_bus, graph_service):
        impact_analyzer = ImpactAnalyzer(graph_service)
        revision = RevisionEngine(impact_analyzer, event_bus)
        crud = CRUDNodeService(revision, graph_service)

        change = await crud.apply(
            action=CRUDNodeAction.EDIT,
            node_type="capability",
            node_id="cap-1",
            data={"name": "Updated Name"},
        )

        assert change.action == "edit"
        assert change.node_type == "capability"

    async def test_apply_with_remove_action(self, event_bus, graph_service):
        impact_analyzer = ImpactAnalyzer(graph_service)
        revision = RevisionEngine(impact_analyzer, event_bus)
        crud = CRUDNodeService(revision, graph_service)

        change = await crud.apply(
            action=CRUDNodeAction.REMOVE,
            node_type="use_case",
            node_id="uc-1",
        )

        assert change.action == "remove"
        assert change.node_data == {}  # No data provided


# ---------------------------------------------------------------------------
# RevisionEngine 4-step loop
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestRevisionEngine:
    async def test_submit_step_1_stores_change(self, event_bus, graph_service):
        impact_analyzer = ImpactAnalyzer(graph_service)
        revision = RevisionEngine(impact_analyzer, event_bus)

        change = ProposedChange(
            change_id="test-1",
            action="edit",
            node_type="actor",
            node_id="act-1",
        )
        await revision.submit(change)

        assert revision.get_pending_change("test-1") is not None
        assert revision.get_impact_report("test-1") is not None

    async def test_submit_step_2_analyzes_impact(self, event_bus):
        """Step 2: ImpactAnalyzer.analyze computes downstream effects."""
        gs = DependencyGraphService()
        gs.add_node("act-1", "actor", {"name": "User"})
        gs.add_node("cap-1", "capability", {"name": "Auth"}, parent_ids=["act-1"])

        impact_analyzer = ImpactAnalyzer(gs)
        revision = RevisionEngine(impact_analyzer, event_bus)

        change = ProposedChange(
            change_id="test-2",
            action="edit",
            node_type="actor",
            node_id="act-1",
        )
        await revision.submit(change)

        report = revision.get_impact_report("test-2")
        assert "cap-1" in report.directly_affected

    async def test_submit_step_3_emits_event(self, event_bus, graph_service):
        """Step 3: IMPACT_REPORT_READY event is emitted."""
        events_received = []
        async def capture(payload):
            events_received.append(payload)
        event_bus.on("IMPACT_REPORT_READY", capture)

        impact_analyzer = ImpactAnalyzer(graph_service)
        revision = RevisionEngine(impact_analyzer, event_bus)

        change = ProposedChange(
            change_id="test-3",
            action="edit",
            node_type="actor",
            node_id="act-1",
        )
        await revision.submit(change)

        assert len(events_received) == 1
        assert "report_id" in events_received[0]

    async def test_consent_step_4_confirmed(self, event_bus, graph_service):
        """Step 4: User confirms propagation — change resolved."""
        consent_events = []
        async def capture(payload):
            consent_events.append(payload)
        event_bus.on("PROPAGATION_CONSENT", capture)

        impact_analyzer = ImpactAnalyzer(graph_service)
        revision = RevisionEngine(impact_analyzer, event_bus)

        change = ProposedChange(
            change_id="test-4",
            action="edit",
            node_type="actor",
            node_id="act-1",
        )
        await revision.submit(change)
        await revision.consent("test-4", confirmed=True, notes="Looks good")

        # Change should be resolved
        assert revision.get_pending_change("test-4") is None
        assert revision.get_impact_report("test-4") is None
        assert len(consent_events) == 1
        assert consent_events[0]["confirmed"] is True
        assert "stages_to_rerun" in consent_events[0]

    async def test_consent_step_4_cancelled(self, event_bus, graph_service):
        """Step 4: User rejects propagation — change discarded."""
        consent_events = []
        async def capture(payload):
            consent_events.append(payload)
        event_bus.on("PROPAGATION_CONSENT", capture)

        impact_analyzer = ImpactAnalyzer(graph_service)
        revision = RevisionEngine(impact_analyzer, event_bus)

        change = ProposedChange(
            change_id="test-5",
            action="edit",
            node_type="actor",
            node_id="act-1",
        )
        await revision.submit(change)
        await revision.consent("test-5", confirmed=False, notes="Too risky")

        assert revision.get_pending_change("test-5") is None
        assert len(consent_events) == 1
        assert consent_events[0]["confirmed"] is False
        assert "stages_to_rerun" not in consent_events[0]

    async def test_consent_unknown_change_raises(self, event_bus, graph_service):
        impact_analyzer = ImpactAnalyzer(graph_service)
        revision = RevisionEngine(impact_analyzer, event_bus)

        with pytest.raises(ValueError, match="Unknown change"):
            await revision.consent("nonexistent", confirmed=True)

    async def test_list_pending(self, event_bus, graph_service):
        impact_analyzer = ImpactAnalyzer(graph_service)
        revision = RevisionEngine(impact_analyzer, event_bus)

        assert revision.list_pending() == []

        change = ProposedChange(
            change_id="pending-1",
            action="add",
            node_type="actor",
        )
        await revision.submit(change)
        assert revision.list_pending() == ["pending-1"]


# ---------------------------------------------------------------------------
# RevisionBudget
# ---------------------------------------------------------------------------


class TestRevisionBudget:
    def test_default_budget_is_5(self):
        budget = RevisionBudget()
        assert budget.remaining == 5
        assert not budget.is_exhausted

    def test_consume_decrements_budget(self):
        budget = RevisionBudget(max_revisions=3)
        assert budget.consume() is True
        assert budget.remaining == 2
        assert budget.consume() is True
        assert budget.remaining == 1
        assert budget.consume() is True
        assert budget.remaining == 0
        assert budget.is_exhausted

    def test_consume_when_exhausted_returns_false(self):
        budget = RevisionBudget(max_revisions=1)
        budget.consume()
        assert budget.consume() is False
        assert budget.remaining == 0

    def test_exhausted_raises(self):
        budget = RevisionBudget(max_revisions=0)
        with pytest.raises(BudgetExhaustedError) as exc_info:
            budget.exhausted()
        assert "budget exhausted" in str(exc_info.value).lower()
        assert len(exc_info.value.escalation_options) == 3

    def test_reset_restores_budget(self):
        budget = RevisionBudget(max_revisions=5)
        budget.consume()
        budget.consume()
        assert budget.remaining == 3
        budget.reset()
        assert budget.remaining == 5

    def test_zero_budget_is_immediately_exhausted(self):
        budget = RevisionBudget(max_revisions=0)
        assert budget.is_exhausted
        assert budget.consume() is False

    def test_negative_max_revisions_clamped_to_zero(self):
        budget = RevisionBudget(max_revisions=-5)
        assert budget.remaining == 0
        assert budget.is_exhausted
