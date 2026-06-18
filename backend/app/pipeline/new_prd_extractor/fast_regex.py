"""Fast regex-based extraction scoped to a single ``Chunk``.

Refactored from the original monolithic extraction so each function
operates on ``chunk.sections`` (per-section text) rather than scanning
the whole chunk text.  This keeps counts correct when multiple section
types are packed into one chunk.

These functions are the "fast path" — no LLM calls, pure regex.  The
orchestrator uses ``chunk_quality_score`` to decide whether a chunk
can skip the LLM entirely.
"""

from __future__ import annotations

import re

from .chunker import Chunk
from .models import (
    ChunkResult,
    ExtractedActor,
    ExtractedCapability,
    ExtractedUseCase,
    ExtractedUserStory,
    SectionType,
)


# ---------------------------------------------------------------------------
# Section-scoped extractors
# ---------------------------------------------------------------------------


def _extract_actors(section_text: str) -> list[ExtractedActor]:
    """Extract actors from an actors-section body."""
    actors: list[ExtractedActor] = []
    if not section_text.strip():
        return actors

    patterns = [
        r"[-*]\s*\*\*([^*]+)\*\*\s*\(([^)]+)\)[:\-—]\s*(.+?)(?=\n[-*]|\n\d+\.|\Z)",
        r"[-*]\s*\*\*([^*]+)\*\*[:\-—]\s*(.+?)(?=\n[-*]|\n\d+\.|\Z)",
        r"[-*]\s*([^:\-—\n]{2,50})[:\-—]\s*(.+?)(?=\n[-*]|\n\d+\.|\Z)",
        r"\d+\.\s*\*\*([^*]+)\*\*\s*\(([^)]+)\)[:\-—]\s*(.+?)(?=\n\d+\.|\Z)",
        r"\d+\.\s*([^:\-—\n]{2,50})[:\-—]\s*(.+?)(?=\n\d+\.|\Z)",
    ]

    for pattern in patterns:
        for match in re.finditer(pattern, section_text, re.DOTALL | re.IGNORECASE):
            if len(match.groups()) >= 3:
                name = match.group(1).strip()
                actor_type_raw = match.group(2).strip().lower()
                description = match.group(3).strip().replace("\n", " ")
            elif len(match.groups()) == 2:
                name = match.group(1).strip()
                actor_type_raw = "human"
                description = match.group(2).strip().replace("\n", " ")
            else:
                continue

            # Skip entries where the name contains markdown bold syntax —
            # these are already captured by the \*\*-aware patterns above.
            if "*" in name:
                continue

            # Normalize actor type
            if any(w in actor_type_raw for w in ["system", "service", "api", "bot", "engine"]):
                normalized_type = "system"
            elif any(w in actor_type_raw for w in ["external", "third", "outside", "vendor", "payment", "gateway", "shipping"]):
                normalized_type = "external"
            else:
                normalized_type = "human"

            # Extract responsibilities
            responsibilities: list[str] = []
            resp_match = re.search(
                r"responsibilities?[:\-—]\s*(.+?)(?=\Z)",
                description,
                re.DOTALL | re.IGNORECASE,
            )
            if resp_match:
                resp_text = resp_match.group(1)
                responsibilities = [
                    r.strip("- ")
                    for r in resp_text.split("\n")
                    if r.strip().startswith(("-", "*"))
                ]

            actors.append(
                ExtractedActor(
                    name=name,
                    description=description,
                    actor_type=normalized_type,
                    role=actor_type_raw
                    if actor_type_raw not in ("human", "system", "external")
                    else "",
                    responsibilities=responsibilities,
                )
            )

    return actors


def _extract_capabilities(section_text: str) -> list[ExtractedCapability]:
    """Extract capabilities from a features-section body."""
    capabilities: list[ExtractedCapability] = []
    if not section_text.strip():
        return capabilities

    patterns = [
        r"\d+\.\s*\*\*([^*]+)\**[:\-—]\s*(.+?)(?=\n\d+\.|\n#{1,3}\s|\Z)",
        r"\d+\.\s*([^:\-—\n]{2,60})[:\-—]\s*(.+?)(?=\n\d+\.|\n#{1,3}\s|\Z)",
        r"[-*]\s*\*\*([^*]+)\*\*[:\-—]\s*(.+?)(?=\n[-*]|\n#{1,3}\s|\Z)",
        r"[-*]\s*([^:\-—\n]{2,60})[:\-—]\s*(.+?)(?=\n[-*]|\n#{1,3}\s|\Z)",
    ]

    for pattern in patterns:
        for match in re.finditer(pattern, section_text, re.DOTALL):
            name = match.group(1).strip()
            description = match.group(2).strip().replace("\n", " ")

            # Skip entries where the name contains markdown bold syntax —
            # these are already captured by the \*\*-aware patterns above.
            if "*" in name:
                continue

            # Sub-features
            sub_items = re.findall(r"[-*]\s*([^\n]+)", description)
            features = [f.strip() for f in sub_items if len(f.strip()) > 5]

            # Actor references in description
            actor_names: list[str] = []
            actor_patterns = re.findall(
                r"for\s+(?:the\s+)?([A-Z][a-zA-Z\s]{1,30}?)(?:\s|$|,|\.|to)",
                description,
            )
            actor_names = [a.strip() for a in actor_patterns if len(a.strip()) > 2]

            capabilities.append(
                ExtractedCapability(
                    name=name,
                    description=description,
                    actor_names=actor_names,
                    features=features[:5],
                )
            )

    return capabilities


def _extract_use_cases(section_text: str) -> list[ExtractedUseCase]:
    """Extract use cases from a use-cases-section body."""
    use_cases: list[ExtractedUseCase] = []
    if not section_text.strip():
        return use_cases

    patterns = [
        r"\d+\.\s*\*\*([^*]+)\*\*[:\-—]?\s*(.+?)(?=\n\d+\.|\n#{1,3}\s|\Z)",
        r"\d+\.\s*([A-Z][^:\n]{2,60})[:\-—]?\s*(.+?)(?=\n\d+\.|\n#{1,3}\s|\Z)",
        r"#{4,5}\s*([^\n]+)\n\s*(.+?)(?=\n#{4,5}|\n#{1,3}\s|\Z)",
    ]

    for pattern in patterns:
        for match in re.finditer(pattern, section_text, re.DOTALL):
            name = match.group(1).strip()
            raw_description = match.group(2).strip()

            # Extract structured fields from *raw* description (before
            # flattening newlines) so that multi-line step lists remain
            # parseable.

            preconditions: list[str] = []
            pre_match = re.search(
                r"preconditions?[:\-—]\s*(.+?)(?=postconditions?|main\s*flow|steps?|$)",
                raw_description,
                re.DOTALL | re.IGNORECASE,
            )
            if pre_match:
                preconditions = [
                    p.strip("- ") for p in pre_match.group(1).split("\n") if p.strip()
                ]

            main_flow: list[str] = []
            flow_match = re.search(
                r"(?:main\s*flow|steps?|flow)[:\-—]\s*(.+?)(?=\Z|postconditions?|alternatives?)",
                raw_description,
                re.DOTALL | re.IGNORECASE,
            )
            if flow_match:
                steps = re.findall(r"(?:\s*\d+\.\s*|\-\s*)([^\n]+)", flow_match.group(1))
                main_flow = [s.strip() for s in steps if s.strip()]
            else:
                steps = re.findall(r"\s*\d+\.\s*([^\n]+)", raw_description)
                main_flow = [s.strip() for s in steps if s.strip()]

            postconditions: list[str] = []
            post_match = re.search(
                r"postconditions?[:\-—]\s*(.+?)(?=\Z|alternatives?|exceptions?)",
                raw_description,
                re.DOTALL | re.IGNORECASE,
            )
            if post_match:
                postconditions = [
                    p.strip("- ") for p in post_match.group(1).split("\n") if p.strip()
                ]

            # Flatten description only *after* structured extraction
            description = raw_description.replace("\n", " ")

            # Extract actor references from description
            actor_names: list[str] = []
            actor_patterns = re.findall(
                r"(?:involves|participants?|actors?|performed by)[:\-—]?\s*([A-Z][a-zA-Z\s,]{1,80}?)(?:\.|$|\n)",
                raw_description,
                re.IGNORECASE,
            )
            for ap in actor_patterns:
                for name in re.split(r"\s*,\s*|\s+and\s+", ap):
                    name = name.strip()
                    if len(name) > 2 and name[0].isupper():
                        actor_names.append(name)

            # Extract capability references from description
            capability_names: list[str] = []
            cap_patterns = re.findall(
                r"(?:implements|uses|requires|depends on|capabilities?)[:\-—]?\s*([A-Z][a-zA-Z\s,]{1,80}?)(?:\.|$|\n)",
                raw_description,
                re.IGNORECASE,
            )
            for cp in cap_patterns:
                for name in re.split(r"\s*,\s*|\s+and\s+", cp):
                    name = name.strip()
                    if len(name) > 2 and name[0].isupper():
                        capability_names.append(name)

            use_cases.append(
                ExtractedUseCase(
                    name=name,
                    description=description,
                    preconditions=preconditions,
                    postconditions=postconditions,
                    main_flow=main_flow,
                    actor_names=actor_names,
                    capability_names=capability_names,
                )
            )

    return use_cases


def _extract_user_stories(section_text: str) -> list[ExtractedUserStory]:
    """Extract user stories from a user-stories-section body."""
    stories: list[ExtractedUserStory] = []
    if not section_text.strip():
        return stories

    # Classic "As a ... I want ... so that ..." format
    as_a_pattern = (
        r"As\s+(?:a|an)\s+([^,]+),\s*I\s+(?:want|need)\s+(.+?)\s+so\s+(?:that\s+)?"
        r"(.+?)(?=As\s+(?:a|an)|\n\d+\.|\n#{1,3}\s|\Z)"
    )

    for match in re.finditer(as_a_pattern, section_text, re.DOTALL | re.IGNORECASE):
        actor_name = match.group(1).strip()
        goal = match.group(2).strip()
        reason = match.group(3).strip()

        title = goal
        description = f"As a {actor_name}, I want {goal} so that {reason}"

        acceptance_criteria: list[str] = []
        full_text = match.group(0)
        ac_match = re.search(
            r"(?:acceptance\s*criteria|AC|given)[:\-—]\s*(.+?)(?=As\s+(?:a|an)|\Z)",
            full_text,
            re.DOTALL | re.IGNORECASE,
        )
        if ac_match:
            criteria = re.findall(r"[-*]\s*([^\n]+)", ac_match.group(1))
            acceptance_criteria = [c.strip() for c in criteria if c.strip()]

        stories.append(
            ExtractedUserStory(
                title=title,
                description=description,
                acceptance_criteria=acceptance_criteria,
                actor_name=actor_name,
            )
        )

    # Fallback: numbered story format
    if not stories:
        numbered = re.findall(
            r"\d+\.\s*\*\*([^*]+)\*\*[:\-—]?\s*(.+?)(?=\n\d+\.|\n#{1,3}\s|\Z)",
            section_text,
            re.DOTALL,
        )
        for name, desc in numbered:
            stories.append(
                ExtractedUserStory(
                    title=name.strip(),
                    description=desc.strip().replace("\n", " "),
                )
            )

    return stories


# ---------------------------------------------------------------------------
# Chunk-scoped orchestrator
# ---------------------------------------------------------------------------


def extract_chunk(chunk: Chunk) -> ChunkResult:
    """Run regex extraction on a single chunk, scoped per-section."""
    result = ChunkResult(sections_in_chunk=chunk.section_types[:])

    for sec_type, sec_text in chunk.sections:
        if sec_type is SectionType.ACTORS:
            result.actors.extend(_extract_actors(sec_text))
        elif sec_type is SectionType.FEATURES:
            result.capabilities.extend(_extract_capabilities(sec_text))
        elif sec_type is SectionType.USE_CASES:
            result.use_cases.extend(_extract_use_cases(sec_text))
        elif sec_type is SectionType.USER_STORIES:
            result.user_stories.extend(_extract_user_stories(sec_text))
        elif sec_type is SectionType.NON_FUNCTIONAL:
            result.non_functional_requirements.extend(_bullet_lines(sec_text))
        elif sec_type is SectionType.ARCHITECTURE:
            result.architecture_hints.extend(_bullet_lines(sec_text))
        elif sec_type is SectionType.API:
            result.api_hints.extend(_bullet_lines(sec_text))
        elif sec_type is SectionType.DATA:
            result.data_model_hints.extend(_bullet_lines(sec_text))
        elif sec_type is SectionType.SECURITY:
            result.security_hints.extend(_bullet_lines(sec_text))
        elif sec_type is SectionType.UI_UX:
            result.ui_ux_hints.extend(_bullet_lines(sec_text))
        elif sec_type is SectionType.OUT_OF_SCOPE:
            result.out_of_scope.extend(_bullet_lines(sec_text))

    # Thin statements: lines < 30 chars that look like bullets
    for line in chunk.text.split("\n"):
        stripped = line.strip()
        if stripped.startswith(("-", "*")) and 0 < len(stripped) < 30:
            result.thin_statements.append(stripped)

    return result


def chunk_quality_score(chunk: Chunk, result: ChunkResult) -> int:
    """Score extraction quality for a chunk (0–100).

    Higher scores mean the regex extraction was confident enough that
    the chunk can skip an LLM call.
    """
    score = 0

    # Structure bonus
    if len(chunk.section_types) >= 1:
        score += 20

    # Entity density bonuses — count per *relevant* section type
    for sec_type, sec_text in chunk.sections:
        if sec_type is SectionType.ACTORS and result.actors:
            score += 15
        elif sec_type is SectionType.FEATURES and result.capabilities:
            score += 15
        elif sec_type is SectionType.USE_CASES and result.use_cases:
            score += 15
        elif sec_type is SectionType.USER_STORIES and result.user_stories:
            score += 15
        elif sec_type is SectionType.NON_FUNCTIONAL:
            bullets = len(_bullet_lines(sec_text))
            if bullets > 0:
                score += min(10, bullets)

    # Metadata completeness
    if result.actors:
        score += 5
    if result.capabilities:
        score += 5

    return min(100, score)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _bullet_lines(text: str) -> list[str]:
    """Extract bullet/numbered lines from *text*."""
    return [
        line.strip("- ").strip("* ")
        for line in text.split("\n")
        if line.strip() and line.strip()[0] in "-*0123456789"
    ]


def extract_project_name(text: str) -> str:
    """Extract project name from PRD title or first line."""
    title_match = re.search(r"^#\s+(.+)$", text, re.MULTILINE)
    if title_match:
        return title_match.group(1).strip()

    name_match = re.search(
        r"(?:project\s*name|name)[:\-—]\s*(.+?)(?:\n|$)", text, re.IGNORECASE
    )
    if name_match:
        return name_match.group(1).strip()

    first_line = text.strip().split("\n")[0]
    if first_line.startswith("#"):
        return first_line.lstrip("#").strip()

    return ""


def extract_problem_statement(text: str) -> str:
    """Extract problem statement from overview or first paragraph."""
    from .chunker import split_into_sections

    sections = split_into_sections(text)

    # Try overview section first
    for sec in sections:
        if sec.section_type.value == "overview" and sec.body.strip():
            first_para = sec.body.strip().split("\n\n")[0]
            if len(first_para) > 20:
                return first_para
            break

    # Try to find explicit problem/objective statement
    problem_match = re.search(
        r"(?:problem|objective|goal)s?[:\-—]\s*(.+?)(?:\n\n|\n#{1,3}\s|\Z)",
        text,
        re.DOTALL | re.IGNORECASE,
    )
    if problem_match:
        return problem_match.group(1).strip()

    # First substantial paragraph
    for line in text.split("\n"):
        stripped = line.strip()
        if len(stripped) > 40 and not stripped.startswith("#"):
            return stripped

    return ""
