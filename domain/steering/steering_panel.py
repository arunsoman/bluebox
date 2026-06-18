"""SteeringPanelBuilder — constructs and modifies steering panels for user review.

The panel is the primary interface between the pipeline and the human operator.
It packages draft outputs, options, and rendering policy into a single
presentable structure that the SSE stream delivers to the frontend.
"""
from __future__ import annotations

from typing import Any

from domain.models import (
    StageName,
    SteeringOption,
    SteeringPanel,
    SteeringPanelRenderPolicy,
    ContextWindowInfo,
)


class SteeringPanelBuilder:
    """Builds and mutates SteeringPanel instances.

    The builder is stateless — each method takes a panel and returns
    a modified copy (or a new instance) so that the caller controls
    mutability.
    """

    def build(
        self,
        stage: StageName,
        draft_output: dict[str, Any],
        options: list[SteeringOption],
        render_policy: SteeringPanelRenderPolicy | None = None,
    ) -> SteeringPanel:
        """Assemble a new SteeringPanel for the given stage.

        Args:
            stage: The pipeline stage that produced the draft output.
            draft_output: The raw draft (e.g. actors, capabilities, use-cases)
                that needs human confirmation or steering.
            options: Steering options presented to the user (ACCEPT, MODIFY, etc.).
            render_policy: Optional custom render policy. Defaults to summary mode.

        Returns:
            A fully populated SteeringPanel ready for SSE emission.
        """
        if render_policy is None:
            total_nodes = self._count_nodes(draft_output)
            total_pages = max(1, (total_nodes + 19) // 20)
            render_policy = SteeringPanelRenderPolicy(
                mode="summary",
                page=1,
                total_pages=total_pages,
                total_nodes=total_nodes,
                nodes_per_page=20,
            )

        return SteeringPanel(
            stage=stage.value,
            draft_output=draft_output,
            options=options,
            render_policy=render_policy,
            context_window=ContextWindowInfo(),
        )

    def add_option(self, panel: SteeringPanel, option: SteeringOption) -> SteeringPanel:
        """Append a new steering option to the panel (e.g. a user-created custom option).

        Returns a *new* panel instance with the option added.
        """
        new_options = list(panel.options)
        new_options.append(option)
        return panel.model_copy(update={"options": new_options})

    def apply_modification(
        self,
        panel: SteeringPanel,
        node_id: str,
        changes: dict[str, Any],
    ) -> SteeringPanel:
        """Apply in-place modifications to a node inside the draft output.

        Args:
            panel: The current panel.
            node_id: Identifier of the node to modify within draft_output.
            changes: Key-value pairs to merge into the node.

        Returns:
            A new panel with the modification applied to draft_output.
        """
        new_draft = self._deep_merge_node(panel.draft_output, node_id, changes)
        return panel.model_copy(update={"draft_output": new_draft})

    # ------------------------------------------------------------------ #
    # Helpers
    # ------------------------------------------------------------------ #

    @staticmethod
    def _count_nodes(draft_output: dict[str, Any]) -> int:
        """Count presentable nodes in draft_output for pagination.

        Handles common output shapes: lists under keys like "actors",
        "capabilities", "use_cases", etc.
        """
        total = 0
        for key, value in draft_output.items():
            if isinstance(value, list):
                total += len(value)
            elif isinstance(value, dict):
                total += 1
            else:
                total += 1
        return total

    @staticmethod
    def _deep_merge_node(
        draft: dict[str, Any], node_id: str, changes: dict[str, Any]
    ) -> dict[str, Any]:
        """Recursively find a node by its ``node_id`` key and merge changes."""
        import copy

        draft = copy.deepcopy(draft)
        for key, value in draft.items():
            if isinstance(value, list):
                for item in value:
                    if isinstance(item, dict) and item.get("id") == node_id:
                        item.update(changes)
                        return draft
                    if isinstance(item, dict):
                        for sub_key, sub_val in item.items():
                            if isinstance(sub_val, list):
                                for sub_item in sub_val:
                                    if (
                                        isinstance(sub_item, dict)
                                        and sub_item.get("id") == node_id
                                    ):
                                        sub_item.update(changes)
                                        return draft
            elif isinstance(value, dict):
                if value.get("id") == node_id:
                    value.update(changes)
                    return draft
                # Recurse one level into nested dicts
                for sub_key, sub_val in value.items():
                    if isinstance(sub_val, list):
                        for item in sub_val:
                            if isinstance(item, dict) and item.get("id") == node_id:
                                item.update(changes)
                                return draft
        return draft
