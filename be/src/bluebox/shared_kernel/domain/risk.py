"""doc/api_event_contract.md SS4.2 `DraftNode.risk_classification` - the risk
scale used by the SteeringPanel and the trust-mode auto-approval policy
(doc/prd.md SS7.3). Lives in shared_kernel because both `Node`
(shared_kernel/domain/node.py) and `PipelineOrchestrator`
(modules/core_pipeline/domain/state_machine.py) need it, and shared_kernel
must not depend on any leaf module.
"""

from typing import Literal

RiskClassification = Literal["LOW_RISK", "MEDIUM", "HIGH", "CRITICAL"]
