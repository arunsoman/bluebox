"""LLM response models for the Tech Stack Advisor.

`TechStackComponent` is transcribed from doc/api_event_contract.md SS6.3 (it
is shared between the pre-selection options matrix and the committed
profile). `TechStackOption`/`TechStackOptionsMatrix` are not specified in the
contract (only the post-selection `TechStackProfile` is, SS6.3) - their shape
is taken from the reference implementation in mock_server.py's
`TECH_STACK_OPTIONS_MATRIX` fixture, per doc/prd.md AC-TS-02
(actor_compatibility/scale_fit/learning_curve folded into `pros`/`cons`/`rationale`).
"""

from typing import Literal

from pydantic import Field

from bluebox.shared_kernel.llm.base import LLMResponse


class TechStackSignalDetectionResult(LLMResponse):
    """doc/prd.md SS4.3 SignalDetector output."""

    explicit_mentions: list[str]
    implicit_signals: list[str]
    confidence: float


class TechStackComponent(LLMResponse):
    """doc/api_event_contract.md SS6.3 `TechStackComponent`."""

    framework: str
    version: str | None = None
    language: str
    justification: str


class LabeledTechStackComponent(TechStackComponent):
    """`TechStackOption.stack` items, pre-selection only - not part of the
    contract (see `TechStackOption` docstring). `role` is what
    `TechStackService._split_stack` groups by when building the committed
    `TechStackProfile`'s named slots; earlier this was inferred positionally
    (frontend-first/backend-second/database-third, per the mock_server.py
    fixture's convention), which a real model has no reason to follow - it
    orders by whatever organizing principle it picked (e.g. "Spring Boot",
    "Spring Data JPA", "Spring Security" came back in that order, putting
    the auth layer ahead of the actual frontend/database slots). Asking the
    model to label its own components directly is the only reliable fix."""

    role: Literal["frontend", "backend", "database", "cache", "auth", "hosting"]


class TechStackOption(LLMResponse):
    """mock_server.py `TECH_STACK_OPTIONS_MATRIX.options[]` (reference shape)."""

    option_id: str
    option_name: str
    stack: list[LabeledTechStackComponent]
    rationale: str
    pros: list[str]
    cons: list[str]


class TechStackOptionsMatrix(LLMResponse):
    """doc/prd.md AC-TS-02 requires 3-5 options - enforced here, not left to
    prompt instructions alone."""

    options: list[TechStackOption] = Field(min_length=3, max_length=5)
    generation_time_ms: int
