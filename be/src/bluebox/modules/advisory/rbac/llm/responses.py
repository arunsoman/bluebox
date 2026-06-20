"""LLM response models for the RBAC Advisor.

Field shapes transcribed from doc/api_event_contract.md SS6.1.
"""

from typing import Literal

from pydantic import model_validator

from bluebox.shared_kernel.llm.base import LLMResponse


class RBACRole(LLMResponse):
    """doc/api_event_contract.md SS6.1 `RBACRole`."""

    role_id: str
    role_name: str
    parent_role_id: str | None = None
    description: str


class RBACPermission(LLMResponse):
    """doc/api_event_contract.md SS6.1 `RBACPermission`."""

    permission_id: str
    resource: str
    action: Literal["GET", "POST", "PUT", "DELETE", "PATCH"]
    description: str


class RolePermissionEntry(LLMResponse):
    """doc/api_event_contract.md SS6.1 `RolePermissionEntry`.

    doc/prd.md AC-RB-02: every grant must carry a `rationale` and
    `decision_maker` - enforced below rather than left to the prompt alone.
    """

    entry_id: str
    role_id: str
    permission_id: str
    granted: bool
    rationale: str
    decision_maker: str
    conditions: list[str] = []

    @model_validator(mode="after")
    def _require_rationale_when_granted(self) -> "RolePermissionEntry":
        if self.granted and not self.rationale.strip():
            raise ValueError("rationale is required when granted=True (doc/prd.md AC-RB-02)")
        if self.granted and not self.decision_maker.strip():
            raise ValueError("decision_maker is required when granted=True (doc/prd.md AC-RB-02)")
        return self


class InheritanceGraphNode(LLMResponse):
    """doc/api_event_contract.md SS6.1 `InheritanceGraph.nodes[]`."""

    role_id: str
    depth: int


class InheritanceGraphEdge(LLMResponse):
    """doc/api_event_contract.md SS6.1 `InheritanceGraph.edges[]`.

    Contract field names are `from`/`to`; renamed `from_role_id`/`to_role_id`
    here because `from` is a Python reserved keyword.
    """

    from_role_id: str
    to_role_id: str


class InheritanceGraph(LLMResponse):
    """doc/api_event_contract.md SS6.1 `InheritanceGraph`."""

    nodes: list[InheritanceGraphNode]
    edges: list[InheritanceGraphEdge]
    max_depth: int
    cycles: list[list[str]] = []


class DataAccessEntry(LLMResponse):
    """doc/api_event_contract.md SS6.1 `DataAccessEntry`."""

    role_id: str
    entity: str
    access_level: Literal["None", "Own", "Department", "All"]
    rationale: str
    guard: str | None = None


class RBACModel(LLMResponse):
    """doc/api_event_contract.md SS6.1 `RBACModel`."""

    version: int
    roles: list[RBACRole]
    permissions: list[RBACPermission]
    role_permissions: list[RolePermissionEntry]
    inheritance_graph: InheritanceGraph
    data_access_matrix: list[DataAccessEntry]
