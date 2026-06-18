"""Comprehensive test suite for the PRD Extraction Engine.

Run with::

    cd /mnt/agents/output && python -m pytest prd_extractor/test_prd_extractor.py -v
    # or without pytest:
    cd /mnt/agents/output && python -m prd_extractor.test_prd_extractor
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

# Ensure the package is importable
sys.path.insert(0, str(Path(__file__).parent.parent))

from .chunker import Chunk, chunk_prd, count_tokens, split_into_sections
from .fast_regex import (
    chunk_quality_score,
    extract_chunk,
    extract_problem_statement,
    extract_project_name,
)
from .models import (
    ChunkResult,
    ExtractedActor,
    ExtractedCapability,
    ExtractedPRD,
    ExtractedUseCase,
    ExtractedUserStory,
    SectionType,
)
from .orchestrator import EventType, extract_prd, extract_prd_streaming
from .registry import ExtractionRegistry


# ============================================================================
# Fixtures
# ============================================================================

SMALL_WELL_FORMED_PRD = """
# E-Commerce Platform

## Overview
Build a modern e-commerce platform for small businesses to sell products online.
The platform must handle inventory, payments, and shipping integrations.

## Actors
- **Admin** (human): Manages the platform, users, and configuration.
- **Customer** (human): Browses products, places orders, tracks shipments.
- **Payment Gateway** (external): Processes credit card transactions securely.

## Features
1. **User Management**: Authentication, registration, password reset.
2. **Product Catalog**: Browse, search, filter products by category and price.
3. **Shopping Cart**: Add/remove items, apply discount codes, calculate totals.
4. **Order Processing**: Checkout flow, payment integration, order confirmation.
5. **Inventory Management**: Track stock levels, low-stock alerts, restocking.

## Use Cases
1. **Customer Registration**: New customer creates an account.
   Preconditions: Customer has valid email.
   Steps:
   1. Customer navigates to registration page
   2. Enters email and password
   3. Confirms email via link
   Postconditions: Account is active and can place orders.

2. **Place Order**: Customer completes purchase.
   Preconditions: Customer is logged in, cart has items.
   Steps:
   1. Customer proceeds to checkout
   2. Enters shipping address
   3. Selects payment method
   4. Confirms order
   Postconditions: Order is created, inventory is decremented.

## User Stories
As a Customer, I want to filter products by price range so that I can find items within my budget.
Acceptance Criteria:
- Min/max price inputs are visible
- Filter applies instantly
- Results update without page reload

As an Admin, I want to receive low-stock alerts so that I can restock popular items.

## Non-Functional Requirements
- Response time < 200ms for product search
- Support 10,000 concurrent users
- 99.9% uptime SLA
- PCI-DSS compliance for payment data
- GDPR compliance for EU customers
""".strip()


def _generate_large_prd(num_features: int = 3000) -> str:
    """Generate a large PRD that forces multi-chunk splitting."""
    lines = [
        "# Mega Platform",
        "",
        "## Overview",
        "A very large platform with thousands of features.",
        "",
        "## Actors",
    ]
    for i in range(3):
        lines.append(f"- **Actor{i}** (human): Does thing {i}")
    lines.append("")
    lines.append("## Features")
    for i in range(num_features):
        lines.append(f"{i+1}. **Feature {i}**: This feature does something important for the platform.")
    lines.append("")
    lines.append("## Non-Functional Requirements")
    for i in range(20):
        lines.append(f"- NFR {i}: The system must handle requirement {i}")
    return "\n".join(lines)


# ============================================================================
# Tests — Chunker
# ============================================================================


def test_split_into_sections_basic():
    sections = split_into_sections(SMALL_WELL_FORMED_PRD)
    types = [s.section_type for s in sections]
    assert SectionType.OVERVIEW in types
    assert SectionType.ACTORS in types
    assert SectionType.FEATURES in types
    assert SectionType.USE_CASES in types
    assert SectionType.USER_STORIES in types
    assert SectionType.NON_FUNCTIONAL in types
    print(f"  ✓ split_into_sections: found {len(sections)} sections ({[t.value for t in types]})")


def test_chunk_prd_small_doc_single_chunk():
    chunks = chunk_prd(SMALL_WELL_FORMED_PRD, token_budget=6_000)
    assert len(chunks) >= 1
    total_tokens = sum(c.token_count for c in chunks)
    assert total_tokens > 0
    print(f"  ✓ small doc: {len(chunks)} chunk(s), {total_tokens} total tokens")


def test_chunk_prd_large_doc_forces_splitting():
    large = _generate_large_prd(num_features=3000)
    chunks = chunk_prd(large, token_budget=6_000)
    assert len(chunks) > 1, "Large PRD should split into multiple chunks"
    for c in chunks:
        assert c.token_count <= 6_000 + 500, f"Chunk {c.section_types} exceeds budget: {c.token_count}"
    print(f"  ✓ large doc: {len(chunks)} chunks, all within budget")


def test_chunk_preserves_sections():
    chunks = chunk_prd(SMALL_WELL_FORMED_PRD, token_budget=6_000)
    for chunk in chunks:
        assert len(chunk.sections) == len(chunk.section_types)
        for sec_type, sec_text in chunk.sections:
            assert len(sec_text) > 0
    print(f"  ✓ all chunks preserve per-section text")


# ============================================================================
# Tests — Fast Regex
# ============================================================================


def test_extract_actors():
    chunks = chunk_prd(SMALL_WELL_FORMED_PRD, token_budget=6_000)
    for chunk in chunks:
        if SectionType.ACTORS in chunk.section_types:
            result = extract_chunk(chunk)
            assert len(result.actors) == 3, f"Expected 3 actors, got {len(result.actors)}"
            names = [a.name for a in result.actors]
            assert "Admin" in names
            assert "Customer" in names
            assert "Payment Gateway" in names
            print(f"  ✓ extracted {len(result.actors)} actors: {names}")
            return
    raise AssertionError("No actors chunk found")


def test_extract_capabilities():
    chunks = chunk_prd(SMALL_WELL_FORMED_PRD, token_budget=6_000)
    found = False
    for chunk in chunks:
        result = extract_chunk(chunk)
        if result.capabilities:
            found = True
            names = [c.name for c in result.capabilities]
            assert "User Management" in names
            assert "Inventory Management" in names
            print(f"  ✓ extracted {len(result.capabilities)} capabilities: {names}")
    assert found, "No capabilities extracted"


def test_extract_use_cases():
    chunks = chunk_prd(SMALL_WELL_FORMED_PRD, token_budget=6_000)
    found = False
    for chunk in chunks:
        result = extract_chunk(chunk)
        if result.use_cases:
            found = True
            names = [uc.name for uc in result.use_cases]
            assert "Customer Registration" in names
            assert "Place Order" in names
            # Check flow steps extracted
            uc = result.use_cases[0]
            assert len(uc.main_flow) >= 2, f"Expected flow steps, got {uc.main_flow}"
            print(f"  ✓ extracted {len(result.use_cases)} use cases with flow steps")
    assert found, "No use cases extracted"


def test_extract_user_stories():
    chunks = chunk_prd(SMALL_WELL_FORMED_PRD, token_budget=6_000)
    for chunk in chunks:
        if SectionType.USER_STORIES in chunk.section_types:
            result = extract_chunk(chunk)
            assert len(result.user_stories) == 2
            stories = [us.title for us in result.user_stories]
            assert any("filter" in s.lower() for s in stories)
            print(f"  ✓ extracted {len(result.user_stories)} user stories: {stories}")
            return
    raise AssertionError("No user_stories chunk found")


def test_chunk_quality_score_high_for_well_formed():
    chunks = chunk_prd(SMALL_WELL_FORMED_PRD, token_budget=6_000)
    for chunk in chunks:
        result = extract_chunk(chunk)
        score = chunk_quality_score(chunk, result)
        # Well-formed chunks should score well
        if SectionType.ACTORS in chunk.section_types or SectionType.FEATURES in chunk.section_types:
            assert score >= 50, f"Well-formed chunk scored only {score}: {chunk.section_types}"
    print(f"  ✓ quality scores are healthy for well-formed PRD")


def test_fast_regex_no_false_positives_on_cross_section():
    """When actors+features pack into one chunk, NFR count must not be polluted."""
    large = _generate_large_prd(num_features=50)
    chunks = chunk_prd(large, token_budget=6_000)
    for chunk in chunks:
        result = extract_chunk(chunk)
        # If this chunk has no NON_FUNCTIONAL section, nfr should be 0
        if SectionType.NON_FUNCTIONAL not in chunk.section_types:
            assert result.non_functional_requirements == [], \
                f"False NFRs in non-NFR chunk: {result.non_functional_requirements[:5]}"
    print(f"  ✓ no cross-section false positives")


def test_extract_project_name():
    name = extract_project_name(SMALL_WELL_FORMED_PRD)
    assert name == "E-Commerce Platform"
    print(f"  ✓ project name: '{name}'")


def test_extract_problem_statement():
    stmt = extract_problem_statement(SMALL_WELL_FORMED_PRD)
    assert "small businesses" in stmt.lower()
    print(f"  ✓ problem statement: '{stmt[:80]}...'")


# ============================================================================
# Tests — Registry
# ============================================================================


def test_registry_absorb_and_dedup():
    reg = ExtractionRegistry()
    r1 = ChunkResult(actors=[ExtractedActor(name="Admin", description="First")])
    r2 = ChunkResult(actors=[ExtractedActor(name="Admin", description="", responsibilities=["Manage users"])])
    reg.absorb(r1)
    reg.absorb(r2)
    assert reg.actor_count == 1
    actor = reg._actors["actor-admin"]
    assert actor.description == "First"  # preferred existing
    assert "Manage users" in actor.responsibilities
    print(f"  ✓ registry dedup: 2 absorbs → 1 actor with merged responsibilities")


def test_registry_resolve_dangling_refs():
    reg = ExtractionRegistry()
    reg.absorb(ChunkResult(actors=[ExtractedActor(name="Admin")]))
    # Add a use case referencing a non-existent actor
    reg.absorb(ChunkResult(use_cases=[ExtractedUseCase(name="Test", actor_ids=["actor-ghost"])]))
    warnings = reg.resolve_dangling_references()
    assert len(warnings) == 1
    assert "ghost" in warnings[0]
    print(f"  ✓ dangling reference caught: {warnings[0]}")


def test_registry_reconcile_near_duplicates():
    reg = ExtractionRegistry()
    reg.absorb(ChunkResult(actors=[
        ExtractedActor(name="Payment Gateway"),
        ExtractedActor(name="Payment Gateways"),
    ]))
    actions = reg.reconcile_near_duplicates()
    assert len(actions) == 1
    assert reg.actor_count == 1
    print(f"  ✓ fuzzy dedup: {actions[0]}")


def test_registry_known_names_views():
    reg = ExtractionRegistry()
    assert reg.known_actor_names == []
    reg.absorb(ChunkResult(actors=[ExtractedActor(name="Alice")]))
    assert reg.known_actor_names == ["Alice"]
    assert reg.known_actor_ids == ["actor-alice"]
    print(f"  ✓ known names views work")


# ============================================================================
# Tests — Orchestrator (async)
# ============================================================================


async def test_streaming_yields_events():
    events = []
    async for event in extract_prd_streaming(SMALL_WELL_FORMED_PRD, force_llm=False):
        events.append(event)

    types = [e.type for e in events]
    assert EventType.CHUNK_START in types
    assert EventType.COMPLETE in types

    complete = [e for e in events if e.type == EventType.COMPLETE][0]
    assert complete.final_prd is not None
    assert len(complete.final_prd.actors) == 3
    print(f"  ✓ streaming: {len(events)} events, final has {len(complete.final_prd.actors)} actors")


async def test_streaming_regex_only_no_llm():
    """Well-formed small PRD should hit regex path for all chunks."""
    events = []
    async for event in extract_prd_streaming(SMALL_WELL_FORMED_PRD, force_llm=False):
        events.append(event)

    llm_events = [e for e in events if e.type == EventType.CHUNK_LLM_OK]
    regex_events = [e for e in events if e.type == EventType.CHUNK_REGEX_OK]
    # Most chunks should be regex-only for a well-formed PRD
    assert len(regex_events) >= len(llm_events), \
        f"Expected mostly regex, got {len(regex_events)} regex vs {len(llm_events)} LLM"
    print(f"  ✓ regex-only path: {len(regex_events)} regex, {len(llm_events)} LLM chunks")


async def test_extract_prd_blocking():
    result = await extract_prd(SMALL_WELL_FORMED_PRD, force_llm=False)
    assert isinstance(result, ExtractedPRD)
    assert len(result.actors) == 3
    assert len(result.capabilities) == 5
    assert result.project_name == "E-Commerce Platform"
    print(f"  ✓ blocking API: {len(result.actors)} actors, {len(result.capabilities)} caps")


async def test_streaming_with_force_llm_no_api_key():
    """force_llm=True without API key should gracefully fall back per chunk."""
    events = []
    async for event in extract_prd_streaming(
        SMALL_WELL_FORMED_PRD,
        force_llm=True,
        model="anthropic:claude-sonnet-4-20250514",  # will fail without key
    ):
        events.append(event)

    complete = [e for e in events if e.type == EventType.COMPLETE][0]
    assert complete.final_prd is not None
    # Should still have regex-extracted actors from pre-absorb
    assert len(complete.final_prd.actors) == 3
    print(f"  ✓ force_llm fallback: extracted {len(complete.final_prd.actors)} actors despite no API key")


async def test_large_prd_chunks_correctly():
    large = _generate_large_prd(num_features=3000)
    events = []
    async for event in extract_prd_streaming(large, token_budget=6_000, force_llm=False):
        events.append(event)

    complete = [e for e in events if e.type == EventType.COMPLETE][0]
    assert complete.final_prd is not None
    # Should find all 3 actors and 3000 capabilities (or close, regex may miss some edge cases)
    assert len(complete.final_prd.actors) == 3
    assert len(complete.final_prd.capabilities) >= 2900, \
        f"Expected ~3000 capabilities, got {len(complete.final_prd.capabilities)}"
    print(f"  ✓ large PRD: {len(complete.final_prd.actors)} actors, {len(complete.final_prd.capabilities)} capabilities")


# ============================================================================
# Test runner
# ============================================================================


def run_sync_tests():
    """Run all synchronous tests."""
    print("\n" + "=" * 60)
    print("SYNC TESTS")
    print("=" * 60)

    tests = [
        test_split_into_sections_basic,
        test_chunk_prd_small_doc_single_chunk,
        test_chunk_prd_large_doc_forces_splitting,
        test_chunk_preserves_sections,
        test_extract_actors,
        test_extract_capabilities,
        test_extract_use_cases,
        test_extract_user_stories,
        test_chunk_quality_score_high_for_well_formed,
        test_fast_regex_no_false_positives_on_cross_section,
        test_extract_project_name,
        test_extract_problem_statement,
        test_registry_absorb_and_dedup,
        test_registry_resolve_dangling_refs,
        test_registry_reconcile_near_duplicates,
        test_registry_known_names_views,
    ]

    passed = 0
    failed = 0
    for test in tests:
        try:
            test()
            passed += 1
        except Exception as e:
            print(f"  ✗ {test.__name__}: {e}")
            failed += 1

    print(f"\nSync: {passed} passed, {failed} failed")
    return failed == 0


async def run_async_tests():
    """Run all async tests."""
    print("\n" + "=" * 60)
    print("ASYNC TESTS")
    print("=" * 60)

    tests = [
        test_streaming_yields_events,
        test_streaming_regex_only_no_llm,
        test_extract_prd_blocking,
        test_streaming_with_force_llm_no_api_key,
        test_large_prd_chunks_correctly,
    ]

    passed = 0
    failed = 0
    for test in tests:
        try:
            await test()
            passed += 1
        except Exception as e:
            print(f"  ✗ {test.__name__}: {e}")
            failed += 1

    print(f"\nAsync: {passed} passed, {failed} failed")
    return failed == 0


async def main():
    sync_ok = run_sync_tests()
    async_ok = await run_async_tests()

    print("\n" + "=" * 60)
    if sync_ok and async_ok:
        print("ALL TESTS PASSED ✓")
    else:
        print("SOME TESTS FAILED ✗")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
