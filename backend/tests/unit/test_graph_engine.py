"""Unit tests for the DependencyGraphService (DAG engine).

Tests cover:
- DAG construction from blueprint
- Downstream traversal
- Upstream traversal
- Cycle detection
- remove_node returns orphans
- Performance test: 1000 nodes, impact analysis <500ms
"""

from __future__ import annotations

import time

import pytest

from app.domain.models import (
    Actor,
    Capability,
    EngineeringTask,
    ProjectBlueprint,
    UseCase,
    UserStory,
)
from app.graph.dag import DependencyGraphService
from app.graph.impact import ImpactAnalyzer
from app.domain.models import ProposedChange


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_blueprint_with_chain() -> ProjectBlueprint:
    """Create a blueprint with a clean chain: Actor -> Cap -> UC -> Story -> Task."""
    bp = ProjectBlueprint(project_id="test-graph")
    actor = Actor(id="a1", name="User", description="End user", type="human")
    cap = Capability(id="c1", name="Auth", description="Authentication", actor_ids=["a1"])
    uc = UseCase(id="u1", name="Login", description="User login", capability_ids=["c1"])
    story = UserStory(id="s1", title="As a user I want to login", description="Login story", use_case_ids=["u1"])
    task = EngineeringTask(id="t1", title="Implement login", description="Login task", story_ids=["s1"])

    bp.actors = [actor]
    bp.capabilities = [cap]
    bp.use_cases = [uc]
    bp.user_stories = [story]
    bp.task_decomposition = [task]
    return bp


# ---------------------------------------------------------------------------
# DAG Construction
# ---------------------------------------------------------------------------


class TestDAGConstruction:
    def test_build_from_blueprint_creates_nodes(self):
        bp = make_blueprint_with_chain()
        g = DependencyGraphService()
        g.build_from_blueprint(bp)

        assert g.node_count() == 5
        assert g.has_node("a1")
        assert g.has_node("c1")
        assert g.has_node("u1")
        assert g.has_node("s1")
        assert g.has_node("t1")

    def test_build_from_blueprint_creates_edges(self):
        bp = make_blueprint_with_chain()
        g = DependencyGraphService()
        g.build_from_blueprint(bp)

        # Actor -> Capability -> UseCase -> Story -> Task
        assert g.edge_count() == 4

    def test_build_clears_previous_state(self):
        bp = make_blueprint_with_chain()
        g = DependencyGraphService()
        g.build_from_blueprint(bp)
        assert g.node_count() == 5

        bp2 = ProjectBlueprint(project_id="test-empty")
        g.build_from_blueprint(bp2)
        assert g.node_count() == 0

    def test_empty_blueprint_creates_empty_graph(self):
        bp = ProjectBlueprint()
        g = DependencyGraphService()
        g.build_from_blueprint(bp)
        assert g.node_count() == 0
        assert g.edge_count() == 0


# ---------------------------------------------------------------------------
# Downstream Traversal
# ---------------------------------------------------------------------------


class TestDownstreamTraversal:
    def test_actor_downstream(self):
        bp = make_blueprint_with_chain()
        g = DependencyGraphService()
        g.build_from_blueprint(bp)

        downstream = g.get_downstream("a1")
        assert "c1" in downstream["directly_affected"]
        assert "u1" in downstream["transitively_affected"]
        assert "s1" in downstream["transitively_affected"]
        assert "t1" in downstream["transitively_affected"]

    def test_capability_downstream(self):
        bp = make_blueprint_with_chain()
        g = DependencyGraphService()
        g.build_from_blueprint(bp)

        downstream = g.get_downstream("c1")
        assert "u1" in downstream["directly_affected"]
        assert "s1" in downstream["transitively_affected"]
        assert "t1" in downstream["transitively_affected"]

    def test_task_has_no_downstream(self):
        bp = make_blueprint_with_chain()
        g = DependencyGraphService()
        g.build_from_blueprint(bp)

        downstream = g.get_downstream("t1")
        assert downstream["directly_affected"] == []
        assert downstream["transitively_affected"] == []

    def test_nonexistent_node_returns_empty(self):
        g = DependencyGraphService()
        downstream = g.get_downstream("nonexistent")
        assert downstream == {"directly_affected": [], "transitively_affected": []}


# ---------------------------------------------------------------------------
# Upstream Traversal
# ---------------------------------------------------------------------------


class TestUpstreamTraversal:
    def test_task_upstream(self):
        bp = make_blueprint_with_chain()
        g = DependencyGraphService()
        g.build_from_blueprint(bp)

        upstream = g.get_upstream("t1")
        assert "s1" in upstream
        assert "u1" in upstream
        assert "c1" in upstream
        assert "a1" in upstream

    def test_story_upstream(self):
        bp = make_blueprint_with_chain()
        g = DependencyGraphService()
        g.build_from_blueprint(bp)

        upstream = g.get_upstream("s1")
        assert "u1" in upstream
        assert "c1" in upstream
        assert "a1" in upstream

    def test_actor_has_no_upstream(self):
        bp = make_blueprint_with_chain()
        g = DependencyGraphService()
        g.build_from_blueprint(bp)

        upstream = g.get_upstream("a1")
        assert upstream == []


# ---------------------------------------------------------------------------
# Cycle Detection
# ---------------------------------------------------------------------------


class TestCycleDetection:
    def test_no_cycles_in_valid_blueprint(self):
        bp = make_blueprint_with_chain()
        g = DependencyGraphService()
        g.build_from_blueprint(bp)

        cycles = g.detect_cycles()
        assert cycles == []

    def test_empty_graph_has_no_cycles(self):
        g = DependencyGraphService()
        cycles = g.detect_cycles()
        assert cycles == []

    def test_manual_cycle_detection(self):
        g = DependencyGraphService()
        g.add_node("a", "actor", {"name": "A"})
        g.add_node("b", "capability", {"name": "B"})
        g.add_node("c", "use_case", {"name": "C"})
        g._graph.add_edge("a", "b")
        g._graph.add_edge("b", "c")
        g._graph.add_edge("c", "a")  # Create cycle

        cycles = g.detect_cycles()
        assert len(cycles) > 0
        # At least one cycle contains a, b, c
        cycle_nodes = set()
        for cycle in cycles:
            cycle_nodes.update(cycle)
        assert {"a", "b", "c"}.issubset(cycle_nodes)


# ---------------------------------------------------------------------------
# Node Removal
# ---------------------------------------------------------------------------


class TestNodeRemoval:
    def test_remove_node_returns_orphans(self):
        bp = make_blueprint_with_chain()
        g = DependencyGraphService()
        g.build_from_blueprint(bp)

        orphaned = g.remove_node("c1")
        # c1's descendants: u1, s1, t1 should all be orphaned
        assert "u1" in orphaned
        assert "s1" in orphaned
        assert "t1" in orphaned

    def test_remove_node_removes_from_graph(self):
        bp = make_blueprint_with_chain()
        g = DependencyGraphService()
        g.build_from_blueprint(bp)

        g.remove_node("a1")
        assert not g.has_node("a1")

    def test_remove_nonexistent_node_returns_empty(self):
        g = DependencyGraphService()
        orphaned = g.remove_node("nonexistent")
        assert orphaned == []


# ---------------------------------------------------------------------------
# Performance: 1000 nodes, impact analysis <500ms
# ---------------------------------------------------------------------------


class TestGraphPerformance:
    def test_1000_nodes_impact_analysis_under_500ms(self):
        """Build a graph with 1000 nodes and verify impact analysis completes in <500ms."""
        g = DependencyGraphService()

        # Create 1000 actors and 999 edges (chain)
        for i in range(1000):
            g.add_node(f"node-{i}", "actor", {"name": f"Actor {i}"})
            if i > 0:
                g._graph.add_edge(f"node-{i-1}", f"node-{i}")

        analyzer = ImpactAnalyzer(g)
        change = ProposedChange(
            change_id="perf-test",
            action="edit",
            node_type="actor",
            node_id="node-0",
        )

        import asyncio
        async def run_analysis():
            return await analyzer.analyze(change)

        start = time.perf_counter()
        result = asyncio.run(run_analysis())
        elapsed_ms = (time.perf_counter() - start) * 1000

        assert elapsed_ms < 500, f"Impact analysis took {elapsed_ms:.1f}ms (expected <500ms)"
        assert len(result.transitively_affected) == 999  # All other nodes

    def test_1000_nodes_graph_build(self):
        """Build a graph with 1000 nodes from a blueprint."""
        bp = ProjectBlueprint()
        for i in range(1000):
            bp.actors.append(Actor(id=f"a{i}", name=f"Actor {i}", description="Test", type="human"))
            if i > 0:
                bp.actors[-1].parent_ids = [f"a{i-1}"]

        g = DependencyGraphService()
        start = time.perf_counter()
        g.build_from_blueprint(bp)
        elapsed_ms = (time.perf_counter() - start) * 1000

        assert g.node_count() == 1000
        assert elapsed_ms < 5000, f"Graph build took {elapsed_ms:.1f}ms"
