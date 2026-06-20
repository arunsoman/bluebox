"""Project aggregate root - doc/api_event_contract.md SS1.2 dashboard fields.

Owned by core_pipeline: doc/prd.md SS4.2 names `PipelineOrchestrator` (in
this same package) as "single source of truth for pipeline_state", and a
Project is the container a PipelineOrchestrator belongs to.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from bluebox.modules.core_pipeline.domain.state_machine import TrustMode


class Project(BaseModel):
    """doc/api_event_contract.md SS1.2 project summary fields."""

    model_config = ConfigDict(extra="forbid", validate_assignment=True)

    project_id: str
    project_name: str
    description: str = ""
    owner_id: str
    trust_mode: TrustMode = "BALANCED"
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
