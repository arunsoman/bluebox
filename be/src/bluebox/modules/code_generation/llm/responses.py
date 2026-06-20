"""LLM response models for the Code Generation & Runtime module.

`content_hash` and `size_bytes` from doc/api_event_contract.md SS8.1
`GeneratedFile` are intentionally NOT modeled here: they are deterministic
functions of `content` (sha256, len) computed by application code after
generation, never asked of the LLM - having the model produce a hash would
be pure hallucination risk for zero benefit. `provenance` is likewise
attached by the application layer from already-known IDs, not generated.
`GeneratedFileDraft` below is the generative subset of the contract's
`GeneratedFile`; the full DTO is assembled outside the LLM boundary.
"""

from bluebox.shared_kernel.llm.base import LLMResponse


class GeneratedFileDraft(LLMResponse):
    """The generative part of doc/api_event_contract.md SS8.1 `GeneratedFile`."""

    file_path: str
    content: str
    language: str


class GeneratedFileDraftSet(LLMResponse):
    """Multi-file compilation output - doc/prd.md AC-CG-04 (RBAC middleware),
    AC-CG-05 (infrastructure-as-code)."""

    files: list[GeneratedFileDraft]


class MergeConflictResolutionSuggestion(LLMResponse):
    """doc/api_event_contract.md SS7.2 `MergeConflict.resolved_value`, LLM-proposed."""

    resolved_value: str
    rationale: str
    confidence: float


class ProvenanceExplanation(LLMResponse):
    """doc/prd.md FR-IDE-07 Provenance Tooltip; AC-CG-10."""

    why_this_file_exists: str
    decision_chain_narrative: str
