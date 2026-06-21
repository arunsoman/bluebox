"""Generic single-parent-chain cycle detection, and Node graph edge
derivation.

Both the RBAC role hierarchy (`rbac.py`, one `parent_role_id` per role) and
the Node graph (`modules/graph/domain/dependency_graph.py`, one `parent_id`
per node) are "forests with one parent pointer per item" - the same DFS
cycle-detection algorithm applies to both, so it lives here once rather
than being duplicated.

`derive_node_edges` is the other shared piece: both
`interfaces/api/routers/graph.py`'s `GET /graph` and
`modules/graph/application/what_if_service.py`'s downstream-impact walk
need the same source-of-truth for "what points at what", and per
`routers/graph.py`'s module docstring, that source of truth is each node
type's real reference field (`related_actor_ids`, `primary_actor_id`,
`actor_id`, `parent_story_id`) - not `parent_id`, which
`steering_service.py` never actually sets on commit.
"""

from bluebox.shared_kernel.domain.node import (
    CapabilityNode,
    EngineeringTaskNode,
    Node,
    UseCaseNode,
    UserStoryNode,
)


def derive_node_edges(nodes: list[Node]) -> list[tuple[str, str, str]]:
    """Returns `(source_id, target_id, edge_type)` triples, restricted to
    edges where both ends are in `nodes` - callers pass either a project's
    full node list (impact analysis) or an already-filtered subset (the
    graph view's type/layer/depth filters)."""

    node_ids = {n.node_id for n in nodes}
    edges: list[tuple[str, str, str]] = []

    for node in nodes:
        if isinstance(node, CapabilityNode):
            sources = node.related_actor_ids
        elif isinstance(node, UseCaseNode):
            sources = [node.primary_actor_id, *node.secondary_actor_ids]
        elif isinstance(node, UserStoryNode):
            sources = [node.actor_id]
        elif isinstance(node, EngineeringTaskNode):
            sources = [node.parent_story_id]
        else:
            sources = [node.parent_id] if node.parent_id else []

        for source_id in sources:
            if source_id in node_ids:
                edges.append((source_id, node.node_id, "traceability"))

        if isinstance(node, UserStoryNode):
            for dep_id in node.dependencies:
                if dep_id in node_ids:
                    edges.append((dep_id, node.node_id, "dependency"))

    return edges


def find_cycles_in_parent_chains(parent_of: dict[str, str | None]) -> list[list[str]]:
    """`parent_of` maps an item id to its parent's id (or `None` at a
    root). Returns each cycle found as an ordered path that starts and ends
    on the same item id.
    """

    cycles: list[list[str]] = []
    already_flagged: set[str] = set()

    for item_id in parent_of:
        if item_id in already_flagged:
            continue
        chain: list[str] = []
        chain_index: dict[str, int] = {}
        current: str | None = item_id
        while current is not None:
            if current in chain_index:
                cycle = chain[chain_index[current] :] + [current]
                cycles.append(cycle)
                already_flagged.update(cycle)
                break
            chain_index[current] = len(chain)
            chain.append(current)
            current = parent_of.get(current)
    return cycles
