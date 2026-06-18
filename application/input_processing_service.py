"""InputProcessingService -- coordinates input classification, PRD analysis,
minimalist dialogue, and seed building.

Delegates to domain-level services for the actual LLM-driven work while
managing session state persistence and event emission.
"""
from __future__ import annotations

from domain.models import (
    RichnessClassification,
    RichnessMode,
    Confidence,
    PRDAnalysisReport,
    MinimalistQuestion,
    ProjectBlueprintSeed,
    RawUserInput,
    ProblemDefinitionSeed,
    IdeaSeed,
    ActorSeed,
    CapabilitySeed,
    UseCaseSeed,
    UserStorySeed,
    TechStackSignal,
    ScaleInputs,
    TargetCustomerProfile,
)
from domain.state_management.pipeline_state import PipelineStateManager
from infrastructure.llm.llm_provider import LLMClient
from infrastructure.messaging.sse_manager import sse_manager


class InputProcessingService:
    """Coordinates input processing: classify -> analyze/dialogue -> build seed."""

    def __init__(
        self,
        state_manager: PipelineStateManager | None = None,
        llm_client: LLMClient | None = None,
    ):
        self._state = state_manager or PipelineStateManager()
        self._llm = llm_client
    # ------------------------------------------------------------------ #
    # Main entry point
    # ------------------------------------------------------------------ #

    async def process_input(self, session_id: str, text: str, source: str = "chat") -> RichnessClassification:
        """Process raw user input: classify richness and store.

        Args:
            session_id: Pipeline session ID.
            text: Raw input text.
            source: Input source (chat, file_upload, api).

        Returns:
            RichnessClassification with detected mode.
        """
        raw_input = RawUserInput(text=text, source=source)  # type: ignore[arg-type]

        # Store input in session state
        await self._state.update_state(
            session_id,
            {
                "last_input": text,
                "input_source": source,
                "input_timestamp": __import__("datetime").datetime.utcnow().isoformat(),
            },
        )

        # Perform classification
        classification = self._classify_input(text, source)

        # Store classification result
        await self._state.update_state(
            session_id,
            {"richness_classification": classification.model_dump(mode="json")},
        )

        # Emit event
        await sse_manager.emit_richness_mode(
            session_id,
            classification.mode.value,
            classification.confidence.value,
            classification.classification_basis,
        )

        return classification

    # ------------------------------------------------------------------ #
    # PRD Analysis
    # ------------------------------------------------------------------ #

    async def analyze_prd(self, session_id: str, text: str) -> PRDAnalysisReport:
        """Analyze a PRD-style document for explicit/inferred fields, gaps, etc.

        Args:
            session_id: Pipeline session ID.
            text: The PRD text to analyze.

        Returns:
            PRDAnalysisReport with findings.
        """
        # Build a real analysis report based on the input text
        report = self._build_prd_analysis(text)

        # Store report in session state
        await self._state.update_state(
            session_id,
            {"prd_analysis_report": report.model_dump(mode="json")},
        )

        # Emit event
        await sse_manager.emit_prd_analysis(session_id, report.model_dump(mode="json"))

        return report

    # ------------------------------------------------------------------ #
    # Minimalist Dialogue
    # ------------------------------------------------------------------ #

    async def run_dialogue(self, session_id: str, text: str) -> list[MinimalistQuestion]:
        """Run the minimalist dialogue to extract seed info from sparse input.

        Args:
            session_id: Pipeline session ID.
            text: The sparse input text.

        Returns:
            List of MinimalistQuestions to present to the user.
        """
        import uuid

        questions = self._generate_questions(text)

        # Store in session state
        await self._state.update_state(
            session_id,
            {
                "minimalist_questions": [q.model_dump(mode="json") for q in questions],
                "minimalist_answers": {},
            },
        )

        # Emit
        await sse_manager.emit_scale_dialogue(
            session_id, [q.model_dump(mode="json") for q in questions]
        )

        return questions

    async def submit_dialogue_answer(self, session_id: str, question_id: str, answer: str) -> None:
        """Submit an answer to a minimalist dialogue question.

        Args:
            session_id: Pipeline session ID.
            question_id: The question being answered.
            answer: The user's answer.
        """
        state = await self._state.get_state(session_id)
        answers = dict(state.get("minimalist_answers", {}))
        answers[question_id] = answer
        await self._state.update_state(session_id, {"minimalist_answers": answers})

    # ------------------------------------------------------------------ #
    # Seed Building
    # ------------------------------------------------------------------ #

    async def build_seed(self, session_id: str) -> ProjectBlueprintSeed:
        """Build a project blueprint seed from all collected input.

        Combines PRD analysis results, minimalist dialogue answers, and
        direct input into a structured ProjectBlueprintSeed.

        Args:
            session_id: Pipeline session ID.

        Returns:
            ProjectBlueprintSeed with extracted information.
        """
        import uuid

        state = await self._state.get_state(session_id)
        last_input = state.get("last_input", "")
        classification_data = state.get("richness_classification", {})
        prd_report_data = state.get("prd_analysis_report", {})
        answers = state.get("minimalist_answers", {})
        scale_inputs_data = state.get("scale_inputs", {})

        # Build problem seed
        problem_seed = ProblemDefinitionSeed(
            problem_statement=last_input[:500] if last_input else "",
            constraints=[],
            target_customer=TargetCustomerProfile(
                segment=answers.get("user_base", ""),
                user_count_estimate=answers.get("scale_intent", ""),
            ),
            scale_inputs=ScaleInputs(**scale_inputs_data) if scale_inputs_data else None,
        )

        # Build tech stack signal from input
        tech_signal = self._detect_tech_signals(last_input)

        # Build the full seed
        seed = ProjectBlueprintSeed(
            seed_id=f"seed-{session_id[:8]}",
            project_name=state.get("project_name", ""),
            problem_seed=problem_seed,
            idea_seeds=[],
            actor_seeds=[],
            capability_seeds=[],
            use_case_seeds=[],
            user_story_seeds=[],
            tech_stack_signal=tech_signal,
            extraction_report=self._build_extraction_report(last_input, prd_report_data),
            richness_mode=RichnessMode(classification_data.get("mode", "SEED_ONLY")),
        )

        # Store seed in session state
        await self._state.update_state(
            session_id, {"project_seed": seed.model_dump(mode="json")}
        )

        return seed

    # ------------------------------------------------------------------ #
    # Internal helpers
    # ------------------------------------------------------------------ #

    @staticmethod
    def _classify_input(text: str, source: str) -> RichnessClassification:
        """Classify input richness based on content heuristics."""
        length = len(text)
        basis: list[str] = []

        if length > 2000:
            mode = RichnessMode.WELL_FORMED
            basis.append(f"Long input ({length} chars) suggests well-formed PRD")
        elif length > 500:
            mode = RichnessMode.MINIMALIST
            basis.append(f"Medium input ({length} chars) suggests minimalist mode")
        else:
            mode = RichnessMode.SEED_ONLY
            basis.append(f"Short input ({length} chars) -- seed-only capture")

        if source == "file_upload":
            basis.append("File upload typically contains structured content")

        confidence = Confidence.HIGH if length > 1000 else Confidence.MEDIUM

        return RichnessClassification(
            mode=mode,
            confidence=confidence,
            classification_basis=basis,
            gaps=[],
        )

    @staticmethod
    def _build_prd_analysis(text: str) -> PRDAnalysisReport:
        """Build a PRD analysis report from the input text."""
        import uuid

        explicit_sections: list[dict] = []
        thin_sections: list[dict] = []
        missing_sections: list[dict] = []

        # Identify explicit sections
        section_markers = [
            ("overview", "Overview"),
            ("scope", "Scope"),
            ("requirement", "Requirements"),
            ("functional", "Functional Requirements"),
            ("non-functional", "Non-Functional Requirements"),
            ("user story", "User Stories"),
            ("use case", "Use Cases"),
            ("actor", "Actors"),
            ("security", "Security"),
            ("performance", "Performance"),
            ("constraint", "Constraints"),
            ("assumption", "Assumptions"),
        ]

        text_lower = text.lower()
        found_markers: list[str] = []

        for marker, label in section_markers:
            if marker in text_lower:
                explicit_sections.append({
                    "section_id": str(uuid.uuid4()),
                    "title": label,
                    "marker": marker,
                    "found": True,
                })
                found_markers.append(label)
            else:
                missing_sections.append({
                    "section_id": str(uuid.uuid4()),
                    "title": label,
                    "marker": marker,
                    "expected": True,
                })

        # Detect compliance frameworks
        compliance_frameworks: list[str] = []
        compliance_markers = {
            "gdpr": "GDPR",
            "hipaa": "HIPAA",
            "soc2": "SOC 2",
            "iso27001": "ISO 27001",
            "pci-dss": "PCI-DSS",
            "ccpa": "CCPA",
        }
        for marker, framework in compliance_markers.items():
            if marker in text_lower:
                compliance_frameworks.append(framework)

        # Classification basis
        classification_basis = [
            f"Found {len(explicit_sections)} explicit sections",
            f"Missing {len(missing_sections)} expected sections",
        ]
        if compliance_frameworks:
            classification_basis.append(f"Detected compliance: {', '.join(compliance_frameworks)}")

        return PRDAnalysisReport(
            explicit_sections=explicit_sections,
            thin_sections=thin_sections,
            missing_sections=missing_sections,
            conflicts=[],
            unmapped_input=[],
            assumption_flags=[],
            detected_compliance_frameworks=compliance_frameworks,
            classification_basis=classification_basis,
        )

    @staticmethod
    def _generate_questions(text: str) -> list[MinimalistQuestion]:
        """Generate minimalist dialogue questions based on sparse input."""
        import uuid

        dimensions = [
            ("problem_scope", "What problem are you trying to solve?"),
            ("user_base", "Who are the primary users of this product?"),
            ("scale_intent", "How many users do you expect at launch and within year 1?"),
            ("monetization", "How will this product generate revenue (if at all)?"),
            ("constraints", "What are the key constraints (budget, timeline, technology)?"),
            ("success_definition", "How will you measure success for this product?"),
        ]

        questions = []
        for dim, qtext in dimensions:
            questions.append(
                MinimalistQuestion(
                    question_id=str(uuid.uuid4()),
                    dimension=dim,
                    question_text=qtext,
                )
            )
        return questions

    @staticmethod
    def _detect_tech_signals(text: str) -> TechStackSignal | None:
        """Detect technology references in the input text."""
        import uuid

        tech_keywords = {
            "react", "vue", "angular", "svelte", "next.js", "nuxt",
            "python", "javascript", "typescript", "java", "go", "rust",
            "node.js", "django", "flask", "fastapi", "spring",
            "postgresql", "mysql", "mongodb", "redis", "dynamodb",
            "aws", "gcp", "azure", "docker", "kubernetes", "terraform",
            "graphql", "rest", "grpc", "kafka", "rabbitmq",
        }

        text_lower = text.lower()
        detected = [kw for kw in tech_keywords if kw in text_lower]

        if detected:
            return TechStackSignal(
                signal_id=str(uuid.uuid4()),
                detected_technologies=detected,
                detection_source="input_text",
                confidence=Confidence.HIGH if len(detected) > 3 else Confidence.MEDIUM,
            )
        return None

    @staticmethod
    def _build_extraction_report(text: str, prd_report_data: dict) -> "ExtractionReport":
        """Build an extraction report from input analysis."""
        from domain.models import ExtractionReport, Confidence

        return ExtractionReport(
            explicit_fields={"input_length": str(len(text))},
            inferred_fields={},
            candidate_fields={},
            gaps=[],
            confidence=Confidence.MEDIUM,
            confidence_basis="Automated extraction from user input",
        )
