"""LLM request models for the Governance & Manipulation module.

doc/prd.md SS4.4: CRUDNodeService (auto-enrichment) and UserOptionValidator.
RevisionEngine/DependencyGraphService impact computation is deterministic
graph traversal (doc/prd.md SS4.5) - not an LLM call site.
"""

from typing import Any, Literal

from bluebox.shared_kernel.llm.base import LLMRequest


class NodeEnrichmentRequest(LLMRequest):
    """doc/api_event_contract.md SS5.1 `EnrichRequest`.

    `current_data` is `dict[str, Any]`, not `dict[str, str]` - `NodeService.enrich`
    populates it with the node's *actual* current value for whatever's in
    `fields_to_enrich` (e.g. an empty `list[str]` for a failing `preconditions`
    check), plus a `validation_errors` key describing exactly what's wrong with
    each. A `str`-only map can't carry that, and without it the model has
    nothing but `name`/`description` to go on - it can't know which field is
    actually broken (see `NodeService.enrich`'s docstring for the bug this fixes).
    """

    node_id: str
    node_type: str
    current_data: dict[str, Any]
    enrichment_type: Literal["auto", "manual"] = "auto"
    selected_suggestions: list[str] | None = None
    fields_to_enrich: list[str] | None = None


class UserOptionValidationRequest(LLMRequest):
    """doc/api_event_contract.md SS5.1 `USER_OPTION_INCOHERENT` trigger;
    doc/prd.md AC-ST-06 UserOptionValidator."""

    option_text: str
    context: str
