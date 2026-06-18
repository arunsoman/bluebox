"""Stage 4 -- Use Case Discovery.

Generates use cases with main_flow, alternative_flows, and exception_flows
from confirmed capabilities. Each use case has an ``access_context`` with
``data_sensitivity``.

Emits use cases as :class:`StreamChunk`s and ``STEERING_PANEL_READY``.
"""
from __future__ import annotations

import json
import uuid
from typing import Any

from domain.models import (
    AccessContext,
    AlternativeFlow,
    Capability,
    CapabilitySet,
    DataSensitivity,
    ExceptionFlow,
    StageName,
    StreamChunk,
    Traceability,
    UseCase,
    UseCaseSet,
)
from domain.pipeline_execution.base_stage import BaseStage
from domain.pipeline_execution.chunked_streaming import ChunkedStreamingStrategy
from infrastructure.llm.llm_provider import LLMClient
from infrastructure.messaging.sse_manager import sse_manager


class Stage4UseCaseDiscovery(BaseStage):
    """Generates structured use cases from confirmed capabilities."""

    stage_name = StageName.USE_CASE_DISCOVERY
    input_model = CapabilitySet
    output_model = UseCaseSet

    _DISCOVER_PROMPT = (
        "You are a use case analyst. Given these capabilities, generate "
        "structured use cases covering all major interactions:\n\n"
        "Capabilities: {capabilities}\n\n"
        "For each use case provide:\n"
        "- use_case_id (unique string), title\n"
        "- primary_actor (actor name)\n"
        "- secondary_actors (list of actor names)\n"
        "- capability_ids (which capabilities this use case exercises)\n"
        "- preconditions (list of conditions)\n"
        "- main_flow: ordered list of step descriptions\n"
        "- alternative_flows: list with trigger and steps\n"
        "- exception_flows: list with trigger, steps, optional error_code\n"
        "- postconditions (list)\n"
        "- data_entities_read, data_entities_written (lists)\n"
        "- access_context: required_permission, minimum_role, data_sensitivity "
        "  (public/internal/confidential/restricted)\n"
        "- traceability\n\n"
        "Return JSON matching the UseCaseSet schema with a 'use_cases' array."
    )

    _REFINE_PROMPT = (
        "Refine use cases based on user feedback:\n\n"
        "Current use cases: {current_use_cases}\n"
        "Feedback: {feedback}\n\n"
        "Return updated UseCaseSet as JSON."
    )

    def __init__(self) -> None:
        self._streamer = ChunkedStreamingStrategy()

    async def run(
        self,
        session_id: str,
        input_data: dict[str, Any],
        llm_client: LLMClient,
    ) -> dict[str, Any]:
        """Execute use case discovery stage."""
        cap_set = CapabilitySet(**input_data)

        await self._emit_stage_started(session_id)

        # Generate use cases via LLM
        use_case_set = await self._discover_use_cases(
            session_id, cap_set, llm_client
        )

        # Stream each use case as a chunk
        interrupted = await self._stream_use_cases(session_id, use_case_set)
        if interrupted:
            pass

        await self._streamer.finalize(
            session_id, self.stage_name, len(use_case_set.use_cases)
        )

        # Build steering panel
        draft = use_case_set.model_dump()
        options = self._build_steering_options(use_case_set)
        await self._emit_steering_panel(session_id, draft, options)

        # Wait for steering
        steering = await self._wait_for_steering(session_id)
        action_type = steering.get("action_type", "ACCEPT")

        if action_type in ("MODIFY", "REPLACE"):
            use_case_set = await self._apply_steering(
                use_case_set, steering, llm_client
            )
            draft = use_case_set.model_dump()

        # Complete
        checkpoint_data = {
            "stage": self.stage_name.value,
            "use_case_set": draft,
        }
        await self._emit_stage_completed(session_id, checkpoint_data)

        return draft

    async def _discover_use_cases(
        self,
        session_id: str,
        cap_set: CapabilitySet,
        llm_client: LLMClient,
    ) -> UseCaseSet:
        """Generate all use cases via LLM."""
        capabilities = []
        for cap in cap_set.capabilities + cap_set.platform_capabilities:
            capabilities.append({
                "capability_id": cap.capability_id,
                "name": cap.name,
                "description": cap.description,
                "capability_lens": cap.capability_lens.value,
                "triggered_by": cap.triggered_by,
                "data_entities": cap.data_entities_involved,
                "priority": cap.priority.value,
            })

        prompt = self._DISCOVER_PROMPT.format(
            capabilities=json.dumps(capabilities, default=str),
        )
        use_case_set = await llm_client.complete_structured(
            prompt, UseCaseSet, temperature=0.6
        )

        # Ensure IDs
        for uc in use_case_set.use_cases:
            if not uc.use_case_id:
                uc.use_case_id = f"uc_{uuid.uuid4().hex[:8]}"

        return use_case_set

    async def _stream_use_cases(
        self, session_id: str, use_case_set: UseCaseSet
    ) -> bool:
        """Emit each use case as a StreamChunk. Returns True if interrupted."""
        for idx, uc in enumerate(use_case_set.use_cases):
            interrupted = await self._streamer.emit_node(
                node_data=uc.model_dump(),
                stage=self.stage_name,
                chunk_index=idx,
                content_type="use_case",
                session_id=session_id,
            )
            if interrupted:
                return True
        return False

    def _build_steering_options(
        self, use_case_set: UseCaseSet
    ) -> list[dict[str, Any]]:
        """Create steering options from generated use cases."""
        options = []
        for uc in use_case_set.use_cases:
            options.append({
                "option_id": f"select_{uc.use_case_id}",
                "label": uc.title,
                "rationale": f"Primary actor: {uc.primary_actor} | Steps: {len(uc.main_flow)}",
                "confidence": "high" if uc.traceability == Traceability.EXPLICIT else "medium",
            })
        options.append({
            "option_id": "add_use_case",
            "label": "Add new use case",
            "rationale": "Define an additional use case",
            "confidence": "medium",
        })
        options.append({
            "option_id": "merge_use_cases",
            "label": "Merge related use cases",
            "rationale": "Combine overlapping use cases",
            "confidence": "medium",
        })
        return options

    async def _apply_steering(
        self,
        use_case_set: UseCaseSet,
        steering: dict[str, Any],
        llm_client: LLMClient,
    ) -> UseCaseSet:
        """Apply user steering to modify use cases."""
        payload = steering.get("payload", {})
        selected_ids = payload.get("selected_use_case_ids", [])
        feedback = payload.get("feedback", "")

        if selected_ids:
            use_case_set.use_cases = [
                uc for uc in use_case_set.use_cases
                if uc.use_case_id in selected_ids
            ]

        if feedback:
            current = json.dumps(use_case_set.model_dump(), default=str)
            prompt = self._REFINE_PROMPT.format(
                current_use_cases=current[:3000],
                feedback=feedback,
            )
            use_case_set = await llm_client.complete_structured(
                prompt, UseCaseSet, temperature=0.4
            )

        return use_case_set
