"""Tests for the scaling/tech_stack/rbac advisory application services."""

import pytest
from pydantic_ai.models.test import TestModel

from bluebox.modules.advisory.rbac.application.rbac_service import (
    RBACInheritanceCycleError,
    RBACService,
)
from bluebox.modules.advisory.rbac.llm import agents as rbac_agents
from bluebox.modules.advisory.scaling.application.scaling_service import (
    HostingOptionNotFoundError,
    ScalingService,
)
from bluebox.modules.advisory.scaling.llm import agents as scaling_agents
from bluebox.modules.advisory.scaling.llm.requests import ScaleInputsContext
from bluebox.modules.advisory.tech_stack.application.tech_stack_service import (
    TechStackOptionNotFoundError,
    TechStackService,
)
from bluebox.modules.advisory.tech_stack.llm import agents as tech_stack_agents
from bluebox.modules.advisory.tech_stack.llm.responses import (
    TechStackComponent,
    TechStackOption,
    TechStackOptionsMatrix,
)
from bluebox.modules.core_pipeline.llm.requests import ConfirmedNodeRef
from bluebox.shared_kernel.domain.rbac import RBACRole
from bluebox.shared_kernel.infrastructure.in_memory import (
    InMemoryInfrastructureProfileRepository,
    InMemoryRBACModelRepository,
    InMemoryTechStackProfileRepository,
)

_PROJECT = "proj-test"
_ACTORS = [ConfirmedNodeRef(node_id="ACT-1", name="Dentist", description="A dental practitioner")]


async def test_scaling_service_generate_and_commit() -> None:
    profiles = InMemoryInfrastructureProfileRepository()
    service = ScalingService(profiles)

    with scaling_agents.hosting_options_agent.override(model=TestModel()):
        matrix = await service.generate_options(
            ScaleInputsContext(
                expected_total_users=1000, peak_concurrent_users=100, launch_timeline="1-3 months"
            ),
            scale_persona="SMALL",
        )
    assert 3 <= len(matrix.options) <= 6

    selected_id = matrix.options[0].option_id
    profile = service.commit_selection(_PROJECT, matrix, selected_id, committed_by="user-1")
    assert profiles.get(_PROJECT) is profile
    assert profile.selected_option.option_id == selected_id

    with pytest.raises(HostingOptionNotFoundError):
        service.commit_selection(_PROJECT, matrix, "does-not-exist", committed_by="user-1")


async def test_tech_stack_service_generate_options_via_llm() -> None:
    """TestModel produces a schema-valid but minimal `stack` (often a single
    component), so this only exercises agent wiring - `_split_stack` against
    a realistic 5-component stack is covered by the test below."""

    profiles = InMemoryTechStackProfileRepository()
    service = TechStackService(profiles)

    with tech_stack_agents.tech_stack_options_agent.override(model=TestModel()):
        matrix = await service.generate_options(_ACTORS, scale_persona="SMALL")
    assert 3 <= len(matrix.options) <= 5


def _component(framework: str) -> TechStackComponent:
    return TechStackComponent(framework=framework, language="TypeScript", justification="because")


def test_tech_stack_service_commit_splits_stack_by_position_and_keyword() -> None:
    profiles = InMemoryTechStackProfileRepository()
    service = TechStackService(profiles)

    matrix = TechStackOptionsMatrix(
        options=[
            TechStackOption(
                option_id="opt-1",
                option_name="Next.js full stack",
                stack=[
                    _component("Next.js"),
                    _component("API Routes"),
                    _component("Prisma"),
                    _component("Redis"),
                    _component("NextAuth"),
                    _component("Vercel"),
                ],
                rationale="Single framework, fast to ship",
                pros=["fast"],
                cons=["lock-in"],
            ),
            TechStackOption(
                option_id="opt-2",
                option_name="Minimal stack",
                stack=[_component("React"), _component("FastAPI"), _component("PostgreSQL")],
                rationale="Decoupled",
                pros=["flexible"],
                cons=["more glue code"],
            ),
            TechStackOption(
                option_id="opt-3",
                option_name="Django monolith",
                stack=[_component("Django"), _component("Django"), _component("PostgreSQL")],
                rationale="Batteries included",
                pros=["fast to build"],
                cons=["less flexible"],
            ),
        ],
        generation_time_ms=10,
    )

    profile = service.commit_selection(_PROJECT, matrix, "opt-1")
    assert profiles.get(_PROJECT) is profile
    assert profile.frontend.framework == "Next.js"
    assert profile.backend.framework == "API Routes"
    assert profile.database.framework == "Prisma"
    assert profile.cache.framework == "Redis"
    assert profile.auth.framework == "NextAuth"
    assert profile.hosting.framework == "Vercel"

    minimal_profile = service.commit_selection(_PROJECT, matrix, "opt-2")
    assert minimal_profile.cache is None
    assert minimal_profile.auth is None
    assert minimal_profile.hosting is None

    with pytest.raises(TechStackOptionNotFoundError):
        service.commit_selection(_PROJECT, matrix, "does-not-exist")


async def test_rbac_service_generate_and_commit() -> None:
    models = InMemoryRBACModelRepository()
    service = RBACService(models)

    with rbac_agents.rbac_model_generation_agent.override(model=TestModel()):
        model = await service.generate_model(_ACTORS, _ACTORS, _ACTORS)

    committed, escalations = service.commit_model(_PROJECT, model)
    assert models.get(_PROJECT) is committed
    assert isinstance(escalations, list)


def test_rbac_service_blocks_commit_on_cycle() -> None:
    models = InMemoryRBACModelRepository()
    service = RBACService(models)

    from bluebox.shared_kernel.domain.rbac import InheritanceGraph, RBACModel

    cyclic_roles = [
        RBACRole(role_id="A", role_name="A", parent_role_id="B", description="d"),
        RBACRole(role_id="B", role_name="B", parent_role_id="A", description="d"),
    ]
    model = RBACModel(
        roles=cyclic_roles,
        permissions=[],
        role_permissions=[],
        inheritance_graph=InheritanceGraph(nodes=[], edges=[], max_depth=0),
        data_access_matrix=[],
    )

    with pytest.raises(RBACInheritanceCycleError):
        service.commit_model(_PROJECT, model)
