"""Structural, token-aware chunking for arbitrarily large PRD documents.

The core problem: an average model's context window is finite, but a PRD can
be 50, 200, or 2000 pages. We cannot just slice the raw text every N
characters — that severs an actor's bullet list from its header, or a use
case's "main flow" from its "preconditions", and the LLM extracting from
that fragment will either hallucinate the missing half or silently drop it.

Strategy:
1. Reuse header-detection regexes to find natural section boundaries (these
   are *semantic* boundaries the PRD author already drew for us).
2. Greedily pack consecutive sections into a chunk until adding the next
   section would exceed `max_tokens_per_chunk`. This keeps related content
   together and keeps chunk count near-minimal for a given budget.
3. If a single section is itself larger than the budget (e.g. a 40-page
   "Use Cases" section), recursively split *that section* on paragraph and
   list-item boundaries — never mid-sentence, never mid-bullet.
4. Token counts are estimated with tiktoken's cl100k_base encoding. This is
   an approximation (exact tokenization differs per model/provider) so we
   apply a safety margin (`SAFETY_MARGIN`) to avoid bumping into real
   provider limits.

Each emitted Chunk carries enough metadata (section type, position, char
span) that a caller can route it to the right extraction schema and stitch
results back together in order. This module is intentionally LLM-free and
PRD-extraction-agnostic — `SectionType`/`SECTION_PATTERNS` are internal
chunk-packing heuristics only, not a contract concept (`PRDAnalysisReport`'s
`section_name` is free text; nothing here needs to map onto it 1:1).

Ported from `be/src/newllm/chunking.py` (an evaluation-only package written
for a different project), adapted to this repo's conventions; see
`input_processing/application/chunked_prd_analyzer.py` for the caller.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from enum import Enum

try:
    import tiktoken

    _ENCODING = tiktoken.get_encoding("cl100k_base")
except Exception:  # pragma: no cover - tiktoken should be available, but degrade gracefully
    _ENCODING = None

# Roughly 4 chars/token for English prose; used only if tiktoken is unavailable.
_FALLBACK_CHARS_PER_TOKEN = 4

# Leave headroom below the nominal model context window for: system prompt,
# few-shot/registry context injected per chunk, output tokens, and the fact
# that tiktoken's cl100k_base count is an approximation for non-OpenAI models.
SAFETY_MARGIN = 0.75


class SectionType(str, Enum):
    OVERVIEW = "overview"
    ACTORS = "actors"
    FEATURES = "features"
    USE_CASES = "use_cases"
    USER_STORIES = "user_stories"
    NON_FUNCTIONAL = "non_functional"
    ARCHITECTURE = "architecture"
    API = "api"
    DATA = "data"
    SECURITY = "security"
    UI_UX = "ui_ux"
    OUT_OF_SCOPE = "out_of_scope"
    PREAMBLE = "_preamble"
    UNKNOWN = "unknown"


SECTION_PATTERNS: dict[SectionType, str] = {
    SectionType.OVERVIEW: r"(?:^|\n)\s*#{1,3}\s*(?:overview|introduction|summary|background|context)\b",
    SectionType.ACTORS: r"(?:^|\n)\s*#{1,3}\s*(?:actors?|users?|roles?|personas?|stakeholders?)\b",
    SectionType.FEATURES: r"(?:^|\n)\s*#{1,3}\s*(?:features?|requirements?|functional|capabilities?)\b",
    SectionType.USE_CASES: r"(?:^|\n)\s*#{1,3}\s*(?:use\s*cases?|workflows?|scenarios?|flows?)\b",
    SectionType.USER_STORIES: r"(?:^|\n)\s*#{1,3}\s*(?:user\s*stories?|stories?)\b",
    SectionType.NON_FUNCTIONAL: r"(?:^|\n)\s*#{1,3}\s*(?:non[-\s]*functional|nfr|performance|security|constraints?)\b",
    SectionType.ARCHITECTURE: r"(?:^|\n)\s*#{1,3}\s*(?:architecture|tech\s*stack|technology|infrastructure|design)\b",
    SectionType.API: r"(?:^|\n)\s*#{1,3}\s*(?:api|endpoints?|interfaces?)\b",
    SectionType.DATA: r"(?:^|\n)\s*#{1,3}\s*(?:data\s*model|database|schema|entities?|storage)\b",
    SectionType.SECURITY: r"(?:^|\n)\s*#{1,3}\s*(?:security|auth|authentication|authorization|privacy|compliance)\b",
    SectionType.UI_UX: r"(?:^|\n)\s*#{1,3}\s*(?:ui|ux|interface|design|frontend|screen|page)\b",
    SectionType.OUT_OF_SCOPE: r"(?:^|\n)\s*#{1,3}\s*(?:out\s*of\s*scope|exclusions?|not\s*in\s*scope)\b",
}


@dataclass
class RawSection:
    """A single header-delimited section of the source document, in original order."""

    section_type: SectionType
    heading: str
    body: str
    start_char: int
    end_char: int


@dataclass
class Chunk:
    """One packed unit of work handed to the LLM extraction agent.

    A chunk may contain multiple RawSections (packed together under the
    token budget) or a sub-split fragment of one oversized section.

    `text` is the flat, joined text used for the LLM prompt (order-preserving,
    headings included). `sections` preserves the same content broken out by
    section type. For a chunk that is a partial fragment of one oversized
    section, `sections` has exactly one entry covering that fragment.
    """

    index: int
    text: str
    section_types: list[SectionType]
    sections: list[tuple[SectionType, str]]
    token_estimate: int
    start_char: int
    end_char: int
    is_partial_section: bool = False
    total_chunks: int | None = None  # filled in once chunking completes


def estimate_tokens(text: str) -> int:
    if _ENCODING is not None:
        return len(_ENCODING.encode(text, disallowed_special=()))
    return max(1, len(text) // _FALLBACK_CHARS_PER_TOKEN)


def split_into_raw_sections(text: str) -> list[RawSection]:
    """Find header lines, classify them, and slice the document into ordered sections."""
    lines = text.split("\n")
    # Precompute line start offsets for char-span tracking.
    offsets = []
    pos = 0
    for line in lines:
        offsets.append(pos)
        pos += len(line) + 1  # +1 for the stripped '\n'

    sections: list[RawSection] = []
    current_type = SectionType.PREAMBLE
    current_heading = ""
    current_start = 0
    current_lines: list[str] = []

    def flush(end_pos: int) -> None:
        body = "\n".join(current_lines).strip()
        if body or current_heading:
            sections.append(
                RawSection(
                    section_type=current_type,
                    heading=current_heading,
                    body=body,
                    start_char=current_start,
                    end_char=end_pos,
                )
            )

    for i, line in enumerate(lines):
        matched_type: SectionType | None = None
        for section_type, pattern in SECTION_PATTERNS.items():
            if re.search(pattern, line, re.IGNORECASE):
                matched_type = section_type
                break

        if matched_type is not None:
            flush(offsets[i])
            current_type = matched_type
            current_heading = line.strip()
            current_start = offsets[i]
            current_lines = []
        else:
            current_lines.append(line)

    flush(offsets[-1] + len(lines[-1]) if lines else 0)
    return sections


def _split_oversized_section(section: RawSection, max_tokens: int) -> list[str]:
    """Split one section's body into fragments under max_tokens, on safe boundaries.

    Boundary preference order: blank-line paragraph breaks, then list-item
    starts (`-`, `*`, digit-dot), then as a last resort hard line breaks. Never
    splits inside a line.
    """
    full_text = f"{section.heading}\n{section.body}".strip()
    if estimate_tokens(full_text) <= max_tokens:
        return [full_text]

    # Prefer paragraph boundaries.
    paragraphs = re.split(r"\n\s*\n", section.body)
    fragments: list[str] = []
    current = [section.heading]

    def _joined_tokens(parts: list[str]) -> int:
        # Re-tokenize the actual joined string rather than summing each
        # part's token count independently. BPE tokenizers are NOT additive
        # across concatenation boundaries (joining two lines can produce a
        # different total token count than the sum of their individual
        # counts, since tokens can merge across whitespace/newlines). Trusting
        # a running sum lets the true count silently drift past the budget
        # by a meaningful margin over many appends.
        return estimate_tokens("\n".join(parts))

    for para in paragraphs:
        para_tokens = estimate_tokens(para)
        if para_tokens > max_tokens:
            # Even a single paragraph is too big — split on list items / lines.
            sub_lines = para.split("\n")
            for line in sub_lines:
                if _joined_tokens(current + [line]) > max_tokens and len(current) > 1:
                    fragments.append("\n".join(current).strip())
                    current = [f"{section.heading} (continued)"]
                current.append(line)
        else:
            if _joined_tokens(current + [para]) > max_tokens and len(current) > 1:
                fragments.append("\n".join(current).strip())
                current = [f"{section.heading} (continued)"]
            current.append(para)

    if len(current) > 1:
        fragments.append("\n".join(current).strip())

    return fragments if fragments else [full_text]


def chunk_prd(text: str, max_tokens_per_chunk: int = 6000) -> list[Chunk]:
    """Split a (potentially very large) PRD into ordered, semantically-coherent chunks.

    Args:
        text: full PRD source text.
        max_tokens_per_chunk: target budget per chunk before the safety margin.

    Returns:
        Ordered list of Chunk objects. Each chunk's `text` is ready to drop
        straight into an LLM prompt. Empty input returns an empty list.
    """
    raw_sections = split_into_raw_sections(text)
    if not raw_sections:
        return []

    chunks: list[Chunk] = []
    pending_sections: list[tuple[SectionType, str]] = []
    pending_tokens = 0
    pending_start: int | None = None
    pending_end = 0

    def flush_pending() -> None:
        nonlocal pending_sections, pending_tokens, pending_start, pending_end
        if not pending_sections:
            return
        joined = "\n\n".join(s[1] for s in pending_sections)
        chunks.append(
            Chunk(
                index=len(chunks),
                text=joined,
                section_types=[s[0] for s in pending_sections],
                sections=list(pending_sections),
                token_estimate=pending_tokens,
                start_char=pending_start or 0,
                end_char=pending_end,
                is_partial_section=False,
            )
        )
        pending_sections, pending_tokens, pending_start = [], 0, None

    for section in raw_sections:
        section_full = f"{section.heading}\n{section.body}".strip() if section.heading else section.body
        if not section_full:
            continue
        section_tokens = estimate_tokens(section_full)

        if section_tokens > max_tokens_per_chunk:
            # Oversized single section: flush whatever is pending, then emit
            # this section as its own sequence of partial-section chunks.
            flush_pending()
            fragments = _split_oversized_section(section, max_tokens_per_chunk)
            for frag in fragments:
                chunks.append(
                    Chunk(
                        index=len(chunks),
                        text=frag,
                        section_types=[section.section_type],
                        sections=[(section.section_type, frag)],
                        token_estimate=estimate_tokens(frag),
                        start_char=section.start_char,
                        end_char=section.end_char,
                        is_partial_section=len(fragments) > 1,
                    )
                )
            continue

        if pending_tokens + section_tokens > max_tokens_per_chunk and pending_sections:
            flush_pending()

        if pending_start is None:
            pending_start = section.start_char
        pending_sections.append((section.section_type, section_full))
        pending_tokens += section_tokens
        pending_end = section.end_char

    flush_pending()

    for c in chunks:
        c.total_chunks = len(chunks)

    return chunks
