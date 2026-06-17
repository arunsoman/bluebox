"""FastAPI dependencies."""

from __future__ import annotations

from app.db.session import AsyncSessionLocal


async def get_db():
    """Yield a DB session for dependency injection."""
    async with AsyncSessionLocal() as session:
        yield session
