"""SteeringPanelRenderPolicy — controls how draft output is presented to users.

All rendering paths target sub-second latency:
  * summary_view  < 500 ms  (card-per-node)
  * detail_view   < 1 s     (full expansion)
  * paginate      < 50 ms   (slice)
"""
from __future__ import annotations

from typing import Any

from domain.models import (
    SteeringPanelRenderPolicy,
)


class SteeringPanelRenderPolicyApp:
    """Application logic for the SteeringPanelRenderPolicy model.

    This class is a mixin-style service that operates on the raw policy
    model (``SteeringPanelRenderPolicy``) and a list of nodes.  It does
    not hold its own state — every method is a pure function taking the
    policy and node list as arguments.
    """

    DEFAULT_NODES_PER_PAGE: int = 20
    SUMMARY_TARGET_MS: int = 500
    DETAIL_TARGET_MS: int = 1000

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #

    @classmethod
    def paginate(
        cls,
        nodes: list[dict[str, Any]],
        page: int,
        nodes_per_page: int | None = None,
    ) -> list[dict[str, Any]]:
        """Return a single page of nodes (default 20 per page).

        Args:
            nodes: Full flat list of node dicts.
            page: 1-based page number.
            nodes_per_page: Override the default 20.

        Returns:
            Sliced list of nodes for the requested page.
        """
        per_page = nodes_per_page or cls.DEFAULT_NODES_PER_PAGE
        start = (page - 1) * per_page
        end = start + per_page
        return nodes[start:end]

    @classmethod
    def paginate_with_policy(
        cls,
        nodes: list[dict[str, Any]],
        policy: SteeringPanelRenderPolicy,
    ) -> list[dict[str, Any]]:
        """Paginate using the page stored inside a policy instance."""
        return cls.paginate(nodes, policy.page, policy.nodes_per_page)

    @classmethod
    def summary_view(
        cls,
        nodes: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Produce a card-per-node summary (< 500 ms target).

        Each card contains: id, type, label, key fields, confidence,
        and a ``has_detail`` flag so the UI knows whether to offer an
        expansion action.
        """
        cards: list[dict[str, Any]] = []
        for node in nodes:
            card = cls._build_card(node)
            cards.append(card)
        return cards

    @classmethod
    def detail_view(
        cls,
        node: dict[str, Any],
    ) -> dict[str, Any]:
        """Produce a full expansion of a single node (< 1 s target).

        Returns the node as-is plus computed display metadata (field
        count, relation count, etc.).
        """
        return {
            **node,
            "_meta": {
                "field_count": len(node),
                "has_relations": any(
                    k.endswith("_id") or k in ("dependencies", "children", "related")
                    for k in node.keys()
                ),
                "render_mode": "detail",
            },
        }

    @classmethod
    def build_policy_for_nodes(
        cls,
        nodes: list[dict[str, Any]],
        mode: str = "summary",
        page: int = 1,
        nodes_per_page: int | None = None,
    ) -> SteeringPanelRenderPolicy:
        """Create a policy instance sized for the given node list."""
        per_page = nodes_per_page or cls.DEFAULT_NODES_PER_PAGE
        total = len(nodes)
        total_pages = max(1, (total + per_page - 1) // per_page)
        return SteeringPanelRenderPolicy(
            mode=mode,  # type: ignore[arg-type]
            page=page,
            total_pages=total_pages,
            total_nodes=total,
            nodes_per_page=per_page,
        )

    # ------------------------------------------------------------------ #
    # Internals
    # ------------------------------------------------------------------ #

    @staticmethod
    def _build_card(node: dict[str, Any]) -> dict[str, Any]:
        """Build a summary card from a node dict."""
        node_type = node.get("type", node.get("node_type", "unknown"))
        label = (
            node.get("name")
            or node.get("label")
            or node.get("title")
            or node.get("story_text", "")
            or node.get("id", "untitled")
        )
        confidence = node.get("confidence", None)
        traceability = node.get("traceability", None)

        # Include a small set of key fields for the card
        key_fields = {
            k: v
            for k, v in node.items()
            if k not in ("id", "type", "node_type", "name", "label", "title")
            and not k.startswith("_")
            and v is not None
        }
        # Limit key fields to keep cards small and fast
        if len(key_fields) > 6:
            key_fields = dict(list(key_fields.items())[:6])

        return {
            "id": node.get("id", ""),
            "type": node_type,
            "label": label,
            "key_fields": key_fields,
            "confidence": confidence,
            "traceability": traceability,
            "has_detail": len(node) > 4,
        }
