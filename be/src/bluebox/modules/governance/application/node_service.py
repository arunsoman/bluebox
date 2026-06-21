"""CRUD + enrichment over committed nodes - doc/prd.md SS4.4 CRUDNodeService.

`add`/`replace` are not built here: per `steering_service.py`'s docstring,
accept-then-edit is the intended division of labor for this pass, and a
combined single-call path is a future addition once that's stable.
"""

from bluebox.modules.governance.domain.node_validation import ValidationResult, validate_node
from bluebox.modules.governance.llm import agents as governance_agents
from bluebox.modules.governance.llm.requests import NodeEnrichmentRequest
from bluebox.modules.governance.llm.responses import EnrichResult
from bluebox.shared_kernel.domain.node import Node
from bluebox.shared_kernel.ports import NodeRepository


class NodeNotFoundError(Exception):
    def __init__(self, project_id: str, node_id: str) -> None:
        super().__init__(f"node {node_id!r} not found in project {project_id!r}")
        self.project_id = project_id
        self.node_id = node_id


class NodeService:
    def __init__(self, nodes: NodeRepository) -> None:
        self._nodes = nodes

    def list_by_project(self, project_id: str) -> list[Node]:
        return self._nodes.list_by_project(project_id)

    def get(self, project_id: str, node_id: str) -> Node:
        node = self._nodes.get(project_id, node_id)
        if node is None:
            raise NodeNotFoundError(project_id, node_id)
        return node

    def deactivate(self, project_id: str, node_id: str) -> Node:
        node = self.get(project_id, node_id)
        node.deactivate()
        return node

    def restore(self, project_id: str, node_id: str) -> Node:
        node = self.get(project_id, node_id)
        node.restore()
        return node

    def validate(self, project_id: str, node_id: str) -> ValidationResult:
        """doc/prd.md SS4.4 CRUDNodeService.Validate; doc/api_event_contract.md
        SS5.1 `POST /nodes/{node_id}/validate`."""

        return validate_node(self.get(project_id, node_id))

    async def enrich(
        self,
        project_id: str,
        node_id: str,
        *,
        enrichment_type: str = "auto",
        selected_suggestions: list[str] | None = None,
        fields_to_enrich: list[str] | None = None,
    ) -> tuple[Node, EnrichResult]:
        """doc/prd.md SS4.4 CRUDNodeService.Enrich: calls the
        `enrich_node` agent for field-level suggestions, applies any
        returned field whose name matches an attribute on the node, then
        runs the `Node.enrich()` lifecycle transition.
        """

        node = self.get(project_id, node_id)
        result = await governance_agents.enrich_node(
            NodeEnrichmentRequest(
                node_id=node_id,
                node_type=node.node_type,
                current_data={"name": node.name, "description": node.description},
                enrichment_type=enrichment_type,  # type: ignore[arg-type]
                selected_suggestions=selected_suggestions,
                fields_to_enrich=fields_to_enrich,
            )
        )

        for field_name, change in result.enriched_fields.items():
            if hasattr(node, field_name):
                setattr(node, field_name, change.after)

        node.enrich()
        return node, result
