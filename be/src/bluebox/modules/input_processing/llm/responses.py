"""LLM response models for the Input Processing module.

Field shapes are transcribed from doc/api_event_contract.md SS2.1-SS2.4.
Where the contract names a type without fully specifying it (`ExistingCapability`,
`ExistingRoute`, `ExistingTable`), the shape is inferred from the nearest
fully-specified analog (`ExistingActor`) and from mock_server.py's
`_init_project_nodes` / `connect_git` fixtures, noted per class.
"""

from typing import Literal

from pydantic import Field

from bluebox.shared_kernel.llm.base import LLMResponse

RichnessMode = Literal["WELL_FORMED", "MINIMALIST", "SEED_ONLY"]


class RichnessClassification(LLMResponse):
    """doc/api_event_contract.md SS2.2 `RichnessClassification`."""

    mode: RichnessMode
    confidence: float
    confidence_threshold: float = 0.85
    gaps: list[str]
    classification_basis: list[str]
    requires_user_review: bool


class PRDSection(LLMResponse):
    """doc/api_event_contract.md SS2.2 `PRDSection`."""

    section_name: str
    mapped_to_stage: int
    content_quality: Literal["complete", "partial", "thin"]
    extracted_actors: list[str] | None = None
    extracted_capabilities: list[str] | None = None


class ThinSection(LLMResponse):
    """doc/api_event_contract.md SS2.2 `ThinSection`."""

    section_name: str
    missing_detail: str
    suggested_prompt: str
    # Not in the contract - populated by the "Add detail" action
    # (doc/prd.md AC-RI-06) calling `draft_section_content`, None until then.
    generated_content: str | None = None


class MissingSection(LLMResponse):
    """doc/api_event_contract.md SS2.2 `MissingSection`."""

    expected_section_name: str
    pipeline_stage: int
    severity: Literal["blocking", "recommended"]
    # Not in the contract - populated by the "Generate" action
    # (doc/prd.md AC-RI-06) calling `draft_section_content`, None until then.
    generated_content: str | None = None


class UnmappedSection(LLMResponse):
    """doc/api_event_contract.md SS2.2 `UnmappedSection`."""

    section_name: str
    content_preview: str
    suggested_action: Literal["map_to_stage", "custom_annotation", "out_of_scope"]


class PRDConflict(LLMResponse):
    """doc/api_event_contract.md SS2.2 `PRDConflict`."""

    conflict_type: Literal["contradiction", "duplicate", "ambiguity"]
    description: str
    involved_sections: list[str]


class PRDAnalysisReport(LLMResponse):
    """doc/api_event_contract.md SS2.2 `PRDAnalysisReport` - the `PRD_ANALYSIS_READY` event payload."""

    explicit_sections: list[PRDSection]
    thin_sections: list[ThinSection]
    missing_sections: list[MissingSection]
    unmapped_sections: list[UnmappedSection]
    conflicts: list[PRDConflict]
    richness_classification: RichnessClassification
    # Not in the contract - section names moved here by the "Out of Scope"
    # action (doc/prd.md AC-RI-06), removed from unmapped_sections.
    out_of_scope_sections: list[str] = Field(default_factory=list)


class SectionContentDraft(LLMResponse):
    """Not in doc/api_event_contract.md - backs the "Generate"/"Add detail"
    actions (doc/prd.md AC-RI-06) on a missing or thin PRD section."""

    section_name: str
    content: str


class PRDChunkAnalysisResult(LLMResponse):
    """Not in doc/api_event_contract.md - one chunk's contribution towards a
    `PRDAnalysisReport`. No `missing_sections` or `richness_classification`:
    neither is knowable from a single chunk - missingness is only
    determined once every chunk has been seen (see
    `chunked_prd_analyzer.analyze_prd_adaptive`), and richness is already
    known by the caller before chunking starts."""

    explicit_sections: list[PRDSection] = []
    thin_sections: list[ThinSection] = []
    unmapped_sections: list[UnmappedSection] = []
    conflicts: list[PRDConflict] = []
    chunk_summary: str = ""


# doc/prd.md SS4.1 ComplianceAutoDetector frameworks
ComplianceFramework = Literal["GDPR", "HIPAA", "PCI-DSS", "SOC2", "ISO27001", "CCPA"]


class ComplianceFinding(LLMResponse):
    """mock_server.py COMPLIANCE_DETECTED.findings[] (contract names the event, not the finding shape)."""

    framework: ComplianceFramework
    status: Literal["compliant", "gap", "unknown"]
    note: str


class ComplianceDetectionResult(LLMResponse):
    """doc/api_event_contract.md SS2.1 `COMPLIANCE_DETECTED` event payload."""

    frameworks: list[ComplianceFramework]
    confidence: float
    findings: list[ComplianceFinding]


class Stage0Seed(LLMResponse):
    """doc/api_event_contract.md SS2.4 `Stage0Seed`."""

    problem_statement: str
    target_users: list[str]
    core_functionality: list[str]
    constraints: list[str]
    success_metrics: list[str]


class ExistingActor(LLMResponse):
    """doc/api_event_contract.md SS2.1 `ExistingActor`."""

    actor_name: str
    mapped_to: str | None = None
    confidence: float
    source_files: list[str]


class ExistingCapability(LLMResponse):
    """Inferred from `ExistingActor` (contract SS2.1 names the type without fields);
    confirmed shape from mock_server.py `connect_git` legacy_report fixture."""

    capability_name: str
    mapped_to: str | None = None
    confidence: float


class ExistingRoute(LLMResponse):
    """Inferred analog of `ExistingActor`; shape confirmed by mock_server.py
    `existing_api_routes` fixture."""

    method: Literal["GET", "POST", "PUT", "DELETE", "PATCH"]
    path: str


class ExistingTable(LLMResponse):
    """Inferred analog of `ExistingActor`; shape confirmed by mock_server.py
    `existing_database_schema` fixture."""

    table_name: str
    columns: list[str]


class LegacyConflict(LLMResponse):
    """doc/api_event_contract.md SS2.1 `LegacyConflict`."""

    type: Literal["database_mismatch", "framework_conflict", "schema_incompatibility"]
    description: str
    legacy_value: str
    suggested_value: str
    severity: Literal["warning", "blocking"]


class LegacyContextReport(LLMResponse):
    """doc/api_event_contract.md SS2.1 `LegacyContextReport`; doc/prd.md SS4.1 LegacyIngestor output."""

    existing_actors: list[ExistingActor]
    existing_capabilities: list[ExistingCapability]
    existing_api_routes: list[ExistingRoute]
    existing_database_schema: list[ExistingTable]
    detected_patterns: list[str]
    suggested_new_features: list[str]
    conflicts: list[LegacyConflict]
