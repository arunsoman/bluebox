"""SQLAlchemy 2.0 async models for PostgreSQL (Pipeline State + Decision Ledger + RBAC)."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, String, Text, Integer, Boolean, ForeignKey, ARRAY, UUID, Index
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def generate_uuid() -> str:
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    pass


class PipelineSession(Base):
    __tablename__ = "pipeline_sessions"

    session_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    project_id: Mapped[str] = mapped_column(String(36), nullable=False, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(String(36), nullable=False)
    current_stage: Mapped[str | None] = mapped_column(String(50), nullable=True)
    state_json: Mapped[dict] = mapped_column(JSON, default=dict)
    sandbox_mode: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    suspended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="idle")
    richness_mode: Mapped[str | None] = mapped_column(String(20), nullable=True)
    notification_channel: Mapped[str] = mapped_column(String(20), default="sse")
    webhook_callback_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    decisions: Mapped[list["DecisionEntryRecord"]] = relationship(back_populates="session", lazy="selectin")
    checkpoints: Mapped[list["CheckpointRecord"]] = relationship(back_populates="session", lazy="selectin")
    rbac_models: Mapped[list["RBACModelRecord"]] = relationship(back_populates="session", lazy="selectin")
    infra_profiles: Mapped[list["InfrastructureProfileRecord"]] = relationship(back_populates="session", lazy="selectin")
    tech_stack_profiles: Mapped[list["TechStackProfileRecord"]] = relationship(back_populates="session", lazy="selectin")

    __table_args__ = (
        Index("idx_session_user", "user_id"),
        Index("idx_session_status", "status"),
    )


class DecisionEntryRecord(Base):
    __tablename__ = "decision_entries"

    decision_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    session_id: Mapped[str] = mapped_column(ForeignKey("pipeline_sessions.session_id"), nullable=False)
    stage: Mapped[str] = mapped_column(String(50), nullable=False)
    decision_point: Mapped[str] = mapped_column(String(255), nullable=False)
    chosen_option: Mapped[dict] = mapped_column(JSON, default=dict)
    options_presented: Mapped[list[dict] | None] = mapped_column(JSON, nullable=True)
    decision_maker: Mapped[str] = mapped_column(String(20), nullable=False)
    authorization_scope: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active")
    revision_chain: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    reverted_from: Mapped[str | None] = mapped_column(String(36), ForeignKey("decision_entries.decision_id"), nullable=True)
    audit_event_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    session: Mapped["PipelineSession"] = relationship(back_populates="decisions")

    __table_args__ = (
        Index("idx_decision_session", "session_id"),
        Index("idx_decision_status", "status"),
    )


class CheckpointRecord(Base):
    __tablename__ = "checkpoints"

    checkpoint_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    session_id: Mapped[str] = mapped_column(ForeignKey("pipeline_sessions.session_id"), nullable=False)
    stage_completed: Mapped[str] = mapped_column(String(50), nullable=False)
    pipeline_state_snapshot: Mapped[dict] = mapped_column(JSON, default=dict)
    decision_ledger_snapshot: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    label: Mapped[str] = mapped_column(String(255), default="")
    s3_key: Mapped[str | None] = mapped_column(String(500), nullable=True)

    session: Mapped["PipelineSession"] = relationship(back_populates="checkpoints")

    __table_args__ = (Index("idx_checkpoint_session", "session_id"),)


class RBACModelRecord(Base):
    __tablename__ = "rbac_models"

    model_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    session_id: Mapped[str] = mapped_column(ForeignKey("pipeline_sessions.session_id"), nullable=False)
    model_json: Mapped[dict] = mapped_column(JSON, default=dict)
    version: Mapped[int] = mapped_column(Integer, default=1)
    max_inheritance_depth: Mapped[int] = mapped_column(Integer, default=3)
    escalation_check_algorithm: Mapped[str] = mapped_column(String(50), default="STATIC_ESCALATION_ANALYSIS")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    session: Mapped["PipelineSession"] = relationship(back_populates="rbac_models")

    __table_args__ = (
        Index("idx_rbac_session", "session_id"),
        Index("idx_rbac_version", "session_id", "version", unique=True),
    )


class InfrastructureProfileRecord(Base):
    __tablename__ = "infrastructure_profiles"

    profile_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    session_id: Mapped[str] = mapped_column(ForeignKey("pipeline_sessions.session_id"), nullable=False)
    profile_json: Mapped[dict] = mapped_column(JSON, default=dict)
    stale: Mapped[bool] = mapped_column(Boolean, default=False)
    decision_entry_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    session: Mapped["PipelineSession"] = relationship(back_populates="infra_profiles")


class TechStackProfileRecord(Base):
    __tablename__ = "tech_stack_profiles"

    profile_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    session_id: Mapped[str] = mapped_column(ForeignKey("pipeline_sessions.session_id"), nullable=False)
    profile_json: Mapped[dict] = mapped_column(JSON, default=dict)
    decision_entry_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    session: Mapped["PipelineSession"] = relationship(back_populates="tech_stack_profiles")
