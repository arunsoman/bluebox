"""Scale & Infrastructure Advisor application service - doc/prd.md SS4.3.

Generates a `HostingOptionsMatrix` from `ScaleInputsContext`, then commits a
user-selected option as an `InfrastructureProfile` snapshot.
"""

import uuid

from bluebox.modules.advisory.scaling.domain.infrastructure_profile import InfrastructureProfile
from bluebox.modules.advisory.scaling.llm import agents as scaling_agents
from bluebox.modules.advisory.scaling.llm.requests import HostingOptionsRequest, ScaleInputsContext
from bluebox.modules.advisory.scaling.llm.responses import HostingOptionsMatrix
from bluebox.shared_kernel.ports import InfrastructureProfileRepository


class HostingOptionNotFoundError(Exception):
    def __init__(self, option_id: str) -> None:
        super().__init__(f"hosting option {option_id!r} not in the generated matrix")


class ScalingService:
    def __init__(self, profiles: InfrastructureProfileRepository) -> None:
        self._profiles = profiles

    async def generate_options(
        self, scale_inputs: ScaleInputsContext, scale_persona: str
    ) -> HostingOptionsMatrix:
        return await scaling_agents.generate_hosting_options(
            HostingOptionsRequest(scale_inputs=scale_inputs, scale_persona=scale_persona)  # type: ignore[arg-type]
        )

    def commit_selection(
        self,
        project_id: str,
        matrix: HostingOptionsMatrix,
        option_id: str,
        committed_by: str,
    ) -> InfrastructureProfile:
        selected = next((o for o in matrix.options if o.option_id == option_id), None)
        if selected is None:
            raise HostingOptionNotFoundError(option_id)

        profile = InfrastructureProfile(
            profile_id=f"INFRA-{uuid.uuid4().hex[:8].upper()}",
            selected_option=selected,
            scale_persona=matrix.scale_persona,
            committed_by=committed_by,
        )
        self._profiles.save(project_id, profile)
        return profile
