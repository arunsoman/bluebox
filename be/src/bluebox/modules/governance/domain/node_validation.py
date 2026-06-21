"""doc/api_event_contract.md SS5.1 `ValidationResult` - `POST /nodes/{node_id}/validate`.

Deterministic, not LLM-backed: same rationale as
`advisory/scaling/domain/validation.py` - completeness/required-field
checks are a closed set of structural rules over a node already fully
typed by pydantic, not something that benefits from a model call.

`required_fields`/`errors`/`warnings` check the type-specific extension
fields each `Node` subtype defines (`shared_kernel/domain/node.py`) for
emptiness, not just structural presence - pydantic already guarantees a
list field exists, the question worth answering is whether it's empty.
`prd_compliance` is populated only for `UserStoryNode`, from its own
`acceptance_criteria` (the only place an `AcceptanceCriterion.complete`
flag - the thing this DTO reports as `passed` - actually exists on a
committed node); other node types have no acceptance-criteria data to
check against, so they get an empty list rather than a fabricated one.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict

from bluebox.shared_kernel.domain.node import (
    CapabilityNode,
    EngineeringTaskNode,
    Node,
    UseCaseNode,
    UserStoryNode,
)

_THIN_DESCRIPTION_CHARS = 20


class ValidationField(BaseModel):
    """doc/api_event_contract.md SS5.1 `ValidationField`."""

    model_config = ConfigDict(extra="forbid")

    field_path: str
    field_name: str
    present: bool
    value: object
    required: bool
    rule: str


class PRDComplianceCheck(BaseModel):
    """doc/api_event_contract.md SS5.1 `PRDComplianceCheck`."""

    model_config = ConfigDict(extra="forbid")

    acceptance_criterion_id: str
    criterion: str
    passed: bool
    prd_reference: str


class ValidationError(BaseModel):
    """doc/api_event_contract.md SS5.1 `ValidationError`."""

    model_config = ConfigDict(extra="forbid")

    field_path: str
    error_code: str
    message: str
    severity: Literal["blocking", "critical"]
    suggested_fix: str | None = None


class ValidationWarning(BaseModel):
    """doc/api_event_contract.md SS5.1 `ValidationWarning`."""

    model_config = ConfigDict(extra="forbid")

    field_path: str
    warning_code: str
    message: str
    severity: Literal["warning", "info"]


class ValidationResult(BaseModel):
    """doc/api_event_contract.md SS5.1 `ValidationResult`."""

    model_config = ConfigDict(extra="forbid")

    valid: bool
    completeness_score: float
    required_fields: list[ValidationField]
    prd_compliance: list[PRDComplianceCheck]
    errors: list[ValidationError]
    warnings: list[ValidationWarning]


def _required_field(
    field_path: str, field_name: str, value: object, present: bool, rule: str
) -> ValidationField:
    return ValidationField(
        field_path=field_path, field_name=field_name, value=value, present=present, required=True, rule=rule
    )


def _type_required_fields(node: Node) -> list[ValidationField]:
    if isinstance(node, CapabilityNode):
        return [
            _required_field(
                "related_actor_ids", "Related Actors", node.related_actor_ids,
                bool(node.related_actor_ids), "must reference at least one actor",
            )
        ]
    if isinstance(node, UseCaseNode):
        return [
            _required_field(
                "preconditions", "Preconditions", node.preconditions,
                bool(node.preconditions), "must define at least one precondition",
            ),
            _required_field(
                "main_flow", "Main Flow", node.main_flow,
                bool(node.main_flow), "must define at least one step",
            ),
            _required_field(
                "postconditions", "Postconditions", node.postconditions,
                bool(node.postconditions), "must define at least one postcondition",
            ),
            _required_field(
                "success_criteria", "Success Criteria", node.success_criteria,
                bool(node.success_criteria), "must define at least one success criterion",
            ),
        ]
    if isinstance(node, UserStoryNode):
        return [
            _required_field(
                "acceptance_criteria", "Acceptance Criteria", node.acceptance_criteria,
                bool(node.acceptance_criteria), "must have at least one acceptance criterion",
            ),
            _required_field(
                "story_points", "Story Points", node.story_points,
                node.story_points > 0, "must be greater than 0",
            ),
        ]
    if isinstance(node, EngineeringTaskNode):
        return [
            _required_field(
                "file_paths", "File Paths", node.file_paths,
                bool(node.file_paths), "must specify at least one file path",
            ),
            _required_field(
                "preconditions", "Preconditions", node.preconditions,
                bool(node.preconditions), "must define at least one precondition",
            ),
            _required_field(
                "postconditions", "Postconditions", node.postconditions,
                bool(node.postconditions), "must define at least one postcondition",
            ),
            _required_field(
                "tech_stack_requirements", "Tech Stack Requirements", node.tech_stack_requirements,
                bool(node.tech_stack_requirements), "must specify at least one tech stack requirement",
            ),
        ]
    return []


def _type_warnings(node: Node) -> list[ValidationWarning]:
    warnings: list[ValidationWarning] = []
    if isinstance(node, UseCaseNode) and not node.alternative_flows:
        warnings.append(
            ValidationWarning(
                field_path="alternative_flows", warning_code="NO_ALTERNATIVE_FLOWS",
                message="No alternative/exception flows defined.", severity="info",
            )
        )
    if isinstance(node, UserStoryNode) and not node.technical_notes.strip():
        warnings.append(
            ValidationWarning(
                field_path="technical_notes", warning_code="MISSING_TECHNICAL_NOTES",
                message="No technical notes provided for implementers.", severity="warning",
            )
        )
    if isinstance(node, EngineeringTaskNode) and not node.access_guards:
        warnings.append(
            ValidationWarning(
                field_path="access_guards", warning_code="NO_ACCESS_GUARDS",
                message="No access guards declared - confirm this task genuinely needs none.",
                severity="info",
            )
        )
    return warnings


def _prd_compliance(node: Node) -> list[PRDComplianceCheck]:
    if not isinstance(node, UserStoryNode):
        return []
    return [
        PRDComplianceCheck(
            acceptance_criterion_id=ac.ac_id,
            criterion=f"Given {ac.given}, when {ac.when}, then {ac.then}",
            passed=ac.complete,
            prd_reference=f"user_story:{node.node_id}",
        )
        for ac in node.acceptance_criteria
    ]


def validate_node(node: Node) -> ValidationResult:
    description_present = bool(node.description.strip())
    required_fields = [
        _required_field("description", "Description", node.description, description_present, "must be non-empty"),
        *_type_required_fields(node),
    ]

    errors = [
        ValidationError(
            field_path=f.field_path, error_code=f"MISSING_{f.field_path.upper()}",
            message=f"{f.field_name} {f.rule}.", severity="blocking",
            suggested_fix=f"Provide a value for {f.field_name.lower()}.",
        )
        for f in required_fields
        if not f.present
    ]

    warnings = list(_type_warnings(node))
    if description_present and len(node.description.strip()) < _THIN_DESCRIPTION_CHARS:
        warnings.append(
            ValidationWarning(
                field_path="description", warning_code="THIN_DESCRIPTION",
                message="Description is very short - consider adding more detail.", severity="info",
            )
        )

    total = len(required_fields)
    present = sum(1 for f in required_fields if f.present)
    completeness_score = present / total if total else 1.0

    return ValidationResult(
        valid=len(errors) == 0,
        completeness_score=completeness_score,
        required_fields=required_fields,
        prd_compliance=_prd_compliance(node),
        errors=errors,
        warnings=warnings,
    )
