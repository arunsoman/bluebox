"""Stage 9 RuntimeSandbox - doc/prd.md TDR-007 (containers over host exec).

Runs a project's generated workspace inside a Docker container rather than
as a raw host subprocess - meaningfully safer than executing LLM-generated
code directly on the host. Every `docker` invocation goes through the
injected `runner` callable (default: a thin wrapper over `subprocess.run`)
so tests can verify the exact command constructed without ever invoking
Docker for real - deliberate, given this machine's tight disk budget (see
the plan: no real `docker pull`/`npm install` during the automated suite).
"""

import subprocess
import time
import uuid
from collections.abc import Callable
from dataclasses import dataclass, field

from bluebox.modules.code_generation.application.workspace_manager import WorkspaceManager
from bluebox.modules.code_generation.domain.runtime import (
    PortMapping,
    ResourceUsage,
    RuntimeCommand,
    RuntimeCommandResult,
    RuntimeStartResult,
    RuntimeStatus,
    StartupStep,
)
from bluebox.modules.code_generation.domain.workspace import WorkspaceManifest

SubprocessRunner = Callable[[list[str]], subprocess.CompletedProcess]

_PYTHON_IMAGE = "python:3.12-slim"
_NODE_IMAGE = "node:20-alpine"


def _default_runner(args: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(args, capture_output=True, text=True, check=False)  # noqa: S603


@dataclass
class _SandboxHandle:
    sandbox_id: str
    container_id: str
    started_at: float = field(default_factory=time.monotonic)


class RuntimeSandboxError(Exception):
    pass


class SandboxNotRunningError(RuntimeSandboxError):
    def __init__(self, project_id: str) -> None:
        super().__init__(f"no running sandbox for project {project_id!r}")


def build_run_command(workspace_dir: str, manifest: WorkspaceManifest) -> list[str]:
    """Constructs the `docker run` invocation for `manifest.run_command`.
    Picks the base image + install step from whether the run command is a
    Python or Node entrypoint (the same heuristic `codegen_service.infer_commands`
    used to derive `run_command` in the first place)."""

    is_python = manifest.run_command.strip().startswith("python")
    image = _PYTHON_IMAGE if is_python else _NODE_IMAGE
    install_step = "pip install -r requirements.txt" if is_python else "npm install"

    return [
        "docker", "run", "--rm", "-d",
        "--memory=512m", "--cpus=1",
        "-v", f"{workspace_dir}:/app:rw",
        "-w", "/app",
        "-P",
        image,
        "sh", "-c", f"{install_step} && {manifest.run_command}",
    ]


class RuntimeSandbox:
    def __init__(self, workspace: WorkspaceManager, *, runner: SubprocessRunner | None = None) -> None:
        self._workspace = workspace
        self._runner = runner or _default_runner
        self._handles: dict[str, _SandboxHandle] = {}

    def start(self, project_id: str, manifest: WorkspaceManifest) -> RuntimeStartResult:
        workspace_dir = str(self._workspace.workspace_dir(project_id))
        args = build_run_command(workspace_dir, manifest)
        result = self._runner(args)

        if result.returncode != 0:
            return RuntimeStartResult(
                sandbox_id="",
                preview_url="",
                status="error",
                startup_steps=[
                    StartupStep(step_number=1, step_name="docker run", status="failed", logs=result.stderr)
                ],
            )

        container_id = result.stdout.strip()
        sandbox_id = f"SBX-{uuid.uuid4().hex[:8].upper()}"
        self._handles[project_id] = _SandboxHandle(sandbox_id=sandbox_id, container_id=container_id)

        port_mappings = self._port_mappings(container_id)
        preview_port = port_mappings[0].external_port if port_mappings else 0
        return RuntimeStartResult(
            sandbox_id=sandbox_id,
            preview_url=f"http://localhost:{preview_port}" if preview_port else "",
            status="running",
            startup_steps=[
                StartupStep(step_number=1, step_name="docker run", status="complete"),
            ],
        )

    def stop(self, project_id: str) -> None:
        handle = self._handles.get(project_id)
        if handle is None:
            raise SandboxNotRunningError(project_id)
        self._runner(["docker", "rm", "-f", handle.container_id])
        del self._handles[project_id]

    def status(self, project_id: str) -> RuntimeStatus:
        handle = self._handles.get(project_id)
        if handle is None:
            return RuntimeStatus(status="stopped")

        port_mappings = self._port_mappings(handle.container_id)
        return RuntimeStatus(
            sandbox_id=handle.sandbox_id,
            status="running",
            preview_url=f"http://localhost:{port_mappings[0].external_port}" if port_mappings else None,
            port_mappings=port_mappings,
            uptime_seconds=time.monotonic() - handle.started_at,
            resource_usage=ResourceUsage(),
        )

    def execute_command(self, project_id: str, command: RuntimeCommand) -> RuntimeCommandResult:
        handle = self._handles.get(project_id)
        if handle is None:
            raise SandboxNotRunningError(project_id)

        docker_exec = ["docker", "exec"]
        if command.working_directory:
            docker_exec += ["-w", command.working_directory]
        docker_exec += [handle.container_id, command.command, *command.args]

        start = time.monotonic()
        result = self._runner(docker_exec)
        elapsed_ms = (time.monotonic() - start) * 1000
        return RuntimeCommandResult(
            exit_code=result.returncode, stdout=result.stdout, stderr=result.stderr,
            execution_time_ms=elapsed_ms,
        )

    def _port_mappings(self, container_id: str) -> list[PortMapping]:
        result = self._runner(["docker", "port", container_id])
        if result.returncode != 0 or not result.stdout.strip():
            return []

        mappings = []
        for line in result.stdout.strip().splitlines():
            # e.g. "3000/tcp -> 0.0.0.0:32768"
            try:
                internal, _, host_side = line.partition(" -> ")
                internal_port_str, protocol = internal.split("/")
                external_port_str = host_side.rsplit(":", 1)[1]
                mappings.append(
                    PortMapping(
                        internal_port=int(internal_port_str),
                        external_port=int(external_port_str),
                        protocol="tcp" if protocol == "tcp" else "http",
                    )
                )
            except (ValueError, IndexError):
                continue
        return mappings
