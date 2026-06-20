"""Stage candidate generation - doc/prd.md SS4.2 Stage Executors 1-6.

Stage 0 (seed) is `OnboardingService.submit_seed_dialogue`; Stage 7
(completeness gate) is rule-based, not generative (a future pass); Stage 9
(runtime) executes rather than generates - none of those three are handled
here.
"""

from typing import Any

from bluebox.modules.core_pipeline.llm import agents as stage_agents
from bluebox.modules.core_pipeline.llm.requests import (
    ActorGenerationRequest,
    CapabilityGenerationRequest,
    ConfirmedNodeRef,
    EngineeringTaskGenerationRequest,
    IdeationRequest,
    TechStackSummary,
    UseCaseGenerationRequest,
    UserStoryGenerationRequest,
)
from bluebox.modules.input_processing.llm.responses import Stage0Seed
from bluebox.shared_kernel.domain.node import Node
from bluebox.shared_kernel.ports import NodeRepository, SessionRepository

_DEFAULT_TECH_STACK = TechStackSummary(
    frontend_framework="React", backend_framework="FastAPI", database="PostgreSQL"
)


def _node_refs(nodes: list[Node]) -> list[ConfirmedNodeRef]:
    return [
        ConfirmedNodeRef(node_id=node.node_id, name=node.name, description=node.description)
        for node in nodes
    ]


class StageService:
    def __init__(self, nodes: NodeRepository, sessions: SessionRepository) -> None:
        self._nodes = nodes
        self._sessions = sessions

    async def run_stage(
        self,
        project_id: str,
        stage: int,
        *,
        context: str = "",
        seed: Stage0Seed | None = None,
        tech_stack: TechStackSummary | None = None,
    ) -> Any:
        orchestrator = self._sessions.get_or_create(project_id)
        orchestrator.transition("STREAMING_CHUNKS", reason=f"generating stage {stage} candidates")
        self._sessions.save(project_id, orchestrator)

        result = await self._generate(project_id, stage, context=context, seed=seed, tech_stack=tech_stack)

        orchestrator.transition("AWAITING_STEERING", reason=f"stage {stage} draft ready")
        self._sessions.save(project_id, orchestrator)
        return result

    async def _generate(
        self,
        project_id: str,
        stage: int,
        *,
        context: str,
        seed: Stage0Seed | None,
        tech_stack: TechStackSummary | None,
    ) -> Any:
        if stage == 1:
            if seed is None:
                raise ValueError("stage 1 (ideation) requires a Stage0Seed")
            return await stage_agents.generate_ideation_options(IdeationRequest(seed=seed))

        if stage == 2:
            existing_actors = _node_refs(self._nodes.list_by_stage(project_id, 2))
            return await stage_agents.generate_actors(
                ActorGenerationRequest(context=context, existing_actors=existing_actors)
            )

        if stage == 3:
            actors = _node_refs(self._nodes.list_by_stage(project_id, 2))
            return await stage_agents.generate_capabilities(
                CapabilityGenerationRequest(confirmed_actors=actors, context=context)
            )

        if stage == 4:
            capabilities = _node_refs(self._nodes.list_by_stage(project_id, 3))
            actors = _node_refs(self._nodes.list_by_stage(project_id, 2))
            return await stage_agents.generate_use_cases(
                UseCaseGenerationRequest(confirmed_capabilities=capabilities, actors=actors)
            )

        if stage == 5:
            use_cases = _node_refs(self._nodes.list_by_stage(project_id, 4))
            return await stage_agents.generate_user_stories(
                UserStoryGenerationRequest(confirmed_use_cases=use_cases)
            )

        if stage == 6:
            stories = _node_refs(self._nodes.list_by_stage(project_id, 5))
            return await stage_agents.generate_engineering_tasks(
                EngineeringTaskGenerationRequest(
                    confirmed_stories=stories, tech_stack=tech_stack or _DEFAULT_TECH_STACK
                )
            )

        raise ValueError(f"no stage executor for stage {stage}")
