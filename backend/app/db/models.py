"""SQLAlchemy ORM models for the Collaborative Steering Pipeline."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ProjectModel(Base):
    """Stores ProjectBlueprint as JSONB."""

    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_name: Mapped[str] = mapped_column(String(255), default="")
    blueprint_data: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, server_default=func.now()
    )
    version: Mapped[int] = mapped_column(Integer, default=1)

    __table_args__ = (
        Index("ix_projects_created_at", "created_at"),
    )


class DecisionEntryModel(Base):
    """Append-only decision ledger entries."""

    __tablename__ = "decision_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    entry_id: Mapped[str] = mapped_column(String(36), unique=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String(36), index=True)
    stage_id: Mapped[int] = mapped_column(Integer)
    action: Mapped[str] = mapped_column(String(50))  # accept, modify, replace, add, edit, remove, defer
    node_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    node_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    user_id: Mapped[str] = mapped_column(String(255))
    old_value: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    new_value: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    reason: Mapped[str] = mapped_column(Text, default="")
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, server_default=func.now())

    __table_args__ = (
        Index("ix_decision_entries_project_id", "project_id"),
        Index("ix_decision_entries_timestamp", "timestamp"),
    )


class SessionModel(Base):
    """Pipeline session state."""

    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id: Mapped[str] = mapped_column(String(36), unique=True, index=True)
    project_id: Mapped[str] = mapped_column(String(36), index=True)
    state: Mapped[str] = mapped_column(String(50), default="initialized")
    current_stage: Mapped[int] = mapped_column(Integer, default=-1)
    blueprint_snapshot: Mapped[dict] = mapped_column(JSONB, default=dict)
    ledger_snapshot: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, server_default=func.now()
    )

    __table_args__ = (
        Index("ix_sessions_project_id", "project_id"),
        Index("ix_sessions_created_at", "created_at"),
    )


class AuditEventModel(Base):
    """TimescaleDB hypertable for audit events."""

    __tablename__ = "audit_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    event_id: Mapped[str] = mapped_column(String(36), unique=True)
    project_id: Mapped[str] = mapped_column(String(36), index=True)
    level: Mapped[str] = mapped_column(String(20))  # diff, full, reference
    action: Mapped[str] = mapped_column(String(255))
    event_data: Mapped[dict] = mapped_column(JSONB, default=dict)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, server_default=func.now())

    __table_args__ = (
        Index("ix_audit_events_project_id", "project_id"),
        Index("ix_audit_events_timestamp", "timestamp"),
        Index("ix_audit_events_project_timestamp", "project_id", "timestamp"),
    )


class CheckpointModel(Base):
    """Checkpoint metadata (actual data stored in S3/MinIO)."""

    __tablename__ = "checkpoints"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    checkpoint_id: Mapped[str] = mapped_column(String(36), unique=True, index=True)
    project_id: Mapped[str] = mapped_column(String(36), index=True)
    stage: Mapped[int] = mapped_column(Integer)
    state: Mapped[str] = mapped_column(String(50))
    s3_key: Mapped[str] = mapped_column(String(512))  # Reference to S3/MinIO object
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, server_default=func.now())

    __table_args__ = (
        Index("ix_checkpoints_project_id", "project_id"),
        Index("ix_checkpoints_created_at", "created_at"),
    )
