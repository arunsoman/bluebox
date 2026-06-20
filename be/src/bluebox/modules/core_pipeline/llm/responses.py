"""LLM response models for Core Pipeline Module stage executors (Stage 1-6).

Field shapes transcribed from doc/api_event_contract.md SS5.1 (universal Node
fields, owned by the domain layer and not duplicated here) plus the
stage-specific extensions in SS5.2-SS5.4, and doc/prd.md US-PM-01 (ideation).
`*_id` fields reference the `node_id`s supplied via `ConfirmedNodeRef` in the
matching request (see requests.py).
"""

from typing import Literal

from bluebox.shared_kernel.llm.base import LLMResponse

RiskClassification = Literal["LOW_RISK", "MEDIUM", "HIGH", "CRITICAL"]


class IdeationOption(LLMResponse):
    """doc/prd.md US-PM-01 - a ranked product angle with rationale."""

    title: str
    description: str
    rationale: str
    rank: int


class IdeationOptionsResult(LLMResponse):
    options: list[IdeationOption]


class ActorCandidate(LLMResponse):
    """doc/api_event_contract.md SS5.1 universal Node fields, Actor-typed."""

    name: str
    description: str
    layer: str
    risk_classification: RiskClassification
    rationale: str


class ActorCandidateSet(LLMResponse):
    actors: list[ActorCandidate]


class CapabilityCandidate(LLMResponse):
    """doc/api_event_contract.md SS5.1 universal Node fields, Capability-typed.

    `related_actor_ids` is not an explicit contract field (capabilities have
    no SS5.x subtype section) but is required to build the
    Story -> UseCase -> Capability -> Actor graph (doc/prd.md SS4.5).
    """

    name: str
    description: str
    layer: str
    risk_classification: RiskClassification
    related_actor_ids: list[str]
    rationale: str


class CapabilityCandidateSet(LLMResponse):
    capabilities: list[CapabilityCandidate]


class UseCaseStep(LLMResponse):
    """doc/api_event_contract.md SS5.2 `UseCaseStep`."""

    step_number: int
    description: str
    actor_performing: str
    system_response: str | None = None


class AlternativeFlow(LLMResponse):
    """doc/api_event_contract.md SS5.2 `AlternativeFlow`."""

    flow_id: str
    flow_name: str
    trigger_condition: str
    steps: list[UseCaseStep]


class UseCaseCandidate(LLMResponse):
    """doc/api_event_contract.md SS5.2 `UseCase` (extends Node)."""

    name: str
    description: str
    primary_actor_id: str
    secondary_actor_ids: list[str] = []
    preconditions: list[str]
    main_flow: list[UseCaseStep]
    alternative_flows: list[AlternativeFlow] = []
    postconditions: list[str]
    success_criteria: list[str]


class UseCaseCandidateSet(LLMResponse):
    use_cases: list[UseCaseCandidate]


class AcceptanceCriterion(LLMResponse):
    """doc/api_event_contract.md SS5.3 `AcceptanceCriterion`."""

    given: str
    when: str
    then: str
    complete: bool


class UserStoryCandidate(LLMResponse):
    """doc/api_event_contract.md SS5.3 `UserStory` (extends Node)."""

    title: str
    actor_id: str
    story_points: int
    priority: Literal["Must Have", "Should Have", "Could Have"]
    acceptance_criteria: list[AcceptanceCriterion]
    technical_notes: str
    dependencies: list[str] = []


class UserStoryCandidateSet(LLMResponse):
    user_stories: list[UserStoryCandidate]


class AccessGuard(LLMResponse):
    """doc/api_event_contract.md SS5.4 `AccessGuard`."""

    guard_type: Literal["authorization", "authentication", "input_validation", "rate_limiting"]
    description: str
    implementation_hint: str | None = None


class EngineeringTaskCandidate(LLMResponse):
    """doc/api_event_contract.md SS5.4 `EngineeringTask` (extends Node)."""

    name: str
    description: str
    estimated_hours: float
    complexity: Literal["Low", "Medium", "High", "Critical"]
    preconditions: list[str]
    postconditions: list[str]
    file_paths: list[str]
    tech_stack_requirements: list[str]
    database_schema_changes: str | None = None
    access_guards: list[AccessGuard] = []
    parent_story_id: str


class EngineeringTaskCandidateSet(LLMResponse):
    tasks: list[EngineeringTaskCandidate]
