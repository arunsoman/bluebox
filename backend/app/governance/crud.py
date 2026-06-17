"""CRUDNodeService — wraps node mutations in ProposedChange objects."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING
from uuid import uuid4

from app.domain.models import CRUDNodeAction, ProposedChange
from app.graph.dag import DependencyGraphService

if TYPE_CHECKING:
    from app.governance.revision import RevisionEngine


class CRUDNodeService:
    """Handles node CRUD operations.

    Every mutation is wrapped in a :class:`ProposedChange` and routed
    through the :class:`RevisionEngine`.  Changes are **not** persisted
    immediately — they await user consent via the 4-step revision loop.
    """

    def __init__(
        self,
        revision_engine: RevisionEngine,
        graph_service: DependencyGraphService,
    ) -> None:
        self.revision = revision_engine
        self.graph = graph_service

    async def apply(
        self,
        action: CRUDNodeAction,
        node_type: str,
        node_id: str | None = None,
        data: dict | None = None,
    ) -> ProposedChange:
        """Create a *ProposedChange* and submit it to the revision engine."""
        change = ProposedChange(
            change_id=str(uuid4()),
            action=action.value if isinstance(action, CRUDNodeAction) else action,
            node_type=node_type,
            node_id=node_id,
            node_data=data or {},
            timestamp=datetime.now(timezone.utc),
        )
        # Do not save immediately — route through RevisionEngine
        await self.revision.submit(change)
        return change
