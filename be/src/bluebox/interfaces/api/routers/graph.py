"""doc/api_event_contract.md SS4.8 Blueprint Graph.

Only `GET /graph` is implemented. `POST /graph/what-if` is contract-specified
but has no caller anywhere in `new-fe/src` yet (`graphApi.simulateWhatIf` is
defined but unused) - a real simulation engine (severity breakdown, file
regen estimates) would be new domain logic with nothing driving it, so it's
left out rather than fabricated.

`GraphNode.type`'s contract Literal doesn't include `custom_annotation` (an
addition beyond SS5.1's six node types, see `shared_kernel/domain/node.py`) -
those nodes are omitted here rather than coerced into a type they aren't.

Edges aren't a stored concept; they're derived on read. `parent_id` (generic,
universal per SS5.1) is never actually set by `steering_service.py` when
candidates are committed - the real per-type reference fields are what carry
the hierarchy: `CapabilityNode.related_actor_ids`,
`UseCaseNode.primary_actor_id`/`secondary_actor_ids`,
`UserStoryNode.actor_id`/`dependencies`, `EngineeringTaskNode.parent_story_id`.
Note the contract's own SS5.x fields don't link Capability<->UseCase or
UseCase<->UserStory at all (only each links back to Actor, or - for
EngineeringTask - to UserStory) - that's a real gap in the contract's node
schemas, not something invented or omitted here. `provenance` edges (per the
contract's `GraphEdge.type` enum) have no corresponding stored relationship
at all.
"""

from typing import Any, Literal

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict

from bluebox.shared_kernel.domain.node import (
    CapabilityNode,
    EngineeringTaskNode,
    Node,
    NodeStatus,
    UseCaseNode,
    UserStoryNode,
)
from bluebox.shared_kernel.infrastructure.in_memory import app_state

router = APIRouter(prefix="/api/v1/projects/{project_id}/graph", tags=["graph"])

_CONTRACT_NODE_TYPES = {"actor", "capability", "use_case", "user_story", "engineering_task", "file"}


class GraphNode(BaseModel):
    """doc/api_event_contract.md SS4.8 `GraphNode`. `x`/`y`/`z` (layout
    position) are left unset - this backend has no layout engine; the
    frontend's graph renderer is responsible for positioning."""

    model_config = ConfigDict(extra="forbid")

    id: str
    type: Literal["actor", "capability", "use_case", "user_story", "engineering_task", "file"]
    name: str
    layer: str
    status: NodeStatus
    x: float | None = None
    y: float | None = None
    z: float | None = None
    data: dict[str, Any]


class GraphEdge(BaseModel):
    """doc/api_event_contract.md SS4.8 `GraphEdge`."""

    model_config = ConfigDict(extra="forbid")

    id: str
    source: str
    target: str
    type: Literal["dependency", "traceability", "provenance"]
    label: str | None = None


class GraphMetadata(BaseModel):
    model_config = ConfigDict(extra="forbid")

    total_nodes: int
    max_depth: int
    layers_present: list[str]


class GraphData(BaseModel):
    """doc/api_event_contract.md SS4.8 `GraphData`."""

    model_config = ConfigDict(extra="forbid")

    nodes: list[GraphNode]
    edges: list[GraphEdge]
    metadata: GraphMetadata


def _parse_csv(value: str | None) -> list[str] | None:
    """Mirrors how `new-fe/src/api/httpClient.ts`'s `buildUrl` serializes
    array query params: comma-joined, not repeated keys."""

    return value.split(",") if value else None


def _upstream_ref(node: Node) -> str | None:
    """The one upstream node id used for depth traversal - the first ref
    when a node type can have several (e.g. `secondary_actor_ids`), since
    depth only needs *a* path to a root, not every edge."""

    if isinstance(node, CapabilityNode):
        return node.related_actor_ids[0] if node.related_actor_ids else None
    if isinstance(node, UseCaseNode):
        return node.primary_actor_id
    if isinstance(node, UserStoryNode):
        return node.actor_id
    if isinstance(node, EngineeringTaskNode):
        return node.parent_story_id
    return node.parent_id


def _depth(node: Node, by_id: dict[str, Node]) -> int:
    depth = 0
    current = node
    seen: set[str] = set()
    while True:
        ref = _upstream_ref(current)
        if not ref or ref not in by_id or ref in seen:
            return depth
        seen.add(ref)
        current = by_id[ref]
        depth += 1


@router.get("", response_model=GraphData)
def get_graph(
    project_id: str,
    node_types: str | None = None,
    layers: str | None = None,
    depth: int | None = None,
) -> GraphData:
    types_filter = _parse_csv(node_types)
    layers_filter = _parse_csv(layers)

    all_nodes = [n for n in app_state.nodes.list_by_project(project_id) if n.node_type in _CONTRACT_NODE_TYPES]
    by_id = {n.node_id: n for n in all_nodes}

    nodes = all_nodes
    if types_filter:
        nodes = [n for n in nodes if n.node_type in types_filter]
    if layers_filter:
        nodes = [n for n in nodes if n.layer in layers_filter]
    if depth is not None:
        nodes = [n for n in nodes if _depth(n, by_id) <= depth]

    node_ids = {n.node_id for n in nodes}

    def _traceability_sources(node: Node) -> list[str]:
        if isinstance(node, CapabilityNode):
            return node.related_actor_ids
        if isinstance(node, UseCaseNode):
            return [node.primary_actor_id, *node.secondary_actor_ids]
        if isinstance(node, UserStoryNode):
            return [node.actor_id]
        if isinstance(node, EngineeringTaskNode):
            return [node.parent_story_id]
        return [node.parent_id] if node.parent_id else []

    edges: list[GraphEdge] = []
    for node in nodes:
        for source_id in _traceability_sources(node):
            if source_id in node_ids:
                edges.append(
                    GraphEdge(
                        id=f"EDGE-{source_id}-{node.node_id}",
                        source=source_id,
                        target=node.node_id,
                        type="traceability",
                    )
                )
        if isinstance(node, UserStoryNode):
            for dep_id in node.dependencies:
                if dep_id in node_ids:
                    edges.append(
                        GraphEdge(
                            id=f"EDGE-DEP-{dep_id}-{node.node_id}",
                            source=dep_id,
                            target=node.node_id,
                            type="dependency",
                        )
                    )

    return GraphData(
        nodes=[
            GraphNode(
                id=n.node_id,
                type=n.node_type,  # type: ignore[arg-type]
                name=n.name,
                layer=n.layer,
                status=n.status,
                data=n.model_dump(mode="json"),
            )
            for n in nodes
        ],
        edges=edges,
        metadata=GraphMetadata(
            total_nodes=len(nodes),
            max_depth=max((_depth(n, by_id) for n in nodes), default=0),
            layers_present=sorted({n.layer for n in nodes}),
        ),
    )
