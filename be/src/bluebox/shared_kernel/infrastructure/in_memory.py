"""In-memory adapters satisfying shared_kernel/ports.py.

Same spirit as mock_server.py's `db` dict, but typed and behind the port
Protocols, so a Postgres/S3 adapter is a clean follow-up swap that never
touches application code. Still used directly by application-layer unit
tests (e.g. test_advisory_application.py constructs `ScalingService` with
an `InMemoryInfrastructureProfileRepository` for isolated, no-disk tests) -
kept around for that even though `AppState` below no longer defaults to
these.

`AppState`/`app_state` now wires the SQLite-backed adapters in
`sqlite_backend.py` instead, so project state survives a backend restart
(`uvicorn --reload` included) - the dict-based classes above were losing
data on every reload, which is what prompted the swap. `AppState` stays in
this file (rather than moving to `sqlite_backend.py`) purely so every
existing `from .in_memory import app_state` call site keeps working
unchanged.
"""

from bluebox.modules.advisory.scaling.domain.infrastructure_profile import InfrastructureProfile
from bluebox.modules.advisory.tech_stack.domain.tech_stack_profile import TechStackProfile
from bluebox.modules.chat.domain.chat_message import ChatMessage
from bluebox.modules.code_generation.domain.workspace import GeneratedFile, WorkspaceManifest
from bluebox.modules.core_pipeline.domain.project import Project
from bluebox.modules.core_pipeline.domain.state_machine import PipelineOrchestrator
from bluebox.shared_kernel.domain.audit import AuditEvent, Checkpoint, DecisionEntry
from bluebox.shared_kernel.domain.node import Node
from bluebox.shared_kernel.domain.rbac import RBACModel
from bluebox.shared_kernel.infrastructure.sqlite_backend import (
    DBSettings,
    SqliteAuditTrailRepository,
    SqliteCheckpointRepository,
    SqliteChatRepository,
    SqliteDecisionLedgerRepository,
    SqliteInfrastructureProfileRepository,
    SqliteNodeRepository,
    SqlitePendingDict,
    SqliteProjectRepository,
    SqliteRBACModelRepository,
    SqliteSessionRepository,
    SqliteTechStackProfileRepository,
    SqliteWorkspaceRepository,
    init_schema,
)


class InMemoryProjectRepository:
    def __init__(self) -> None:
        self._projects: dict[str, Project] = {}

    def create(self, project: Project) -> Project:
        self._projects[project.project_id] = project
        return project

    def get(self, project_id: str) -> Project | None:
        return self._projects.get(project_id)

    def list(self) -> list[Project]:
        return list(self._projects.values())

    def delete(self, project_id: str) -> None:
        self._projects.pop(project_id, None)


class InMemoryNodeRepository:
    def __init__(self) -> None:
        self._nodes: dict[str, dict[str, Node]] = {}

    def add(self, project_id: str, node: Node) -> None:
        self._nodes.setdefault(project_id, {})[node.node_id] = node

    def get(self, project_id: str, node_id: str) -> Node | None:
        return self._nodes.get(project_id, {}).get(node_id)

    def list_by_project(self, project_id: str) -> list[Node]:
        return list(self._nodes.get(project_id, {}).values())

    def list_by_stage(self, project_id: str, stage: int) -> list[Node]:
        return [
            node
            for node in self.list_by_project(project_id)
            if node.provenance.generated_at_stage == stage
        ]


class InMemorySessionRepository:
    def __init__(self) -> None:
        self._sessions: dict[str, PipelineOrchestrator] = {}

    def get_or_create(self, project_id: str) -> PipelineOrchestrator:
        if project_id not in self._sessions:
            self._sessions[project_id] = PipelineOrchestrator(current_state="INITIALIZED")
        return self._sessions[project_id]

    def save(self, project_id: str, orchestrator: PipelineOrchestrator) -> None:
        self._sessions[project_id] = orchestrator


class InMemoryDecisionLedgerRepository:
    def __init__(self) -> None:
        self._entries: dict[str, list[DecisionEntry]] = {}

    def append(self, project_id: str, entry: DecisionEntry) -> None:
        self._entries.setdefault(project_id, []).append(entry)

    def list(self, project_id: str) -> list[DecisionEntry]:
        return list(self._entries.get(project_id, []))

    def get(self, project_id: str, entry_id: str) -> DecisionEntry | None:
        return next(
            (entry for entry in self._entries.get(project_id, []) if entry.entry_id == entry_id),
            None,
        )


class InMemoryAuditTrailRepository:
    def __init__(self) -> None:
        self._events: dict[str, list[AuditEvent]] = {}

    def append(self, project_id: str, event: AuditEvent) -> None:
        self._events.setdefault(project_id, []).append(event)

    def list(self, project_id: str) -> list[AuditEvent]:
        return list(self._events.get(project_id, []))


class InMemoryChatRepository:
    def __init__(self) -> None:
        self._messages: dict[str, list[ChatMessage]] = {}

    def append(self, project_id: str, message: ChatMessage) -> None:
        self._messages.setdefault(project_id, []).append(message)

    def list(self, project_id: str) -> list[ChatMessage]:
        return list(self._messages.get(project_id, []))

    def delete(self, project_id: str, message_id: str) -> bool:
        messages = self._messages.get(project_id, [])
        for index, message in enumerate(messages):
            if message.message_id == message_id:
                del messages[index]
                return True
        return False


class InMemoryCheckpointRepository:
    def __init__(self) -> None:
        self._checkpoints: dict[str, list[Checkpoint]] = {}

    def create(self, project_id: str, checkpoint: Checkpoint) -> None:
        self._checkpoints.setdefault(project_id, []).append(checkpoint)

    def list(self, project_id: str) -> list[Checkpoint]:
        return list(self._checkpoints.get(project_id, []))

    def get(self, project_id: str, checkpoint_id: str) -> Checkpoint | None:
        return next(
            (
                checkpoint
                for checkpoint in self._checkpoints.get(project_id, [])
                if checkpoint.checkpoint_id == checkpoint_id
            ),
            None,
        )


class InMemoryWorkspaceRepository:
    def __init__(self) -> None:
        self._files: dict[str, dict[str, GeneratedFile]] = {}
        self._manifests: dict[str, WorkspaceManifest] = {}

    def save_file(self, project_id: str, generated_file: GeneratedFile) -> None:
        self._files.setdefault(project_id, {})[generated_file.file_path] = generated_file

    def list_files(self, project_id: str) -> list[GeneratedFile]:
        return list(self._files.get(project_id, {}).values())

    def save_manifest(self, project_id: str, manifest: WorkspaceManifest) -> None:
        self._manifests[project_id] = manifest

    def get_manifest(self, project_id: str) -> WorkspaceManifest | None:
        return self._manifests.get(project_id)


class InMemoryInfrastructureProfileRepository:
    def __init__(self) -> None:
        self._profiles: dict[str, InfrastructureProfile] = {}

    def save(self, project_id: str, profile: InfrastructureProfile) -> None:
        self._profiles[project_id] = profile

    def get(self, project_id: str) -> InfrastructureProfile | None:
        return self._profiles.get(project_id)


class InMemoryTechStackProfileRepository:
    def __init__(self) -> None:
        self._profiles: dict[str, TechStackProfile] = {}

    def save(self, project_id: str, profile: TechStackProfile) -> None:
        self._profiles[project_id] = profile

    def get(self, project_id: str) -> TechStackProfile | None:
        return self._profiles.get(project_id)


class InMemoryRBACModelRepository:
    def __init__(self) -> None:
        self._models: dict[str, RBACModel] = {}

    def save(self, project_id: str, model: RBACModel) -> None:
        self._models[project_id] = model

    def get(self, project_id: str) -> RBACModel | None:
        return self._models.get(project_id)


class AppState:
    """Process-wide bundle of every repository. FastAPI dependencies
    (`interfaces/api/deps.py`) pull from one shared instance so every
    router/service sees the same data. SQLite-backed (see module
    docstring) - `BLUEBOX_DB_PATH` controls where."""

    def __init__(self) -> None:
        db_path = DBSettings().path
        init_schema(db_path)
        self.projects = SqliteProjectRepository(db_path)
        self.nodes = SqliteNodeRepository(db_path)
        self.sessions = SqliteSessionRepository(db_path)
        self.decisions = SqliteDecisionLedgerRepository(db_path)
        self.audit = SqliteAuditTrailRepository(db_path)
        self.chat = SqliteChatRepository(db_path)
        self.checkpoints = SqliteCheckpointRepository(db_path)
        self.workspace = SqliteWorkspaceRepository(db_path)
        # Transient (not a persisted domain entity): the last stage-generation
        # result awaiting a steering decision, keyed by project_id. Not behind
        # a `Protocol` port like the repositories above - this is UI-flow
        # scratch state for the steering REST/WS layer, not business data.
        # Still SQLite-backed (pickled, see sqlite_backend.py) so it survives
        # a restart same as everything else - that's what this swap is for.
        self.pending_candidates: SqlitePendingDict = SqlitePendingDict(db_path, "candidates")
        # Same rationale as `pending_candidates`: last-generated, not-yet-
        # committed advisory options awaiting a selection/commit call.
        self.pending_hosting_options: SqlitePendingDict = SqlitePendingDict(db_path, "hosting_options")
        self.pending_tech_stack_options: SqlitePendingDict = SqlitePendingDict(db_path, "tech_stack_options")
        self.pending_rbac_model: SqlitePendingDict = SqlitePendingDict(db_path, "rbac_model")
        self.infrastructure_profiles = SqliteInfrastructureProfileRepository(db_path)
        self.tech_stack_profiles = SqliteTechStackProfileRepository(db_path)
        self.rbac_models = SqliteRBACModelRepository(db_path)


app_state = AppState()
