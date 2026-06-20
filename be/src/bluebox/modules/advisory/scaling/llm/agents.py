"""pydantic-ai Agent for the Scale & Infrastructure Advisor."""

from bluebox.modules.advisory.scaling.llm.requests import HostingOptionsRequest
from bluebox.modules.advisory.scaling.llm.responses import HostingOptionsMatrix
from bluebox.shared_kernel.llm.connector import build_agent, run_structured

_HOSTING_OPTIONS_PROMPT = """\
You generate 3-6 hosting/infrastructure options for the given scale_persona
and scale_inputs. Every option's estimated_monthly_cost must state low/mid/
high USD with a concrete pricing basis (e.g. "on-demand pricing, US-East-1"),
the assumptions driving that estimate, and what it excludes (e.g. data
transfer, DDoS protection) - never present a bare number with no basis.
Mark over_budget=true whenever mid_usd exceeds the stated monthly_budget_usd
(unless no_budget_limit is true). Cost estimates are indicative only, never
a financial commitment - phrase rationale accordingly."""

hosting_options_agent = build_agent(HostingOptionsMatrix, _HOSTING_OPTIONS_PROMPT)


async def generate_hosting_options(request: HostingOptionsRequest) -> HostingOptionsMatrix:
    return await run_structured(hosting_options_agent, request.model_dump_json(indent=2))
