"""RBAC domain model + pure graph algorithms - doc/api_event_contract.md
SS6.1, doc/prd.md SS4.3 RBACAdvisor.

Redeclared here rather than imported from
`modules/advisory/rbac/llm/responses.py` - same anti-corruption-layer
reasoning as the Node entity hierarchy (pass 3): domain must not depend on
the LLM contract boundary.

**Inheritance direction convention (PRD does not state this precisely, so
it is fixed here and documented):** mock_server.py's RBAC fixture has
`depth 0 = Admin ("Full system access")` down to `depth 3 = Guest ("Limited
read-only access")`, with `parent_role_id` pointing from a junior role to
its senior. The only convention consistent with that fixture is NIST-style
*senior-inherits-from-junior*: a role's effective access is its own direct
grants plus every grant made to any of its descendants (children,
grandchildren, ...). Under this convention a direct parent<-child grant is
expected and reviewed at assignment time; `detect_privilege_escalation`
below flags only *transitive* (2+ hop) grants, since those are the
"discovered post-implementation" risk doc/prd.md US-SE-02 calls out.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict

from bluebox.shared_kernel.domain.graph_utils import find_cycles_in_parent_chains


class RBACRole(BaseModel):
    """doc/api_event_contract.md SS6.1 `RBACRole`."""

    model_config = ConfigDict(extra="forbid")

    role_id: str
    role_name: str
    parent_role_id: str | None = None
    description: str


class RBACPermission(BaseModel):
    """doc/api_event_contract.md SS6.1 `RBACPermission`."""

    model_config = ConfigDict(extra="forbid")

    permission_id: str
    resource: str
    action: Literal["GET", "POST", "PUT", "DELETE", "PATCH"]
    description: str


class RolePermissionEntry(BaseModel):
    """doc/api_event_contract.md SS6.1 `RolePermissionEntry`."""

    model_config = ConfigDict(extra="forbid")

    entry_id: str
    role_id: str
    permission_id: str
    granted: bool
    rationale: str
    decision_maker: str
    conditions: list[str] = []


class InheritanceGraphNode(BaseModel):
    """doc/api_event_contract.md SS6.1 `InheritanceGraph.nodes[]`."""

    model_config = ConfigDict(extra="forbid")

    role_id: str
    depth: int


class InheritanceGraphEdge(BaseModel):
    """doc/api_event_contract.md SS6.1 `InheritanceGraph.edges[]`. Contract
    field names are `from`/`to`; renamed here because `from` is a Python
    reserved keyword (same choice as the pass 2 LLM response model)."""

    model_config = ConfigDict(extra="forbid")

    from_role_id: str
    to_role_id: str


class InheritanceGraph(BaseModel):
    """doc/api_event_contract.md SS6.1 `InheritanceGraph`. This is a
    *derived* snapshot - built by `build_inheritance_graph` from the
    `RBACRole.parent_role_id` ground truth, not edited directly."""

    model_config = ConfigDict(extra="forbid")

    nodes: list[InheritanceGraphNode]
    edges: list[InheritanceGraphEdge]
    max_depth: int
    cycles: list[list[str]] = []


class DataAccessEntry(BaseModel):
    """doc/api_event_contract.md SS6.1 `DataAccessEntry`."""

    model_config = ConfigDict(extra="forbid")

    role_id: str
    entity: str
    access_level: Literal["None", "Own", "Department", "All"]
    rationale: str
    guard: str | None = None


class RBACModel(BaseModel):
    """doc/api_event_contract.md SS6.1 `RBACModel`."""

    model_config = ConfigDict(extra="forbid")

    version: int = 1
    roles: list[RBACRole]
    permissions: list[RBACPermission]
    role_permissions: list[RolePermissionEntry]
    inheritance_graph: InheritanceGraph
    data_access_matrix: list[DataAccessEntry] = []


class EscalationPath(BaseModel):
    """doc/api_event_contract.md SS6.1 `EscalationPath`."""

    model_config = ConfigDict(extra="forbid")

    path: list[str]
    resulting_access: str
    depth: int
    algorithm: Literal["STATIC_ESCALATION_ANALYSIS"] = "STATIC_ESCALATION_ANALYSIS"


def _parent_map(roles: list[RBACRole]) -> dict[str, str | None]:
    return {role.role_id: role.parent_role_id for role in roles}


def _children_map(roles: list[RBACRole]) -> dict[str, list[str]]:
    children: dict[str, list[str]] = {}
    for role in roles:
        if role.parent_role_id:
            children.setdefault(role.parent_role_id, []).append(role.role_id)
    return children


def detect_inheritance_cycles(roles: list[RBACRole]) -> list[list[str]]:
    """doc/prd.md AC-RB-08. Each role has at most one parent, so a cycle is
    a parent chain that loops back on itself instead of terminating at a
    root (`parent_role_id=None`)."""

    return find_cycles_in_parent_chains(_parent_map(roles))


def compute_role_depths(roles: list[RBACRole]) -> dict[str, int]:
    """Depth 0 = root (no parent). A role on a cycle gets depth `-1`
    (undefined) rather than recursing forever - callers should run
    `detect_inheritance_cycles` first and treat `-1` as invalid."""

    parent_of = _parent_map(roles)
    depths: dict[str, int] = {}

    def depth_of(role_id: str, trail: frozenset[str]) -> int:
        if role_id in depths:
            return depths[role_id]
        if role_id in trail:
            return -1
        parent = parent_of.get(role_id)
        if parent is None:
            depths[role_id] = 0
            return 0
        parent_depth = depth_of(parent, trail | {role_id})
        result = -1 if parent_depth == -1 else parent_depth + 1
        depths[role_id] = result
        return result

    for role_id in parent_of:
        depth_of(role_id, frozenset())
    return depths


def validate_inheritance_depth(roles: list[RBACRole], max_depth: int = 3) -> list[str]:
    """doc/prd.md AC-RB-07: default depth limit 3, configurable to 5.
    Returns the `role_id`s that violate the limit."""

    depths = compute_role_depths(roles)
    return [role_id for role_id, depth in depths.items() if depth > max_depth]


def build_inheritance_graph(roles: list[RBACRole]) -> InheritanceGraph:
    """Builds the derived `InheritanceGraph` snapshot from `RBACRole.parent_role_id`."""

    cycles = detect_inheritance_cycles(roles)
    depths = compute_role_depths(roles)
    edges = [
        InheritanceGraphEdge(from_role_id=role.parent_role_id, to_role_id=role.role_id)
        for role in roles
        if role.parent_role_id is not None
    ]
    nodes = [InheritanceGraphNode(role_id=role.role_id, depth=depths.get(role.role_id, 0)) for role in roles]
    return InheritanceGraph(
        nodes=nodes,
        edges=edges,
        max_depth=max(depths.values(), default=0),
        cycles=cycles,
    )


def _descendants(role_id: str, children: dict[str, list[str]]) -> list[str]:
    """All descendants of `role_id` (children, grandchildren, ...).
    Assumes an acyclic graph - callers must run `detect_inheritance_cycles`
    first."""

    result: list[str] = []
    queue = list(children.get(role_id, []))
    while queue:
        current = queue.pop(0)
        result.append(current)
        queue.extend(children.get(current, []))
    return result


def _chain_between(senior_id: str, junior_id: str, parent_of: dict[str, str | None]) -> list[str]:
    """Ordered path from `senior_id` to `junior_id` along the parent chain."""

    chain = [junior_id]
    current = junior_id
    while current != senior_id:
        current = parent_of[current]
        chain.append(current)
    return list(reversed(chain))


def detect_privilege_escalation(
    roles: list[RBACRole],
    role_permissions: list[RolePermissionEntry],
    permissions: list[RBACPermission],
) -> list[EscalationPath]:
    """doc/prd.md `STATIC_ESCALATION_ANALYSIS` (AC-RB-03, US-SE-02). See the
    module docstring for the inheritance-direction convention this assumes.
    Only transitive (2+ hop) grants are flagged - a direct parent<-child
    grant is expected and reviewed at assignment time.
    """

    permission_by_id = {permission.permission_id: permission for permission in permissions}
    parent_of = _parent_map(roles)
    children = _children_map(roles)
    depths = compute_role_depths(roles)

    escalations: list[EscalationPath] = []
    for role in roles:
        for descendant_id in _descendants(role.role_id, children):
            hop_count = depths.get(descendant_id, 0) - depths.get(role.role_id, 0)
            if hop_count < 2:
                continue
            for entry in role_permissions:
                if entry.role_id != descendant_id or not entry.granted:
                    continue
                permission = permission_by_id.get(entry.permission_id)
                if permission is None:
                    continue
                escalations.append(
                    EscalationPath(
                        path=_chain_between(role.role_id, descendant_id, parent_of),
                        resulting_access=f"{permission.action} {permission.resource}",
                        depth=hop_count,
                    )
                )
    return escalations
