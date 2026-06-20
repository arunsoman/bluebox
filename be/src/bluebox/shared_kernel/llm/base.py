"""Base classes for every LLM request/response model in the codebase.

Every module's `llm/requests.py` and `llm/responses.py` subclasses one of
these. `extra="forbid"` means a malformed or drifted LLM response fails
Pydantic validation instead of silently passing through unknown fields —
the system has zero silent defaults (doc/prd.md SS2.1).
"""

from pydantic import BaseModel, ConfigDict


class LLMRequest(BaseModel):
    """Structured input handed to a prompt template before an LLM call.

    Frozen because a request is a snapshot of context at call time; mutating
    it after construction would desync it from the prompt already built.
    """

    model_config = ConfigDict(extra="forbid", frozen=True)


class LLMResponse(BaseModel):
    """Structured output type an LLM call is validated against (pydantic-ai
    `output_type`). Anything the model returns that doesn't fit this schema
    is a validation error, not a best-effort parse.
    """

    model_config = ConfigDict(extra="forbid")
