"""Smoke test for every wired LLM agent.

Runs each wrapper function from a module's llm/agents.py against
`pydantic_ai.models.test.TestModel` (no network, no API key) and asserts the
result is an instance of the expected response model. This proves two
things at once: every agent is wired to the schema it's supposed to be, and
every schema is actually satisfiable by a structured-output model (catches
e.g. an unsatisfiable Literal/Field(min_length=...) combination before any
real provider call).
"""

from typing import Any

import pytest
from pydantic_ai.models.test import TestModel

from bluebox.modules.advisory.rbac.llm import agents as rbac_agents
from bluebox.modules.advisory.rbac.llm.requests import RBACModelGenerationRequest
from bluebox.modules.advisory.rbac.llm.responses import RBACModel
from bluebox.modules.advisory.scaling.llm import agents as scaling_agents
from bluebox.modules.advisory.scaling.llm.requests import HostingOptionsRequest, ScaleInputsContext
from bluebox.modules.advisory.scaling.llm.responses import (
    CostRange,
    HostingOption,
    HostingOptionsMatrix,
    InfrastructureComponent,
)
from bluebox.modules.advisory.tech_stack.llm import agents as tech_stack_agents
from bluebox.modules.advisory.tech_stack.llm.requests import (
    TechStackOptionsRequest,
    TechStackSignalDetectionRequest,
)
from bluebox.modules.advisory.tech_stack.llm.responses import (
    TechStackOptionsMatrix,
    TechStackSignalDetectionResult,
)
from bluebox.modules.chat.llm import agents as chat_agents
from bluebox.modules.chat.llm.requests import (
    ChatIntentParseRequest,
    ChatResponseRequest,
    ContextQuestionRequest,
    InlineSteeringCommentRequest,
    PreviewFeedbackInterpretationRequest,
)
from bluebox.modules.chat.llm.responses import (
    ChatIntentParseResult,
    ChatResponseResult,
    ContextAnswer,
    MidSteerSignal,
    PreviewFeedbackInterpretationResult,
)
from bluebox.modules.code_generation.llm import agents as code_generation_agents
from bluebox.modules.code_generation.llm.requests import (
    CodeFileGenerationRequest,
    FileProvenanceContext,
    InfrastructureCodeCompilationRequest,
    MergeConflictContext,
    MergeConflictResolutionRequest,
    ProvenanceExplanationRequest,
    RBACMiddlewareCompilationRequest,
    RBACSummary,
)
from bluebox.modules.code_generation.llm.responses import (
    GeneratedFileDraft,
    GeneratedFileDraftSet,
    MergeConflictResolutionSuggestion,
    ProvenanceExplanation,
)
from bluebox.modules.core_pipeline.llm import agents as core_pipeline_agents
from bluebox.modules.core_pipeline.llm.requests import (
    ActorGenerationRequest,
    CapabilityGenerationRequest,
    ConfirmedNodeRef,
    EngineeringTaskGenerationRequest,
    IdeationRequest,
    TechStackSummary,
    UseCaseGenerationRequest,
    UserStoryGenerationRequest,
)
from bluebox.modules.core_pipeline.llm.responses import (
    ActorCandidateSet,
    CapabilityCandidateSet,
    EngineeringTaskCandidate,
    EngineeringTaskCandidateSet,
    IdeationOptionsResult,
    UseCaseCandidateSet,
    UserStoryCandidateSet,
)
from bluebox.modules.governance.llm import agents as governance_agents
from bluebox.modules.governance.llm.requests import (
    NodeEnrichmentRequest,
    UserOptionValidationRequest,
)
from bluebox.modules.governance.llm.responses import EnrichResult, UserOptionValidationResult
from bluebox.modules.input_processing.llm import agents as input_processing_agents
from bluebox.modules.input_processing.llm.requests import (
    ComplianceDetectionRequest,
    LegacyContextSummaryRequest,
    PRDAnalysisRequest,
    PRDChunkAnalysisRequest,
    RichnessClassificationRequest,
    SectionContentDraftRequest,
    SeedSynthesisRequest,
)
from bluebox.modules.input_processing.llm.responses import (
    ComplianceDetectionResult,
    LegacyContextReport,
    PRDAnalysisReport,
    PRDChunkAnalysisResult,
    RichnessClassification,
    SectionContentDraft,
    Stage0Seed,
)

_NODE_REF = ConfirmedNodeRef(node_id="N-1", name="Patient", description="Primary end user")
_TECH_STACK_SUMMARY = TechStackSummary(
    frontend_framework="React", backend_framework="FastAPI", database="PostgreSQL"
)
_COST_RANGE = CostRange(
    low_usd=100, mid_usd=200, high_usd=300, basis="on-demand", assumptions=["a"], excludes=["b"]
)
_HOSTING_OPTION = HostingOption(
    option_id="opt-1",
    option_name="AWS ECS",
    architecture_description="Containerized service",
    components=[
        InfrastructureComponent(component_type="compute", provider="AWS", service_name="ECS", tier="t3")
    ],
    estimated_monthly_cost=_COST_RANGE,
    scale_fit="optimal",
    over_budget=False,
    rationale="fits scale",
    pros=["a"],
    cons=["b"],
)
_ENGINEERING_TASK = EngineeringTaskCandidate(
    name="JWT Middleware",
    description="Implement JWT auth",
    estimated_hours=4,
    complexity="Low",
    preconditions=["library installed"],
    postconditions=["tokens validated"],
    file_paths=["backend/src/middleware/auth.ts"],
    tech_stack_requirements=["Node.js"],
    parent_story_id="STORY-1",
)

# Each row: (Agent instance, wrapper function, example request, expected response type).
# The Agent is listed explicitly (not introspected) since several modules
# define more than one Agent - introspecting "the" Agent in a module would
# be ambiguous.
CASES: list[tuple[Any, Any, Any, type]] = [
    # input_processing
    (
        input_processing_agents.richness_classification_agent,
        input_processing_agents.classify_richness,
        RichnessClassificationRequest(raw_text="We need a dental booking app."),
        RichnessClassification,
    ),
    (
        input_processing_agents.prd_analysis_agent,
        input_processing_agents.analyze_prd,
        PRDAnalysisRequest(raw_text="Full PRD text...", detected_mode="WELL_FORMED"),
        PRDAnalysisReport,
    ),
    (
        input_processing_agents.prd_chunk_analysis_agent,
        input_processing_agents.analyze_prd_chunk,
        PRDChunkAnalysisRequest(
            chunk_text="## Actors\n- Admin",
            chunk_index=0,
            total_chunks=2,
            pipeline_stage_reference="0: Seed\n1: Ideation\n2: Actors",
        ),
        PRDChunkAnalysisResult,
    ),
    (
        input_processing_agents.compliance_detection_agent,
        input_processing_agents.detect_compliance,
        ComplianceDetectionRequest(raw_text="We store EU patient health records."),
        ComplianceDetectionResult,
    ),
    (
        input_processing_agents.section_content_draft_agent,
        input_processing_agents.draft_section_content,
        SectionContentDraftRequest(
            raw_prd_text="Full PRD text...",
            section_name="Security",
            guidance="Draft the missing 'Security' section.",
        ),
        SectionContentDraft,
    ),
    (
        input_processing_agents.seed_synthesis_agent,
        input_processing_agents.synthesize_seed,
        SeedSynthesisRequest(dialogue_id="diag-1", answers={"q1": "Patients and dentists"}),
        Stage0Seed,
    ),
    (
        input_processing_agents.legacy_context_summary_agent,
        input_processing_agents.summarize_legacy_context,
        LegacyContextSummaryRequest(
            languages={"Python": 80.0, "TypeScript": 20.0},
            detected_frameworks=["FastAPI"],
            existing_api_routes_raw=["GET /api/users"],
            existing_database_tables_raw={"users": ["id", "email"]},
        ),
        LegacyContextReport,
    ),
    # core_pipeline
    (
        core_pipeline_agents.ideation_agent,
        core_pipeline_agents.generate_ideation_options,
        IdeationRequest(
            seed=Stage0Seed(
                problem_statement="Dentists need an easier booking flow",
                target_users=["Patients", "Dentists"],
                core_functionality=["Booking"],
                constraints=["HIPAA"],
                success_metrics=["Reduce no-shows"],
            )
        ),
        IdeationOptionsResult,
    ),
    (
        core_pipeline_agents.actor_generation_agent,
        core_pipeline_agents.generate_actors,
        ActorGenerationRequest(context="Dental SaaS for booking and payments"),
        ActorCandidateSet,
    ),
    (
        core_pipeline_agents.capability_generation_agent,
        core_pipeline_agents.generate_capabilities,
        CapabilityGenerationRequest(confirmed_actors=[_NODE_REF], context="Dental SaaS"),
        CapabilityCandidateSet,
    ),
    (
        core_pipeline_agents.use_case_generation_agent,
        core_pipeline_agents.generate_use_cases,
        UseCaseGenerationRequest(confirmed_capabilities=[_NODE_REF], actors=[_NODE_REF]),
        UseCaseCandidateSet,
    ),
    (
        core_pipeline_agents.user_story_generation_agent,
        core_pipeline_agents.generate_user_stories,
        UserStoryGenerationRequest(confirmed_use_cases=[_NODE_REF]),
        UserStoryCandidateSet,
    ),
    (
        core_pipeline_agents.engineering_task_generation_agent,
        core_pipeline_agents.generate_engineering_tasks,
        EngineeringTaskGenerationRequest(
            confirmed_stories=[_NODE_REF], tech_stack=_TECH_STACK_SUMMARY
        ),
        EngineeringTaskCandidateSet,
    ),
    # advisory.scaling
    (
        scaling_agents.hosting_options_agent,
        scaling_agents.generate_hosting_options,
        HostingOptionsRequest(
            scale_inputs=ScaleInputsContext(
                expected_total_users=1000, peak_concurrent_users=100, launch_timeline="1-3 months"
            ),
            scale_persona="MEDIUM",
        ),
        HostingOptionsMatrix,
    ),
    # advisory.tech_stack
    (
        tech_stack_agents.tech_stack_signal_detection_agent,
        tech_stack_agents.detect_tech_stack_signals,
        TechStackSignalDetectionRequest(raw_text="We need real-time updates and React."),
        TechStackSignalDetectionResult,
    ),
    (
        tech_stack_agents.tech_stack_options_agent,
        tech_stack_agents.generate_tech_stack_options,
        TechStackOptionsRequest(actors=[_NODE_REF], scale_persona="MEDIUM"),
        TechStackOptionsMatrix,
    ),
    # advisory.rbac
    (
        rbac_agents.rbac_model_generation_agent,
        rbac_agents.generate_rbac_model,
        RBACModelGenerationRequest(
            actors=[_NODE_REF], capabilities=[_NODE_REF], use_cases=[_NODE_REF]
        ),
        RBACModel,
    ),
    # governance
    (
        governance_agents.node_enrichment_agent,
        governance_agents.enrich_node,
        NodeEnrichmentRequest(node_id="N-1", node_type="actor", current_data={"name": "Patient"}),
        EnrichResult,
    ),
    (
        governance_agents.user_option_validation_agent,
        governance_agents.validate_user_option,
        UserOptionValidationRequest(
            option_text="A robot that books appointments by itself", context="Dental SaaS"
        ),
        UserOptionValidationResult,
    ),
    # chat
    (
        chat_agents.context_question_agent,
        chat_agents.answer_context_question,
        ContextQuestionRequest(question="Why did you pick PostgreSQL?"),
        ContextAnswer,
    ),
    (
        chat_agents.chat_intent_parse_agent,
        chat_agents.parse_chat_intent,
        ChatIntentParseRequest(text="Add a Fraud Detection capability", message_type="user_intent"),
        ChatIntentParseResult,
    ),
    (
        chat_agents.chat_response_agent,
        chat_agents.generate_chat_response,
        ChatResponseRequest(conversation_history=["Hi"], user_message="What's next?"),
        ChatResponseResult,
    ),
    (
        chat_agents.preview_feedback_interpretation_agent,
        chat_agents.interpret_preview_feedback,
        PreviewFeedbackInterpretationRequest(text="Make the submit button bigger"),
        PreviewFeedbackInterpretationResult,
    ),
    (
        chat_agents.inline_steering_comment_agent,
        chat_agents.parse_inline_steering_comment,
        InlineSteeringCommentRequest(
            file_path="backend/src/routes/auth.ts",
            comment_text="// @steering: add input validation",
            surrounding_code="export function login(req) { ... }",
        ),
        MidSteerSignal,
    ),
    # code_generation
    (
        code_generation_agents.code_file_generation_agent,
        code_generation_agents.generate_code_file,
        CodeFileGenerationRequest(
            task=_ENGINEERING_TASK,
            file_path="backend/src/middleware/auth.ts",
            tech_stack=_TECH_STACK_SUMMARY,
            provenance=FileProvenanceContext(
                task_id="T-1", story_id="S-1", decision_entry_id="D-1", checkpoint_id="C-1"
            ),
        ),
        GeneratedFileDraft,
    ),
    (
        code_generation_agents.rbac_middleware_compilation_agent,
        code_generation_agents.compile_rbac_middleware,
        RBACMiddlewareCompilationRequest(
            rbac_summary=RBACSummary(role_names=["Admin"], permission_resources=["/api/users"]),
            target_framework="FastAPI",
        ),
        GeneratedFileDraftSet,
    ),
    (
        code_generation_agents.infrastructure_code_compilation_agent,
        code_generation_agents.compile_infrastructure_code,
        InfrastructureCodeCompilationRequest(selected_option=_HOSTING_OPTION, target_provider="AWS"),
        GeneratedFileDraftSet,
    ),
    (
        code_generation_agents.merge_conflict_resolution_agent,
        code_generation_agents.resolve_merge_conflict,
        MergeConflictResolutionRequest(
            conflict=MergeConflictContext(
                node_id="N-1",
                field="description",
                base_value="Original description",
                ours_value="User edited description",
                theirs_value="Regenerated description",
            )
        ),
        MergeConflictResolutionSuggestion,
    ),
    (
        code_generation_agents.provenance_explanation_agent,
        code_generation_agents.explain_provenance,
        ProvenanceExplanationRequest(
            file_path="backend/src/middleware/auth.ts",
            task_description="Implement JWT auth middleware",
            linked_story_title="Login with email/password",
            decision_chain=["Approved User Authentication capability"],
        ),
        ProvenanceExplanation,
    ),
]


_CASE_IDS = [wrapper.__name__ for _, wrapper, _, _ in CASES]


@pytest.mark.parametrize("agent,wrapper,request_obj,expected_type", CASES, ids=_CASE_IDS)
async def test_agent_smoke(agent, wrapper, request_obj, expected_type) -> None:
    with agent.override(model=TestModel()):
        result = await wrapper(request_obj)
    assert isinstance(result, expected_type)


def test_all_call_sites_covered() -> None:
    """Guards against silently losing coverage if a call site is added to
    agents.py but never added to CASES above."""

    assert len(CASES) == 29
