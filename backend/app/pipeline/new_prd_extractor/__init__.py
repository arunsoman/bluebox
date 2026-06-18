"""PRD Extraction Engine — parses PRD text into structured pipeline data.

For well-formed PRDs, this extracts explicit data without LLM calls.
For implicit data, it signals that LLM inference is needed.

**High-level API:**

.. code-block:: python

    from .orchestrator import extract_prd, extract_prd_streaming

    # Blocking — returns ExtractedPRD
    result = await extract_prd(prd_markdown)

    # Streaming — yields PRDExtractionEvent per chunk
    async for event in extract_prd_streaming(prd_markdown):
        print(event.type, event.message)

**Low-level pieces** (import directly when building custom pipelines):

* ``chunk_prd`` — structural chunking with tiktoken budgets.
* ``extract_chunk`` — fast regex extraction per chunk.
* ``ExtractionRegistry`` — cross-chunk entity resolution.
* ``create_extraction_agent`` — PydanticAI agent factory.
* ``ChunkResult``, ``ExtractedPRD``, etc. — Pydantic output models.
"""

from .models import (
    ChunkResult,
    ExtractedActor,
    ExtractedCapability,
    ExtractedPRD,
    ExtractedUseCase,
    ExtractedUserStory,
)
from .orchestrator import extract_prd, extract_prd_streaming

__all__ = [
    "extract_prd",
    "extract_prd_streaming",
    "ChunkResult",
    "ExtractedActor",
    "ExtractedCapability",
    "ExtractedUseCase",
    "ExtractedUserStory",
    "ExtractedPRD",
]
