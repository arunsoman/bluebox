"""Onboarding flow - doc/api_event_contract.md SS2.1-SS2.4; doc/prd.md SS4.1.

Submits raw input through RichnessClassifier -> PRDAnalyzer (WELL_FORMED) or
a seed dialogue (MINIMALIST/SEED_ONLY, via `submit_seed_dialogue`) ->
ComplianceAutoDetector, then advances the `PipelineOrchestrator`.
"""

import uuid
from typing import Awaitable, Callable, Any

from pydantic import BaseModel, ConfigDict

from bluebox.modules.input_processing.application.chunked_prd_analyzer import analyze_prd_adaptive
from bluebox.modules.input_processing.domain.prd_submission import PrdSubmission
from bluebox.modules.input_processing.llm.agents import (
    classify_richness,
    detect_compliance,
    draft_section_content,
    synthesize_seed,
)
from bluebox.modules.input_processing.llm.requests import (
    ComplianceDetectionRequest,
    RichnessClassificationRequest,
    SectionContentDraftRequest,
    SeedSynthesisRequest,
)
from bluebox.modules.input_processing.llm.responses import (
    ComplianceDetectionResult,
    PRDAnalysisReport,
    PRDSection,
    RichnessClassification,
    Stage0Seed,
)
from bluebox.shared_kernel.domain.node import CustomAnnotationNode, NodeProvenance
from bluebox.shared_kernel.ports import NodeRepository, PrdSubmissionRepository, SessionRepository


def _new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8].upper()}"

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
    def __init__(
        self,
        sessions: SessionRepository,
        prd_submissions: PrdSubmissionRepository,
        nodes: NodeRepository,
    ) -> None:
        self._sessions = sessions
        self._prd_submissions = prd_submissions
        self._nodes = nodes

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
        # Durable beyond this one-shot WS/HTTP response - see PrdSubmission's
        # docstring for why (lets the IDE workspace's PRD tab show this again
        # after the project has moved past onboarding).
        self._prd_submissions.save(
            project_id,
            PrdSubmission(
                project_id=project_id,
                raw_text=raw_text,
                source=source,
                richness=richness,
                prd_analysis=prd_analysis,
                compliance=compliance,
            ),
        )
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

    def _get_submission(self, project_id: str) -> PrdSubmission:
        """Shared lookup for the 5 PRD-analysis mutation actions below
        (doc/prd.md AC-RI-06) - all of them read-mutate-write the same
        `PrdSubmission.prd_analysis` via the whole-object `PrdSubmissionRepository`."""

        submission = self._prd_submissions.get(project_id)
        if submission is None or submission.prd_analysis is None:
            raise ValueError(f"no PRD analysis recorded for project {project_id!r}")
        return submission

    async def map_unmapped_section_to_stage(
        self, project_id: str, section_name: str, stage: int
    ) -> PRDAnalysisReport:
        submission = self._get_submission(project_id)
        report = submission.prd_analysis
        assert report is not None
        report.unmapped_sections = [
            s for s in report.unmapped_sections if s.section_name != section_name
        ]
        report.explicit_sections.append(
            PRDSection(section_name=section_name, mapped_to_stage=stage, content_quality="partial")
        )
        self._prd_submissions.save(project_id, submission)
        return report

    async def save_unmapped_section_as_annotation(
        self, project_id: str, section_name: str, created_by: str
    ) -> PRDAnalysisReport:
        submission = self._get_submission(project_id)
        report = submission.prd_analysis
        assert report is not None
        section = next((s for s in report.unmapped_sections if s.section_name == section_name), None)
        if section is None:
            raise ValueError(f"unmapped section {section_name!r} not found")
        report.unmapped_sections = [
            s for s in report.unmapped_sections if s.section_name != section_name
        ]
        node = CustomAnnotationNode(
            node_id=_new_id("ANNOT"),
            name=section.section_name,
            description=section.content_preview,
            layer="cross_cutting",
            risk_classification="LOW_RISK",
            status="USER_DEFINED",
            created_by=created_by,
            provenance=NodeProvenance(generated_at_stage=0, decision_entry_id="n/a", checkpoint_id="n/a"),
            annotation_text=section.content_preview,
        )
        self._nodes.add(project_id, node)
        self._prd_submissions.save(project_id, submission)
        return report

    async def mark_unmapped_section_out_of_scope(
        self, project_id: str, section_name: str
    ) -> PRDAnalysisReport:
        submission = self._get_submission(project_id)
        report = submission.prd_analysis
        assert report is not None
        report.unmapped_sections = [
            s for s in report.unmapped_sections if s.section_name != section_name
        ]
        if section_name not in report.out_of_scope_sections:
            report.out_of_scope_sections.append(section_name)
        self._prd_submissions.save(project_id, submission)
        return report

    async def generate_missing_section_content(
        self, project_id: str, section_name: str
    ) -> PRDAnalysisReport:
        submission = self._get_submission(project_id)
        report = submission.prd_analysis
        assert report is not None
        section = next(
            (s for s in report.missing_sections if s.expected_section_name == section_name), None
        )
        if section is None:
            raise ValueError(f"missing section {section_name!r} not found")
        draft = await draft_section_content(
            SectionContentDraftRequest(
                raw_prd_text=submission.raw_text,
                section_name=section_name,
                guidance=(
                    f"Draft the missing '{section_name}' section "
                    f"(pipeline stage {section.pipeline_stage}, severity {section.severity})."
                ),
            )
        )
        section.generated_content = draft.content
        self._prd_submissions.save(project_id, submission)
        return report

    async def add_thin_section_detail(self, project_id: str, section_name: str) -> PRDAnalysisReport:
        submission = self._get_submission(project_id)
        report = submission.prd_analysis
        assert report is not None
        section = next((s for s in report.thin_sections if s.section_name == section_name), None)
        if section is None:
            raise ValueError(f"thin section {section_name!r} not found")
        draft = await draft_section_content(
            SectionContentDraftRequest(
                raw_prd_text=submission.raw_text,
                section_name=section_name,
                guidance=section.suggested_prompt,
            )
        )
        section.generated_content = draft.content
        self._prd_submissions.save(project_id, submission)
        return report
