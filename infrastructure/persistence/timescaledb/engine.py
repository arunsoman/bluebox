"""SQLAlchemy async engine for TimescaleDB (Audit Trail)."""
from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from config.settings import settings

_ts_engine = None
_ts_session_factory = None


def get_ts_engine():
    global _ts_engine
    if _ts_engine is None:
        _ts_engine = create_async_engine(
            settings.timescale_url,
            echo=False,
            pool_size=10,
            max_overflow=20,
            pool_pre_ping=True,
        )
    return _ts_engine


def get_ts_session_factory():
    global _ts_session_factory
    if _ts_session_factory is None:
        _ts_session_factory = async_sessionmaker(
            get_ts_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=False,
        )
    return _ts_session_factory


async def get_ts_session():
    factory = get_ts_session_factory()
    async with factory() as session:
        yield session


async def init_ts_db():
    """Create TimescaleDB hypertable for audit events."""
    from sqlalchemy import text
    engine = get_ts_engine()
    async with engine.begin() as conn:
        # Create base table
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS audit_events (
                event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                session_id UUID NOT NULL,
                project_id UUID NOT NULL,
                timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                actor_type VARCHAR(30) NOT NULL,
                user_id UUID,
                action VARCHAR(50) NOT NULL,
                target_type VARCHAR(50),
                target_id UUID,
                target_label VARCHAR(255),
                before_state JSONB,
                after_state JSONB,
                authorization_ref UUID,
                storage_strategy VARCHAR(20) DEFAULT 'diff',
                metadata JSONB,
                ip_address INET
            )
        """))
        # Convert to hypertable (idempotent)
        await conn.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM timescaledb_information.hypertables
                    WHERE hypertable_name = 'audit_events'
                ) THEN
                    PERFORM create_hypertable('audit_events', 'timestamp', chunk_time_interval => INTERVAL '7 days');
                END IF;
            END $$;
        """))
        # Indexes
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_audit_session ON audit_events (session_id, timestamp DESC)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_events (user_id, timestamp DESC)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_events (action, timestamp DESC)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_events (target_type, target_id, timestamp DESC)"))


async def close_ts_db():
    global _ts_engine
    if _ts_engine:
        await _ts_engine.dispose()
        _ts_engine = None
