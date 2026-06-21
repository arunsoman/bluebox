"""Stage 8 Code Generation application service - doc/prd.md SS4.8.

Converts a committed `EngineeringTaskNode` (anti-corruption-layer domain
entity) into the LLM-boundary `EngineeringTaskCandidate` shape the
`generate_code_file` agent expects, generates each of the task's
`file_paths` one at a time (per that agent's own docstring), and commits
every result to real disk via `WorkspaceManager`.
"""

from collections.abc import Awaitable, Callable

from bluebox.modules.advisory.tech_stack.domain.tech_stack_profile import TechStackProfile
from bluebox.modules.code_generation.application import project_context
from bluebox.modules.code_generation.application.syntax_validator import validate_syntax
from bluebox.modules.code_generation.application.workspace_manager import WorkspaceManager
from bluebox.modules.code_generation.domain.workspace import FileProvenance, GeneratedFile
from bluebox.modules.code_generation.llm import agents as codegen_agents
from bluebox.modules.code_generation.llm.requests import CodeFileGenerationRequest, FileProvenanceContext
from bluebox.modules.core_pipeline.llm.requests import TechStackSummary
from bluebox.modules.core_pipeline.llm.responses import AccessGuard as LLMAccessGuard
from bluebox.modules.core_pipeline.llm.responses import EngineeringTaskCandidate
from bluebox.shared_kernel.domain.node import EngineeringTaskNode

_PYTHON_KEYWORDS = ("python", "fastapi", "django", "flask")

OnFileStart = Callable[[str], Awaitable[None]]


def _to_candidate(task: EngineeringTaskNode) -> EngineeringTaskCandidate:
    return EngineeringTaskCandidate(
        name=task.name,
        description=task.description,
        estimated_hours=task.estimated_hours,
        complexity=task.complexity,
        preconditions=task.preconditions,
        postconditions=task.postconditions,
        file_paths=task.file_paths,
        tech_stack_requirements=task.tech_stack_requirements,
        database_schema_changes=task.database_schema_changes,
        access_guards=[LLMAccessGuard(**guard.model_dump()) for guard in task.access_guards],
        parent_story_id=task.parent_story_id,
    )


def _tech_stack_summary(profile: TechStackProfile) -> TechStackSummary:
    return TechStackSummary(
        frontend_framework=profile.frontend.framework,
        backend_framework=profile.backend.framework,
        database=profile.database.framework,
    )


def infer_commands(profile: TechStackProfile) -> tuple[str, str, str | None]:
    """Best-effort heuristic - neither spec doc specifies how `run_command`/
    `test_command`/`build_command` are derived from a `TechStackProfile`.
    Branches on `backend.language` since that's the most reliable signal of
    which runtime actually executes the generated app."""

    if profile.backend.language.lower() in _PYTHON_KEYWORDS:
        return "python -m uvicorn main:app --host 0.0.0.0 --port 8000", "pytest", None
    return "npm run dev", "npm test", "npm run build"


class CodeGenService:
    def __init__(self, workspace: WorkspaceManager) -> None:
        self._workspace = workspace

    async def generate_task_files(
        self,
        project_id: str,
        task: EngineeringTaskNode,
        tech_stack: TechStackProfile,
        *,
        decision_entry_id: str,
        checkpoint_id: str,
        on_file_start: OnFileStart | None = None,
    ) -> list[GeneratedFile]:
        candidate = _to_candidate(task)
        summary = _tech_stack_summary(tech_stack)
        provenance_context = FileProvenanceContext(
            task_id=task.node_id,
            story_id=task.parent_story_id,
            decision_entry_id=decision_entry_id,
            checkpoint_id=checkpoint_id,
        )

        generated: list[GeneratedFile] = []
        for file_path in task.file_paths:
            if on_file_start is not None:
                await on_file_start(file_path)
            existing_files = self._workspace.list_files(project_id)
            existing_files_context = project_context.build_existing_files_context(existing_files, file_path)
            draft = await codegen_agents.generate_code_file(
                CodeFileGenerationRequest(
                    task=candidate,
                    file_path=file_path,
                    tech_stack=summary,
                    provenance=provenance_context,
                    existing_files_context=existing_files_context,
                )
            )
            validate_syntax(draft.file_path, draft.content)
            generated.append(
                self._workspace.write(
                    project_id,
                    draft.file_path,
                    draft.content,
                    layer=task.layer,
                    task_id=task.node_id,
                    language=draft.language,
                    provenance=FileProvenance(
                        task_id=task.node_id,
                        story_id=task.parent_story_id,
                        decision_entry_id=decision_entry_id,
                        checkpoint_id=checkpoint_id,
                    ),
                )
            )

        run_command, test_command, build_command = infer_commands(tech_stack)
        self._workspace.build_manifest(
            project_id, run_command=run_command, test_command=test_command, build_command=build_command
        )
        return generated
