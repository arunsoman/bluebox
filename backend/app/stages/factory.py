"""Stage executor factory — creates the right executor for each pipeline stage."""

from __future__ import annotations

from typing import TYPE_CHECKING

from app.stages.base import BaseStageExecutor

if TYPE_CHECKING:
    from app.llm.client import LLMClientInterface

_IMPORT_MAP: dict[int, str] = {
    0: "app.stages.executors.stage_0_seed.Stage0SeedExecutor",
    1: "app.stages.executors.stage_1_ideation.Stage1IdeationExecutor",
    2: "app.stages.executors.stage_2_actor.Stage2ActorExecutor",
    3: "app.stages.executors.stage_3_capability.Stage3CapabilityExecutor",
    4: "app.stages.executors.stage_4_usecase.Stage4UseCaseExecutor",
    5: "app.stages.executors.stage_5_story.Stage5StoryExecutor",
    6: "app.stages.executors.stage_6_task.Stage6TaskExecutor",
    7: "app.stages.executors.stage_7_final.Stage7FinalizationExecutor",
}


class StageExecutorFactory:
    """Factory for creating stage executors."""

    def __init__(self, llm_client: LLMClientInterface) -> None:
        self.llm_client = llm_client
        self._stage_map: dict[int, type[BaseStageExecutor]] = {}

    def _resolve(self, stage_id: int) -> type[BaseStageExecutor]:
        """Lazy-import the executor class for *stage_id*."""
        if stage_id in self._stage_map:
            return self._stage_map[stage_id]

        module_path, _, class_name = _IMPORT_MAP[stage_id].rpartition(".")
        module = __import__(module_path, fromlist=[class_name])
        cls = getattr(module, class_name)
        self._stage_map[stage_id] = cls
        return cls

    def get_executor(self, stage_id: int) -> BaseStageExecutor:
        """Return a configured executor for the given stage."""
        if stage_id not in _IMPORT_MAP:
            raise ValueError(f"Unknown stage: {stage_id}")
        executor_cls = self._resolve(stage_id)
        return executor_cls(llm_client=self.llm_client)

    def get_all_stages(self) -> list[int]:
        """Return a sorted list of all registered stage IDs."""
        return sorted(_IMPORT_MAP.keys())
