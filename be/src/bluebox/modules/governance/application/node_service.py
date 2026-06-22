"""CRUD + enrichment over committed nodes - doc/prd.md SS4.4 CRUDNodeService.

`create` (contract `POST /nodes`) is not built here: mapping an arbitrary
`node_type` + free-form `data` onto the right `Node` subtype's required
fields is real work nothing currently exercises (accept-then-edit via
steering is the only creation path actually wired today, per
`steering_service.py`'s docstring) - left as a known gap rather than a
half-built guess. `replace` is likewise not built, same rationale.

Every mutating method here re-`add()`s the node after editing it in place.
`NodeRepository.get()` is documented `-> Node | None` with no promise of
object identity across calls, and `SqliteNodeRepository.get()` in
particular deserializes a brand-new instance from a JSON column on every
call - mutating that instance does nothing the next `get()` will see.
`add()` is keyed `(project_id, node_id)` and upserts (`ON CONFLICT ... DO
UPDATE`, see `sqlite_backend.py::_append_many`) on both the SQLite and
in-memory backends, so calling it again here is the actual save - skipping
it silently drops the edit against the real (SQLite) backend even though
the in-memory test double's shared-reference semantics make it look like
it worked.
"""

from datetime import datetime
from typing import Any

from bluebox.modules.governance.domain.node_validation import ValidationResult, validate_node
from bluebox.modules.governance.llm import agents as governance_agents
from bluebox.modules.governance.llm.requests import NodeEnrichmentRequest
from bluebox.modules.governance.llm.responses import EnrichResult
from bluebox.shared_kernel.domain.node import Node
from bluebox.shared_kernel.ports import NodeRepository

# Fields no `data` payload (generic edit or defer) may overwrite - identity
# and provenance are set once at commit time, never via this path.
_IMMUTABLE_FIELDS = {"node_id", "node_type", "provenance", "created_at", "created_by", "version"}


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
        self._nodes.add(project_id, node)
        return node

    def restore(self, project_id: str, node_id: str) -> Node:
        node = self.get(project_id, node_id)
        node.restore()
        self._nodes.add(project_id, node)
        return node

    def validate(self, project_id: str, node_id: str) -> ValidationResult:
        """doc/prd.md SS4.4 CRUDNodeService.Validate; doc/api_event_contract.md
        SS5.1 `POST /nodes/{node_id}/validate`."""

        return validate_node(self.get(project_id, node_id))

    def update(
        self,
        project_id: str,
        node_id: str,
        data: dict[str, Any],
        *,
        change_rationale: str | None = None,
    ) -> Node:
        """doc/api_event_contract.md SS5.1 `PUT /nodes/{node_id}` -
        `UpdateNodeRequest`. Generic field-by-field edit (Node Editor "Save
        Changes", Bulk Fix Wizard's "Defer All", Completeness Gate's "Defer
        with rationale"); `source` is accepted by the contract DTO but
        carries no behavior here - nothing yet distinguishes a `user_edit`
        from a `steering`/`enrichment`-sourced update.

        `data.status == "DEFERRED"` routes through `Node.defer()` instead of
        a raw `setattr` so its rationale-required invariant still holds -
        `change_rationale` (not part of `data`) supplies it. Every other key
        is applied as-is to whatever attribute shares its name; unknown
        keys are silently ignored (mirrors `enrich`'s `hasattr` guard)
        rather than raising, since editor forms send a few fields no Node
        subtype declares (e.g. a draft's transient UI-only state).
        """

        node = self.get(project_id, node_id)
        remaining = dict(data)

        if remaining.get("status") == "DEFERRED" and node.status != "DEFERRED":
            if not change_rationale or not change_rationale.strip():
                raise ValueError("deferring a node requires a non-empty change_rationale")
            node.defer(change_rationale)
            del remaining["status"]

        for field_name, value in remaining.items():
            if field_name in _IMMUTABLE_FIELDS:
                continue
            if hasattr(node, field_name):
                setattr(node, field_name, value)

        node.version += 1
        node.updated_at = datetime.now()
        self._nodes.add(project_id, node)
        return node

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

        Regression: this used to hand the model only `{name, description}`
        regardless of *why* enrichment was requested, so "AI Auto-Fix" on a
        node failing e.g. "Preconditions must define at least one
        precondition" would enrich `description` (the only field it had
        any context on) and leave `preconditions` - the actual reported
        problem - untouched. When the caller doesn't name explicit
        `fields_to_enrich`, default to whatever's currently failing
        validation, and give the model each such field's live (typically
        empty) value plus the validation message explaining what's wrong
        with it - see `_NODE_ENRICHMENT_PROMPT`.
        """

        node = self.get(project_id, node_id)
        validation = validate_node(node)
        failing_field_paths = [e.field_path for e in validation.errors]
        target_fields = fields_to_enrich if fields_to_enrich is not None else (failing_field_paths or None)

        current_data: dict[str, Any] = {"name": node.name, "description": node.description}
        for field_path in target_fields or []:
            if hasattr(node, field_path):
                current_data[field_path] = getattr(node, field_path)
        if validation.errors:
            current_data["validation_errors"] = [
                {"field_path": e.field_path, "message": e.message} for e in validation.errors
            ]

        result = await governance_agents.enrich_node(
            NodeEnrichmentRequest(
                node_id=node_id,
                node_type=node.node_type,
                current_data=current_data,
                enrichment_type=enrichment_type,  # type: ignore[arg-type]
                selected_suggestions=selected_suggestions,
                fields_to_enrich=target_fields,
            )
        )

        for field_name, change in result.enriched_fields.items():
            if hasattr(node, field_name):
                setattr(node, field_name, change.after)

        node.enrich()
        self._nodes.add(project_id, node)
        return node, result
