"""Tech Stack Advisor application service - doc/prd.md SS4.3.

Generates a `TechStackOptionsMatrix` from confirmed actors + scale_persona,
then commits a selected `TechStackOption` as a `TechStackProfile` snapshot.

`TechStackOption.stack` is a flat, unlabeled `list[TechStackComponent]` (see
`llm/responses.py` docstring - the contract only specifies the committed
`TechStackProfile`, not the pre-selection options shape). mock_server.py's
`TECH_STACK_OPTIONS_MATRIX` fixture orders each stack frontend-first,
backend-second, database-third, with any remaining components being
cache/auth/hosting in no fixed order - so `_split_stack` below takes the
first three positionally (frontend/backend/database, the three
`TechStackProfile` fields with no default) and keyword-matches the rest
into cache/auth/hosting, since that's the only signal available short of
asking the LLM to label categories it isn't currently asked to label.
"""

import uuid

from bluebox.modules.advisory.tech_stack.domain.tech_stack_profile import TechStackProfile
from bluebox.modules.advisory.tech_stack.llm import agents as tech_stack_agents
from bluebox.modules.advisory.tech_stack.llm.requests import TechStackOptionsRequest
from bluebox.modules.advisory.tech_stack.llm.responses import (
    TechStackComponent,
    TechStackOption,
    TechStackOptionsMatrix,
)
from bluebox.modules.core_pipeline.llm.requests import ConfirmedNodeRef
from bluebox.shared_kernel.ports import TechStackProfileRepository

_CACHE_KEYWORDS = ("redis", "memcache", "cache")
_AUTH_KEYWORDS = ("auth", "oauth", "okta")
_HOSTING_KEYWORDS = ("vercel", "netlify", "aws", "azure", "gcp", "heroku", "railway", "render")


class TechStackOptionNotFoundError(Exception):
    def __init__(self, option_id: str) -> None:
        super().__init__(f"tech stack option {option_id!r} not in the generated matrix")


def _split_stack(stack: list[TechStackComponent]) -> dict[str, TechStackComponent | None]:
    frontend, backend, database, *rest = [*stack, None, None, None]
    split = {"frontend": frontend, "backend": backend, "database": database,
             "cache": None, "auth": None, "hosting": None}
    for component in rest:
        if component is None:
            continue
        name = component.framework.lower()
        if any(k in name for k in _CACHE_KEYWORDS):
            split["cache"] = component
        elif any(k in name for k in _AUTH_KEYWORDS):
            split["auth"] = component
        elif any(k in name for k in _HOSTING_KEYWORDS):
            split["hosting"] = component
    return split


class TechStackService:
    def __init__(self, profiles: TechStackProfileRepository) -> None:
        self._profiles = profiles

    async def generate_options(
        self,
        actors: list[ConfirmedNodeRef],
        scale_persona: str,
        detected_signals: list[str] | None = None,
    ) -> TechStackOptionsMatrix:
        return await tech_stack_agents.generate_tech_stack_options(
            TechStackOptionsRequest(
                actors=actors,
                scale_persona=scale_persona,  # type: ignore[arg-type]
                detected_signals=detected_signals or [],
            )
        )

    def commit_selection(
        self,
        project_id: str,
        matrix: TechStackOptionsMatrix,
        option_id: str,
    ) -> TechStackProfile:
        selected: TechStackOption | None = next(
            (o for o in matrix.options if o.option_id == option_id), None
        )
        if selected is None:
            raise TechStackOptionNotFoundError(option_id)

        split = _split_stack(selected.stack)
        if split["frontend"] is None or split["backend"] is None or split["database"] is None:
            raise ValueError(f"tech stack option {option_id!r} has fewer than 3 components")

        profile = TechStackProfile(
            profile_id=f"STACK-{uuid.uuid4().hex[:8].upper()}",
            frontend=split["frontend"],
            backend=split["backend"],
            database=split["database"],
            cache=split["cache"],
            auth=split["auth"],
            hosting=split["hosting"],
            rationale=selected.rationale,
        )
        self._profiles.save(project_id, profile)
        return profile
