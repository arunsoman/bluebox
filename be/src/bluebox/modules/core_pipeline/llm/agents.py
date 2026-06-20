"""pydantic-ai Agents for the Core Pipeline Module stage executors (Stage 1-6).

Stage 0 (seed) lives in input_processing.llm.agents; Stage 7 (completeness
gate) is a rule-based validator; Stage 9 (runtime) executes generated code -
none of those three get an Agent here.
"""

from bluebox.modules.core_pipeline.llm.requests import (
    ActorGenerationRequest,
    CapabilityGenerationRequest,
    EngineeringTaskGenerationRequest,
    IdeationRequest,
    UseCaseGenerationRequest,
    UserStoryGenerationRequest,
)
from bluebox.modules.core_pipeline.llm.responses import (
    ActorCandidateSet,
    CapabilityCandidateSet,
    EngineeringTaskCandidateSet,
    IdeationOptionsResult,
    UseCaseCandidateSet,
    UserStoryCandidateSet,
)
from bluebox.shared_kernel.llm.connector import build_agent, run_structured

_IDEATION_PROMPT = """\
You generate ranked product angle options from a sparse Stage0Seed (used for
MINIMALIST/SEED_ONLY input that has no stated PRD to validate). Each option
needs a concrete rationale grounded in the seed's problem_statement and
target_users - never present a generic template idea as if it were derived
from this specific seed. Rank options by how directly they address the
stated problem, best first."""

ideation_agent = build_agent(IdeationOptionsResult, _IDEATION_PROMPT)


async def generate_ideation_options(request: IdeationRequest) -> IdeationOptionsResult:
    return await run_structured(ideation_agent, request.model_dump_json(indent=2), stage=1)


_ACTOR_GENERATION_PROMPT = """\
You generate Actor candidates (Stage 2) from the project context. Every
actor needs a risk_classification (LOW_RISK/MEDIUM/HIGH/CRITICAL) and a
rationale explaining that classification - actors touching authentication,
payments, or external/third-party systems are never LOW_RISK. Do not
duplicate any actor already listed in existing_actors; if the context
implies a refinement of an existing actor, omit it rather than generating a
near-duplicate."""

actor_generation_agent = build_agent(ActorCandidateSet, _ACTOR_GENERATION_PROMPT)


async def generate_actors(request: ActorGenerationRequest) -> ActorCandidateSet:
    return await run_structured(actor_generation_agent, request.model_dump_json(indent=2), stage=2)


_CAPABILITY_GENERATION_PROMPT = """\
You generate Capability candidates (Stage 3) from confirmed actors. Every
capability must list related_actor_ids referencing only ids supplied in
confirmed_actors - never invent an actor id. risk_classification follows the
same scale as actors: capabilities touching payments, auth, or PII are at
minimum HIGH."""

capability_generation_agent = build_agent(CapabilityCandidateSet, _CAPABILITY_GENERATION_PROMPT)


async def generate_capabilities(request: CapabilityGenerationRequest) -> CapabilityCandidateSet:
    return await run_structured(
        capability_generation_agent, request.model_dump_json(indent=2), stage=3
    )


_USE_CASE_GENERATION_PROMPT = """\
You generate UseCase candidates (Stage 4) from confirmed capabilities and
actors. primary_actor_id and every id in secondary_actor_ids must come from
the actors supplied - never invent an id. main_flow must be a complete,
numbered sequence ending in a system response; alternative_flows cover
realistic failure/edge paths (e.g. unavailable resource, validation
failure), not just the happy path restated."""

use_case_generation_agent = build_agent(UseCaseCandidateSet, _USE_CASE_GENERATION_PROMPT)


async def generate_use_cases(request: UseCaseGenerationRequest) -> UseCaseCandidateSet:
    return await run_structured(
        use_case_generation_agent, request.model_dump_json(indent=2), stage=4
    )


_USER_STORY_GENERATION_PROMPT = """\
You decompose confirmed use cases into UserStory candidates (Stage 5) in
"As a [role], I want [goal], so that [benefit]" form. Every acceptance
criterion must have given/when/then all non-empty (complete=true only when
all three are present and concrete, not placeholder text). story_points use
the Fibonacci scale (1,2,3,5,8,13). dependencies must reference only story
ids that make sense as prerequisites, never a forward reference to a story
not yet generated in this batch unless it was supplied as context."""

user_story_generation_agent = build_agent(UserStoryCandidateSet, _USER_STORY_GENERATION_PROMPT)


async def generate_user_stories(request: UserStoryGenerationRequest) -> UserStoryCandidateSet:
    return await run_structured(
        user_story_generation_agent, request.model_dump_json(indent=2), stage=5
    )


_ENGINEERING_TASK_GENERATION_PROMPT = """\
You decompose confirmed user stories into EngineeringTask candidates
(Stage 6) for the given tech stack. Every task touching confidential or
restricted data MUST have a non-empty access_guards list (doc/prd.md
SS8.4) - this is enforced downstream at the completeness gate, so omitting
guards on a sensitive task is a defect, not an optional detail. file_paths
must be consistent with the supplied tech stack's directory conventions.
parent_story_id must reference a story id from confirmed_stories."""

engineering_task_generation_agent = build_agent(
    EngineeringTaskCandidateSet, _ENGINEERING_TASK_GENERATION_PROMPT
)


async def generate_engineering_tasks(
    request: EngineeringTaskGenerationRequest,
) -> EngineeringTaskCandidateSet:
    return await run_structured(
        engineering_task_generation_agent, request.model_dump_json(indent=2), stage=6
    )
