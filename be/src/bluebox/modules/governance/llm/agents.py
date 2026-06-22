"""pydantic-ai Agents for the Governance & Manipulation module.

RevisionEngine/DependencyGraphService impact computation is deterministic
graph traversal (doc/prd.md SS4.5) - not an LLM call site, no agent here.
"""

from bluebox.modules.governance.llm.requests import (
    NodeEnrichmentRequest,
    UserOptionValidationRequest,
)
from bluebox.modules.governance.llm.responses import (
    EnrichResult,
    UserOptionValidationResult,
)
from bluebox.shared_kernel.llm.connector import build_agent, run_structured

_NODE_ENRICHMENT_PROMPT = """\
You enrich a single node's fields. fields_to_enrich, when given (non-empty),
is authoritative regardless of enrichment_type - it names fields that
*failed validation*, and current_data carries a validation_errors list
explaining exactly why (e.g. "preconditions: must define at least one
precondition" means produce a genuine non-empty list of precondition
strings for that field, not a cosmetic tweak to some other field). You MUST
produce a real, non-empty after value for every field named in
fields_to_enrich - skipping one or touching only unrelated fields like
description leaves the user's actual problem unfixed. Only when
fields_to_enrich is empty/absent are you free to choose which fields to
improve (the "propose your own improvements" case). enriched_fields must
record the real before/after value for every field you changed - never
report a field as enriched without a genuine before/after difference.
completeness_score is 0-1 and must increase after enrichment unless nothing
was changed."""

node_enrichment_agent = build_agent(EnrichResult, _NODE_ENRICHMENT_PROMPT)


async def enrich_node(request: NodeEnrichmentRequest) -> EnrichResult:
    return await run_structured(node_enrichment_agent, request.model_dump_json(indent=2))


_USER_OPTION_VALIDATION_PROMPT = """\
You check a user-typed custom option for coherence against the given
context: is it internally consistent, and does it contradict anything
already established in context? valid=false requires a specific
failure_reason (not "doesn't make sense") and at least one concrete,
actionable suggestion for how the user could rephrase it."""

user_option_validation_agent = build_agent(
    UserOptionValidationResult, _USER_OPTION_VALIDATION_PROMPT
)


async def validate_user_option(
    request: UserOptionValidationRequest,
) -> UserOptionValidationResult:
    return await run_structured(user_option_validation_agent, request.model_dump_json(indent=2))
