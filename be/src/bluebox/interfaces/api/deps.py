"""FastAPI dependency providers - wires the shared `AppState` singleton
(`shared_kernel/infrastructure/in_memory.py`) into a fresh application
service per request. Services are thin/stateless, so constructing one per
request is cheap; all actual state lives in `app_state`.
"""

from functools import lru_cache

from bluebox.interfaces.ws.connection_registry import connection_registry
from bluebox.modules.advisory.rbac.application.rbac_service import RBACService
from bluebox.modules.advisory.scaling.application.scaling_service import ScalingService
from bluebox.modules.advisory.tech_stack.application.tech_stack_service import TechStackService
from bluebox.modules.chat.application.chat_service import ChatService
from bluebox.modules.code_generation.application.codegen_service import CodeGenService
from bluebox.modules.code_generation.application.generation_service import ProjectCodeGenService
from bluebox.modules.code_generation.application.runtime_sandbox import RuntimeSandbox
from bluebox.modules.code_generation.application.workspace_manager import WorkspaceManager
from bluebox.modules.core_pipeline.application.checkpoint_service import CheckpointService
from bluebox.modules.core_pipeline.application.onboarding_service import OnboardingService
from bluebox.modules.core_pipeline.application.project_service import ProjectService
from bluebox.modules.core_pipeline.application.stage_service import StageService
from bluebox.modules.core_pipeline.application.steering_service import SteeringService
from bluebox.modules.governance.application.node_service import NodeService
from bluebox.modules.graph.application.what_if_service import WhatIfService
from bluebox.shared_kernel.infrastructure.in_memory import AppState, app_state


def get_app_state() -> AppState:
    return app_state


def get_project_service() -> ProjectService:
    return ProjectService(app_state.projects, app_state.sessions)


def get_onboarding_service() -> OnboardingService:
    return OnboardingService(app_state.sessions, app_state.prd_submissions, app_state.nodes)


def get_stage_service() -> StageService:
    return StageService(app_state.nodes, app_state.sessions)


def get_steering_service() -> SteeringService:
    return SteeringService(app_state.nodes, app_state.sessions, app_state.decisions)


def get_node_service() -> NodeService:
    return NodeService(app_state.nodes)


def get_what_if_service() -> WhatIfService:
    return WhatIfService(app_state.nodes, app_state.pending_what_if_simulations)


def get_scaling_service() -> ScalingService:
    return ScalingService(app_state.infrastructure_profiles)


def get_tech_stack_service() -> TechStackService:
    return TechStackService(app_state.tech_stack_profiles)


def get_rbac_service() -> RBACService:
    return RBACService(app_state.rbac_models)


def get_chat_service() -> ChatService:
    return ChatService(app_state.chat, app_state.decisions, app_state.audit, get_node_service())


def get_checkpoint_service() -> CheckpointService:
    return CheckpointService(app_state.checkpoints, app_state.decisions, app_state.sessions)


@lru_cache
def _workspace_manager() -> WorkspaceManager:
    return WorkspaceManager(app_state.workspace)


def get_workspace_manager() -> WorkspaceManager:
    return _workspace_manager()


def get_codegen_service() -> CodeGenService:
    return CodeGenService(get_workspace_manager())


@lru_cache
def _project_codegen_service() -> ProjectCodeGenService:
    return ProjectCodeGenService(
        get_codegen_service(), app_state.nodes, app_state.tech_stack_profiles, app_state.workspace,
        connection_registry.broadcast,
    )


def get_project_codegen_service() -> ProjectCodeGenService:
    """`@lru_cache`'d (unlike every other `get_*_service` above) because,
    unlike those stateless per-request wrappers, this one owns live
    in-progress generation jobs (`ProjectCodeGenService._jobs`) that must
    survive across requests - status/cancel need the same instance `start`
    populated."""

    return _project_codegen_service()


@lru_cache
def _runtime_sandbox() -> RuntimeSandbox:
    return RuntimeSandbox(get_workspace_manager())


def get_runtime_sandbox() -> RuntimeSandbox:
    return _runtime_sandbox()
