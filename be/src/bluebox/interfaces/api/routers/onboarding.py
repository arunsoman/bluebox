"""doc/api_event_contract.md SS2.1-SS2.4.

`/input` deviates from the contract's `InputAccepted` (queued + async
WS-pushed result): this pass's `OnboardingService.submit_input` runs
synchronously and this REST handler returns its full `OnboardingResult`
inline rather than an `input_id` to poll - the async, event-pushed version
of this flow is the WebSocket steering session (Task 9), not this REST
route. `/upload` and `/git-connect` are not implemented (no file storage /
git integration built this pass).

UPDATE: Now emits WebSocket events during processing by broadcasting through
the connection registry, so the frontend sees real-time progress.

UPDATE 2: Added the Minimalist Dialogue (SS2.3) and Seed Builder (SS2.4) GET
routes, and fixed `/dialogue/seed POST`'s request model - it was shaped like
SS2.3's `MinimalistResponse` (flat `answers: SeedAnswer[]`), not SS2.4's
actual `SeedBuilderResponse` (`step_id` + `field_values` + `navigation`), so
`SeedBuilderView.tsx` (which sends the real shape) always got a 422. Both
dialogues are deterministic/fixed-content (5 Minimalist questions, 3 Seed
Builder steps - directly the 5 `Stage0Seed` fields, one question/field
each) rather than LLM-generated: `OnboardingService.submit_seed_dialogue`'s
`synthesize_seed` call already does the actual interpretive work (turning
free-text answers into a coherent `Stage0Seed`), so generating the
*questions* doesn't need a model call too - same reasoning
`seed_synthesis_agent`'s docstring already gives for why both dialogue
types converge on one LLM call.
"""

import uuid
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict

from bluebox.interfaces.api.auth import UserProfile, get_current_user
from bluebox.interfaces.api.deps import get_onboarding_service
from bluebox.interfaces.stage_advance import (
    FIRST_GENERATIVE_STAGE,
    run_stage_and_cache,
    steering_panel_ready_payload,
)
from bluebox.interfaces.ws.connection_registry import connection_registry
from bluebox.modules.core_pipeline.application.onboarding_service import (
    OnboardingResult,
    OnboardingService,
)
from bluebox.modules.input_processing.domain.prd_submission import PrdSubmission
from bluebox.modules.input_processing.llm.responses import PRDAnalysisReport, Stage0Seed
from bluebox.shared_kernel.infrastructure.in_memory import app_state

router = APIRouter(prefix="/api/v1/projects/{project_id}", tags=["onboarding"])

# NOTE: MINIMALIST/SEED_ONLY input (these two dialogues) lands on
# STAGE_RUNNING same as a WELL_FORMED PRD, and per AC-RI-04 *should* then run
# Stage 1 ideation - but `steering_service.py`'s candidate->Node mapping
# (`_STAGE_NAMES`/`_candidates_to_nodes`) only covers stages 2-6; Stage 1's
# `IdeationOptionsResult` was never wired into accept/preview at all (raises
# ValueError). Auto-advancing here the way `/input` does for stage 2 would
# just move the "stuck panel" bug onto a 500 instead of fixing it, so this
# path is deliberately left as a follow-up, not patched over with a guess at
# the missing mapping.

# The 5 `Stage0Seed` fields are the fixed vocabulary both dialogue types
# collect answers for - keeping these names identical end-to-end (Minimalist
# question_id, Seed Builder field_id, and the dict key `submit_seed_dialogue`
# forwards to `synthesize_seed`) is what lets one normalization helper below
# serve both dialogue types.
_LIST_FIELDS = {"target_users", "core_functionality", "constraints", "success_metrics"}


def _normalize_answer(field_id: str, value: Any) -> str | list[str] | float:
    """`Stage0Seed`'s list fields arrive as one free-text/string field from
    both dialogue UIs (a textarea or a text input, never a real multi-value
    widget) - split on commas/newlines so `synthesize_seed` sees a list
    matching `SeedSynthesisRequest.answers`'s declared type, not one
    run-on string."""

    if field_id not in _LIST_FIELDS:
        return value if isinstance(value, (str, float, int)) else str(value)
    if isinstance(value, list):
        return [str(v).strip() for v in value if str(v).strip()]
    return [part.strip() for part in str(value).replace("\n", ",").split(",") if part.strip()]


def _best_effort_seed(answers: dict[str, Any]) -> Stage0Seed:
    """Cheap, non-LLM `Stage0Seed` for Seed Builder's intermediate
    next/back steps - `DialogueResult.seed` isn't optional in the contract,
    but calling `synthesize_seed` (an LLM round trip) on every step
    transition just to fill a field nothing reads until `navigation=submit`
    would be wasted latency. Real synthesis happens once, on submit."""

    return Stage0Seed(
        problem_statement=str(answers.get("problem_statement", "")),
        target_users=_normalize_answer("target_users", answers.get("target_users", [])),  # type: ignore[arg-type]
        core_functionality=_normalize_answer("core_functionality", answers.get("core_functionality", [])),  # type: ignore[arg-type]
        constraints=_normalize_answer("constraints", answers.get("constraints", [])),  # type: ignore[arg-type]
        success_metrics=_normalize_answer("success_metrics", answers.get("success_metrics", [])),  # type: ignore[arg-type]
    )


class RawUserInput(BaseModel):
    model_config = ConfigDict(extra="ignore")  # Ignore extra fields like trust_mode

    source: Literal["text", "voice", "template"] = "text"
    text: str
    trust_mode: Literal["PARANOID", "BALANCED", "AUTO_PILOT"] | None = None


class MinimalistQuestion(BaseModel):
    """doc/api_event_contract.md SS2.3 `MinimalistQuestion`."""

    model_config = ConfigDict(extra="forbid")

    question_id: str
    question_number: int
    total_questions: int
    question_text: str
    input_type: Literal["free_text", "single_select", "multi_select", "numeric"]
    options: list[str] | None = None
    validation_rules: dict[str, Any] | None = None
    suggested_answer: str | None = None
    context: str | None = None


class MinimalistDialogue(BaseModel):
    """doc/api_event_contract.md SS2.3 `MinimalistDialogue`."""

    model_config = ConfigDict(extra="forbid")

    dialogue_id: str
    questions: list[MinimalistQuestion]
    estimated_completion_time_ms: int


class MinimalistAnswer(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question_id: str
    answer: str | list[str] | float
    skipped: bool = False
    override_suggested: bool = False


class MinimalistResponse(BaseModel):
    """doc/api_event_contract.md SS2.3 `MinimalistResponse`."""

    model_config = ConfigDict(extra="forbid")

    dialogue_id: str
    answers: list[MinimalistAnswer]


class ValidationError(BaseModel):
    """doc/api_event_contract.md SS9.4-style `ValidationError` shape (field_path/error_code/severity)."""

    model_config = ConfigDict(extra="forbid")

    field_path: str
    error_code: str
    message: str
    severity: Literal["blocking", "critical"]
    suggested_fix: str | None = None


class DialogueResult(BaseModel):
    """doc/api_event_contract.md SS2.3/SS2.4 `DialogueResult` - shared response shape."""

    model_config = ConfigDict(extra="forbid")

    status: Literal["complete", "incomplete", "validation_failed"]
    seed: Stage0Seed
    next_stage: int
    validation_errors: list[ValidationError] | None = None


class SeedField(BaseModel):
    """doc/api_event_contract.md SS2.4 `SeedField`."""

    model_config = ConfigDict(extra="forbid")

    field_id: str
    field_name: str
    field_type: Literal["text", "number", "select", "boolean"]
    required: bool
    options: list[str] | None = None
    validation: dict[str, Any] | None = None


class SeedStep(BaseModel):
    """doc/api_event_contract.md SS2.4 `SeedStep`."""

    model_config = ConfigDict(extra="forbid")

    step_id: str
    step_number: int
    total_steps: int
    step_name: str
    description: str
    fields: list[SeedField]


class SeedBuilderDialogue(BaseModel):
    """doc/api_event_contract.md SS2.4 `SeedBuilderDialogue`."""

    model_config = ConfigDict(extra="forbid")

    dialogue_id: str
    steps: list[SeedStep]
    progress: float


class SeedBuilderResponse(BaseModel):
    """doc/api_event_contract.md SS2.4 `SeedBuilderResponse` - the actual
    contract shape (one step's field values + wizard navigation), not the
    flat per-question shape this was previously (wrongly) modeled as."""

    model_config = ConfigDict(extra="forbid")

    dialogue_id: str
    step_id: str
    field_values: dict[str, Any]
    navigation: Literal["next", "back", "submit"]


_MINIMALIST_QUESTIONS: list[MinimalistQuestion] = [
    MinimalistQuestion(
        question_id="problem_statement", question_number=1, total_questions=5,
        question_text="What problem are you solving, and who is it for?",
        input_type="free_text", validation_rules={"required": True},
    ),
    MinimalistQuestion(
        question_id="target_users", question_number=2, total_questions=5,
        question_text="Who are the target users or customer types? (comma-separated)",
        input_type="free_text", validation_rules={"required": False},
    ),
    MinimalistQuestion(
        question_id="core_functionality", question_number=3, total_questions=5,
        question_text="What are the core features or capabilities? (comma-separated)",
        input_type="free_text", validation_rules={"required": False},
    ),
    MinimalistQuestion(
        question_id="constraints", question_number=4, total_questions=5,
        question_text="Any constraints - budget, timeline, technology, compliance? (comma-separated)",
        input_type="free_text", validation_rules={"required": False},
    ),
    MinimalistQuestion(
        question_id="success_metrics", question_number=5, total_questions=5,
        question_text="How will you know this succeeded? (comma-separated success metrics)",
        input_type="free_text", validation_rules={"required": False},
    ),
]

_SEED_STEPS: list[SeedStep] = [
    SeedStep(
        step_id="problem", step_number=1, total_steps=3, step_name="Define the problem",
        description="What are you building, and for whom?",
        fields=[
            SeedField(field_id="problem_statement", field_name="Problem statement", field_type="text", required=True),
            SeedField(field_id="target_users", field_name="Target users (comma-separated)", field_type="text", required=False),
        ],
    ),
    SeedStep(
        step_id="functionality", step_number=2, total_steps=3, step_name="Define functionality",
        description="What does it do, and what bounds it?",
        fields=[
            SeedField(field_id="core_functionality", field_name="Core functionality (comma-separated)", field_type="text", required=False),
            SeedField(field_id="constraints", field_name="Constraints (comma-separated)", field_type="text", required=False),
        ],
    ),
    SeedStep(
        step_id="success", step_number=3, total_steps=3, step_name="Define success",
        description="How will you know it worked?",
        fields=[
            SeedField(field_id="success_metrics", field_name="Success metrics (comma-separated)", field_type="text", required=False),
        ],
    ),
]


@router.post("/input", response_model=OnboardingResult)
async def submit_input(
    project_id: str,
    request: RawUserInput,
    service: OnboardingService = Depends(get_onboarding_service),
) -> OnboardingResult:
    # Pushes progress/result events to the project's steering WS connection(s)
    # as this (synchronous) request runs - via the connection registry's
    # `broadcast`, which also logs each frame to the log viewer the same way
    # `steering_session.py`'s `_send` does for the WS-driven flow.
    async def broadcast_event(event: str, payload: dict[str, Any]) -> None:
        await connection_registry.broadcast(project_id, event, payload)

    result = await service.submit_input(
        project_id,
        raw_text=request.text,
        source=request.source,
        broadcast_event=broadcast_event,
    )

    # WELL_FORMED input lands `submit_input` straight on STAGE_RUNNING (AC-RI-04 -
    # no Stage 1 ideation for a well-formed PRD). Nothing else triggers Stage 2
    # (Actor Discovery) from here unless we do it - the WS session's equivalent
    # auto-advance (`steering_session._handle_user_input`) only fires for the
    # WS `USER_INPUT` event, which this REST-only frontend never sends.
    orchestrator = app_state.sessions.get_or_create(project_id)
    if orchestrator.current_state == "STAGE_RUNNING":
        candidates = await run_stage_and_cache(project_id, FIRST_GENERATIVE_STAGE, context=request.text)
        await broadcast_event(
            "STEERING_PANEL_READY",
            steering_panel_ready_payload(project_id, FIRST_GENERATIVE_STAGE, candidates),
        )

    return result


@router.get("/prd", response_model=PrdSubmission)
def get_prd_submission(project_id: str) -> PrdSubmission:
    """Not part of doc/api_event_contract.md - see `PrdSubmission`'s
    docstring. Backs the IDE workspace's PRD tab showing a previously-
    submitted PRD once the project has moved past onboarding (404 if
    `/input` was never called for this project)."""

    submission = app_state.prd_submissions.get(project_id)
    if submission is None:
        raise HTTPException(404, detail=f"no PRD submission recorded for project {project_id!r}")
    return submission


class SectionNameRequest(BaseModel):
    """Shared body shape for the 4 of 5 PRD-analysis actions below that only
    need to name a section. Not part of doc/api_event_contract.md - see
    `get_prd_submission`'s docstring for the same precedent; these address
    doc/prd.md AC-RI-06, which has no corresponding contract endpoint."""

    model_config = ConfigDict(extra="forbid")

    section_name: str


class MapToStageRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    section_name: str
    stage: int


@router.post("/prd/unmapped-sections/map-to-stage", response_model=PRDAnalysisReport)
async def map_unmapped_section_to_stage(
    project_id: str,
    request: MapToStageRequest,
    service: OnboardingService = Depends(get_onboarding_service),
) -> PRDAnalysisReport:
    try:
        return await service.map_unmapped_section_to_stage(project_id, request.section_name, request.stage)
    except ValueError as exc:
        raise HTTPException(404, detail=str(exc)) from exc


@router.post("/prd/unmapped-sections/save-as-annotation", response_model=PRDAnalysisReport)
async def save_unmapped_section_as_annotation(
    project_id: str,
    request: SectionNameRequest,
    user: UserProfile = Depends(get_current_user),
    service: OnboardingService = Depends(get_onboarding_service),
) -> PRDAnalysisReport:
    try:
        return await service.save_unmapped_section_as_annotation(project_id, request.section_name, user.user_id)
    except ValueError as exc:
        raise HTTPException(404, detail=str(exc)) from exc


@router.post("/prd/unmapped-sections/mark-out-of-scope", response_model=PRDAnalysisReport)
async def mark_unmapped_section_out_of_scope(
    project_id: str,
    request: SectionNameRequest,
    service: OnboardingService = Depends(get_onboarding_service),
) -> PRDAnalysisReport:
    try:
        return await service.mark_unmapped_section_out_of_scope(project_id, request.section_name)
    except ValueError as exc:
        raise HTTPException(404, detail=str(exc)) from exc


@router.post("/prd/missing-sections/generate", response_model=PRDAnalysisReport)
async def generate_missing_section_content(
    project_id: str,
    request: SectionNameRequest,
    service: OnboardingService = Depends(get_onboarding_service),
) -> PRDAnalysisReport:
    try:
        return await service.generate_missing_section_content(project_id, request.section_name)
    except ValueError as exc:
        raise HTTPException(404, detail=str(exc)) from exc


@router.post("/prd/thin-sections/add-detail", response_model=PRDAnalysisReport)
async def add_thin_section_detail(
    project_id: str,
    request: SectionNameRequest,
    service: OnboardingService = Depends(get_onboarding_service),
) -> PRDAnalysisReport:
    try:
        return await service.add_thin_section_detail(project_id, request.section_name)
    except ValueError as exc:
        raise HTTPException(404, detail=str(exc)) from exc


@router.get("/dialogue/minimalist", response_model=MinimalistDialogue)
def get_minimalist_dialogue(project_id: str) -> MinimalistDialogue:
    return MinimalistDialogue(
        dialogue_id=f"dlg-{uuid.uuid4().hex[:8]}",
        questions=_MINIMALIST_QUESTIONS,
        estimated_completion_time_ms=60_000,
    )


@router.post("/dialogue/minimalist", response_model=DialogueResult)
async def submit_minimalist_dialogue(
    project_id: str,
    request: MinimalistResponse,
    service: OnboardingService = Depends(get_onboarding_service),
) -> DialogueResult:
    answers = {
        a.question_id: _normalize_answer(a.question_id, a.answer) for a in request.answers if not a.skipped
    }
    seed = await service.submit_seed_dialogue(project_id, request.dialogue_id, answers)
    return DialogueResult(status="complete", seed=seed, next_stage=1)


@router.get("/dialogue/seed", response_model=SeedBuilderDialogue)
def get_seed_builder_dialogue(project_id: str) -> SeedBuilderDialogue:
    return SeedBuilderDialogue(dialogue_id=f"dlg-{uuid.uuid4().hex[:8]}", steps=_SEED_STEPS, progress=0.0)


@router.post("/dialogue/seed", response_model=DialogueResult)
async def submit_seed_dialogue(
    project_id: str,
    request: SeedBuilderResponse,
    service: OnboardingService = Depends(get_onboarding_service),
) -> DialogueResult:
    if request.navigation != "submit":
        # `field_values` is the whole wizard's accumulated values, not just
        # this step's (SeedBuilderView.tsx keeps one `values` object across
        # every step) - cheap to reflect back without a real LLM synthesis
        # call, since nothing acts on `seed` until the final submit.
        return DialogueResult(status="incomplete", seed=_best_effort_seed(request.field_values), next_stage=0)

    answers = {k: _normalize_answer(k, v) for k, v in request.field_values.items()}
    seed = await service.submit_seed_dialogue(project_id, request.dialogue_id, answers)
    return DialogueResult(status="complete", seed=seed, next_stage=1)
