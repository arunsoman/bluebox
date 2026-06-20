"""doc/api_event_contract.md SS6.2 `InfrastructureProfile`.

Unlike `Node`/`RBACModel` (which get the full anti-corruption-layer
treatment - redeclared rather than imported from any `llm/responses.py`),
`InfrastructureProfile` reuses `HostingOption` directly from
`advisory/scaling/llm/responses.py`. Narrower exception, deliberately: this
is a committed configuration snapshot with no lifecycle methods and no
place in the traversable Node graph, so there is no domain behavior that
LLM-shape coupling could contaminate - duplicating the nested `CostRange`/
`InfrastructureComponent` types here for no behavioral benefit isn't worth
the upkeep cost given how much surface remains to build.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from bluebox.modules.advisory.scaling.llm.responses import HostingOption


class InfrastructureProfile(BaseModel):
    model_config = ConfigDict(extra="forbid")

    profile_id: str
    selected_option: HostingOption
    scale_persona: str
    committed_at: datetime = Field(default_factory=datetime.now)
    committed_by: str
    stale: bool = False
    stale_reason: str | None = None
    generated_files: list[str] = Field(default_factory=list)
