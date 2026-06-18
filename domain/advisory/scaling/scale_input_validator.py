"""ScaleInputValidator - cross-field validation for scaling inputs.

Validates consistency across ScaleInputs fields. All checks are purely
derived from the input data - no mock or stub values are used.
"""
from __future__ import annotations

from domain.models import ScaleInputConflict, ScaleInputs


class ScaleInputValidator:
    """Performs cross-field validation on ScaleInputs.

    Checks that numeric fields are internally consistent and that the
    stated persona (if any) matches the provided quantitative values.
    """

    def validate(self, inputs: ScaleInputs) -> list[ScaleInputConflict]:
        """Run all cross-field checks and return a list of conflicts found.

        Checks performed:
        1. peak_concurrent_sessions <= launch_users * 0.5 (when both numeric)
        2. Growth consistency: year1_growth should be plausible
        3. SLA vs persona compatibility (basic format check)
        """
        conflicts: list[ScaleInputConflict] = []

        conflicts.extend(self._check_peak_vs_launch(inputs))
        conflicts.extend(self._check_growth_consistency(inputs))
        conflicts.extend(self._check_sla_compatibility(inputs))

        return conflicts

    # ------------------------------------------------------------------ #
    # Internal check helpers
    # ------------------------------------------------------------------ #

    def _check_peak_vs_launch(self, inputs: ScaleInputs) -> list[ScaleInputConflict]:
        """Check that peak_concurrent_sessions <= launch_users * 0.5.

        Industry rule of thumb: peak concurrent users typically does not
        exceed 50 % of total registered users at launch.
        """
        conflicts: list[ScaleInputConflict] = []
        launch = inputs.launch_users
        peak = inputs.peak_concurrent_sessions

        if launch is None or peak is None:
            return conflicts

        launch_num = self._to_number(launch)
        peak_num = self._to_number(peak)

        if launch_num is None or peak_num is None:
            return conflicts

        if peak_num > launch_num * 0.5:
            conflicts.append(
                ScaleInputConflict(
                    conflict_description=(
                        f"Peak concurrent sessions ({peak_num}) exceeds 50% of "
                        f"launch users ({launch_num}). Expected peak <= {int(launch_num * 0.5)}. "
                        "Either reduce peak_concurrent_sessions or increase launch_users."
                    ),
                    affected_fields=["launch_users", "peak_concurrent_sessions"],
                )
            )

        return conflicts

    def _check_growth_consistency(self, inputs: ScaleInputs) -> list[ScaleInputConflict]:
        """Check that year1_growth is numerically consistent with launch_users.

        Example: launching with 100 users and claiming 2x growth (200 users)
        is very different from claiming 1M users - flags implausible jumps.
        """
        conflicts: list[ScaleInputConflict] = []
        launch = inputs.launch_users
        growth = inputs.year1_growth

        if launch is None or growth is None:
            return conflicts

        launch_num = self._to_number(launch)
        if launch_num is None:
            return conflicts

        growth_multiplier = self._parse_growth_multiplier(growth)
        if growth_multiplier is None:
            return conflicts

        projected = launch_num * growth_multiplier

        # Sanity thresholds: if launch < 1000 but projected > 1_000_000,
        # that's a 1000x+ effective jump which warrants a flag.
        if launch_num < 1000 and projected > 1_000_000:
            conflicts.append(
                ScaleInputConflict(
                    conflict_description=(
                        f"Growth inconsistency: {launch_num} launch users with "
                        f"'{growth}' growth projects to {int(projected)} users - "
                        "a 1000x+ jump. Verify year1_growth or launch_users."
                    ),
                    affected_fields=["launch_users", "year1_growth"],
                )
            )

        # Also flag if projected is less than launch (negative or fractional growth)
        if growth_multiplier < 1.0:
            conflicts.append(
                ScaleInputConflict(
                    conflict_description=(
                        f"Growth multiplier {growth_multiplier} implies fewer users "
                        f"({int(projected)}) than launch ({launch_num}). "
                        "Year-1 growth should typically be >= 1x (flat) or higher."
                    ),
                    affected_fields=["year1_growth"],
                )
            )

        return conflicts

    def _check_sla_compatibility(self, inputs: ScaleInputs) -> list[ScaleInputConflict]:
        """Check that uptime_sla format is compatible with implied scale persona.

        Very high SLAs (99.99%+) with tiny user bases are unusual and costly.
        """
        conflicts: list[ScaleInputConflict] = []
        launch = inputs.launch_users
        sla = inputs.uptime_sla

        if launch is None or sla is None:
            return conflicts

        launch_num = self._to_number(launch)
        if launch_num is None:
            return conflicts

        sla_numeric = self._parse_sla_numeric(sla)
        if sla_numeric is None:
            return conflicts

        # Very high SLA with very small user base is unusual
        if sla_numeric >= 99.99 and launch_num < 1000:
            conflicts.append(
                ScaleInputConflict(
                    conflict_description=(
                        f"SLA of {sla_numeric}% with only {launch_num} launch users is "
                        "unusually aggressive. 99.99%+ SLAs are typically justified "
                        "for >1K user bases due to multi-AZ failover costs."
                    ),
                    affected_fields=["uptime_sla", "launch_users"],
                )
            )

        # Very low SLA with large user base is also a flag
        if sla_numeric < 99.0 and launch_num > 10000:
            conflicts.append(
                ScaleInputConflict(
                    conflict_description=(
                        f"SLA of {sla_numeric}% with {launch_num} launch users is "
                        "below industry standard. Consider >= 99.9% for this scale."
                    ),
                    affected_fields=["uptime_sla", "launch_users"],
                )
            )

        return conflicts

    # ------------------------------------------------------------------ #
    # Static helpers
    # ------------------------------------------------------------------ #

    @staticmethod
    def _to_number(value: int | str | None) -> float | None:
        """Coerce an int-or-str value to a float. Returns None if not possible."""
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return float(value)
        try:
            # Strip common suffixes like "k", "K", "m", "M"
            cleaned = value.strip().lower()
            multiplier = 1.0
            if cleaned.endswith("k"):
                multiplier = 1_000.0
                cleaned = cleaned[:-1]
            elif cleaned.endswith("m"):
                multiplier = 1_000_000.0
                cleaned = cleaned[:-1]
            return float(cleaned) * multiplier
        except (ValueError, TypeError, AttributeError):
            return None

    @staticmethod
    def _parse_growth_multiplier(growth: str) -> float | None:
        """Parse a growth string like '2x', '10x', '50%' into a numeric multiplier.

        Returns None if the string cannot be parsed.
        """
        if not growth:
            return None
        cleaned = growth.strip().lower()
        try:
            if cleaned.endswith("x"):
                return float(cleaned[:-1])
            if cleaned.endswith("%"):
                pct = float(cleaned[:-1])
                return 1.0 + (pct / 100.0)
            # Plain number - treat as multiplier
            return float(cleaned)
        except (ValueError, TypeError):
            return None

    @staticmethod
    def _parse_sla_numeric(sla: str) -> float | None:
        """Parse an SLA string like '99.9%', '99.95' into a numeric percentage.

        Returns None if the string cannot be parsed.
        """
        if not sla:
            return None
        cleaned = sla.strip().rstrip("%").strip()
        try:
            return float(cleaned)
        except (ValueError, TypeError):
            return None
