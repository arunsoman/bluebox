"""WhatIfService - doc/prd.md FR-IDE-17, doc/api_event_contract.md SS4.8.

Simulates a proposed field change on a committed `Node` and reports the
blast radius (downstream nodes, file regen estimate, commit-blocking
errors) before the user commits it - the Blueprint Graph's "What-If mode".

Severity assignment is grounded in domain primitives that already exist
rather than invented: `NodeBase.deactivate()`/`mark_orphaned()` motivate
the "deactivation orphans descendants" rule, `UserStoryNode.priority`
(the only MoSCoW field in the schema - FR-IDE-17's own example,
"capability from must_have to nice_to_have", doesn't actually match any
real `CapabilityNode` field) motivates the de-prioritization rule, and
`risk_classification` (shared by every node type) motivates the
risk-escalation rule. A field change that matches none of these gets a
"success" no-op verdict for its direct descendants only - cosmetic edits
(name/description/...) aren't modeled as cascading.

Downstream traversal walks `graph_utils.derive_node_edges` - the same
real-reference-field edges `routers/graph.py`'s `GET /graph` derives -
not `DependencyGraphService`'s `parent_id` walk
(`modules/graph/domain/dependency_graph.py`), which would see no edges at
all on real committed data (see that router's module docstring).

`WhatIfResult.simulation_id` is an addition beyond the contract's `WhatIfResult`
DTO (SS4.8 only lists `affected_nodes`/`severity_breakdown`/
`files_to_regenerate`/`estimated_regen_time_seconds`/`can_commit`/
`blocking_reasons`) - needed because the contract's own `WHAT_IF_COMMIT`
event (SS10.1) carries a `simulation_id` with no REST/WS endpoint that
ever defines where it comes from. `simulate()` mints one and caches which
node it was for in `AppState.pending_what_if_simulations` (one slot per
project, like `pending_hosting_options` etc.); `commit()` requires a
matching id - this is what stops a stale or hand-crafted commit payload
from applying a change that was never actually simulated.
"""

from collections.abc import MutableMapping
from datetime import datetime
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, ValidationError

from bluebox.modules.governance.application.node_service import NodeService
from bluebox.shared_kernel.domain.graph_utils import derive_node_edges
from bluebox.shared_kernel.domain.node import EngineeringTaskNode, Node, UserStoryNode
from bluebox.shared_kernel.ports import NodeRepository

_IMMUTABLE_FIELDS = {"node_id", "node_type", "provenance", "created_at", "created_by"}
_PRIORITY_RANK = {"Must Have": 0, "Should Have": 1, "Could Have": 2}
_RISK_RANK = {"LOW_RISK": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 3}
_SECONDS_PER_FILE_REGEN = 30


class AffectedNode(BaseModel):
    """doc/api_event_contract.md SS4.8 `AffectedNode`."""

    model_config = ConfigDict(extra="forbid")

    node_id: str
    node_type: str
    name: str
    severity: str
    reason: str
    distance: int


class WhatIfResult(BaseModel):
    """doc/api_event_contract.md SS4.8 `WhatIfResult` + `simulation_id`
    (see module docstring)."""

    model_config = ConfigDict(extra="forbid")

    simulation_id: str = ""
    affected_nodes: list[AffectedNode]
    severity_breakdown: dict[str, int]
    files_to_regenerate: list[str]
    estimated_regen_time_seconds: int
    can_commit: bool
    blocking_reasons: list[str] | None = None


class WhatIfSimulationNotFoundError(Exception):
    def __init__(self, project_id: str, simulation_id: str) -> None:
        super().__init__(f"no pending what-if simulation {simulation_id!r} for project {project_id!r}")


class WhatIfCommitBlockedError(Exception):
    def __init__(self, reasons: list[str]) -> None:
        super().__init__("; ".join(reasons))
        self.reasons = reasons


def _evaluate_change(node: Node, all_nodes: list[Node], proposed_changes: dict[str, Any]) -> WhatIfResult:
    """Pure - no simulation_id, no cache writes. Shared by `simulate()`
    (which wraps this with a freshly minted id) and `commit()` (which
    re-runs this right before applying, so the gate can't be bypassed by
    resending a different `proposed_changes` payload than was simulated)."""

    unknown = sorted(f for f in proposed_changes if f in _IMMUTABLE_FIELDS or f not in type(node).model_fields)
    if unknown:
        return WhatIfResult(
            affected_nodes=[],
            severity_breakdown={"success": 0, "warning": 0, "error": 0},
            files_to_regenerate=[],
            estimated_regen_time_seconds=0,
            can_commit=False,
            blocking_reasons=[f"field {f!r} is unknown or immutable on {node.node_type}" for f in unknown],
        )

    try:
        simulated = type(node).model_validate({**node.model_dump(mode="json"), **proposed_changes})
    except ValidationError as exc:
        return WhatIfResult(
            affected_nodes=[],
            severity_breakdown={"success": 0, "warning": 0, "error": 0},
            files_to_regenerate=[],
            estimated_regen_time_seconds=0,
            can_commit=False,
            blocking_reasons=[str(exc)],
        )

    children: dict[str, list[str]] = {}
    for source_id, target_id, _edge_type in derive_node_edges(all_nodes):
        children.setdefault(source_id, []).append(target_id)
    by_id = {n.node_id: n for n in all_nodes}

    descendants: list[tuple[str, int]] = []
    seen = {node.node_id}
    queue: list[tuple[str, int]] = [(node.node_id, 0)]
    while queue:
        current_id, distance = queue.pop(0)
        for child_id in children.get(current_id, []):
            if child_id in seen:
                continue
            seen.add(child_id)
            descendants.append((child_id, distance + 1))
            queue.append((child_id, distance + 1))

    severity, reason = _classify_change(node, simulated)

    affected: list[AffectedNode] = []
    for descendant_id, distance in descendants:
        descendant = by_id.get(descendant_id)
        if descendant is None:
            continue
        if severity is None:
            if distance > 1:
                continue
            node_severity, node_reason = "success", "no structural impact expected from this change"
        else:
            node_severity, node_reason = severity, reason or ""
        affected.append(
            AffectedNode(
                node_id=descendant.node_id,
                node_type=descendant.node_type,
                name=descendant.name,
                severity=node_severity,
                reason=node_reason,
                distance=distance,
            )
        )

    descendant_nodes = [by_id[d_id] for d_id, _ in descendants if d_id in by_id]
    files_to_regenerate = sorted(
        {
            path
            for candidate in [node, *descendant_nodes]
            if isinstance(candidate, EngineeringTaskNode)
            for path in candidate.file_paths
        }
    )

    breakdown = {"success": 0, "warning": 0, "error": 0}
    for affected_node in affected:
        breakdown[affected_node.severity] += 1

    error_reasons = sorted({a.reason for a in affected if a.severity == "error"})

    return WhatIfResult(
        affected_nodes=affected,
        severity_breakdown=breakdown,
        files_to_regenerate=files_to_regenerate,
        estimated_regen_time_seconds=len(files_to_regenerate) * _SECONDS_PER_FILE_REGEN,
        can_commit=not error_reasons,
        blocking_reasons=error_reasons or None,
    )


def _classify_change(node: Node, simulated: Node) -> tuple[str | None, str | None]:
    """Returns `(severity, reason)` applied uniformly to every downstream
    node, or `(None, None)` for a change with no modeled cascading effect
    (direct descendants only then get a "success" no-op entry - see
    caller)."""

    if node.is_active and not simulated.is_active:
        return "error", f"{node.name} would be deactivated and downstream nodes would become orphaned"

    if simulated.status != node.status and simulated.status in ("DEFERRED", "SUPERSEDED"):
        return "warning", f"{node.name}'s status would change to {simulated.status}; revalidate dependents"

    if (
        isinstance(node, UserStoryNode)
        and isinstance(simulated, UserStoryNode)
        and _PRIORITY_RANK[simulated.priority] > _PRIORITY_RANK[node.priority]
    ):
        return (
            "warning",
            f"{node.name} would be de-prioritized from {node.priority!r} to {simulated.priority!r}; "
            "consider re-estimating or deferring dependent tasks",
        )

    if _RISK_RANK[simulated.risk_classification] > _RISK_RANK[node.risk_classification]:
        return (
            "warning",
            f"{node.name}'s risk classification would escalate to {simulated.risk_classification}; "
            "downstream nodes require governance re-review",
        )

    return None, None


class WhatIfService:
    def __init__(self, nodes: NodeRepository, simulations: MutableMapping[str, Any]) -> None:
        self._nodes = nodes
        self._node_service = NodeService(nodes)
        self._simulations = simulations

    def simulate(self, project_id: str, node_id: str, proposed_changes: dict[str, Any]) -> WhatIfResult:
        node = self._node_service.get(project_id, node_id)  # raises NodeNotFoundError -> 404
        all_nodes = self._nodes.list_by_project(project_id)
        result = _evaluate_change(node, all_nodes, proposed_changes)

        simulation_id = uuid4().hex
        self._simulations[project_id] = (simulation_id, node_id)
        return result.model_copy(update={"simulation_id": simulation_id})

    def commit(self, project_id: str, simulation_id: str, proposed_changes: dict[str, Any]) -> Node:
        cached = self._simulations.get(project_id)
        if cached is None or cached[0] != simulation_id:
            raise WhatIfSimulationNotFoundError(project_id, simulation_id)
        node_id = cached[1]

        node = self._node_service.get(project_id, node_id)
        all_nodes = self._nodes.list_by_project(project_id)
        result = _evaluate_change(node, all_nodes, proposed_changes)
        if not result.can_commit:
            raise WhatIfCommitBlockedError(result.blocking_reasons or ["simulation reports unresolved errors"])

        for field, value in proposed_changes.items():
            setattr(node, field, value)
        node.version += 1
        node.updated_at = datetime.now()
        # `NodeRepository.get()` deserializes a fresh copy from storage on
        # every call (no in-memory identity) - an in-place mutation alone
        # would be silently lost the moment anything re-fetches this node.
        # `add()` is an upsert keyed by node_id (see `SqliteNodeRepository`),
        # so this is the actual write-back.
        self._nodes.add(project_id, node)

        del self._simulations[project_id]
        return node
