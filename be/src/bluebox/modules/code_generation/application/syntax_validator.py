"""Syntax validation for generated code - doc/api_event_contract.md SS8.1
`CodeGenError.error_type` already has an unused "syntax" literal value;
this module is what populates it.

`CodeGenService.generate_task_files` previously wrote whatever an LLM
returned straight to disk with no validation - a syntactically broken file
was silently treated as a successful generation. Dispatch is keyed on the
file's extension (deterministic, chosen by the task's `file_paths`), not the
freeform `language` field an LLM produces as plain text - the same
extension-vs-freeform-string tradeoff `project_context.py`'s `_outline()`
makes, just resolved the other way since this is a hard failure path, not a
best-effort prompt hint. A suffix with no grammar mapped is left
unvalidated - we can't validate what we don't parse.

Parsers are built once at module scope. Safe in this single-process,
single-event-loop FastAPI app: `Parser.parse()` is a synchronous call with no
`await` inside it, so no two coroutines can ever be mid-`.parse()` on the
same instance at once, regardless of any thread-safety question for
concurrent OS threads (which this app's request-handling doesn't use).
"""

from pathlib import Path

import tree_sitter_javascript as tsjavascript
import tree_sitter_python as tspython
import tree_sitter_typescript as tstypescript
from tree_sitter import Language, Node as TSNode, Parser


class GeneratedCodeSyntaxError(Exception):
    def __init__(self, file_path: str, message: str) -> None:
        super().__init__(f"{file_path}: {message}")
        self.file_path = file_path
        self.message = message


_PARSERS_BY_SUFFIX: dict[str, Parser] = {
    ".py": Parser(Language(tspython.language())),
    ".js": Parser(Language(tsjavascript.language())),
    ".jsx": Parser(Language(tsjavascript.language())),
    ".ts": Parser(Language(tstypescript.language_typescript())),
    ".tsx": Parser(Language(tstypescript.language_tsx())),
}


def _first_error_point(node: TSNode) -> tuple[int, int] | None:
    if node.type == "ERROR" or node.is_missing:
        return node.start_point
    for child in node.children:
        point = _first_error_point(child)
        if point is not None:
            return point
    return None


def validate_syntax(file_path: str, content: str) -> None:
    """Raises `GeneratedCodeSyntaxError` if *content* fails to parse as the
    language implied by *file_path*'s extension. Returns silently when no
    grammar is mapped for that extension, or when it parses cleanly."""

    parser = _PARSERS_BY_SUFFIX.get(Path(file_path).suffix)
    if parser is None:
        return

    tree = parser.parse(content.encode())
    if not tree.root_node.has_error:
        return

    point = _first_error_point(tree.root_node) or tree.root_node.start_point
    line, column = point
    raise GeneratedCodeSyntaxError(file_path, f"syntax error near line {line + 1}, column {column + 1}")
