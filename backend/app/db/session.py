"""Async session factory for PostgreSQL."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

# Async engine from config DATABASE_URL
async_engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

# Async sessionmaker
AsyncSessionLocal = async_sessionmaker(
    async_engine,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


async def get_db_session():
    """FastAPI dependency that yields an async database session.

    Usage:
        from fastapi import Depends
        from app.db.session import get_db_session
        from sqlalchemy.ext.asyncio import AsyncSession

        @router.get("/items")
        async def get_items(db: AsyncSession = Depends(get_db_session)):
            ...
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
