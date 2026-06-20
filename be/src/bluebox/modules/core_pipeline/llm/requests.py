"""LLM request models for Core Pipeline Module stage executors (Stage 1-6).

doc/prd.md SS4.2 Core Pipeline Module. Stage 0 (seed) is owned by
input_processing.llm; Stage 7 (completeness gate) is a rule-based validator;
Stage 9 (runtime) executes code rather than generating it - none of those
three are LLM call sites.

Each request carries only a *summary* of upstream confirmed nodes (id, name,
description) rather than full domain entities - translating committed Nodes
into these summaries is an application-layer concern (built in a later pass),
kept out of the LLM contract boundary itself.
"""

from bluebox.modules.input_processing.llm.responses import Stage0Seed
from bluebox.shared_kernel.llm.base import LLMRequest


class IdeationRequest(LLMRequest):
    """doc/prd.md US-PM-01 - Stage1IdeationExecutor input for SEED_ONLY/MINIMALIST paths."""

    seed: Stage0Seed


class ConfirmedNodeRef(LLMRequest):
    """Minimal summary of a previously-committed node, used as upstream context."""

    node_id: str
    name: str
    description: str


class ActorGenerationRequest(LLMRequest):
    """doc/prd.md SS4.2 Stage2ActorExecutor."""

    context: str
    existing_actors: list[ConfirmedNodeRef] = []


class CapabilityGenerationRequest(LLMRequest):
    """doc/prd.md SS4.2 Stage3CapabilityExecutor."""

    confirmed_actors: list[ConfirmedNodeRef]
    context: str


class UseCaseGenerationRequest(LLMRequest):
    """doc/prd.md SS4.2 Stage4UseCaseExecutor; doc/api_event_contract.md SS5.2."""

    confirmed_capabilities: list[ConfirmedNodeRef]
    actors: list[ConfirmedNodeRef]


class UserStoryGenerationRequest(LLMRequest):
    """doc/prd.md SS4.2 Stage5StoryExecutor; doc/api_event_contract.md SS5.3."""

    confirmed_use_cases: list[ConfirmedNodeRef]


class TechStackSummary(LLMRequest):
    """Condensed TechStackProfile digest for prompting - not the full committed profile."""

    frontend_framework: str
    backend_framework: str
    database: str


class EngineeringTaskGenerationRequest(LLMRequest):
    """doc/prd.md SS4.2 Stage6TaskExecutor; doc/api_event_contract.md SS5.4."""

    confirmed_stories: list[ConfirmedNodeRef]
    tech_stack: TechStackSummary
    rbac_role_names: list[str] = []
