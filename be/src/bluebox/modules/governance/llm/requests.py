"""LLM request models for the Governance & Manipulation module.

doc/prd.md SS4.4: CRUDNodeService (auto-enrichment) and UserOptionValidator.
RevisionEngine/DependencyGraphService impact computation is deterministic
graph traversal (doc/prd.md SS4.5) - not an LLM call site.
"""

from typing import Literal

from bluebox.shared_kernel.llm.base import LLMRequest


class NodeEnrichmentRequest(LLMRequest):
    """doc/api_event_contract.md SS5.1 `EnrichRequest`."""

    node_id: str
    node_type: str
    current_data: dict[str, str]
    enrichment_type: Literal["auto", "manual"] = "auto"
    selected_suggestions: list[str] | None = None
    fields_to_enrich: list[str] | None = None


class UserOptionValidationRequest(LLMRequest):
    """doc/api_event_contract.md SS5.1 `USER_OPTION_INCOHERENT` trigger;
    doc/prd.md AC-ST-06 UserOptionValidator."""

    option_text: str
    context: str
