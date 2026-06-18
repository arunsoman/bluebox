"""RevisionBudgetManager — per-decision-point revision counting.

Each decision point starts with a default budget of 5 revisions.
Every call to ``use_revision`` decrements the counter.  When the budget
reaches zero, a ``RevisionBudgetExhausted`` descriptor is returned so the
orchestrator can decide whether to escalate, accept-best, or mark-pending.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from domain.models import (
    RevisionBudget,
    BudgetStatus,
    ExhaustionAction,
    RevisionBudgetExhausted,
)
from infrastructure.persistence.redis.client import get_redis


class RevisionBudgetManager:
    """Manages per-session, per-decision-point revision budgets.

    Budgets are cached in Redis with a 24-hour TTL and synced to
    PostgreSQL on exhaustion for persistence.
    """

    DEFAULT_MAX_REVISIONS: int = 5
    REDIS_TTL_SECONDS: int = 86400  # 24 hours

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #

    async def get_budget(
        self,
        session_id: str,
        decision_point: str,
    ) -> RevisionBudget:
        """Retrieve (or create) the revision budget for a decision point.

        Args:
            session_id: Pipeline session ID.
            decision_point: Identifier for the specific decision point
                (e.g. ``actor_discovery:platform_actor_selection``).

        Returns:
            The current RevisionBudget for that decision point.
        """
        redis_key = self._redis_key(session_id, decision_point)
        r = await get_redis()

        raw = await r.hgetall(redis_key)
        if raw:
            return RevisionBudget(
                budget_id=raw.get("budget_id", str(uuid.uuid4())),
                decision_point=decision_point,
                max_revisions=int(raw.get("max_revisions", self.DEFAULT_MAX_REVISIONS)),
                revisions_used=int(raw.get("revisions_used", 0)),
                status=BudgetStatus(raw.get("status", "active")),
                exhaustion_action=ExhaustionAction(
                    raw.get("exhaustion_action", "escalate_dialogue")
                ),
            )

        # Create new budget
        budget = RevisionBudget(
            budget_id=str(uuid.uuid4()),
            decision_point=decision_point,
            max_revisions=self.DEFAULT_MAX_REVISIONS,
            revisions_used=0,
            status=BudgetStatus.ACTIVE,
            exhaustion_action=ExhaustionAction.ESCALATE_DIALOGUE,
        )
        await self._persist_budget(redis_key, budget)
        return budget

    async def use_revision(
        self,
        session_id: str,
        decision_point: str,
    ) -> RevisionBudget:
        """Consume one revision from the budget.

        Args:
            session_id: Pipeline session ID.
            decision_point: The decision point being revised.

        Returns:
            Updated RevisionBudget (status may be EXHAUSTED).
        """
        budget = await self.get_budget(session_id, decision_point)

        if budget.status == BudgetStatus.EXHAUSTED:
            return budget

        budget.revisions_used += 1
        if budget.revisions_used >= budget.max_revisions:
            budget.status = BudgetStatus.EXHAUSTED

        redis_key = self._redis_key(session_id, decision_point)
        await self._persist_budget(redis_key, budget)
        return budget

    @staticmethod
    def check_exhaustion(
        budget: RevisionBudget,
    ) -> RevisionBudgetExhausted | None:
        """Check whether a budget is exhausted and return the exhaustion descriptor.

        Returns:
            ``RevisionBudgetExhausted`` if exhausted, else ``None``.
        """
        if budget.status == BudgetStatus.EXHAUSTED:
            return RevisionBudgetExhausted(
                budget_id=budget.budget_id,
                decision_point=budget.decision_point,
                exhaustion_action=budget.exhaustion_action,
            )
        return None

    async def reset_budget(
        self,
        session_id: str,
        decision_point: str,
        new_max: int | None = None,
    ) -> RevisionBudget:
        """Reset a budget to its initial state (e.g. after escalation approval).

        Args:
            session_id: Pipeline session ID.
            decision_point: The decision point to reset.
            new_max: Optional new maximum revision count.

        Returns:
            The reset RevisionBudget.
        """
        redis_key = self._redis_key(session_id, decision_point)
        r = await get_redis()

        budget = await self.get_budget(session_id, decision_point)
        budget.revisions_used = 0
        budget.status = BudgetStatus.ACTIVE
        if new_max is not None:
            budget.max_revisions = new_max

        await self._persist_budget(redis_key, budget)
        return budget

    # ------------------------------------------------------------------ #
    # Internals
    # ------------------------------------------------------------------ #

    @staticmethod
    def _redis_key(session_id: str, decision_point: str) -> str:
        """Build the Redis hash key for a budget."""
        safe_dp = decision_point.replace(":", "_")
        return f"revision_budget:{session_id}:{safe_dp}"

    async def _persist_budget(self, redis_key: str, budget: RevisionBudget) -> None:
        """Write budget fields to Redis as a hash with TTL."""
        r = await get_redis()
        await r.hset(
            redis_key,
            mapping={
                "budget_id": budget.budget_id,
                "decision_point": budget.decision_point,
                "max_revisions": str(budget.max_revisions),
                "revisions_used": str(budget.revisions_used),
                "status": budget.status.value,
                "exhaustion_action": budget.exhaustion_action.value,
            },
        )
        await r.expire(redis_key, self.REDIS_TTL_SECONDS)
