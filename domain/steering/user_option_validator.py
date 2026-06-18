"""UserOptionValidator — validates user-created steering options.

When a user submits a CUSTOM_OPTION action, the option must be checked
for coherence with the current stage and for contradictions with
previously accepted decisions in the append-only ledger.
"""
from __future__ import annotations

from domain.models import (
    StageName,
    SteeringOption,
    DecisionLedger,
    UserOptionIncoherent,
)


class UserOptionValidator:
    """Validates user-created steering options before they are added to the panel.

    The validator is stateless and uses only the option text, current stage,
    and the decision ledger to perform checks.
    """

    # Stage-appropriate keywords — rough heuristic for coherence checking.
    _STAGE_KEYWORDS: dict[StageName, set[str]] = {
        StageName.PRD_ANALYSIS: {
            "scope", "requirement", "constraint", "assumption", "compliance",
            "section", "missing", "conflict",
        },
        StageName.IDEATION: {
            "idea", "product", "feature", "value", "customer", "market",
            "differentiation", "risk",
        },
        StageName.ACTOR_DISCOVERY: {
            "actor", "user", "role", "permission", "human", "system",
            "external", "service", "platform",
        },
        StageName.CAPABILITY_DISCOVERY: {
            "capability", "function", "feature", "data", "security",
            "integration", "operational", "platform",
        },
        StageName.USE_CASE_DISCOVERY: {
            "use case", "flow", "precondition", "postcondition",
            "alternative", "exception", "actor", "step",
        },
        StageName.STORY_DISCOVERY: {
            "story", "acceptance", "criteria", "point", "priority",
            "given", "when", "then",
        },
        StageName.TASK_DECOMPOSITION: {
            "task", "layer", "backend", "frontend", "database", "test",
            "file", "implementation", "dependency", "effort",
        },
    }

    def validate_coherence(
        self,
        option: SteeringOption,
        stage: StageName,
    ) -> tuple[bool, str]:
        """Check whether the option is coherent with the current stage.

        Returns (is_valid, reason).
        """
        if not option.label or not option.label.strip():
            return False, "Option label is empty."

        keywords = self._STAGE_KEYWORDS.get(stage, set())
        label_lower = option.label.lower()
        rationale_lower = option.rationale.lower()
        combined_text = f"{label_lower} {rationale_lower}"

        # Require at least one stage-relevant keyword (if stage keywords are defined)
        if keywords and not any(kw in combined_text for kw in keywords):
            return (
                False,
                f"Option does not appear relevant to stage '{stage.value}'. "
                f"Expected keywords related to: {', '.join(sorted(keywords)[:5])}.",
            )

        # Basic sanity checks
        if len(option.label) > 500:
            return False, "Option label exceeds 500 characters."

        if option.rationale and len(option.rationale) > 2000:
            return False, "Option rationale exceeds 2000 characters."

        return True, ""

    def check_upstream_contradiction(
        self,
        option: SteeringOption,
        ledger: DecisionLedger,
    ) -> tuple[bool, str]:
        """Check whether the option contradicts any active upstream decision.

        Returns (has_contradiction, reason).
        """
        active_entries = [e for e in ledger.entries if e.status.value == "active"]

        for entry in active_entries:
            if entry.chosen_option is None:
                continue
            chosen = entry.chosen_option

            # Heuristic: same label with different rationale = potential contradiction
            if (
                chosen.label.lower().strip() == option.label.lower().strip()
                and chosen.rationale.lower().strip() != option.rationale.lower().strip()
            ):
                return (
                    True,
                    f"Option label matches a previous decision ({entry.decision_id}) "
                    f"but with a different rationale. Consider MODIFY instead.",
                )

            # Heuristic: direct negation keywords
            negation_pairs = [
                ("add", "remove"),
                ("include", "exclude"),
                ("enable", "disable"),
                ("public", "private"),
                ("human", "system"),
            ]
            option_words = set(option.label.lower().split())
            chosen_words = set(chosen.label.lower().split())
            for a, b in negation_pairs:
                if (a in option_words and b in chosen_words) or (
                    b in option_words and a in chosen_words
                ):
                    return (
                        True,
                        f"Option appears to contradict decision {entry.decision_id} "
                        f"('{chosen.label}').",
                    )

        return False, ""

    def validate(
        self,
        option: SteeringOption,
        stage: StageName,
        ledger: DecisionLedger,
    ) -> UserOptionIncoherent | None:
        """Full validation — returns None if valid, or a failure descriptor.

        This is the single entry-point used by the orchestrator before a
        CUSTOM_OPTION is added to the steering panel.
        """
        suggestions: list[str] = []

        # 1. Coherence check
        coherent, coherence_reason = self.validate_coherence(option, stage)
        if not coherent:
            suggestions.append(
                f"Revise the option to use language relevant to the '{stage.value}' stage."
            )
            return UserOptionIncoherent(
                option_text=option.label,
                failure_reason=coherence_reason,
                suggestions=suggestions,
            )

        # 2. Upstream contradiction check
        has_conflict, conflict_reason = self.check_upstream_contradiction(option, ledger)
        if has_conflict:
            suggestions.append(
                "Consider using MODIFY on the existing decision instead of creating a new option."
            )
            suggestions.append(
                "Alternatively, REVERT the conflicting decision first."
            )
            return UserOptionIncoherent(
                option_text=option.label,
                failure_reason=conflict_reason,
                suggestions=suggestions,
            )

        # Valid
        return None
