"""SeedBuilder — builds ProjectBlueprintSeed from dialogue results or PRD analysis.

Two main entry points:
- build_from_dialogue: constructs a seed from MinimalistDialogueResult
- build_from_prd: constructs a seed from a WELL_FORMED PRD + PRDAnalysisReport

Uses LLM for extraction of structured entities (actors, capabilities, use cases,
user stories, ideas) from raw text.
"""
from __future__ import annotations

import uuid
from typing import Any

from domain.models import (
    ActorSeed,
    AuditPolicy,
    CapabilitySeed,
    Confidence,
    ExtractionReport,
    IdeaSeed,
    InfrastructureProfile,
    MinimalistDialogueResult,
    PRDAnalysisReport,
    ProblemDefinitionSeed,
    ProjectBlueprintSeed,
    RawUserInput,
    RichnessMode,
    ScaleInputs,
    TargetCustomerProfile,
    TechStackSignal,
    Traceability,
    UseCaseSeed,
    UserStorySeed,
)
from infrastructure.llm.llm_provider import LLMClient


class SeedBuilder:
    """Builds ProjectBlueprintSeed from various input sources.

    All extraction methods use LLM for real, computed output — no mock data.
    """

    def __init__(self, llm_client: LLMClient | None = None) -> None:
        self._llm = llm_client

    # ═══════════════════════════════════════════════════════════════════
    # Public API
    # ═══════════════════════════════════════════════════════════════════

    async def build_from_dialogue(
        self, result: MinimalistDialogueResult
    ) -> ProjectBlueprintSeed:
        """Build a ProjectBlueprintSeed from a completed minimalist dialogue.

        Uses the synthesized ProblemDefinitionSeed and enriches it with
        LLM-extracted actors, capabilities, and ideas.
        """
        problem_seed = result.synthesized_seed
        if problem_seed is None:
            problem_seed = ProblemDefinitionSeed(
                problem_statement="Dialogue did not produce a problem statement",
                traceability=Traceability.CANDIDATE,
            )

        # Extract additional seeds from the combined dialogue answers
        combined_text = self._combine_dialogue_answers(result)

        idea_seeds = await self._extract_ideas(combined_text)
        actor_seeds = await self._extract_actors(combined_text)
        capability_seeds = await self._extract_capabilities(combined_text)
        use_case_seeds = await self._extract_use_cases(combined_text)
        user_story_seeds = await self._extract_user_stories(combined_text)

        # Build extraction report
        extraction_report = ExtractionReport(
            explicit_fields={k: v for k, v in result.answers.items()},
            inferred_fields={},
            candidate_fields={},
            gaps=self._find_dialogue_gaps(result),
            confidence=Confidence.MEDIUM,
            confidence_basis="Built from minimalist dialogue with LLM extraction",
        )

        # Detect tech stack signals
        tech_signal = self._detect_tech_stack_signal(combined_text)

        # Build scale inputs from dialogue
        scale_inputs = self._extract_scale_from_dialogue(result)
        infra_profile = None
        if scale_inputs:
            infra_profile = InfrastructureProfile(
                profile_id=f"infra_{uuid.uuid4().hex[:8]}",
                scale_inputs=scale_inputs,
            )

        return ProjectBlueprintSeed(
            seed_id=f"seed_{uuid.uuid4().hex[:8]}",
            project_name=None,
            problem_seed=problem_seed,
            idea_seeds=idea_seeds,
            actor_seeds=actor_seeds,
            capability_seeds=capability_seeds,
            use_case_seeds=use_case_seeds,
            user_story_seeds=user_story_seeds,
            tech_stack_signal=tech_signal,
            infrastructure_profile=infra_profile,
            extraction_report=extraction_report,
            richness_mode=RichnessMode.MINIMALIST,
        )

    async def build_from_prd(
        self, raw_input: RawUserInput, analysis: PRDAnalysisReport
    ) -> ProjectBlueprintSeed:
        """Build a ProjectBlueprintSeed from a WELL_FORMED PRD and its analysis.

        Uses the full PRD text and analysis report to extract all seed types.
        """
        text = raw_input.text

        # Build problem seed from explicit sections or LLM extraction
        problem_seed = await self._build_problem_seed_from_prd(text, analysis)

        # Extract all seed types in parallel (conceptually; sequentially here for clarity)
        idea_seeds = await self._extract_ideas(text)
        actor_seeds = await self._extract_actors(text)
        capability_seeds = await self._extract_capabilities(text)
        use_case_seeds = await self._extract_use_cases(text)
        user_story_seeds = await self._extract_user_stories(text)

        # Build extraction report from PRD analysis
        extraction_report = ExtractionReport(
            explicit_fields={s["section_name"]: "present" for s in analysis.explicit_sections},
            inferred_fields={},
            candidate_fields={s["section_name"]: "thin" for s in analysis.thin_sections},
            gaps=[s["section_name"] for s in analysis.missing_sections],
            unmapped_input=analysis.unmapped_input,
            conflicting_statements=analysis.conflicts,
            assumption_flags=analysis.assumption_flags,
            detected_compliance_frameworks=analysis.detected_compliance_frameworks,
            classification_basis=analysis.classification_basis,
            confidence=Confidence.HIGH,
            confidence_basis="Built from WELL_FORMED PRD with full LLM extraction",
        )

        # Detect tech stack
        tech_signal = raw_input.tech_stack_signal or self._detect_tech_stack_signal(text)

        # Extract scale inputs
        scale_inputs = raw_input.scale_inputs or self._extract_scale_from_text(text)
        infra_profile = None
        if scale_inputs:
            infra_profile = InfrastructureProfile(
                profile_id=f"infra_{uuid.uuid4().hex[:8]}",
                scale_inputs=scale_inputs,
            )

        return ProjectBlueprintSeed(
            seed_id=f"seed_{uuid.uuid4().hex[:8]}",
            project_name=None,
            problem_seed=problem_seed,
            idea_seeds=idea_seeds,
            actor_seeds=actor_seeds,
            capability_seeds=capability_seeds,
            use_case_seeds=use_case_seeds,
            user_story_seeds=user_story_seeds,
            tech_stack_signal=tech_signal,
            infrastructure_profile=infra_profile,
            extraction_report=extraction_report,
            richness_mode=RichnessMode.WELL_FORMED,
        )

    # ═══════════════════════════════════════════════════════════════════
    # LLM-based extraction methods
    # ═══════════════════════════════════════════════════════════════════

    async def _extract_actors(self, text: str) -> list[ActorSeed]:
        """Extract actor seeds from text using LLM.

        Returns a list of ActorSeed objects with real computed output.
        """
        if self._llm is None:
            return []

        prompt = (
            "Extract all distinct actors (user types, roles, systems, external services) "
            "mentioned in the following product requirements text. "
            "For each actor, provide:\n"
            "- name: the actor name\n"
            "- actor_type: one of 'human', 'system', 'service', 'external'\n"
            "- description: brief description of their role\n"
            "Return a JSON array of actor objects. If no actors found, return an empty array.\n\n"
            f"Text:\n{text[:6000]}\n"
        )

        class _ActorEntry(BaseModel):  # type: ignore[no-redef]
            name: str = ""
            actor_type: str = "human"
            description: str = ""

        class _ActorList(BaseModel):  # type: ignore[no-redef]
            actors: list[_ActorEntry] = Field(default_factory=list)  # type: ignore[no-redef]

        result = await self._llm.complete_structured(prompt, _ActorList, temperature=0.3)
        return [
            ActorSeed(
                actor_seed_id=f"actor_{uuid.uuid4().hex[:8]}",
                name=a.name,
                actor_type=a.actor_type,  # type: ignore[assignment]
                description=a.description[:500],
                traceability=Traceability.EXPLICIT if a.description else Traceability.INFERRED,
            )
            for a in result.actors
        ]

    async def _extract_capabilities(self, text: str) -> list[CapabilitySeed]:
        """Extract capability seeds from text using LLM.

        Returns a list of CapabilitySeed objects with real computed output.
        """
        if self._llm is None:
            return []

        prompt = (
            "Extract all distinct functional capabilities (features, functions, services) "
            "described in the following product requirements text. "
            "For each capability, provide:\n"
            "- name: the capability name\n"
            "- description: brief description of what it does\n"
            "Return a JSON array of capability objects. If none found, return an empty array.\n\n"
            f"Text:\n{text[:6000]}\n"
        )

        class _CapabilityEntry(BaseModel):  # type: ignore[no-redef]
            name: str = ""
            description: str = ""

        class _CapabilityList(BaseModel):  # type: ignore[no-redef]
            capabilities: list[_CapabilityEntry] = Field(default_factory=list)  # type: ignore[no-redef]

        result = await self._llm.complete_structured(prompt, _CapabilityList, temperature=0.3)
        return [
            CapabilitySeed(
                capability_seed_id=f"cap_{uuid.uuid4().hex[:8]}",
                name=c.name,
                description=c.description[:500],
                traceability=Traceability.EXPLICIT if c.description else Traceability.INFERRED,
            )
            for c in result.capabilities
        ]

    async def _extract_use_cases(self, text: str) -> list[UseCaseSeed]:
        """Extract use case seeds from text using LLM.

        Returns a list of UseCaseSeed objects with real computed output.
        """
        if self._llm is None:
            return []

        prompt = (
            "Extract all distinct use cases or user scenarios described in the following "
            "product requirements text. A use case is a specific interaction between a user "
            "and the system to achieve a goal. "
            "For each use case, provide:\n"
            "- title: the use case title\n"
            "- description: brief description of the interaction\n"
            "Return a JSON array of use case objects. If none found, return an empty array.\n\n"
            f"Text:\n{text[:6000]}\n"
        )

        class _UseCaseEntry(BaseModel):  # type: ignore[no-redef]
            title: str = ""
            description: str = ""

        class _UseCaseList(BaseModel):  # type: ignore[no-redef]
            use_cases: list[_UseCaseEntry] = Field(default_factory=list)  # type: ignore[no-redef]

        result = await self._llm.complete_structured(prompt, _UseCaseList, temperature=0.3)
        return [
            UseCaseSeed(
                use_case_seed_id=f"uc_{uuid.uuid4().hex[:8]}",
                title=uc.title,
                description=uc.description[:500],
                traceability=Traceability.EXPLICIT if uc.description else Traceability.INFERRED,
            )
            for uc in result.use_cases
        ]

    async def _extract_user_stories(self, text: str) -> list[UserStorySeed]:
        """Extract user story seeds from text using LLM.

        Returns a list of UserStorySeed objects with real computed output.
        """
        if self._llm is None:
            return []

        prompt = (
            "Extract all user stories mentioned or implied in the following product "
            "requirements text. A user story follows the format 'As a [role], I want [goal]'. "
            "For each user story, provide:\n"
            "- story_text: the full user story text\n"
            "Return a JSON array of user story objects. If none found, return an empty array.\n\n"
            f"Text:\n{text[:6000]}\n"
        )

        class _StoryEntry(BaseModel):  # type: ignore[no-redef]
            story_text: str = ""

        class _StoryList(BaseModel):  # type: ignore[no-redef]
            user_stories: list[_StoryEntry] = Field(default_factory=list)  # type: ignore[no-redef]

        result = await self._llm.complete_structured(prompt, _StoryList, temperature=0.3)
        return [
            UserStorySeed(
                story_seed_id=f"story_{uuid.uuid4().hex[:8]}",
                story_text=s.story_text[:1000],
                traceability=Traceability.EXPLICIT,
            )
            for s in result.user_stories if s.story_text
        ]

    async def _extract_ideas(self, text: str) -> list[IdeaSeed]:
        """Extract product idea seeds from text using LLM.

        Returns a list of IdeaSeed objects with real computed output.
        """
        if self._llm is None:
            return []

        prompt = (
            "Extract the core product ideas or concepts described in the following text. "
            "For each idea, provide:\n"
            "- name: the idea name or title\n"
            "- description: brief description of the concept\n"
            "Return a JSON array of idea objects. If no distinct ideas found beyond the main product, "
            "return a single item describing the main product idea.\n\n"
            f"Text:\n{text[:6000]}\n"
        )

        class _IdeaEntry(BaseModel):  # type: ignore[no-redef]
            name: str = ""
            description: str = ""

        class _IdeaList(BaseModel):  # type: ignore[no-redef]
            ideas: list[_IdeaEntry] = Field(default_factory=list)  # type: ignore[no-redef]

        result = await self._llm.complete_structured(prompt, _IdeaList, temperature=0.4)
        return [
            IdeaSeed(
                idea_id=f"idea_{uuid.uuid4().hex[:8]}",
                name=i.name,
                description=i.description[:500],
                traceability=Traceability.EXPLICIT if i.description else Traceability.INFERRED,
            )
            for i in result.ideas
        ]

    # ═══════════════════════════════════════════════════════════════════
    # Internal helpers
    # ═══════════════════════════════════════════════════════════════════

    async def _build_problem_seed_from_prd(
        self, text: str, analysis: PRDAnalysisReport
    ) -> ProblemDefinitionSeed:
        """Build a ProblemDefinitionSeed from PRD text and analysis."""
        # Try to find explicit problem statement
        problem_text = ""
        for section in analysis.explicit_sections:
            if section.get("section_name", "").lower() in {"problem statement", "problem", "overview"}:
                problem_text = section.get("content", "")
                break

        if not problem_text and self._llm is not None:
            # Use LLM to extract problem statement
            try:
                prompt = (
                    "From the following PRD, extract the core problem statement. "
                    "Return a concise 1-3 sentence description.\n\n"
                    f"PRD:\n{text[:4000]}\n"
                )
                problem_text = await self._llm.complete(prompt, temperature=0.4, max_tokens=200)
                problem_text = problem_text.strip()
            except Exception:
                problem_text = "Problem statement not explicitly defined in PRD"

        if not problem_text:
            problem_text = "Problem statement not explicitly defined in PRD"

        # Extract constraints from thin sections
        constraints: list[str] = []
        for thin in analysis.thin_sections:
            if thin.get("section_name", "").lower() in {"constraints", "assumptions"}:
                constraints.append(thin.get("suggestion", ""))

        return ProblemDefinitionSeed(
            problem_statement=problem_text[:1000],
            constraints=constraints,
            traceability=Traceability.EXPLICIT,
        )

    def _combine_dialogue_answers(self, result: MinimalistDialogueResult) -> str:
        """Combine all dialogue answers into a single text for LLM extraction."""
        parts: list[str] = []
        dimension_labels = {
            "problem_scope": "Problem",
            "user_base": "Users",
            "scale_intent": "Scale",
            "monetization": "Business Model",
            "constraints": "Constraints",
            "success_definition": "Success Criteria",
        }
        for dimension, answer in result.answers.items():
            label = dimension_labels.get(dimension, dimension)
            parts.append(f"{label}: {answer}")
        return "\n".join(parts)

    def _find_dialogue_gaps(self, result: MinimalistDialogueResult) -> list[str]:
        """Identify dimensions that were not answered in the dialogue."""
        all_dimensions = {"problem_scope", "user_base", "scale_intent", "monetization", "constraints", "success_definition"}
        answered = set(result.answers.keys())
        return [f"Missing {d}" for d in (all_dimensions - answered)]

    def _detect_tech_stack_signal(self, text: str) -> TechStackSignal | None:
        """Detect technology stack mentions in text."""
        import re

        tech_patterns = [
            r"\b(React|Angular|Vue|Svelte|Next\.js|Nuxt)\b",
            r"\b(Node\.js|Python|Java|Go|Golang|Rust|\.NET|C#|Ruby|PHP)\b",
            r"\b(PostgreSQL|MySQL|MongoDB|DynamoDB|Redis|Elasticsearch|Cassandra|SQLite)\b",
            r"\b(AWS|Azure|GCP|Google Cloud|Firebase|Heroku|Vercel|DigitalOcean)\b",
            r"\b(Docker|Kubernetes|K8s|Terraform|Ansible|Jenkins|GitHub Actions|GitLab CI)\b",
            r"\b(GraphQL|REST|gRPC|WebSocket|Kafka|RabbitMQ|NATS)\b",
            r"\b(TypeScript|JavaScript|Dart|Swift|Kotlin|Flutter|React Native)\b",
            r"\b(Microservices|Monolith|Serverless|Event-driven|CQRS|DDD)\b",
        ]

        detected: list[str] = []
        for pat in tech_patterns:
            matches = re.findall(pat, text, re.IGNORECASE)
            detected.extend(matches)

        if detected:
            return TechStackSignal(
                signal_id=f"tech_{uuid.uuid4().hex[:8]}",
                detected_technologies=list(dict.fromkeys(detected)),  # de-duplicate preserve order
                detection_source="input_text",
                confidence=Confidence.HIGH,
            )
        return None

    def _extract_scale_from_dialogue(self, result: MinimalistDialogueResult) -> ScaleInputs | None:
        """Parse scale intent from dialogue answers."""
        scale_text = result.answers.get("scale_intent", "")
        if not scale_text:
            return None
        return self._extract_scale_from_text(scale_text)

    def _extract_scale_from_text(self, text: str) -> ScaleInputs | None:
        """Extract scale inputs from raw text using regex heuristics."""
        import re

        scale = ScaleInputs()
        has_data = False

        user_match = re.search(r"(\d+[kmKM]?)\+?\s*(?:user|customer|client)", text, re.IGNORECASE)
        if user_match:
            scale.launch_users = user_match.group(1)
            has_data = True

        concurrent_match = re.search(
            r"(\d+[kmKM]?)\+?\s*(?:concurrent|simultaneous|session|request)", text, re.IGNORECASE
        )
        if concurrent_match:
            scale.peak_concurrent_sessions = concurrent_match.group(1)
            has_data = True

        growth_match = re.search(
            r"(\d+%|\d+x|double|triple|quadruple)\s*(?:growth|increase|YoY)?", text, re.IGNORECASE
        )
        if growth_match:
            scale.year1_growth = growth_match.group(1)
            has_data = True

        sla_match = re.search(r"(\d+\.?\d*)%\s*(?:uptime|availability|sla)", text, re.IGNORECASE)
        if sla_match:
            scale.uptime_sla = f"{sla_match.group(1)}%"
            has_data = True

        budget_match = re.search(r"\$?([\d,]+)\s*(?:USD|usd|\$)?\s*(?:per month|/month|monthly)?", text, re.IGNORECASE)
        if budget_match:
            scale.budget_usd_per_month = budget_match.group(1)
            has_data = True

        # Region extraction
        region_keywords = ["US", "EU", "APAC", "North America", "Europe", "Asia", "EMEA", "LATAM"]
        regions = [r for r in region_keywords if r.lower() in text.lower()]
        if regions:
            scale.data_residency_regions = regions
            has_data = True

        return scale if has_data else None


# Late imports for Pydantic models used inside LLM schemas
from pydantic import BaseModel, Field  # noqa: E402
