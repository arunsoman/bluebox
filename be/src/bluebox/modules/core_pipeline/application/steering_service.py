"""Steering: stage-boundary review and commit - doc/api_event_contract.md SS4.2.

`accept_all` covers doc/api_event_contract.md `SteeringAction.action_type
== "accept"` fully: every candidate from a stage's generation result becomes
a committed `Node`. `apply_modifications` covers `action_type == "modify"`:
it edits the *cached, not-yet-committed* candidates in place (matched by the
stable per-candidate `node_id`s `generate_node_ids` hands out once per stage
generation - see its docstring for why that stability matters), so a later
`accept_all` call against the same cached candidates picks up the edit.
`replace`/`authorize` are still not built - `SteeringService` has no concept
of swapping in caller-supplied content or stepping through an authorization
gate.
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
    AcceptanceCriterion,
    AccessGuard,
    ActorNode,
    AlternativeFlow,
    CapabilityNode,
    EngineeringTaskNode,
    Node,
    NodeProvenance,
    UseCaseNode,
    UseCaseStep,
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


def _candidate_items_and_prefix(candidates: Any) -> tuple[list[Any], str]:
    """The list a stage's candidate set iterates + that type's `Node` id
    prefix - shared between `generate_node_ids` (called once, when a stage
    is generated) and `apply_modifications` (matches a `modify` action's
    `node_id` back to the candidate it edits), so both agree on ordering."""

    if isinstance(candidates, ActorCandidateSet):
        return list(candidates.actors), "ACT"
    if isinstance(candidates, CapabilityCandidateSet):
        return list(candidates.capabilities), "CAP"
    if isinstance(candidates, UseCaseCandidateSet):
        return list(candidates.use_cases), "UC"
    if isinstance(candidates, UserStoryCandidateSet):
        return list(candidates.user_stories), "US"
    if isinstance(candidates, EngineeringTaskCandidateSet):
        return list(candidates.tasks), "TASK"
    raise ValueError(f"no candidate mapping for {type(candidates).__name__}")


def generate_node_ids(candidates: Any) -> list[str]:
    """Call once per stage generation (`stage_advance.run_stage_and_cache`,
    `routers/steering.py`'s `/generate`) and cache the result alongside
    `candidates` in `app_state.pending_candidates`. Both the panel shown to
    the user (`preview_nodes`) and the eventual commit (`accept_all`) must
    reuse the *same* ids - generating fresh ones on every render (the
    previous behavior) meant the `node_id` a user saw in the panel never
    matched what `accept_all` actually committed, so a `modify` action
    naming that `node_id` could never find anything to edit."""

    items, prefix = _candidate_items_and_prefix(candidates)
    return [_new_id(prefix) for _ in items]


# `field_path` is generic in the contract's `ModifiedNode` (any field a
# DraftNode renders), but only "description" is wired from the frontend
# today (every steering panel's inline edit). `UserStoryCandidate` has no
# `description` field - `_candidates_to_nodes` below always sets
# `UserStoryNode.description = c.title`, so "edit the description shown in
# the panel" means "edit `title`" for that one candidate type specifically.
_DESCRIPTION_FIELD_ALIAS: dict[str, str] = {"UserStoryCandidate": "title"}


# Below: candidate -> Node conversions for nested fields whose LLM-boundary
# type (core_pipeline/llm/responses.py) and domain type (shared_kernel/domain/node.py)
# are separate classes by design (the anti-corruption-layer split both
# modules' docstrings describe) - structurally identical field sets, but
# pydantic's `extra="forbid"` model validation rejects an instance of one
# class where the other is declared, so passing the LLM instances straight
# through (as this code previously did) raised a `ValidationError` the
# first time a UseCase/UserStory/EngineeringTask candidate actually
# populated these fields (`main_flow`, `alternative_flows`,
# `acceptance_criteria`, `access_guards` - empty lists never tripped it).


def _to_domain_step(step: Any) -> UseCaseStep:
    return UseCaseStep(**step.model_dump())


def _to_domain_alternative_flow(flow: Any) -> AlternativeFlow:
    return AlternativeFlow(
        flow_id=flow.flow_id, flow_name=flow.flow_name, trigger_condition=flow.trigger_condition,
        steps=[_to_domain_step(s) for s in flow.steps],
    )


def _to_domain_acceptance_criterion(ac: Any, index: int) -> AcceptanceCriterion:
    # The LLM-boundary `AcceptanceCriterion` has no `ac_id` (doc/api_event_contract.md
    # SS5.3 doesn't ask the model to invent ids for nested list items) - the
    # domain entity requires one, so it's synthesized here, not generated.
    return AcceptanceCriterion(ac_id=f"AC-{index + 1}", given=ac.given, when=ac.when, then=ac.then, complete=ac.complete)


def _to_domain_access_guard(guard: Any) -> AccessGuard:
    return AccessGuard(**guard.model_dump())


def _candidates_to_nodes(
    stage: int, candidates: Any, checkpoint_id: str, node_ids: list[str] | None = None
) -> list[Node]:
    provenance_for = lambda: NodeProvenance(  # noqa: E731
        generated_at_stage=stage, decision_entry_id="pending", checkpoint_id=checkpoint_id
    )
    ids = iter(node_ids) if node_ids is not None else None

    def next_id(prefix: str) -> str:
        return next(ids) if ids is not None else _new_id(prefix)

    if isinstance(candidates, ActorCandidateSet):
        return [
            ActorNode(
                node_id=next_id("ACT"), name=c.name, description=c.description, layer=c.layer,
                risk_classification=c.risk_classification, status="SYSTEM_GENERATED",
                created_by="system", provenance=provenance_for(),
            )
            for c in candidates.actors
        ]
    if isinstance(candidates, CapabilityCandidateSet):
        return [
            CapabilityNode(
                node_id=next_id("CAP"), name=c.name, description=c.description, layer=c.layer,
                risk_classification=c.risk_classification, status="SYSTEM_GENERATED",
                created_by="system", provenance=provenance_for(),
                related_actor_ids=list(c.related_actor_ids),
            )
            for c in candidates.capabilities
        ]
    if isinstance(candidates, UseCaseCandidateSet):
        return [
            UseCaseNode(
                node_id=next_id("UC"), name=c.name, description=c.description, layer="Backend",
                risk_classification="LOW_RISK", status="SYSTEM_GENERATED", created_by="system",
                provenance=provenance_for(), primary_actor_id=c.primary_actor_id,
                secondary_actor_ids=list(c.secondary_actor_ids), preconditions=list(c.preconditions),
                main_flow=[_to_domain_step(s) for s in c.main_flow],
                alternative_flows=[_to_domain_alternative_flow(f) for f in c.alternative_flows],
                postconditions=list(c.postconditions), success_criteria=list(c.success_criteria),
            )
            for c in candidates.use_cases
        ]
    if isinstance(candidates, UserStoryCandidateSet):
        return [
            UserStoryNode(
                node_id=next_id("US"), name=c.title, description=c.title, layer="Backend",
                risk_classification="LOW_RISK", status="SYSTEM_GENERATED", created_by="system",
                provenance=provenance_for(), title=c.title, actor_id=c.actor_id,
                story_points=c.story_points, priority=c.priority,
                acceptance_criteria=[_to_domain_acceptance_criterion(ac, i) for i, ac in enumerate(c.acceptance_criteria)],
                technical_notes=c.technical_notes,
                dependencies=list(c.dependencies),
            )
            for c in candidates.user_stories
        ]
    if isinstance(candidates, EngineeringTaskCandidateSet):
        return [
            EngineeringTaskNode(
                node_id=next_id("TASK"), name=c.name, description=c.description, layer="Backend",
                risk_classification="MEDIUM" if c.access_guards else "LOW_RISK",
                status="SYSTEM_GENERATED", created_by="system", provenance=provenance_for(),
                estimated_hours=c.estimated_hours, complexity=c.complexity,
                preconditions=list(c.preconditions), postconditions=list(c.postconditions),
                file_paths=list(c.file_paths), tech_stack_requirements=list(c.tech_stack_requirements),
                database_schema_changes=c.database_schema_changes,
                access_guards=[_to_domain_access_guard(g) for g in c.access_guards],
                parent_story_id=c.parent_story_id,
            )
            for c in candidates.tasks
        ]
    raise ValueError(f"no Node mapping for candidate type {type(candidates).__name__}")


def remaining_candidates(candidates: Any, node_ids: list[str], committed_ids: set[str]) -> tuple[Any, list[str]]:
    """`accept_all`'s partial-accept path (`selected_node_ids` a strict subset of `node_ids`)
    needs to shrink the cached pending set down to whatever DIDN'T get committed, so a
    follow-up accept doesn't re-commit the same candidates twice and the Steering Panel only
    shows what's still undecided. Rebuilds a same-typed `*CandidateSet` (mirrors
    `_candidate_items_and_prefix`'s type dispatch) containing only the not-yet-committed items,
    paired with their (still-stable) node_ids."""

    items, _ = _candidate_items_and_prefix(candidates)
    kept_pairs = [(item, nid) for item, nid in zip(items, node_ids) if nid not in committed_ids]
    kept_items = [item for item, _ in kept_pairs]
    kept_ids = [nid for _, nid in kept_pairs]

    if isinstance(candidates, ActorCandidateSet):
        return ActorCandidateSet(actors=kept_items), kept_ids
    if isinstance(candidates, CapabilityCandidateSet):
        return CapabilityCandidateSet(capabilities=kept_items), kept_ids
    if isinstance(candidates, UseCaseCandidateSet):
        return UseCaseCandidateSet(use_cases=kept_items), kept_ids
    if isinstance(candidates, UserStoryCandidateSet):
        return UserStoryCandidateSet(user_stories=kept_items), kept_ids
    if isinstance(candidates, EngineeringTaskCandidateSet):
        return EngineeringTaskCandidateSet(tasks=kept_items), kept_ids
    raise ValueError(f"no candidate mapping for {type(candidates).__name__}")


def preview_nodes(stage: int, candidates: Any, node_ids: list[str] | None = None) -> list[Node]:
    """Builds the same `Node` shapes `accept_all` would commit, without
    persisting them - used by the steering REST/WS layer to render a
    `SteeringPanel` (draft_output) before the user has acted. Pass the same
    `node_ids` `generate_node_ids` produced for this stage's candidates so
    the panel's `node_id`s match what `accept_all`/`apply_modifications`
    will later see."""

    return _candidates_to_nodes(stage, candidates, checkpoint_id="preview", node_ids=node_ids)


def apply_modifications(
    candidates: Any, node_ids: list[str], modifications: list[tuple[str, str, Any]]
) -> list[dict[str, Any]]:
    """`SteeringAction.action_type == "modify"`: edits `candidates` *in
    place* (the same object the caller has cached in
    `app_state.pending_candidates` - mutating it here is only durable if the
    caller re-stores the tuple afterward, since `SqlitePendingDict` reads
    back a fresh unpickled copy on every `.get()`). Each modification is
    `(node_id, field_path, new_value)`; returns one `NODE_UPDATED`-shaped
    dict per modification for the caller to broadcast over WS.

    Raises `ValueError` (callers map this to a 400) for an unknown
    `node_id` or a `field_path` that isn't a real, modifiable field on that
    candidate type - never silently no-ops a bad request.
    """

    items, _ = _candidate_items_and_prefix(candidates)
    by_id = dict(zip(node_ids, items))
    updated: list[dict[str, Any]] = []
    for node_id, field_path, new_value in modifications:
        item = by_id.get(node_id)
        if item is None:
            raise ValueError(f"no draft node {node_id!r} in this stage's candidates")
        target_field = _DESCRIPTION_FIELD_ALIAS.get(type(item).__name__, field_path) \
            if field_path == "description" else field_path
        if target_field not in type(item).model_fields:
            raise ValueError(f"field {field_path!r} is not modifiable on {type(item).__name__}")
        setattr(item, target_field, new_value)
        updated.append({"node_id": node_id, "change_type": "modify", "new_data": {field_path: new_value}})
    return updated


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

    def accept_all(
        self,
        project_id: str,
        stage: int,
        candidates: Any,
        node_ids: list[str] | None = None,
        selected_node_ids: list[str] | None = None,
    ) -> list[Node]:
        """doc/api_event_contract.md SS4.2 `SteeringAction.action_type ==
        "accept"`: commits candidates from `candidates` (one of the
        `*CandidateSet` response types from `core_pipeline/llm/responses.py`)
        as `Node`s and writes a `DecisionEntry` per node. Pass the same
        `node_ids` the panel was built with (`generate_node_ids`) so a
        node's id doesn't change between being shown in the Steering Panel
        and actually being committed.

        `selected_node_ids=None` commits everything ("Approve All"). A
        strict subset ("Approve Selected" with some boxes unchecked) commits
        only those - the FSM only advances out of `AWAITING_STEERING` once
        every candidate from this stage has been resolved one way or
        another; callers must check whether `len(returned) < total
        candidates` and, if so, keep the panel on this same stage (see
        `remaining_candidates`) instead of auto-advancing.
        """

        orchestrator = self._sessions.get_or_create(project_id)
        checkpoint_id = f"CKPT-{uuid.uuid4().hex[:8].upper()}"
        all_nodes = _candidates_to_nodes(stage, candidates, checkpoint_id, node_ids)
        committed = (
            all_nodes
            if selected_node_ids is None
            else [n for n in all_nodes if n.node_id in set(selected_node_ids)]
        )
        is_partial = len(committed) < len(all_nodes)

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

        if not is_partial:
            orchestrator.advance_from_steering(
                "STAGE_RUNNING", reason=f"stage {stage} accepted", steering_action_received=True
            )
            self._sessions.save(project_id, orchestrator)
        return committed
