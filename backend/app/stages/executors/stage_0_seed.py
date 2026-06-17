"""Stage 0 — Seed: extracts problem statement, project name, and domain signals."""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator

from app.domain.models import ProjectBlueprint, StreamChunk
from app.llm.client import LLMClientInterface
from app.stages.base import BaseStageExecutor

logger = logging.getLogger(__name__)


class Stage0SeedExecutor(BaseStageExecutor):
    """Extract problem statement and initial context from user input."""

    def __init__(self, llm_client: LLMClientInterface) -> None:
        super().__init__(stage_id=0, stage_name="seed", llm_client=llm_client)

    async def build_prompt(self, blueprint: ProjectBlueprint, context: dict) -> str:
        user_input = context.get("user_input", "")
        return f"""Analyze the following project description and extract:
1. A concise problem statement
2. Suggested project name
3. Initial domain signals (scale, tech, compliance hints)

Project description:
{user_input}

Respond as JSON:
{{
  "problem_statement": "...",
  "project_name": "...",
  "domain_signals": {{"scale": "...", "tech_hints": [], "compliance_hints": []}}
}}"""

    async def execute(self, blueprint: ProjectBlueprint, context: dict) -> AsyncIterator[StreamChunk]:
        prompt = await self.build_prompt(blueprint, context)
        response = self.llm_client.complete_stream(prompt)
        buffer: list[str] = []
        async for token in response:
            buffer.append(token)
            text = "".join(buffer)
            if self._is_json_complete(text):
                try:
                    data = json.loads(text)
                    yield StreamChunk(
                        stage_id=self.stage_id,
                        node_type="seed",
                        node_data=data,
                        index_in_stage=0,
                    )
                except json.JSONDecodeError:
                    continue

    async def finalize(self, blueprint: ProjectBlueprint, chunks: list[StreamChunk]) -> ProjectBlueprint:
        """Apply seed data to the blueprint."""
        if chunks:
            data = chunks[0].node_data
            blueprint.project_name = data.get("project_name", blueprint.project_name)
            blueprint.problem_statement = data.get("problem_statement", blueprint.problem_statement)
            domain_signals = data.get("domain_signals", {})
            if domain_signals:
                blueprint.custom_annotations.append({"stage": 0, "domain_signals": domain_signals})
        return blueprint
