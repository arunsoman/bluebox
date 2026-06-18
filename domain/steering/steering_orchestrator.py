"""SteeringOrchestrator — main conductor of the Collaborative Steering Pipeline.

Manages the pipeline state machine (IDLE → RUNNING → PAUSED → COMPLETED)
and coordinates steering actions, decision logging, checkpoint management,
revision handling, and audit trail recording.

The orchestrator delegates to specialized services:
  * PipelineStateManager      — session CRUD, state updates
  * DecisionLedgerService     — append-only decision log
  * AuditTrail                — TimescaleDB audit events
  * CheckpointManager         — S3 checkpoint snapshots
  * SessionLifecycleManager   — suspend, resume, expiry
  * SteeringPanelBuilder      — panel construction
  * UserOptionValidator       — custom option validation
  * RevisionEngine            — revision initiation, impact analysis
  * PropagationRunner         — revision propagation execution
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from domain.models import (
    RawUserInput,
    RichnessClassification,
    SteeringActionDTO,
    SteeringActionType,
    SteeringOption,
    SteeringPanel,
    SteeringPanelRenderPolicy,
    StageName,
    PipelineStatus,
    PipelineSessionDTO,
    SessionSuspendDTO,
    DecisionEntry,
    DecisionMaker,
    DecisionStatus,
    AuthorizationGrantDTO,
    AuthorizationScope,
    AuthorizationScopeType,
    UserOptionIncoherent,
    AuditEvent,
    AuditActor,
    AuditTarget,
    AuditActionType,
    AuditActorType,
    StorageStrategy,
    ContextWindowInfo,
)
from domain.steering.steering_panel import SteeringPanelBuilder
from domain.steering.user_option_validator import UserOptionValidator
from domain.steering.steering_panel_render_policy import SteeringPanelRenderPolicyApp
from domain.decision_management.decision_ledger import DecisionLedgerService
from domain.decision_management.revision_engine import RevisionEngine
from domain.decision_management.propagation_runner import PropagationRunner
from domain.state_management.pipeline_state import PipelineStateManager
from domain.state_management.checkpoint_manager import CheckpointManager
from domain.state_management.session_lifecycle_manager import SessionLifecycleManager
from domain.audit.audit_trail import AuditTrail
from infrastructure.messaging.sse_manager import sse_manager


# ------------------------------------------------------------------ #
# Stage execution abstraction
# ------------------------------------------------------------------ #

class BaseStage:
    """Abstract base for pipeline stages.

    Each stage receives the session ID and current state, performs its
    work (typically LLM-driven), produces a draft output, and returns it
    for steering panel presentation.
    """

    stage_name: StageName

    async def run(self, session_id: str, state: dict[str, Any]) -> dict[str, Any]:
        """Execute the stage. Returns draft output dict."""
        raise NotImplementedError


class SteeringOrchestrator:
    """Main conductor of the Collaborative Steering Pipeline.

    The orchestrator is stateless — all mutable state lives in
    PostgreSQL, Redis, S3, and TimescaleDB.  It coordinates the
    services and emits events via SSE.
    """

    def __init__(
        self,
        state_manager: PipelineStateManager | None = None,
        decision_ledger: DecisionLedgerService | None = None,
        audit_trail: AuditTrail | None = None,
        checkpoint_manager: CheckpointManager | None = None,
        lifecycle_manager: SessionLifecycleManager | None = None,
        panel_builder: SteeringPanelBuilder | None = None,
        option_validator: UserOptionValidator | None = None,
        revision_engine: RevisionEngine | None = None,
        propagation_runner: PropagationRunner | None = None,
    ):
        self._state = state_manager or PipelineStateManager()
        self._ledger = decision_ledger or DecisionLedgerService()
        self._audit = audit_trail or AuditTrail()
        self._checkpoints = checkpoint_manager or CheckpointManager()
        self._lifecycle = lifecycle_manager or SessionLifecycleManager()
        self._panels = panel_builder or SteeringPanelBuilder()
        self._validator = option_validator or UserOptionValidator()
        self._revision = revision_engine or RevisionEngine()
        self._propagation = propagation_runner or PropagationRunner()

        # Stage registry — populated externally or via discovery
        self._stage_registry: dict[StageName, BaseStage] = {}

    def register_stage(self, stage_name: StageName, stage: BaseStage) -> None:
        """Register a concrete stage implementation."""
        self._stage_registry[stage_name] = stage

    # ==================================================================
    # Pipeline lifecycle
    # ==================================================================

    async def start_pipeline(
        self,
        user_id: str,
        project_name: str | None = None,
    ) -> PipelineSessionDTO:
        """Start a new pipeline session.

        State machine: IDLE → RUNNING

        Args:
            user_id: The user starting the pipeline.
            project_name: Optional project name.

        Returns:
            The created PipelineSessionDTO.
        """
        dto = await self._state.create_session(user_id, project_name)
        await self._state.set_status(dto.session_id, PipelineStatus.RUNNING)

        # Refresh DTO after status update
        dto = await self._state.get_session(dto.session_id)

        # Audit
        await self._write_audit_event(
            session_id=dto.session_id,
            action=AuditActionType.PIPELINE_STARTED,
            user_id=user_id,
            after={"project_name": project_name, "status": "running"},
        )

        # Emit
        await sse_manager.emit_stage_started(dto.session_id, "pipeline")

        return dto

    async def submit_input(
        self,
        session_id: str,
        raw_input: RawUserInput,
    ) -> RichnessClassification:
        """Submit raw user input and classify richness.

        The richness classification determines which pipeline path to
        take (WELL_FORMED → full pipeline, MINIMALIST → questions,
        SEED_ONLY → seed capture).

        Args:
            session_id: Pipeline session ID.
            raw_input: The raw user input.

        Returns:
            RichnessClassification.
        """
        # Store input in state
        state = await self._state.update_state(
            session_id,
            {
                "last_input": raw_input.text,
                "input_source": raw_input.source,
                "richness_mode": raw_input.richness_mode.value,
            },
        )

        # Perform classification based on input length and content
        classification = self._classify_input(raw_input)

        # Store classification result
        await self._state.update_state(
            session_id,
            {
                "richness_classification": classification.model_dump(mode="json"),
            },
        )

        # Audit
        await self._write_audit_event(
            session_id=session_id,
            action=AuditActionType.PIPELINE_STARTED,
            after={"classification": classification.model_dump(mode="json")},
        )

        # Emit
        await sse_manager.emit_richness_mode(
            session_id,
            classification.mode.value,
            classification.confidence.value,
            classification.classification_basis,
        )

        return classification

    async def run_stage(
        self,
        session_id: str,
        stage: StageName,
    ) -> dict[str, Any]:
        """Run a pipeline stage.

        1. Set the current stage.
        2. Execute the stage via the registered BaseStage.
        3. Store the output in state.
        4. Emit stage events.

        Args:
            session_id: Pipeline session ID.
            stage: The stage to run.

        Returns:
            The stage output dict.
        """
        # Verify stage is registered
        stage_impl = self._stage_registry.get(stage)
        if stage_impl is None:
            raise RuntimeError(f"Stage {stage.value} is not registered")

        # Set current stage
        await self._state.set_current_stage(session_id, stage)
        await self._state.set_status(session_id, PipelineStatus.RUNNING)

        # Audit: stage started
        await self._write_audit_event(
            session_id=session_id,
            action=AuditActionType.STAGE_STARTED,
            after={"stage": stage.value},
        )

        # Emit
        await sse_manager.emit_stage_started(session_id, stage.value)

        # Get current state for the stage
        current_state = await self._state.get_state(session_id)

        try:
            # Execute stage
            output = await stage_impl.run(session_id, current_state)
        except Exception as exc:
            # Audit: stage failed
            await self._write_audit_event(
                session_id=session_id,
                action=AuditActionType.STAGE_FAILED,
                after={"stage": stage.value, "error": str(exc)},
            )
            await sse_manager.emit_stage_failed(session_id, stage.value, str(exc))
            raise

        # Store output in state
        stage_outputs = current_state.get("stage_outputs", {})
        stage_outputs[stage.value] = output
        await self._state.update_state(
            session_id,
            {"stage_outputs": stage_outputs, f"{stage.value}_completed": True},
        )

        # Audit: stage completed
        await self._write_audit_event(
            session_id=session_id,
            action=AuditActionType.STAGE_COMPLETED,
            after={"stage": stage.value, "output_keys": list(output.keys())},
        )

        # Emit
        await sse_manager.emit_stage_completed(session_id, stage.value)

        return output

    # ==================================================================
    # Steering actions
    # ==================================================================

    async def handle_steering_action(
        self,
        session_id: str,
        action: SteeringActionDTO,
    ) -> dict[str, Any]:
        """Handle a steering action from the user.

        Supported actions:
          * ACCEPT:            Commit draft, advance pipeline.
          * MODIFY:            Apply changes to a node, re-present panel.
          * REPLACE:           Replace output entirely, re-present panel.
          * AUTHORIZE_SYSTEM:  Grant system authorization scope.
          * REVERT:            Revert to a superseded decision.
          * CUSTOM_OPTION:     Validate and add a user-created option.

        Args:
            session_id: Pipeline session ID.
            action: The steering action DTO.

        Returns:
            Response dict with the action result.
        """
        action_type = action.action_type
        payload = action.payload

        if action_type == SteeringActionType.ACCEPT:
            return await self._handle_accept(session_id, action)

        if action_type == SteeringActionType.MODIFY:
            node_id = payload.get("node_id", "")
            changes = payload.get("changes", {})
            return await self._handle_modify(session_id, action, node_id, changes)

        if action_type == SteeringActionType.REPLACE:
            replacement = payload.get("replacement", {})
            return await self._handle_replace(session_id, action, replacement)

        if action_type == SteeringActionType.AUTHORIZE_SYSTEM:
            scope_type_str = payload.get("scope_type", "single")
            stage_range = payload.get("stage_range")
            grant = AuthorizationGrantDTO(
                session_id=session_id,
                scope_type=AuthorizationScopeType(scope_type_str),
                stage_range=stage_range,
            )
            return await self.authorize(session_id, grant)

        if action_type == SteeringActionType.REVERT:
            decision_id = payload.get("decision_id", "")
            return await self._handle_revert(session_id, decision_id)

        if action_type == SteeringActionType.CUSTOM_OPTION:
            option_data = payload.get("option", {})
            option = SteeringOption(**option_data)
            return await self._handle_custom_option(session_id, action, option)

        return {"status": "ignored", "reason": f"Action {action_type.value} not handled"}

    # ------------------------------------------------------------------ #
    # Action handlers
    # ------------------------------------------------------------------ #

    async def _handle_accept(
        self,
        session_id: str,
        action: SteeringActionDTO,
    ) -> dict[str, Any]:
        """ACCEPT: commit the draft output and log the decision."""
        # Get current state
        state = await self._state.get_state(session_id)
        stage = action.stage or state.get("current_stage", "")

        # Create decision entry
        chosen = self._extract_chosen_option(action)
        entry = DecisionEntry(
            decision_id=str(uuid.uuid4()),
            stage=stage,
            decision_point=f"{stage}:accept",
            options_presented=state.get("last_options", []),
            chosen_option=chosen,
            decision_maker=DecisionMaker.USER,
            rationale_accepted="User accepted draft",
            status=DecisionStatus.ACTIVE,
            timestamp=datetime.utcnow(),
        )
        await self._ledger.log_decision(session_id, entry)

        # Audit
        await self._write_audit_event(
            session_id=session_id,
            action=AuditActionType.STEERING_ACCEPTED,
            after={"stage": stage, "decision_id": entry.decision_id},
        )

        # Emit
        await sse_manager.emit_decision_logged(session_id, entry.model_dump(mode="json"))

        return {
            "status": "accepted",
            "decision_id": entry.decision_id,
            "stage": stage,
        }

    async def _handle_modify(
        self,
        session_id: str,
        action: SteeringActionDTO,
        node_id: str,
        changes: dict[str, Any],
    ) -> dict[str, Any]:
        """MODIFY: apply changes to a node and re-present the panel."""
        state = await self._state.get_state(session_id)
        stage = action.stage or state.get("current_stage", "")

        # Apply modification to the current panel if one exists
        current_panel_data = state.get("current_panel", {})
        if current_panel_data:
            panel = SteeringPanel(**current_panel_data)
            modified_panel = self._panels.apply_modification(panel, node_id, changes)
            await self._state.update_state(
                session_id, {"current_panel": modified_panel.model_dump(mode="json")}
            )

            # Re-emit panel
            await sse_manager.emit_panel_ready(
                session_id, modified_panel.model_dump(mode="json")
            )

        # Audit
        await self._write_audit_event(
            session_id=session_id,
            action=AuditActionType.STEERING_MODIFIED,
            before={"node_id": node_id},
            after={"node_id": node_id, "changes": changes, "stage": stage},
        )

        return {"status": "modified", "node_id": node_id, "stage": stage}

    async def _handle_replace(
        self,
        session_id: str,
        action: SteeringActionDTO,
        replacement: dict[str, Any],
    ) -> dict[str, Any]:
        """REPLACE: replace the draft output and re-present the panel."""
        state = await self._state.get_state(session_id)
        stage = action.stage or state.get("current_stage", "")

        # Update the stage output with the replacement
        stage_outputs = state.get("stage_outputs", {})
        if stage in stage_outputs:
            stage_outputs[stage] = replacement
            await self._state.update_state(session_id, {"stage_outputs": stage_outputs})

            # Rebuild panel with replacement
            options = [
                SteeringOption(
                    option_id="accept",
                    label="Accept replacement",
                    rationale="User provided replacement output",
                ),
                SteeringOption(
                    option_id="modify",
                    label="Modify further",
                    rationale="Make additional changes",
                ),
            ]
            panel = self._panels.build(
                StageName(stage) if stage else StageName.PRD_ANALYSIS,
                replacement,
                options,
            )
            await self._state.update_state(
                session_id, {"current_panel": panel.model_dump(mode="json")}
            )
            await sse_manager.emit_panel_ready(session_id, panel.model_dump(mode="json"))

        # Audit
        await self._write_audit_event(
            session_id=session_id,
            action=AuditActionType.STEERING_REPLACED,
            after={"stage": stage, "replacement_keys": list(replacement.keys())},
        )

        return {"status": "replaced", "stage": stage}

    async def authorize(
        self,
        session_id: str,
        grant: AuthorizationGrantDTO,
    ) -> dict[str, Any]:
        """AUTHORIZE_SYSTEM: grant system authorization scope.

        Creates an authorization scope record and logs the decision.

        Args:
            session_id: Pipeline session ID.
            grant: The authorization grant DTO.

        Returns:
            Confirmation dict.
        """
        scope = AuthorizationScope(
            scope_type=grant.scope_type,
            stage_range=grant.stage_range,
            granted_at=datetime.utcnow(),
        )

        # Create a decision entry for the authorization
        entry = DecisionEntry(
            decision_id=str(uuid.uuid4()),
            stage="authorization",
            decision_point=f"authorize:{grant.scope_type.value}",
            options_presented=[],
            chosen_option=None,
            decision_maker=DecisionMaker.USER,
            authorization_scope=scope,
            rationale_accepted=f"Granted {grant.scope_type.value} authorization",
            status=DecisionStatus.ACTIVE,
            timestamp=datetime.utcnow(),
        )
        await self._ledger.log_decision(session_id, entry)

        # Store authorization in session state
        state = await self._state.get_state(session_id)
        auths = state.get("authorizations", [])
        auths.append(scope.model_dump(mode="json"))
        await self._state.update_state(session_id, {"authorizations": auths})

        # Audit
        await self._write_audit_event(
            session_id=session_id,
            action=AuditActionType.STEERING_AUTHORIZATION_GRANTED,
            after={
                "scope_type": grant.scope_type.value,
                "stage_range": grant.stage_range,
            },
        )

        return {
            "status": "authorized",
            "scope_type": grant.scope_type.value,
            "stage_range": grant.stage_range,
            "decision_id": entry.decision_id,
        }

    async def _handle_revert(
        self,
        session_id: str,
        decision_id: str,
    ) -> dict[str, Any]:
        """REVERT: revert to a previously superseded decision."""
        revert_entry = await self._revision.revert_to(session_id, decision_id)

        # Audit
        await self._write_audit_event(
            session_id=session_id,
            action=AuditActionType.DECISION_REVERTED,
            after={
                "reverted_decision_id": decision_id,
                "revert_entry_id": revert_entry.decision_id,
            },
        )

        return {
            "status": "reverted",
            "reverted_decision_id": decision_id,
            "revert_entry_id": revert_entry.decision_id,
        }

    async def _handle_custom_option(
        self,
        session_id: str,
        action: SteeringActionDTO,
        option: SteeringOption,
    ) -> dict[str, Any]:
        """CUSTOM_OPTION: validate a user-created option and add it to the panel."""
        state = await self._state.get_state(session_id)
        stage_str = action.stage or state.get("current_stage", "")

        try:
            stage = StageName(stage_str)
        except ValueError:
            stage = StageName.PRD_ANALYSIS

        # Get decision ledger for validation
        ledger_dto = await self._ledger.get_entries(session_id)
        from domain.models import DecisionLedger

        ledger = DecisionLedger(
            session_id=session_id,
            entries=ledger_dto.entries,
        )

        # Validate
        validation_result = self._validator.validate(option, stage, ledger)
        if validation_result:
            return {
                "status": "invalid",
                "failure_reason": validation_result.failure_reason,
                "suggestions": validation_result.suggestions,
            }

        # Add to current panel
        current_panel_data = state.get("current_panel", {})
        if current_panel_data:
            panel = SteeringPanel(**current_panel_data)
            updated_panel = self._panels.add_option(panel, option)
            await self._state.update_state(
                session_id,
                {"current_panel": updated_panel.model_dump(mode="json")},
            )
            await sse_manager.emit_panel_ready(
                session_id, updated_panel.model_dump(mode="json")
            )

        # Audit
        await self._write_audit_event(
            session_id=session_id,
            action=AuditActionType.STEERING_MODIFIED,
            after={
                "custom_option_added": True,
                "option_id": option.option_id,
                "option_label": option.label,
                "stage": stage_str,
            },
        )

        return {
            "status": "option_added",
            "option_id": option.option_id,
            "option_label": option.label,
        }

    # ==================================================================
    # Save / resume
    # ==================================================================

    async def save_and_exit(self, session_id: str) -> SessionSuspendDTO:
        """Save the session and exit (suspend).

        1. Create a checkpoint at the current stage.
        2. Suspend the session.
        3. Emit events.

        Args:
            session_id: Pipeline session ID.

        Returns:
            SessionSuspendDTO.
        """
        session = await self._state.get_session(session_id)

        # Create checkpoint
        current_stage = session.current_stage
        stage_label = current_stage.value if current_stage else "unknown"
        checkpoint = await self._checkpoints.create_checkpoint(
            session_id,
            stage=stage_label,
            label=f"Auto-save before exit at {stage_label}",
        )

        # Suspend
        dto = await self._lifecycle.suspend(session_id)

        # Update status in state manager
        await self._state.set_status(session_id, PipelineStatus.SUSPENDED)

        return SessionSuspendDTO(
            session_id=session_id,
            status=dto.status,
            checkpoint_id=checkpoint.checkpoint_id,
            suspended_at=datetime.utcnow(),
        )

    async def resume_session(self, session_id: str) -> PipelineSessionDTO:
        """Resume a suspended session.

        1. Check expiry and re-auth requirements.
        2. Resume via lifecycle manager.
        3. Restore cached state.
        4. Emit events.

        Args:
            session_id: Pipeline session ID.

        Returns:
            The resumed PipelineSessionDTO.
        """
        # Check expiry
        is_expired = await self._lifecycle.check_expiry(session_id)
        if is_expired:
            raise RuntimeError(f"Session {session_id} has expired")

        # Resume
        dto = await self._lifecycle.resume(session_id)

        # Audit
        await self._write_audit_event(
            session_id=session_id,
            action=AuditActionType.PIPELINE_RESUMED,
            after={"status": dto.status.value, "stage": dto.current_stage.value if dto.current_stage else None},
        )

        # Emit
        await sse_manager.emit_stage_started(session_id, "pipeline_resumed")

        return dto

    # ==================================================================
    # Internal helpers
    # ==================================================================

    async def _write_audit_event(
        self,
        session_id: str,
        action: AuditActionType,
        user_id: str | None = None,
        before: dict[str, Any] | None = None,
        after: dict[str, Any] | None = None,
    ) -> None:
        """Write an audit event to the append-only trail."""
        event = AuditEvent(
            event_id=str(uuid.uuid4()),
            session_id=session_id,
            project_id=session_id,
            timestamp=datetime.utcnow(),
            actor=AuditActor(
                actor_type=AuditActorType.USER if user_id else AuditActorType.SYSTEM,
                user_id=user_id,
                session_id=session_id,
            ),
            action=action,
            target=AuditTarget(
                target_type="session",
                target_id=session_id,
                target_label="Pipeline Session",
            ),
            before_state=before or {},
            after_state=after or {},
            storage_strategy=StorageStrategy.DIFF,
        )
        await self._audit.write_event(session_id, event)

    @staticmethod
    def _classify_input(raw_input: RawUserInput) -> RichnessClassification:
        """Classify input richness based on content analysis.

        Uses input length and content heuristics.  In production this
        would be backed by an LLM call.
        """
        from domain.models import Confidence

        text = raw_input.text
        length = len(text)
        basis: list[str] = []

        # Length-based heuristics
        if length > 2000:
            mode = raw_input.richness_mode
            basis.append(f"Input length {length} chars suggests {mode.value} mode")
        elif length > 500:
            mode = RichnessMode.WELL_FORMED if raw_input.richness_mode == RichnessMode.WELL_FORMED else RichnessMode.MINIMALIST
            basis.append(f"Input length {length} chars suggests {mode.value} mode")
        else:
            mode = RichnessMode.SEED_ONLY
            basis.append(f"Short input ({length} chars) — seed-only mode")

        # Content heuristics
        has_sections = any(
            marker in text.lower()
            for marker in ["section", "requirement", "functional", "non-functional"]
        )
        if has_sections:
            basis.append("Detected structured section markers")

        has_compliance = bool(raw_input.detected_compliance_frameworks)
        if has_compliance:
            basis.append(f"Detected compliance frameworks: {raw_input.detected_compliance_frameworks}")

        confidence = Confidence.HIGH if length > 1000 else Confidence.MEDIUM

        return RichnessClassification(
            mode=mode,
            confidence=confidence,
            classification_basis=basis,
            gaps=[],
        )

    @staticmethod
    def _extract_chosen_option(action: SteeringActionDTO) -> SteeringOption | None:
        """Extract the chosen option from an ACCEPT action payload."""
        option_data = action.payload.get("chosen_option")
        if option_data and isinstance(option_data, dict):
            return SteeringOption(**option_data)
        return None
