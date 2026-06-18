from app.pipeline.new_prd_extractor.models import (
    ExtractedActor,
    ExtractedCapability,
    ExtractedPRD,
    ExtractedUseCase,
    ExtractedUserStory,
)

__all__ = [
    "extract_prd",
    "get_extraction_quality_report",
    "ExtractedPRD",
    "ExtractedActor",
    "ExtractedCapability",
    "ExtractedUseCase",
    "ExtractedUserStory",
]


def extract_prd(prd_text: str) -> ExtractedPRD:
    """Synchronous wrapper around the async streaming extractor.

    Runs the regex-based extraction synchronously (no LLM), which is
    what the old API did when ``needs_llm`` was false.
    """
    import re
    from app.pipeline.new_prd_extractor.chunker import chunk_prd
    from app.pipeline.new_prd_extractor.fast_regex import chunk_quality_score, extract_chunk
    from app.pipeline.new_prd_extractor.registry import ExtractionRegistry

    chunks = chunk_prd(prd_text)
    registry = ExtractionRegistry()

    # Track section types found
    explicit_sections = set()
    for chunk in chunks:
        regex_result = extract_chunk(chunk)
        registry.absorb(regex_result)
        for st in chunk.section_types:
            if st.value != "_preamble":
                explicit_sections.add(st.value)

    # Compute word count and structure detection
    word_count = len(prd_text.split())
    # Detect markdown headers OR numbered sections
    has_structure = bool(
        re.search(r"^#{1,3}\s+", prd_text, re.MULTILINE) or
        re.search(r"^\d+\.\s+[A-Z]", prd_text, re.MULTILINE)
    )

    return registry.to_prd(
        word_count=word_count,
        has_structure=has_structure,
        explicit_sections=list(explicit_sections),
    )


def get_extraction_quality_report(prd: ExtractedPRD) -> dict:
    """Build a quality report compatible with the old API format."""
    # Use explicit_sections_found if available, otherwise infer from extracted data
    if prd.explicit_sections_found:
        sections_found = list(prd.explicit_sections_found)
    else:
        sections_found = []
        if prd.actors:
            sections_found.append("actors")
        if prd.capabilities:
            sections_found.append("capabilities")
        if prd.use_cases:
            sections_found.append("use_cases")
        if prd.user_stories:
            sections_found.append("user_stories")
        if prd.non_functional_requirements:
            sections_found.append("non_functional")
        if prd.architecture_hints:
            sections_found.append("architecture")
        if prd.api_hints:
            sections_found.append("api")
        if prd.data_model_hints:
            sections_found.append("data_model")
        if prd.security_hints:
            sections_found.append("security")
        if prd.ui_ux_hints:
            sections_found.append("ui_ux")
        if prd.out_of_scope:
            sections_found.append("out_of_scope")

    # Calculate quality score
    score = 0
    if prd.has_structure:
        score += 20
    if prd.actors:
        score += 10
    if prd.capabilities:
        score += 10
    if prd.use_cases:
        score += 10
    if prd.user_stories:
        score += 10
    if prd.non_functional_requirements:
        score += 10
    if prd.architecture_hints:
        score += 5
    if prd.api_hints:
        score += 5
    if prd.data_model_hints:
        score += 5
    if prd.security_hints:
        score += 5
    if prd.ui_ux_hints:
        score += 5
    if prd.out_of_scope:
        score += 5

    score = min(score, 100)

    return {
        "quality_score": score,
        "has_structure": prd.has_structure,
        "needs_llm": score < 70,
        "actors_extracted": len(prd.actors),
        "capabilities_extracted": len(prd.capabilities),
        "use_cases_extracted": len(prd.use_cases),
        "user_stories_extracted": len(prd.user_stories),
        "sections_count": len(sections_found),
        "sections_found": sections_found,

    }
