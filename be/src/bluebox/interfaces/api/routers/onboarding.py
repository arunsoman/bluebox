"""doc/api_event_contract.md SS2.1-SS2.4.

`/input` deviates from the contract's `InputAccepted` (queued + async
WS-pushed result): this pass's `OnboardingService.submit_input` runs
synchronously and this REST handler returns its full `OnboardingResult`
inline rather than an `input_id` to poll - the async, event-pushed version
of this flow is the WebSocket steering session (Task 9), not this REST
route. `/upload` and `/git-connect` are not implemented (no file storage /
git integration built this pass).
"""

from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict

from bluebox.interfaces.api.deps import get_onboarding_service
from bluebox.modules.core_pipeline.application.onboarding_service import (
    OnboardingResult,
    OnboardingService,
)
from bluebox.modules.input_processing.llm.responses import Stage0Seed

router = APIRouter(prefix="/api/v1/projects/{project_id}", tags=["onboarding"])


class RawUserInput(BaseModel):
    model_config = ConfigDict(extra="ignore")  # Ignore extra fields like trust_mode

    source: Literal["text", "voice", "template"] = "text"
    text: str
    trust_mode: Literal["PARANOID", "BALANCED", "AUTO_PILOT"] | None = None


class SeedAnswer(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question_id: str
    answer: str | list[str] | float
    skipped: bool = False
    override_suggested: bool = False


class SeedBuilderResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    dialogue_id: str
    answers: list[SeedAnswer]


@router.post("/input", response_model=OnboardingResult)
async def submit_input(
    project_id: str,
    request: RawUserInput,
    service: OnboardingService = Depends(get_onboarding_service),
) -> OnboardingResult:
    return await service.submit_input(project_id, raw_text=request.text, source=request.source)


@router.post("/dialogue/seed", response_model=Stage0Seed)
async def submit_seed_dialogue(
    project_id: str,
    request: SeedBuilderResponse,
    service: OnboardingService = Depends(get_onboarding_service),
) -> Stage0Seed:
    answers = {a.question_id: a.answer for a in request.answers if not a.skipped}
    return await service.submit_seed_dialogue(project_id, request.dialogue_id, answers)
