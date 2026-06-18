"""RBACAdvisor - main orchestrator for RBAC design.

Coordinates role generation, permission matrix creation, data access
mapping, hierarchy building, and model finalization. Uses sub-builders
for specialized tasks. All data computed from inputs - no mock or stub
values.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from domain.models import (
    Actor,
    ActorClass,
    AuditPolicy,
    CapabilitySet,
    DataAccessEntry,
    DataSensitivity,
    DecisionMaker,
    Permission,
    RBACModel,
    Role,
    RoleInheritance,
    RolePermissionEntry,
    UseCaseSet,
    ActorDiscoveryResult,
)
from domain.advisory.rbac.permission_matrix_builder import PermissionMatrixBuilder
from domain.advisory.rbac.data_access_matrix_builder import DataAccessMatrixBuilder
from domain.advisory.rbac.role_hierarchy_validator import RoleHierarchyValidator
from domain.advisory.rbac.privilege_escalation_checker import PrivilegeEscalationChecker
from infrastructure.messaging.sse_manager import sse_manager


class RBACAdvisor:
    """Main orchestrator for Role-Based Access Control design.

    Coordinates multiple sub-components:
        - PermissionMatrixBuilder for role x permission mapping
        - DataAccessMatrixBuilder for role x data entity mapping
        - RoleHierarchyValidator for cycle detection and depth validation
        - PrivilegeEscalationChecker for static escalation analysis

    Lifecycle:
        1. generate_role_list(actors)        -> list[Role]
        2. generate_permission_matrix(caps)  -> list[RolePermissionEntry]
        3. generate_data_access_matrix(ucs)  -> list[DataAccessEntry]
        4. build_hierarchy(roles)            -> list[RoleInheritance]
        5. finalize_model(session, project)  -> RBACModel (emits RBAC_MODEL_READY)
    """

    def __init__(self) -> None:
        self._perm_builder = PermissionMatrixBuilder()
        self._data_builder = DataAccessMatrixBuilder()
        self._hierarchy_validator = RoleHierarchyValidator()
        self._escalation_checker = PrivilegeEscalationChecker()

    # ------------------------------------------------------------------ #
    # 1. Generate role list from actors
    # ------------------------------------------------------------------ #

    def generate_role_list(
        self,
        actors: ActorDiscoveryResult,
    ) -> list[Role]:
        """Map discovered actors to RBAC roles.

        Creates a role per actor type, with specialized handling for:
        - Human actors -> end-user roles
        - System actors -> system/service roles
        - External actors -> integration/guest roles
        - Platform actors -> admin/supervisor roles

        Also generates an 'admin' role if none exists naturally.
        """
        roles: list[Role] = []
        used_names: set[str] = set()

        # Process all actor classes
        for actor_class, actor_list in actors.actors.items():
            for actor in actor_list:
                role = self._actor_to_role(actor, actor_class)
                if role.name not in used_names:
                    roles.append(role)
                    used_names.add(role.name)

        # Process platform actors
        for actor in actors.platform_actors:
            role = self._actor_to_role(actor, ActorClass.SYSTEM)
            role.is_system_role = True
            if role.name not in used_names:
                roles.append(role)
                used_names.add(role.name)

        # Ensure there's always at least an admin role
        if not any("admin" in r.name.lower() for r in roles):
            admin_role = Role(
                role_id=f"role-admin-{uuid.uuid4().hex[:6]}",
                name="Administrator",
                description="Full access administrator role with all permissions",
                is_system_role=False,
            )
            roles.append(admin_role)

        # Ensure there's always at least a guest/anonymous role
        if not any("guest" in r.name.lower() or "anonymous" in r.name.lower() for r in roles):
            guest_role = Role(
                role_id=f"role-guest-{uuid.uuid4().hex[:6]}",
                name="Guest",
                description="Unauthenticated or minimally privileged read-only access",
                is_system_role=False,
            )
            roles.append(guest_role)

        return roles

    # ------------------------------------------------------------------ #
    # 2. Generate permission matrix
    # ------------------------------------------------------------------ #

    def generate_permission_matrix(
        self,
        capabilities: CapabilitySet,
    ) -> list[RolePermissionEntry]:
        """Generate a role x permission matrix from capabilities.

        Requires roles to be already established. Since the PermissionMatrixBuilder
        needs a role list, this method generates roles from capabilities context
        and then builds the matrix.

        Note: In practice, this should be called after generate_role_list so that
        the roles exist. The builder derives permissions from capabilities and
        maps them to the provided roles.
        """
        # Derive a minimal role set from capabilities if none provided externally
        # This is a fallback - caller should normally provide roles
        derived_roles = self._derive_roles_from_capabilities(capabilities)
        all_caps = capabilities.capabilities + capabilities.platform_capabilities
        return self._perm_builder.generate(derived_roles, all_caps)

    # ------------------------------------------------------------------ #
    # 3. Generate data access matrix
    # ------------------------------------------------------------------ #

    def generate_data_access_matrix(
        self,
        use_cases: UseCaseSet,
    ) -> list[DataAccessEntry]:
        """Generate a role x data entity access matrix from use cases.

        Maps data entities from use cases to roles based on actor involvement.
        """
        derived_roles = self._derive_roles_from_use_cases(use_cases)
        return self._data_builder.generate(derived_roles, use_cases.use_cases)

    # ------------------------------------------------------------------ #
    # 4. Build hierarchy
    # ------------------------------------------------------------------ #

    def build_hierarchy(
        self,
        roles: list[Role],
    ) -> list[RoleInheritance]:
        """Build a role inheritance hierarchy from the role list.

        Creates parent-child relationships based on role naming heuristics:
        - Admin inherits from nothing (root)
        - Moderator inherits from Admin
        - Standard user roles inherit from base roles
        - Guest inherits from nothing (isolated)
        - System roles inherit from Admin for platform operations
        """
        hierarchy: list[RoleInheritance] = []

        # Find key roles by name heuristic
        admin_role = self._find_role_by_keyword(roles, ["admin"])
        moderator_role = self._find_role_by_keyword(roles, ["moderator", "mod"])
        user_role = self._find_role_by_keyword(roles, ["user", "customer", "member"])
        guest_role = self._find_role_by_keyword(roles, ["guest", "anonymous", "anon"])
        system_role = self._find_role_by_keyword(roles, ["system", "service"])

        # Admin -> Moderator
        if admin_role and moderator_role:
            hierarchy.append(
                RoleInheritance(
                    parent_role_id=admin_role.role_id,
                    child_role_id=moderator_role.role_id,
                    inherited_permissions=[],
                    rationale="Moderator inherits administrative oversight capabilities",
                )
            )

        # Moderator -> User (or Admin -> User if no Moderator)
        parent_for_user = moderator_role or admin_role
        if parent_for_user and user_role:
            hierarchy.append(
                RoleInheritance(
                    parent_role_id=parent_for_user.role_id,
                    child_role_id=user_role.role_id,
                    inherited_permissions=[],
                    rationale=f"Standard user inherits from {parent_for_user.name} base permissions",
                )
            )

        # System -> Admin (system roles need admin-level platform access)
        if system_role and admin_role:
            hierarchy.append(
                RoleInheritance(
                    parent_role_id=admin_role.role_id,
                    child_role_id=system_role.role_id,
                    inherited_permissions=[],
                    rationale="System roles require admin-level access for platform operations",
                )
            )

        # Guest is isolated - no inheritance (principle of least privilege)
        # No explicit hierarchy entry for guest

        # Build any additional relationships from actor hierarchy hints
        for role in roles:
            if role.inheritance_depth > 0 and not any(
                inh.child_role_id == role.role_id for inh in hierarchy
            ):
                # Role claims inheritance depth but no parent assigned
                # Link to admin as safe default
                if admin_role and role.role_id != admin_role.role_id:
                    hierarchy.append(
                        RoleInheritance(
                            parent_role_id=admin_role.role_id,
                            child_role_id=role.role_id,
                            inherited_permissions=[],
                            rationale="Default inheritance to admin for unspecified hierarchy",
                        )
                    )

        return hierarchy

    # ------------------------------------------------------------------ #
    # 5. Finalize model
    # ------------------------------------------------------------------ #

    async def finalize_model(
        self,
        session_id: str,
        project_id: str,
        roles: list[Role] | None = None,
        capabilities: CapabilitySet | None = None,
        use_cases: UseCaseSet | None = None,
        permission_matrix: list[RolePermissionEntry] | None = None,
        data_access_matrix: list[DataAccessEntry] | None = None,
        role_hierarchy: list[RoleInheritance] | None = None,
    ) -> RBACModel:
        """Finalize and emit the complete RBAC model.

        Orchestrates all sub-components to produce a complete RBACModel.
        Any pre-computed matrices can be passed in; missing ones are generated.

        Emits RBAC_MODEL_READY via SSE.
        """
        # Generate roles from capabilities if not provided
        if roles is None and capabilities is not None:
            # Build a minimal ActorDiscoveryResult from capabilities
            actors = self._build_actors_from_capabilities(capabilities)
            from domain.models import ActorDiscoveryResult
            adr = ActorDiscoveryResult(
                actors={ActorClass.HUMAN: actors},
                rbac_candidates=[],
            )
            roles = self.generate_role_list(adr)
        elif roles is None:
            roles = []

        # Generate permission matrix if not provided
        if permission_matrix is None and capabilities is not None:
            permission_matrix = self.generate_permission_matrix(capabilities)
        elif permission_matrix is None:
            permission_matrix = []

        # Generate data access matrix if not provided
        if data_access_matrix is None and use_cases is not None:
            data_access_matrix = self.generate_data_access_matrix(use_cases)
        elif data_access_matrix is None:
            data_access_matrix = []

        # Generate role hierarchy if not provided
        if role_hierarchy is None:
            role_hierarchy = self.build_hierarchy(roles)

        # Validate hierarchy
        ok, hierarchy_errors = self._hierarchy_validator.validate(
            role_hierarchy, max_depth=3
        )

        # Build the RBAC model
        audit_policy = self._get_audit_policy()

        # Derive permissions from the matrix
        permissions = self._derive_permissions_from_matrix(permission_matrix)

        model = RBACModel(
            model_id=f"rbac-{project_id}-{uuid.uuid4().hex[:8]}",
            project_id=project_id,
            roles=roles,
            permissions=permissions,
            permission_matrix=permission_matrix,
            data_access_matrix=data_access_matrix,
            role_hierarchy=role_hierarchy,
            audit_policy=audit_policy,
            version=1,
            escalation_check_algorithm=self._escalation_checker.check_algorithm,
        )

        # Run escalation check
        escalation_flags = self._escalation_checker.check(model)

        # Emit the model
        await sse_manager.emit_rbac_model(
            session_id,
            {
                "model_id": model.model_id,
                "project_id": project_id,
                "role_count": len(roles),
                "permission_count": len(permissions),
                "hierarchy_valid": ok,
                "hierarchy_errors": hierarchy_errors,
                "escalation_flags": [f.model_dump() for f in escalation_flags],
                "escalation_flag_count": len(escalation_flags),
                "audit_policy": model.audit_policy.model_dump(),
                "timestamp": datetime.utcnow().isoformat(),
            },
        )

        return model

    # ------------------------------------------------------------------ #
    # Audit policy
    # ------------------------------------------------------------------ #

    def _get_audit_policy(self) -> AuditPolicy:
        """Generate a default audit policy based on compliance best practices.

        These defaults follow the principle that writes should always be audited,
        and sensitive reads require tracking.
        """
        return AuditPolicy(
            audit_all_writes=True,
            audit_reads_for_sensitivity=["confidential", "restricted"],
            retention_days=90,
            alert_on_privilege_escalation=True,
            alert_on_bulk_export=True,
            audit_log_immutable=True,
            max_inheritance_depth=3,
            storage_budget_mb=500,
        )

    # ================================================================== #
    # Private helpers
    # ================================================================== #

    def _actor_to_role(self, actor: Actor, actor_class: ActorClass) -> Role:
        """Convert an Actor to a Role."""
        role_name = actor.name
        if actor_class == ActorClass.SYSTEM:
            role_name = f"{actor.name} (System)"
        elif actor_class == ActorClass.SERVICE:
            role_name = f"{actor.name} (Service)"
        elif actor_class == ActorClass.EXTERNAL:
            role_name = f"{actor.name} (External)"

        return Role(
            role_id=f"role-{actor.actor_id}",
            name=role_name,
            description=actor.description or f"Role derived from actor: {actor.name}",
            actor_ids=[actor.actor_id],
            is_system_role=actor_class in (ActorClass.SYSTEM, ActorClass.SERVICE),
            traceability=actor.traceability,
        )

    def _find_role_by_keyword(
        self,
        roles: list[Role],
        keywords: list[str],
    ) -> Role | None:
        """Find the first role whose name contains any of the keywords."""
        for role in roles:
            name_lower = role.name.lower()
            if any(kw in name_lower for kw in keywords):
                return role
        return None

    def _derive_roles_from_capabilities(
        self,
        capabilities: CapabilitySet,
    ) -> list[Role]:
        """Derive a minimal role set from capability lenses."""
        roles: list[Role] = []
        all_caps = capabilities.capabilities + capabilities.platform_capabilities

        # Group capabilities by lens to infer role types
        lens_to_roles: dict[str, list[str]] = {
            "functional": ["End User"],
            "data": ["Data Analyst"],
            "integration": ["Integration Service"],
            "security": ["Security Admin"],
            "operational": ["Operations"],
            "platform": ["Platform Admin"],
            "growth": ["Growth Manager"],
        }

        seen_roles: set[str] = set()
        for cap in all_caps:
            role_names = lens_to_roles.get(cap.capability_lens.value, ["User"])
            for name in role_names:
                if name not in seen_roles:
                    roles.append(
                        Role(
                            role_id=f"role-{name.lower().replace(' ', '-')}-{uuid.uuid4().hex[:4]}",
                            name=name,
                            description=f"Role for {cap.capability_lens.value} capabilities",
                        )
                    )
                    seen_roles.add(name)

        # Always add admin
        if "Administrator" not in seen_roles:
            roles.append(
                Role(
                    role_id=f"role-admin-{uuid.uuid4().hex[:4]}",
                    name="Administrator",
                    description="Full system access",
                )
            )

        return roles

    def _derive_roles_from_use_cases(
        self,
        use_cases: UseCaseSet,
    ) -> list[Role]:
        """Derive a minimal role set from use case primary actors."""
        actor_names: set[str] = set()
        for uc in use_cases.use_cases:
            actor_names.add(uc.primary_actor)
            actor_names.update(uc.secondary_actors)

        roles: list[Role] = []
        for name in sorted(actor_names):
            role_id = f"role-{name.lower().replace(' ', '-')}"
            roles.append(
                Role(
                    role_id=role_id,
                    name=name,
                    description=f"Role derived from use case actor: {name}",
                )
            )

        # Always add admin
        if not any(r.name.lower() == "administrator" for r in roles):
            roles.append(
                Role(
                    role_id=f"role-admin-{uuid.uuid4().hex[:4]}",
                    name="Administrator",
                    description="Full system access",
                )
            )

        return roles

    def _build_actors_from_capabilities(
        self,
        capabilities: CapabilitySet,
    ) -> list[Actor]:
        """Build a minimal Actor list from capabilities for role generation."""
        actors: list[Actor] = []
        all_caps = capabilities.capabilities + capabilities.platform_capabilities

        for cap in all_caps:
            actor_id = f"actor-{cap.capability_id}"
            actors.append(
                Actor(
                    actor_id=actor_id,
                    name=f"{cap.name} Actor",
                    type="human",
                    description=cap.description,
                )
            )

        return actors

    def _derive_permissions_from_matrix(
        self,
        matrix: list[RolePermissionEntry],
    ) -> list[Permission]:
        """Derive unique Permission objects from the permission matrix entries."""
        seen: set[str] = set()
        permissions: list[Permission] = []

        for entry in matrix:
            if entry.permission_id not in seen:
                seen.add(entry.permission_id)
                # Parse permission_id to infer action
                action = self._parse_permission_action(entry.permission_id)
                permissions.append(
                    Permission(
                        permission_id=entry.permission_id,
                        resource="",  # Will be filled by caller if needed
                        action=action,
                        scope=entry.conditions[0] if entry.conditions else "own",
                    )
                )

        return permissions

    @staticmethod
    def _parse_permission_action(permission_id: str):
        """Parse a permission_id suffix to determine the PermissionAction."""
        from domain.models import PermissionAction

        suffix_map = {
            "create": PermissionAction.CREATE,
            "read": PermissionAction.READ,
            "update": PermissionAction.UPDATE,
            "delete": PermissionAction.DELETE,
            "execute": PermissionAction.EXECUTE,
            "approve": PermissionAction.APPROVE,
            "export": PermissionAction.EXPORT,
        }

        perm_lower = permission_id.lower()
        for suffix, action in suffix_map.items():
            if perm_lower.endswith(f"-{suffix}"):
                return action

        return PermissionAction.READ
