"""ImpactAnalyzer — graph-traversal impact analysis for decision revisions.

When a user wants to revise a past decision, the analyzer traverses the
downstream dependency graph to determine which nodes, stages, and prior
decisions are affected.  The result is an ``ImpactReport`` that feeds the
propagation consent flow.
"""
from __future__ import annotations

from typing import Any

from domain.models import (
    SteeringOption,
    AffectedNode,
    ImpactReport,
    ImpactSeverity,
    ImpactType,
    DecisionLedger,
)
from infrastructure.persistence.redis.client import get_redis


class ImpactAnalyzer:
    """Analyzes downstream impact of changing a past decision.

    The analyzer is stateless; it reads the current session state from
    Redis/PostgreSQL via the provided services.
    """

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #

    async def compute_impact(
        self,
        session_id: str,
        decision_id: str,
        new_choice: SteeringOption,
    ) -> ImpactReport:
        """Compute the full impact of replacing a past decision.

        Args:
            session_id: Pipeline session ID.
            decision_id: The decision entry being revised.
            new_choice: The proposed replacement option.

        Returns:
            An ImpactReport with affected nodes, severity, and plain summary.
        """
        import uuid

        # 1. Gather session state
        session_state = await self._load_session_state(session_id)
        downstream_nodes = await self._traverse_graph(session_id, decision_id)

        # 2. Classify direct vs transitive impact
        directly_affected: list[AffectedNode] = []
        transitively_affected: list[AffectedNode] = []
        stages_to_rerun: set[str] = set()
        invalidated_decisions: set[str] = set()

        # The decision node itself is directly affected
        directly_affected.append(
            AffectedNode(
                node_id=decision_id,
                node_type="decision",
                label=f"Decision: {decision_id}",
                impact_reason="Original decision being replaced",
                impact_type=ImpactType.MODIFIED,
            )
        )

        for node in downstream_nodes:
            if node.impact_type == ImpactType.MODIFIED:
                directly_affected.append(node)
            else:
                transitively_affected.append(node)

            if node.impact_type == ImpactType.REQUIRES_RERUN:
                # Infer the stage from the node type / context
                stage = self._infer_stage(node)
                if stage:
                    stages_to_rerun.add(stage)

            if node.impact_type == ImpactType.MODIFIED and node.node_type == "decision_output":
                # This output was produced by a prior decision — may invalidate it
                invalidated_decisions.add(node.node_id)

        # 3. Severity classification
        all_affected = directly_affected + transitively_affected
        severity = self._classify_severity(all_affected)

        # 4. Build plain language summary
        summary = self._build_summary(
            decision_id=decision_id,
            new_choice=new_choice,
            direct_count=len(directly_affected),
            transitive_count=len(transitively_affected),
            stages=list(stages_to_rerun),
            severity=severity,
        )

        return ImpactReport(
            revision_request_id=str(uuid.uuid4()),
            original_decision_id=decision_id,
            proposed_choice=new_choice,
            directly_affected_nodes=directly_affected,
            transitively_affected_nodes=transitively_affected,
            stages_needing_rerun=list(stages_to_rerun),
            invalidated_decisions=list(invalidated_decisions),
            severity=severity,
            plain_summary=summary,
            detailed_breakdown=[n.impact_reason for n in all_affected if n.impact_reason],
        )

    # ------------------------------------------------------------------ #
    # Graph traversal
    # ------------------------------------------------------------------ #

    async def _traverse_graph(
        self,
        session_id: str,
        start_node: str,
    ) -> list[AffectedNode]:
        """Traverse the downstream dependency graph starting from a decision.

        Reads the dependency graph from Redis (set by pipeline stages).

        Args:
            session_id: Pipeline session ID.
            start_node: The node (decision_id) to start traversal from.

        Returns:
            List of affected downstream nodes.
        """
        r = await get_redis()
        dep_key = f"session_deps:{session_id}"
        deps_raw = await r.hgetall(dep_key)

        if not deps_raw:
            # No dependency graph recorded — return conservative estimate
            return []

        # Build adjacency list: node -> list of downstream node_ids
        adjacency: dict[str, list[str]] = {}
        for node_id, downstream_json in deps_raw.items():
            import json

            try:
                downstream = json.loads(downstream_json)
                adjacency[node_id] = downstream if isinstance(downstream, list) else []
            except (json.JSONDecodeError, TypeError):
                adjacency[node_id] = []

        # BFS traversal
        visited: set[str] = set()
        queue: list[str] = [start_node]
        affected: list[AffectedNode] = []

        while queue:
            current = queue.pop(0)
            if current in visited:
                continue
            visited.add(current)

            for child_id in adjacency.get(current, []):
                if child_id not in visited:
                    # Determine impact type heuristically
                    impact_type = self._infer_impact_type(child_id)
                    affected.append(
                        AffectedNode(
                            node_id=child_id,
                            node_type=self._infer_node_type(child_id),
                            label=f"Node: {child_id}",
                            impact_reason=f"Downstream dependency of {current}",
                            impact_type=impact_type,
                        )
                    )
                    queue.append(child_id)

        return affected

    # ------------------------------------------------------------------ #
    # Classification
    # ------------------------------------------------------------------ #

    @staticmethod
    def _classify_severity(affected: list[AffectedNode]) -> ImpactSeverity:
        """Classify impact severity based on the affected node list.

        LOCAL:       Only the target node is affected.
        CASCADING:   Multiple downstream nodes across 1-2 stages.
        STRUCTURAL:  Crosses >2 stages or involves structural elements
                     (roles, permissions, data access).
        """
        if len(affected) <= 1:
            return ImpactSeverity.LOCAL

        # Collect unique stages and structural flags
        stages: set[str] = set()
        structural = False
        for node in affected:
            stage = ImpactAnalyzer._infer_stage_static(node.node_id)
            if stage:
                stages.add(stage)
            if node.node_type in ("role", "permission", "data_access", "rbac"):
                structural = True

        if structural or len(stages) > 2:
            return ImpactSeverity.STRUCTURAL

        if len(stages) >= 1 or len(affected) > 3:
            return ImpactSeverity.CASCADING

        return ImpactSeverity.LOCAL

    # ------------------------------------------------------------------ #
    # Helpers
    # ------------------------------------------------------------------ #

    async def _load_session_state(self, session_id: str) -> dict[str, Any]:
        """Load the current session state snapshot from Redis."""
        from infrastructure.persistence.redis.client import get_cached_session

        cached = await get_cached_session(session_id)
        return cached or {}

    @staticmethod
    def _infer_stage(node: AffectedNode) -> str | None:
        """Infer which pipeline stage a node belongs to."""
        return ImpactAnalyzer._infer_stage_static(node.node_id)

    @staticmethod
    def _infer_stage_static(node_id: str) -> str | None:
        """Infer stage from node_id prefix or content."""
        # Node IDs often follow patterns like "stage_name:uuid" or contain stage hints
        from domain.models import StageName

        stage_prefixes = {
            "prd_": StageName.PRD_ANALYSIS.value,
            "idea_": StageName.IDEATION.value,
            "actor_": StageName.ACTOR_DISCOVERY.value,
            "cap_": StageName.CAPABILITY_DISCOVERY.value,
            "capability_": StageName.CAPABILITY_DISCOVERY.value,
            "use_case_": StageName.USE_CASE_DISCOVERY.value,
            "story_": StageName.STORY_DISCOVERY.value,
            "task_": StageName.TASK_DECOMPOSITION.value,
        }
        node_lower = node_id.lower()
        for prefix, stage in stage_prefixes.items():
            if prefix in node_lower:
                return stage
        return None

    @staticmethod
    def _infer_impact_type(node_id: str) -> ImpactType:
        """Heuristically infer the impact type for a node."""
        if "output" in node_id or "result" in node_id:
            return ImpactType.MODIFIED
        if "decision" in node_id:
            return ImpactType.REQUIRES_RERUN
        return ImpactType.POTENTIALLY_AFFECTED

    @staticmethod
    def _infer_node_type(node_id: str) -> str:
        """Heuristically infer the node type from its ID."""
        lowered = node_id.lower()
        type_map = {
            "actor": "actor",
            "capability": "capability",
            "use_case": "use_case",
            "story": "story",
            "task": "task",
            "idea": "idea",
            "role": "role",
            "permission": "permission",
            "decision": "decision",
        }
        for key, ntype in type_map.items():
            if key in lowered:
                return ntype
        return "generic"

    @staticmethod
    def _build_summary(
        decision_id: str,
        new_choice: SteeringOption,
        direct_count: int,
        transitive_count: int,
        stages: list[str],
        severity: ImpactSeverity,
    ) -> str:
        """Build a 2-3 sentence plain-language summary."""
        lines = [
            f"Changing decision {decision_id[:8]}... to '{new_choice.label}' "
            f"will directly affect {direct_count} node(s) and transitively impact "
            f"{transitive_count} downstream node(s)."
        ]

        if stages:
            stage_list = ", ".join(stages)
            lines.append(f"The following stages will need to be re-run: {stage_list}.")

        if severity == ImpactSeverity.STRUCTURAL:
            lines.append(
                "This is a STRUCTURAL change that may affect roles, permissions, or data access. "
                "Review carefully before confirming."
            )
        elif severity == ImpactSeverity.CASCADING:
            lines.append(
                "This is a CASCADING change with moderate downstream impact."
            )
        else:
            lines.append("This is a LOCAL change with limited impact.")

        return " ".join(lines)
