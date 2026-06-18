"""PrivilegeEscalationChecker - static escalation analysis for RBAC models.

Performs STATIC_ESCALATION_ANALYSIS using DFS over the inheritance graph
to detect paths where combined inherited permissions grant admin-level
access. Does NOT evaluate dynamic conditions (runtime context, time-based
rules, etc.). All analysis is computed from the model data.
"""
from __future__ import annotations

from collections import defaultdict

from domain.models import (
    EscalationFlag,
    PermissionAction,
    RBACModel,
    RoleInheritance,
)


class PrivilegeEscalationChecker:
    """Checks for privilege escalation paths in an RBAC model.

    Algorithm: STATIC_ESCALATION_ANALYSIS
    - DFS over inheritance graph with depth limit
    - Check if combined inherited permissions grant admin-level access
    - Does NOT evaluate dynamic conditions

    Usage:
        checker = PrivilegeEscalationChecker()
        flags = checker.check(model)
    """

    check_algorithm: str = "STATIC_ESCALATION_ANALYSIS"

    # Admin-level permission actions that indicate escalation
    _ADMIN_ACTIONS: set[str] = {
        PermissionAction.DELETE.value,
        PermissionAction.APPROVE.value,
        PermissionAction.EXPORT.value,
    }

    def check(self, model: RBACModel) -> list[EscalationFlag]:
        """Run static escalation analysis on the RBAC model.

        For each role, performs a DFS through the inheritance chain to
        determine if the combined set of permissions (direct + inherited)
        includes admin-level actions that the role should not have.

        Returns one EscalationFlag per suspicious inheritance path found.
        """
        flags: list[EscalationFlag] = []
        max_depth = model.max_inheritance_depth

        # Build lookup structures
        role_permissions = self._build_role_permissions_map(model)
        inheritance_graph = self._build_inheritance_graph(model.role_hierarchy)

        # For each role, walk its inheritance chain via DFS
        all_role_ids = {r.role_id for r in model.roles}

        for role_id in all_role_ids:
            role_flags = self._check_role_escalation(
                role_id,
                role_permissions,
                inheritance_graph,
                max_depth,
                all_role_ids,
            )
            flags.extend(role_flags)

        return flags

    # ================================================================== #
    # Private helpers
    # ================================================================== #

    def _build_role_permissions_map(
        self,
        model: RBACModel,
    ) -> dict[str, set[str]]:
        """Build a map of role_id -> set of granted permission_ids.

        Only includes permissions where granted=True.
        """
        role_perms: dict[str, set[str]] = defaultdict(set)
        for entry in model.permission_matrix:
            if entry.granted:
                role_perms[entry.role_id].add(entry.permission_id)
        return role_perms

    def _build_inheritance_graph(
        self,
        hierarchy: list[RoleInheritance],
    ) -> dict[str, list[str]]:
        """Build an adjacency list for the inheritance graph.

        Maps child_role_id -> list of parent_role_ids (roles it inherits from).
        This is the direction of inheritance: child can use parent's permissions.
        """
        graph: dict[str, list[str]] = defaultdict(list)
        for inh in hierarchy:
            graph[inh.child_role_id].append(inh.parent_role_id)
        return graph

    def _check_role_escalation(
        self,
        role_id: str,
        role_permissions: dict[str, set[str]],
        inheritance_graph: dict[str, list[str]],
        max_depth: int,
        all_role_ids: set[str],
    ) -> list[EscalationFlag]:
        """Check a single role for privilege escalation through inheritance.

        Performs DFS up the inheritance chain, collecting all inherited
        permissions. Flags if:
        1. The inheritance depth exceeds max_depth
        2. The role inherits admin-level actions (DELETE, APPROVE, EXPORT)
           without having them directly
        3. A low-privilege role inherits from a high-privilege role
        """
        flags: list[EscalationFlag] = []

        # Get the role's direct permissions
        direct_perms = role_permissions.get(role_id, set())

        # DFS to collect all inherited permissions
        inherited_perms: set[str] = set()
        inheritance_path: list[str] = [role_id]
        visited: set[str] = set()

        self._dfs_collect_inherited(
            role_id,
            inheritance_graph,
            role_permissions,
            visited,
            inheritance_path,
            inherited_perms,
            max_depth,
            flags,
        )

        # Check for escalation: role gets admin actions via inheritance
        # that it doesn't have directly
        admin_perms_direct = {p for p in direct_perms if self._is_admin_permission(p)}
        admin_perms_inherited = {p for p in inherited_perms if self._is_admin_permission(p)}
        admin_perms_only_via_inheritance = admin_perms_inherited - admin_perms_direct

        if admin_perms_only_via_inheritance:
            flags.append(
                EscalationFlag(
                    path=inheritance_path,
                    resulting_access=f"Inherited admin actions: {', '.join(sorted(admin_perms_only_via_inheritance))}",
                    algorithm=self.check_algorithm,
                    depth_limit=max_depth,
                )
            )

        return flags

    def _dfs_collect_inherited(
        self,
        current_role: str,
        inheritance_graph: dict[str, list[str]],
        role_permissions: dict[str, set[str]],
        visited: set[str],
        path: list[str],
        inherited_perms: set[str],
        max_depth: int,
        flags: list[EscalationFlag],
    ) -> None:
        """DFS to collect inherited permissions up the inheritance chain.

        Stops at max_depth to prevent runaway. Flags depth limit violations.
        """
        if len(path) > max_depth + 1:  # +1 because path includes the starting role
            # Depth exceeded - already flagged, stop traversing
            return

        if current_role in visited:
            return

        visited.add(current_role)

        # Add this role's permissions to inherited set
        inherited_perms.update(role_permissions.get(current_role, set()))

        # Traverse to parents
        for parent_role in inheritance_graph.get(current_role, []):
            if parent_role in path:
                # Cycle detected - will be caught by RoleHierarchyValidator,
                # but we skip it here to avoid infinite loops
                continue

            path.append(parent_role)
            self._dfs_collect_inherited(
                parent_role,
                inheritance_graph,
                role_permissions,
                visited,
                path,
                inherited_perms,
                max_depth,
                flags,
            )
            path.pop()

    def _is_admin_permission(self, permission_id: str) -> bool:
        """Check if a permission_id represents an admin-level action.

        Looks for DELETE, APPROVE, or EXPORT action suffixes in the permission_id.
        """
        perm_lower = permission_id.lower()
        return any(
            f"-{action}" in perm_lower or perm_lower.endswith(f"-{action}")
            for action in self._ADMIN_ACTIONS
        )
