"""pydantic-ai Agent for the RBAC Advisor.

Cycle detection and privilege-escalation analysis are pure graph algorithms
(doc/prd.md SS4.3 InheritanceValidator, PrivilegeEscalationAnalyzer) - not
LLM call sites, so there is no agent for them here.
"""

from bluebox.modules.advisory.rbac.llm.requests import RBACModelGenerationRequest
from bluebox.modules.advisory.rbac.llm.responses import RBACModel
from bluebox.shared_kernel.llm.connector import build_agent, run_structured

_RBAC_MODEL_GENERATION_PROMPT = """\
You design an RBAC model (roles, permissions, role-permission grants, role
inheritance, data access matrix) from confirmed actors, capabilities, and
use cases. Every role-permission entry with granted=true MUST have a
non-empty rationale and decision_maker (doc/prd.md AC-RB-02) - this is
enforced by validation, but you must still produce real values, not
placeholder text. Keep inheritance depth to 3 levels by default and never
construct a cycle (A inherits from B inherits from ... inherits from A).
Prefer the least-privilege grant for each role unless the use cases clearly
require broader access."""

rbac_model_generation_agent = build_agent(RBACModel, _RBAC_MODEL_GENERATION_PROMPT)


async def generate_rbac_model(request: RBACModelGenerationRequest) -> RBACModel:
    return await run_structured(rbac_model_generation_agent, request.model_dump_json(indent=2))
