"""Application configuration via Pydantic Settings."""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All application settings loaded from environment / .env file."""

    # App
    APP_NAME: str = "Collaborative Steering Pipeline"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://user:pass@localhost:5432/pipeline"
    TIMESCALEDB_URL: str = "postgresql+asyncpg://user:pass@localhost:5432/audit"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # S3/MinIO
    S3_ENDPOINT: str = "http://localhost:9000"
    S3_BUCKET: str = "pipeline-checkpoints"
    S3_ACCESS_KEY: str = "minioadmin"
    S3_SECRET_KEY: str = "minioadmin"

    # LLM
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    DEFAULT_LLM_MODEL: str = "gpt-4"
    LLM_TIMEOUT_SECONDS: int = 30

    # Pipeline
    MAX_REVISIONS_PER_DECISION: int = 5
    DEFAULT_AUDIT_BUDGET_MB: int = 100
    AUDIT_RETENTION_DAYS: int = 90

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
