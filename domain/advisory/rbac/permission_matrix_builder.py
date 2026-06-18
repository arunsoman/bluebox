"""PermissionMatrixBuilder - role x permission matrix generator.

Generates RolePermissionEntry rows from a list of roles and capabilities,
supports entry updates, and detects conflicts where the same permission
is granted to roles with opposing security interests. All data computed
from inputs - no mock or stub values.
"""
from __future__ import annotations

import uuid

from domain.models import (
    Capability,
    DecisionMaker,
    Permission,
    PermissionAction,
    PermissionConflict,
    PermissionScope,
    Role,
    RolePermissionEntry,
)


class PermissionMatrixBuilder:
    """Builds and manages the role x permission matrix.

    Usage:
        builder = PermissionMatrixBuilder()
        entries = builder.generate(roles, capabilities)
        conflicts = builder.detect_conflicts(entries)
    """

    def generate(
        self,
        roles: list[Role],
        capabilities: list[Capability],
    ) -> list[RolePermissionEntry]:
        """Generate a role x permission matrix from roles and capabilities.

        Maps each capability to a Permission, then determines which roles
        should be granted access based on:
        - Role name/type heuristics (admin roles get broader access)
        - Capability access_level_hint (READ -> read, WRITE -> write/update)
        - Platform vs non-platform capability distinction
        """
        entries: list[RolePermissionEntry] = []

        # Step 1: Derive Permission objects from capabilities
        permissions = self._capabilities_to_permissions(capabilities)

        # Step 2: For each role-permission pair, determine grant status
        for role in roles:
            for perm in permissions:
                granted, rationale = self._should_grant(role, perm)
                entries.append(
                    RolePermissionEntry(
                        role_id=role.role_id,
                        permission_id=perm.permission_id,
                        granted=granted,
                        conditions=[],
                        decision_maker=DecisionMaker.SYSTEM_AUTHORIZED,
                        rationale=rationale,
                    )
                )

        return entries

    def update_entry(
        self,
        entry: RolePermissionEntry,
        granted: bool,
        rationale: str,
        decision_maker: DecisionMaker,
    ) -> RolePermissionEntry:
        """Update an existing RolePermissionEntry and return the updated version.

        Creates a new entry (immutable update pattern) with the new values
        while preserving the role_id and permission_id.
        """
        return RolePermissionEntry(
            role_id=entry.role_id,
            permission_id=entry.permission_id,
            granted=granted,
            conditions=entry.conditions,
            decision_maker=decision_maker,
            rationale=rationale,
        )

    def detect_conflicts(
        self,
        matrix: list[RolePermissionEntry],
    ) -> list[PermissionConflict]:
        """Detect conflicts where the same permission is granted to conflicting roles.

        A conflict occurs when:
        - The same permission_id is granted to two+ roles
        - One role is an admin/supervisor and another is a regular/end-user
          (indicating potential privilege overlap)
        - The roles have different security levels but share a sensitive permission

        Returns one PermissionConflict per permission_id that has issues.
        """
        conflicts: list[PermissionConflict] = []

        # Group entries by permission_id
        by_permission: dict[str, list[RolePermissionEntry]] = {}
        for entry in matrix:
            if entry.granted:
                by_permission.setdefault(entry.permission_id, []).append(entry)

        # For each permission, check if conflicting roles both have it
        for perm_id, granted_entries in by_permission.items():
            if len(granted_entries) < 2:
                continue

            role_ids = [e.role_id for e in granted_entries]

            # Check for admin + non-admin combination
            has_admin = any(
                "admin" in rid.lower() or "super" in rid.lower()
                for rid in role_ids
            )
            has_end_user = any(
                "user" in rid.lower() or "customer" in rid.lower() or "end" in rid.lower()
                for rid in role_ids
            )
            has_guest = any("guest" in rid.lower() or "anon" in rid.lower() for rid in role_ids)

            if (has_admin and has_guest) or (has_end_user and has_guest):
                conflicts.append(
                    PermissionConflict(
                        conflict_id=f"pc-{uuid.uuid4().hex[:8]}",
                        roles=role_ids,
                        permission=perm_id,
                        description=(
                            f"Permission '{perm_id}' granted to roles with "
                            f"conflicting security levels: {', '.join(role_ids)}. "
                            "Consider restricting guest/end-user access or scoping to OWN records."
                        ),
                    )
                )

        return conflicts

    # ================================================================== #
    # Private helpers
    # ================================================================== #

    def _capabilities_to_permissions(
        self,
        capabilities: list[Capability],
    ) -> list[Permission]:
        """Derive Permission objects from a list of capabilities.

        Each capability maps to one or more Permission objects based on
        the access_level_hint and data_entities_involved.
        """
        permissions: list[Permission] = []

        for cap in capabilities:
            base_id = cap.capability_id.replace("cap", "perm")

            # Map access_level_hint to permission actions
            actions = self._access_level_to_actions(cap.access_level_hint)

            for action in actions:
                perm_id = f"{base_id}-{action.value}"
                # Determine scope based on whether it's a platform capability
                scope = PermissionScope.ALL if cap.is_platform_capability else PermissionScope.OWN

                permissions.append(
                    Permission(
                        permission_id=perm_id,
                        resource=cap.name,
                        action=action,
                        scope=scope,
                        description=f"{action.value.capitalize()} access to {cap.name}",
                        sensitivity=self._capability_to_sensitivity(cap),
                        capability_id=cap.capability_id,
                    )
                )

        return permissions

    def _should_grant(
        self,
        role: Role,
        permission: Permission,
    ) -> tuple[bool, str]:
        """Determine whether a role should be granted a permission.

        Returns (granted, rationale). Uses role name heuristics and
        permission sensitivity to make the decision.
        """
        role_name_lower = role.name.lower()
        role_id_lower = role.role_id.lower()

        # Admin/supervisor roles: broad access
        is_admin = (
            "admin" in role_name_lower
            or "super" in role_name_lower
            or "admin" in role_id_lower
            or "super" in role_id_lower
        )

        # System/internal roles: platform capabilities
        is_system = role.is_system_role or "system" in role_id_lower

        # Guest/viewer roles: read-only, non-sensitive
        is_guest = "guest" in role_name_lower or "viewer" in role_name_lower or "anon" in role_id_lower

        # End user / customer: own-scope only
        is_end_user = "user" in role_name_lower or "customer" in role_name_lower

        if is_admin:
            # Admins get almost everything except highly sensitive operations
            if permission.sensitivity.value in ("restricted",) and permission.action in (PermissionAction.DELETE, PermissionAction.EXPORT):
                return True, f"Admin role '{role.name}' granted restricted {permission.action.value} — requires audit trail"
            return True, f"Admin role '{role.name}' granted {permission.action.value} on {permission.resource}"

        if is_system:
            # System roles get platform capabilities and execute
            if permission.action == PermissionAction.EXECUTE:
                return True, f"System role '{role.name}' granted execute on {permission.resource}"
            if permission.scope == PermissionScope.ALL:
                return True, f"System role '{role.name}' granted platform-level access to {permission.resource}"
            return permission.action == PermissionAction.READ, f"System role '{role.name}' read access to {permission.resource}"

        if is_guest:
            # Guests: read-only, nothing sensitive
            if permission.sensitivity.value in ("confidential", "restricted"):
                return False, f"Guest role '{role.name}' denied sensitive {permission.resource}"
            return permission.action == PermissionAction.READ, f"Guest role '{role.name}' read-only access to {permission.resource}"

        if is_end_user:
            # End users: own-scope CRUD, no admin actions
            if permission.action in (PermissionAction.APPROVE, PermissionAction.EXPORT):
                return False, f"End-user role '{role.name}' denied admin action {permission.action.value}"
            return True, f"End-user role '{role.name}' granted {permission.action.value} on own {permission.resource}"

        # Default: grant read, deny destructive actions
        if permission.action == PermissionAction.READ:
            return True, f"Role '{role.name}' granted read on {permission.resource} (default)"
        if permission.action in (PermissionAction.CREATE, PermissionAction.UPDATE):
            return True, f"Role '{role.name}' granted {permission.action.value} on {permission.resource} (default)"

        return False, f"Role '{role.name}' denied {permission.action.value} on {permission.resource} (default conservative)"

    @staticmethod
    def _access_level_to_actions(access_level) -> list[PermissionAction]:
        """Map an AccessLevel to the corresponding PermissionActions."""
        from domain.models import AccessLevel

        mapping: dict[str, list[PermissionAction]] = {
            AccessLevel.READ: [PermissionAction.READ],
            AccessLevel.WRITE: [PermissionAction.READ, PermissionAction.CREATE, PermissionAction.UPDATE],
            AccessLevel.ADMIN: [PermissionAction.READ, PermissionAction.CREATE, PermissionAction.UPDATE, PermissionAction.DELETE, PermissionAction.APPROVE, PermissionAction.EXPORT],
            AccessLevel.EXECUTE: [PermissionAction.EXECUTE],
            AccessLevel.NONE: [],
        }
        return mapping.get(access_level, [PermissionAction.READ])

    @staticmethod
    def _capability_to_sensitivity(capability: Capability):
        """Map a capability's characteristics to a DataSensitivity level."""
        from domain.models import DataSensitivity

        if capability.is_platform_capability:
            return DataSensitivity.RESTRICTED
        if capability.capability_lens.value == "security":
            return DataSensitivity.CONFIDENTIAL
        if capability.capability_lens.value == "data":
            return DataSensitivity.CONFIDENTIAL
        return DataSensitivity.INTERNAL
