"""PipelineService -- main use case orchestrator for the collaborative pipeline.

Coordinates between input processing, stage runners, steering, and session
lifecycle. Delegates all domain operations to the SteeringOrchestrator and
specialized services.
"""
from __future__ import annotations

from typing import Any

from domain.models import (
    PipelineSessionDTO,
    RichnessClassification,
    RawUserInput,
    SteeringActionDTO,
    AuthorizationGrantDTO,
    PipelineStatus,
    StageName,
)
from domain.steering.steering_orchestrator import SteeringOrchestrator
from domain.state_management.pipeline_state import PipelineStateManager
from domain.state_management.session_lifecycle_manager import SessionLifecycleManager
from domain.state_management.checkpoint_manager import CheckpointManager
from infrastructure.messaging.sse_manager import sse_manager


class PipelineService:
    """Main application service for pipeline lifecycle management.

    Provides a clean interface for the REST controller to manage the full
    pipeline flow: start, submit input, steer, save/resume, etc.
    """

    def __init__(
        self,
        orchestrator: SteeringOrchestrator | None = None,
        state_manager: PipelineStateManager | None = None,
        lifecycle_manager: SessionLifecycleManager | None = None,
        checkpoint_manager: CheckpointManager | None = None,
    ):
        self._orchestrator = orchestrator or SteeringOrchestrator()
        self._state = state_manager or PipelineStateManager()
        self._lifecycle = lifecycle_manager or SessionLifecycleManager()
        self._checkpoints = checkpoint_manager or CheckpointManager()

    # ------------------------------------------------------------------ #
    # Pipeline Lifecycle
    # ------------------------------------------------------------------ #

    async def start_pipeline(self, user_id: str, project_name: str | None = None) -> PipelineSessionDTO:
        """Start a new pipeline session for a user.

        Args:
            user_id: The user starting the pipeline.
            project_name: Optional project name.

        Returns:
            The newly created PipelineSessionDTO.
        """
        return await self._orchestrator.start_pipeline(user_id, project_name)

    async def submit_input(self, session_id: str, text: str, source: str = "chat") -> RichnessClassification:
        """Submit raw user input and classify richness.

        Args:
            session_id: Pipeline session ID.
            text: The raw input text.
            source: Input source (chat, file_upload, api).

        Returns:
            RichnessClassification result.
        """
        raw_input = RawUserInput(text=text, source=source)  # type: ignore[arg-type]
        return await self._orchestrator.submit_input(session_id, raw_input)

    async def run_next_stage(self, session_id: str) -> dict[str, Any]:
        """Run the next stage in the pipeline.

        Determines the next stage from the current session state and runs it.

        Args:
            session_id: Pipeline session ID.

        Returns:
            Stage output dict.
        """
        session = await self._state.get_session(session_id)
        current = session.current_stage

        # Determine next stage
        stage_order = [
            StageName.PRD_ANALYSIS,
            StageName.IDEATION,
            StageName.ACTOR_DISCOVERY,
            StageName.CAPABILITY_DISCOVERY,
            StageName.USE_CASE_DISCOVERY,
            StageName.STORY_DISCOVERY,
            StageName.TASK_DECOMPOSITION,
        ]

        if current is None:
            next_stage = StageName.PRD_ANALYSIS
        else:
            try:
                idx = stage_order.index(current)
                next_stage = stage_order[idx + 1] if idx + 1 < len(stage_order) else None
            except ValueError:
                next_stage = StageName.PRD_ANALYSIS

        if next_stage is None:
            return {"status": "completed", "message": "All stages completed"}

        return await self._orchestrator.run_stage(session_id, next_stage)

    async def handle_steering_action(self, session_id: str, action: SteeringActionDTO) -> dict[str, Any]:
        """Handle a steering action from the user.

        Args:
            session_id: Pipeline session ID.
            action: The steering action DTO.

        Returns:
            Action result dict.
        """
        return await self._orchestrator.handle_steering_action(session_id, action)

    async def get_state(self, session_id: str) -> PipelineSessionDTO:
        """Get the current pipeline session state.

        Args:
            session_id: Pipeline session ID.

        Returns:
            PipelineSessionDTO with current state.
        """
        return await self._state.get_session(session_id)

    # ------------------------------------------------------------------ #
    # Authorization
    # ------------------------------------------------------------------ #

    async def authorize(self, session_id: str, scope: AuthorizationGrantDTO) -> dict[str, Any]:
        """Grant authorization scope for a session.

        Args:
            session_id: Pipeline session ID.
            scope: The authorization grant DTO.

        Returns:
            Confirmation dict.
        """
        return await self._orchestrator.authorize(session_id, scope)

    # ------------------------------------------------------------------ #
    # Save / Resume
    # ------------------------------------------------------------------ #

    async def save_and_exit(self, session_id: str) -> dict[str, Any]:
        """Save the session state and suspend (save-and-exit).

        Args:
            session_id: Pipeline session ID.

        Returns:
            Dict with suspend info.
        """
        suspend_dto = await self._orchestrator.save_and_exit(session_id)
        return {
            "status": "suspended",
            "session_id": suspend_dto.session_id,
            "checkpoint_id": suspend_dto.checkpoint_id,
            "suspended_at": suspend_dto.suspended_at.isoformat(),
        }

    async def resume_session(self, session_id: str) -> PipelineSessionDTO:
        """Resume a previously suspended session.

        Args:
            session_id: Pipeline session ID.

        Returns:
            Updated PipelineSessionDTO.
        """
        return await self._orchestrator.resume_session(session_id)

    # ------------------------------------------------------------------ #
    # Session Queries
    # ------------------------------------------------------------------ #

    async def list_sessions(self, user_id: str) -> list[PipelineSessionDTO]:
        """List all pipeline sessions for a user.

        Args:
            user_id: The user ID.

        Returns:
            List of PipelineSessionDTOs, newest first.
        """
        return await self._state.list_sessions(user_id)
