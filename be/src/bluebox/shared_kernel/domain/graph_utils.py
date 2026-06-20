"""Generic single-parent-chain cycle detection.

Both the RBAC role hierarchy (`rbac.py`, one `parent_role_id` per role) and
the Node graph (`modules/graph/domain/dependency_graph.py`, one `parent_id`
per node) are "forests with one parent pointer per item" - the same DFS
cycle-detection algorithm applies to both, so it lives here once rather
than being duplicated.
"""


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
