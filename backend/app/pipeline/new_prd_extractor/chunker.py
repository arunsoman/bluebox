"""Structural chunker for large PRD documents.

Splits markdown PRDs into token-budget-respecting chunks **by header
hierarchy**, never severing a section's body from its heading.  If a
single section alone exceeds the budget, it sub-splits on
paragraph/list-item boundaries.

Uses ``tiktoken`` for fast, local token approximation (no API call).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from .models import SectionType

# Optional tiktoken — falls back to word-count approximation.
try:
    import tiktoken

    _HAS_TIKTOKEN = True
except Exception:  # pragma: no cover
    tiktoken = None  # type: ignore[assignment]
    _HAS_TIKTOKEN = False

# Regex patterns for PRD section detection.
# Each pattern anchors the header keyword so it must be followed by
# end-of-line, colon, or additional whitespace (not just a word
# boundary, which would incorrectly match "User Stories" as "users").
# Each pattern matches the **entire** heading line after stripping
# markdown syntax, e.g. "## User Stories" → "user stories".
# Ordered with multi-word / more-specific keywords FIRST so they
# take priority over single-word substrings (e.g. "user stories"
# before "user" in actors).
_SECTION_KEYWORDS: dict[SectionType, list[str]] = {
    SectionType.OVERVIEW: ["overview", "introduction", "summary", "background", "context"],
    SectionType.USER_STORIES: ["user stories", "user story"],
    SectionType.USE_CASES: ["use cases", "use case", "workflows", "workflow", "scenarios", "scenario", "flows", "flow"],
    SectionType.ACTORS: ["actors", "actor", "users", "user", "roles", "role", "personas", "persona", "stakeholders", "stakeholder"],
    SectionType.FEATURES: ["features", "feature", "requirements", "requirement", "functional requirements", "functional", "capabilities", "capability"],
    SectionType.NON_FUNCTIONAL: ["non-functional", "non functional", "nfr", "performance", "security requirements", "constraints", "constraint"],
    SectionType.ARCHITECTURE: ["architecture", "tech stack", "technology", "infrastructure", "design"],
    SectionType.API: ["api", "endpoints", "endpoint", "interfaces", "interface"],
    SectionType.DATA: ["data model", "database", "schema", "entities", "entity", "storage"],
    SectionType.SECURITY: ["security", "auth", "authentication", "authorization", "privacy", "compliance"],
    SectionType.UI_UX: ["ui", "ux", "interface design", "frontend", "screens", "screen", "pages", "page"],
    SectionType.OUT_OF_SCOPE: ["out of scope", "exclusions", "exclusion", "not in scope"],
}

# Pre-built regex patterns for fast matching — must consume the full line.
# The `(?:\s+\w+)*` allows trailing words like "Requirements" in
# "Non-Functional Requirements".
# Supports both markdown headers (## Section) and numbered sections (1. Section).
SECTION_PATTERNS: dict[SectionType, str] = {
    st: r"^\s*(?:#{1,3}\s+|\d+\.\s+)(?:"
    + "|".join(re.escape(kw) for kw in keywords)
    + r")(?:\s+\w+)*\s*(?:#*|:)?\s*$"
    for st, keywords in _SECTION_KEYWORDS.items()
}

# Default token budget leaves headroom for the LLM prompt template,
# JSON overhead, and response tokens.
DEFAULT_TOKEN_BUDGET: int = 6_000

# tiktoken encoder — cl100k_base is a good cross-model approximation.
_encoder = None


def _get_encoder():
    global _encoder
    if _encoder is None and _HAS_TIKTOKEN:
        _encoder = tiktoken.get_encoding("cl100k_base")
    return _encoder


def count_tokens(text: str) -> int:
    """Approximate token count for *text* using tiktoken (preferred) or word-count fallback."""
    if _HAS_TIKTOKEN:
        enc = _get_encoder()
        if enc is not None:
            return len(enc.encode(text))
    # Fallback: ~1.3 tokens per word is a reasonable approximation for English prose.
    return int(len(text.split()) * 1.3)


@dataclass
class Section:
    """A single PRD section with its heading line and body text."""

    section_type: SectionType
    heading: str
    body: str

    @property
    def text(self) -> str:
        return f"{self.heading}\n{self.body}".strip()

    @property
    def token_count(self) -> int:
        return count_tokens(self.text)


@dataclass
class Chunk:
    """A token-budget-respecting chunk of PRD text.

    Attributes:
        text: Flat joined text ready for an LLM prompt.
        sections: Per-section (type, text) pairs preserved for regex
            extraction, which must operate section-scoped rather than
            on the flat joined blob.
        section_types: Convenience list of section types in this chunk.
        token_count: Cached tiktoken count for ``text``.
    """

    text: str
    sections: list[tuple[SectionType, str]] = field(default_factory=list)
    section_types: list[SectionType] = field(default_factory=list)
    token_count: int = 0


# ---------------------------------------------------------------------------
# Split PRD into sections
# ---------------------------------------------------------------------------

def split_into_sections(text: str) -> list[Section]:
    """Split PRD text into typed ``Section`` objects based on headers."""
    sections: list[Section] = []
    lines = text.split("\n")

    current_type = SectionType.PREAMBLE
    current_heading = ""
    current_body_lines: list[str] = []

    def _flush() -> None:
        if current_body_lines or current_heading:
            body = "\n".join(current_body_lines).strip()
            sections.append(
                Section(
                    section_type=current_type,
                    heading=current_heading,
                    body=body,
                )
            )

    for line in lines:
        matched_type: SectionType | None = None
        for sec_type, pattern in SECTION_PATTERNS.items():
            if re.match(pattern, line, re.IGNORECASE):
                matched_type = sec_type
                break

        if matched_type is not None:
            _flush()
            current_type = matched_type
            current_heading = line
            current_body_lines = []
        else:
            current_body_lines.append(line)

    _flush()
    return sections


# ---------------------------------------------------------------------------
# Chunk assembly with token-budget packing
# ---------------------------------------------------------------------------

def chunk_prd(
    text: str,
    token_budget: int = DEFAULT_TOKEN_BUDGET,
) -> list[Chunk]:
    """Split a PRD into ``Chunk`` objects respecting *token_budget*.

    Algorithm:
        1. Split into ``Section`` objects by header.
        2. Pack consecutive small sections into chunks until the budget
           would be exceeded.
        3. If a single section exceeds the budget, sub-split on blank-line
           (paragraph) boundaries, keeping each fragment under budget.
    """
    raw_sections = split_into_sections(text)
    chunks: list[Chunk] = []

    # Current accumulating chunk
    pending_sections: list[tuple[SectionType, str]] = []
    pending_texts: list[str] = []
    pending_types: list[SectionType] = []
    pending_tokens: int = 0

    def _flush_pending() -> None:
        nonlocal pending_sections, pending_texts, pending_types, pending_tokens
        if pending_texts:
            full_text = "\n\n".join(pending_texts)
            chunks.append(
                Chunk(
                    text=full_text,
                    sections=pending_sections[:],
                    section_types=pending_types[:],
                    token_count=count_tokens(full_text),
                )
            )
        pending_sections = []
        pending_texts = []
        pending_types = []
        pending_tokens = 0

    for sec in raw_sections:
        sec_tokens = sec.token_count

        # Case 1: Section alone fits in budget
        if sec_tokens <= token_budget:
            # Would adding it exceed the *current* pending chunk?
            added_tokens = count_tokens(sec.text) if not pending_texts else count_tokens("\n\n" + sec.text)
            if pending_tokens + added_tokens <= token_budget:
                pending_sections.append((sec.section_type, sec.text))
                pending_texts.append(sec.text)
                pending_types.append(sec.section_type)
                pending_tokens += added_tokens
            else:
                _flush_pending()
                pending_sections.append((sec.section_type, sec.text))
                pending_texts.append(sec.text)
                pending_types.append(sec.section_type)
                pending_tokens = sec_tokens
            continue

        # Case 2: Single section exceeds budget — must sub-split
        _flush_pending()
        fragments = _subsplit_section(sec, token_budget)
        for frag_type, frag_text in fragments:
            chunks.append(
                Chunk(
                    text=frag_text,
                    sections=[(frag_type, frag_text)],
                    section_types=[frag_type],
                    token_count=count_tokens(frag_text),
                )
            )

    _flush_pending()
    return chunks


def _subsplit_section(
    section: Section,
    token_budget: int,
) -> list[tuple[SectionType, str]]:
    """Sub-split an oversized section on paragraph/blank-line boundaries.

    Each fragment includes the original heading plus a slice of the body
    that keeps the total under *token_budget*.
    """
    heading = section.heading
    heading_tokens = count_tokens(heading) if heading else 0
    body_budget = token_budget - heading_tokens - 1  # -1 for the \n

    if body_budget <= 0:
        # Heading alone exceeds budget — just return it as-is
        return [(section.section_type, section.text)]

    # Split body on blank lines (paragraph boundaries)
    paragraphs = section.body.split("\n\n")
    fragments: list[tuple[SectionType, str]] = []
    current_paras: list[str] = []
    current_tokens: int = 0

    for para in paragraphs:
        para_tokens = count_tokens(para)
        if para_tokens > body_budget:
            # A single paragraph is too big — split on newlines within it
            sublines = para.split("\n")
            for line in sublines:
                line_tokens = count_tokens(line)
                if current_tokens + line_tokens > body_budget and current_paras:
                    frag_text = f"{heading}\n" + "\n".join(current_paras)
                    fragments.append((section.section_type, frag_text))
                    current_paras = []
                    current_tokens = 0
                current_paras.append(line)
                current_tokens += line_tokens
            continue

        if current_tokens + para_tokens > body_budget and current_paras:
            frag_text = f"{heading}\n" + "\n\n".join(current_paras)
            fragments.append((section.section_type, frag_text))
            current_paras = []
            current_tokens = 0

        current_paras.append(para)
        current_tokens += para_tokens

    if current_paras:
        frag_text = f"{heading}\n" + "\n\n".join(current_paras)
        fragments.append((section.section_type, frag_text))

    return fragments
