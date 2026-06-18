"""PRDAnalyzer — analyzes WELL_FORMED PRD inputs and returns PRDAnalysisReport.

Uses LLM to detect:
- Explicit sections (present and detailed)
- Thin sections (present but lacking specificity, with suggestions)
- Missing sections (entirely absent)
- Conflicting statements (internally inconsistent requirements)
- Assumption flags (unstated context assumptions)
- Unmapped input (sections not consumed by any stage)
- Detected compliance frameworks
"""
from __future__ import annotations

import re
import uuid
from typing import Any

from domain.input_processing.compliance_detector import ComplianceDetector
from domain.models import (
    AssumptionFlag,
    ConflictFlag,
    PRDAnalysisReport,
    RawUserInput,
    RichnessMode,
    UnmappedSection,
)
from infrastructure.llm.llm_provider import LLMClient


class PRDAnalyzer:
    """Analyzes well-formed PRD documents to produce a detailed analysis report.

    All analysis methods are async and use the LLM for intelligent detection.
    """

    # Standard PRD sections expected in a well-formed document
    PRD_SECTIONS: list[str] = [
        "Executive Summary",
        "Problem Statement",
        "Goals & Objectives",
        "Scope",
        "In-Scope",
        "Out-of-Scope",
        "Actors & Users",
        "User Personas",
        "Functional Requirements",
        "Non-Functional Requirements",
        "Performance Requirements",
        "Security Requirements",
        "Scalability",
        "Constraints",
        "Assumptions",
        "Dependencies",
        "Tech Stack",
        "Architecture",
        "Data Model",
        "API Design",
        "UI/UX",
        "Compliance",
        "Timeline",
        "Milestones",
        "Risk Assessment",
        "Success Criteria",
        "Acceptance Criteria",
        "Open Questions",
        "Appendix",
    ]

    # Mapping of sections to pipeline stages that consume them
    SECTION_TO_STAGE: dict[str, str | None] = {
        "Executive Summary": "prd_analysis",
        "Problem Statement": "ideation",
        "Goals & Objectives": "ideation",
        "Scope": None,  # general context, not stage-specific
        "In-Scope": "ideation",
        "Out-of-Scope": None,
        "Actors & Users": "actor_discovery",
        "User Personas": "actor_discovery",
        "Functional Requirements": "capability_discovery",
        "Non-Functional Requirements": "capability_discovery",
        "Performance Requirements": "capability_discovery",
        "Security Requirements": "capability_discovery",
        "Scalability": "capability_discovery",
        "Constraints": "ideation",
        "Assumptions": None,
        "Dependencies": None,
        "Tech Stack": "prd_analysis",
        "Architecture": "task_decomposition",
        "Data Model": "capability_discovery",
        "API Design": "task_decomposition",
        "UI/UX": "task_decomposition",
        "Compliance": "actor_discovery",
        "Timeline": None,
        "Milestones": None,
        "Risk Assessment": "ideation",
        "Success Criteria": "story_discovery",
        "Acceptance Criteria": "story_discovery",
        "Open Questions": None,
        "Appendix": None,
    }

    def __init__(self, llm_client: LLMClient | None = None) -> None:
        self._llm = llm_client
        self._compliance = ComplianceDetector()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def analyze(self, raw_input: RawUserInput) -> PRDAnalysisReport:
        """Analyze a WELL_FORMED PRD input and produce a detailed report.

        Raises ValueError if the input is not marked as WELL_FORMED.
        """
        if raw_input.richness_mode != RichnessMode.WELL_FORMED:
            raise ValueError(
                f"PRDAnalyzer expects RichnessMode.WELL_FORMED, got {raw_input.richness_mode}"
            )

        text = raw_input.text
        basis: list[str] = []

        # --- Step 1: Section analysis ------------------------------------
        explicit_sections: list[dict[str, Any]] = []
        thin_sections: list[dict[str, Any]] = []
        missing_sections: list[dict[str, Any]] = []

        detected_sections = self._detect_sections(text)
        basis.append(f"detected_sections: {len(detected_sections)}/{len(self.PRD_SECTIONS)}")

        for section_name in self.PRD_SECTIONS:
            section_text = detected_sections.get(section_name, "")
            if section_text:
                # Check if section is detailed or thin
                word_count = len(section_text.split())
                if word_count >= 30:
                    explicit_sections.append({
                        "section_name": section_name,
                        "word_count": word_count,
                        "status": "detailed",
                    })
                else:
                    thin_section_info: dict[str, Any] = {
                        "section_name": section_name,
                        "word_count": word_count,
                        "status": "thin",
                        "suggestion": f"Expand {section_name} with more detail (currently ~{word_count} words)",
                    }
                    # Use LLM for better suggestions if available
                    if self._llm is not None:
                        try:
                            suggestion = await self._thin_section_suggestion(section_name, section_text)
                            thin_section_info["suggestion"] = suggestion
                        except Exception:
                            pass
                    thin_sections.append(thin_section_info)
            else:
                missing_sections.append({
                    "section_name": section_name,
                    "status": "missing",
                    "suggested_stage": self.SECTION_TO_STAGE.get(section_name),
                })

        # --- Step 2: LLM-powered thin section detection ------------------
        if self._llm is not None:
            try:
                llm_thin = await self._detect_thin_sections(text)
                # Merge LLM thin detections with heuristic ones
                existing_thin_names = {s["section_name"] for s in thin_sections}
                for thin in llm_thin:
                    if thin.get("section_name") not in existing_thin_names:
                        thin_sections.append(thin)
                basis.append(f"llm_thin_sections: {len(llm_thin)} detected")
            except Exception as e:
                basis.append(f"llm_thin_sections: failed ({e})")

        # --- Step 3: Conflict detection ----------------------------------
        conflicts: list[ConflictFlag] = []
        if self._llm is not None:
            try:
                conflicts = await self._detect_conflicts(text)
                basis.append(f"conflicts_detected: {len(conflicts)}")
            except Exception as e:
                basis.append(f"conflict_detection: failed ({e})")

        # --- Step 4: Assumption detection --------------------------------
        assumptions: list[AssumptionFlag] = []
        if self._llm is not None:
            try:
                assumptions = await self._detect_assumptions(text)
                basis.append(f"assumptions_detected: {len(assumptions)}")
            except Exception as e:
                basis.append(f"assumption_detection: failed ({e})")

        # --- Step 5: Unmapped input detection ----------------------------
        unmapped = self._detect_unmapped_sections(detected_sections)
        basis.append(f"unmapped_sections: {len(unmapped)}")

        # --- Step 6: Compliance detection --------------------------------
        compliance_frameworks = self._compliance.detect(text)
        if compliance_frameworks:
            basis.append(f"compliance: {', '.join(compliance_frameworks)}")

        return PRDAnalysisReport(
            explicit_sections=explicit_sections,
            thin_sections=thin_sections,
            missing_sections=missing_sections,
            conflicts=conflicts,
            unmapped_input=unmapped,
            assumption_flags=assumptions,
            detected_compliance_frameworks=compliance_frameworks,
            classification_basis=basis,
        )

    # ------------------------------------------------------------------
    # LLM-powered thin section detection
    # ------------------------------------------------------------------

    async def _detect_thin_sections(self, text: str) -> list[dict[str, Any]]:
        """Use LLM to identify sections that are present but lack sufficient detail.

        Returns list of dicts with keys: section_name, reason, suggestion.
        """
        if self._llm is None:
            return []

        prompt = (
            "Analyze the following PRD document. Identify any sections that are present "
            "but lack sufficient detail or specificity. For each thin section, provide:\n"
            "- section_name: the name of the section\n"
            "- reason: why it is considered thin\n"
            "- suggestion: what specific information should be added\n"
            "Return a JSON array of objects. If no thin sections, return an empty array.\n\n"
            f"PRD:\n{text[:6000]}\n"
        )

        from pydantic import BaseModel, Field

        class _ThinSection(BaseModel):
            section_name: str = ""
            reason: str = ""
            suggestion: str = ""

        class _ThinSectionsResult(BaseModel):
            thin_sections: list[_ThinSection] = Field(default_factory=list)

        result = await self._llm.complete_structured(prompt, _ThinSectionsResult, temperature=0.3)
        return [
            {
                "section_name": ts.section_name,
                "word_count": 0,
                "status": "thin",
                "suggestion": f"{ts.reason}: {ts.suggestion}",
            }
            for ts in result.thin_sections
        ]

    # ------------------------------------------------------------------
    # Conflict detection
    # ------------------------------------------------------------------

    async def _detect_conflicts(self, text: str) -> list[ConflictFlag]:
        """Use LLM to find internally inconsistent or conflicting requirements.

        Returns list of ConflictFlag objects.
        """
        if self._llm is None:
            return []

        prompt = (
            "Analyze the following PRD document for internally inconsistent or "
            "conflicting requirements. Look for:\n"
            "- Contradictory constraints (e.g., 'must be real-time' and 'batch processing only')\n"
            "- Conflicting timelines or resource allocations\n"
            "- Contradictory security or compliance requirements\n"
            "- Scope conflicts (in-scope vs out-of-scope contradictions)\n"
            "For each conflict found, return an object with:\n"
            "- description: summary of the conflict\n"
            "- statement_a: first conflicting statement\n"
            "- statement_b: second conflicting statement\n"
            "- severity: either 'blocking' or 'warning'\n"
            "Return a JSON array of conflicts. If no conflicts, return an empty array.\n\n"
            f"PRD:\n{text[:6000]}\n"
        )

        from pydantic import BaseModel, Field

        class _ConflictEntry(BaseModel):
            description: str = ""
            statement_a: str = ""
            statement_b: str = ""
            severity: str = "warning"

        class _ConflictsResult(BaseModel):
            conflicts: list[_ConflictEntry] = Field(default_factory=list)

        result = await self._llm.complete_structured(prompt, _ConflictsResult, temperature=0.3)
        return [
            ConflictFlag(
                flag_id=f"conflict_{uuid.uuid4().hex[:8]}",
                description=c.description,
                statement_a=c.statement_a,
                statement_b=c.statement_b,
                severity=c.severity,  # type: ignore[arg-type]
            )
            for c in result.conflicts
        ]

    # ------------------------------------------------------------------
    # Assumption detection
    # ------------------------------------------------------------------

    async def _detect_assumptions(self, text: str) -> list[AssumptionFlag]:
        """Use LLM to find unstated context assumptions in the PRD.

        Returns list of AssumptionFlag objects.
        """
        if self._llm is None:
            return []

        prompt = (
            "Analyze the following PRD document for unstated assumptions that the "
            "authors appear to be making. Look for:\n"
            "- Implicit assumptions about user behavior or technical environment\n"
            "- Unstated dependencies on external systems or services\n"
            "- Assumed organizational context (team size, budget, timeline)\n"
            "- Assumed regulatory or compliance context\n"
            "- Implicit technology choices not explicitly documented\n"
            "For each assumption, return an object with:\n"
            "- description: what is being assumed\n"
            "- assumed_context: the specific context being assumed\n"
            "- user_acknowledgement_required: whether user should confirm this\n"
            "Return a JSON array. If no assumptions found, return an empty array.\n\n"
            f"PRD:\n{text[:6000]}\n"
        )

        from pydantic import BaseModel, Field

        class _AssumptionEntry(BaseModel):
            description: str = ""
            assumed_context: str = ""
            user_acknowledgement_required: bool = True

        class _AssumptionsResult(BaseModel):
            assumptions: list[_AssumptionEntry] = Field(default_factory=list)

        result = await self._llm.complete_structured(prompt, _AssumptionsResult, temperature=0.3)
        return [
            AssumptionFlag(
                flag_id=f"assumption_{uuid.uuid4().hex[:8]}",
                description=a.description,
                assumed_context=a.assumed_context,
                user_acknowledgement_required=a.user_acknowledgement_required,
            )
            for a in result.assumptions
        ]

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _detect_sections(self, text: str) -> dict[str, str]:
        """Detect PRD sections by header patterns and extract their content.

        Returns a mapping of section name → section content.
        """
        sections: dict[str, str] = {}

        # Try multiple header patterns
        for section_name in self.PRD_SECTIONS:
            # Pattern 1: Markdown headers (## Section Name)
            pattern_md = r"#{1,3}\s*" + re.escape(section_name) + r"\s*\n(.*?)(?=\n#{1,3}\s|\Z)"
            match = re.search(pattern_md, text, re.IGNORECASE | re.DOTALL)
            if match:
                sections[section_name] = match.group(1).strip()
                continue

            # Pattern 2: Bold headers (**Section Name**)
            pattern_bold = r"\*\*\s*" + re.escape(section_name) + r"\s*\*\*\s*\n(.*?)(?=\n\*\*|\Z)"
            match = re.search(pattern_bold, text, re.IGNORECASE | re.DOTALL)
            if match:
                sections[section_name] = match.group(1).strip()
                continue

            # Pattern 3: Section Name followed by colon or newline
            pattern_plain = r"\b" + re.escape(section_name) + r"[\s:]*\n(.*?)(?=\n\w+\s*\n|\Z)"
            match = re.search(pattern_plain, text, re.IGNORECASE | re.DOTALL)
            if match:
                sections[section_name] = match.group(1).strip()
                continue

            # Pattern 4: Numbered sections (1. Section Name)
            pattern_numbered = r"\d+\.\s*" + re.escape(section_name) + r"\s*\n(.*?)(?=\n\d+\.\s|\Z)"
            match = re.search(pattern_numbered, text, re.IGNORECASE | re.DOTALL)
            if match:
                sections[section_name] = match.group(1).strip()
                continue

        return sections

    def _detect_unmapped_sections(self, detected_sections: dict[str, str]) -> list[UnmappedSection]:
        """Find sections that don't map to any known pipeline stage."""
        unmapped: list[UnmappedSection] = []
        for section_name, content in detected_sections.items():
            stage = self.SECTION_TO_STAGE.get(section_name)
            if stage is None and len(content) > 20:
                unmapped.append(
                    UnmappedSection(
                        section_id=f"unmapped_{uuid.uuid4().hex[:8]}",
                        title=section_name,
                        raw_text=content[:500],
                        suggested_stage=None,
                        user_action="pending",
                    )
                )
        return unmapped

    async def _thin_section_suggestion(self, section_name: str, section_text: str) -> str:
        """Ask LLM for a specific suggestion to improve a thin section."""
        if self._llm is None:
            return f"Expand {section_name} with more specific detail"

        prompt = (
            f"The PRD section '{section_name}' is under-specified. Current content:\n"
            f"{section_text[:500]}\n\n"
            f"Provide a brief, actionable suggestion (1-2 sentences) for what should be added."
        )
        try:
            suggestion = await self._llm.complete(prompt, temperature=0.5, max_tokens=150)
            return suggestion.strip()
        except Exception:
            return f"Expand {section_name} with more specific detail"
