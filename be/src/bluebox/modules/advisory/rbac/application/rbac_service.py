"""RBAC Advisor application service - doc/prd.md SS4.3 RBACAdvisor.

Generates an `RBACModel` via the LLM, then runs the pure graph algorithms
(`shared_kernel/domain/rbac.py`) before allowing commit: AC-RB-08 blocks
commit on any inheritance cycle; AC-RB-03 only requires escalation paths to
be surfaced (`PRIVILEGE_ESCALATION_FLAGGED`), not blocked - so escalations
are returned alongside the committed model rather than raised.
"""

from bluebox.modules.advisory.rbac.llm import agents as rbac_agents
from bluebox.modules.advisory.rbac.llm.requests import RBACModelGenerationRequest
from bluebox.modules.advisory.rbac.llm import responses as rbac_llm
from bluebox.modules.core_pipeline.llm.requests import ConfirmedNodeRef
from bluebox.shared_kernel.domain.rbac import (
    DataAccessEntry,
    EscalationPath,
    RBACModel,
    RBACPermission,
    RBACRole,
    RolePermissionEntry,
    build_inheritance_graph,
    detect_inheritance_cycles,
    detect_privilege_escalation,
)
from bluebox.shared_kernel.ports import RBACModelRepository


class RBACInheritanceCycleError(Exception):
    """doc/prd.md AC-RB-08: commit blocked, RBAC_INHERITANCE_CYCLE_DETECTED."""

    def __init__(self, cycles: list[list[str]]) -> None:
        super().__init__(f"RBAC model has inheritance cycles: {cycles}")
        self.cycles = cycles


def _to_domain_roles(roles: list[rbac_llm.RBACRole]) -> list[RBACRole]:
    return [RBACRole(**role.model_dump()) for role in roles]


def _to_domain_model(generated: rbac_llm.RBACModel) -> RBACModel:
    """Anti-corruption-layer conversion: rebuilds the domain `RBACModel`
    field-by-field from the LLM contract shape rather than importing it
    directly (same principle as the Node entity hierarchy, pass 3)."""

    roles = _to_domain_roles(generated.roles)
    permissions = [RBACPermission(**p.model_dump()) for p in generated.permissions]
    role_permissions = [RolePermissionEntry(**rp.model_dump()) for rp in generated.role_permissions]
    data_access_matrix = [DataAccessEntry(**d.model_dump()) for d in generated.data_access_matrix]

    return RBACModel(
        version=generated.version,
        roles=roles,
        permissions=permissions,
        role_permissions=role_permissions,
        inheritance_graph=build_inheritance_graph(roles),
        data_access_matrix=data_access_matrix,
    )


class RBACService:
    def __init__(self, models: RBACModelRepository) -> None:
        self._models = models

    async def generate_model(
        self,
        actors: list[ConfirmedNodeRef],
        capabilities: list[ConfirmedNodeRef],
        use_cases: list[ConfirmedNodeRef],
    ) -> RBACModel:
        generated = await rbac_agents.generate_rbac_model(
            RBACModelGenerationRequest(actors=actors, capabilities=capabilities, use_cases=use_cases)
        )
        return _to_domain_model(generated)

    def commit_model(self, project_id: str, model: RBACModel) -> tuple[RBACModel, list[EscalationPath]]:
        cycles = detect_inheritance_cycles(model.roles)
        if cycles:
            raise RBACInheritanceCycleError(cycles)

        escalations = detect_privilege_escalation(model.roles, model.role_permissions, model.permissions)
        self._models.save(project_id, model)
        return model, escalations
