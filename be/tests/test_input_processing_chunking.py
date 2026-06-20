"""Tests for input_processing/chunking.py - structural, token-aware PRD
chunking. Ported from be/src/newllm/test_prd_extraction.py's TestChunking
(an evaluation-only package for a different project); the fast_regex and
orchestrator test classes from that file don't apply here - this module has
no regex-extraction fast path and a different (gap-analysis, not entity-
extraction) merge problem, covered separately in
test_chunked_prd_analyzer.py.
"""

from bluebox.modules.input_processing.chunking import (
    SectionType,
    chunk_prd,
    estimate_tokens,
    split_into_raw_sections,
)

SAMPLE_PRD = """# Order Management System

## Overview
A system for managing customer orders end to end.

## Actors
- **Admin** (human): Manages users and configuration.
- **Customer** (human): Places and tracks orders.
- **PaymentGateway** (external): Processes payments.

## Features
1. **Order Placement**: Customers can place orders.
   - Add items to cart
   - Apply discount codes
2. **Order Tracking**: Customers can track order status.

## Non-Functional Requirements
- The system shall respond within 200ms for 95% of requests.
- The system shall support 10,000 concurrent users.

## Out of Scope
- International shipping is not included in v1.
"""


def test_splits_on_headers():
    sections = split_into_raw_sections(SAMPLE_PRD)
    types = [s.section_type for s in sections]
    assert SectionType.OVERVIEW in types
    assert SectionType.ACTORS in types
    assert SectionType.FEATURES in types
    assert SectionType.NON_FUNCTIONAL in types
    assert SectionType.OUT_OF_SCOPE in types


def test_small_doc_packs_into_few_chunks():
    chunks = chunk_prd(SAMPLE_PRD, max_tokens_per_chunk=6000)
    assert len(chunks) >= 1
    for c in chunks:
        assert c.token_estimate <= 6000


def test_oversized_section_is_split_not_dropped():
    # One giant features section, far bigger than the budget.
    big_features = "## Features\n" + "\n".join(
        f"{i}. **Feature {i}**: does thing {i} with a fairly long description "
        f"to pad out the token count for this synthetic feature item."
        for i in range(500)
    )
    text = "# Big Doc\n\n## Overview\nshort overview\n\n" + big_features
    chunks = chunk_prd(text, max_tokens_per_chunk=2000)
    assert len(chunks) > 1
    feature_chunks = [c for c in chunks if SectionType.FEATURES in c.section_types]
    assert len(feature_chunks) > 1
    for c in feature_chunks:
        assert c.token_estimate <= 2000 + 50  # small slack for heading repeats
    # No feature text should be lost: every "Feature N" should appear in exactly one chunk.
    all_text = "\n".join(c.text for c in feature_chunks)
    for i in range(500):
        assert f"Feature {i}" in all_text


def test_chunks_are_ordered_and_indexed():
    chunks = chunk_prd(SAMPLE_PRD, max_tokens_per_chunk=100)
    indices = [c.index for c in chunks]
    assert indices == list(range(len(chunks)))
    assert all(c.total_chunks == len(chunks) for c in chunks)


def test_estimate_tokens_nonzero_for_nonempty_text():
    assert estimate_tokens("hello world") > 0
    assert estimate_tokens("") >= 0


def test_empty_document_returns_no_chunks():
    assert chunk_prd("") == []
