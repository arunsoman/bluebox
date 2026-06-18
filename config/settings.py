"""Application configuration via Pydantic Settings."""
from typing import Literal
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # App
    app_name: str = "Collaborative Steering Pipeline"
    app_version: str = "3.0.0"
    debug: bool = False
    log_level: str = "INFO"
    secret_key: str = Field(default="change-me", repr=False)

    # PostgreSQL (Pipeline State + Decision Ledger)
    database_url: str = Field(
        default="postgresql+asyncpg://protobox:protobox@localhost:5432/protobox",
        repr=False,
    )

    # TimescaleDB (Audit Trail)
    timescale_url: str = Field(
        default="postgresql+asyncpg://protobox:protobox@localhost:5433/protobox_audit",
        repr=False,
    )

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # MinIO / S3
    s3_endpoint: str = "http://localhost:9000"
    s3_access_key: str = Field(default="minioadmin", repr=False)
    s3_secret_key: str = Field(default="minioadmin", repr=False)
    s3_bucket: str = "protobox-checkpoints"
    s3_region: str = "us-east-1"

    # LLM
    default_llm_provider: Literal["ollama", "openai", "nvidia", "google"] = "ollama"
    default_llm_model: str = "llama3.1:8b"
    ollama_base_url: str = "http://localhost:11434"
    openai_api_key: str = Field(default="", repr=False)
    openai_base_url: str = "https://api.openai.com/v1"
    nvidia_api_key: str = Field(default="", repr=False)
    nvidia_base_url: str = "https://integrate.api.nvidia.com/v1"
    google_api_key: str = Field(default="", repr=False)

    # Pipeline
    max_inheritance_depth: int = 3
    default_revision_budget: int = 5
    session_idle_suspend_minutes: int = 30
    session_idle_expire_days: int = 30
    session_reauth_idle_minutes: int = 60
    audit_retention_days: int = 90
    audit_storage_budget_mb: int = 100
    checkpoint_compression: bool = True


settings = Settings()
