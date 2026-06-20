"""LLM response models for the Governance & Manipulation module.

Field shapes transcribed from doc/api_event_contract.md SS5.1.
"""

from typing import Any

from bluebox.shared_kernel.llm.base import LLMResponse


class EnrichmentSuggestion(LLMResponse):
    """doc/api_event_contract.md SS5.1 `EnrichmentSuggestion`."""

    suggestion_id: str
    field_path: str
    suggested_value: Any
    rationale: str
    confidence: float


class EnrichedFieldChange(LLMResponse):
    """doc/api_event_contract.md SS5.1 `EnrichResult.enriched_fields` value shape."""

    before: Any = None
    after: Any


class EnrichResult(LLMResponse):
    """doc/api_event_contract.md SS5.1 `EnrichResult`."""

    enriched_fields: dict[str, EnrichedFieldChange]
    new_suggestions: list[EnrichmentSuggestion]
    completeness_score_before: float
    completeness_score_after: float
    impact_report_id: str | None = None


class UserOptionValidationResult(LLMResponse):
    """doc/api_event_contract.md SS5.1 `USER_OPTION_INCOHERENT` payload."""

    valid: bool
    failure_reason: str | None = None
    suggestions: list[str] = []
