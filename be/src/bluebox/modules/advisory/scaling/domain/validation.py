"""doc/api_event_contract.md SS2.5 `ScaleValidationResult`/`ScaleInputConflict`.

Deterministic, not LLM-backed: `POST /scale` (`interfaces/api/routers/scaling.py`)
needs an answer fast enough to be a form-validation step, not a network round
trip to a provider for what's really arithmetic plus a closed set of strings.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict

from bluebox.modules.advisory.scaling.llm.requests import ScaleInputsContext

ConflictType = Literal["concurrent_exceeds_total", "budget_timeline_mismatch", "unsupported_region"]

# No canonical region list exists anywhere else in this codebase yet - the
# UI's `geographic_regions` field is free text and doc/api_event_contract.md
# doesn't enumerate one. This is a placeholder allowlist (broad continental
# regions) just narrow enough to catch typos/nonsense input; replace with a
# real supported-regions source if/when one exists.
SUPPORTED_REGIONS = {"north-america", "south-america", "europe", "asia-pacific", "middle-east", "africa"}

# Timelines fast enough that a near-zero budget can't realistically fund any
# real infrastructure build-out.
_RAPID_TIMELINES = {"< 1 month", "1-3 months"}
_MIN_VIABLE_RAPID_BUDGET_USD = 200.0


class ScaleInputConflict(BaseModel):
    """doc/api_event_contract.md SS2.5 `ScaleInputConflict`."""

    model_config = ConfigDict(extra="forbid")

    conflict_type: ConflictType
    description: str
    affected_fields: list[str]
    suggested_fix: str


class ScaleValidationResult(BaseModel):
    """doc/api_event_contract.md SS2.5 `ScaleValidationResult`."""

    model_config = ConfigDict(extra="forbid")

    valid: bool
    conflicts: list[ScaleInputConflict]
    sanitized_inputs: ScaleInputsContext


def validate_scale_inputs(inputs: ScaleInputsContext) -> ScaleValidationResult:
    conflicts: list[ScaleInputConflict] = []

    if inputs.peak_concurrent_users > inputs.expected_total_users:
        conflicts.append(
            ScaleInputConflict(
                conflict_type="concurrent_exceeds_total",
                description=(
                    f"peak_concurrent_users ({inputs.peak_concurrent_users}) exceeds "
                    f"expected_total_users ({inputs.expected_total_users})"
                ),
                affected_fields=["peak_concurrent_users", "expected_total_users"],
                suggested_fix="Set peak_concurrent_users to at most expected_total_users.",
            )
        )

    if (
        not inputs.no_budget_limit
        and inputs.monthly_budget_usd is not None
        and inputs.launch_timeline in _RAPID_TIMELINES
        and inputs.monthly_budget_usd < _MIN_VIABLE_RAPID_BUDGET_USD
    ):
        conflicts.append(
            ScaleInputConflict(
                conflict_type="budget_timeline_mismatch",
                description=(
                    f"monthly_budget_usd (${inputs.monthly_budget_usd:.0f}) is unlikely to "
                    f"fund a real launch on a {inputs.launch_timeline} timeline."
                ),
                affected_fields=["monthly_budget_usd", "launch_timeline"],
                suggested_fix=(
                    "Increase monthly_budget_usd, extend launch_timeline, or set "
                    "no_budget_limit if cost is not a hard constraint."
                ),
            )
        )

    unsupported = sorted({r for r in (inputs.geographic_regions or []) if r.lower() not in SUPPORTED_REGIONS})
    if unsupported:
        conflicts.append(
            ScaleInputConflict(
                conflict_type="unsupported_region",
                description=f"Unrecognized geographic_regions: {', '.join(unsupported)}",
                affected_fields=["geographic_regions"],
                suggested_fix=f"Choose from: {', '.join(sorted(SUPPORTED_REGIONS))}.",
            )
        )

    return ScaleValidationResult(valid=len(conflicts) == 0, conflicts=conflicts, sanitized_inputs=inputs)
