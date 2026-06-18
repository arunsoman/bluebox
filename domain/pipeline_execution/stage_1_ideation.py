"""Stage 1 -- Ideation.

Transforms a :class:`ProblemDefinitionSeed` into a :class:`ProductIdeaSet`.

* **WELL_FORMED**: validates idea consistency against the PRD instead of
  generating new options.
* **MINIMALIST / SEED_ONLY**: generates 3-5 ranked :class:`ProductIdea`
  options with rationale, confidence, and trade-offs.

Emits each idea as a :class:`StreamChunk`, then ``STEERING_PANEL_READY``.
"""
from __future__ import annotations

import json
import uuid
from typing import Any

from domain.models import (
    Confidence,
    IdeaSeed,
    PRDAnalysisReport,
    ProblemDefinitionSeed,
    ProductIdea,
    ProductIdeaSet,
    ProjectBlueprintSeed,
    RichnessMode,
    StageName,
    SteeringOption,
    StreamChunk,
    Traceability,
    TradeOff,
)
from domain.pipeline_execution.base_stage import BaseStage
from domain.pipeline_execution.chunked_streaming import ChunkedStreamingStrategy
from infrastructure.llm.llm_provider import LLMClient
from infrastructure.messaging.sse_manager import sse_manager


class Stage1Ideation(BaseStage):
    """Generates or validates product ideas from a problem definition."""

    stage_name = StageName.IDEATION
    input_model = ProblemDefinitionSeed
    output_model = ProductIdeaSet

    _GENERATE_PROMPT = (
        "You are a product strategist. Given this problem definition, "
        "generate 3-5 distinct product ideas:\n\n"
        "Problem: {problem_statement}\n"
        "Constraints: {constraints}\n"
        "Target customer: {target_customer}\n\n"
        "For each idea provide: idea_id (string), name, one_line_summary, "
        "value_proposition, target_customer_fit, differentiation, "
        "risk_factors (list), confidence (high/medium/low), confidence_basis, "
        "rank (1 is best), rationale, trade_offs (gains list, losses list).\n\n"
        "Return JSON matching the ProductIdeaSet schema with a top-level "
        "'ideas' array. Include the problem_statement and constraints at the top level."
    )

    _VALIDATE_PROMPT = (
        "You are a product validator. Given this problem definition and existing ideas, "
        "validate consistency and completeness:\n\n"
        "Problem: {problem_statement}\n"
        "Existing ideas: {ideas}\n\n"
        "Return JSON with:\n"
        "- problem_statement (echo back)\n"
        "- constraints (echo back)\n"
        "- ideas: list of validated ProductIdea objects with any gaps filled in, "
        "  confidence adjusted, and rank re-evaluated.\n"
        "Mark traceability as EXPLICIT for ideas derived from the problem statement."
    )

    def __init__(self) -> None:
        self._streamer = ChunkedStreamingStrategy()

    async def run(
        self,
        session_id: str,
        input_data: dict[str, Any],
        llm_client: LLMClient,
    ) -> dict[str, Any]:
        """Execute ideation stage."""
        problem = ProblemDefinitionSeed(**input_data)

        await self._emit_stage_started(session_id)

        # Determine richness mode from session context (passed in or default)
        richness_mode = input_data.get("_richness_mode", "SEED_ONLY")
        mode = RichnessMode(richness_mode) if richness_mode in [m.value for m in RichnessMode] else RichnessMode.SEED_ONLY

        if mode == RichnessMode.WELL_FORMED:
            idea_set = await self._validate_ideas(session_id, problem, llm_client)
        else:
            idea_set = await self._generate_ideas(session_id, problem, llm_client)

        # Stream each idea as a chunk
        interrupted = await self._stream_ideas(session_id, idea_set)
        if interrupted:
            # Handle mid-stage interruption by checkpointing current progress
            pass

        await self._streamer.finalize(
            session_id, self.stage_name, len(idea_set.ideas)
        )

        # Build steering options
        draft = idea_set.model_dump()
        options = self._build_steering_options(idea_set)
        await self._emit_steering_panel(session_id, draft, options)

        # Wait for steering
        steering = await self._wait_for_steering(session_id)
        action_type = steering.get("action_type", "ACCEPT")

        if action_type in ("MODIFY", "REPLACE"):
            idea_set = await self._apply_steering(idea_set, steering, llm_client)
            draft = idea_set.model_dump()

        # Complete
        checkpoint_data = {"stage": self.stage_name.value, "idea_set": draft}
        await self._emit_stage_completed(session_id, checkpoint_data)

        return draft

    async def _generate_ideas(
        self,
        session_id: str,
        problem: ProblemDefinitionSeed,
        llm_client: LLMClient,
    ) -> ProductIdeaSet:
        """Generate 3-5 product ideas via LLM."""
        target_customer = (
            problem.target_customer.model_dump() if problem.target_customer else {}
        )
        prompt = self._GENERATE_PROMPT.format(
            problem_statement=problem.problem_statement,
            constraints=json.dumps(problem.constraints, default=str),
            target_customer=json.dumps(target_customer, default=str),
        )
        idea_set = await llm_client.complete_structured(
            prompt, ProductIdeaSet, temperature=0.7
        )
        # Ensure each idea has required IDs
        for idea in idea_set.ideas:
            if not idea.idea_id:
                idea.idea_id = f"idea_{uuid.uuid4().hex[:8]}"
            idea.traceability = Traceability.CANDIDATE
        return idea_set

    async def _validate_ideas(
        self,
        session_id: str,
        problem: ProblemDefinitionSeed,
        llm_client: LLMClient,
    ) -> ProductIdeaSet:
        """Validate existing ideas against a well-formed PRD."""
        # For WELL_FORMED, we re-validate and may generate if none exist
        prompt = self._VALIDATE_PROMPT.format(
            problem_statement=problem.problem_statement,
            ideas="[]",  # Will be filled from any pre-existing seeds
        )
        idea_set = await llm_client.complete_structured(
            prompt, ProductIdeaSet, temperature=0.4
        )
        for idea in idea_set.ideas:
            if not idea.idea_id:
                idea.idea_id = f"idea_{uuid.uuid4().hex[:8]}"
            idea.traceability = Traceability.EXPLICIT
        return idea_set

    async def _stream_ideas(
        self, session_id: str, idea_set: ProductIdeaSet
    ) -> bool:
        """Emit each idea as a StreamChunk. Returns True if interrupted."""
        for idx, idea in enumerate(idea_set.ideas):
            interrupted = await self._streamer.emit_node(
                node_data=idea.model_dump(),
                stage=self.stage_name,
                chunk_index=idx,
                content_type="idea",
                session_id=session_id,
            )
            if interrupted:
                return True
        return False

    def _build_steering_options(
        self, idea_set: ProductIdeaSet
    ) -> list[dict[str, Any]]:
        """Create steering options from the generated ideas."""
        options = []
        for idea in idea_set.ideas:
            options.append({
                "option_id": idea.idea_id,
                "label": f"Select: {idea.name}",
                "rationale": idea.rationale,
                "confidence": idea.confidence.value,
                "trade_offs": idea.trade_offs.model_dump() if idea.trade_offs else {},
            })
        # Add meta-options
        options.append({
            "option_id": "generate_more",
            "label": "Generate more ideas",
            "rationale": "Request additional product ideas",
            "confidence": "medium",
        })
        options.append({
            "option_id": "merge_ideas",
            "label": "Merge/combine ideas",
            "rationale": "Create hybrid from selected ideas",
            "confidence": "medium",
        })
        return options

    async def _apply_steering(
        self,
        idea_set: ProductIdeaSet,
        steering: dict[str, Any],
        llm_client: LLMClient,
    ) -> ProductIdeaSet:
        """Apply user steering to modify the idea set."""
        payload = steering.get("payload", {})
        selected_ids = payload.get("selected_idea_ids", [])
        modifications = payload.get("modifications", {})

        if selected_ids:
            # Filter to selected ideas
            idea_set.ideas = [
                i for i in idea_set.ideas if i.idea_id in selected_ids
            ]
            # Re-rank
            for rank, idea in enumerate(idea_set.ideas, start=1):
                idea.rank = rank

        if modifications:
            # Apply modifications via LLM
            mod_prompt = (
                f"Modify these product ideas based on user feedback:\n\n"
                f"Ideas: {json.dumps([i.model_dump() for i in idea_set.ideas], default=str)}\n\n"
                f"Modifications: {json.dumps(modifications, default=str)}\n\n"
                "Return the updated ProductIdeaSet as JSON."
            )
            idea_set = await llm_client.complete_structured(
                mod_prompt, ProductIdeaSet, temperature=0.5
            )

        return idea_set
