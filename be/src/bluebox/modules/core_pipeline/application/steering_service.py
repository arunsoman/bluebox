"""Steering: stage-boundary review and commit - doc/api_event_contract.md SS4.2.

`accept_all` covers doc/api_event_contract.md `SteeringAction.action_type
== "accept"` fully: every candidate from a stage's generation result becomes
a committed `Node`. `modify`/`replace` are not built in this pass - the
intended division of labor is accept-then-edit via
`governance/application/node_service.py` (a future pass can add a combined
single-call path once that's stable).
"""

import uuid
from typing import Any

from bluebox.modules.core_pipeline.llm.responses import (
    ActorCandidateSet,
    CapabilityCandidateSet,
    EngineeringTaskCandidateSet,
    UseCaseCandidateSet,
    UserStoryCandidateSet,
)
from bluebox.shared_kernel.domain.audit import DecisionEntry, DecisionEntryMetadata, ProvenanceChain
from bluebox.shared_kernel.domain.node import (
    ActorNode,
    CapabilityNode,
    EngineeringTaskNode,
    Node,
    NodeProvenance,
    UseCaseNode,
    UserStoryNode,
)
from bluebox.shared_kernel.ports import DecisionLedgerRepository, NodeRepository, SessionRepository

_STAGE_NAMES = {
    2: "Actor Discovery",
    3: "Capability Definition",
    4: "Use Case Decomposition",
    5: "User Story Decomposition",
    6: "Task Decomposition",
}


def _new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8].upper()}"


def _candidates_to_nodes(stage: int, candidates: Any, checkpoint_id: str) -> list[Node]:
    provenance_for = lambda: NodeProvenance(  # noqa: E731
        generated_at_stage=stage, decision_entry_id="pending", checkpoint_id=checkpoint_id
    )

    if isinstance(candidates, ActorCandidateSet):
        return [
            ActorNode(
                node_id=_new_id("ACT"), name=c.name, description=c.description, layer=c.layer,
                risk_classification=c.risk_classification, status="SYSTEM_GENERATED",
                created_by="system", provenance=provenance_for(),
            )
            for c in candidates.actors
        ]
    if isinstance(candidates, CapabilityCandidateSet):
        return [
            CapabilityNode(
                node_id=_new_id("CAP"), name=c.name, description=c.description, layer=c.layer,
                risk_classification=c.risk_classification, status="SYSTEM_GENERATED",
                created_by="system", provenance=provenance_for(),
                related_actor_ids=list(c.related_actor_ids),
            )
            for c in candidates.capabilities
        ]
    if isinstance(candidates, UseCaseCandidateSet):
        return [
            UseCaseNode(
                node_id=_new_id("UC"), name=c.name, description=c.description, layer="Backend",
                risk_classification="LOW_RISK", status="SYSTEM_GENERATED", created_by="system",
                provenance=provenance_for(), primary_actor_id=c.primary_actor_id,
                secondary_actor_ids=list(c.secondary_actor_ids), preconditions=list(c.preconditions),
                main_flow=list(c.main_flow), alternative_flows=list(c.alternative_flows),
                postconditions=list(c.postconditions), success_criteria=list(c.success_criteria),
            )
            for c in candidates.use_cases
        ]
    if isinstance(candidates, UserStoryCandidateSet):
        return [
            UserStoryNode(
                node_id=_new_id("US"), name=c.title, description=c.title, layer="Backend",
                risk_classification="LOW_RISK", status="SYSTEM_GENERATED", created_by="system",
                provenance=provenance_for(), title=c.title, actor_id=c.actor_id,
                story_points=c.story_points, priority=c.priority,
                acceptance_criteria=list(c.acceptance_criteria), technical_notes=c.technical_notes,
                dependencies=list(c.dependencies),
            )
            for c in candidates.user_stories
        ]
    if isinstance(candidates, EngineeringTaskCandidateSet):
        return [
            EngineeringTaskNode(
                node_id=_new_id("TASK"), name=c.name, description=c.description, layer="Backend",
                risk_classification="MEDIUM" if c.access_guards else "LOW_RISK",
                status="SYSTEM_GENERATED", created_by="system", provenance=provenance_for(),
                estimated_hours=c.estimated_hours, complexity=c.complexity,
                preconditions=list(c.preconditions), postconditions=list(c.postconditions),
                file_paths=list(c.file_paths), tech_stack_requirements=list(c.tech_stack_requirements),
                database_schema_changes=c.database_schema_changes,
                access_guards=list(c.access_guards), parent_story_id=c.parent_story_id,
            )
            for c in candidates.tasks
        ]
    raise ValueError(f"no Node mapping for candidate type {type(candidates).__name__}")


def preview_nodes(stage: int, candidates: Any) -> list[Node]:
    """Builds the same `Node` shapes `accept_all` would commit, without
    persisting them - used by the steering REST/WS layer to render a
    `SteeringPanel` (draft_output) before the user has acted."""

    return _candidates_to_nodes(stage, candidates, checkpoint_id="preview")


class SteeringService:
    def __init__(
        self,
        nodes: NodeRepository,
        sessions: SessionRepository,
        decisions: DecisionLedgerRepository,
    ) -> None:
        self._nodes = nodes
        self._sessions = sessions
        self._decisions = decisions

    def accept_all(self, project_id: str, stage: int, candidates: Any) -> list[Node]:
        """doc/api_event_contract.md SS4.2 `SteeringAction.action_type ==
        "accept"`: commits every candidate from `candidates` (one of the
        `*CandidateSet` response types from `core_pipeline/llm/responses.py`)
        as a `Node`, advances the FSM, and writes a `DecisionEntry` per node.
        """

        orchestrator = self._sessions.get_or_create(project_id)
        checkpoint_id = f"CKPT-{uuid.uuid4().hex[:8].upper()}"
        committed = _candidates_to_nodes(stage, candidates, checkpoint_id)

        for node in committed:
            self._nodes.add(project_id, node)
            decision_id = _new_id("DEC")
            node.provenance.decision_entry_id = decision_id
            self._decisions.append(
                project_id,
                DecisionEntry(
                    entry_id=decision_id,
                    decision_type="steering",
                    stage=stage,
                    stage_name=_STAGE_NAMES.get(stage, f"Stage {stage}"),
                    summary=f"Accepted {node.node_type} '{node.name}'",
                    payload={"node_id": node.node_id},
                    provenance=ProvenanceChain(
                        trigger_event="STEERING_ACTION", context_snapshot_id=checkpoint_id
                    ),
                    metadata=DecisionEntryMetadata(
                        layer=node.layer,
                        risk_classification=node.risk_classification,
                        auto_approved=orchestrator.should_auto_approve(node.risk_classification),
                        trust_mode_at_decision=orchestrator.trust_mode,
                    ),
                    created_by="user-1",
                ),
            )

        orchestrator.advance_from_steering(
            "STAGE_RUNNING", reason=f"stage {stage} accepted", steering_action_received=True
        )
        self._sessions.save(project_id, orchestrator)
        return committed
