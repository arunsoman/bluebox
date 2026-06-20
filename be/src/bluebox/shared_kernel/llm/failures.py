"""LLM failure taxonomy shared across every module.

These are not LLM `output_type` schemas (see `base.py`) — they describe what
the *connector* reports when a call doesn't produce a valid response, and how
the pipeline is allowed to recover. Cited directly from the spec so the
failure_mode/action vocabulary stays in lockstep with the contract and the
MockLLMClient testing harness.
"""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict

# doc/api_event_contract.md SS9.4 LLMFailure.failure_type
# doc/prd.md SS21.1 MockLLMClient.failure_mode
LLMFailureMode = Literal[
    "timeout",
    "malformed_json",
    "context_overflow",
    "rate_limit",
    "empty_response",
]

# doc/prd.md AC-NF-07 LLMFailureResolution options
LLMFailureResolutionAction = Literal[
    "retry_same",
    "retry_modified",
    "skip_with_consent",
    "restore_checkpoint",
]


class LLMFailure(BaseModel):
    """doc/api_event_contract.md SS9.4 `LLMFailure` (the `LLM_FAILURE` WS event payload)."""

    model_config = ConfigDict(extra="forbid")

    failure_type: LLMFailureMode
    prompt_id: str
    stage: int
    partial_output: Any | None = None
    retry_after_seconds: int | None = None
    queue_position: int | None = None


class LLMFailureResolution(BaseModel):
    """doc/prd.md AC-NF-07 — the four explicit recovery options surfaced to the user."""

    model_config = ConfigDict(extra="forbid")

    prompt_id: str
    action: LLMFailureResolutionAction
    notes: str | None = None
