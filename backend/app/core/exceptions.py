"""Domain exceptions for the Collaborative Steering Pipeline."""

from __future__ import annotations


class PipelineError(Exception):
    """Base pipeline exception."""


class InvalidStateTransitionError(PipelineError):
    def __init__(self, from_state: str, to_state: str) -> None:
        self.from_state = from_state
        self.to_state = to_state
        super().__init__(f"Invalid transition from {from_state} to {to_state}")


class PipelinePausedError(PipelineError):
    """Raised when the pipeline cannot proceed from its current state."""


class StageExecutionError(PipelineError):
    """Raised when a stage executor fails."""


class CompletenessGateError(PipelineError):
    """Raised when Stage 7 gate blocks export."""


class BudgetExhaustedError(PipelineError):
    """Raised when the revision budget is exhausted."""

    def __init__(self, message: str, escalation_options: list[str] | None = None) -> None:
        self.escalation_options = escalation_options or []
        super().__init__(message)
