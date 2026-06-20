"""Adaptive PRD analysis: single-shot for documents that fit in one LLM
call, chunked for documents that don't.

`analyze_prd()` (`input_processing/llm/agents.py`) sends the entire raw PRD
text in one call — fine for the common case, but a sufficiently large PRD
will fail or get truncated by the provider. `analyze_prd_adaptive()` is the
drop-in replacement `OnboardingService.submit_input` calls instead: under
the chunk budget, it's a thin pass-through to the existing single-shot path
(zero behavior change); over it, the text is split by `chunking.chunk_prd`
and analyzed one chunk at a time via `analyze_prd_chunk`, then merged into
one `PRDAnalysisReport`.

Ported concept from `be/src/newllm/orchestrator.py` (an evaluation-only
package for a different project) - that version did full entity extraction
across chunks via a stateful `EntityRegistry`. This is a narrower problem:
`PRDAnalysisReport` is a coverage/gap analysis keyed off the 10 fixed
pipeline stages (`mapped_to_stage`, 0-9), not extracted entities, so
"missing" can be computed deterministically once every chunk has been seen
- no second LLM pass, no entity registry needed.
"""

from bluebox.modules.input_processing.chunking import chunk_prd, estimate_tokens
from bluebox.modules.input_processing.llm.agents import (
    analyze_prd,
    analyze_prd_chunk,
)
from bluebox.modules.input_processing.llm.requests import (
    PRDAnalysisRequest,
    PRDChunkAnalysisRequest,
)
from bluebox.modules.input_processing.llm.responses import (
    MissingSection,
    PRDAnalysisReport,
    PRDChunkAnalysisResult,
    PRDConflict,
    PRDSection,
    RichnessClassification,
    ThinSection,
    UnmappedSection,
)
from bluebox.shared_kernel.llm.connector import LLMCallFailed

# Conservative and fixed rather than introspected per-provider/model: we
# can't reliably determine context window for a generic OpenAI-compatible
# endpoint (NVIDIA NIM) or an arbitrary Ollama-cloud model name, so one
# budget is used regardless of which provider a request is routed to.
MAX_TOKENS_PER_CHUNK = 6000

# doc/prd.md SS3 pipeline stage sequence (Stage0SeedExecutor..Stage9RuntimeExecutor).
STAGE_NAMES: dict[int, str] = {
    0: "Seed / Problem Statement",
    1: "Ideation",
    2: "Actors",
    3: "Capabilities",
    4: "Use Cases",
    5: "User Stories",
    6: "Engineering Tasks",
    7: "Finalization",
    8: "Code Generation",
    9: "Runtime",
}

# Stage8CodeGenerationExecutor/Stage9RuntimeExecutor are "v1.1 ADD" per
# doc/prd.md SS3 - later, less load-bearing additions than the core
# Stage0-7 sequence, hence "recommended" rather than "blocking".
_BLOCKING_STAGES = frozenset(range(8))


def _normalize(name: str) -> str:
    return " ".join(name.strip().lower().split())


_QUALITY_RANK = {"thin": 0, "partial": 1, "complete": 2}


def _merge_chunk_results(
    chunk_results: list[PRDChunkAnalysisResult],
) -> tuple[list[PRDSection], list[ThinSection], list[UnmappedSection], list[PRDConflict]]:
    """Combine every chunk's contribution into one document-level view.

    `explicit_sections` is the only list carrying `mapped_to_stage` (the
    link to the 10 pipeline stages), so it's the only one deduped by
    `(section_name, mapped_to_stage)` with quality/actor/capability merging;
    `thin_sections`/`unmapped_sections` have no stage field and are deduped
    by section name alone, keeping the first occurrence - a later chunk
    re-flagging the same named section thin/unmapped adds no new pipeline
    information. `conflicts` are concatenated and exact-duplicate-stripped.
    """

    explicit_by_key: dict[tuple[str, int], PRDSection] = {}
    for chunk in chunk_results:
        for section in chunk.explicit_sections:
            key = (_normalize(section.section_name), section.mapped_to_stage)
            existing = explicit_by_key.get(key)
            if existing is None:
                explicit_by_key[key] = section
                continue
            # Same section split across chunks: the best quality seen
            # anywhere is evidence of real coverage, even if another chunk
            # only saw a thin fragment of it.
            if _QUALITY_RANK[section.content_quality] > _QUALITY_RANK[existing.content_quality]:
                existing.content_quality = section.content_quality
            existing.extracted_actors = list(
                dict.fromkeys((existing.extracted_actors or []) + (section.extracted_actors or []))
            )
            existing.extracted_capabilities = list(
                dict.fromkeys(
                    (existing.extracted_capabilities or []) + (section.extracted_capabilities or [])
                )
            )

    thin_by_name: dict[str, ThinSection] = {}
    unmapped_by_name: dict[str, UnmappedSection] = {}
    conflicts: list[PRDConflict] = []
    seen_conflicts: set[tuple[str, str]] = set()

    for chunk in chunk_results:
        for thin in chunk.thin_sections:
            thin_by_name.setdefault(_normalize(thin.section_name), thin)
        for unmapped in chunk.unmapped_sections:
            unmapped_by_name.setdefault(_normalize(unmapped.section_name), unmapped)
        for conflict in chunk.conflicts:
            dedup_key = (conflict.conflict_type, conflict.description)
            if dedup_key not in seen_conflicts:
                seen_conflicts.add(dedup_key)
                conflicts.append(conflict)

    return (
        list(explicit_by_key.values()),
        list(thin_by_name.values()),
        list(unmapped_by_name.values()),
        conflicts,
    )


def _missing_sections(explicit_sections: list[PRDSection]) -> list[MissingSection]:
    covered_stages = {section.mapped_to_stage for section in explicit_sections}
    return [
        MissingSection(
            expected_section_name=STAGE_NAMES[stage],
            pipeline_stage=stage,
            severity="blocking" if stage in _BLOCKING_STAGES else "recommended",
        )
        for stage in sorted(STAGE_NAMES)
        if stage not in covered_stages
    ]


def _format_sections_covered_so_far(explicit_sections: list[PRDSection]) -> str:
    if not explicit_sections:
        return "(none yet)"
    return "\n".join(
        f"- {s.section_name} (stage {s.mapped_to_stage}, {s.content_quality})" for s in explicit_sections
    )


_PIPELINE_STAGE_REFERENCE = "\n".join(f"{stage}: {name}" for stage, name in sorted(STAGE_NAMES.items()))


async def analyze_prd_adaptive(raw_text: str, richness: RichnessClassification) -> PRDAnalysisReport:
    """Drop-in replacement for `analyze_prd(PRDAnalysisRequest(raw_text=raw_text,
    detected_mode="WELL_FORMED"))` that chunks the input when it's too large
    for one LLM call. `detected_mode` is hardcoded "WELL_FORMED" below - the
    only caller (`OnboardingService.submit_input`) never reaches PRD
    analysis for MINIMALIST/SEED_ONLY input, so threading the mode through
    added nothing.

    `richness` is the `RichnessClassification` the caller already computed
    (via `classify_richness`) before calling this - needed because
    `PRDAnalysisReport.richness_classification` is required, but no single
    chunk can determine document-level richness on its own, so the chunked
    path has nowhere else to get it from. The single-shot path below doesn't
    use it: that LLM call independently produces its own
    `richness_classification` as part of one structured response, same as
    today.
    """

    if estimate_tokens(raw_text) <= MAX_TOKENS_PER_CHUNK:
        return await analyze_prd(PRDAnalysisRequest(raw_text=raw_text, detected_mode="WELL_FORMED"))

    chunks = chunk_prd(raw_text, max_tokens_per_chunk=MAX_TOKENS_PER_CHUNK)

    chunk_results: list[PRDChunkAnalysisResult] = []
    explicit_so_far: list[PRDSection] = []
    for chunk in chunks:
        try:
            result = await analyze_prd_chunk(
                PRDChunkAnalysisRequest(
                    chunk_text=chunk.text,
                    chunk_index=chunk.index,
                    total_chunks=chunk.total_chunks or len(chunks),
                    pipeline_stage_reference=_PIPELINE_STAGE_REFERENCE,
                    sections_covered_so_far=_format_sections_covered_so_far(explicit_so_far),
                )
            )
        except LLMCallFailed:
            # No regex fallback (unlike the ported newllm orchestrator) -
            # one chunk's failure degrades to "no contribution" rather than
            # aborting the whole analysis; any stage whose coverage lived
            # entirely in this chunk surfaces via the missing-sections diff.
            continue
        chunk_results.append(result)
        explicit_so_far.extend(result.explicit_sections)

    explicit_sections, thin_sections, unmapped_sections, conflicts = _merge_chunk_results(chunk_results)

    return PRDAnalysisReport(
        explicit_sections=explicit_sections,
        thin_sections=thin_sections,
        missing_sections=_missing_sections(explicit_sections),
        unmapped_sections=unmapped_sections,
        conflicts=conflicts,
        richness_classification=richness,
    )
