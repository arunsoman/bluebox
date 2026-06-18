"""PydanticAI Agent integration for LLM-powered extraction.

Defines a ``create_extraction_agent`` factory that wires a PydanticAI
``Agent`` with:

* A system prompt that injects known entity names from the registry.
* ``output_type=ChunkResult`` for structured JSON output.
* An ``output_validator`` that raises ``ModelRetry`` when the model
  emits dangling actor/capability IDs that don't exist in the registry.
* ``UsageLimits`` to cap tokens per chunk (defence-in-depth against
  runaway prompts on oversized sections).

When ``pydantic_ai`` is not installed, the LLM path gracefully degrades
and the orchestrator falls back to regex-only extraction.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from .models import ChunkResult, SectionType
from .registry import ExtractionRegistry

# Optional pydantic-ai — when absent, LLM calls will raise at runtime
# and the orchestrator catches and falls back to regex.
try:
    from pydantic_ai import Agent
    from pydantic_ai.models import ModelRetry
    from pydantic_ai.result import Usage
    from pydantic_ai.settings import UsageLimits

    _HAS_PYDANTIC_AI = True
except Exception:  # pragma: no cover
    _HAS_PYDANTIC_AI = False
    Agent = None  # type: ignore[misc,assignment]
    ModelRetry = Exception  # type: ignore[misc,assignment]
    Usage = None  # type: ignore[misc,assignment]
    UsageLimits = None  # type: ignore[misc,assignment]

if TYPE_CHECKING:
    from pydantic_ai import Agent as _Agent
    from pydantic_ai.result import Usage as _Usage
    from pydantic_ai.settings import UsageLimits as _UsageLimits


# Default usage guardrails per chunk.
try:
    DEFAULT_USAGE_LIMITS = UsageLimits(
        request_tokens_limit=8_000,
        response_tokens_limit=4_000,
        total_tokens_limit=12_000,
    )
except Exception:
    DEFAULT_USAGE_LIMITS = None  # type: ignore[assignment]


@dataclass
class ExtractionDeps:
    """Dependencies passed to the extraction agent per chunk.

    The agent's system prompt is rebuilt per-call with the current
    registry state so the model knows which actors/capabilities already
    exist and should be referenced by ID rather than recreated.
    """

    registry: ExtractionRegistry
    chunk_types: list[SectionType]


def create_extraction_agent(
    model: str = "anthropic:claude-sonnet-4-20250514",
    usage_limits=None,
):
    """Create and return a PydanticAI ``Agent`` for PRD chunk extraction.

    Parameters:
        model: Model selector string (e.g. ``"anthropic:claude-sonnet-4-20250514"``
            or ``"openai:gpt-4o"``).
        usage_limits: Per-call token guardrails.  Defaults to
            ``DEFAULT_USAGE_LIMITS``.

    Raises:
        RuntimeError: If ``pydantic_ai`` is not installed.
    """
    if not _HAS_PYDANTIC_AI:
        raise RuntimeError(
            "pydantic-ai is not installed. Install it with: pip install pydantic-ai"
        )

    agent = Agent(  # type: ignore[call-arg]
        model=model,
        output_type=ChunkResult,
        deps_type=ExtractionDeps,
        system_prompt=_build_system_prompt,
        output_validators=[_validate_no_dangling_refs],
    )

    return agent


# ---------------------------------------------------------------------------
# System prompt builder
# ---------------------------------------------------------------------------


def _build_system_prompt(ctx) -> str:
    """Dynamic system prompt — injected with known entities from registry."""
    deps: ExtractionDeps = ctx.deps
    reg = deps.registry

    lines: list[str] = [
        "You are a PRD (Product Requirements Document) extraction engine.",
        "Parse the provided PRD chunk and emit a structured JSON object matching the schema.",
        "",
        "Rules:",
        "1. Extract ONLY what is explicitly stated or strongly implied in the text.",
        "2. Use existing actor/capability IDs when referring to known entities — do NOT create new IDs for entities that already exist.",
        "3. For new entities, derive IDs using the pattern: actor-<slug>, cap-<slug>, uc-<slug>, us-<slug>.",
        "4. Be concise: descriptions should be 1-2 sentences.",
        "5. If a section type is not present in the chunk, emit an empty list for that field.",
        "",
    ]

    if reg.known_actor_ids:
        lines.append("Known actors (reference by id):")
        for aid, name in zip(reg.known_actor_ids, reg.known_actor_names):
            lines.append(f"  - {aid}: {name}")
        lines.append("")

    if reg.known_capability_ids:
        lines.append("Known capabilities (reference by id):")
        for cid, name in zip(reg.known_capability_ids, reg.known_capability_names):
            lines.append(f"  - {cid}: {name}")
        lines.append("")

    if reg.known_use_case_ids:
        lines.append("Known use cases (reference by id):")
        for uid, name in zip(reg.known_use_case_ids, reg.known_use_case_names):
            lines.append(f"  - {uid}: {name}")
        lines.append("")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Output validator
# ---------------------------------------------------------------------------


def _validate_no_dangling_refs(
    ctx,
    result: ChunkResult,
) -> ChunkResult:
    """Raise ``ModelRetry`` if the model emitted unknown entity IDs.

    This catches hallucinated references within the *same* chunk before
    they reach the registry, keeping the merge logic clean.
    """
    deps: ExtractionDeps = ctx.deps
    reg = deps.registry

    known_actors = set(reg.known_actor_ids)
    known_caps = set(reg.known_capability_ids)
    errors: list[str] = []

    for cap in result.capabilities:
        bad = [aid for aid in cap.actor_ids if aid not in known_actors]
        if bad:
            errors.append(
                f"Capability '{cap.name}' references unknown actor IDs: {bad}. "
                f"Known actors: {reg.known_actor_ids or 'none yet'}. "
                f"If this is a new actor, emit it in the 'actors' field first, "
                f"then reference its new ID in the capability."
            )

    for uc in result.use_cases:
        bad_a = [aid for aid in uc.actor_ids if aid not in known_actors]
        bad_c = [cid for cid in uc.capability_ids if cid not in known_caps]
        if bad_a:
            errors.append(
                f"UseCase '{uc.name}' references unknown actor IDs: {bad_a}. "
                f"Known actors: {reg.known_actor_ids or 'none yet'}."
            )
        if bad_c:
            errors.append(
                f"UseCase '{uc.name}' references unknown capability IDs: {bad_c}. "
                f"Known capabilities: {reg.known_capability_ids or 'none yet'}."
            )

    for us in result.user_stories:
        if us.actor_id and us.actor_id not in known_actors:
            errors.append(
                f"UserStory '{us.title}' references unknown actor ID: {us.actor_id}. "
                f"Known actors: {reg.known_actor_ids or 'none yet'}."
            )

    if errors:
        raise ModelRetry(
            "Dangling entity references detected:\n" + "\n".join(f"- {e}" for e in errors)
        )

    return result


# ---------------------------------------------------------------------------
# Async runner with usage tracking
# ---------------------------------------------------------------------------


async def run_agent_on_chunk(
    agent,
    chunk_text: str,
    deps: ExtractionDeps,
    usage_limits=None,
):
    """Run *agent* on *chunk_text*, returning (result, usage).

    Raises:
        Exception: Propagates any PydanticAI error (rate-limit, context
            length, validation exhaustion, etc.) for the orchestrator
            to catch and fall back to regex.
    """
    result = await agent.run(
        chunk_text,
        deps=deps,
        usage_limits=usage_limits or DEFAULT_USAGE_LIMITS,
    )
    return result.output, result.usage()
