"""Tests for shared_kernel/domain/rbac.py pure graph algorithms."""

from bluebox.shared_kernel.domain.rbac import (
    RBACPermission,
    RBACRole,
    RolePermissionEntry,
    build_inheritance_graph,
    compute_role_depths,
    detect_inheritance_cycles,
    detect_privilege_escalation,
    validate_inheritance_depth,
)

# Mirrors mock_server.py's RBAC fixture hierarchy: Admin(0) -> Manager(1) -> Employee(2) -> Guest(3).
_CLEAN_ROLES = [
    RBACRole(role_id="ROLE-ADMIN", role_name="Admin", parent_role_id=None, description="Full access"),
    RBACRole(role_id="ROLE-MANAGER", role_name="Manager", parent_role_id="ROLE-ADMIN", description="Manage staff"),
    RBACRole(role_id="ROLE-EMPLOYEE", role_name="Employee", parent_role_id="ROLE-MANAGER", description="Day to day"),
    RBACRole(role_id="ROLE-GUEST", role_name="Guest", parent_role_id="ROLE-EMPLOYEE", description="Read-only"),
]


def test_compute_role_depths_matches_mock_server_fixture() -> None:
    depths = compute_role_depths(_CLEAN_ROLES)
    assert depths == {
        "ROLE-ADMIN": 0,
        "ROLE-MANAGER": 1,
        "ROLE-EMPLOYEE": 2,
        "ROLE-GUEST": 3,
    }


def test_detect_inheritance_cycles_clean_hierarchy_has_none() -> None:
    assert detect_inheritance_cycles(_CLEAN_ROLES) == []


def test_validate_inheritance_depth_default_limit_flags_guest() -> None:
    # Guest is at depth 3, the limit itself - not a violation.
    assert validate_inheritance_depth(_CLEAN_ROLES, max_depth=3) == []
    # Tightening the limit to 2 now flags Guest.
    assert validate_inheritance_depth(_CLEAN_ROLES, max_depth=2) == ["ROLE-GUEST"]


def test_build_inheritance_graph_shape() -> None:
    graph = build_inheritance_graph(_CLEAN_ROLES)
    assert graph.max_depth == 3
    assert graph.cycles == []
    assert {edge.from_role_id for edge in graph.edges} == {"ROLE-ADMIN", "ROLE-MANAGER", "ROLE-EMPLOYEE"}
    assert {node.role_id: node.depth for node in graph.nodes}["ROLE-GUEST"] == 3


def test_detect_inheritance_cycles_finds_a_real_cycle() -> None:
    cyclic_roles = [
        RBACRole(role_id="A", role_name="A", parent_role_id="C", description=""),
        RBACRole(role_id="B", role_name="B", parent_role_id="A", description=""),
        RBACRole(role_id="C", role_name="C", parent_role_id="B", description=""),
    ]
    cycles = detect_inheritance_cycles(cyclic_roles)
    assert len(cycles) == 1
    assert set(cycles[0][:-1]) == {"A", "B", "C"}
    assert cycles[0][0] == cycles[0][-1]


def test_detect_privilege_escalation_flags_only_transitive_grants() -> None:
    permissions = [
        RBACPermission(permission_id="PERM-SALARY", resource="/api/salaries", action="GET", description="Read salaries"),
        RBACPermission(permission_id="PERM-APPTS", resource="/api/appts", action="GET", description="Read appointments"),
    ]
    role_permissions = [
        # Direct grant to the immediate child (Manager, 1 hop from Admin) - not escalation.
        RolePermissionEntry(
            entry_id="RP-1", role_id="ROLE-MANAGER", permission_id="PERM-APPTS",
            granted=True, rationale="manages appts", decision_maker="admin",
        ),
        # Direct grant to Guest (3 hops from Admin, 2 hops from Manager) - transitive for Admin/Manager.
        RolePermissionEntry(
            entry_id="RP-2", role_id="ROLE-GUEST", permission_id="PERM-SALARY",
            granted=True, rationale="test fixture - intentionally suspicious", decision_maker="admin",
        ),
    ]

    escalations = detect_privilege_escalation(_CLEAN_ROLES, role_permissions, permissions)

    # ROLE-MANAGER's direct grant (1 hop) must not appear.
    assert not any(e.resulting_access == "GET /api/appts" for e in escalations)
    # ROLE-GUEST's salary grant is 2 hops from Manager and 3 hops from Admin - both flagged.
    salary_escalations = {(tuple(e.path), e.depth) for e in escalations if e.resulting_access == "GET /api/salaries"}
    assert (("ROLE-MANAGER", "ROLE-EMPLOYEE", "ROLE-GUEST"), 2) in salary_escalations
    assert (("ROLE-ADMIN", "ROLE-MANAGER", "ROLE-EMPLOYEE", "ROLE-GUEST"), 3) in salary_escalations
