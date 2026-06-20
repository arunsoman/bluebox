"""LLM response models for the Scale & Infrastructure Advisor.

Field shapes transcribed from doc/api_event_contract.md SS2.5.
"""

from typing import Literal

from pydantic import Field

from bluebox.shared_kernel.llm.base import LLMResponse


class CostRange(LLMResponse):
    """doc/api_event_contract.md SS2.5 `CostRange`."""

    low_usd: float
    mid_usd: float
    high_usd: float
    basis: str
    assumptions: list[str]
    excludes: list[str]


class InfrastructureComponent(LLMResponse):
    """doc/api_event_contract.md SS2.5 `InfrastructureComponent`."""

    component_type: Literal["compute", "database", "cache", "cdn", "storage", "queue"]
    provider: str
    service_name: str
    tier: str


class HostingOption(LLMResponse):
    """doc/api_event_contract.md SS2.5 `HostingOption`."""

    option_id: str
    option_name: str
    architecture_description: str
    components: list[InfrastructureComponent]
    estimated_monthly_cost: CostRange
    scale_fit: Literal["optimal", "acceptable", "poor"]
    over_budget: bool
    rationale: str
    pros: list[str]
    cons: list[str]


class HostingOptionsMatrix(LLMResponse):
    """doc/api_event_contract.md SS2.5 `HostingOptionsMatrix`.

    doc/prd.md AC-SC-02 requires 3-6 options - enforced here, not left to
    prompt instructions alone.
    """

    scale_persona: Literal["SMALL", "MEDIUM", "LARGE", "ENTERPRISE"]
    options: list[HostingOption] = Field(min_length=3, max_length=6)
    generation_time_ms: int
