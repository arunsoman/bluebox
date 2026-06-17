"""DependencyGraphService — in-memory DAG for node relationships."""

from __future__ import annotations

import logging
from typing import Any

import networkx as nx

from app.domain.models import ProjectBlueprint

logger = logging.getLogger(__name__)


class DependencyGraphService:
    """In-memory DAG for Story -> UseCase -> Capability -> Actor relationships.

    Uses *networkx.DiGraph* for efficient traversal, cycle detection, and
    downstream/upstream queries.  Maintains a parallel ``_node_index`` for
    O(1) node metadata lookups.
    """

    def __init__(self) -> None:
        self._graph: nx.DiGraph = nx.DiGraph()
        self._node_index: dict[str, dict[str, Any]] = {}

    def add_node(
        self,
        node_id: str,
        node_type: str,
        data: dict,
        parent_ids: list[str] | None = None,
    ) -> None:
        """Add a node and optionally wire edges from *parent_ids*."""
        self._graph.add_node(node_id, node_type=node_type, **data)
        self._node_index[node_id] = {"type": node_type, "data": data}

        if parent_ids:
            for parent_id in parent_ids:
                if parent_id in self._graph:
                    self._graph.add_edge(parent_id, node_id)
                else:
                    logger.warning(
                        "Parent %s not found when adding node %s; skipping edge",
                        parent_id,
                        node_id,
                    )

    def remove_node(self, node_id: str) -> list[str]:
        """Remove *node_id* from the graph.

        Returns:
            List of orphaned downstream node IDs.
        """
        orphaned: list[str] = []
        if node_id in self._graph:
            orphaned = list(nx.descendants(self._graph, node_id))
            self._graph.remove_node(node_id)
        if node_id in self._node_index:
            del self._node_index[node_id]
        return orphaned

    def get_downstream(self, node_id: str) -> dict[str, list[str]]:
        """Return directly and transitively affected nodes."""
        direct = list(self._graph.successors(node_id))
        all_descendants = list(nx.descendants(self._graph, node_id))
        transitive = [n for n in all_descendants if n not in direct]
        return {
            "directly_affected": direct,
            "transitively_affected": transitive,
        }

    def get_upstream(self, node_id: str) -> list[str]:
        """Return ancestor node IDs that *node_id* depends on."""
        return list(nx.ancestors(self._graph, node_id))

    def detect_cycles(self) -> list[list[str]]:
        """Return a list of cycles found in the graph."""
        if self._graph.number_of_nodes() == 0:
            return []
        cycles = list(nx.simple_cycles(self._graph))
        return cycles

    def build_from_blueprint(self, blueprint: ProjectBlueprint) -> None:
        """Rebuild the entire graph from a *ProjectBlueprint*."""
        self._graph.clear()
        self._node_index.clear()

        for actor in blueprint.actors:
            self.add_node(actor.id, "actor", actor.model_dump())

        for cap in blueprint.capabilities:
            self.add_node(cap.id, "capability", cap.model_dump(), cap.actor_ids)

        for uc in blueprint.use_cases:
            self.add_node(uc.id, "use_case", uc.model_dump(), uc.capability_ids)

        for story in blueprint.user_stories:
            self.add_node(
                story.id, "user_story", story.model_dump(), story.use_case_ids
            )

        for task in blueprint.task_decomposition:
            self.add_node(task.id, "task", task.model_dump(), task.story_ids)

    def to_dict(self) -> dict[str, Any]:
        """Serialize nodes and edges to a plain dictionary."""
        return {
            "nodes": [
                {"id": n, **self._graph.nodes[n]} for n in self._graph.nodes()
            ],
            "edges": [{"from": u, "to": v} for u, v in self._graph.edges()],
        }

    def node_count(self) -> int:
        return self._graph.number_of_nodes()

    def edge_count(self) -> int:
        return self._graph.number_of_edges()

    def has_node(self, node_id: str) -> bool:
        return node_id in self._graph
