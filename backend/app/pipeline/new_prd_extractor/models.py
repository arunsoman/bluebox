"""Pydantic models for structured PRD extraction output.

This module re-exports extraction models from the unified domain models
and provides extraction-specific helpers.
"""

# Re-export all extraction models from domain models (unified location)
from app.domain.models import (
    ChunkResult,
    ExtractedActor,
    ExtractedCapability,
    ExtractedPRD,
    ExtractedUseCase,
    ExtractedUserStory,
    SectionType,
    _slug_id,
)

__all__ = [
    "SectionType",
    "ExtractedActor",
    "ExtractedCapability",
    "ExtractedUseCase",
    "ExtractedUserStory",
    "ExtractedPRD",
    "ChunkResult",
    "_slug_id",
]