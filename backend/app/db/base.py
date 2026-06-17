"""SQLAlchemy 2.0 async base class."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncAttrs
from sqlalchemy.orm import DeclarativeBase


class Base(AsyncAttrs, DeclarativeBase):
    """Base class for all ORM models with async attribute support."""
