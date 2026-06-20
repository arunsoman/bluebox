"""Domain exceptions for the pipeline state machine."""


class InvalidStateTransitionError(Exception):
    """Raised when a transition is not in `TRANSITIONS[from_state]`."""

    def __init__(self, from_state: str, to_state: str) -> None:
        self.from_state = from_state
        self.to_state = to_state
        super().__init__(f"cannot transition from {from_state!r} to {to_state!r}")


class PipelinePausedError(Exception):
    """doc/prd.md SS4.2: "Attempting `run_next_stage()` without a
    `STEERING_ACTION` throws `PipelinePausedError`." Distinct from
    `InvalidStateTransitionError` - the edge itself is valid, but it may
    only be taken in response to an explicit user steering action.
    """

    def __init__(self, current_state: str) -> None:
        self.current_state = current_state
        super().__init__(
            f"pipeline is paused at {current_state!r}; an explicit steering "
            "action is required before advancing"
        )
