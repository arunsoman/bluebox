"""RevisionBudget — caps the number of revision iterations per decision."""

from __future__ import annotations

from app.core.exceptions import BudgetExhaustedError


class RevisionBudget:
    """Tracks how many revision rounds remain before the budget is exhausted.

    Each call to ``consume()`` decrements the counter.  Once zero is
    reached ``is_exhausted`` becomes ``True`` and ``exhausted()`` raises
    :class:`app.core.exceptions.BudgetExhaustedError`.
    """

    def __init__(self, max_revisions: int = 5) -> None:
        self._max_revisions = max(max_revisions, 0)
        self._remaining: int = self._max_revisions

    def consume(self) -> bool:
        """Consume one unit of budget.

        Returns:
            ``True`` if budget was available and consumed, ``False`` if
            already exhausted.
        """
        if self._remaining > 0:
            self._remaining -= 1
            return True
        return False

    @property
    def remaining(self) -> int:
        return self._remaining

    @property
    def is_exhausted(self) -> bool:
        return self._remaining <= 0

    def exhausted(self) -> None:
        raise BudgetExhaustedError(
            message=f"Revision budget exhausted (max={self._max_revisions})",
            escalation_options=[
                "request_budget_increase",
                "abort_revision",
                "force_commit",
            ],
        )

    def reset(self) -> None:
        self._remaining = self._max_revisions
