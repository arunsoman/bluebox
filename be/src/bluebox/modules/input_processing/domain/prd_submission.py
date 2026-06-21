"""Persisted record of a project's submitted PRD/raw input.

Not part of doc/api_event_contract.md - the contract only documents the
one-shot `PRD_ANALYSIS_READY` push during `POST .../input`
(`OnboardingService.submit_input`), with no way to retrieve it afterwards.
Added so the IDE workspace's PRD tab (`new-fe/src/components/onboarding/PRDPanel.tsx`)
can show a previously-submitted PRD once a project has moved past onboarding
and that one-shot push is long gone - same "added after the contract was
written" precedent as `llm_config.py`/the log viewer (see CLAUDE.md).
"""

from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, Field

from bluebox.modules.input_processing.llm.responses import (
    ComplianceDetectionResult,
    PRDAnalysisReport,
    RichnessClassification,
)


class PrdSubmission(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: str
    raw_text: str
    source: str
    richness: RichnessClassification
    # None for MINIMALIST/SEED_ONLY input - those never run `analyze_prd_adaptive`
    # (OnboardingService.submit_input only does for WELL_FORMED).
    prd_analysis: PRDAnalysisReport | None = None
    compliance: ComplianceDetectionResult
    submitted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
