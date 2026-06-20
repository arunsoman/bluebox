"""pydantic-ai Agents for the Tech Stack Advisor."""

from bluebox.modules.advisory.tech_stack.llm.requests import (
    TechStackOptionsRequest,
    TechStackSignalDetectionRequest,
)
from bluebox.modules.advisory.tech_stack.llm.responses import (
    TechStackOptionsMatrix,
    TechStackSignalDetectionResult,
)
from bluebox.shared_kernel.llm.connector import build_agent, run_structured

_TECH_STACK_SIGNAL_DETECTION_PROMPT = """\
You detect tech stack signals in raw project input. explicit_mentions are
named technologies the user stated outright (e.g. "React", "Postgres").
implicit_signals are requirements that imply a technology without naming it
(e.g. "real-time updates" implies WebSockets; "millions of rows" implies a
scalable relational or columnar store) - state the implication, not just the
trigger phrase. confidence reflects how strong and unambiguous the signals
are overall, not the count of signals found."""

tech_stack_signal_detection_agent = build_agent(
    TechStackSignalDetectionResult, _TECH_STACK_SIGNAL_DETECTION_PROMPT
)


async def detect_tech_stack_signals(
    request: TechStackSignalDetectionRequest,
) -> TechStackSignalDetectionResult:
    return await run_structured(
        tech_stack_signal_detection_agent, request.model_dump_json(indent=2)
    )


_TECH_STACK_OPTIONS_PROMPT = """\
You generate 3-5 tech stack options given the confirmed actors,
scale_persona, and any detected signals. Each option lists its full stack
(framework, version, language, justification per component) plus pros/cons
and a rationale that explicitly weighs actor compatibility, fit for the
stated scale_persona, and learning curve - these three factors must be
visible in the rationale/pros/cons even though they are not separate
schema fields. Do not default to the same stack regardless of input;
options should meaningfully differ in tradeoffs."""

tech_stack_options_agent = build_agent(TechStackOptionsMatrix, _TECH_STACK_OPTIONS_PROMPT)


async def generate_tech_stack_options(request: TechStackOptionsRequest) -> TechStackOptionsMatrix:
    return await run_structured(tech_stack_options_agent, request.model_dump_json(indent=2))
