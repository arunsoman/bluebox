"""Tests for code_generation/application/syntax_validator.py."""

import pytest

from bluebox.modules.code_generation.application.syntax_validator import (
    GeneratedCodeSyntaxError,
    validate_syntax,
)


def test_valid_python_does_not_raise() -> None:
    validate_syntax("backend/main.py", "def foo():\n    pass\n")


def test_valid_javascript_does_not_raise() -> None:
    validate_syntax("frontend/index.js", "function foo() {\n  return 1;\n}\n")


def test_valid_typescript_does_not_raise() -> None:
    validate_syntax("frontend/index.ts", "function foo(): number {\n  return 1;\n}\n")


def test_valid_tsx_does_not_raise() -> None:
    validate_syntax("frontend/App.tsx", "export function App() {\n  return <div>hi</div>;\n}\n")


def test_invalid_python_raises_with_line_number() -> None:
    content = "x = 1\n" "def foo(:\n" "    pass\n"
    with pytest.raises(GeneratedCodeSyntaxError) as exc_info:
        validate_syntax("backend/main.py", content)
    assert exc_info.value.file_path == "backend/main.py"
    assert "line 2" in exc_info.value.message


def test_unknown_extension_is_not_validated() -> None:
    validate_syntax("config/settings.yaml", "this: [is not, valid yaml: at all :::")
