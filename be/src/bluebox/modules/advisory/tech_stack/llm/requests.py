"""LLM request models for the Tech Stack Advisor.

doc/prd.md SS4.3 TechStackAdvisor: SignalDetector, TechStackOptionsMatrix.
"""

from typing import Literal

from bluebox.modules.core_pipeline.llm.requests import ConfirmedNodeRef
from bluebox.shared_kernel.llm.base import LLMRequest


class TechStackSignalDetectionRequest(LLMRequest):
    """doc/prd.md SS4.3 SignalDetector - explicit ("React, Node") or implicit
    ("real-time" -> WebSockets) tech mentions in raw input."""

    raw_text: str


class TechStackOptionsRequest(LLMRequest):
    """doc/prd.md AC-TS-01/AC-TS-02 - generates the TechStackOptionsMatrix."""

    actors: list[ConfirmedNodeRef]
    scale_persona: Literal["SMALL", "MEDIUM", "LARGE", "ENTERPRISE"]
    detected_signals: list[str] = []
