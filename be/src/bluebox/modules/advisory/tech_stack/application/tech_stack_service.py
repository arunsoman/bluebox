"""Tech Stack Advisor application service - doc/prd.md SS4.3.

Generates a `TechStackOptionsMatrix` from confirmed actors + scale_persona,
then commits a selected `TechStackOption` as a `TechStackProfile` snapshot.

`TechStackOption.stack` items (`LabeledTechStackComponent`, see
`llm/responses.py` docstring) each carry an explicit `role` field - the
contract only specifies the committed `TechStackProfile`'s named slots, not
the pre-selection options shape, so `_split_stack` below groups by that
label rather than assuming a fixed list order (frontend-first/backend-
second/database-third per the mock_server.py fixture's convention is a
shape a real model has no reason to honor - observed in practice: a
Spring-only option came back ordered Spring Boot/Spring Data JPA/Spring
Security, which positional splitting would mistake for
frontend/backend/database).
"""

import uuid

from bluebox.modules.advisory.tech_stack.domain.tech_stack_profile import TechStackProfile
from bluebox.modules.advisory.tech_stack.llm import agents as tech_stack_agents
from bluebox.modules.advisory.tech_stack.llm.requests import TechStackOptionsRequest
from bluebox.modules.advisory.tech_stack.llm.responses import (
    LabeledTechStackComponent,
    TechStackComponent,
    TechStackOption,
    TechStackOptionsMatrix,
)
from bluebox.modules.core_pipeline.llm.requests import ConfirmedNodeRef
from bluebox.shared_kernel.ports import TechStackProfileRepository


class TechStackOptionNotFoundError(Exception):
    def __init__(self, option_id: str) -> None:
        super().__init__(f"tech stack option {option_id!r} not in the generated matrix")


def _split_stack(stack: list[LabeledTechStackComponent]) -> dict[str, TechStackComponent | None]:
    split: dict[str, TechStackComponent | None] = {
        "frontend": None, "backend": None, "database": None,
        "cache": None, "auth": None, "hosting": None,
    }
    for component in stack:
        split[component.role] = TechStackComponent(
            framework=component.framework, version=component.version,
            language=component.language, justification=component.justification,
        )
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
