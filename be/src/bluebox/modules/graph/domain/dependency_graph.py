"""DependencyGraphService - doc/prd.md SS4.5 Graph & Impact Analysis Module.

Builds an in-memory DAG from committed `Node`s (`parent_id`/`children_ids`)
and computes downstream/upstream impact for the (future) RevisionEngine.

`ImpactReport`'s exact field shape is never fully specified in either spec
doc - only `{ report_id, directly_affected[], transitively_affected[],
stages_to_rerun[] }` (doc/prd.md SS6.1 REST table). Modeled here with
`directly_affected`/`transitively_affected` as `node_id` lists, matching
that literal shape; `target_node_id` is added since the report needs to
say what change it's about.
"""

from pydantic import BaseModel, ConfigDict

from bluebox.shared_kernel.domain.graph_utils import find_cycles_in_parent_chains
from bluebox.shared_kernel.domain.node import Node


class ImpactReport(BaseModel):
    """doc/prd.md SS6.1 `IMPACT_REPORT_READY` payload (REST table shape)."""

    model_config = ConfigDict(extra="forbid")

    report_id: str
    target_node_id: str
    directly_affected: list[str]
    transitively_affected: list[str]
    stages_to_rerun: list[int]


class DependencyGraphService:
    """doc/prd.md SS4.5: "Constructs in-memory DAG: Story -> UseCase ->
    Capability -> Actor." Built fresh from a node list per call - this pass
    does not cache/persist the graph (doc/prd.md TDR-003 notes a Redis
    backup for the in-memory DAG; that's a future persistence concern).
    """

    def __init__(self, nodes: list[Node]) -> None:
        self._nodes_by_id = {node.node_id: node for node in nodes}
        self._children: dict[str, list[str]] = {}
        for node in nodes:
            if node.parent_id is not None:
                self._children.setdefault(node.parent_id, []).append(node.node_id)

    def detect_cycles(self) -> list[list[str]]:
        """DFS cycle detection - doc/prd.md SS4.5 "Cycle Detection"."""

        parent_of = {node_id: node.parent_id for node_id, node in self._nodes_by_id.items()}
        return find_cycles_in_parent_chains(parent_of)

    def downstream(self, node_id: str, report_id: str) -> ImpactReport:
        """doc/prd.md SS4.5 "Downstream Traversal: Given Node ID, returns
        directly_affected_nodes and transitively_affected_nodes."
        Assumes an acyclic graph - call `detect_cycles()` first if that
        hasn't already been validated.
        """

        direct = list(self._children.get(node_id, []))
        transitive: list[str] = []
        seen = set(direct)
        queue = list(direct)
        while queue:
            current = queue.pop(0)
            for child in self._children.get(current, []):
                if child not in seen:
                    seen.add(child)
                    transitive.append(child)
                    queue.append(child)

        affected_ids = direct + transitive
        stages = sorted(
            {
                self._nodes_by_id[affected_id].provenance.generated_at_stage
                for affected_id in affected_ids
                if affected_id in self._nodes_by_id
            }
        )
        return ImpactReport(
            report_id=report_id,
            target_node_id=node_id,
            directly_affected=direct,
            transitively_affected=transitive,
            stages_to_rerun=stages,
        )

    def upstream_stages(self, node_id: str) -> list[int]:
        """doc/prd.md SS4.5 "Upstream Traversal: Identifies which stages
        must rerun" - walks ancestors via `parent_id`."""

        stages: list[int] = []
        current = self._nodes_by_id.get(node_id)
        while current is not None and current.parent_id is not None:
            current = self._nodes_by_id.get(current.parent_id)
            if current is not None:
                stages.append(current.provenance.generated_at_stage)
        return stages
