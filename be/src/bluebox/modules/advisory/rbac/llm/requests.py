"""LLM request models for the RBAC Advisor.

doc/prd.md SS4.3 RBACAdvisor.RBACModelGenerator. Cycle detection and
privilege-escalation analysis (InheritanceValidator, PrivilegeEscalationAnalyzer)
are pure graph algorithms (STATIC_ESCALATION_ANALYSIS, DFS) - not LLM call
sites, intentionally not modeled here.
"""

from bluebox.modules.core_pipeline.llm.requests import ConfirmedNodeRef
from bluebox.shared_kernel.llm.base import LLMRequest


class RBACModelGenerationRequest(LLMRequest):
    """doc/api_event_contract.md SS6.1 `RBACModel`; doc/prd.md AC-RB-01."""

    actors: list[ConfirmedNodeRef]
    capabilities: list[ConfirmedNodeRef]
    use_cases: list[ConfirmedNodeRef]
