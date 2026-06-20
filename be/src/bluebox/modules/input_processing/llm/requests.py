"""LLM request models for the Input Processing module.

doc/prd.md SS4.1 Input Processing Module: RichnessClassifier, PRDAnalyzer,
ComplianceAutoDetector, MinimalistDialogue/SeedBuilder, LegacyIngestor.
"""

from bluebox.shared_kernel.llm.base import LLMRequest


class RichnessClassificationRequest(LLMRequest):
    """doc/api_event_contract.md SS2.2 - classifies raw input into WELL_FORMED | MINIMALIST | SEED_ONLY."""

    raw_text: str
    source: str = "text"


class PRDAnalysisRequest(LLMRequest):
    """doc/api_event_contract.md SS2.2 PRDAnalysisReport - full analysis pass over a WELL_FORMED input."""

    raw_text: str
    detected_mode: str


class PRDChunkAnalysisRequest(LLMRequest):
    """Not in doc/api_event_contract.md - one chunk of a `PRDAnalysisRequest`
    too large for a single LLM call. See
    `input_processing/application/chunked_prd_analyzer.py`.

    `pipeline_stage_reference` is required (not a static prompt constant):
    the chunked path's `missing_sections` is computed deterministically by
    diffing which stage numbers got covered across all chunks, so every
    chunk's `mapped_to_stage` MUST use the same 0-9 numbering - without
    seeing the actual table, a model free-floats its own numbering (e.g.
    mapping "Capabilities" to stage 2 instead of 3), which silently breaks
    that diff. The single-shot `analyze_prd` path has no such requirement
    since one call is internally self-consistent.
    """

    chunk_text: str
    chunk_index: int
    total_chunks: int
    pipeline_stage_reference: str
    sections_covered_so_far: str = "(none yet)"


class ComplianceDetectionRequest(LLMRequest):
    """doc/prd.md SS4.1 ComplianceAutoDetector; doc/api_event_contract.md SS2.1 COMPLIANCE_DETECTED event."""

    raw_text: str


class SeedSynthesisRequest(LLMRequest):
    """doc/api_event_contract.md SS2.3 (Minimalist Dialogue) / SS2.4 (Seed Builder).

    Both modes converge on the same Stage0Seed output - the only difference
    is whether `answers` came from the fixed 5-question Minimalist flow or
    the multi-step Seed Builder wizard.
    """

    dialogue_id: str
    answers: dict[str, str | list[str] | float]


class LegacyContextSummaryRequest(LLMRequest):
    """doc/api_event_contract.md SS2.1 LegacyContextReport; doc/prd.md SS4.1 LegacyIngestor.

    Built from a prior static-analysis (AST) pass, not raw source - the LLM
    only maps already-extracted facts onto pipeline concepts (actors,
    capabilities), it does not parse source code itself.
    """

    languages: dict[str, float]
    detected_frameworks: list[str]
    existing_api_routes_raw: list[str]
    existing_database_tables_raw: dict[str, list[str]]
