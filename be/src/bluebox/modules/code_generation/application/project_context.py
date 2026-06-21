"""Cross-task / regeneration context for Stage 8 file generation.

`CodeGenService.generate_task_files` generates each `EngineeringTaskNode`'s
files one at a time with no visibility into files other tasks already wrote
to the same project's workspace, and no visibility into a file's current
content when it's being regenerated (`regenerate_files`). Both are real
correctness risks: a later file importing a class an earlier task generated
is guessed at blind, and regeneration can silently drop logic the task
description doesn't mention.

This module builds a small, regex-only (no tree-sitter) outline of
already-generated files to give the LLM that missing context, plus an
explicit "extend, don't overwrite" notice when the target file already
exists. `GeneratedFile.language` is freeform LLM-produced text, not an
enum, so outline matching errs toward over-matching - an empty outline is
harmless, it just degrades to "this file exists, no outline available."
"""

from __future__ import annotations

import re

from bluebox.modules.code_generation.domain.workspace import GeneratedFile

_EXTEND_CONTENT_BUDGET = 12_000
_TRUNCATION_MARKER = "\n...[truncated]"

_PY_CLASS_RE = re.compile(r"^class\s+(\w+)", re.MULTILINE)
_PY_DEF_RE = re.compile(r"^def\s+(\w+)\s*\(([^)]*)\)", re.MULTILINE)

_TSJS_CLASS_RE = re.compile(r"class\s+(\w+)")
_TSJS_FUNCTION_RE = re.compile(r"function\s+(\w+)")
_TSJS_ARROW_RE = re.compile(r"(?:const|let|var)\s+(\w+)\s*=\s*(?:\([^)]*\)|[^=])\s*=>")
_TSJS_INTERFACE_RE = re.compile(r"interface\s+(\w+)")

_TSJS_LANGUAGES = {"typescript", "javascript"}
_TSJS_SUFFIXES = ("ts", "js", "tsx", "jsx")


def _python_outline(content: str) -> list[str]:
    outline = [f"class {m.group(1)}" for m in _PY_CLASS_RE.finditer(content)]
    outline += [f"def {m.group(1)}({m.group(2)})" for m in _PY_DEF_RE.finditer(content)]
    return outline


def _tsjs_outline(content: str) -> list[str]:
    outline = [f"class {m.group(1)}" for m in _TSJS_CLASS_RE.finditer(content)]
    outline += [f"function {m.group(1)}" for m in _TSJS_FUNCTION_RE.finditer(content)]
    outline += [f"function {m.group(1)}" for m in _TSJS_ARROW_RE.finditer(content)]
    outline += [f"interface {m.group(1)}" for m in _TSJS_INTERFACE_RE.finditer(content)]
    return outline


def _outline(language: str, content: str) -> list[str]:
    lang = language.lower()
    if "python" in lang:
        return _python_outline(content)
    if lang in _TSJS_LANGUAGES or lang.endswith(_TSJS_SUFFIXES):
        return _tsjs_outline(content)
    return []


def _extend_section(existing: GeneratedFile) -> str:
    content = existing.content
    if len(content) > _EXTEND_CONTENT_BUDGET:
        content = content[:_EXTEND_CONTENT_BUDGET] + _TRUNCATION_MARKER
    return (
        "## EXISTING FILE — EXTEND, DO NOT OVERWRITE\n"
        f"`{existing.file_path}` already exists. Preserve all existing members not "
        "explicitly being replaced by this task. Current content:\n"
        f"```\n{content}\n```\n"
    )


def _other_files_section(files: list[GeneratedFile], max_chars: int) -> str:
    lines: list[str] = []
    used = 0
    for f in files:
        outline = _outline(f.language, f.content)
        line = f"- `{f.file_path}` ({f.language}): {', '.join(outline)}" if outline else f"- `{f.file_path}` ({f.language})"
        cost = len(line) + 1
        if used + cost > max_chars:
            break
        lines.append(line)
        used += cost
    if not lines:
        return ""
    return "## Other files already in this project\n" + "\n".join(lines) + "\n"


def build_existing_files_context(
    files: list[GeneratedFile], target_file_path: str, *, max_chars: int = 6000
) -> str:
    """Build prompt context for `CodeFileGenerationRequest.existing_files_context`.

    Returns "" when *files* is empty (first file in a fresh project). Otherwise
    returns an "extend, don't overwrite" section (if *target_file_path* already
    exists among *files*) followed by a one-line-per-file outline of every
    other existing file. The two sections are capped independently so the
    extend section is never truncated as a side effect of how many other files
    exist.
    """
    if not files:
        return ""

    existing_target = next((f for f in files if f.file_path == target_file_path), None)
    others = [f for f in files if f.file_path != target_file_path]

    parts = []
    if existing_target is not None:
        parts.append(_extend_section(existing_target))
    parts.append(_other_files_section(others, max_chars))
    return "".join(p for p in parts if p)
