"""Stage 3 -- Capability Discovery.

Discovers capabilities from confirmed actors. Each capability is tagged with
a ``capability_lens`` (functional, data, integration, security, operational,
platform, growth), ``priority``, and ``data_entities_involved``.

Emits capabilities as :class:`StreamChunk`s and ``STEERING_PANEL_READY``.
"""
from __future__ import annotations

import json
import uuid
from typing import Any

from domain.models import (
    Actor,
    ActorClass,
    ActorDiscoveryResult,
    Capability,
    CapabilityLens,
    CapabilitySet,
    Priority,
    StageName,
    StreamChunk,
    Traceability,
)
from domain.pipeline_execution.base_stage import BaseStage
from domain.pipeline_execution.chunked_streaming import ChunkedStreamingStrategy
from infrastructure.llm.llm_provider import LLMClient
from infrastructure.messaging.sse_manager import sse_manager


class Stage3CapabilityDiscovery(BaseStage):
    """Discovers capabilities for each confirmed actor."""

    stage_name = StageName.CAPABILITY_DISCOVERY
    input_model = ActorDiscoveryResult
    output_model = CapabilitySet

    _DISCOVER_PROMPT = (
        "You are a capability analyst. Given these actors for a product, "
        "identify ALL capabilities each actor needs or provides:\n\n"
        "Actors: {actors}\n\n"
        "Actor relationships: {relationships}\n\n"
        "For each capability provide:\n"
        "- capability_id (unique string), name, description\n"
        "- triggered_by (list of actor IDs or event names)\n"
        "- capability_lens: one of functional, data, integration, security, "
        "  operational, platform, growth\n"
        "- is_platform_capability (bool)\n"
        "- data_entities_involved (list of data entity names)\n"
        "- access_level_hint: read/write/admin/execute/none\n"
        "- priority: must_have/should_have/nice_to_have\n"
        "- priority_rationale\n"
        "- traceability: candidate/inferred/explicit\n\n"
        "Return JSON matching the CapabilitySet schema with:\n"
        "- 'capabilities': list of non-platform capabilities\n"
        "- 'platform_capabilities': list of platform-level capabilities\n"
    )

    _REFINE_PROMPT = (
        "Refine capabilities based on user feedback:\n\n"
        "Current capabilities: {current_capabilities}\n"
        "Feedback: {feedback}\n\n"
        "Return updated CapabilitySet as JSON."
    )

    def __init__(self) -> None:
        self._streamer = ChunkedStreamingStrategy()

    async def run(
        self,
        session_id: str,
        input_data: dict[str, Any],
        llm_client: LLMClient,
    ) -> dict[str, Any]:
        """Execute capability discovery stage."""
        actor_result = ActorDiscoveryResult(**input_data)

        await self._emit_stage_started(session_id)

        # Discover capabilities via LLM
        cap_set = await self._discover_capabilities(
            session_id, actor_result, llm_client
        )

        # Stream each capability as a chunk
        interrupted = await self._stream_capabilities(session_id, cap_set)
        if interrupted:
            pass

        await self._streamer.finalize(
            session_id,
            self.stage_name,
            len(cap_set.capabilities) + len(cap_set.platform_capabilities),
        )

        # Build steering panel
        draft = cap_set.model_dump()
        options = self._build_steering_options(cap_set)
        await self._emit_steering_panel(session_id, draft, options)

        # Wait for steering
        steering = await self._wait_for_steering(session_id)
        action_type = steering.get("action_type", "ACCEPT")

        if action_type in ("MODIFY", "REPLACE"):
            cap_set = await self._apply_steering(cap_set, steering, llm_client)
            draft = cap_set.model_dump()

        # Complete
        checkpoint_data = {"stage": self.stage_name.value, "capability_set": draft}
        await self._emit_stage_completed(session_id, checkpoint_data)

        return draft

    async def _discover_capabilities(
        self,
        session_id: str,
        actor_result: ActorDiscoveryResult,
        llm_client: LLMClient,
    ) -> CapabilitySet:
        """Discover all capabilities via LLM."""
        # Flatten actors for the prompt
        all_actors = []
        for actor_class, actors in actor_result.actors.items():
            for actor in actors:
                all_actors.append({
                    "actor_id": actor.actor_id,
                    "name": actor.name,
                    "type": actor.type,
                    "actor_class": actor.actor_class.value,
                    "description": actor.description,
                })

        relationships = []
        for rel in actor_result.relationship_map:
            relationships.append({
                "source": rel.source_actor_id,
                "target": rel.target_actor_id,
                "type": rel.relationship_type,
            })

        prompt = self._DISCOVER_PROMPT.format(
            actors=json.dumps(all_actors, default=str),
            relationships=json.dumps(relationships, default=str),
        )
        cap_set = await llm_client.complete_structured(
            prompt, CapabilitySet, temperature=0.6
        )

        # Ensure IDs
        for cap in cap_set.capabilities:
            if not cap.capability_id:
                cap.capability_id = f"cap_{uuid.uuid4().hex[:8]}"
        for cap in cap_set.platform_capabilities:
            if not cap.capability_id:
                cap.capability_id = f"cap_plat_{uuid.uuid4().hex[:8]}"

        return cap_set

    async def _stream_capabilities(
        self, session_id: str, cap_set: CapabilitySet
    ) -> bool:
        """Emit each capability as a StreamChunk. Returns True if interrupted."""
        chunk_index = 0
        for cap in cap_set.capabilities:
            interrupted = await self._streamer.emit_node(
                node_data=cap.model_dump(),
                stage=self.stage_name,
                chunk_index=chunk_index,
                content_type="capability",
                session_id=session_id,
            )
            if interrupted:
                return True
            chunk_index += 1
        for cap in cap_set.platform_capabilities:
            interrupted = await self._streamer.emit_node(
                node_data=cap.model_dump(),
                stage=self.stage_name,
                chunk_index=chunk_index,
                content_type="platform_capability",
                session_id=session_id,
            )
            if interrupted:
                return True
            chunk_index += 1
        return False

    def _build_steering_options(
        self, cap_set: CapabilitySet
    ) -> list[dict[str, Any]]:
        """Create steering options from discovered capabilities."""
        options = []
        for cap in cap_set.capabilities:
            options.append({
                "option_id": f"select_{cap.capability_id}",
                "label": f"{cap.name} ({cap.capability_lens.value})",
                "rationale": f"{cap.description[:150]} | Priority: {cap.priority.value}",
                "confidence": "high" if cap.traceability == Traceability.EXPLICIT else "medium",
            })
        options.append({
            "option_id": "add_capability",
            "label": "Add new capability",
            "rationale": "Define an additional capability",
            "confidence": "medium",
        })
        options.append({
            "option_id": "re_prioritize",
            "label": "Re-prioritize capabilities",
            "rationale": "Adjust must/should/nice priorities",
            "confidence": "high",
        })
        return options

    async def _apply_steering(
        self,
        cap_set: CapabilitySet,
        steering: dict[str, Any],
        llm_client: LLMClient,
    ) -> CapabilitySet:
        """Apply user steering to modify capabilities."""
        payload = steering.get("payload", {})
        selected_ids = payload.get("selected_capability_ids", [])
        feedback = payload.get("feedback", "")

        if selected_ids:
            cap_set.capabilities = [
                c for c in cap_set.capabilities
                if c.capability_id in selected_ids
            ]

        if feedback:
            current = json.dumps(cap_set.model_dump(), default=str)
            prompt = self._REFINE_PROMPT.format(
                current_capabilities=current[:3000],
                feedback=feedback,
            )
            cap_set = await llm_client.complete_structured(
                prompt, CapabilitySet, temperature=0.4
            )

        return cap_set
