"""Per-task code generation tracking - NOT part of doc/api_event_contract.md
SS8.1 (which only models a project-aggregate `CodeGenStatus`, no per-task
breakdown, no pause concept). Added after the contract was written, same
precedent as `interfaces/api/routers/llm_config.py` and the log viewer
(`shared_kernel/observability/log_event.py`) - both documented in CLAUDE.md
as real functionality with no contract section to cite.

Backs the code-generation progress panel: every committed
`EngineeringTaskNode` gets one `TaskGenerationStatus`, updated as
`ProjectCodeGenService` works through it.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict

from bluebox.modules.code_generation.domain.workspace import CodeGenError


class TaskGenerationStatus(BaseModel):
    model_config = ConfigDict(extra="forbid")

    task_id: str
    file_paths: list[str]
    status: Literal["queued", "running", "completed", "failed", "cancelled"]
    files_completed: int
    files_total: int
    current_file: str | None = None
    error: CodeGenError | None = None
