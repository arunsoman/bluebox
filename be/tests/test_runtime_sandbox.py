"""Tests for code_generation/application/runtime_sandbox.py.

Deliberately never invokes Docker for real - every `docker` call goes
through a stub `runner`, so these tests assert on the constructed command
args/parsing logic only (the 5.2GB free-disk constraint rules out a real
`docker pull`/`npm install` in the automated suite).
"""

import subprocess

import pytest

from bluebox.modules.code_generation.application.runtime_sandbox import (
    RuntimeSandbox,
    SandboxNotRunningError,
    build_run_command,
)
from bluebox.modules.code_generation.application.workspace_manager import WorkspaceManager
from bluebox.modules.code_generation.domain.runtime import RuntimeCommand
from bluebox.modules.code_generation.domain.workspace import WorkspaceManifest
from bluebox.shared_kernel.infrastructure.in_memory import InMemoryWorkspaceRepository

_PROJECT = "proj-test"


def _completed(stdout: str = "", stderr: str = "", returncode: int = 0) -> subprocess.CompletedProcess:
    return subprocess.CompletedProcess(args=[], returncode=returncode, stdout=stdout, stderr=stderr)


def _node_manifest() -> WorkspaceManifest:
    return WorkspaceManifest(project_id=_PROJECT, files=["index.js"], run_command="npm run dev")


def _python_manifest() -> WorkspaceManifest:
    return WorkspaceManifest(project_id=_PROJECT, files=["main.py"], run_command="python main.py")


def test_build_run_command_picks_node_image_and_install_step() -> None:
    args = build_run_command("/workspaces/proj-test", _node_manifest())
    assert args[:5] == ["docker", "run", "--rm", "-d", "--memory=512m"]
    assert "-v" in args and "/workspaces/proj-test:/app:rw" in args
    assert "node:20-alpine" in args
    assert "npm install && npm run dev" in args[-1]


def test_build_run_command_picks_python_image_and_install_step() -> None:
    args = build_run_command("/workspaces/proj-test", _python_manifest())
    assert "python:3.12-slim" in args
    assert "pip install -r requirements.txt && python main.py" in args[-1]


class _StubRunner:
    def __init__(self, responses: dict[str, subprocess.CompletedProcess]) -> None:
        self._responses = responses
        self.calls: list[list[str]] = []

    def __call__(self, args: list[str]) -> subprocess.CompletedProcess:
        self.calls.append(args)
        return self._responses.get(args[1], _completed())


@pytest.fixture
def workspace(tmp_path):
    return WorkspaceManager(InMemoryWorkspaceRepository(), root=tmp_path)


def test_start_returns_running_with_preview_url(workspace) -> None:
    runner = _StubRunner({
        "run": _completed(stdout="abc123container\n"),
        "port": _completed(stdout="3000/tcp -> 0.0.0.0:32768\n"),
    })
    sandbox = RuntimeSandbox(workspace, runner=runner)

    result = sandbox.start(_PROJECT, _node_manifest())

    assert result.status == "running"
    assert result.preview_url == "http://localhost:32768"
    assert result.sandbox_id.startswith("SBX-")
    assert runner.calls[0][:2] == ["docker", "run"]


def test_start_returns_error_on_nonzero_exit(workspace) -> None:
    runner = _StubRunner({"run": _completed(stderr="no such image", returncode=1)})
    sandbox = RuntimeSandbox(workspace, runner=runner)

    result = sandbox.start(_PROJECT, _node_manifest())

    assert result.status == "error"
    assert result.startup_steps[0].status == "failed"
    assert result.startup_steps[0].logs == "no such image"


def test_status_is_stopped_when_never_started(workspace) -> None:
    sandbox = RuntimeSandbox(workspace, runner=_StubRunner({}))
    assert sandbox.status(_PROJECT).status == "stopped"


def test_stop_removes_container_and_raises_if_not_running(workspace) -> None:
    runner = _StubRunner({"run": _completed(stdout="abc123\n"), "port": _completed(stdout="")})
    sandbox = RuntimeSandbox(workspace, runner=runner)
    sandbox.start(_PROJECT, _node_manifest())

    sandbox.stop(_PROJECT)
    assert ["docker", "rm", "-f", "abc123"] in runner.calls
    assert sandbox.status(_PROJECT).status == "stopped"

    with pytest.raises(SandboxNotRunningError):
        sandbox.stop(_PROJECT)


def test_execute_command_requires_running_sandbox(workspace) -> None:
    sandbox = RuntimeSandbox(workspace, runner=_StubRunner({}))
    with pytest.raises(SandboxNotRunningError):
        sandbox.execute_command(_PROJECT, RuntimeCommand(command="ls", args=[]))


def test_execute_command_runs_docker_exec(workspace) -> None:
    runner = _StubRunner({
        "run": _completed(stdout="abc123\n"),
        "port": _completed(stdout=""),
        "exec": _completed(stdout="hello\n", returncode=0),
    })
    sandbox = RuntimeSandbox(workspace, runner=runner)
    sandbox.start(_PROJECT, _node_manifest())

    result = sandbox.execute_command(_PROJECT, RuntimeCommand(command="echo", args=["hello"]))
    assert result.exit_code == 0
    assert result.stdout == "hello\n"
    assert runner.calls[-1] == ["docker", "exec", "abc123", "echo", "hello"]
