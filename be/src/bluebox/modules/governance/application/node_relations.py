"""Gathers a node's directly-related nodes for design-context RAG (chat
module's `_retrieve_context`).

Uses the same well-established per-type reference fields
`interfaces/api/routers/graph.py`'s `_upstream_ref`/`_traceability_sources`
already rely on for the (separately wired) `GET /graph` endpoint -
deliberately not the generic `Node.parent_id`/`children_ids` fields, which
another in-flight change is still wiring up and aren't yet reliably
populated.
"""

from bluebox.shared_kernel.domain.node import (
    CapabilityNode,
    EngineeringTaskNode,
    Node,
    UseCaseNode,
    UserStoryNode,
)


def gather_design_context(nodes: list[Node], node_id: str) -> list[Node]:
    """Returns `[target, *related]`, or `[]` if `node_id` isn't found."""

    by_id = {n.node_id: n for n in nodes}
    target = by_id.get(node_id)
    if target is None:
        return []

    related_ids: list[str] = []
    if isinstance(target, EngineeringTaskNode):
        related_ids.append(target.parent_story_id)
    elif isinstance(target, UserStoryNode):
        related_ids.append(target.actor_id)
        related_ids.extend(target.dependencies)
        # Deliberate downstream/reverse lookup, asymmetric with every other
        # branch here - the single most useful relation for "how does this
        # materialize": the tasks that actually implement this story.
        related_ids.extend(
            n.node_id
            for n in nodes
            if isinstance(n, EngineeringTaskNode) and n.parent_story_id == target.node_id
        )
    elif isinstance(target, UseCaseNode):
        related_ids.append(target.primary_actor_id)
        related_ids.extend(target.secondary_actor_ids)
    elif isinstance(target, CapabilityNode):
        related_ids.extend(target.related_actor_ids)
    # ActorNode / CustomAnnotationNode: no extras.

    related = [by_id[rid] for rid in related_ids if rid in by_id and rid != node_id]
    return [target, *related]
