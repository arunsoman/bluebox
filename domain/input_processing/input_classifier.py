"""InputClassifier — classifies RawUserInput into RichnessMode.

Classification logic:
- WELL_FORMED: ≥2 explicit actors, ≥3 capabilities, NFR presence, tech stack signals
- MINIMALIST: some structure but insufficient richness for WELL_FORMED
- SEED_ONLY: minimal or no structured content

Includes ComplianceDetector sub-component for GDPR/HIPAA/PCI/SOC2/CCPA scanning.
All LLM-dependent methods are async.
"""
from __future__ import annotations

import json
import uuid
from typing import Any

from domain.input_processing.compliance_detector import ComplianceDetector
from domain.models import (
    AuditPolicy,
    CapabilityLens,
    Confidence,
    RawUserInput,
    RichnessClassification,
    RichnessMode,
)
from infrastructure.llm.llm_provider import LLMClient


class InputClassifier:
    """Classifies raw user input into one of three RichnessMode levels.

    Uses heuristics + LLM signal extraction to determine whether the input
    is WELL_FORMED (rich PRD), MINIMALIST (partial structure), or SEED_ONLY
    (minimal content requiring full dialogue).
    """

    # Thresholds for WELL_FORMED classification
    ACTOR_THRESHOLD: int = 2
    CAPABILITY_THRESHOLD: int = 3

    # Standard PRD section names used for structural analysis
    EXPECTED_PRD_SECTIONS: list[str] = [
        "overview",
        "objectives",
        "scope",
        "actors",
        "users",
        "stakeholders",
        "functional requirements",
        "non-functional requirements",
        "nfr",
        "constraints",
        "assumptions",
        "dependencies",
        "tech stack",
        "technology",
        "architecture",
        "data model",
        "security",
        "compliance",
        "timeline",
        "milestones",
        "acceptance criteria",
        "success criteria",
        "risks",
        "open questions",
        "appendix",
    ]

    def __init__(self, llm_client: LLMClient | None = None) -> None:
        self._llm = llm_client
        self._compliance = ComplianceDetector()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def classify(self, raw_input: RawUserInput) -> RichnessClassification:
        """Classify *raw_input* into a RichnessMode with supporting evidence.

        Returns RichnessClassification with classification_basis (list of reasons).
        """
        text = raw_input.text
        basis: list[str] = []
        gaps: list[str] = []

        # --- Step 1: Structural heuristics (fast, no LLM) ----------------
        text_lower = text.lower()
        section_hits = self._count_section_hits(text_lower)
        section_ratio = section_hits / len(self.EXPECTED_PRD_SECTIONS)

        # --- Step 2: LLM signal extraction (async) -----------------------
        signals: dict[str, Any] = {"actors": 0, "capabilities": 0, "nfr_present": False, "tech_stack": False}
        if self._llm is not None:
            try:
                signals = await self._scan_signals(text)
                basis.append(f"llm_signal_scan: actors={signals.get('actors', 0)}, capabilities={signals.get('capabilities', 0)}")
            except Exception:
                # Fallback to heuristic counting if LLM fails
                basis.append("llm_signal_scan: failed, using heuristics")
                signals["actors"] = self._heuristic_actor_count(text_lower)
                signals["capabilities"] = self._heuristic_capability_count(text_lower)
                signals["nfr_present"] = self._heuristic_nfr_check(text_lower)
                signals["tech_stack"] = self._heuristic_tech_stack_check(text_lower)
        else:
            basis.append("llm_signal_scan: no_llm_client, using heuristics")
            signals["actors"] = self._heuristic_actor_count(text_lower)
            signals["capabilities"] = self._heuristic_capability_count(text_lower)
            signals["nfr_present"] = self._heuristic_nfr_check(text_lower)
            signals["tech_stack"] = self._heuristic_tech_stack_check(text_lower)

        # --- Step 3: Compliance detection --------------------------------
        compliance_frameworks = self._compliance.detect(text)
        if compliance_frameworks:
            basis.append(f"compliance_detected: {', '.join(compliance_frameworks)}")

        # --- Step 4: Richness mode determination -------------------------
        actor_count = signals.get("actors", 0)
        capability_count = signals.get("capabilities", 0)
        nfr_present = signals.get("nfr_present", False)
        tech_stack = signals.get("tech_stack", False)

        # WELL_FORMED: meets all thresholds
        if (
            actor_count >= self.ACTOR_THRESHOLD
            and capability_count >= self.CAPABILITY_THRESHOLD
            and nfr_present
            and tech_stack
            and section_ratio >= 0.3
        ):
            mode = RichnessMode.WELL_FORMED
            basis.append(
                f"well_formed: actors={actor_count}>={self.ACTOR_THRESHOLD}, "
                f"capabilities={capability_count}>={self.CAPABILITY_THRESHOLD}, "
                f"nfr={nfr_present}, tech_stack={tech_stack}, "
                f"section_ratio={section_ratio:.2f}"
            )

        # MINIMALIST: has some structure but not enough for WELL_FORMED
        elif (
            (actor_count >= 1 or capability_count >= 1)
            or section_ratio >= 0.15
            or (nfr_present or tech_stack)
        ):
            mode = RichnessMode.MINIMALIST
            basis.append(
                f"minimalist: actors={actor_count}, capabilities={capability_count}, "
                f"nfr={nfr_present}, tech_stack={tech_stack}, "
                f"section_ratio={section_ratio:.2f}"
            )
            if actor_count < self.ACTOR_THRESHOLD:
                gaps.append(f"actors below threshold: {actor_count}/{self.ACTOR_THRESHOLD}")
            if capability_count < self.CAPABILITY_THRESHOLD:
                gaps.append(f"capabilities below threshold: {capability_count}/{self.CAPABILITY_THRESHOLD}")
            if not nfr_present:
                gaps.append("no NFR signals detected")
            if not tech_stack:
                gaps.append("no tech stack signals detected")

        # SEED_ONLY: minimal content
        else:
            mode = RichnessMode.SEED_ONLY
            basis.append(
                f"seed_only: actors={actor_count}, capabilities={capability_count}, "
                f"nfr={nfr_present}, tech_stack={tech_stack}, "
                f"section_ratio={section_ratio:.2f}"
            )
            gaps.append("insufficient structured content for WELL_FORMED or MINIMALIST")

        return RichnessClassification(
            mode=mode,
            confidence=Confidence.HIGH if self._llm is not None else Confidence.MEDIUM,
            classification_basis=basis,
            gaps=gaps,
        )

    # ------------------------------------------------------------------
    # LLM-based signal extraction
    # ------------------------------------------------------------------

    async def _scan_signals(self, text: str) -> dict[str, Any]:
        """Use LLM to extract richness signals from text.

        Returns dict with keys: actors, capabilities, nfr_present, tech_stack.
        """
        if self._llm is None:
            raise RuntimeError("LLMClient not configured for signal scanning")

        prompt = (
            "Analyze the following product requirements text and return a JSON object with these exact keys:\n"
            "- actors: integer count of distinct user/actor types explicitly mentioned (e.g., 'admin', 'customer', 'vendor')\n"
            "- capabilities: integer count of distinct functional capabilities described (e.g., 'search', 'checkout', 'notifications')\n"
            "- nfr_present: boolean, true if any non-functional requirements are mentioned (performance, scalability, security, availability, etc.)\n"
            "- tech_stack: boolean, true if any technology choices are mentioned (programming languages, frameworks, databases, cloud providers, etc.)\n"
            "\nText to analyze:\n"
            f"{text[:8000]}\n"
        )

        # Define a simple schema for the structured output
        from pydantic import BaseModel

        class _SignalScan(BaseModel):
            actors: int = 0
            capabilities: int = 0
            nfr_present: bool = False
            tech_stack: bool = False

        result = await self._llm.complete_structured(prompt, _SignalScan, temperature=0.3)
        return {
            "actors": result.actors,
            "capabilities": result.capabilities,
            "nfr_present": result.nfr_present,
            "tech_stack": result.tech_stack,
        }

    # ------------------------------------------------------------------
    # Compliance detection
    # ------------------------------------------------------------------

    def _detect_compliance(self, text: str) -> list[str]:
        """Scan text for compliance framework signals.

        Returns list of detected framework names (e.g., ['GDPR', 'HIPAA']).
        """
        return self._compliance.detect(text)

    def get_compliance_defaults(self, frameworks: list[str]) -> AuditPolicy:
        """Get merged AuditPolicy defaults for detected compliance frameworks."""
        return self._compliance.get_defaults(frameworks)

    # ------------------------------------------------------------------
    # Heuristic fallbacks (used when LLM is unavailable)
    # ------------------------------------------------------------------

    def _count_section_hits(self, text_lower: str) -> int:
        """Count how many expected PRD section headers appear in the text."""
        hits = 0
        for section in self.EXPECTED_PRD_SECTIONS:
            # Look for section-like patterns: heading markers, numbered sections, or standalone lines
            patterns = [
                f"\\b{re.escape(section)}\\b",
                f"#{re.escape(section)}",
                f"\\*\\*{re.escape(section)}\\*\\*",
            ]
            for pat in patterns:
                if re.search(pat, text_lower):
                    hits += 1
                    break
            else:
                # Check standalone mention
                if section in text_lower:
                    hits += 1
        return hits

    def _heuristic_actor_count(self, text_lower: str) -> int:
        """Heuristic: count likely actor mentions by keyword patterns."""
        actor_keywords = [
            r"\\b(admin|administrator)s?\\b",
            r"\\b(user|end-user|end user)s?\\b",
            r"\\b(customer|buyer|shopper|consumer)s?\\b",
            r"\\b(vendor|supplier|merchant|seller)s?\\b",
            r"\\b(manager|supervisor|operator)s?\\b",
            r"\\b(guest|visitor|anonymous user)s?\\b",
            r"\\b(api|system|service|integration)s?\\b",
            r"\\b(patient|doctor|physician|nurse|clinician)s?\\b",
            r"\\b(student|teacher|instructor|learner)s?\\b",
            r"\\b(employee|staff|worker|agent)s?\\b",
        ]
        found = 0
        for pat in actor_keywords:
            if re.search(pat, text_lower):
                found += 1
        return min(found, 10)  # Cap at 10

    def _heuristic_capability_count(self, text_lower: str) -> int:
        """Heuristic: count likely capability mentions."""
        capability_keywords = [
            r"\\b(authentication|login|signin|sso|oauth)s?\\b",
            r"\\b(search|filter|sort|query)s?\\b",
            r"\\b(notification|alert|email|push|sms)s?\\b",
            r"\\b(payment|checkout|billing|invoice|subscription)s?\\b",
            r"\\b(report|analytics|dashboard|metric|kpi)s?\\b",
            r"\\b(import|export|upload|download|sync)s?\\b",
            r"\\b(workflow|approval|review|validation)s?\\b",
            r"\\b(chat|message|comment|feed|stream)s?\\b",
            r"\\b(integration|api|webhook|connector)s?\\b",
            r"\\b(schedule|calendar|booking|reservation|appointment)s?\\b",
            r"\\b(cart|order|fulfillment|shipping|delivery|tracking)s?\\b",
            r"\\b(user management|role|permission|access control)s?\\b",
        ]
        found = 0
        for pat in capability_keywords:
            if re.search(pat, text_lower):
                found += 1
        return min(found, 15)  # Cap at 15

    def _heuristic_nfr_check(self, text_lower: str) -> bool:
        """Heuristic: check if NFR keywords are present."""
        nfr_keywords = [
            r"\\b(performance|latency|throughput|response time|speed)s?\\b",
            r"\\b(scalab|concurrent|load|traffic|capacity)\\w*\\b",
            r"\\b(availability|uptime|sla|reliability|durability)s?\\b",
            r"\\b(security|encryption|auth|audit|compliance|gdpr|hipaa)s?\\b",
            r"\\b(usability|accessibility|ux|ui|experience)s?\\b",
            r"\\b(maintainability|monitoring|logging|observability)s?\\b",
            r"\\b(backup|disaster recovery|dr|failover|redundancy)s?\\b",
            r"\\b(localization|i18n|international|language|locale)s?\\b",
        ]
        return any(re.search(kw, text_lower) for kw in nfr_keywords)

    def _heuristic_tech_stack_check(self, text_lower: str) -> bool:
        """Heuristic: check if tech stack keywords are present."""
        tech_keywords = [
            r"\\b(react|angular|vue|svelte|next\\.js|nuxt)\\b",
            r"\\b(node\\.js|python|java|go|golang|rust|dotnet|\\.net|ruby|php)\\b",
            r"\\b(postgresql|mysql|mongodb|dynamodb|redis|elasticsearch|cassandra)\\b",
            r"\\b(aws|azure|gcp|google cloud|firebase|heroku|vercel)\\b",
            r"\\b(docker|kubernetes|k8s|terraform|ansible|jenkins|github actions)\\b",
            r"\\b(graphql|rest|grpc|soap|websocket|kafka|rabbitmq)\\b",
            r"\\b(terraform|pulumi|cloudformation|serverless|lambda)\\b",
            r"\\b(typescript|javascript|jsx|tsx|es6|babel|webpack)\\b",
            r"\\b(sql|nosql|orm|prisma|sqlalchemy|hibernate)\\b",
            r"\\b(microservice|monolith|serverless|soa|event-driven)\\b",
        ]
        return any(re.search(kw, text_lower) for kw in tech_keywords)

import re
