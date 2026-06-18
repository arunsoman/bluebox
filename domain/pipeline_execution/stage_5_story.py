"""Stage 5 -- Story Discovery.

Generates user stories from confirmed use cases and capabilities. Each story
has acceptance criteria in Given/When/Then format and is tagged with
``traceability``, ``priority``, and ``story_points``.

Requires both ``UseCaseSetSeed`` and ``CapabilitySetSeed`` as input.

Emits stories as :class:`StreamChunk`s and ``STEERING_PANEL_READY``.
"""
from __future__ import annotations

import json
import uuid
from typing import Any

from domain.models import (
    AcceptanceCriterion,
    Capability,
    CapabilitySet,
    StageName,
    StoryPriority,
    StreamChunk,
    Traceability,
    UseCase,
    UseCaseSet,
    UserStory,
    UserStorySet,
)
from domain.pipeline_execution.base_stage import BaseStage
from domain.pipeline_execution.chunked_streaming import ChunkedStreamingStrategy
from infrastructure.llm.llm_provider import LLMClient
from infrastructure.messaging.sse_manager import sse_manager


class Stage5StoryDiscovery(BaseStage):
    """Generates user stories from use cases and capabilities."""

    stage_name = StageName.STORY_DISCOVERY
    input_model = dict  # composite: {"use_cases": ..., "capabilities": ...}
    output_model = UserStorySet

    _GENERATE_PROMPT = (
        "You are an Agile business analyst. Given these use cases and capabilities, "
        "generate user stories with full acceptance criteria:\n\n"
        "Use Cases: {use_cases}\n\n"
        "Capabilities: {capabilities}\n\n"
        "For each user story provide:\n"
        "- story_id (unique string), actor\n"
        "- capability_id (which capability this story relates to)\n"
        "- use_case_id (which use case this story derives from)\n"
        "- story_text (As a <role>, I want <goal>, so that <reason>)\n"
        "- acceptance_criteria: list with criterion_id, given, when, then, test_type\n"
        "- priority: critical/high/medium/low\n"
        "- priority_rationale\n"
        "- story_points (1, 2, 3, 5, 8, 13, or 21)\n"
        "- dependencies (list of story_ids)\n"
        "- access_requirement\n"
        "- traceability: explicit/inferred/candidate\n\n"
        "Return JSON matching the UserStorySet schema with a 'user_stories' array."
    )

    _REFINE_PROMPT = (
        "Refine user stories based on user feedback:\n\n"
        "Current stories: {current_stories}\n"
        "Feedback: {feedback}\n\n"
        "Return updated UserStorySet as JSON."
    )

    def __init__(self) -> None:
        self._streamer = ChunkedStreamingStrategy()

    async def run(
        self,
        session_id: str,
        input_data: dict[str, Any],
        llm_client: LLMClient,
    ) -> dict[str, Any]:
        """Execute story discovery stage."""
        # Composite input: both use cases and capabilities
        use_case_set = UseCaseSet(**input_data.get("use_cases", {}))
        cap_set = CapabilitySet(**input_data.get("capabilities", {}))

        await self._emit_stage_started(session_id)

        # Generate stories via LLM
        story_set = await self._discover_stories(
            session_id, use_case_set, cap_set, llm_client
        )

        # Stream each story as a chunk
        interrupted = await self._stream_stories(session_id, story_set)
        if interrupted:
            pass

        await self._streamer.finalize(
            session_id, self.stage_name, len(story_set.user_stories)
        )

        # Build steering panel
        draft = story_set.model_dump()
        options = self._build_steering_options(story_set)
        await self._emit_steering_panel(session_id, draft, options)

        # Wait for steering
        steering = await self._wait_for_steering(session_id)
        action_type = steering.get("action_type", "ACCEPT")

        if action_type in ("MODIFY", "REPLACE"):
            story_set = await self._apply_steering(story_set, steering, llm_client)
            draft = story_set.model_dump()

        # Complete
        checkpoint_data = {
            "stage": self.stage_name.value,
            "story_set": draft,
        }
        await self._emit_stage_completed(session_id, checkpoint_data)

        return draft

    async def _discover_stories(
        self,
        session_id: str,
        use_case_set: UseCaseSet,
        cap_set: CapabilitySet,
        llm_client: LLMClient,
    ) -> UserStorySet:
        """Generate all user stories via LLM."""
        use_cases = []
        for uc in use_case_set.use_cases:
            use_cases.append({
                "use_case_id": uc.use_case_id,
                "title": uc.title,
                "primary_actor": uc.primary_actor,
                "main_flow": uc.main_flow,
                "preconditions": uc.preconditions,
                "postconditions": uc.postconditions,
                "capability_ids": uc.capability_ids,
                "data_entities_read": uc.data_entities_read,
                "data_entities_written": uc.data_entities_written,
            })

        capabilities = []
        for cap in cap_set.capabilities + cap_set.platform_capabilities:
            capabilities.append({
                "capability_id": cap.capability_id,
                "name": cap.name,
                "description": cap.description,
                "triggered_by": cap.triggered_by,
                "priority": cap.priority.value,
            })

        prompt = self._GENERATE_PROMPT.format(
            use_cases=json.dumps(use_cases, default=str),
            capabilities=json.dumps(capabilities, default=str),
        )
        story_set = await llm_client.complete_structured(
            prompt, UserStorySet, temperature=0.6
        )

        # Ensure IDs
        for story in story_set.user_stories:
            if not story.story_id:
                story.story_id = f"story_{uuid.uuid4().hex[:8]}"

        return story_set

    async def _stream_stories(
        self, session_id: str, story_set: UserStorySet
    ) -> bool:
        """Emit each story as a StreamChunk. Returns True if interrupted."""
        for idx, story in enumerate(story_set.user_stories):
            interrupted = await self._streamer.emit_node(
                node_data=story.model_dump(),
                stage=self.stage_name,
                chunk_index=idx,
                content_type="story",
                session_id=session_id,
            )
            if interrupted:
                return True
        return False

    def _build_steering_options(
        self, story_set: UserStorySet
    ) -> list[dict[str, Any]]:
        """Create steering options from generated stories."""
        options = []
        for story in story_set.user_stories:
            ac_count = len(story.acceptance_criteria)
            options.append({
                "option_id": f"select_{story.story_id}",
                "label": f"[{story.priority.value}] {story.story_text[:80]}",
                "rationale": f"AC: {ac_count} | Points: {story.story_points} | Actor: {story.actor}",
                "confidence": "high" if story.traceability == Traceability.EXPLICIT else "medium",
            })
        options.append({
            "option_id": "add_story",
            "label": "Add new user story",
            "rationale": "Define an additional story",
            "confidence": "medium",
        })
        options.append({
            "option_id": "split_story",
            "label": "Split large stories",
            "rationale": "Break down stories > 8 points",
            "confidence": "high",
        })
        options.append({
            "option_id": "re_estimate",
            "label": "Re-estimate story points",
            "rationale": "Re-evaluate all story point estimates",
            "confidence": "high",
        })
        return options

    async def _apply_steering(
        self,
        story_set: UserStorySet,
        steering: dict[str, Any],
        llm_client: LLMClient,
    ) -> UserStorySet:
        """Apply user steering to modify stories."""
        payload = steering.get("payload", {})
        selected_ids = payload.get("selected_story_ids", [])
        feedback = payload.get("feedback", "")

        if selected_ids:
            story_set.user_stories = [
                s for s in story_set.user_stories
                if s.story_id in selected_ids
            ]

        if feedback:
            current = json.dumps(story_set.model_dump(), default=str)
            prompt = self._REFINE_PROMPT.format(
                current_stories=current[:3000],
                feedback=feedback,
            )
            story_set = await llm_client.complete_structured(
                prompt, UserStorySet, temperature=0.4
            )

        return story_set
