"""LLM request models for the Scale & Infrastructure Advisor.

doc/prd.md SS4.3 ScaleInfraAdvisor.HostingOptionsMatrix.
"""

from typing import Literal

from bluebox.shared_kernel.llm.base import LLMRequest

LaunchTimeline = Literal["< 1 month", "1-3 months", "3-6 months", "6+ months"]
ScalePersona = Literal["SMALL", "MEDIUM", "LARGE", "ENTERPRISE"]


class ScaleInputsContext(LLMRequest):
    """doc/api_event_contract.md SS2.5 `ScaleInputs`, already validated/sanitized."""

    expected_total_users: int
    peak_concurrent_users: int
    monthly_budget_usd: float | None = None
    no_budget_limit: bool = False
    launch_timeline: LaunchTimeline
    data_volume_gb: float | None = None
    geographic_regions: list[str] | None = None


class HostingOptionsRequest(LLMRequest):
    """doc/api_event_contract.md SS2.5 - generates the HostingOptionsMatrix."""

    scale_inputs: ScaleInputsContext
    scale_persona: ScalePersona
