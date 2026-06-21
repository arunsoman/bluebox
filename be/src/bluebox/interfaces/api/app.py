"""FastAPI app factory - doc/api_event_contract.md (REST surface).

Routers are added per contract area; see `interfaces/api/routers/`. The
`LLMCallFailed` handler maps `LLMFailure.failure_type` to the status codes
in doc/api_event_contract.md SS11 (`LLM-E01..E04`) rather than letting it
fall through to a bare 500.
"""

import re
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.concurrency import iterate_in_threadpool

from bluebox.shared_kernel.llm import context as llm_context
from bluebox.shared_kernel.observability import context as obs_context
from bluebox.shared_kernel.observability.log_bus import log_bus
from bluebox.shared_kernel.observability.log_event import GLOBAL_PROJECT_ID, LogEvent
from bluebox.shared_kernel.observability.redaction import redact_headers, truncate_body

from bluebox.modules.advisory.rbac.application.rbac_service import RBACInheritanceCycleError
from bluebox.modules.advisory.scaling.application.scaling_service import HostingOptionNotFoundError
from bluebox.modules.advisory.tech_stack.application.tech_stack_service import (
    TechStackOptionNotFoundError,
)
from bluebox.modules.code_generation.application.generation_service import (
    GenerationNotFoundError,
    NoTechStackProfileError,
    TaskAlreadyRunningError,
)
from bluebox.modules.code_generation.application.runtime_sandbox import SandboxNotRunningError
from bluebox.modules.code_generation.application.workspace_manager import PathEscapeError
from bluebox.modules.core_pipeline.application.checkpoint_service import CheckpointNotFoundError
from bluebox.modules.core_pipeline.domain.exceptions import (
    InvalidStateTransitionError,
    PipelinePausedError,
)
from bluebox.modules.governance.application.node_service import NodeNotFoundError
from bluebox.shared_kernel.llm.connector import LLMCallFailed

_PROJECT_ID_FROM_PATH = re.compile(r"/api/v1/projects/(?P<project_id>[^/]+)")

_LLM_FAILURE_STATUS = {
    "timeout": 504,
    "malformed_json": 500,
    "context_overflow": 413,
    "rate_limit": 429,
    "empty_response": 500,
}


def create_app() -> FastAPI:
    app = FastAPI(title="Bluebox Collaborative Steering Pipeline API", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def set_ai_context(request: Request, call_next):
        """Extract AI provider/model from headers and set context for the request."""
        # Get provider/model from headers (set by frontend httpClient)
        # Format: X-AI-Provider: anthropic, X-AI-Model: claude-sonnet-4-6
        provider = request.headers.get("X-AI-Provider")
        model = request.headers.get("X-AI-Model")
        
        # Only set context if headers are present (None means fall back to env var)
        if provider or model:
            # Set context for duration of this request
            token_p = llm_context.active_provider.set(provider)
            token_m = llm_context.active_model.set(model)
            
            try:
                response = await call_next(request)
                return response
            finally:
                # Reset context
                llm_context.active_provider.reset(token_p)
                llm_context.active_model.reset(token_m)
        else:
            # No headers - just pass through
            return await call_next(request)

    @app.middleware("http")
    async def log_http_requests(request: Request, call_next):
        """Captures every REST call for the log viewer (Ctrl+Shift+L) - see
        shared_kernel/observability/log_bus.py. Sets `current_project_id`/
        `current_trace_id` for the duration of the request so a nested LLM
        call (several layers down, in connector.py's `run_structured`) is
        automatically tagged with the same ids, with no parameter threading.
        """

        trace_id = request.headers.get("X-Debug-Trace-Id") or str(uuid.uuid4())
        match = _PROJECT_ID_FROM_PATH.search(request.url.path)
        project_id = match.group("project_id") if match else GLOBAL_PROJECT_ID

        token_project = obs_context.current_project_id.set(project_id)
        token_trace = obs_context.current_trace_id.set(trace_id)
        start = time.perf_counter()
        try:
            request_body = await request.body()
            response = await call_next(request)

            response_chunks = [chunk async for chunk in response.body_iterator]
            response.body_iterator = iterate_in_threadpool(iter(response_chunks))
            response_body = b"".join(response_chunks)

            duration_ms = (time.perf_counter() - start) * 1000
            await log_bus.publish(LogEvent(
                project_id=project_id,
                trace_id=trace_id,
                duration_ms=duration_ms,
                category="http_received_by_backend",
                summary=f"{request.method} {request.url.path} -> {response.status_code} ({duration_ms:.0f}ms)",
                detail={
                    "method": request.method,
                    "path": request.url.path,
                    "query": str(request.url.query),
                    "request_headers": redact_headers(dict(request.headers)),
                    "request_body": truncate_body(request_body),
                    "response_status": response.status_code,
                    "response_headers": redact_headers(dict(response.headers)),
                    "response_body": truncate_body(response_body),
                },
            ))
            return response
        finally:
            obs_context.current_project_id.reset(token_project)
            obs_context.current_trace_id.reset(token_trace)

    @app.exception_handler(LLMCallFailed)
    async def llm_call_failed_handler(_: Request, exc: LLMCallFailed) -> JSONResponse:
        status_code = _LLM_FAILURE_STATUS.get(exc.failure.failure_type, 500)
        return JSONResponse(status_code=status_code, content={"error": exc.failure.model_dump(mode="json")})

    @app.exception_handler(NodeNotFoundError)
    @app.exception_handler(CheckpointNotFoundError)
    @app.exception_handler(GenerationNotFoundError)
    async def not_found_handler(_: Request, exc: Exception) -> JSONResponse:
        return JSONResponse(status_code=404, content={"error": str(exc)})

    @app.exception_handler(HostingOptionNotFoundError)
    @app.exception_handler(TechStackOptionNotFoundError)
    @app.exception_handler(PathEscapeError)
    @app.exception_handler(NoTechStackProfileError)
    async def bad_request_handler(_: Request, exc: Exception) -> JSONResponse:
        return JSONResponse(status_code=400, content={"error": str(exc)})

    @app.exception_handler(RBACInheritanceCycleError)
    async def rbac_cycle_handler(_: Request, exc: RBACInheritanceCycleError) -> JSONResponse:
        return JSONResponse(
            status_code=400, content={"error": "VAL-E02: RBAC inheritance cycle", "cycles": exc.cycles}
        )

    @app.exception_handler(InvalidStateTransitionError)
    @app.exception_handler(PipelinePausedError)
    @app.exception_handler(TaskAlreadyRunningError)
    async def pipeline_state_handler(_: Request, exc: Exception) -> JSONResponse:
        return JSONResponse(status_code=409, content={"error": str(exc)})

    @app.exception_handler(SandboxNotRunningError)
    async def sandbox_not_running_handler(_: Request, exc: SandboxNotRunningError) -> JSONResponse:
        return JSONResponse(status_code=409, content={"error": str(exc)})

    from bluebox.interfaces.api.routers import (
        audit as audit_router,
        auth as auth_router,
        chat as chat_router,
        checkpoints as checkpoints_router,
        codegen as codegen_router,
        graph as graph_router,
        ledger as ledger_router,
        llm_config as llm_config_router,
        logs as logs_router,
        nodes as nodes_router,
        onboarding as onboarding_router,
        projects as projects_router,
        rbac as rbac_router,
        runtime as runtime_router,
        scaling as scaling_router,
        steering as steering_router,
        tech_stack as tech_stack_router,
    )

    app.include_router(auth_router.router)
    app.include_router(projects_router.router)
    app.include_router(onboarding_router.router)
    app.include_router(steering_router.router)
    app.include_router(nodes_router.router)
    app.include_router(scaling_router.router)
    app.include_router(tech_stack_router.router)
    app.include_router(rbac_router.router)
    app.include_router(chat_router.router)
    app.include_router(codegen_router.router)
    app.include_router(graph_router.router)
    app.include_router(runtime_router.router)
    app.include_router(checkpoints_router.router)
    app.include_router(ledger_router.router)
    app.include_router(audit_router.router)
    app.include_router(llm_config_router.router)
    app.include_router(logs_router.router)

    from bluebox.interfaces.ws.connection_registry import connection_registry
    from bluebox.interfaces.ws.steering_session import router as steering_ws_router

    app.include_router(steering_ws_router)

    # The log viewer's `log_bus` lives in shared_kernel and must not import
    # from interfaces/ (see connection_registry.py's module docstring) - so
    # this wiring happens here instead, once at app construction.
    log_bus.set_broadcaster(connection_registry.push_log_event)

    return app
