"""Builds the `SteeringPanel` shape (doc/api_event_contract.md SS4.2) from
a stage's generation result. Shared between the REST router
(`interfaces/api/routers/steering.py`) and the WS steering session
(`interfaces/ws/steering_session.py`) - both need the identical rendering of
draft nodes + auto_approved/paused/critical counts.
"""

from typing import Any

from bluebox.modules.core_pipeline.application.steering_service import preview_nodes
from bluebox.modules.core_pipeline.domain.state_machine import PipelineOrchestrator

STAGE_NAMES = {
    1: "Ideation", 2: "Actor Discovery", 3: "Capability Definition",
    4: "Use Case Decomposition", 5: "User Story Decomposition", 6: "Task Decomposition",
}


def build_steering_panel(orchestrator: PipelineOrchestrator, stage_id: int, candidates: Any) -> dict:
    nodes = preview_nodes(stage_id, candidates)

    draft_output = []
    auto_approved_count = paused_count = critical_count = 0
    for node in nodes:
        auto_approved = orchestrator.should_auto_approve(node.risk_classification)
        if node.risk_classification == "CRITICAL":
            status = "requires_authorization"
            critical_count += 1
        elif auto_approved:
            status = "auto_approved"
            auto_approved_count += 1
        else:
            status = "paused"
            paused_count += 1

        draft_output.append({
            "node_id": node.node_id, "node_type": node.node_type, "name": node.name,
            "description": node.description, "layer": node.layer,
            "risk_classification": node.risk_classification, "status": status,
            "downstream_count": 0, "bookmarked": False, "selected": False,
            "consent_required": node.risk_classification == "CRITICAL",
        })

    return {
        "stage_id": stage_id,
        "stage_name": STAGE_NAMES.get(stage_id, f"Stage {stage_id}"),
        "stage_description": "",
        "draft_output": draft_output,
        "options": [
            {"option_id": "accept", "option_type": "accept", "label": "Accept all",
             "description": "Commit every drafted node", "requires_authorization": critical_count > 0},
        ],
        "context_window": "",
        "render_policy": {"default_mode": "summary", "summary_page_size": 20},
        "trust_mode": orchestrator.trust_mode,
        "auto_approved_count": auto_approved_count,
        "paused_count": paused_count,
        "critical_count": critical_count,
        "total_nodes": len(nodes),
    }
