"""doc/api_event_contract.md SS6.3 `TechStackProfile`.

Same narrower exception as `advisory/scaling/domain/infrastructure_profile.py`:
reuses `TechStackComponent` from `advisory/tech_stack/llm/responses.py`
directly rather than redeclaring it - a committed snapshot with no domain
behavior, not the traversable Node/RBAC graph.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from bluebox.modules.advisory.tech_stack.llm.responses import TechStackComponent


class TechStackProfile(BaseModel):
    model_config = ConfigDict(extra="forbid")

    profile_id: str
    frontend: TechStackComponent
    backend: TechStackComponent
    database: TechStackComponent
    cache: TechStackComponent | None = None
    auth: TechStackComponent | None = None
    hosting: TechStackComponent | None = None
    committed_at: datetime = Field(default_factory=datetime.now)
    rationale: str
