"""Stage 7 — Finalization: validates blueprint completeness and blocks export if incomplete."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator

from app.domain.models import (
    CompletenessReport,
    DeferredArtifact,
    ProjectBlueprint,
    StreamChunk,
)
from app.llm.client import LLMClientInterface
from app.stages.base import BaseStageExecutor

logger = logging.getLogger(__name__)


class Stage7FinalizationExecutor(BaseStageExecutor):
    """Validate blueprint completeness. Block export if incomplete."""

    MANDATORY_FIELDS = [
        "problem_statement",
        "actors",
        "capabilities",
        "use_cases",
        "user_stories",
        "task_decomposition",
    ]

    def __init__(self, llm_client: LLMClientInterface) -> None:
        super().__init__(stage_id=7, stage_name="finalization", llm_client=llm_client)

    async def build_prompt(self, blueprint: ProjectBlueprint, context: dict) -> str:
        return f"""Review the following project blueprint and provide a completeness assessment.

Project: {blueprint.project_name}
Problem: {blueprint.problem_statement}
Actors: {len(blueprint.actors)}
Capabilities: {len(blueprint.capabilities)}
Use Cases: {len(blueprint.use_cases)}
User Stories: {len(blueprint.user_stories)}
Tasks: {len(blueprint.task_decomposition)}

Respond as JSON:
{{
  "assessment": "brief assessment text",
  "recommendations": ["recommendation 1", "recommendation 2"]
}}"""

    async def execute(self, blueprint: ProjectBlueprint, context: dict) -> AsyncIterator[StreamChunk]:
        report = self._check_completeness(blueprint)
        blueprint.completeness_report = report
        blueprint.completeness_status = "complete" if report.is_complete else "incomplete"

        yield StreamChunk(
            stage_id=self.stage_id,
            node_type="completeness_report",
            node_data=report.model_dump(),
            index_in_stage=0,
        )

    def _check_completeness(self, blueprint: ProjectBlueprint) -> CompletenessReport:
        """Evaluate the blueprint against mandatory fields."""
        filled = 0
        deferred: list[str] = []
        missing: list[str] = []

        for field in self.MANDATORY_FIELDS:
            value = getattr(blueprint, field, None)
            if isinstance(value, DeferredArtifact):
                deferred.append(field)
                filled += 1
            elif isinstance(value, list) and len(value) > 0:
                filled += 1
            elif isinstance(value, list) and len(value) == 0:
                missing.append(field)
            elif value:  # non-list truthy value (e.g. non-empty string)
                filled += 1
            else:  # falsy non-list (e.g. empty string, None)
                missing.append(field)

        is_complete = len(missing) == 0

        return CompletenessReport(
            total_fields=len(self.MANDATORY_FIELDS),
            filled_fields=filled,
            deferred_fields=deferred,
            missing_mandatory=missing,
            is_complete=is_complete,
        )

    async def finalize(self, blueprint: ProjectBlueprint, chunks: list[StreamChunk]) -> ProjectBlueprint:
        """Enforce the completeness gate — block export if blueprint is incomplete."""
        if blueprint.completeness_report and not blueprint.completeness_report.is_complete:
            missing = blueprint.completeness_report.missing_mandatory
            logger.warning(
                "Stage 7 gate: blueprint incomplete — missing mandatory fields: %s",
                missing,
            )
            raise CompletenessGateError(
                f"Blueprint export blocked — missing fields: {missing}"
            )
        logger.info("Stage 7 gate: blueprint is complete, export allowed")
        return blueprint
