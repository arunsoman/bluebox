"""Tests for code_generation/application/project_context.py."""

from bluebox.modules.code_generation.application.project_context import (
    _python_outline,
    _tsjs_outline,
    build_existing_files_context,
)
from bluebox.modules.code_generation.domain.workspace import FileProvenance, GeneratedFile

_PROVENANCE = FileProvenance(
    task_id="TASK-1", story_id="US-1", decision_entry_id="DEC-1", checkpoint_id="CKPT-1"
)


def _file(path: str, content: str, language: str) -> GeneratedFile:
    return GeneratedFile(
        file_path=path,
        content=content,
        content_hash="hash",
        size_bytes=len(content),
        layer="Backend",
        task_id="TASK-1",
        provenance=_PROVENANCE,
        language=language,
    )


def test_python_outline_extracts_classes_and_functions() -> None:
    content = "class User:\n    pass\n\n\ndef get_user(id):\n    pass\n"
    outline = _python_outline(content)
    assert "class User" in outline
    assert "def get_user(id)" in outline


def test_tsjs_outline_extracts_classes_functions_and_interfaces() -> None:
    content = (
        "export interface Booking {}\n"
        "export class BookingService {}\n"
        "export function createBooking() {}\n"
        "export const cancelBooking = (id) => {}\n"
    )
    outline = _tsjs_outline(content)
    assert "interface Booking" in outline
    assert "class BookingService" in outline
    assert "function createBooking" in outline
    assert "function cancelBooking" in outline


def test_build_existing_files_context_empty_when_no_files() -> None:
    assert build_existing_files_context([], "backend/a.py") == ""


def test_build_existing_files_context_emits_extend_notice_for_existing_target() -> None:
    files = [_file("backend/a.py", "class User:\n    pass\n", "python")]
    context = build_existing_files_context(files, "backend/a.py")
    assert "EXTEND, DO NOT OVERWRITE" in context
    assert "class User" in context
    assert "backend/a.py" in context


def test_build_existing_files_context_lists_other_files_outline() -> None:
    files = [
        _file("backend/a.py", "class User:\n    pass\n", "python"),
        _file("backend/b.py", "def get_user(id):\n    pass\n", "python"),
    ]
    context = build_existing_files_context(files, "backend/c.py")
    assert "EXTEND" not in context
    assert "backend/a.py" in context
    assert "class User" in context
    assert "backend/b.py" in context
    assert "def get_user(id)" in context


def test_build_existing_files_context_truncates_extend_section_independently() -> None:
    big_content = "class User:\n" + ("    x = 1\n" * 5000)
    files = [
        _file("backend/a.py", big_content, "python"),
        _file("backend/b.py", "class Other:\n    pass\n", "python"),
    ]
    context = build_existing_files_context(files, "backend/a.py", max_chars=50)
    assert "...[truncated]" in context
    assert "EXTEND, DO NOT OVERWRITE" in context
    # The other-files section's own small budget is independent of (not
    # reduced by) the extend section's much larger content.
    assert "backend/b.py" in context
