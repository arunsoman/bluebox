"""Onboarding flow - doc/api_event_contract.md SS2.1-SS2.4; doc/prd.md SS4.1.

Submits raw input through RichnessClassifier -> PRDAnalyzer (WELL_FORMED) or
a seed dialogue (MINIMALIST/SEED_ONLY, via `submit_seed_dialogue`) ->
ComplianceAutoDetector, then advances the `PipelineOrchestrator`.
"""

import uuid
from typing import Awaitable, Callable, Any

from pydantic import BaseModel, ConfigDict

from bluebox.modules.input_processing.application.chunked_prd_analyzer import analyze_prd_adaptive
from bluebox.modules.input_processing.llm.agents import (
    classify_richness,
    detect_compliance,
    synthesize_seed,
)
from bluebox.modules.input_processing.llm.requests import (
    ComplianceDetectionRequest,
    RichnessClassificationRequest,
    SeedSynthesisRequest,
)
from bluebox.modules.input_processing.llm.responses import (
    ComplianceDetectionResult,
    PRDAnalysisReport,
    RichnessClassification,
    Stage0Seed,
)
from bluebox.shared_kernel.ports import SessionRepository

# Type for optional event broadcaster (avoids importing from interfaces/).
# Payload is `Any`, not `dict`, since richness/prd_analysis/compliance below
# are pydantic models forwarded as-is (the broadcaster's `jsonable_encoder`
# call handles them directly, same as every other WS send in this backend).
EventBroadcaster = Callable[[str, Any], Awaitable[None]]


class OnboardingResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    input_id: str  # Added for frontend tracking
    richness: RichnessClassification
    prd_analysis: PRDAnalysisReport | None = None
    compliance: ComplianceDetectionResult


class OnboardingService:
    def __init__(self, sessions: SessionRepository) -> None:
        self._sessions = sessions

    async def submit_input(
        self,
        project_id: str,
        raw_text: str,
        source: str = "text",
        broadcast_event: EventBroadcaster | None = None,
    ) -> OnboardingResult:
        input_id = f"inp-{uuid.uuid4().hex[:8]}"
        orchestrator = self._sessions.get_or_create(project_id)

        # CLASSIFYING has no self-loop edge (state_machine.py TRANSITIONS), so
        # any state other than INITIALIZED - including CLASSIFYING itself,
        # e.g. from a prior /input call that errored mid-flight - must be
        # reset before transitioning into CLASSIFYING again.
        if orchestrator.current_state != "INITIALIZED":
            orchestrator.restore_to("INITIALIZED", f"Auto-reset: overwriting with new {source} input")
            self._sessions.save(project_id, orchestrator)
            # Re-fetch to get fresh orchestrator
            orchestrator = self._sessions.get_or_create(project_id)

        orchestrator.transition("CLASSIFYING", reason="input received")

        # Emit INPUT_PROCESSING_STARTED
        if broadcast_event:
            await broadcast_event("INPUT_PROCESSING_STARTED", {
                "input_id": input_id,
                "steps": [
                    {"step_index": 0, "name": "Classifying richness"},
                    {"step_index": 1, "name": "Analyzing PRD structure"},
                    {"step_index": 2, "name": "Detecting compliance requirements"},
                ],
            })

        richness = await classify_richness(
            RichnessClassificationRequest(raw_text=raw_text, source=source)
        )

        # Emit PROCESSING_STEP_COMPLETE + RICHNESS_MODE_DETECTED for richness.
        # The latter is what `OnboardingFlow.tsx` actually waits on to leave
        # the "processing" screen - without it the UI hangs at 100% progress
        # forever, since this REST-triggered flow is the only one the
        # frontend drives (the WS `USER_INPUT` handler that already sent
        # this event is a separate, never-invoked code path from here).
        if broadcast_event:
            await broadcast_event("PROCESSING_STEP_COMPLETE", {"input_id": input_id, "step_index": 0})
            await broadcast_event("RICHNESS_MODE_DETECTED", richness)

        prd_analysis: PRDAnalysisReport | None = None
        if richness.mode == "WELL_FORMED":
            prd_analysis = await analyze_prd_adaptive(raw_text, richness)
            orchestrator.transition(
                "STAGE_RUNNING", reason="WELL_FORMED input, proceeding to stage executors"
            )

            # Emit PROCESSING_STEP_COMPLETE + PRD_ANALYSIS_READY
            if broadcast_event:
                await broadcast_event("PROCESSING_STEP_COMPLETE", {"input_id": input_id, "step_index": 1})
                await broadcast_event("PRD_ANALYSIS_READY", prd_analysis)
        else:
            orchestrator.transition(
                "AWAITING_INPUT_SEED", reason=f"{richness.mode} input needs clarification"
            )

        compliance = await detect_compliance(ComplianceDetectionRequest(raw_text=raw_text))

        # Emit PROCESSING_STEP_COMPLETE + COMPLIANCE_DETECTED
        if broadcast_event:
            await broadcast_event("PROCESSING_STEP_COMPLETE", {"input_id": input_id, "step_index": 2})
            await broadcast_event("COMPLIANCE_DETECTED", compliance)

        self._sessions.save(project_id, orchestrator)
        return OnboardingResult(
            input_id=input_id,
            richness=richness,
            prd_analysis=prd_analysis,
            compliance=compliance,
        )

    async def submit_seed_dialogue(
        self, project_id: str, dialogue_id: str, answers: dict[str, str | list[str] | float]
    ) -> Stage0Seed:
        """Resolves `AWAITING_INPUT_SEED` (Minimalist/Seed Builder dialogue
        answers) and proceeds to the stage executors."""

        orchestrator = self._sessions.get_or_create(project_id)
        seed = await synthesize_seed(SeedSynthesisRequest(dialogue_id=dialogue_id, answers=answers))
        orchestrator.transition("STAGE_RUNNING", reason="seed captured, proceeding to stage executors")
        self._sessions.save(project_id, orchestrator)
        return seed
