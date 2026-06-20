"""Tests for input_processing/application/chunked_prd_analyzer.py.

Merge-logic tests use hand-built `PRDChunkAnalysisResult` fixtures directly
(no LLM call needed). The single-shot-vs-chunked dispatch and the
LLM-failure-degrades-gracefully path go through `analyze_prd_adaptive`
itself with the relevant agent on `TestModel`/monkeypatched, mirroring the
`agent.override(model=TestModel())` pattern used elsewhere
(test_core_pipeline_application.py).
"""

from pydantic_ai.models.test import TestModel

from bluebox.modules.input_processing.application.chunked_prd_analyzer import (
    MAX_TOKENS_PER_CHUNK,
    STAGE_NAMES,
    _merge_chunk_results,
    _missing_sections,
    analyze_prd_adaptive,
)
from bluebox.modules.input_processing.llm.agents import prd_analysis_agent, prd_chunk_analysis_agent
from bluebox.modules.input_processing.llm.responses import (
    PRDChunkAnalysisResult,
    PRDConflict,
    PRDSection,
    RichnessClassification,
    ThinSection,
    UnmappedSection,
)

_RICHNESS = RichnessClassification(
    mode="WELL_FORMED",
    confidence=0.95,
    gaps=[],
    classification_basis=["structured PRD with actors and capabilities"],
    requires_user_review=False,
)


def test_explicit_section_quality_upgraded_across_chunks():
    chunk_a = PRDChunkAnalysisResult(
        explicit_sections=[
            PRDSection(
                section_name="Actors", mapped_to_stage=2, content_quality="thin", extracted_actors=["Admin"]
            )
        ]
    )
    chunk_b = PRDChunkAnalysisResult(
        explicit_sections=[
            PRDSection(
                section_name="actors",
                mapped_to_stage=2,
                content_quality="complete",
                extracted_actors=["Dentist"],
            )
        ]
    )
    explicit, _thin, _unmapped, _conflicts = _merge_chunk_results([chunk_a, chunk_b])
    assert len(explicit) == 1
    merged = explicit[0]
    assert merged.content_quality == "complete"
    assert merged.extracted_actors == ["Admin", "Dentist"]


def test_missing_sections_covers_every_uncovered_stage():
    explicit = [PRDSection(section_name="Actors", mapped_to_stage=2, content_quality="complete")]
    missing = _missing_sections(explicit)
    missing_stages = {m.pipeline_stage for m in missing}
    assert missing_stages == set(STAGE_NAMES) - {2}


def test_missing_sections_severity_splits_blocking_vs_recommended():
    missing = _missing_sections([])
    by_stage = {m.pipeline_stage: m.severity for m in missing}
    assert all(by_stage[s] == "blocking" for s in range(8))
    assert by_stage[8] == "recommended"
    assert by_stage[9] == "recommended"


def test_conflicts_deduped_across_chunks():
    conflict = PRDConflict(conflict_type="ambiguity", description="x", involved_sections=["Actors"])
    chunk_a = PRDChunkAnalysisResult(conflicts=[conflict])
    chunk_b = PRDChunkAnalysisResult(conflicts=[conflict])
    _explicit, _thin, _unmapped, conflicts = _merge_chunk_results([chunk_a, chunk_b])
    assert conflicts == [conflict]


def test_thin_and_unmapped_dedupe_by_name_keep_first():
    thin = ThinSection(section_name="NFRs", missing_detail="vague", suggested_prompt="add detail")
    other_thin = ThinSection(section_name="nfrs", missing_detail="different", suggested_prompt="ignored")
    unmapped = UnmappedSection(section_name="Marketing", content_preview="...", suggested_action="out_of_scope")
    chunk_a = PRDChunkAnalysisResult(thin_sections=[thin], unmapped_sections=[unmapped])
    chunk_b = PRDChunkAnalysisResult(thin_sections=[other_thin], unmapped_sections=[unmapped])
    _explicit, thin_sections, unmapped_sections, _conflicts = _merge_chunk_results([chunk_a, chunk_b])
    assert thin_sections == [thin]
    assert unmapped_sections == [unmapped]


async def test_small_prd_takes_single_shot_path():
    with prd_analysis_agent.override(model=TestModel()):
        report = await analyze_prd_adaptive("A short PRD.", _RICHNESS)
    assert report.richness_classification.mode in ("WELL_FORMED", "MINIMALIST", "SEED_ONLY")


async def test_large_prd_takes_chunked_path_and_merges():
    big_text = (
        "# Big PRD\n\n## Actors\n- Admin\n\n## Use Cases\n"
        + "\n".join(f"- Use case {i}: does thing {i}." for i in range(2000))
    )
    assert len(big_text) > MAX_TOKENS_PER_CHUNK * 4  # sanity: definitely over budget

    with prd_chunk_analysis_agent.override(model=TestModel()):
        report = await analyze_prd_adaptive(big_text, _RICHNESS)

    assert report.richness_classification == _RICHNESS
    assert len(report.missing_sections) <= len(STAGE_NAMES)


async def test_chunk_llm_failure_degrades_instead_of_aborting(monkeypatch):
    big_text = (
        "# Big PRD\n\n## Actors\n- Admin\n\n## Use Cases\n"
        + "\n".join(f"- Use case {i}: does thing {i}." for i in range(2000))
    )

    from bluebox.shared_kernel.llm.connector import LLMCallFailed
    from bluebox.shared_kernel.llm.failures import LLMFailure

    async def always_fails(*args, **kwargs):
        raise LLMCallFailed(LLMFailure(failure_type="timeout", prompt_id="p-1", stage=0))

    monkeypatch.setattr(
        "bluebox.modules.input_processing.application.chunked_prd_analyzer.analyze_prd_chunk",
        always_fails,
    )

    report = await analyze_prd_adaptive(big_text, _RICHNESS)
    assert report.explicit_sections == []
    assert len(report.missing_sections) == len(STAGE_NAMES)
