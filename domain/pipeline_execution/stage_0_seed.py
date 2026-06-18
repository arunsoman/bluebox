"""Stage 0 -- Seed Builder.

Classifies the user's raw input, then runs the appropriate processing path:
  * WELL_FORMED   -> PRD analysis, then build seed
  * MINIMALIST    -> dialogue-driven seed construction
  * SEED_ONLY     -> ask seed questions, build seed

Emits ``RICHNESS_MODE_DETECTED``, ``PRD_ANALYSIS_READY``,
``STEERING_PANEL_READY``.
"""
from __future__ import annotations

import json
import uuid
from typing import Any

from domain.models import (
    ExtractionReport,
    IdeaSeed,
    MinimalistDialogueResult,
    MinimalistQuestion,
    PRDAnalysisReport,
    ProblemDefinitionSeed,
    ProjectBlueprintSeed,
    RawUserInput,
    RichnessClassification,
    RichnessMode,
    ScaleInputs,
    StageName,
    TargetCustomerProfile,
    TechStackSignal,
)
from domain.pipeline_execution.base_stage import BaseStage
from domain.pipeline_execution.chunked_streaming import ChunkedStreamingStrategy
from infrastructure.llm.llm_provider import LLMClient
from infrastructure.messaging.sse_manager import sse_manager


class Stage0SeedBuilder(BaseStage):
    """Builds the initial :class:`ProjectBlueprintSeed` from raw user input."""

    stage_name = StageName.PRD_ANALYSIS
    input_model = RawUserInput
    output_model = ProjectBlueprintSeed

    # ------------------------------------------------------------------
    # Prompt templates
    # ------------------------------------------------------------------

    _CLASSIFY_PROMPT = (
        "You are an input classifier for a product-definition pipeline.\n"
        "Analyze the following user input and classify its richness:\n\n"
        "{input_text}\n\n"
        "Classify as:\n"
        "- WELL_FORMED: Detailed PRD, product spec, or comprehensive description\n"
        "- MINIMALIST: Brief idea, one-liner, or short description\n"
        "- SEED_ONLY: Incomplete or ambiguous input needing clarification\n\n"
        "Return JSON matching the RichnessClassification schema."
    )

    _PRD_ANALYZE_PROMPT = (
        "You are a PRD analyzer. Extract structured information from:\n\n"
        "{input_text}\n\n"
        "Identify: explicit sections, thin sections, missing sections, "
        "conflicts, assumptions, compliance frameworks.\n"
        "Return JSON matching the PRDAnalysisReport schema."
    )

    _MINIMALIST_DIALOGUE_PROMPT = (
        "The user provided a brief product idea:\n\n"
        "{input_text}\n\n"
        "Generate 5-7 clarifying questions covering: problem_scope, "
        "user_base, scale_intent, monetization, constraints, success_definition.\n"
        "Return JSON with a 'questions' array. Each question needs question_id, "
        "dimension, and question_text."
    )

    _SYNTHESIZE_FROM_DIALOGUE_PROMPT = (
        "Using the user's brief idea and their answers, synthesize a "
        "ProblemDefinitionSeed:\n\n"
        "Original idea: {input_text}\n"
        "Answers: {answers}\n\n"
        "Return JSON with fields: problem_statement (string), "
        "constraints (list of strings), target_customer (object with segment, "
        "industry, geography, user_count_estimate, technical_sophistication)."
    )

    _SEED_QUESTIONS_PROMPT = (
        "The user input is incomplete. Generate 5 seed-building questions:\n\n"
        "{input_text}\n\n"
        "Return JSON with a 'questions' array (question_id, dimension, question_text)."
    )

    _BUILD_SEED_PROMPT = (
        "Build a ProjectBlueprintSeed from the following information:\n\n"
        "Richness mode: {richness_mode}\n"
        "Problem statement: {problem_statement}\n"
        "Constraints: {constraints}\n"
        "Target customer: {target_customer}\n"
        "Scale inputs: {scale_inputs}\n\n"
        "Return JSON matching the ProjectBlueprintSeed schema with:\n"
        "- seed_id (generate a UUID)\n"
        "- project_name (derive from problem statement)\n"
        "- problem_seed (with problem_statement, constraints, target_customer, scale_inputs)\n"
        "- richness_mode\n"
        "- created_at (ISO timestamp)\n"
        "Include idea_seeds, actor_seeds, capability_seeds, use_case_seeds, user_story_seeds "
        "as empty arrays."
    )

    def __init__(self) -> None:
        self._streamer = ChunkedStreamingStrategy()

    # ------------------------------------------------------------------
    # Public entrypoint
    # ------------------------------------------------------------------

    async def run(
        self,
        session_id: str,
        input_data: dict[str, Any],
        llm_client: LLMClient,
    ) -> dict[str, Any]:
        raw = RawUserInput(**input_data)

        await self._emit_stage_started(session_id)

        # ---- 1. Richness classification --------------------------------
        classification = await self._classify_input(session_id, raw, llm_client)

        await sse_manager.emit_richness_mode(
            session_id,
            mode=classification.mode.value,
            confidence=classification.confidence.value,
            basis=classification.classification_basis,
        )

        # ---- 2. Route by richness mode ---------------------------------
        if classification.mode == RichnessMode.WELL_FORMED:
            seed = await self._process_well_formed(session_id, raw, llm_client)
        elif classification.mode == RichnessMode.MINIMALIST:
            seed = await self._process_minimalist(session_id, raw, llm_client)
        else:  # SEED_ONLY
            seed = await self._process_seed_only(session_id, raw, llm_client)

        # ---- 3. Build and emit steering panel --------------------------
        draft = seed.model_dump()
        options = self._build_steering_options(seed)
        await self._emit_steering_panel(session_id, draft, options)

        # ---- 4. Wait for steering action -------------------------------
        steering = await self._wait_for_steering(session_id)
        action_type = steering.get("action_type", "CONFIRM_SEED")

        if action_type in ("MODIFY", "REPLACE"):
            seed = await self._apply_steering(seed, steering, llm_client)
            draft = seed.model_dump()

        # ---- 5. Complete -----------------------------------------------
        checkpoint_data = {"stage": self.stage_name.value, "seed": draft}
        await self._emit_stage_completed(session_id, checkpoint_data)

        return draft

    # ------------------------------------------------------------------
    # Classification
    # ------------------------------------------------------------------

    async def _classify_input(
        self,
        session_id: str,
        raw: RawUserInput,
        llm_client: LLMClient,
    ) -> RichnessClassification:
        prompt = self._CLASSIFY_PROMPT.format(input_text=raw.text)
        result = await llm_client.complete_structured(
            prompt, RichnessClassification, temperature=0.3
        )
        # Override with user-provided mode if explicitly set
        if raw.richness_mode != RichnessMode.SEED_ONLY:
            result.mode = raw.richness_mode
        return result

    # ------------------------------------------------------------------
    # WELL_FORMED path
    # ------------------------------------------------------------------

    async def _process_well_formed(
        self,
        session_id: str,
        raw: RawUserInput,
        llm_client: LLMClient,
    ) -> ProjectBlueprintSeed:
        """Run PRD analysis, then synthesize a seed from the report."""
        prompt = self._PRD_ANALYZE_PROMPT.format(input_text=raw.text)
        report = await llm_client.complete_structured(
            prompt, PRDAnalysisReport, temperature=0.3
        )

        await sse_manager.emit_prd_analysis(session_id, report.model_dump())

        # Derive problem definition from PRD analysis
        problem_seed = await self._derive_problem_from_prd(raw, report, llm_client)
        seed = await self._build_full_seed(problem_seed, RichnessMode.WELL_FORMED, llm_client)
        seed.extraction_report = self._report_to_extraction(report)
        return seed

    async def _derive_problem_from_prd(
        self,
        raw: RawUserInput,
        report: PRDAnalysisReport,
        llm_client: LLMClient,
    ) -> ProblemDefinitionSeed:
        prompt = (
            "Extract a ProblemDefinitionSeed from this PRD analysis:\n\n"
            f"Original text: {raw.text[:2000]}\n\n"
            f"Explicit sections: {json.dumps([s for s in report.explicit_sections], default=str)}\n"
            f"Missing sections: {json.dumps([s for s in report.missing_sections], default=str)}\n"
            f"Assumptions: {json.dumps([a.model_dump() for a in report.assumption_flags], default=str)}\n\n"
            "Return JSON with: problem_statement, constraints (list), "
            "target_customer (object with segment, industry, geography, "
            "user_count_estimate, technical_sophistication)."
        )
        return await llm_client.complete_structured(
            prompt, ProblemDefinitionSeed, temperature=0.4
        )

    # ------------------------------------------------------------------
    # MINIMALIST path
    # ------------------------------------------------------------------

    async def _process_minimalist(
        self,
        session_id: str,
        raw: RawUserInput,
        llm_client: LLMClient,
    ) -> ProjectBlueprintSeed:
        """Run clarifying dialogue, synthesize seed from answers."""
        # Generate questions
        prompt = self._MINIMALIST_DIALOGUE_PROMPT.format(input_text=raw.text)
        dialogue = await llm_client.complete_structured(
            prompt, MinimalistDialogueResult, temperature=0.5
        )

        # If user already provided dialogue answers, use them
        if raw.minimalist_dialogue_result:
            dialogue = raw.minimalist_dialogue_result

        # For now, emit the questions and use them to build seed
        # (In a real flow, the user would answer via steering)
        answers = {q.question_id: q.answer or q.inferred_answer or "" for q in dialogue.questions}

        # Synthesize problem definition
        synth_prompt = self._SYNTHESIZE_FROM_DIALOGUE_PROMPT.format(
            input_text=raw.text,
            answers=json.dumps(answers, default=str),
        )
        problem_seed = await llm_client.complete_structured(
            synth_prompt, ProblemDefinitionSeed, temperature=0.4
        )

        seed = await self._build_full_seed(problem_seed, RichnessMode.MINIMALIST, llm_client)
        return seed

    # ------------------------------------------------------------------
    # SEED_ONLY path
    # ------------------------------------------------------------------

    async def _process_seed_only(
        self,
        session_id: str,
        raw: RawUserInput,
        llm_client: LLMClient,
    ) -> ProjectBlueprintSeed:
        """Ask clarifying seed questions, then build seed."""
        prompt = self._SEED_QUESTIONS_PROMPT.format(input_text=raw.text)
        dialogue = await llm_client.complete_structured(
            prompt, MinimalistDialogueResult, temperature=0.5
        )

        # Build minimal problem seed from what we have
        problem_seed = ProblemDefinitionSeed(
            problem_statement=raw.text[:500],
        )
        if raw.scale_inputs:
            problem_seed.scale_inputs = raw.scale_inputs

        seed = await self._build_full_seed(problem_seed, RichnessMode.SEED_ONLY, llm_client)
        return seed

    # ------------------------------------------------------------------
    # Seed construction helpers
    # ------------------------------------------------------------------

    async def _build_full_seed(
        self,
        problem_seed: ProblemDefinitionSeed,
        mode: RichnessMode,
        llm_client: LLMClient,
    ) -> ProjectBlueprintSeed:
        """Build a complete ProjectBlueprintSeed from a problem definition."""
        prompt = self._BUILD_SEED_PROMPT.format(
            richness_mode=mode.value,
            problem_statement=problem_seed.problem_statement,
            constraints=json.dumps(problem_seed.constraints, default=str),
            target_customer=problem_seed.target_customer.model_dump() if problem_seed.target_customer else "{}",
            scale_inputs=problem_seed.scale_inputs.model_dump() if problem_seed.scale_inputs else "{}",
        )
        seed = await llm_client.complete_structured(
            prompt, ProjectBlueprintSeed, temperature=0.4
        )
        # Ensure required fields are populated
        if not seed.seed_id:
            seed.seed_id = str(uuid.uuid4())
        seed.richness_mode = mode
        seed.problem_seed = problem_seed
        return seed

    def _report_to_extraction(self, report: PRDAnalysisReport) -> ExtractionReport:
        return ExtractionReport(
            gaps=[s.get("title", "") for s in report.missing_sections],
            unmapped_input=report.unmapped_input,
            conflicting_statements=report.conflicts,
            assumption_flags=report.assumption_flags,
            detected_compliance_frameworks=report.detected_compliance_frameworks,
            classification_basis=report.classification_basis,
        )

    def _build_steering_options(
        self, seed: ProjectBlueprintSeed
    ) -> list[dict[str, Any]]:
        return [
            {
                "option_id": "confirm_seed",
                "label": "Confirm seed and proceed",
                "rationale": "Accept the generated seed as-is",
                "confidence": "high",
            },
            {
                "option_id": "refine_problem",
                "label": "Refine problem statement",
                "rationale": "Edit the core problem definition",
                "confidence": "medium",
            },
            {
                "option_id": "add_constraints",
                "label": "Add or modify constraints",
                "rationale": "Specify additional constraints",
                "confidence": "medium",
            },
        ]

    async def _apply_steering(
        self,
        seed: ProjectBlueprintSeed,
        steering: dict[str, Any],
        llm_client: LLMClient,
    ) -> ProjectBlueprintSeed:
        """Apply a MODIFY/REPLACE steering action to the seed."""
        payload = steering.get("payload", {})
        modifications = payload.get("modifications", {})

        # Update problem statement if provided
        if "problem_statement" in modifications:
            seed.problem_seed.problem_statement = modifications["problem_statement"]
        if "constraints" in modifications:
            seed.problem_seed.constraints = modifications["constraints"]
        if "project_name" in modifications:
            seed.project_name = modifications["project_name"]

        # Re-analyze with LLM if significant changes
        if modifications:
            reanalysis_prompt = (
                f"Given this updated problem statement:\n\n"
                f"{seed.problem_seed.problem_statement}\n\n"
                f"Constraints: {json.dumps(seed.problem_seed.constraints)}\n\n"
                "Revalidate and improve the ProjectBlueprintSeed. "
                "Return the updated seed as JSON."
            )
            updated = await llm_client.complete_structured(
                reanalysis_prompt, ProjectBlueprintSeed, temperature=0.3
            )
            # Preserve the seed_id and merge problem seed
            updated.seed_id = seed.seed_id
            updated.problem_seed = seed.problem_seed
            updated.richness_mode = seed.richness_mode
            return updated

        return seed
