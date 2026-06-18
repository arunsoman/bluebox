"""Async streaming orchestrator — the heart of the extraction pipeline.

Ties together:

1. **Structural chunking** (``chunk_prd``) — splits the PRD into
   token-budget-respecting chunks.
2. **Fast regex extraction** (``extract_chunk``) — cheap first pass.
3. **Quality-gated LLM calls** — chunks with low quality scores go to
   PydanticAI; high-confidence chunks skip the LLM entirely.
4. **Cross-chunk entity resolution** (``ExtractionRegistry``) — actors
   extracted in chunk N are visible to chunk N+1's prompt.
5. **Async generator** — yields ``PRDExtractionEvent`` after every
   chunk so callers get incremental progress (TUI, WebSocket, etc.)

Usage::

    async for event in extract_prd_streaming(prd_text):
        print(event.type, event.message)
    final_prd = event.final_prd  # last event carries the full result
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import Enum
from typing import AsyncGenerator

from .agent_extractor import (
    DEFAULT_USAGE_LIMITS,
    ExtractionDeps,
    _HAS_PYDANTIC_AI,
    create_extraction_agent,
    run_agent_on_chunk,
)
from .chunker import Chunk, chunk_prd
from .fast_regex import (
    chunk_quality_score,
    extract_chunk,
    extract_problem_statement,
    extract_project_name,
)
from .models import ChunkResult, ExtractedPRD
from .registry import ExtractionRegistry


class EventType(str, Enum):
    """Event types emitted by the streaming extractor."""

    CHUNK_START = "chunk_start"
    CHUNK_REGEX_OK = "chunk_regex_ok"
    CHUNK_LLM_OK = "chunk_llm_ok"
    CHUNK_FAILED = "chunk_failed"
    RESOLVING_REFS = "resolving_refs"
    RECONCILING_DUPS = "reconciling_dups"
    COMPLETE = "complete"


@dataclass
class PRDExtractionEvent:
    """Incremental event yielded after each pipeline stage.

    The final ``COMPLETE`` event carries the fully assembled
    ``ExtractedPRD`` in ``final_prd``.
    """

    type: EventType
    message: str = ""
    chunk_index: int = 0
    total_chunks: int = 0
    chunk_types: list[str] = field(default_factory=list)
    quality_score: int = 0
    used_llm: bool = False
    llm_error: str | None = None
    warnings: list[str] = field(default_factory=list)
    actions: list[str] = field(default_factory=list)
    final_prd: ExtractedPRD | None = None


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Quality-score threshold: at or above this, a chunk skips the LLM.
_QUALITY_THRESHOLD: int = 70


# ---------------------------------------------------------------------------
# Public streaming API
# ---------------------------------------------------------------------------


async def extract_prd_streaming(
    text: str,
    *,
    token_budget: int = 6_000,
    quality_threshold: int = _QUALITY_THRESHOLD,
    force_llm: bool = False,
    model: str = "anthropic:claude-sonnet-4-20250514",
    usage_limits=None,
) -> AsyncGenerator[PRDExtractionEvent, None]:
    """Parse a PRD into structured data, yielding incremental events.

    Parameters:
        text: Raw PRD markdown.
        token_budget: Max tokens per chunk (tiktoken approximation).
        quality_threshold: Regex quality score at which to skip LLM.
        force_llm: If ``True``, send *every* chunk to the LLM
            regardless of regex quality (useful for benchmarking).
        model: PydanticAI model selector string.
        usage_limits: PydanticAI ``UsageLimits`` for per-chunk guardrails.

    Yields:
        ``PRDExtractionEvent`` after each meaningful pipeline stage.
    """

    # --- Phase 0: Chunking ------------------------------------------------
    chunks = chunk_prd(text, token_budget=token_budget)
    total = len(chunks)

    yield PRDExtractionEvent(
        type=EventType.CHUNK_START,
        message=f"Split PRD into {total} chunk(s) (budget={token_budget} tokens)",
        total_chunks=total,
    )

    # --- Phase 1: Per-chunk extraction ------------------------------------
    registry = ExtractionRegistry()
    agent = None  # lazily created on first LLM need

    for idx, chunk in enumerate(chunks, start=1):
        event_base = {
            "chunk_index": idx,
            "total_chunks": total,
            "chunk_types": [t.value for t in chunk.section_types],
        }

        # 1a. Regex extraction (always run — populates registry + scores)
        regex_result = extract_chunk(chunk)
        score = chunk_quality_score(chunk, regex_result)

        # Absorb regex-found entities BEFORE any LLM call on this chunk,
        # so a same-chunk actor is visible to that same chunk's LLM.
        registry.absorb(regex_result)

        use_llm = force_llm or score < quality_threshold

        if not use_llm:
            yield PRDExtractionEvent(
                type=EventType.CHUNK_REGEX_OK,
                message=f"Chunk {idx}/{total} — regex sufficient (score={score})",
                quality_score=score,
                used_llm=False,
                **event_base,
            )
            continue

        # 1b. LLM extraction (skip if pydantic-ai unavailable)
        if not _HAS_PYDANTIC_AI:
            yield PRDExtractionEvent(
                type=EventType.CHUNK_FAILED,
                message=f"Chunk {idx}/{total} — LLM skipped (pydantic-ai not installed)",
                quality_score=score,
                used_llm=False,
                llm_error="pydantic-ai is not installed",
                **event_base,
            )
            continue

        if agent is None:
            agent = create_extraction_agent(
                model=model,
                usage_limits=usage_limits or DEFAULT_USAGE_LIMITS,
            )

        deps = ExtractionDeps(
            registry=registry,
            chunk_types=chunk.section_types,
        )

        try:
            llm_result, usage = await run_agent_on_chunk(
                agent=agent,
                chunk_text=chunk.text,
                deps=deps,
                usage_limits=usage_limits or DEFAULT_USAGE_LIMITS,
            )
            llm_result.used_llm = True
            registry.absorb(llm_result)

            yield PRDExtractionEvent(
                type=EventType.CHUNK_LLM_OK,
                message=(
                    f"Chunk {idx}/{total} — LLM extracted "
                    f"(actors={len(llm_result.actors)}, caps={len(llm_result.capabilities)}, "
                    f"ucs={len(llm_result.use_cases)}, stories={len(llm_result.user_stories)}; "
                    f"prompt_tokens={usage.request_tokens}, response_tokens={usage.response_tokens})"
                ),
                quality_score=score,
                used_llm=True,
                **event_base,
            )
        except Exception as exc:
            # Fallback: regex result is already absorbed above
            yield PRDExtractionEvent(
                type=EventType.CHUNK_FAILED,
                message=f"Chunk {idx}/{total} — LLM failed ({type(exc).__name__}: {exc}), fell back to regex",
                quality_score=score,
                used_llm=False,
                llm_error=f"{type(exc).__name__}: {exc}",
                **event_base,
            )

    # --- Phase 2: Cross-chunk resolution ----------------------------------
    yield PRDExtractionEvent(
        type=EventType.RESOLVING_REFS,
        message="Resolving cross-chunk entity references...",
    )
    warnings = registry.resolve_dangling_references()

    yield PRDExtractionEvent(
        type=EventType.RECONCILING_DUPS,
        message="Reconciling near-duplicate entities...",
    )
    actions = registry.reconcile_near_duplicates()

    # --- Phase 3: Final assembly ------------------------------------------
    word_count = len(text.split())
    has_structure = bool(re.search(r"^#{1,3}\s+", text, re.MULTILINE))
    explicit_sections = list({t.value for t in chunk.section_types for chunk in chunks})

    # Pull project-level fields from first chunk's regex if available
    project_name = extract_project_name(text)
    problem_statement = extract_problem_statement(text)

    final_prd = registry.to_prd(
        word_count=word_count,
        has_structure=has_structure,
        explicit_sections=explicit_sections,
    )
    final_prd.project_name = project_name or final_prd.project_name
    final_prd.problem_statement = problem_statement or final_prd.problem_statement

    # Reconstruct overview from preamble if present
    if chunks and chunks[0].section_types and chunks[0].section_types[0].value == "_preamble":
        final_prd.overview = chunks[0].text[:2000]

    yield PRDExtractionEvent(
        type=EventType.COMPLETE,
        message=(
            f"Extraction complete — "
            f"actors={len(final_prd.actors)}, caps={len(final_prd.capabilities)}, "
            f"ucs={len(final_prd.use_cases)}, stories={len(final_prd.user_stories)}, "
            f"nfr={len(final_prd.non_functional_requirements)}"
        ),
        warnings=warnings,
        actions=actions,
        final_prd=final_prd,
    )


# ---------------------------------------------------------------------------
# Convenience: blocking extraction
# ---------------------------------------------------------------------------


async def extract_prd(
    text: str,
    **kwargs,
) -> ExtractedPRD:
    """Blocking convenience wrapper — collect the full result.

    All keyword arguments forwarded to ``extract_prd_streaming``.
    """
    final_event: PRDExtractionEvent | None = None
    async for event in extract_prd_streaming(text, **kwargs):
        final_event = event
    if final_event is None or final_event.final_prd is None:
        raise RuntimeError("Extraction pipeline yielded no result")
    return final_event.final_prd
