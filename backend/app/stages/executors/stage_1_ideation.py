"""Stage 1 — Ideation executor."""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator

from app.domain.models import ProjectBlueprint, StreamChunk
from app.llm.client import LLMClientInterface
from app.stages.base import BaseStageExecutor

logger = logging.getLogger(__name__)


class Stage1IdeationExecutor(BaseStageExecutor):
    """Stage 1 — Ideation."""

    def __init__(self, llm_client: LLMClientInterface) -> None:
        super().__init__(stage_id=1, stage_name="ideation", llm_client=llm_client)

    async def build_prompt(self, blueprint: ProjectBlueprint, context: dict) -> str:
        return f"""Execute stage 1 (ideation) for the project.

Project: {blueprint.project_name}
Problem: {blueprint.problem_statement}

Respond as JSON with appropriate node data."""

    async def execute(self, blueprint: ProjectBlueprint, context: dict) -> AsyncIterator[StreamChunk]:
        prompt = await self.build_prompt(blueprint, context)
        response = await self.llm_client.complete(prompt)
        try:
            data = json.loads(response)
            if isinstance(data, list):
                for idx, item in enumerate(data):
                    yield StreamChunk(
                        stage_id=self.stage_id,
                        node_type="ideation",
                        node_data=item,
                        index_in_stage=idx,
                    )
            else:
                yield StreamChunk(
                    stage_id=self.stage_id,
                    node_type="ideation",
                    node_data=data,
                    index_in_stage=0,
                )
        except json.JSONDecodeError:
            yield StreamChunk(
                stage_id=self.stage_id,
                node_type="ideation",
                node_data={"raw_response": response},
                index_in_stage=0,
            )
