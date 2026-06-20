"""LLM request models for the Code Generation & Runtime module.

doc/prd.md SS4.8: CodeGenerator, WorkspaceManager (merge conflicts),
provenance explanations for the IDE. Stage 9 (RuntimeSandbox: running code,
hot reload, test execution) has no LLM call site - it executes what Stage 8
already generated.
"""

from bluebox.modules.advisory.scaling.llm.responses import HostingOption
from bluebox.modules.core_pipeline.llm.requests import TechStackSummary
from bluebox.modules.core_pipeline.llm.responses import EngineeringTaskCandidate
from bluebox.shared_kernel.llm.base import LLMRequest


class FileProvenanceContext(LLMRequest):
    """Provenance chain fed into the prompt so the generated file's
    ProvenanceHeader (doc/prd.md Glossary) is correct."""

    task_id: str
    story_id: str
    decision_entry_id: str
    checkpoint_id: str


class CodeFileGenerationRequest(LLMRequest):
    """doc/api_event_contract.md SS8.1 - Stage 8 CodeGenerator, one file at a time."""

    task: EngineeringTaskCandidate
    file_path: str
    tech_stack: TechStackSummary
    provenance: FileProvenanceContext


class RBACSummary(LLMRequest):
    """Condensed RBACModel digest for middleware-compilation prompts."""

    role_names: list[str]
    permission_resources: list[str]


class RBACMiddlewareCompilationRequest(LLMRequest):
    """doc/prd.md AC-CG-04 - compiles the RBAC model into executable auth middleware."""

    rbac_summary: RBACSummary
    target_framework: str


class InfrastructureCodeCompilationRequest(LLMRequest):
    """doc/prd.md AC-CG-05 - compiles the selected HostingOption into IaC files
    (Terraform, Docker, CI/CD YAML)."""

    selected_option: HostingOption
    target_provider: str


class MergeConflictContext(LLMRequest):
    """doc/api_event_contract.md SS7.2 `MergeConflict` fields needed for a
    resolution suggestion. Values are modeled as text (`str`) because the
    conflicts this module resolves are over file content / text fields, not
    arbitrary structured data - contract's `any` is narrowed deliberately."""

    node_id: str
    field: str
    base_value: str
    ours_value: str
    theirs_value: str


class MergeConflictResolutionRequest(LLMRequest):
    """doc/api_event_contract.md SS7.2 - WorkspaceManager three-way merge."""

    conflict: MergeConflictContext


class ProvenanceExplanationRequest(LLMRequest):
    """doc/prd.md FR-IDE-07, AC-CG-10 - plain-language hover-tooltip explanation."""

    file_path: str
    task_description: str
    linked_story_title: str
    decision_chain: list[str]
