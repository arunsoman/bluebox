"""RoleHierarchyValidator - DFS cycle detection and depth validation.

Validates role inheritance hierarchies using depth-first search for
cycle detection and tracks inheritance depth per role. All data
computed from inputs - no mock or stub values.
"""
from __future__ import annotations

from collections import defaultdict

from domain.models import InheritanceCycle, RoleInheritance


class RoleHierarchyValidator:
    """Validates role inheritance hierarchies.

    Checks:
        1. No cycles in the inheritance graph (DFS-based)
        2. No role exceeds max_inheritance_depth (default 3)

    Usage:
        validator = RoleHierarchyValidator()
        ok, errors = validator.validate(hierarchy, max_depth=3)
    """

    def detect_cycles(
        self,
        hierarchy: list[RoleInheritance],
    ) -> list[InheritanceCycle]:
        """Detect cycles in the role inheritance graph using DFS.

        Each RoleInheritance is a directed edge: parent_role_id -> child_role_id.
        A cycle exists if following parent links leads back to a visited role.

        Returns a list of InheritanceCycle objects, one per cycle found.
        """
        # Build adjacency: child -> list of parents (inheritance direction)
        # Actually RoleInheritance means child inherits from parent,
        # so the edge is child_role_id -> parent_role_id (child "points to" parent)
        children_to_parents: dict[str, list[str]] = defaultdict(list)
        all_roles: set[str] = set()

        for inh in hierarchy:
            children_to_parents[inh.child_role_id].append(inh.parent_role_id)
            all_roles.add(inh.child_role_id)
            all_roles.add(inh.parent_role_id)

        cycles: list[InheritanceCycle] = []
        visited_global: set[str] = set()

        for role in all_roles:
            if role in visited_global:
                continue

            # DFS from this role following parent pointers
            # We track the current path to detect back-edges
            path: list[str] = []
            path_set: set[str] = set()
            visited_stack: set[str] = set()

            self._dfs_detect_cycles(
                role,
                children_to_parents,
                path,
                path_set,
                visited_stack,
                visited_global,
                cycles,
            )

        return cycles

    def validate_depth(
        self,
        hierarchy: list[RoleInheritance],
        max_depth: int = 3,
    ) -> list[str]:
        """Find all roles whose inheritance depth exceeds max_depth.

        Inheritance depth is the number of parent links from a role to the root.
        A role with no parents has depth 0.
        A role with one parent (which has no parents) has depth 1.

        Returns a list of error message strings for roles exceeding depth.
        """
        # Build adjacency: child -> list of parents
        children_to_parents: dict[str, list[str]] = defaultdict(list)
        all_roles: set[str] = set()

        for inh in hierarchy:
            children_to_parents[inh.child_role_id].append(inh.parent_role_id)
            all_roles.add(inh.child_role_id)
            all_roles.add(inh.parent_role_id)

        # Compute depth for each role using memoized DFS
        depth_cache: dict[str, int] = {}
        errors: list[str] = []

        for role in all_roles:
            depth = self._compute_depth(role, children_to_parents, depth_cache, set())
            if depth > max_depth:
                errors.append(
                    f"Role '{role}' has inheritance depth {depth}, "
                    f"exceeds maximum allowed depth of {max_depth}. "
                    f"Consider flattening the hierarchy or redesigning role relationships."
                )

        return errors

    def validate(
        self,
        hierarchy: list[RoleInheritance],
        max_depth: int = 3,
    ) -> tuple[bool, list[str]]:
        """Full validation: cycles + depth.

        Returns (ok, errors) where ok is True if no cycles and no depth violations.
        """
        errors: list[str] = []

        # Check cycles
        cycles = self.detect_cycles(hierarchy)
        for cycle in cycles:
            cycle_str = " -> ".join(cycle.cycle_path)
            errors.append(f"Inheritance cycle detected: {cycle_str}. Cycles must be broken before the RBAC model can be finalized.")

        # Check depth
        depth_errors = self.validate_depth(hierarchy, max_depth)
        errors.extend(depth_errors)

        return len(errors) == 0, errors

    # ================================================================== #
    # Private helpers
    # ================================================================== #

    def _dfs_detect_cycles(
        self,
        node: str,
        children_to_parents: dict[str, list[str]],
        path: list[str],
        path_set: set[str],
        visited_stack: set[str],
        visited_global: set[str],
        cycles: list[InheritanceCycle],
    ) -> None:
        """DFS to detect cycles following parent pointers.

        When we encounter a node already in the current path, we've found a cycle.
        """
        if node in path_set:
            # Found a cycle - extract it from the path
            cycle_start = path.index(node)
            cycle_path = path[cycle_start:] + [node]
            cycles.append(InheritanceCycle(cycle_path=cycle_path))
            return

        if node in visited_stack:
            # Already fully processed this node in another branch
            return

        path.append(node)
        path_set.add(node)

        # Visit all parents of this node
        for parent in children_to_parents.get(node, []):
            self._dfs_detect_cycles(
                parent,
                children_to_parents,
                path,
                path_set,
                visited_stack,
                visited_global,
                cycles,
            )

        path.pop()
        path_set.remove(node)
        visited_stack.add(node)
        visited_global.add(node)

    def _compute_depth(
        self,
        role: str,
        children_to_parents: dict[str, list[str]],
        cache: dict[str, int],
        visiting: set[str],
    ) -> int:
        """Compute inheritance depth for a role using memoized DFS.

        Depth = max depth among all parent chains + 1.
        A role with no parents has depth 0.
        Uses cycle-safe detection (returns 0 if cycle encountered).
        """
        if role in cache:
            return cache[role]

        if role in visiting:
            # Cycle detected - break to avoid infinite recursion
            return 0

        parents = children_to_parents.get(role, [])
        if not parents:
            cache[role] = 0
            return 0

        visiting.add(role)

        max_parent_depth = 0
        for parent in parents:
            parent_depth = self._compute_depth(parent, children_to_parents, cache, visiting)
            max_parent_depth = max(max_parent_depth, parent_depth)

        visiting.discard(role)

        depth = max_parent_depth + 1
        cache[role] = depth
        return depth
