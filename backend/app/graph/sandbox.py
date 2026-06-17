"""HypotheticalSandbox — read-only clone for What-If analysis."""

from __future__ import annotations

from copy import deepcopy

from app.domain.models import ImpactReport, ProposedChange
from app.graph.dag import DependencyGraphService
from app.graph.impact import ImpactAnalyzer


class HypotheticalSandbox:
    """Read-only clone for What-If analysis."""

    def __init__(self, graph_service: DependencyGraphService):
        self._original_graph = graph_service
        self._sandbox_graph: DependencyGraphService | None = None

    async def clone(self) -> DependencyGraphService:
        """Create a deep copy of the graph."""
        self._sandbox_graph = DependencyGraphService()
        self._sandbox_graph._graph = self._original_graph._graph.copy()
        self._sandbox_graph._node_index = deepcopy(self._original_graph._node_index)
        return self._sandbox_graph

    async def what_if(self, proposed_change: ProposedChange) -> ImpactReport:
        """Run impact analysis without modifying live state."""
        if self._sandbox_graph is None:
            await self.clone()
        analyzer = ImpactAnalyzer(self._sandbox_graph)  # type: ignore[arg-type]
        return await analyzer.analyze(proposed_change)
