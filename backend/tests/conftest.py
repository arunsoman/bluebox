"""Shared pytest fixtures for the Collaborative Steering Pipeline test suite."""

from __future__ import annotations

import asyncio

import pytest
import pytest_asyncio

from app.core.events import EventBus, LocalEventBus
from app.core.state_machine import PipelineOrchestrator, PipelineState
from app.graph.dag import DependencyGraphService
from app.graph.impact import ImpactAnalyzer
from app.governance.revision import RevisionEngine
from app.llm.mock import MockLLMClient


# ---------------------------------------------------------------------------
# Event Loop
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


# ---------------------------------------------------------------------------
# Core Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_llm():
    """Return a MockLLMClient with pre-configured responses."""
    return MockLLMClient(responses={
        "problem": (
            '{"problem_statement": "Test problem",'
            '"project_name": "Test Project",'
            '"domain_signals": {"scale": "small", "tech_hints": [], "compliance_hints": []}}'
        ),
        "actor": (
            '{"actors": [{"id": "act-1", "name": "Customer", "description": "End user", "type": "human"}]}'
        ),
    })


@pytest.fixture
def event_bus():
    """Return a fresh LocalEventBus."""
    return LocalEventBus()


@pytest.fixture
def pipeline_orchestrator(event_bus):
    """Return a PipelineOrchestrator in INITIALIZED state."""
    return PipelineOrchestrator(project_id="test-123", event_bus=event_bus)


@pytest.fixture
def graph_service():
    """Return a fresh DependencyGraphService."""
    return DependencyGraphService()


@pytest.fixture
def revision_engine(event_bus, graph_service):
    """Return a RevisionEngine wired with ImpactAnalyzer + EventBus."""
    impact_analyzer = ImpactAnalyzer(graph_service)
    return RevisionEngine(impact_analyzer, event_bus)
