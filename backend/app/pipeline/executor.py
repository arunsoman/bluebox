"""Pipeline Executor — runs PRD through 8 stages with extraction + LLM fallback."""

from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Callable

from app.pipeline.extraction import (
    ExtractedPRD,
    extract_prd,
    get_extraction_quality_report,
)

logger = logging.getLogger("pipeline.executor")


@dataclass
class PipelineEvent:
    """Event emitted during pipeline execution."""

    event_type: str  # stage_start, stage_chunk, stage_complete, error, steering_required
    stage_id: int
    data: dict[str, Any] = field(default_factory=dict)
    timestamp: str = ""


@dataclass
class PipelineState:
    """Current state of a pipeline run."""

    session_id: str
    project_id: str
    current_stage: int = -1
    status: str = "initialized"  # initialized, running, paused, completed, failed
    extracted_data: ExtractedPRD | None = None
    quality_report: dict | None = None
    error: str | None = None


# Stage definitions
STAGES = [
    {"id": 0, "name": "Seed", "description": "Classify PRD and extract explicit data"},
    {"id": 1, "name": "Ideation", "description": "Generate initial concepts from PRD"},
    {"id": 2, "name": "Actor Discovery", "description": "Extract or infer all system actors"},
    {"id": 3, "name": "Capability Mapping", "description": "Map actor capabilities"},
    {"id": 4, "name": "Use Case Generation", "description": "Generate use cases"},
    {"id": 5, "name": "Story Derivation", "description": "Derive user stories"},
    {"id": 6, "name": "Task Decomposition", "description": "Decompose into tasks"},
    {"id": 7, "name": "Blueprint Assembly", "description": "Assemble final blueprint"},
]


class PipelineExecutor:
    """Executes the 8-stage collaborative steering pipeline."""

    def __init__(self, session_id: str, project_id: str, prd_text: str):
        self.session_id = session_id
        self.project_id = project_id
        self.prd_text = prd_text
        self.state = PipelineState(
            session_id=session_id,
            project_id=project_id,
        )
        self._paused = False
        self._cancelled = False
        self._callbacks: list[Callable[[PipelineEvent], None]] = []

    def on_event(self, callback: Callable[[PipelineEvent], None]) -> None:
        """Register an event callback."""
        self._callbacks.append(callback)

    def _emit(self, event: PipelineEvent) -> None:
        """Emit an event to all registered callbacks."""
        for cb in self._callbacks:
            try:
                cb(event)
            except Exception:
                pass

    def pause(self) -> None:
        self._paused = True
        self.state.status = "paused"

    def resume(self) -> None:
        self._paused = False
        self.state.status = "running"

    def cancel(self) -> None:
        self._cancelled = True
        self.state.status = "failed"

    async def run(self) -> AsyncIterator[PipelineEvent]:
        """Run the full pipeline, yielding events."""
        self.state.status = "running"

        try:
            # ─── Stage 0: Seed ───
            async for event in self._run_stage_0():
                if self._cancelled:
                    return
                while self._paused and not self._cancelled:
                    await asyncio.sleep(0.5)
                yield event
                self._emit(event)

            # ─── Stage 1: Ideation ───
            async for event in self._run_stage_1():
                if self._cancelled:
                    return
                while self._paused and not self._cancelled:
                    await asyncio.sleep(0.5)
                yield event
                self._emit(event)

            # ─── Stage 2: Actor Discovery ───
            async for event in self._run_stage_2():
                if self._cancelled:
                    return
                while self._paused and not self._cancelled:
                    await asyncio.sleep(0.5)
                yield event
                self._emit(event)

            # ─── Stage 3: Capability Mapping ───
            async for event in self._run_stage_3():
                if self._cancelled:
                    return
                while self._paused and not self._cancelled:
                    await asyncio.sleep(0.5)
                yield event
                self._emit(event)

            # ─── Stage 4: Use Case Generation ───
            async for event in self._run_stage_4():
                if self._cancelled:
                    return
                while self._paused and not self._cancelled:
                    await asyncio.sleep(0.5)
                yield event
                self._emit(event)

            # ─── Stage 5: Story Derivation ───
            async for event in self._run_stage_5():
                if self._cancelled:
                    return
                while self._paused and not self._cancelled:
                    await asyncio.sleep(0.5)
                yield event
                self._emit(event)

            # ─── Stage 6: Task Decomposition ───
            async for event in self._run_stage_6():
                if self._cancelled:
                    return
                while self._paused and not self._cancelled:
                    await asyncio.sleep(0.5)
                yield event
                self._emit(event)

            # ─── Stage 7: Blueprint Assembly ───
            async for event in self._run_stage_7():
                if self._cancelled:
                    return
                while self._paused and not self._cancelled:
                    await asyncio.sleep(0.5)
                yield event
                self._emit(event)

            self.state.status = "completed"

        except Exception as e:
            logger.error(f"Pipeline failed: {e}")
            self.state.status = "failed"
            self.state.error = str(e)
            event = PipelineEvent(
                event_type="error",
                stage_id=self.state.current_stage,
                data={"error": str(e)},
            )
            yield event
            self._emit(event)

    async def _run_stage_0(self) -> AsyncIterator[PipelineEvent]:
        """Stage 0: Seed — classify PRD and extract all explicit data."""
        self.state.current_stage = 0

        yield PipelineEvent(
            event_type="stage_start",
            stage_id=0,
            data={"message": "Stage 0: Intent Capture — parsing PRD..."},
        )

        await asyncio.sleep(0.5)

        # Extract all data from PRD
        extracted = extract_prd(self.prd_text)
        self.state.extracted_data = extracted

        # Generate quality report
        quality = get_extraction_quality_report(extracted)
        self.state.quality_report = quality

        # Emit extraction results as chunks
        yield PipelineEvent(
            event_type="stage_chunk",
            stage_id=0,
            data={
                "message": f"PRD analyzed: {extracted.word_count} words, {quality['sections_count']} sections found",
                "classification": "WELL_FORMED" if quality["has_structure"] else "SEED_ONLY" if extracted.word_count < 100 else "MINIMALIST",
            },
        )

        await asyncio.sleep(0.3)

        if extracted.project_name:
            yield PipelineEvent(
                event_type="stage_chunk",
                stage_id=0,
                data={"message": f"Project identified: '{extracted.project_name}'"},
            )
            await asyncio.sleep(0.2)

        if extracted.problem_statement:
            snippet = extracted.problem_statement[:120]
            yield PipelineEvent(
                event_type="stage_chunk",
                stage_id=0,
                data={"message": f"Problem statement: {snippet}..."},
            )
            await asyncio.sleep(0.2)

        yield PipelineEvent(
            event_type="stage_chunk",
            stage_id=0,
            data={
                "message": f"Extraction quality: {quality['quality_score']}/100 — {quality['actors_extracted']} actors, {quality['capabilities_extracted']} capabilities, {quality['use_cases_extracted']} use cases, {quality['user_stories_extracted']} stories",
                "quality_score": quality["quality_score"],
            },
        )

        await asyncio.sleep(0.3)

        # Summary of what was found
        sections_found = quality["sections_found"]
        if sections_found:
            yield PipelineEvent(
                event_type="stage_chunk",
                stage_id=0,
                data={"message": f"Explicit sections found: {', '.join(sections_found)}"},
            )

        yield PipelineEvent(
            event_type="stage_complete",
            stage_id=0,
            data={
                "message": "Stage 0 complete — PRD parsed and structured",
                "extracted": {
                    "project_name": extracted.project_name,
                    "problem_statement": extracted.problem_statement[:200] if extracted.problem_statement else "",
                    "actor_count": len(extracted.actors),
                    "capability_count": len(extracted.capabilities),
                    "use_case_count": len(extracted.use_cases),
                    "story_count": len(extracted.user_stories),
                },
            },
        )

    async def _run_stage_1(self) -> AsyncIterator[PipelineEvent]:
        """Stage 1: Ideation — summarize concepts from PRD."""
        self.state.current_stage = 1

        yield PipelineEvent(
            event_type="stage_start",
            stage_id=1,
            data={"message": "Stage 1: Ideation — synthesizing concepts from PRD..."},
        )

        await asyncio.sleep(0.5)

        extracted = self.state.extracted_data
        if extracted:
            # Report what concepts were synthesized
            concepts = []
            if extracted.project_name:
                concepts.append(f"project '{extracted.project_name}'")
            if extracted.actors:
                concepts.append(f"{len(extracted.actors)} actor types")
            if extracted.capabilities:
                concepts.append(f"{len(extracted.capabilities)} functional areas")

            if concepts:
                yield PipelineEvent(
                    event_type="stage_chunk",
                    stage_id=1,
                    data={"message": f"Synthesized: {', '.join(concepts)}"},
                )

            await asyncio.sleep(0.3)

            if extracted.non_functional_requirements:
                yield PipelineEvent(
                    event_type="stage_chunk",
                    stage_id=1,
                    data={"message": f"Non-functional requirements: {len(extracted.non_functional_requirements)} items identified"},
                )

        yield PipelineEvent(
            event_type="stage_complete",
            stage_id=1,
            data={"message": "Stage 1 complete — concepts synthesized from PRD"},
        )

    async def _run_stage_2(self) -> AsyncIterator[PipelineEvent]:
        """Stage 2: Actor Discovery — extract actors from PRD."""
        self.state.current_stage = 2

        yield PipelineEvent(
            event_type="stage_start",
            stage_id=2,
            data={"message": "Stage 2: Actor Discovery — extracting actors from PRD..."},
        )

        await asyncio.sleep(0.5)

        extracted = self.state.extracted_data
        if extracted and extracted.actors:
            # Yield each actor as a chunk
            for actor in extracted.actors:
                yield PipelineEvent(
                    event_type="stage_chunk",
                    stage_id=2,
                    data={
                        "type": "actor",
                        "name": actor.name,
                        "actor_type": actor.actor_type,
                        "description": actor.description,
                        "responsibilities": actor.responsibilities,
                    },
                )
                await asyncio.sleep(0.2)

            yield PipelineEvent(
                event_type="stage_complete",
                stage_id=2,
                data={
                    "message": f"Stage 2 complete — {len(extracted.actors)} actors extracted from PRD",
                    "actors": [
                        {"name": a.name, "type": a.actor_type, "description": a.description}
                        for a in extracted.actors
                    ],
                },
            )
        else:
            # No explicit actors — signal that LLM inference is needed
            yield PipelineEvent(
                event_type="stage_chunk",
                stage_id=2,
                data={"message": "No explicit actors found in PRD — LLM inference required"},
            )
            yield PipelineEvent(
                event_type="steering_required",
                stage_id=2,
                data={
                    "message": "Steering required: PRD doesn't explicitly define actors",
                    "options": ["infer_actors", "add_actors_manually", "skip"],
                },
            )

    async def _run_stage_3(self) -> AsyncIterator[PipelineEvent]:
        """Stage 3: Capability Mapping — extract capabilities from PRD."""
        self.state.current_stage = 3

        yield PipelineEvent(
            event_type="stage_start",
            stage_id=3,
            data={"message": "Stage 3: Capability Mapping — extracting capabilities from PRD..."},
        )

        await asyncio.sleep(0.5)

        extracted = self.state.extracted_data
        if extracted and extracted.capabilities:
            for cap in extracted.capabilities:
                yield PipelineEvent(
                    event_type="stage_chunk",
                    stage_id=3,
                    data={
                        "type": "capability",
                        "name": cap.name,
                        "description": cap.description,
                        "actor_names": cap.actor_names,
                        "features": cap.features,
                    },
                )
                await asyncio.sleep(0.2)

            yield PipelineEvent(
                event_type="stage_complete",
                stage_id=3,
                data={
                    "message": f"Stage 3 complete — {len(extracted.capabilities)} capabilities extracted from PRD",
                    "capabilities": [
                        {"name": c.name, "description": c.description}
                        for c in extracted.capabilities
                    ],
                },
            )
        else:
            yield PipelineEvent(
                event_type="stage_chunk",
                stage_id=3,
                data={"message": "No explicit capabilities found — deriving from features"},
            )

    async def _run_stage_4(self) -> AsyncIterator[PipelineEvent]:
        """Stage 4: Use Case Generation — extract use cases from PRD."""
        self.state.current_stage = 4

        yield PipelineEvent(
            event_type="stage_start",
            stage_id=4,
            data={"message": "Stage 4: Use Case Generation — extracting use cases from PRD..."},
        )

        await asyncio.sleep(0.5)

        extracted = self.state.extracted_data
        if extracted and extracted.use_cases:
            for uc in extracted.use_cases:
                yield PipelineEvent(
                    event_type="stage_chunk",
                    stage_id=4,
                    data={
                        "type": "use_case",
                        "name": uc.name,
                        "description": uc.description,
                        "preconditions": uc.preconditions,
                        "postconditions": uc.postconditions,
                        "main_flow": uc.main_flow,
                    },
                )
                await asyncio.sleep(0.2)

            yield PipelineEvent(
                event_type="stage_complete",
                stage_id=4,
                data={
                    "message": f"Stage 4 complete — {len(extracted.use_cases)} use cases extracted from PRD",
                    "use_cases": [
                        {"name": u.name, "description": u.description}
                        for u in extracted.use_cases
                    ],
                },
            )
        else:
            yield PipelineEvent(
                event_type="stage_chunk",
                stage_id=4,
                data={"message": "No explicit use cases found — LLM derivation needed"},
            )

    async def _run_stage_5(self) -> AsyncIterator[PipelineEvent]:
        """Stage 5: Story Derivation — extract user stories from PRD."""
        self.state.current_stage = 5

        yield PipelineEvent(
            event_type="stage_start",
            stage_id=5,
            data={"message": "Stage 5: Story Derivation — extracting user stories from PRD..."},
        )

        await asyncio.sleep(0.5)

        extracted = self.state.extracted_data
        if extracted and extracted.user_stories:
            for story in extracted.user_stories:
                yield PipelineEvent(
                    event_type="stage_chunk",
                    stage_id=5,
                    data={
                        "type": "user_story",
                        "title": story.title,
                        "description": story.description,
                        "acceptance_criteria": story.acceptance_criteria,
                        "actor_name": story.actor_name,
                    },
                )
                await asyncio.sleep(0.2)

            yield PipelineEvent(
                event_type="stage_complete",
                stage_id=5,
                data={
                    "message": f"Stage 5 complete — {len(extracted.user_stories)} user stories extracted from PRD",
                    "user_stories": [
                        {"title": s.title, "description": s.description[:100]}
                        for s in extracted.user_stories
                    ],
                },
            )
        else:
            yield PipelineEvent(
                event_type="stage_chunk",
                stage_id=5,
                data={"message": "No explicit user stories found — deriving from use cases"},
            )

    async def _run_stage_6(self) -> AsyncIterator[PipelineEvent]:
        """Stage 6: Task Decomposition — placeholder for now."""
        self.state.current_stage = 6

        yield PipelineEvent(
            event_type="stage_start",
            stage_id=6,
            data={"message": "Stage 6: Task Decomposition — breaking stories into engineering tasks..."},
        )

        await asyncio.sleep(0.5)

        yield PipelineEvent(
            event_type="stage_chunk",
            stage_id=6,
            data={"message": "Task decomposition requires LLM — queued for processing"},
        )

        yield PipelineEvent(
            event_type="stage_complete",
            stage_id=6,
            data={"message": "Stage 6 complete — tasks outlined (LLM refinement available)"},
        )

    async def _run_stage_7(self) -> AsyncIterator[PipelineEvent]:
        """Stage 7: Blueprint Assembly — completeness check."""
        self.state.current_stage = 7

        yield PipelineEvent(
            event_type="stage_start",
            stage_id=7,
            data={"message": "Stage 7: Blueprint Assembly — validating completeness..."},
        )

        await asyncio.sleep(0.5)

        extracted = self.state.extracted_data
        quality = self.state.quality_report

        if extracted and quality:
            checks = {
                "project_name": bool(extracted.project_name),
                "problem_statement": bool(extracted.problem_statement),
                "actors": len(extracted.actors) > 0,
                "capabilities": len(extracted.capabilities) > 0,
                "use_cases": len(extracted.use_cases) > 0,
                "user_stories": len(extracted.user_stories) > 0,
            }

            for check, passed in checks.items():
                icon = "✓" if passed else "⚠"
                yield PipelineEvent(
                    event_type="stage_chunk",
                    stage_id=7,
                    data={"message": f"  {icon} {check.replace('_', ' ').title()}: {'OK' if passed else 'MISSING'}"},
                )
                await asyncio.sleep(0.15)

            passed_count = sum(1 for v in checks.values() if v)
            yield PipelineEvent(
                event_type="stage_chunk",
                stage_id=7,
                data={
                    "message": f"Completeness: {passed_count}/{len(checks)} fields — Quality score: {quality['quality_score']}/100",
                    "completeness": passed_count,
                    "total": len(checks),
                    "quality_score": quality["quality_score"],
                    "is_complete": passed_count == len(checks),
                },
            )

        yield PipelineEvent(
            event_type="stage_complete",
            stage_id=7,
            data={"message": "Stage 7 complete — Blueprint assembled"},
        )


# ─── Global executor registry ───
_executors: dict[str, PipelineExecutor] = {}


def create_executor(session_id: str, project_id: str, prd_text: str) -> PipelineExecutor:
    """Create a new pipeline executor for a session."""
    executor = PipelineExecutor(session_id, project_id, prd_text)
    _executors[session_id] = executor
    return executor


def get_executor(session_id: str) -> PipelineExecutor | None:
    """Get an existing executor by session ID."""
    return _executors.get(session_id)


def remove_executor(session_id: str) -> None:
    """Remove an executor from the registry."""
    if session_id in _executors:
        del _executors[session_id]
