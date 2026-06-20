"""Stage 9 RuntimeSandbox DTOs - doc/api_event_contract.md SS4.5.

These are REST response/request shapes, not LLM types (Stage 9 has no LLM
call site - it executes what Stage 8 generated), so they live in `domain/`
rather than `llm/` and are plain `BaseModel`s with no anti-corruption-layer
concern.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class RuntimeStartRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    environment: Literal["development", "production"] = "development"
    hot_reload: bool = True
    preview_device: Literal["desktop", "tablet", "mobile"] | None = None


class StartupStep(BaseModel):
    model_config = ConfigDict(extra="forbid")

    step_number: int
    step_name: str
    status: Literal["pending", "active", "complete", "failed"]
    logs: str | None = None


class RuntimeStartResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sandbox_id: str
    preview_url: str
    status: Literal["starting", "running", "error"]
    startup_steps: list[StartupStep] = Field(default_factory=list)


class PortMapping(BaseModel):
    model_config = ConfigDict(extra="forbid")

    internal_port: int
    external_port: int
    protocol: Literal["http", "https", "tcp"] = "tcp"


class ResourceUsage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    cpu_percent: float = 0.0
    memory_mb: float = 0.0


class RuntimeStatus(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sandbox_id: str | None = None
    status: Literal["stopped", "starting", "running", "error", "crashed"]
    preview_url: str | None = None
    port_mappings: list[PortMapping] = Field(default_factory=list)
    uptime_seconds: float = 0.0
    resource_usage: ResourceUsage = Field(default_factory=ResourceUsage)


class RuntimeCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    command: str
    args: list[str] = Field(default_factory=list)
    working_directory: str | None = None
    timeout_seconds: int | None = None


class RuntimeCommandResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    exit_code: int
    stdout: str
    stderr: str
    execution_time_ms: float
