"""Pipeline Executor — runs PRD through 8 stages with extraction + LLM enrichment."""

from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Callable
from uuid import uuid4

from app.domain.models import EngineeringTask
from app.pipeline.extraction import (
    extract_prd,
    get_extraction_quality_report,
    ExtractedPRD,
)
from app.pipeline.new_prd_extractor.models import (
    ExtractedActor,
    ExtractedCapability,
    ExtractedUseCase,
    ExtractedUserStory,
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
    task_decomposition: list[EngineeringTask] = field(default_factory=list)


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


def _effort_to_hours(effort: str | None) -> float | None:
    """Map effort size to rough hour estimate."""
    mapping = {"S": 4, "M": 8, "L": 16, "XL": 32}
    if effort and effort.upper() in mapping:
        return float(mapping[effort.upper()])
    return None


class PipelineExecutor:
    """Executes the 8-stage collaborative steering pipeline."""

    def __init__(self, session_id: str, project_id: str, prd_text: str, model_id: str | None = None):
        self.session_id = session_id
        self.project_id = project_id
        self.prd_text = prd_text
        self.model_id = model_id
        self.state = PipelineState(
            session_id=session_id,
            project_id=project_id,
        )
        self._paused = False
        self._cancelled = False
        self._callbacks: list[Callable[[PipelineEvent], None]] = []
        self._llm = None  # Lazy-initialized LLM client

    def _get_llm(self):
        """Lazy-initialize the LLM client, wrapped in a caching layer."""
        if self._llm is None:
            from app.llm.openai_compat_client import OpenAICompatClient
            from app.llm.cached_client import CachingLLMClient
            raw = OpenAICompatClient(model_id=self.model_id)
            self._llm = CachingLLMClient(raw)
        return self._llm

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
                if self._cancelled: return
                while self._paused and not self._cancelled: await asyncio.sleep(0.5)
                yield event
                self._emit(event)

            # ─── Stage 1: Ideation ───
            async for event in self._run_stage_1():
                if self._cancelled: return
                while self._paused and not self._cancelled: await asyncio.sleep(0.5)
                yield event
                self._emit(event)

            # ─── Stage 2: Actor Discovery ───
            async for event in self._run_stage_2():
                if self._cancelled: return
                while self._paused and not self._cancelled: await asyncio.sleep(0.5)
                yield event
                self._emit(event)

            # ─── Stage 3: Capability Mapping ───
            async for event in self._run_stage_3():
                if self._cancelled: return
                while self._paused and not self._cancelled: await asyncio.sleep(0.5)
                yield event
                self._emit(event)

            # ─── Stage 4: Use Case Generation ───
            async for event in self._run_stage_4():
                if self._cancelled: return
                while self._paused and not self._cancelled: await asyncio.sleep(0.5)
                yield event
                self._emit(event)

            # ─── Stage 5: Story Derivation ───
            async for event in self._run_stage_5():
                if self._cancelled: return
                while self._paused and not self._cancelled: await asyncio.sleep(0.5)
                yield event
                self._emit(event)

            # ─── Stage 6: Task Decomposition ───
            async for event in self._run_stage_6():
                if self._cancelled: return
                while self._paused and not self._cancelled: await asyncio.sleep(0.5)
                yield event
                self._emit(event)

            # ─── Stage 7: Blueprint Assembly ───
            async for event in self._run_stage_7():
                if self._cancelled: return
                while self._paused and not self._cancelled: await asyncio.sleep(0.5)
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

    # ───────────────────────────────────────────────────────────────────
    # Stage 0: Seed — classify PRD and extract explicit data
    # ───────────────────────────────────────────────────────────────────
    async def _run_stage_0(self) -> AsyncIterator[PipelineEvent]:
        self.state.current_stage = 0

        yield PipelineEvent(
            event_type="stage_start",
            stage_id=0,
            data={"message": "Stage 0: Intent Capture — parsing PRD..."},
        )

        await asyncio.sleep(0.3)

        # Extract all data from PRD using regex
        logger.info(f"Stage 0 PRD text preview (first 500 chars): {self.prd_text[:500]!r}")
        extracted = extract_prd(self.prd_text)
        self.state.extracted_data = extracted

        # Generate quality report
        quality = get_extraction_quality_report(extracted)
        self.state.quality_report = quality
        
        logger.info(f"Stage 0 extracted: word_count={extracted.word_count}, sections={extracted.explicit_sections_found}, actors={len(extracted.actors)}")
        logger.info(f"Stage 0 quality: {quality}")

        yield PipelineEvent(
            event_type="stage_chunk",
            stage_id=0,
            data={
                "message": f"PRD analyzed: {extracted.word_count} words, {quality['sections_count']} sections found",
                "classification": "WELL_FORMED" if quality["has_structure"] else "SEED_ONLY" if extracted.word_count < 100 else "MINIMALIST",
            },
        )

        await asyncio.sleep(0.2)

        if extracted.problem_statement:
            snippet = extracted.problem_statement[:120]
            yield PipelineEvent(
                event_type="stage_chunk",
                stage_id=0,
                data={"message": f"Problem statement: {snippet}..."},
            )
            await asyncio.sleep(0.1)

        # If regex extraction is poor, use LLM to enrich
        needs_llm = quality.get("needs_llm", False) or quality["quality_score"] < 40
        if needs_llm:
            yield PipelineEvent(
                event_type="stage_chunk",
                stage_id=0,
                data={"message": f"Regex extraction quality low ({quality['quality_score']}/100) — invoking LLM for deeper analysis..."},
            )
            await asyncio.sleep(0.2)

            try:
                llm = self._get_llm()
                llm_result = await llm.complete_json(
                    prompt=self._build_extraction_prompt(),
                    system="You are an expert product manager who extracts structured data from PRDs. Always respond with valid JSON.",
                    temperature=0.2,
                )
                # Merge LLM results into extracted data
                self._merge_llm_extraction(llm_result)
                # Recompute quality
                quality = get_extraction_quality_report(self.state.extracted_data)
                self.state.quality_report = quality
                yield PipelineEvent(
                    event_type="stage_chunk",
                    stage_id=0,
                    data={"message": f"LLM enrichment complete — quality improved to {quality['quality_score']}/100"},
                )
            except Exception as e:
                logger.warning(f"LLM extraction failed, continuing with regex results: {e}")
                yield PipelineEvent(
                    event_type="stage_chunk",
                    stage_id=0,
                    data={"message": f"LLM call failed ({str(e)[:80]}), continuing with regex-only extraction"},
                )

        yield PipelineEvent(
            event_type="stage_chunk",
            stage_id=0,
            data={
                "message": f"Extraction quality: {quality['quality_score']}/100 — {quality['actors_extracted']} actors, {quality['capabilities_extracted']} capabilities, {quality['use_cases_extracted']} use cases, {quality['user_stories_extracted']} stories",
                "quality_score": quality["quality_score"],
            },
        )

        await asyncio.sleep(0.2)

        sections_found = quality.get("sections_found", [])
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

    def _build_extraction_prompt(self) -> str:
        """Build the LLM prompt for PRD extraction."""
        prd_preview = self.prd_text[:4000]  # Cap to avoid context overflow
        return f"""Analyze this PRD and extract structured data as JSON.

PRD:
---
{prd_preview}
---

Return a JSON object with these fields:
{{
  "project_name": "string — the project/product name",
  "problem_statement": "string — the core problem being solved (1-3 sentences)",
  "actors": [
    {{"name": "string", "description": "string", "actor_type": "human|system|external", "responsibilities": ["string"]}}
  ],
  "capabilities": [
    {{"name": "string", "description": "string", "features": ["string"], "actor_names": ["string — which actors use this capability"]}}
  ],
  "use_cases": [
    {{"name": "string", "description": "string", "main_flow": ["step1", "step2"], "actor_names": ["string"], "capability_names": ["string — which capabilities this use case relates to"]}}
  ],
  "user_stories": [
    {{
      "title": "string — brief action-oriented title",
      "description": "As a [role], I want [action], so that [benefit]",
      "actor_name": "string",
      "use_case_name": "string — which use case this story implements",
      "priority": "high|medium|low",
      "acceptance_criteria": [
        "Given [precondition]",
        "When [action]",
        "Then [verifiable outcome]"
      ],
      "entities": [{{"name": "string", "type": "actor|domain_object|ui_element", "description": "string"}}],
      "external_interfaces": [{{"name": "string", "type": "external_api|database|service", "is_external": true}}]
    }}
  ]
}}

Rules:
1. Each capability MUST list actor_names — which actors perform or use this capability
2. Each use case MUST list actor_names and capability_names — linking actors and capabilities
3. Each user story MUST have actor_name and use_case_name — linking to parent entities
4. Every external API/database/service must be declared in external_interfaces with is_external=true
5. Stories must be VERTICAL SLICES — independently implementable, testable, deployable
6. BEFORE returning, verify: all capabilities have actor_names, all use_cases have capability_names
"""

    def _merge_llm_extraction(self, llm_result: dict | list) -> None:
        """Merge LLM-extracted data into the ExtractedPRD, enriching existing entities."""
        from app.pipeline.extraction import ExtractedActor, ExtractedCapability, ExtractedUseCase, ExtractedUserStory

        extracted = self.state.extracted_data
        if not extracted:
            return

        # Normalize if the LLM returned a bare list instead of the expected object
        if isinstance(llm_result, list):
            logger.warning("LLM extraction returned a list; treating as empty result.")
            return

        # Project name
        if not extracted.project_name and llm_result.get("project_name"):
            extracted.project_name = llm_result["project_name"]

        # Problem statement
        if not extracted.problem_statement and llm_result.get("problem_statement"):
            extracted.problem_statement = llm_result["problem_statement"]

        # Actors — add if not exists
        if not extracted.actors and llm_result.get("actors"):
            for a in llm_result["actors"]:
                extracted.actors.append(ExtractedActor(
                    name=a.get("name", ""),
                    description=a.get("description", ""),
                    actor_type=a.get("actor_type", "human"),
                    responsibilities=a.get("responsibilities", []),
                ))

        # Build actor name lookup for enriching capabilities
        actor_names = {a.name.lower() for a in extracted.actors}

        # Capabilities — add if not exists, or enrich with actor_names
        llm_caps = {c.get("name", "").lower(): c for c in llm_result.get("capabilities", [])}
        if not extracted.capabilities and llm_result.get("capabilities"):
            for c in llm_result["capabilities"]:
                extracted.capabilities.append(ExtractedCapability(
                    name=c.get("name", ""),
                    description=c.get("description", ""),
                    features=c.get("features", []),
                    actor_names=c.get("actor_names", []),
                ))
        else:
            # Enrich existing capabilities with actor_names from LLM
            for cap in extracted.capabilities:
                llm_cap = llm_caps.get(cap.name.lower())
                if llm_cap and not cap.actor_names:
                    # Only include actor_names that match known actors
                    cap.actor_names = [a for a in llm_cap.get("actor_names", []) if a.lower() in actor_names]

        # Build capability name lookup for enriching use cases
        cap_names = {c.name.lower() for c in extracted.capabilities}

        # Use cases — add if not exists, or enrich with capability_names
        llm_ucs = {uc.get("name", "").lower(): uc for uc in llm_result.get("use_cases", [])}
        if not extracted.use_cases and llm_result.get("use_cases"):
            for uc in llm_result["use_cases"]:
                extracted.use_cases.append(ExtractedUseCase(
                    name=uc.get("name", ""),
                    description=uc.get("description", ""),
                    main_flow=uc.get("main_flow", []),
                    actor_names=uc.get("actor_names", []),
                    capability_names=uc.get("capability_names", []),
                ))
        else:
            # Enrich existing use cases with capability_names from LLM
            for uc in extracted.use_cases:
                llm_uc = llm_ucs.get(uc.name.lower())
                if llm_uc:
                    if not uc.actor_names:
                        uc.actor_names = [a for a in llm_uc.get("actor_names", []) if a.lower() in actor_names]
                    if not uc.capability_names:
                        uc.capability_names = [c for c in llm_uc.get("capability_names", []) if c.lower() in cap_names]

        # Build use case name lookup for enriching user stories
        uc_names = {uc.name.lower() for uc in extracted.use_cases}

        # User stories — add if not exists, or enrich with use_case_name
        llm_stories = {s.get("title", "").lower(): s for s in llm_result.get("user_stories", [])}
        if not extracted.user_stories and llm_result.get("user_stories"):
            for us in llm_result["user_stories"]:
                extracted.user_stories.append(ExtractedUserStory(
                    title=us.get("title", ""),
                    description=us.get("description", ""),
                    acceptance_criteria=us.get("acceptance_criteria", []) or us.get("acceptanceCriteria", []),
                    entities=us.get("entities", []),
                    external_interfaces=us.get("external_interfaces", []),
                    actor_name=us.get("actor_name", ""),
                    use_case_name=us.get("use_case_name", ""),
                    priority=us.get("priority", "medium"),
                ))
        else:
            # Enrich existing user stories with use_case_name from LLM
            for story in extracted.user_stories:
                llm_story = llm_stories.get(story.title.lower())
                if llm_story:
                    if not story.actor_name:
                        story.actor_name = llm_story.get("actor_name", "")
                    if not story.use_case_name:
                        uc_name = llm_story.get("use_case_name", "")
                        if uc_name.lower() in uc_names:
                            story.use_case_name = uc_name

        logger.info(f"LLM enrichment: {len(extracted.actors)} actors, {len(extracted.capabilities)} capabilities, "
                    f"{len(extracted.use_cases)} use cases, {len(extracted.user_stories)} stories")
        for cap in extracted.capabilities:
            logger.info(f"  Capability '{cap.name}' → actor_names={cap.actor_names}")
        for uc in extracted.use_cases:
            logger.info(f"  UseCase '{uc.name}' → capability_names={uc.capability_names}, actor_names={uc.actor_names}")

    # ───────────────────────────────────────────────────────────────────
    # Stage 1: Ideation — summarize concepts from PRD
    # ───────────────────────────────────────────────────────────────────
    async def _run_stage_1(self) -> AsyncIterator[PipelineEvent]:
        self.state.current_stage = 1

        yield PipelineEvent(
            event_type="stage_start",
            stage_id=1,
            data={"message": "Stage 1: Ideation — synthesizing concepts from PRD..."},
        )

        extracted = self.state.extracted_data
        if extracted:
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

            await asyncio.sleep(0.2)

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

    # ───────────────────────────────────────────────────────────────────
    # Stage 2: Actor Discovery — extract/infer actors
    # ───────────────────────────────────────────────────────────────────
    async def _run_stage_2(self) -> AsyncIterator[PipelineEvent]:
        self.state.current_stage = 2

        yield PipelineEvent(
            event_type="stage_start",
            stage_id=2,
            data={"message": "Stage 2: Actor Discovery — extracting actors from PRD..."},
        )

        extracted = self.state.extracted_data
        if extracted and extracted.actors:
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
                await asyncio.sleep(0.15)

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
            # No actors found — use LLM to infer them
            yield PipelineEvent(
                event_type="stage_chunk",
                stage_id=2,
                data={"message": "No explicit actors found in PRD — invoking LLM to infer actors..."},
            )

            try:
                llm = self._get_llm()
                result = await llm.complete_json(
                    prompt=f"""Given this PRD, identify ALL actors (users, systems, external services) that interact with the product.

PRD:
---
{self.prd_text[:3000]}
---

Return JSON: {{"actors": [{{"name": "string", "description": "string", "actor_type": "human|system|external", "responsibilities": ["string"]}}]}}""",
                    system="You are an expert product analyst. Identify all actors mentioned or implied in the PRD. Always respond with valid JSON.",
                    temperature=0.2,
                )

                from app.pipeline.extraction import ExtractedActor
                actors = []
                for a in result.get("actors", []):
                    actor = ExtractedActor(
                        name=a.get("name", ""),
                        description=a.get("description", ""),
                        actor_type=a.get("actor_type", "human"),
                        responsibilities=a.get("responsibilities", []),
                    )
                    actors.append(actor)
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
                    await asyncio.sleep(0.15)

                if extracted:
                    extracted.actors = actors

                yield PipelineEvent(
                    event_type="stage_complete",
                    stage_id=2,
                    data={
                        "message": f"Stage 2 complete — {len(actors)} actors inferred by LLM",
                        "actors": [{"name": a.name, "type": a.actor_type, "description": a.description} for a in actors],
                    },
                )
            except Exception as e:
                logger.warning(f"LLM actor inference failed: {e}")
                yield PipelineEvent(
                    event_type="steering_required",
                    stage_id=2,
                    data={
                        "message": f"LLM actor inference failed ({str(e)[:60]}). Steering required: add actors manually or retry.",
                        "options": ["retry", "add_actors_manually", "skip"],
                    },
                )

    # ───────────────────────────────────────────────────────────────────
    # Stage 3: Capability Mapping
    # ───────────────────────────────────────────────────────────────────
    async def _run_stage_3(self) -> AsyncIterator[PipelineEvent]:
        self.state.current_stage = 3

        yield PipelineEvent(
            event_type="stage_start",
            stage_id=3,
            data={"message": "Stage 3: Capability Mapping — extracting capabilities from PRD..."},
        )

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
                await asyncio.sleep(0.15)

            yield PipelineEvent(
                event_type="stage_complete",
                stage_id=3,
                data={
                    "message": f"Stage 3 complete — {len(extracted.capabilities)} capabilities extracted from PRD",
                    "capabilities": [{"name": c.name, "description": c.description} for c in extracted.capabilities],
                },
            )
        else:
            yield PipelineEvent(
                event_type="stage_chunk",
                stage_id=3,
                data={"message": "No explicit capabilities found — invoking LLM to derive capabilities..."},
            )

            try:
                llm = self._get_llm()
                result = await llm.complete_json(
                    prompt=f"""Given this PRD, derive the key system capabilities (functional areas/features).

PRD:
---
{self.prd_text[:3000]}
---

Known actors: {json.dumps([a.name for a in (extracted.actors if extracted else [])])}

Each capability should reference the actors that use it via "actor_names".

Return JSON: {{"capabilities": [{{"name": "string", "description": "string", "features": ["string"], "actor_names": ["string"]}}]}}""",
                    system="You are an expert product analyst. Derive system capabilities from the PRD. Always respond with valid JSON.",
                    temperature=0.2,
                )

                from app.pipeline.extraction import ExtractedCapability
                caps = []
                for c in result.get("capabilities", []):
                    cap = ExtractedCapability(
                        name=c.get("name", ""),
                        description=c.get("description", ""),
                        features=c.get("features", []),
                        actor_names=c.get("actor_names", []),
                    )
                    caps.append(cap)
                    yield PipelineEvent(
                        event_type="stage_chunk",
                        stage_id=3,
                        data={"type": "capability", "name": cap.name, "description": cap.description, "features": cap.features},
                    )
                    await asyncio.sleep(0.15)

                if extracted:
                    extracted.capabilities = caps

                yield PipelineEvent(
                    event_type="stage_complete",
                    stage_id=3,
                    data={
                        "message": f"Stage 3 complete — {len(caps)} capabilities derived by LLM",
                        "capabilities": [{"name": c.name, "description": c.description} for c in caps],
                    },
                )
            except Exception as e:
                logger.warning(f"LLM capability inference failed: {e}")
                yield PipelineEvent(
                    event_type="stage_complete",
                    stage_id=3,
                    data={"message": f"Stage 3 complete — capabilities derivation failed ({str(e)[:60]})"},
                )

    # ───────────────────────────────────────────────────────────────────
    # Stage 4: Use Case Generation
    # ───────────────────────────────────────────────────────────────────
    async def _run_stage_4(self) -> AsyncIterator[PipelineEvent]:
        self.state.current_stage = 4

        yield PipelineEvent(
            event_type="stage_start",
            stage_id=4,
            data={"message": "Stage 4: Use Case Generation — extracting use cases from PRD..."},
        )

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
                await asyncio.sleep(0.15)

            yield PipelineEvent(
                event_type="stage_complete",
                stage_id=4,
                data={
                    "message": f"Stage 4 complete — {len(extracted.use_cases)} use cases extracted from PRD",
                    "use_cases": [{"name": u.name, "description": u.description} for u in extracted.use_cases],
                },
            )
        else:
            yield PipelineEvent(
                event_type="stage_chunk",
                stage_id=4,
                data={"message": "No explicit use cases found — invoking LLM to derive use cases..."},
            )

            try:
                llm = self._get_llm()
                actor_names = [a.name for a in (extracted.actors if extracted else [])]
                cap_names = [c.name for c in (extracted.capabilities if extracted else [])]
                result = await llm.complete_json(
                    prompt=f"""Given this PRD, derive the key use cases.

PRD:
---
{self.prd_text[:3000]}
---

Known actors: {json.dumps(actor_names)}
Known capabilities: {json.dumps(cap_names)}

Each use case should reference the capabilities it implements and the actors that participate.

Return JSON: {{"use_cases": [{{"name": "string", "description": "string", "main_flow": ["step1", "step2"], "actor_names": ["string"], "capability_names": ["string"]}}]}}""",
                    system="You are an expert product analyst. Derive use cases from the PRD. Always respond with valid JSON.",
                    temperature=0.2,
                )

                from app.pipeline.extraction import ExtractedUseCase
                ucs = []
                for u in result.get("use_cases", []):
                    uc = ExtractedUseCase(
                        name=u.get("name", ""),
                        description=u.get("description", ""),
                        main_flow=u.get("main_flow", []),
                        actor_names=u.get("actor_names", []),
                        capability_names=u.get("capability_names", []),
                    )
                    ucs.append(uc)
                    yield PipelineEvent(
                        event_type="stage_chunk",
                        stage_id=4,
                        data={"type": "use_case", "name": uc.name, "description": uc.description, "main_flow": uc.main_flow},
                    )
                    await asyncio.sleep(0.15)

                if extracted:
                    extracted.use_cases = ucs

                yield PipelineEvent(
                    event_type="stage_complete",
                    stage_id=4,
                    data={
                        "message": f"Stage 4 complete — {len(ucs)} use cases derived by LLM",
                        "use_cases": [{"name": u.name, "description": u.description} for u in ucs],
                    },
                )
            except Exception as e:
                logger.warning(f"LLM use case derivation failed: {e}")
                yield PipelineEvent(
                    event_type="stage_complete",
                    stage_id=4,
                    data={"message": f"Stage 4 complete — use case derivation failed ({str(e)[:60]})"},
                )

    # ───────────────────────────────────────────────────────────────────
    # Stage 5: Story Derivation
    # ───────────────────────────────────────────────────────────────────
    async def _run_stage_5(self) -> AsyncIterator[PipelineEvent]:
        self.state.current_stage = 5

        yield PipelineEvent(
            event_type="stage_start",
            stage_id=5,
            data={"message": "Stage 5: Story Derivation — extracting user stories from PRD..."},
        )

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
                await asyncio.sleep(0.15)

            yield PipelineEvent(
                event_type="stage_complete",
                stage_id=5,
                data={
                    "message": f"Stage 5 complete — {len(extracted.user_stories)} user stories extracted from PRD",
                    "user_stories": [{"title": s.title, "description": s.description[:100]} for s in extracted.user_stories],
                },
            )
        else:
            yield PipelineEvent(
                event_type="stage_chunk",
                stage_id=5,
                data={"message": "No explicit user stories found — invoking LLM to derive stories..."},
            )

            try:
                llm = self._get_llm()
                actor_names = [a.name for a in (extracted.actors if extracted else [])]
                uc_names = [u.name for u in (extracted.use_cases if extracted else [])]
                result = await llm.complete_json(
                    prompt=f"""Given this PRD, derive user stories in "As a [role], I want [goal] so that [benefit]" format.

PRD:
---
{self.prd_text[:3000]}
---

Known actors: {json.dumps(actor_names)}
Known use cases: {json.dumps(uc_names)}

Each user story must be a self-contained VERTICAL SLICE — independently implementable, testable, and deployable without requiring any other story to be completed first.

Self-containment rules:
1. Reference Completeness (RC): every entity/object referenced in the story must be defined in the story text or declared in the entities list.
2. Dependency Acyclicity (DA): no dependency phrases like "depends on", "requires X first", "after Y is implemented", "blocked by".
3. Path Completeness (PC): each story must have a complete Given → When → Then execution path.
4. Interface Closure (IC): every external API/database/service must be declared in external_interfaces with is_external=true.

Each story should reference the use case it derives from via "use_case_name".

Return JSON:
{{{{"user_stories": [
  {{
    "title": "string",
    "description": "As a [role], I want [action], so that [benefit]",
    "actor_name": "string",
    "use_case_name": "string",
    "priority": "high|medium|low",
    "acceptance_criteria": [
      "Given [precondition]",
      "When [action]",
      "Then [verifiable outcome]"
    ],
    "entities": [{{"name": "string", "type": "actor|domain_object|ui_element", "description": "string"}}],
    "external_interfaces": [{{"name": "string", "type": "external_api|database|service", "is_external": true}}]
  }}
]}}}}

BEFORE returning, run the 4-axiom self-check on each story and fix any that fail.""",
                    system="You are an expert Agile Business Analyst. Derive user stories from the PRD that are self-contained, atomic, and include Given/When/Then acceptance criteria. Always respond with valid JSON.",
                    temperature=0.2,
                )

                from app.pipeline.extraction import ExtractedUserStory
                stories = []
                for s in result.get("user_stories", []):
                    story = ExtractedUserStory(
                        title=s.get("title", ""),
                        description=s.get("description", ""),
                        acceptance_criteria=s.get("acceptance_criteria", []) or s.get("acceptanceCriteria", []),
                        entities=s.get("entities", []),
                        external_interfaces=s.get("external_interfaces", []),
                        actor_name=s.get("actor_name", ""),
                        priority=s.get("priority", "medium"),
                        use_case_name=s.get("use_case_name", ""),
                    )
                    stories.append(story)
                    yield PipelineEvent(
                        event_type="stage_chunk",
                        stage_id=5,
                        data={"type": "user_story", "title": story.title, "description": story.description, "actor_name": story.actor_name},
                    )
                    await asyncio.sleep(0.15)

                if extracted:
                    extracted.user_stories = stories

                yield PipelineEvent(
                    event_type="stage_complete",
                    stage_id=5,
                    data={
                        "message": f"Stage 5 complete — {len(stories)} user stories derived by LLM",
                        "user_stories": [{"title": s.title, "description": s.description[:100]} for s in stories],
                    },
                )
            except Exception as e:
                logger.warning(f"LLM story derivation failed: {e}")
                yield PipelineEvent(
                    event_type="stage_complete",
                    stage_id=5,
                    data={"message": f"Stage 5 complete — story derivation failed ({str(e)[:60]})"},
                )

    # ───────────────────────────────────────────────────────────────────
    # Stage 6: Task Decomposition
    # ───────────────────────────────────────────────────────────────────
    async def _run_stage_6(self) -> AsyncIterator[PipelineEvent]:
        self.state.current_stage = 6

        yield PipelineEvent(
            event_type="stage_start",
            stage_id=6,
            data={"message": "Stage 6: Task Decomposition — breaking stories into engineering tasks..."},
        )

        extracted = self.state.extracted_data
        if extracted and extracted.user_stories:
            yield PipelineEvent(
                event_type="stage_chunk",
                stage_id=6,
                data={"message": f"Decomposing {len(extracted.user_stories)} user stories into tasks via LLM..."},
            )

            try:
                llm = self._get_llm()
                story_title_to_id = {s.title: str(uuid4()) for s in extracted.user_stories}

                async def _decompose_one(story: ExtractedUserStory) -> dict:
                    summary = {
                        "title": story.title,
                        "description": story.description[:250],
                        "acceptance_criteria": story.acceptance_criteria,
                    }
                    prompt = (
                        "Decompose this user story into 2-5 concrete engineering tasks.\n\n"
                        "User Story:\n" + json.dumps(summary, indent=2) + "\n\n"
                        "For each task return: title, description, effort (S|M|L|XL), "
                        "task_type (hierarchical like BE_SERVICE, FE_PAGE, INFRA_DB, PLATFORM_API), "
                        "and a short Hoare-style contract with pre, post, inv, frame arrays.\n\n"
                        "Return only valid JSON: {\"tasks\": [{\"title\", \"description\", \"effort\", \"task_type\", \"contract\": {\"pre\":[], \"post\":[], \"inv\":[], \"frame\":[]}, \"dependencies\":[], \"estimated_hours\":0}]}"
                    )
                    result = await llm.complete_json(
                        prompt=prompt,
                        system="You are an expert engineering lead. Break a user story into concrete, contract-bearing tasks. Always return valid, complete JSON.",
                        temperature=0.2,
                    )
                    return {"story_title": story.title, "tasks": result.get("tasks", [])}

                all_tasks = await asyncio.gather(*[_decompose_one(s) for s in extracted.user_stories])
                total_tasks = sum(len(t.get("tasks", [])) for t in all_tasks)

                for story_tasks in all_tasks:
                    story_title = story_tasks.get("story_title", "")
                    for task in story_tasks.get("tasks", []):
                        story_id = story_title_to_id.get(story_title, "")
                        contract = task.get("contract") or {}
                        for key in ("pre", "post", "inv", "frame"):
                            if key not in contract:
                                contract[key] = []
                        task_obj = EngineeringTask(
                            title=task.get("title", ""),
                            description=task.get("description", ""),
                            story_ids=[story_id] if story_id else [],
                            estimated_hours=task.get("estimated_hours") or _effort_to_hours(task.get("effort", "M")),
                            dependencies=task.get("dependencies", []),
                            task_type=task.get("task_type", task.get("type", "general")),
                            contract=contract,
                        )
                        self.state.task_decomposition.append(task_obj)
                        yield PipelineEvent(
                            event_type="stage_chunk",
                            stage_id=6,
                            data={
                                "type": "task",
                                "story": story_title,
                                "title": task_obj.title,
                                "description": task_obj.description,
                                "effort": task.get("effort", "M"),
                                "task_type": task_obj.task_type,
                                "contract": task_obj.contract,
                            },
                        )
                        await asyncio.sleep(0.05)

                yield PipelineEvent(
                    event_type="stage_complete",
                    stage_id=6,
                    data={
                        "message": f"Stage 6 complete — {total_tasks} tasks derived from {len(all_tasks)} stories",
                        "task_count": total_tasks,
                    },
                )
            except Exception as e:
                logger.warning(f"LLM task decomposition failed: {e}")
                yield PipelineEvent(
                    event_type="stage_complete",
                    stage_id=6,
                    data={"message": f"Stage 6 complete — task decomposition failed ({str(e)[:60]})"},
                )
        else:
            yield PipelineEvent(
                event_type="stage_chunk",
                stage_id=6,
                data={"message": "No user stories to decompose — skipping task decomposition"},
            )
            yield PipelineEvent(
                event_type="stage_complete",
                stage_id=6,
                data={"message": "Stage 6 complete — no tasks (no user stories available)"},
            )

    # ───────────────────────────────────────────────────────────────────
    # Stage 7: Blueprint Assembly
    # ───────────────────────────────────────────────────────────────────
    async def _run_stage_7(self) -> AsyncIterator[PipelineEvent]:
        self.state.current_stage = 7

        yield PipelineEvent(
            event_type="stage_start",
            stage_id=7,
            data={"message": "Stage 7: Blueprint Assembly — validating completeness..."},
        )

        await asyncio.sleep(0.3)

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
                await asyncio.sleep(0.1)

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


    def to_blueprint_dict(self) -> dict | None:
        """Return the extracted data as a ProjectBlueprint-shaped dict.

        Uses resolved IDs when available, falls back to name→ID lookup
        for entities that only have name-based references (from regex
        or LLM extraction paths).
        """
        extracted = self.state.extracted_data
        if not extracted:
            return None

        # Build name→ID maps from the entities themselves
        actor_name_to_id: dict[str, str] = {}
        cap_name_to_id: dict[str, str] = {}
        uc_name_to_id: dict[str, str] = {}

        actors = []
        for a in extracted.actors:
            aid = a.id or str(uuid4())
            actor_name_to_id[a.name.lower()] = aid
            actors.append({
                "id": aid,
                "name": a.name,
                "description": a.description,
                "type": a.actor_type if a.actor_type in ("human", "system", "external") else "human",
                "state": "system_generated",
                "parent_ids": [],
            })

        capabilities = []
        for c in extracted.capabilities:
            cid = c.id or str(uuid4())
            cap_name_to_id[c.name.lower()] = cid
            # Use resolved IDs if available, otherwise resolve from names
            c_actors = c.actor_ids or [
                actor_name_to_id[n.lower()]
                for n in c.actor_names
                if n.lower() in actor_name_to_id
            ]
            capabilities.append({
                "id": cid,
                "name": c.name,
                "description": c.description,
                "actor_ids": c_actors,
                "state": "system_generated",
            })

        use_cases = []
        for u in extracted.use_cases:
            uid = u.id or str(uuid4())
            uc_name_to_id[u.name.lower()] = uid
            uc_actors = u.actor_ids or [
                actor_name_to_id[n.lower()]
                for n in u.actor_names
                if n.lower() in actor_name_to_id
            ]
            uc_caps = u.capability_ids or [
                cap_name_to_id[n.lower()]
                for n in u.capability_names
                if n.lower() in cap_name_to_id
            ]
            use_cases.append({
                "id": uid,
                "name": u.name,
                "description": u.description,
                "capability_ids": uc_caps,
                "actor_ids": uc_actors,
                "state": "system_generated",
            })

        user_stories = []
        for s in extracted.user_stories:
            sid = s.id or str(uuid4())
            story_actors = (
                [s.actor_id] if s.actor_id else
                [actor_name_to_id[s.actor_name.lower()]] if s.actor_name and s.actor_name.lower() in actor_name_to_id else
                []
            )
            story_uc = (
                [s.use_case_id] if s.use_case_id else
                [uc_name_to_id[s.use_case_name.lower()]] if s.use_case_name and s.use_case_name.lower() in uc_name_to_id else
                []
            )
            user_stories.append({
                "id": sid,
                "title": s.title,
                "description": s.description,
                "acceptance_criteria": s.acceptance_criteria,
                "entities": s.entities,
                "external_interfaces": s.external_interfaces,
                "use_case_ids": story_uc,
                "actor_ids": story_actors,
                "state": "system_generated",
            })

        task_decomposition = []
        for t in self.state.task_decomposition:
            task_decomposition.append(json.loads(t.model_dump_json()))

        return {
            "project_id": self.project_id,
            "project_name": extracted.project_name,
            "problem_statement": extracted.problem_statement,
            "actors": actors,
            "capabilities": capabilities,
            "use_cases": use_cases,
            "user_stories": user_stories,
            "tech_stack_profile": None,
            "infrastructure_profile": None,
            "rbac_model": None,
            "task_decomposition": task_decomposition,
            "completeness_status": "complete" if all([actors, capabilities, use_cases, user_stories, extracted.problem_statement]) else "incomplete",
            "version": 1,
        }


# ─── Global executor registry ───
_executors: dict[str, PipelineExecutor] = {}


def create_executor(session_id: str, project_id: str, prd_text: str, model_id: str | None = None) -> PipelineExecutor:
    """Create a new pipeline executor for a session."""
    executor = PipelineExecutor(session_id, project_id, prd_text, model_id=model_id)
    _executors[session_id] = executor
    return executor


def get_executor(session_id: str) -> PipelineExecutor | None:
    """Get an existing executor by session ID."""
    return _executors.get(session_id)


def remove_executor(session_id: str) -> None:
    """Remove an executor from the registry."""
    if session_id in _executors:
        del _executors[session_id]