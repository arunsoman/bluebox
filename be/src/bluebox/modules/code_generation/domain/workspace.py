"""Workspace domain models - doc/api_event_contract.md SS8.1.

`GeneratedFile` is the full, committed record (content_hash/size_bytes
computed, provenance attached) - distinct from
`code_generation/llm/responses.py`'s `GeneratedFileDraft`, which is only
the generative subset an LLM call produces (see that file's docstring from
pass 2 for why hash/size are never asked of the LLM).

`WorkspaceManifest`'s exact fields are not fully specified in either spec
doc - doc/prd.md SS4.8/Glossary only says "generated file inventory with
run/test/build commands" - modeled here as the minimal literal reading of
that sentence.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class FileProvenance(BaseModel):
    """doc/api_event_contract.md SS8.1 `GeneratedFile.provenance`."""

    model_config = ConfigDict(extra="forbid")

    task_id: str
    story_id: str
    decision_entry_id: str
    checkpoint_id: str
    generation_timestamp: datetime = Field(default_factory=datetime.now)


class GeneratedFile(BaseModel):
    """doc/api_event_contract.md SS8.1 `GeneratedFile`."""

    model_config = ConfigDict(extra="forbid")

    file_path: str
    content: str
    content_hash: str
    size_bytes: int
    layer: str
    task_id: str
    provenance: FileProvenance
    language: str


class WorkspaceManifest(BaseModel):
    """doc/prd.md SS4.8/Glossary: "generated file inventory with
    run_command, test_command, build_command"."""

    model_config = ConfigDict(extra="forbid")

    project_id: str
    files: list[str] = Field(default_factory=list)
    run_command: str
    test_command: str | None = None
    build_command: str | None = None


class CodeGenError(BaseModel):
    """doc/api_event_contract.md SS8.1 `CodeGenError`."""

    model_config = ConfigDict(extra="forbid")

    file_path: str
    error_type: Literal["syntax", "dependency", "template", "merge_conflict"]
    message: str
    recoverable: bool


class CodeGenStart(BaseModel):
    """doc/api_event_contract.md SS8.1 `CodeGenStart` - response to
    `POST .../generate` and payload of the `CODE_GENERATION_STARTED` WS event."""

    model_config = ConfigDict(extra="forbid")

    generation_id: str
    total_files: int
    estimated_duration_seconds: float


class CodeGenStatus(BaseModel):
    """doc/api_event_contract.md SS8.1 `CodeGenStatus`."""

    model_config = ConfigDict(extra="forbid")

    generation_id: str
    status: Literal["queued", "running", "completed", "failed"]
    files_completed: int
    files_total: int
    current_file: str | None = None
    errors: list[CodeGenError] = Field(default_factory=list)
