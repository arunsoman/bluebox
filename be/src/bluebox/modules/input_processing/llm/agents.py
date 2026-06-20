"""pydantic-ai Agents for the Input Processing module.

One Agent + one wrapper per call site listed in requests.py/responses.py.
Wrappers always serialize the request to JSON as the user prompt - the
system prompt explains how to interpret it. See
shared_kernel/llm/connector.py for the no-silent-retry call boundary.
"""

from bluebox.modules.input_processing.llm.requests import (
    ComplianceDetectionRequest,
    LegacyContextSummaryRequest,
    PRDAnalysisRequest,
    PRDChunkAnalysisRequest,
    RichnessClassificationRequest,
    SeedSynthesisRequest,
)
from bluebox.modules.input_processing.llm.responses import (
    ComplianceDetectionResult,
    LegacyContextReport,
    PRDAnalysisReport,
    PRDChunkAnalysisResult,
    RichnessClassification,
    Stage0Seed,
)
from bluebox.shared_kernel.llm.connector import build_agent, run_structured

_RICHNESS_CLASSIFICATION_PROMPT = """\
You classify raw project input into exactly one richness mode: WELL_FORMED
(a structured PRD with actors/capabilities/NFRs), MINIMALIST (a short
description with a problem statement and at least one actor), or SEED_ONLY
(a single sentence or product name). Zero silent defaults: always state the
concrete evidence behind your choice in classification_basis, list every gap
that lowers confidence, and set requires_user_review=true whenever confidence
falls below confidence_threshold (0.85)."""

richness_classification_agent = build_agent(RichnessClassification, _RICHNESS_CLASSIFICATION_PROMPT)


async def classify_richness(request: RichnessClassificationRequest) -> RichnessClassification:
    return await run_structured(
        richness_classification_agent, request.model_dump_json(indent=2), stage=0
    )


_PRD_ANALYSIS_PROMPT = """\
You analyze a WELL_FORMED PRD against the pipeline's expected sections
(Actors, Capabilities, Use Cases, NFRs, Security, Deployment, Data Model).
For each PRD section, classify it as explicit (clearly mapped to a stage),
thin (present but underspecified - explain exactly what's missing and
suggest a concrete follow-up prompt), or unmapped (no pipeline stage
consumes it - never silently discard it, suggest map_to_stage,
custom_annotation, or out_of_scope). Flag any contradiction, duplication, or
ambiguity between sections as a conflict rather than picking one silently."""

prd_analysis_agent = build_agent(PRDAnalysisReport, _PRD_ANALYSIS_PROMPT)


async def analyze_prd(request: PRDAnalysisRequest) -> PRDAnalysisReport:
    return await run_structured(prd_analysis_agent, request.model_dump_json(indent=2), stage=0)


_PRD_CHUNK_ANALYSIS_PROMPT = """\
You analyze ONE CHUNK of a larger WELL_FORMED PRD - the same task as
full-document PRD analysis, just scoped to this chunk. The request includes
a `pipeline_stage_reference` table (stage number -> stage name); every
`mapped_to_stage` you assign MUST be one of those exact numbers - a later
deterministic merge step relies on every chunk using the same numbering, so
inventing your own stage numbers (or being off by one) silently corrupts
that merge. You will also see a summary of which sections earlier chunks
already found explicit or thin coverage for; use it only to avoid
contradicting earlier chunks, never to claim a section is missing - a
section absent from THIS chunk may simply live in a different chunk, so
only report what this chunk's text actually contains (explicit, thin, or
unmapped), never missing_sections - that determination is made once every
chunk has been seen. Flag any contradiction, duplication, or ambiguity
within this chunk as a conflict rather than picking one silently."""

prd_chunk_analysis_agent = build_agent(PRDChunkAnalysisResult, _PRD_CHUNK_ANALYSIS_PROMPT)


async def analyze_prd_chunk(request: PRDChunkAnalysisRequest) -> PRDChunkAnalysisResult:
    return await run_structured(
        prd_chunk_analysis_agent, request.model_dump_json(indent=2), stage=0
    )


_COMPLIANCE_DETECTION_PROMPT = """\
You scan raw project input for signals of GDPR, HIPAA, PCI-DSS, SOC2,
ISO27001, or CCPA applicability (e.g. EU users, health records, card
payments, enterprise B2B SaaS). Only list a framework if there is a concrete
textual signal - state that signal as the finding's note. Conservative
defaults: when a framework is detected, prefer flagging a compliance gap
over assuming the system already handles it."""

compliance_detection_agent = build_agent(ComplianceDetectionResult, _COMPLIANCE_DETECTION_PROMPT)


async def detect_compliance(request: ComplianceDetectionRequest) -> ComplianceDetectionResult:
    return await run_structured(
        compliance_detection_agent, request.model_dump_json(indent=2), stage=0
    )


_SEED_SYNTHESIS_PROMPT = """\
You synthesize a Stage0Seed (problem_statement, target_users,
core_functionality, constraints, success_metrics) from a user's dialogue
answers (either the 5-question Minimalist flow or the multi-step Seed
Builder wizard). Use only what the user actually said - if an answer was
skipped or vague, leave the corresponding seed field minimal rather than
inventing specifics; never fabricate a constraint or success metric the
user did not state or clearly imply."""

seed_synthesis_agent = build_agent(Stage0Seed, _SEED_SYNTHESIS_PROMPT)


async def synthesize_seed(request: SeedSynthesisRequest) -> Stage0Seed:
    return await run_structured(seed_synthesis_agent, request.model_dump_json(indent=2), stage=0)


_LEGACY_CONTEXT_SUMMARY_PROMPT = """\
You map already-extracted facts from a static-analysis pass (languages,
frameworks, raw API routes, raw database tables) onto pipeline concepts:
existing actors, existing capabilities, detected architectural patterns
(e.g. mvc, microservices), and features the new pipeline run should suggest
adding. You do not parse source code yourself - only reason over the
extracted facts given to you. Flag any conflict where the legacy schema or
framework choice would be broken by treating this as a from-scratch build,
with severity blocking if it cannot be safely ignored."""

legacy_context_summary_agent = build_agent(LegacyContextReport, _LEGACY_CONTEXT_SUMMARY_PROMPT)


async def summarize_legacy_context(request: LegacyContextSummaryRequest) -> LegacyContextReport:
    return await run_structured(
        legacy_context_summary_agent, request.model_dump_json(indent=2), stage=0
    )
