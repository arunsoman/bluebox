"""Tests for the Node entity hierarchy - doc/api_event_contract.md SS5.1-SS5.4."""

import pytest
from pydantic import ValidationError

from bluebox.shared_kernel.domain.node import (
    AccessGuard,
    AcceptanceCriterion,
    ActorNode,
    CapabilityNode,
    CustomAnnotationNode,
    EngineeringTaskNode,
    Node,
    NodeAdapter,
    NodeProvenance,
    UseCaseNode,
    UseCaseStep,
    UserStoryNode,
)

_PROVENANCE = NodeProvenance(
    generated_at_stage=1, decision_entry_id="DEC-1", checkpoint_id="CKPT-1"
)


def _base_kwargs(**overrides):
    kwargs = dict(
        node_id="N-1",
        name="Patient",
        description="Primary end user",
        layer="Auth",
        risk_classification="LOW_RISK",
        status="SYSTEM_GENERATED",
        created_by="system",
        provenance=_PROVENANCE,
    )
    kwargs.update(overrides)
    return kwargs


def _make_actor(**overrides) -> ActorNode:
    return ActorNode(**_base_kwargs(**overrides))


def _make_use_case(**overrides) -> UseCaseNode:
    kwargs = _base_kwargs(
        node_id="UC-1",
        name="Book appointment",
        description="Patient books an appointment",
        primary_actor_id="ACT-1",
        preconditions=["Patient registered"],
        main_flow=[
            UseCaseStep(step_number=1, description="Select slot", actor_performing="Patient")
        ],
        postconditions=["Appointment created"],
        success_criteria=["Appointment persisted"],
    )
    kwargs.update(overrides)
    return UseCaseNode(**kwargs)


@pytest.mark.parametrize(
    "node",
    [
        _make_actor(),
        CapabilityNode(**_base_kwargs(node_id="CAP-1", related_actor_ids=["ACT-1"])),
        _make_use_case(),
        UserStoryNode(
            **_base_kwargs(
                node_id="US-1",
                title="As a Patient, I want to book an appointment",
                actor_id="ACT-1",
                story_points=5,
                priority="Must Have",
                acceptance_criteria=[
                    AcceptanceCriterion(ac_id="AC-1", given="g", when="w", then="t", complete=True)
                ],
                technical_notes="",
            )
        ),
        EngineeringTaskNode(
            **_base_kwargs(
                node_id="TASK-1",
                estimated_hours=4,
                complexity="Low",
                preconditions=["lib installed"],
                postconditions=["middleware works"],
                file_paths=["backend/src/middleware/auth.ts"],
                tech_stack_requirements=["Node.js"],
                access_guards=[
                    AccessGuard(guard_type="authentication", description="validate token")
                ],
                parent_story_id="US-1",
            )
        ),
        CustomAnnotationNode(
            **_base_kwargs(node_id="ANN-1", annotation_text="SEO requirements, out of scope")
        ),
    ],
    ids=["actor", "capability", "use_case", "user_story", "engineering_task", "custom_annotation"],
)
def test_universal_fields_present_on_every_subtype(node) -> None:
    assert node.risk_classification == "LOW_RISK"
    assert node.is_active is True
    assert node.status == "SYSTEM_GENERATED"
    assert node.version == 1


def test_discriminated_union_resolves_to_correct_subtype() -> None:
    payload = {
        "node_type": "use_case",
        **_base_kwargs(
            node_id="UC-2",
            primary_actor_id="ACT-1",
            preconditions=[],
            main_flow=[],
            postconditions=[],
            success_criteria=[],
        ),
    }
    # NodeProvenance is a BaseModel, not a plain dict - convert for round-trip realism.
    payload["provenance"] = _PROVENANCE.model_dump()
    node: Node = NodeAdapter.validate_python(payload)
    assert isinstance(node, UseCaseNode)
    assert node.node_type == "use_case"


def test_enrich_bumps_version_and_sets_status() -> None:
    node = _make_actor()
    node.enrich()
    assert node.status == "USER_ENRICHED"
    assert node.version == 2


def test_enrich_raises_after_supersede() -> None:
    node = _make_actor()
    node.supersede()
    with pytest.raises(ValueError):
        node.enrich()


def test_supersede_raises_on_second_call() -> None:
    node = _make_actor()
    node.supersede()
    with pytest.raises(ValueError):
        node.supersede()


def test_deactivate_and_restore_toggle_is_active() -> None:
    node = _make_actor()
    node.deactivate()
    assert node.is_active is False
    node.restore()
    assert node.is_active is True


def test_restore_raises_when_superseded() -> None:
    node = _make_actor()
    node.deactivate()
    node.supersede()
    with pytest.raises(ValueError):
        node.restore()


def test_defer_requires_non_empty_rationale() -> None:
    node = _make_actor()
    with pytest.raises(ValueError):
        node.defer("")


def test_defer_sets_status_and_rationale() -> None:
    node = _make_actor()
    node.defer("waiting on legal review")
    assert node.status == "DEFERRED"
    assert node.deferred_rationale == "waiting on legal review"


def test_mark_orphaned_sets_status() -> None:
    node = _make_actor()
    node.mark_orphaned()
    assert node.status == "ORPHANED"


def test_node_base_rejects_extra_fields() -> None:
    with pytest.raises(ValidationError):
        ActorNode(**_base_kwargs(unexpected_field="nope"))
