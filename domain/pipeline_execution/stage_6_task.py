"""Stage 6 -- Task Decomposition.

Decomposes each user story into :class:`EngineeringTask` objects. Each task
has a ``layer`` (frontend, backend, database, infra, auth, test, devops,
security), ``task_type``, ``file_paths``, ``implementation_sketch``,
``test_specs``, ``effort_points``, and ``access_guards`` (derived from
:class:`RBACModel` when available).

For large outputs (>20 nodes), tasks are emitted in paginated batches.

Emits tasks as :class:`StreamChunk`s and ``STEERING_PANEL_READY``.
"""
from __future__ import annotations

import json
import uuid
from typing import Any

from domain.models import (
    AcceptanceCriterion,
    Actor,
    CapabilitySet,
    EngineeringTask,
    RBACModel,
    StageName,
    StoryDecomposition,
    StreamChunk,
    TaskDecompositionInputSeed,
    TaskDecompositionResult,
    TaskLayer,
    TaskType,
    TechStackProfile,
    TestSpec,
    TestType,
    Traceability,
    UseCaseSet,
    UserStory,
    UserStorySet,
)
from domain.pipeline_execution.base_stage import BaseStage
from domain.pipeline_execution.chunked_streaming import ChunkedStreamingStrategy
from infrastructure.llm.llm_provider import LLMClient
from infrastructure.messaging.sse_manager import sse_manager


class Stage6TaskDecomposition(BaseStage):
    """Decomposes user stories into engineering tasks."""

    stage_name = StageName.TASK_DECOMPOSITION
    input_model = TaskDecompositionInputSeed
    output_model = TaskDecompositionResult

    _BATCH_SIZE = 20

    _DECOMPOSE_PROMPT = (
        "You are a senior software architect. Decompose this user story into "
        "engineering tasks suitable for implementation:\n\n"
        "Story: {story_text}\n"
        "Actor: {actor}\n"
        "Acceptance criteria: {acceptance_criteria}\n"
        "Priority: {priority}\n"
        "Story points: {story_points}\n\n"
        "Tech stack: {tech_stack}\n\n"
        "For each task provide:\n"
        "- task_id (unique string), story_id\n"
        "- title, description\n"
        "- layer: frontend/backend/database/infra/auth/test/devops/security\n"
        "- task_type: CREATE/UPDATE/DELETE/CONFIGURE/TEST/DOCUMENT\n"
        "- file_paths: list of likely file paths\n"
        "- implementation_sketch: ordered list of implementation steps\n"
        "- acceptance_criteria: list with criterion_id, given, when, then, test_type\n"
        "- test_specs: list with spec_id, criterion_id, test_type, description, "
        "  inputs, expected_outputs, mocks_required\n"
        "- dependencies: list of task_ids this task depends on\n"
        "- effort_points (1-13)\n"
        "- access_guards: list of permission strings\n"
        "- traceability\n\n"
        "Return JSON matching the StoryDecomposition schema with a 'tasks' array."
    )

    _REFINE_PROMPT = (
        "Refine task decomposition based on user feedback:\n\n"
        "Current decompositions: {current_decompositions}\n"
        "Feedback: {feedback}\n\n"
        "Return updated list of StoryDecomposition objects as JSON."
    )

    def __init__(self) -> None:
        self._streamer = ChunkedStreamingStrategy()

    async def run(
        self,
        session_id: str,
        input_data: dict[str, Any],
        llm_client: LLMClient,
    ) -> dict[str, Any]:
        """Execute task decomposition stage."""
        seed = TaskDecompositionInputSeed(**input_data)

        await self._emit_stage_started(session_id)

        # Decompose each story into tasks
        decompositions: list[StoryDecomposition] = []
        all_tasks: list[EngineeringTask] = []

        for story in seed.user_stories:
            decomp = await self._decompose_story(
                session_id, story, seed.tech_stack, llm_client
            )
            # Apply RBAC access guards if available
            if seed.rbac_model:
                decomp = self._apply_rbac_guards(decomp, seed.rbac_model)
            decompositions.append(decomp)
            all_tasks.extend(decomp.tasks)

        # Stream tasks with pagination support
        result = TaskDecompositionResult(
            tech_stack=seed.tech_stack,
            decompositions=decompositions,
        )

        interrupted = await self._stream_tasks_paginated(
            session_id, all_tasks
        )
        if interrupted:
            pass

        await self._streamer.finalize(
            session_id, self.stage_name, len(all_tasks)
        )

        # Build steering panel
        draft = result.model_dump()
        options = self._build_steering_options(result, all_tasks)
        await self._emit_steering_panel(session_id, draft, options)

        # Wait for steering
        steering = await self._wait_for_steering(session_id)
        action_type = steering.get("action_type", "ACCEPT")

        if action_type in ("MODIFY", "REPLACE"):
            result = await self._apply_steering(result, steering, llm_client)
            draft = result.model_dump()

        # Complete
        checkpoint_data = {
            "stage": self.stage_name.value,
            "task_result": draft,
            "total_tasks": len(all_tasks),
            "total_stories": len(seed.user_stories),
        }
        await self._emit_stage_completed(session_id, checkpoint_data)

        return draft

    async def _decompose_story(
        self,
        session_id: str,
        story: UserStory,
        tech_stack: TechStackProfile,
        llm_client: LLMClient,
    ) -> StoryDecomposition:
        """Decompose a single story into engineering tasks via LLM."""
        ac_json = json.dumps(
            [ac.model_dump() for ac in story.acceptance_criteria],
            default=str,
        )
        ts_json = tech_stack.model_dump() if tech_stack else "{}"

        prompt = self._DECOMPOSE_PROMPT.format(
            story_text=story.story_text,
            actor=story.actor,
            acceptance_criteria=ac_json,
            priority=story.priority.value,
            story_points=story.story_points,
            tech_stack=ts_json,
        )
        decomp = await llm_client.complete_structured(
            prompt, StoryDecomposition, temperature=0.5
        )
        decomp.story_id = story.story_id

        # Ensure task IDs and story_id linkage
        for task in decomp.tasks:
            if not task.task_id:
                task.task_id = f"task_{uuid.uuid4().hex[:8]}"
            task.story_id = story.story_id

        return decomp

    def _apply_rbac_guards(
        self,
        decomp: StoryDecomposition,
        rbac_model: RBACModel,
    ) -> StoryDecomposition:
        """Augment tasks with access guards derived from RBAC model."""
        # Build a mapping of permission -> roles
        permission_roles: dict[str, list[str]] = {}
        for entry in rbac_model.permission_matrix:
            if entry.granted:
                permission_roles.setdefault(entry.permission_id, []).append(
                    entry.role_id
                )

        for task in decomp.tasks:
            guards = []
            # Derive guards from task layer and type
            if task.layer in (TaskLayer.AUTH, TaskLayer.SECURITY):
                guards.append("requires:admin")
            if task.task_type == TaskType.DELETE:
                guards.append("requires:write_scope")
            if task.layer == TaskLayer.DATABASE and task.task_type == TaskType.CREATE:
                guards.append("requires:schema_change_approval")

            # Add RBAC-derived guards
            for perm_id, roles in permission_roles.items():
                guards.append(f"rbac:{perm_id}:roles:{','.join(roles)}")

            task.access_guards = guards
        return decomp

    async def _stream_tasks_paginated(
        self, session_id: str, all_tasks: list[EngineeringTask]
    ) -> bool:
        """Emit tasks with pagination for large sets. Returns True if interrupted."""
        total = len(all_tasks)
        for idx, task in enumerate(all_tasks):
            interrupted = await self._streamer.emit_node(
                node_data=task.model_dump(),
                stage=self.stage_name,
                chunk_index=idx,
                content_type="task",
                session_id=session_id,
            )
            if interrupted:
                return True

            # Emit batch boundary marker every BATCH_SIZE tasks
            if (idx + 1) % self._BATCH_SIZE == 0 and (idx + 1) < total:
                await sse_manager.emit(
                    session_id,
                    "STREAM_BATCH_BOUNDARY",
                    {
                        "stage": self.stage_name.value,
                        "batch_end_index": idx,
                        "total_tasks": total,
                        "remaining": total - idx - 1,
                    },
                )
        return False

    def _build_steering_options(
        self,
        result: TaskDecompositionResult,
        all_tasks: list[EngineeringTask],
    ) -> list[dict[str, Any]]:
        """Create steering options from decomposed tasks."""
        # Summarize by layer
        layer_counts: dict[str, int] = {}
        for task in all_tasks:
            layer_counts[task.layer.value] = layer_counts.get(task.layer.value, 0) + 1

        options = []
        for layer, count in sorted(layer_counts.items()):
            options.append({
                "option_id": f"filter_{layer}",
                "label": f"View {layer} tasks ({count})",
                "rationale": f"Filter to {layer} layer tasks only",
                "confidence": "high",
            })

        total_effort = sum(
            t.effort_points or 0 for t in all_tasks
        )
        options.append({
            "option_id": "accept_all",
            "label": f"Accept all tasks (total effort: {total_effort} points)",
            "rationale": f"{len(all_tasks)} tasks across {len(layer_counts)} layers",
            "confidence": "high",
        })
        options.append({
            "option_id": "add_task",
            "label": "Add new task",
            "rationale": "Define an additional engineering task",
            "confidence": "medium",
        })
        options.append({
            "option_id": "split_task",
            "label": "Split large tasks",
            "rationale": "Break down tasks with effort > 8 points",
            "confidence": "high",
        })
        return options

    async def _apply_steering(
        self,
        result: TaskDecompositionResult,
        steering: dict[str, Any],
        llm_client: LLMClient,
    ) -> TaskDecompositionResult:
        """Apply user steering to modify task decompositions."""
        payload = steering.get("payload", {})
        selected_layer = payload.get("filter_layer")
        feedback = payload.get("feedback", "")

        if selected_layer:
            # Filter tasks to selected layer
            for decomp in result.decompositions:
                decomp.tasks = [
                    t for t in decomp.tasks
                    if t.layer.value == selected_layer
                ]

        if feedback:
            current = json.dumps(
                [d.model_dump() for d in result.decompositions],
                default=str,
            )
            prompt = self._REFINE_PROMPT.format(
                current_decompositions=current[:3000],
                feedback=feedback,
            )
            # Parse refined decompositions from LLM response
            from domain.models import StoryDecomposition as SD
            refined = await llm_client.complete_structured(
                prompt, SD, temperature=0.4
            )
            # The LLM returns a single StoryDecomposition; we'd need to
            # handle multi-story refinement in practice. For now, replace
            # the first decomposition that matches.
            if refined.tasks and result.decompositions:
                for decomp in result.decompositions:
                    if decomp.story_id == refined.story_id:
                        decomp.tasks = refined.tasks
                        break

        return result
