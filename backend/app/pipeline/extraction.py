"""PRD Extraction Engine — parses PRD text into structured pipeline data.

For well-formed PRDs, this extracts explicit data without LLM calls.
For implicit data, it signals that LLM inference is needed.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional


# ─── Regex patterns for PRD section detection ───
SECTION_PATTERNS = {
    "overview": r"(?:^|\n)\s*#{1,3}\s*(?:overview|introduction|summary|background|context)\b",
    "actors": r"(?:^|\n)\s*#{1,3}\s*(?:actors?|users?|roles?|personas?|stakeholders?)\b",
    "features": r"(?:^|\n)\s*#{1,3}\s*(?:features?|requirements?|functional|capabilities?)\b",
    "use_cases": r"(?:^|\n)\s*#{1,3}\s*(?:use\s*cases?|workflows?|scenarios?|flows?)\b",
    "user_stories": r"(?:^|\n)\s*#{1,3}\s*(?:user\s*stories?|stories?)\b",
    "non_functional": r"(?:^|\n)\s*#{1,3}\s*(?:non[-\s]*functional|nfr|performance|security|constraints?)\b",
    "architecture": r"(?:^|\n)\s*#{1,3}\s*(?:architecture|tech\s*stack|technology|infrastructure|design)\b",
    "api": r"(?:^|\n)\s*#{1,3}\s*(?:api|endpoints?|interfaces?)\b",
    "data": r"(?:^|\n)\s*#{1,3}\s*(?:data\s*model|database|schema|entities?|storage)\b",
    "security": r"(?:^|\n)\s*#{1,3}\s*(?:security|auth|authentication|authorization|privacy|compliance)\b",
    "ui_ux": r"(?:^|\n)\s*#{1,3}\s*(?:ui|ux|interface|design|frontend|screen|page)\b",
    "out_of_scope": r"(?:^|\n)\s*#{1,3}\s*(?:out\s*of\s*scope|exclusions?|not\s*in\s*scope)\b",
}


@dataclass
class ExtractedActor:
    name: str
    description: str = ""
    actor_type: str = "human"  # human, system, external
    role: str = ""
    responsibilities: list[str] = field(default_factory=list)


@dataclass
class ExtractedCapability:
    name: str
    description: str = ""
    actor_names: list[str] = field(default_factory=list)  # references by name
    features: list[str] = field(default_factory=list)


@dataclass
class ExtractedUseCase:
    name: str
    description: str = ""
    preconditions: list[str] = field(default_factory=list)
    postconditions: list[str] = field(default_factory=list)
    main_flow: list[str] = field(default_factory=list)
    actor_names: list[str] = field(default_factory=list)


@dataclass
class ExtractedUserStory:
    title: str
    description: str = ""
    acceptance_criteria: list[str] = field(default_factory=list)
    actor_name: str = ""
    priority: str = "medium"


@dataclass
class ExtractedPRD:
    """Complete structured extraction from a PRD document."""

    project_name: str = ""
    problem_statement: str = ""
    overview: str = ""
    actors: list[ExtractedActor] = field(default_factory=list)
    capabilities: list[ExtractedCapability] = field(default_factory=list)
    use_cases: list[ExtractedUseCase] = field(default_factory=list)
    user_stories: list[ExtractedUserStory] = field(default_factory=list)
    non_functional_requirements: list[str] = field(default_factory=list)
    architecture_hints: list[str] = field(default_factory=list)
    api_hints: list[str] = field(default_factory=list)
    data_model_hints: list[str] = field(default_factory=list)
    security_hints: list[str] = field(default_factory=list)
    ui_ux_hints: list[str] = field(default_factory=list)
    out_of_scope: list[str] = field(default_factory=list)
    thin_statements: list[str] = field(default_factory=list)
    conflicting_statements: list[str] = field(default_factory=list)

    # Metadata
    word_count: int = 0
    has_structure: bool = False  # Has markdown headers
    explicit_sections_found: list[str] = field(default_factory=list)


def split_into_sections(text: str) -> dict[str, str]:
    """Split PRD text into sections based on markdown headers."""
    sections: dict[str, str] = {"_preamble": ""}
    current_section = "_preamble"
    current_content: list[str] = []

    lines = text.split("\n")
    for line in lines:
        # Check if this line is a section header
        is_header = False
        for section_name, pattern in SECTION_PATTERNS.items():
            if re.search(pattern, line, re.IGNORECASE):
                # Save previous section
                sections[current_section] = "\n".join(current_content).strip()
                current_section = section_name
                current_content = []
                is_header = True
                break

        if not is_header:
            current_content.append(line)

    # Save last section
    sections[current_section] = "\n".join(current_content).strip()
    return sections


def extract_actors(section_text: str) -> list[ExtractedActor]:
    """Extract actors from the actors section."""
    actors: list[ExtractedActor] = []
    if not section_text.strip():
        return actors

    # Pattern: - **Name** (Type): Description
    # or: - Name: Description
    # or: 1. Name — Description
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
                actor_type = match.group(2).strip().lower()
                description = match.group(3).strip().replace("\n", " ")
            elif len(match.groups()) == 2:
                name = match.group(1).strip()
                actor_type = "human"
                description = match.group(2).strip().replace("\n", " ")
            else:
                continue

            # Normalize actor type
            if any(w in actor_type for w in ["system", "service", "api", "bot", "engine"]):
                normalized_type = "system"
            elif any(w in actor_type for w in ["external", "third", "outside", "vendor", "payment", "gateway", "shipping"]):
                normalized_type = "external"
            else:
                normalized_type = "human"

            # Extract responsibilities from description
            responsibilities: list[str] = []
            resp_match = re.search(r"responsibilities?[:\-—]\s*(.+?)(?=\Z)", description, re.DOTALL | re.IGNORECASE)
            if resp_match:
                resp_text = resp_match.group(1)
                responsibilities = [r.strip("- ") for r in resp_text.split("\n") if r.strip().startswith("-") or r.strip().startswith("*")]

            actors.append(ExtractedActor(
                name=name,
                description=description,
                actor_type=normalized_type,
                role=actor_type if actor_type not in ("human", "system", "external") else "",
                responsibilities=responsibilities,
            ))

    return actors


def extract_capabilities(section_text: str) -> list[ExtractedCapability]:
    """Extract capabilities/features from the features/requirements section."""
    capabilities: list[ExtractedCapability] = []
    if not section_text.strip():
        return capabilities

    # Look for numbered or bulleted features
    # Pattern: 1. **Feature Name**: Description
    # or: - Feature Name: Description
    patterns = [
        r"\d+\.\s*\*\*([^*]+)\*\*[:\-—]\s*(.+?)(?=\n\d+\.|\n#{1,3}\s|\Z)",
        r"\d+\.\s*([^:\-—\n]{2,60})[:\-—]\s*(.+?)(?=\n\d+\.|\n#{1,3}\s|\Z)",
        r"[-*]\s*\*\*([^*]+)\*\*[:\-—]\s*(.+?)(?=\n[-*]|\n#{1,3}\s|\Z)",
        r"[-*]\s*([^:\-—\n]{2,60})[:\-—]\s*(.+?)(?=\n[-*]|\n#{1,3}\s|\Z)",
    ]

    for pattern in patterns:
        for match in re.finditer(pattern, section_text, re.DOTALL):
            name = match.group(1).strip()
            description = match.group(2).strip().replace("\n", " ")

            # Extract sub-features from description
            features: list[str] = []
            sub_items = re.findall(r"[-*]\s*([^\n]+)", description)
            features = [f.strip() for f in sub_items if len(f.strip()) > 5]

            # Try to find which actor this capability belongs to
            actor_names: list[str] = []
            actor_patterns = re.findall(r"for\s+(?:the\s+)?([A-Z][a-zA-Z\s]{1,30}?)(?:\s|$|,|\.|to)", description)
            actor_names = [a.strip() for a in actor_patterns if len(a.strip()) > 2]

            capabilities.append(ExtractedCapability(
                name=name,
                description=description,
                actor_names=actor_names,
                features=features[:5],  # Limit sub-features
            ))

    return capabilities


def extract_use_cases(section_text: str) -> list[ExtractedUseCase]:
    """Extract use cases from the use cases section."""
    use_cases: list[ExtractedUseCase] = []
    if not section_text.strip():
        return use_cases

    # Split by numbered items or headers
    patterns = [
        r"\d+\.\s*\*\*([^*]+)\*\*[:\-—]?\s*(.+?)(?=\n\d+\.|\n#{1,3}\s|\Z)",
        r"\d+\.\s*([A-Z][^:\n]{2,60})[:\-—]?\s*(.+?)(?=\n\d+\.|\n#{1,3}\s|\Z)",
        r"#{4,5}\s*([^\n]+)\n\s*(.+?)(?=\n#{4,5}|\n#{1,3}\s|\Z)",
    ]

    for pattern in patterns:
        for match in re.finditer(pattern, section_text, re.DOTALL):
            name = match.group(1).strip()
            description = match.group(2).strip().replace("\n", " ")

            # Extract preconditions
            preconditions: list[str] = []
            pre_match = re.search(r"preconditions?[:\-—]\s*(.+?)(?=postconditions?|main\s*flow|steps?|$)", description, re.DOTALL | re.IGNORECASE)
            if pre_match:
                preconditions = [p.strip("- ") for p in pre_match.group(1).split("\n") if p.strip()]

            # Extract main flow steps
            main_flow: list[str] = []
            flow_match = re.search(r"(?:main\s*flow|steps?|flow)[:\-—]\s*(.+?)(?=\Z|postconditions?|alternatives?)", description, re.DOTALL | re.IGNORECASE)
            if flow_match:
                steps = re.findall(r"(?:\d+\.\s*|\-\s*)([^\n]+)", flow_match.group(1))
                main_flow = [s.strip() for s in steps if s.strip()]
            else:
                # Try numbered list format
                steps = re.findall(r"\d+\.\s*([^\n]+)", description)
                main_flow = [s.strip() for s in steps if s.strip()]

            # Extract postconditions
            postconditions: list[str] = []
            post_match = re.search(r"postconditions?[:\-—]\s*(.+?)(?=\Z|alternatives?|exceptions?)", description, re.DOTALL | re.IGNORECASE)
            if post_match:
                postconditions = [p.strip("- ") for p in post_match.group(1).split("\n") if p.strip()]

            use_cases.append(ExtractedUseCase(
                name=name,
                description=description,
                preconditions=preconditions,
                postconditions=postconditions,
                main_flow=main_flow,
            ))

    return use_cases


def extract_user_stories(section_text: str) -> list[ExtractedUserStory]:
    """Extract user stories from the user stories section."""
    stories: list[ExtractedUserStory] = []
    if not section_text.strip():
        return stories

    # Pattern: "As a [role], I want [goal] so that [reason]"
    as_a_pattern = r"As\s+(?:a|an)\s+([^,]+),\s*I\s+(?:want|need)\s+(.+?)\s+so\s+(?:that\s+)?(.+?)(?=As\s+(?:a|an)|\n\d+\.|\n#{1,3}\s|\Z)"

    for match in re.finditer(as_a_pattern, section_text, re.DOTALL | re.IGNORECASE):
        actor_name = match.group(1).strip()
        goal = match.group(2).strip()
        reason = match.group(3).strip()

        title = goal
        description = f"As a {actor_name}, I want {goal} so that {reason}"

        # Extract acceptance criteria
        acceptance_criteria: list[str] = []
        full_text = match.group(0)
        ac_match = re.search(r"(?:acceptance\s*criteria|AC|given)[:\-—]\s*(.+?)(?=As\s+(?:a|an)|\Z)", full_text, re.DOTALL | re.IGNORECASE)
        if ac_match:
            criteria = re.findall(r"[-*]\s*([^\n]+)", ac_match.group(1))
            acceptance_criteria = [c.strip() for c in criteria if c.strip()]

        stories.append(ExtractedUserStory(
            title=title,
            description=description,
            acceptance_criteria=acceptance_criteria,
            actor_name=actor_name,
        ))

    # Also look for numbered story format
    if not stories:
        numbered = re.findall(
            r"\d+\.\s*\*\*([^*]+)\*\*[:\-—]?\s*(.+?)(?=\n\d+\.|\n#{1,3}\s|\Z)",
            section_text, re.DOTALL
        )
        for name, desc in numbered:
            stories.append(ExtractedUserStory(
                title=name.strip(),
                description=desc.strip().replace("\n", " "),
            ))

    return stories


def extract_project_name(text: str) -> str:
    """Extract project name from PRD title or first line."""
    # Look for title: # Project Name
    title_match = re.search(r"^#\s+(.+)$", text, re.MULTILINE)
    if title_match:
        return title_match.group(1).strip()

    # Look for "Project Name: X" or "Name: X"
    name_match = re.search(r"(?:project\s*name|name)[:\-—]\s*(.+?)(?:\n|$)", text, re.IGNORECASE)
    if name_match:
        return name_match.group(1).strip()

    # Fall back to first line
    first_line = text.strip().split("\n")[0]
    if first_line.startswith("#"):
        return first_line.lstrip("#").strip()

    return ""


def extract_problem_statement(text: str) -> str:
    """Extract problem statement from overview or first paragraph."""
    sections = split_into_sections(text)

    # Try overview section
    if "overview" in sections:
        overview = sections["overview"].strip()
        # Get first paragraph
        first_para = overview.split("\n\n")[0]
        if len(first_para) > 20:
            return first_para

    # Try to find "problem" or "objective"
    problem_match = re.search(
        r"(?:problem|objective|goal)s?[:\-—]\s*(.+?)(?:\n\n|\n#{1,3}\s|\Z)",
        text, re.DOTALL | re.IGNORECASE
    )
    if problem_match:
        return problem_match.group(1).strip()

    # First substantial paragraph
    for line in text.split("\n"):
        stripped = line.strip()
        if len(stripped) > 40 and not stripped.startswith("#"):
            return stripped

    return ""


def extract_prd(text: str) -> ExtractedPRD:
    """Main extraction function — parse a PRD into structured data."""
    result = ExtractedPRD()
    result.word_count = len(text.split())
    result.has_structure = bool(re.search(r"^#{1,3}\s+", text, re.MULTILINE))

    # Split into sections
    sections = split_into_sections(text)
    result.explicit_sections_found = [k for k in sections.keys() if k != "_preamble" and sections[k].strip()]

    # Extract project name
    result.project_name = extract_project_name(text)

    # Extract problem statement
    result.problem_statement = extract_problem_statement(text)

    # Store overview
    if "overview" in sections:
        result.overview = sections["overview"]

    # Extract actors
    if "actors" in sections:
        result.actors = extract_actors(sections["actors"])

    # Extract capabilities from features section
    if "features" in sections:
        result.capabilities = extract_capabilities(sections["features"])

    # Extract use cases
    if "use_cases" in sections:
        result.use_cases = extract_use_cases(sections["use_cases"])

    # Extract user stories
    if "user_stories" in sections:
        result.user_stories = extract_user_stories(sections["user_stories"])

    # Non-functional requirements
    if "non_functional" in sections:
        result.non_functional_requirements = [
            r.strip("- ") for r in sections["non_functional"].split("\n")
            if r.strip() and r.strip()[0] in "-*0123456789"
        ]

    # Architecture hints
    if "architecture" in sections:
        result.architecture_hints = [
            r.strip("- ") for r in sections["architecture"].split("\n")
            if r.strip() and r.strip()[0] in "-*"
        ]

    # Security hints
    if "security" in sections:
        result.security_hints = [
            r.strip("- ") for r in sections["security"].split("\n")
            if r.strip() and r.strip()[0] in "-*"
        ]

    # Out of scope
    if "out_of_scope" in sections:
        result.out_of_scope = [
            r.strip("- ") for r in sections["out_of_scope"].split("\n")
            if r.strip() and r.strip()[0] in "-*"
        ]

    # Find thin statements (<10 words)
    for line in text.split("\n"):
        stripped = line.strip()
        if stripped.startswith(("-", "*")) and 0 < len(stripped) < 30:
            result.thin_statements.append(stripped)

    return result


def get_extraction_quality_report(extracted: ExtractedPRD) -> dict:
    """Generate a quality report for the extraction."""
    return {
        "word_count": extracted.word_count,
        "has_structure": extracted.has_structure,
        "sections_found": extracted.explicit_sections_found,
        "sections_count": len(extracted.explicit_sections_found),
        "actors_extracted": len(extracted.actors),
        "capabilities_extracted": len(extracted.capabilities),
        "use_cases_extracted": len(extracted.use_cases),
        "user_stories_extracted": len(extracted.user_stories),
        "quality_score": min(100, (
            (20 if extracted.has_structure else 0) +
            (15 if extracted.actors else 0) +
            (15 if extracted.capabilities else 0) +
            (15 if extracted.use_cases else 0) +
            (15 if extracted.user_stories else 0) +
            (10 if extracted.project_name else 0) +
            (10 if extracted.problem_statement else 0)
        )),
        "needs_llm": len(extracted.explicit_sections_found) < 2 or not extracted.actors,
    }
