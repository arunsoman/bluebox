"""pydantic-ai Agents for the Code Generation & Runtime module.

Stage 9 (RuntimeSandbox: running code, hot reload, test execution) has no
LLM call site - it executes what Stage 8 already generated, no agent here.
"""

from bluebox.modules.code_generation.llm.requests import (
    CodeFileGenerationRequest,
    InfrastructureCodeCompilationRequest,
    MergeConflictResolutionRequest,
    ProvenanceExplanationRequest,
    RBACMiddlewareCompilationRequest,
)
from bluebox.modules.code_generation.llm.responses import (
    GeneratedFileDraft,
    GeneratedFileDraftSet,
    MergeConflictResolutionSuggestion,
    ProvenanceExplanation,
)
from bluebox.shared_kernel.llm.connector import build_agent, run_structured

_CODE_FILE_GENERATION_PROMPT = """\
You generate the full content of exactly one file (file_path given) that
implements the given EngineeringTask, using the supplied tech_stack and
respecting every entry in the task's access_guards and
tech_stack_requirements. Include a ProvenanceHeader comment at the top of
the file referencing provenance.task_id, provenance.story_id,
provenance.decision_entry_id, and provenance.checkpoint_id. Output complete,
runnable code for this file only - no partial snippets, no other files'
content."""

code_file_generation_agent = build_agent(GeneratedFileDraft, _CODE_FILE_GENERATION_PROMPT)


async def generate_code_file(request: CodeFileGenerationRequest) -> GeneratedFileDraft:
    return await run_structured(code_file_generation_agent, request.model_dump_json(indent=2), stage=8)


_RBAC_MIDDLEWARE_COMPILATION_PROMPT = """\
You compile an RBAC role/permission summary into executable auth middleware
(route guards, permission-check decorators/functions) for the given
target_framework. Generate one file per logical concern (e.g. an
authentication middleware, a per-role authorization guard) rather than one
giant file. Every generated file must actually enforce the roles and
permission_resources given - do not generate a stub that always allows
access."""

rbac_middleware_compilation_agent = build_agent(
    GeneratedFileDraftSet, _RBAC_MIDDLEWARE_COMPILATION_PROMPT
)


async def compile_rbac_middleware(
    request: RBACMiddlewareCompilationRequest,
) -> GeneratedFileDraftSet:
    return await run_structured(
        rbac_middleware_compilation_agent, request.model_dump_json(indent=2), stage=8
    )


_INFRASTRUCTURE_CODE_COMPILATION_PROMPT = """\
You compile the selected hosting option into infrastructure-as-code files
(Terraform, Docker, CI/CD YAML as appropriate) for the given
target_provider. Reflect the option's actual components (compute, database,
cache, etc.) and their tiers - do not invent infrastructure not present in
selected_option, and do not omit any component it lists."""

infrastructure_code_compilation_agent = build_agent(
    GeneratedFileDraftSet, _INFRASTRUCTURE_CODE_COMPILATION_PROMPT
)


async def compile_infrastructure_code(
    request: InfrastructureCodeCompilationRequest,
) -> GeneratedFileDraftSet:
    return await run_structured(
        infrastructure_code_compilation_agent, request.model_dump_json(indent=2), stage=8
    )


_MERGE_CONFLICT_RESOLUTION_PROMPT = """\
You propose a resolved_value for a three-way merge conflict, given
base_value (original), ours_value (user's workspace edit), and theirs_value
(regenerated blueprint output) for one field. Prefer preserving the user's
intent from ours_value while incorporating theirs_value's substantive
change when the two are not actually in conflict (e.g. one renamed a
variable, the other added a new parameter). confidence should be low
whenever the two edits touch the same specific behavior in incompatible
ways - this is a suggestion for the user to review, not an auto-applied
resolution."""

merge_conflict_resolution_agent = build_agent(
    MergeConflictResolutionSuggestion, _MERGE_CONFLICT_RESOLUTION_PROMPT
)


async def resolve_merge_conflict(
    request: MergeConflictResolutionRequest,
) -> MergeConflictResolutionSuggestion:
    return await run_structured(merge_conflict_resolution_agent, request.model_dump_json(indent=2))


_PROVENANCE_EXPLANATION_PROMPT = """\
You write a plain-language explanation of why a generated file exists, for
a hover tooltip aimed at non-technical users. why_this_file_exists is one or
two sentences connecting the file to the task_description in everyday
language (no jargon like "EngineeringTask" or "node_id").
decision_chain_narrative walks the linked_story_title and decision_chain as
a short story ("This exists because you approved X, which led to Y, which
needed Z") rather than a bare list."""

provenance_explanation_agent = build_agent(ProvenanceExplanation, _PROVENANCE_EXPLANATION_PROMPT)


async def explain_provenance(request: ProvenanceExplanationRequest) -> ProvenanceExplanation:
    return await run_structured(provenance_explanation_agent, request.model_dump_json(indent=2))
