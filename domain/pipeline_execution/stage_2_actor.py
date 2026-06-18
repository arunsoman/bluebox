"""Stage 2 -- Actor Discovery.

Discovers all actors (human, system, service, external) from the selected
product idea. Groups by :class:`ActorClass`, generates
:class:`RBACActorHint` for each, and emits each actor as a
:class:`StreamChunk`.
"""
from __future__ import annotations

import json
import uuid
from typing import Any

from domain.models import (
    Actor,
    ActorClass,
    ActorDiscoveryResult,
    ActorRelationship,
    ActorSeed,
    CapabilityLens,
    ProductIdea,
    ProductIdeaSet,
    RBACActorHint,
    StageName,
    StreamChunk,
    Traceability,
)
from domain.pipeline_execution.base_stage import BaseStage
from domain.pipeline_execution.chunked_streaming import ChunkedStreamingStrategy
from infrastructure.llm.llm_provider import LLMClient
from infrastructure.messaging.sse_manager import sse_manager


class Stage2ActorDiscovery(BaseStage):
    """Discovers and classifies all actors in a product idea."""

    stage_name = StageName.ACTOR_DISCOVERY
    input_model = ProductIdeaSet
    output_model = ActorDiscoveryResult

    _DISCOVER_PROMPT = (
        "You are a systems analyst. Given this product idea, identify ALL actors "
        "(users, systems, services, external entities) that interact with the product:\n\n"
        "Product: {product_name}\n"
        "Description: {product_description}\n"
        "Value proposition: {value_proposition}\n\n"
        "For each actor provide:\n"
        "- actor_id (unique string), name, type (human/system/service/external)\n"
        "- actor_class (human/system/service/external)\n"
        "- description (what they do)\n"
        "- is_platform_actor (bool)\n"
        "- permissions_hint (list of permission strings)\n"
        "- data_access_hint (list of data entity names)\n"
        "- traceability (candidate/inferred/explicit)\n\n"
        "Also provide:\n"
        "- relationship_map: list of ActorRelationship objects\n"
        "- actor_hierarchy: dict mapping parent actor_id to list of child actor_ids\n"
        "- platform_actors: list of actor objects that are platform/system actors\n"
        "- rbac_candidates: list of RBACActorHint objects\n\n"
        "Return JSON matching the ActorDiscoveryResult schema."
    )

    _REFINE_PROMPT = (
        "Refine the following actor discovery based on user feedback:\n\n"
        "Current actors: {current_actors}\n"
        "Feedback: {feedback}\n\n"
        "Return updated ActorDiscoveryResult as JSON."
    )

    def __init__(self) -> None:
        self._streamer = ChunkedStreamingStrategy()

    async def run(
        self,
        session_id: str,
        input_data: dict[str, Any],
        llm_client: LLMClient,
    ) -> dict[str, Any]:
        """Execute actor discovery stage."""
        idea_set = ProductIdeaSet(**input_data)

        # Use the top-ranked idea
        selected_idea = self._select_top_idea(idea_set)

        await self._emit_stage_started(session_id)

        # Discover actors via LLM
        result = await self._discover_actors(session_id, selected_idea, llm_client)

        # Stream each actor as a chunk
        interrupted = await self._stream_actors(session_id, result)
        if interrupted:
            pass  # Checkpoint handled by streaming strategy

        await self._streamer.finalize(
            session_id, self.stage_name, self._total_actor_count(result)
        )

        # Build steering panel
        draft = result.model_dump()
        options = self._build_steering_options(result)
        await self._emit_steering_panel(session_id, draft, options)

        # Wait for steering
        steering = await self._wait_for_steering(session_id)
        action_type = steering.get("action_type", "ACCEPT")

        if action_type in ("MODIFY", "REPLACE"):
            result = await self._apply_steering(result, steering, llm_client)
            draft = result.model_dump()

        # Complete
        checkpoint_data = {"stage": self.stage_name.value, "actor_result": draft}
        await self._emit_stage_completed(session_id, checkpoint_data)

        return draft

    def _select_top_idea(self, idea_set: ProductIdeaSet) -> ProductIdea:
        """Select the best-ranked idea from the set."""
        if not idea_set.ideas:
            return ProductIdea(idea_id="default", name="Default Product")
        ranked = sorted(idea_set.ideas, key=lambda i: i.rank or 99)
        return ranked[0]

    async def _discover_actors(
        self,
        session_id: str,
        idea: ProductIdea,
        llm_client: LLMClient,
    ) -> ActorDiscoveryResult:
        """Discover all actors via LLM."""
        prompt = self._DISCOVER_PROMPT.format(
            product_name=idea.name,
            product_description=idea.one_line_summary,
            value_proposition=idea.value_proposition,
        )
        result = await llm_client.complete_structured(
            prompt, ActorDiscoveryResult, temperature=0.6
        )

        # Ensure all actors have IDs
        for actor_class, actors in result.actors.items():
            for actor in actors:
                if not actor.actor_id:
                    actor.actor_id = f"actor_{uuid.uuid4().hex[:8]}"
                if not actor.actor_class:
                    actor.actor_class = ActorClass.HUMAN

        # Ensure RBAC hints have IDs
        for hint in result.rbac_candidates:
            if not hint.actor_id:
                hint.actor_id = f"rbac_{uuid.uuid4().hex[:8]}"

        return result

    async def _stream_actors(
        self, session_id: str, result: ActorDiscoveryResult
    ) -> bool:
        """Emit each actor as a StreamChunk. Returns True if interrupted."""
        chunk_index = 0
        for actor_class, actors in result.actors.items():
            for actor in actors:
                interrupted = await self._streamer.emit_node(
                    node_data=actor.model_dump(),
                    stage=self.stage_name,
                    chunk_index=chunk_index,
                    content_type="actor",
                    session_id=session_id,
                )
                if interrupted:
                    return True
                chunk_index += 1
        return False

    def _total_actor_count(self, result: ActorDiscoveryResult) -> int:
        return sum(len(actors) for actors in result.actors.values())

    def _build_steering_options(
        self, result: ActorDiscoveryResult
    ) -> list[dict[str, Any]]:
        """Create steering options from discovered actors."""
        options = []
        for actor_class, actors in result.actors.items():
            for actor in actors:
                options.append({
                    "option_id": f"select_{actor.actor_id}",
                    "label": f"{actor.name} ({actor_class.value})",
                    "rationale": actor.description[:200],
                    "confidence": "high" if actor.traceability == Traceability.EXPLICIT else "medium",
                })
        options.append({
            "option_id": "add_actor",
            "label": "Add new actor",
            "rationale": "Define an additional actor not discovered",
            "confidence": "medium",
        })
        options.append({
            "option_id": "merge_actors",
            "label": "Merge similar actors",
            "rationale": "Combine actors with overlapping roles",
            "confidence": "medium",
        })
        return options

    async def _apply_steering(
        self,
        result: ActorDiscoveryResult,
        steering: dict[str, Any],
        llm_client: LLMClient,
    ) -> ActorDiscoveryResult:
        """Apply user steering to modify the actor set."""
        payload = steering.get("payload", {})
        feedback = payload.get("feedback", "")
        selected_ids = payload.get("selected_actor_ids", [])

        if selected_ids:
            # Filter actors to selected set
            for actor_class in list(result.actors.keys()):
                result.actors[actor_class] = [
                    a for a in result.actors[actor_class]
                    if a.actor_id in selected_ids
                ]

        if feedback:
            current = json.dumps(result.model_dump(), default=str)
            prompt = self._REFINE_PROMPT.format(
                current_actors=current[:3000],
                feedback=feedback,
            )
            result = await llm_client.complete_structured(
                prompt, ActorDiscoveryResult, temperature=0.4
            )

        return result
