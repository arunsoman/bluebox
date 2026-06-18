"""MinimalistDialogue — guided dialogue for MINIMALIST mode inputs.

Uses MinimalistQuestionBank with 6 dimensions:
- problem_scope: what problem the product solves
- user_base: who the users are
- scale_intent: expected scale and growth
- monetization: business model / revenue
- constraints: technical, regulatory, resource constraints
- success_definition: how success is measured

Only asks questions whose answers are absent from the input.
High-confidence inferences skip the question entirely.
"""
from __future__ import annotations

import uuid
from typing import Any

from domain.models import (
    Confidence,
    MinimalistDialogueResult,
    MinimalistQuestion,
    ProblemDefinitionSeed,
    RawUserInput,
    ScaleInputs,
    TargetCustomerProfile,
    Traceability,
)
from infrastructure.llm.llm_provider import LLMClient


# ─────────────────────────────────────────────────────────────────────────────
# Question bank definitions
# ─────────────────────────────────────────────────────────────────────────────

_QUESTION_TEMPLATES: dict[str, dict[str, str]] = {
    "problem_scope": {
        "question_text": "What core problem does your product solve? Describe the pain point or need.",
        "inference_prompt": (
            "From the following user input, infer the core problem being solved. "
            "Return a concise 1-2 sentence description. If unclear, say 'UNCLEAR'.\n\nText: {text}"
        ),
    },
    "user_base": {
        "question_text": "Who are your target users? Describe their characteristics, roles, or segments.",
        "inference_prompt": (
            "From the following user input, identify the target users or customers. "
            "Return a concise description. If unclear, say 'UNCLEAR'.\n\nText: {text}"
        ),
    },
    "scale_intent": {
        "question_text": "What scale do you expect at launch and in Year 1? (users, concurrent sessions, regions)",
        "inference_prompt": (
            "From the following user input, infer the expected scale: launch users, "
            "year 1 growth, peak concurrent sessions, regions. Return as brief text. "
            "If unclear, say 'UNCLEAR'.\n\nText: {text}"
        ),
    },
    "monetization": {
        "question_text": "What is the business model or monetization strategy? (subscription, freemium, B2B, etc.)",
        "inference_prompt": (
            "From the following user input, infer the monetization or business model. "
            "Return a concise description. If unclear, say 'UNCLEAR'.\n\nText: {text}"
        ),
    },
    "constraints": {
        "question_text": "What are your key constraints? (budget, timeline, tech stack, compliance, team size)",
        "inference_prompt": (
            "From the following user input, identify any constraints mentioned "
            "(budget, timeline, technology, compliance, team). Return as brief text. "
            "If unclear, say 'UNCLEAR'.\n\nText: {text}"
        ),
    },
    "success_definition": {
        "question_text": "How will you measure success? What are the key metrics or outcomes?",
        "inference_prompt": (
            "From the following user input, infer how success is defined or measured. "
            "Return a concise description. If unclear, say 'UNCLEAR'.\n\nText: {text}"
        ),
    },
}


class MinimalistQuestionBank:
    """Holds the 6-dimensional question templates for minimalist dialogue."""

    def __init__(self) -> None:
        self._templates = _QUESTION_TEMPLATES

    @property
    def dimensions(self) -> list[str]:
        """Return the ordered list of question dimensions."""
        return list(self._templates.keys())

    def get_question(self, dimension: str) -> dict[str, str] | None:
        """Get the question template for a given dimension."""
        return self._templates.get(dimension)

    def get_inference_prompt(self, dimension: str, text: str) -> str | None:
        """Get the LLM inference prompt for a dimension, with text substituted."""
        tmpl = self._templates.get(dimension)
        if tmpl is None:
            return None
        return tmpl["inference_prompt"].format(text=text)


class MinimalistDialogue:
    """Manages a guided dialogue to collect missing information from minimalist input.

    Only asks questions whose answers are absent from the input.
    High-confidence inferences skip the question entirely.
    """

    def __init__(self, llm_client: LLMClient | None = None) -> None:
        self._llm = llm_client
        self._bank = MinimalistQuestionBank()
        self._questions: dict[str, MinimalistQuestion] = {}
        self._answers: dict[str, str] = {}
        self._inferences: dict[str, str] = {}
        self._started: bool = False

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def start_dialogue(self, raw_input: RawUserInput) -> list[MinimalistQuestion]:
        """Start the dialogue by analyzing the input and generating questions.

        Returns the list of questions that need to be asked (after inference).
        Questions with high-confidence inferred answers are pre-answered and
        not included in the returned list.
        """
        self._questions = {}
        self._answers = {}
        self._inferences = {}
        self._started = True

        text = raw_input.text
        questions_to_ask: list[MinimalistQuestion] = []

        for dimension in self._bank.dimensions:
            q_template = self._bank.get_question(dimension)
            if q_template is None:
                continue

            question_id = f"q_{dimension}_{uuid.uuid4().hex[:6]}"
            question = MinimalistQuestion(
                question_id=question_id,
                dimension=dimension,
                question_text=q_template["question_text"],
            )
            self._questions[question_id] = question

            # --- Attempt LLM inference ---
            inferred_answer: str | None = None
            inference_confidence: Confidence | None = None

            if self._llm is not None:
                try:
                    prompt = self._bank.get_inference_prompt(dimension, text)
                    if prompt:
                        inferred_raw = await self._llm.complete(
                            prompt, temperature=0.4, max_tokens=200
                        )
                        inferred_raw = inferred_raw.strip()
                        if inferred_raw and inferred_raw.upper() != "UNCLEAR":
                            inferred_answer = inferred_raw
                            # High confidence if the answer is substantial (>10 words)
                            if len(inferred_answer.split()) >= 5:
                                inference_confidence = Confidence.HIGH
                            else:
                                inference_confidence = Confidence.MEDIUM
                except Exception:
                    # Inference failed — will ask the question
                    pass

            if inferred_answer and inference_confidence == Confidence.HIGH:
                # High confidence inference — skip the question
                self._inferences[question_id] = inferred_answer
                question.inferred_answer = inferred_answer
                question.inference_confidence = inference_confidence
                self._answers[question_id] = inferred_answer
            else:
                # Check if answer is already present in the input text
                extracted_answer = self._extract_answer_from_text(dimension, text)
                if extracted_answer:
                    self._answers[question_id] = extracted_answer
                    question.answer = extracted_answer
                elif inferred_answer and inference_confidence == Confidence.MEDIUM:
                    # Medium confidence — show as inference, still ask
                    self._inferences[question_id] = inferred_answer
                    question.inferred_answer = inferred_answer
                    question.inference_confidence = inference_confidence
                    questions_to_ask.append(question)
                else:
                    questions_to_ask.append(question)

        return questions_to_ask

    def submit_answer(self, question_id: str, answer: str) -> None:
        """Submit a user answer for a question.

        Raises KeyError if question_id is unknown.
        """
        if question_id not in self._questions:
            raise KeyError(f"Unknown question_id: {question_id}")
        self._answers[question_id] = answer
        self._questions[question_id].answer = answer

    def skip_question(self, question_id: str) -> None:
        """Mark a question as skipped by the user (user_deferred).

        Raises KeyError if question_id is unknown.
        """
        if question_id not in self._questions:
            raise KeyError(f"Unknown question_id: {question_id}")
        self._questions[question_id].skipped = True

    async def suggest_answer(self, question_id: str) -> str:
        """Use LLM to suggest an answer for a question based on context.

        Raises KeyError if question_id is unknown.
        Raises RuntimeError if LLM is not configured.
        """
        if question_id not in self._questions:
            raise KeyError(f"Unknown question_id: {question_id}")
        if self._llm is None:
            raise RuntimeError("LLMClient not configured for answer suggestion")

        question = self._questions[question_id]
        prompt = (
            f"Based on a product idea where:\n"
            f"- Problem scope: {self._answers.get(self._find_qid_for_dimension('problem_scope'), 'unknown')}\n"
            f"- User base: {self._answers.get(self._find_qid_for_dimension('user_base'), 'unknown')}\n"
            f"Suggest an answer to this question:\n"
            f"{question.question_text}\n"
            f"Provide a concise, practical answer."
        )
        suggestion = await self._llm.complete(prompt, temperature=0.6, max_tokens=200)
        return suggestion.strip()

    def accept_inference(self, question_id: str) -> None:
        """Accept the LLM-inferred answer for a question.

        Raises KeyError if question_id is unknown or has no inference.
        """
        if question_id not in self._questions:
            raise KeyError(f"Unknown question_id: {question_id}")
        if question_id not in self._inferences:
            raise KeyError(f"No inference available for question_id: {question_id}")
        self._answers[question_id] = self._inferences[question_id]
        self._questions[question_id].answer = self._inferences[question_id]

    def get_result(self) -> MinimalistDialogueResult:
        """Get the dialogue result with all answers synthesized into a seed.

        Raises RuntimeError if dialogue has not been started.
        """
        if not self._started:
            raise RuntimeError("Dialogue has not been started. Call start_dialogue() first.")

        # Build dimension → answer mapping
        dimension_answers: dict[str, str] = {}
        for qid, question in self._questions.items():
            if qid in self._answers:
                dimension_answers[question.dimension] = self._answers[qid]

        # Synthesize ProblemDefinitionSeed
        problem_seed = self._synthesize_seed(dimension_answers)

        # Build all questions for the result
        all_questions = list(self._questions.values())

        return MinimalistDialogueResult(
            questions=all_questions,
            synthesized_seed=problem_seed,
            answers=dimension_answers,
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _find_qid_for_dimension(self, dimension: str) -> str | None:
        """Find the question ID for a given dimension."""
        for qid, q in self._questions.items():
            if q.dimension == dimension:
                return qid
        return None

    def _extract_answer_from_text(self, dimension: str, text: str) -> str | None:
        """Heuristic: try to extract a dimension answer directly from input text.

        Returns the extracted answer string or None if not found.
        """
        text_lower = text.lower()

        if dimension == "problem_scope":
            # Look for "problem: ..." or "solves ..." patterns
            patterns = [
                r"(?:problem|challenge|pain point)[\s:—]+([^\.\n]{10,200})",
                r"(?:solves|addressing|tackles)[\s:]+([^\.\n]{10,200})",
            ]
        elif dimension == "user_base":
            patterns = [
                r"(?:target user|target customer|user base|audience)[\s:—]+([^\.\n]{10,200})",
                r"(?:for|aimed at)[\s:]+([^\.\n]{5,200})\b(?:user|customer|client)",
            ]
        elif dimension == "scale_intent":
            patterns = [
                r"(?:scale|users?|concurrent|launch)[\s:—]+([^\.\n]{5,200})",
                r"(\d+[km]?\+?\s*(?:user|session|request|hit)s?)",
            ]
        elif dimension == "monetization":
            patterns = [
                r"(?:monetiz|revenue|business model|pricing|subscription|freemium)[\s:—]+([^\.\n]{5,200})",
            ]
        elif dimension == "constraints":
            patterns = [
                r"(?:constraint|limitation|restricted|must use|budget|timeline)[\s:—]+([^\.\n]{5,200})",
            ]
        elif dimension == "success_definition":
            patterns = [
                r"(?:success|kpi|metric|measure|goal)[\s:—]+([^\.\n]{5,200})",
            ]
        else:
            return None

        import re
        for pat in patterns:
            match = re.search(pat, text_lower)
            if match:
                candidate = match.group(1).strip()
                if len(candidate) >= 5:
                    return candidate[:300]
        return None

    def _synthesize_seed(self, dimension_answers: dict[str, str]) -> ProblemDefinitionSeed | None:
        """Synthesize a ProblemDefinitionSeed from collected dimension answers."""
        problem_statement = dimension_answers.get("problem_scope", "")
        if not problem_statement:
            return None

        constraints: list[str] = []
        if "constraints" in dimension_answers:
            constraints = [c.strip() for c in dimension_answers["constraints"].split(",") if c.strip()]

        # Build target customer profile
        target_customer = None
        if "user_base" in dimension_answers:
            target_customer = TargetCustomerProfile(
                segment=dimension_answers["user_base"][:200],
            )

        # Build scale inputs
        scale_inputs = None
        if "scale_intent" in dimension_answers:
            scale_inputs = self._parse_scale_inputs(dimension_answers["scale_intent"])

        return ProblemDefinitionSeed(
            problem_statement=problem_statement[:1000],
            constraints=constraints,
            target_customer=target_customer,
            scale_inputs=scale_inputs,
            traceability=Traceability.EXPLICIT if len(dimension_answers) >= 4 else Traceability.INFERRED,
        )

    def _parse_scale_inputs(self, scale_text: str) -> ScaleInputs | None:
        """Parse scale intent text into ScaleInputs."""
        import re
        scale = ScaleInputs()

        # Extract numbers with units
        # Users: "10k users", "5000 users", "1M users"
        user_match = re.search(r"(\d+[kmKM]?)\+?\s*(?:user|customer)", scale_text)
        if user_match:
            scale.launch_users = user_match.group(1)

        # Concurrent sessions
        concurrent_match = re.search(r"(\d+[kmKM]?)\+?\s*(?:concurrent|session|request)", scale_text)
        if concurrent_match:
            scale.peak_concurrent_sessions = concurrent_match.group(1)

        # Growth
        growth_match = re.search(r"(\d+%|\d+x|[Dd]ouble|[Tt]riple|[Qq]uadruple)\s*(?:growth|increase| YoY)?", scale_text)
        if growth_match:
            scale.year1_growth = growth_match.group(1)

        # Regions
        regions = re.findall(r"\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\b(?:\s*region)?", scale_text)
        if regions:
            scale.data_residency_regions = [r for r in regions if r.lower() not in {"launch", "year", "peak", "concurrent"}][:5]

        # Budget
        budget_match = re.search(r"\$?([\d,]+)\s*(USD|usd|\$)?\s*(?:per month|/month|monthly)?", scale_text)
        if budget_match:
            scale.budget_usd_per_month = budget_match.group(1)

        # SLA
        sla_match = re.search(r"(\d+\.?\d*)%\s*(?:uptime|availability|sla)", scale_text)
        if sla_match:
            scale.uptime_sla = f"{sla_match.group(1)}%"

        return scale
