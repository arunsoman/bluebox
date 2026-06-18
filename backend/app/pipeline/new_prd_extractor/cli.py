"""CLI demo for the PRD Extraction Engine.

Shows the incremental UX: prints per-chunk events as they arrive so
you can observe regex-vs-LLM decisions, quality scores, and entity
resolution in real time.

Usage::

    python -m prd_extractor.cli < prd.md
    python -m prd_extractor.cli prd.md --json > result.json
    python -m prd_extractor.cli prd.md --force-llm --model anthropic:claude-sonnet-4-20250514
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

from pydantic import TypeAdapter

from .chunker import chunk_prd, count_tokens
from .fast_regex import chunk_quality_score, extract_chunk, extract_project_name, extract_problem_statement
from .orchestrator import (
    EventType,
    extract_prd,
    extract_prd_streaming,
)


def _json_dumps_pretty(obj) -> str:
    """JSON pretty-printer that handles Pydantic models."""
    if hasattr(obj, "model_dump"):
        return json.dumps(obj.model_dump(mode="json"), indent=2, ensure_ascii=False)
    return json.dumps(obj, indent=2, ensure_ascii=False)


async def _run_streaming(args: argparse.Namespace, text: str) -> None:
    """Run the streaming extractor and print events."""
    print(f"{'=' * 60}")
    print(f"PRD Extraction Engine")
    print(f"{'=' * 60}")
    print(f"Input: {args.input_file or 'stdin'}")
    print(f"Words: {len(text.split())}")
    print(f"Tokens (approx): {count_tokens(text)}")
    print(f"Force LLM: {args.force_llm}")
    print(f"Quality threshold: {args.quality_threshold}")
    print(f"Token budget: {args.token_budget}")
    if args.model:
        print(f"Model: {args.model}")
    print(f"{'=' * 60}\n")

    final_event = None
    async for event in extract_prd_streaming(
        text,
        token_budget=args.token_budget,
        quality_threshold=args.quality_threshold,
        force_llm=args.force_llm,
        model=args.model or "anthropic:claude-sonnet-4-20250514",
    ):
        # Progress indicator
        if event.type == EventType.CHUNK_START:
            print(f"[chunks] {event.message}")
        elif event.type == EventType.CHUNK_REGEX_OK:
            print(f"  ✓ chunk {event.chunk_index}/{event.total_chunks}  regex  (score={event.quality_score})")
        elif event.type == EventType.CHUNK_LLM_OK:
            print(f"  ◉ chunk {event.chunk_index}/{event.total_chunks}  LLM    (score={event.quality_score})")
        elif event.type == EventType.CHUNK_FAILED:
            print(f"  ✗ chunk {event.chunk_index}/{event.total_chunks}  FAILED ({event.llm_error[:80]})")
        elif event.type == EventType.RESOLVING_REFS:
            print(f"[refs] {event.message}")
        elif event.type == EventType.RECONCILING_DUPS:
            print(f"[dedup] {event.message}")
        elif event.type == EventType.COMPLETE:
            final_event = event
            print(f"\n{'=' * 60}")
            print(f"COMPLETE: {event.message}")
            if event.warnings:
                print(f"\nWarnings ({len(event.warnings)}):")
                for w in event.warnings:
                    print(f"  ⚠ {w}")
            if event.actions:
                print(f"\nDedup actions ({len(event.actions)}):")
                for a in event.actions:
                    print(f"  → {a}")
            print(f"{'=' * 60}")

    # Output final JSON if requested
    if final_event and final_event.final_prd and args.json:
        print("\n" + _json_dumps_pretty(final_event.final_prd))

    # Print summary if not JSON
    if final_event and final_event.final_prd and not args.json:
        prd = final_event.final_prd
        print(f"\n--- Summary ---")
        print(f"Project: {prd.project_name or '(untitled)'}")
        print(f"Problem: {prd.problem_statement[:100]}..." if len(prd.problem_statement) > 100 else f"Problem: {prd.problem_statement}")
        print(f"Actors: {len(prd.actors)}")
        for a in prd.actors:
            print(f"  • {a.name} ({a.actor_type})")
        print(f"Capabilities: {len(prd.capabilities)}")
        print(f"Use Cases: {len(prd.use_cases)}")
        print(f"User Stories: {len(prd.user_stories)}")
        print(f"NFRs: {len(prd.non_functional_requirements)}")
        if prd.thin_statements:
            print(f"Thin statements (may need LLM): {len(prd.thin_statements)}")


async def _run_dry_run(args: argparse.Namespace, text: str) -> None:
    """Dry-run mode: show chunking and quality scores without LLM calls."""
    chunks = chunk_prd(text, token_budget=args.token_budget)
    print(f"{'=' * 60}")
    print(f"DRY RUN — Chunking analysis")
    print(f"{'=' * 60}")
    print(f"Input: {args.input_file or 'stdin'}")
    print(f"Words: {len(text.split())}")
    print(f"Tokens (approx): {count_tokens(text)}")
    print(f"Chunks: {len(chunks)}\n")

    total_score = 0
    for i, chunk in enumerate(chunks, 1):
        result = extract_chunk(chunk)
        score = chunk_quality_score(chunk, result)
        total_score += score
        need_llm = "YES" if score < args.quality_threshold else "no"
        print(f"Chunk {i}/{len(chunks)}  [{', '.join(t.value for t in chunk.section_types)}]")
        print(f"  Tokens: {chunk.token_count}")
        print(f"  Score: {score}/100  →  LLM needed: {need_llm}")
        print(f"  Entities: actors={len(result.actors)}, caps={len(result.capabilities)}, "
              f"ucs={len(result.use_cases)}, stories={len(result.user_stories)}, "
              f"nfr={len(result.non_functional_requirements)}")
        print()

    avg_score = total_score / len(chunks) if chunks else 0
    print(f"Average quality score: {avg_score:.1f}/100")
    print(f"Chunks needing LLM: {sum(1 for c in chunks if chunk_quality_score(c, extract_chunk(c)) < args.quality_threshold)}/{len(chunks)}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="PRD Extraction Engine — parse PRDs into structured data",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python -m prd_extractor.cli < prd.md              # Stream extraction
  python -m prd_extractor.cli prd.md --json         # Output JSON
  python -m prd_extractor.cli prd.md --dry-run      # Analyze chunking
  python -m prd_extractor.cli prd.md --force-llm    # LLM every chunk
        """,
    )
    parser.add_argument("input_file", nargs="?", help="PRD markdown file (default: stdin)")
    parser.add_argument("--json", action="store_true", help="Output final ExtractedPRD as JSON")
    parser.add_argument("--dry-run", action="store_true", help="Analyze chunking without LLM calls")
    parser.add_argument("--force-llm", action="store_true", help="Send every chunk to the LLM")
    parser.add_argument("--model", default="", help="PydanticAI model selector (e.g. anthropic:claude-sonnet-4-20250514)")
    parser.add_argument("--token-budget", type=int, default=6_000, help="Token budget per chunk (default: 6000)")
    parser.add_argument("--quality-threshold", type=int, default=70, help="Quality score threshold (default: 70)")
    parser.add_argument("--project-name", action="store_true", help="Just extract the project name")
    parser.add_argument("--problem-statement", action="store_true", help="Just extract the problem statement")

    args = parser.parse_args()

    # Read input
    if args.input_file:
        text = Path(args.input_file).read_text(encoding="utf-8")
    else:
        text = sys.stdin.read()

    if not text.strip():
        print("Error: empty input", file=sys.stderr)
        sys.exit(1)

    # Fast single-field extraction
    if args.project_name:
        name = extract_project_name(text)
        print(name or "(no project name found)")
        return

    if args.problem_statement:
        stmt = extract_problem_statement(text)
        print(stmt or "(no problem statement found)")
        return

    # Run async pipeline
    if args.dry_run:
        asyncio.run(_run_dry_run(args, text))
    else:
        asyncio.run(_run_streaming(args, text))


if __name__ == "__main__":
    main()
