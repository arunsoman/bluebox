"""ImpactAnalyzer — computes downstream effects of proposed changes."""

from __future__ import annotations

from typing import TYPE_CHECKING

from app.domain.models import ImpactReport, ProposedChange

if TYPE_CHECKING:
    from app.graph.dag import DependencyGraphService

_NODE_TYPE_TO_STAGE: dict[str, int] = {
    "actor": 2,
    "capability": 3,
    "use_case": 4,
    "user_story": 5,
    "task": 6,
}


class ImpactAnalyzer:
    """Computes downstream + upstream effects of a *ProposedChange*."""

    def __init__(self, graph_service: DependencyGraphService) -> None:
        self.graph = graph_service

    async def analyze(self, proposed_change: ProposedChange) -> ImpactReport:
        """Analyse the impact of *proposed_change*."""
        node_id = proposed_change.node_id

        if node_id and self.graph.has_node(node_id):
            downstream = self.graph.get_downstream(node_id)
            upstream = self.graph.get_upstream(node_id)
        else:
            downstream = {"directly_affected": [], "transitively_affected": []}
            upstream = []

        stages_to_rerun = self._determine_stages_to_rerun(
            downstream, upstream, proposed_change
        )

        estimated_rework_ms = len(downstream["transitively_affected"]) * 100

        return ImpactReport(
            proposed_change=proposed_change,
            directly_affected=downstream["directly_affected"],
            transitively_affected=downstream["transitively_affected"],
            upstream_affected=upstream,
            stages_to_rerun=sorted(stages_to_rerun),
            estimated_rework_time_ms=estimated_rework_ms,
        )

    def _determine_stages_to_rerun(
        self,
        downstream: dict[str, list[str]],
        upstream: list[str],
        change: ProposedChange,
    ) -> set[int]:
        """Map affected node types to stage IDs that must be re-executed."""
        stages: set[int] = set()

        if change.node_type in _NODE_TYPE_TO_STAGE:
            stages.add(_NODE_TYPE_TO_STAGE[change.node_type])

        all_affected = downstream["directly_affected"] + downstream["transitively_affected"]
        for affected_id in all_affected:
            node_info = self.graph._node_index.get(affected_id, {})
            node_type = node_info.get("type", "")
            stage = _NODE_TYPE_TO_STAGE.get(node_type)
            if stage is not None:
                stages.add(stage)

        return stages
