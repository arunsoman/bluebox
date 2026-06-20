"""Tests for code_generation/application/workspace_manager.py - real
writes under tmp_path (safe, no disk-budget impact)."""

import pytest

from bluebox.modules.code_generation.application.workspace_manager import (
    PathEscapeError,
    WorkspaceManager,
)
from bluebox.modules.code_generation.domain.workspace import FileProvenance
from bluebox.shared_kernel.infrastructure.in_memory import InMemoryWorkspaceRepository

_PROJECT = "proj-test"


def _provenance() -> FileProvenance:
    return FileProvenance(
        task_id="TASK-1", story_id="US-1", decision_entry_id="DEC-1", checkpoint_id="CKPT-1"
    )


def test_write_creates_real_file_and_returns_generated_file(tmp_path) -> None:
    repo = InMemoryWorkspaceRepository()
    manager = WorkspaceManager(repo, root=tmp_path)

    generated = manager.write(
        _PROJECT, "backend/src/main.py", "print('hello')\n",
        layer="Backend", task_id="TASK-1", language="python", provenance=_provenance(),
    )

    on_disk = tmp_path / _PROJECT / "backend/src/main.py"
    assert on_disk.read_text() == "print('hello')\n"
    assert generated.content_hash == __import__("hashlib").sha256(b"print('hello')\n").hexdigest()
    assert generated.size_bytes == len(b"print('hello')\n")
    assert repo.list_files(_PROJECT) == [generated]


def test_write_rejects_path_escape(tmp_path) -> None:
    repo = InMemoryWorkspaceRepository()
    manager = WorkspaceManager(repo, root=tmp_path)

    with pytest.raises(PathEscapeError):
        manager.write(
            _PROJECT, "../../etc/passwd", "evil",
            layer="Backend", task_id="TASK-1", language="text", provenance=_provenance(),
        )


def test_build_manifest_lists_written_files(tmp_path) -> None:
    repo = InMemoryWorkspaceRepository()
    manager = WorkspaceManager(repo, root=tmp_path)

    manager.write(
        _PROJECT, "main.py", "x = 1", layer="Backend", task_id="TASK-1",
        language="python", provenance=_provenance(),
    )
    manifest = manager.build_manifest(_PROJECT, run_command="python main.py", test_command="pytest")

    assert manifest.files == ["main.py"]
    assert manifest.run_command == "python main.py"
    assert repo.get_manifest(_PROJECT) is manifest
