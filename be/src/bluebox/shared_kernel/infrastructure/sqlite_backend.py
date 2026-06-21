"""SQLite-backed adapters satisfying shared_kernel/ports.py - the "for now"
durable replacement for in_memory.py's dict-based ones, so project state
(and the pending_* advisory scratch state below) survives a backend
restart (`uvicorn --reload` included) instead of vanishing mid-session.

Every repository here is a thin adapter: one SQLite table holding the
domain model's `model_dump_json()`, keyed by whatever the Protocol's own
methods key on, reconstructed via `model_validate_json()` on read. A fresh
`sqlite3.connect()` per call (not one held-open connection) deliberately
trades a little overhead for never having to reason about sharing a
connection object across FastAPI's sync-route threadpool.

`pending_state` is the one table that isn't a clean model_dump_json() store:
the four `AppState.pending_*` slots hold whatever a stage executor/advisory
service produced last - sometimes a typed matrix, sometimes (`pending_candidates`,
see `interfaces/api/routers/steering.py`) a genuinely untyped `Any` - so it's
`pickle`d instead of JSON-encoded. That's fine here specifically: this data
never leaves the process (it's written and read back by this same backend,
never serialized to a client), so pickle's usual "don't unpickle untrusted
data" caveat doesn't apply.
"""

import pickle
import sqlite3
from collections.abc import Iterator, MutableMapping
from contextlib import contextmanager
from pathlib import Path
from typing import Any, TypeVar

from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict

from bluebox.modules.advisory.scaling.domain.infrastructure_profile import InfrastructureProfile
from bluebox.modules.advisory.tech_stack.domain.tech_stack_profile import TechStackProfile
from bluebox.modules.chat.domain.chat_message import ChatMessage
from bluebox.modules.code_generation.domain.workspace import GeneratedFile, WorkspaceManifest
from bluebox.modules.core_pipeline.domain.project import Project
from bluebox.modules.core_pipeline.domain.state_machine import PipelineOrchestrator
from bluebox.shared_kernel.domain.audit import AuditEvent, Checkpoint, DecisionEntry
from bluebox.shared_kernel.domain.node import Node, NodeAdapter
from bluebox.shared_kernel.domain.rbac import RBACModel

M = TypeVar("M", bound=BaseModel)


class DBSettings(BaseSettings):
    """`BLUEBOX_DB_PATH` - see `.env.example`. Relative paths resolve
    against whatever directory the process was started from (same
    convention as `WorkspaceSettings.root`)."""

    model_config = SettingsConfigDict(env_prefix="BLUEBOX_DB_")

    path: Path = Path(".bluebox.db")


_SCHEMA = """
CREATE TABLE IF NOT EXISTS projects (project_id TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (project_id TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS nodes (
    project_id TEXT NOT NULL, node_id TEXT NOT NULL, data TEXT NOT NULL,
    PRIMARY KEY (project_id, node_id)
);
CREATE TABLE IF NOT EXISTS decisions (
    project_id TEXT NOT NULL, entry_id TEXT NOT NULL, data TEXT NOT NULL,
    PRIMARY KEY (project_id, entry_id)
);
CREATE TABLE IF NOT EXISTS audit_events (
    project_id TEXT NOT NULL, event_id TEXT NOT NULL, data TEXT NOT NULL,
    PRIMARY KEY (project_id, event_id)
);
CREATE TABLE IF NOT EXISTS chat_messages (
    project_id TEXT NOT NULL, message_id TEXT NOT NULL, data TEXT NOT NULL,
    PRIMARY KEY (project_id, message_id)
);
CREATE TABLE IF NOT EXISTS checkpoints (
    project_id TEXT NOT NULL, checkpoint_id TEXT NOT NULL, data TEXT NOT NULL,
    PRIMARY KEY (project_id, checkpoint_id)
);
CREATE TABLE IF NOT EXISTS workspace_files (
    project_id TEXT NOT NULL, file_path TEXT NOT NULL, data TEXT NOT NULL,
    PRIMARY KEY (project_id, file_path)
);
CREATE TABLE IF NOT EXISTS workspace_manifests (project_id TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS infrastructure_profiles (project_id TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS tech_stack_profiles (project_id TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS rbac_models (project_id TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS pending_state (
    slot TEXT NOT NULL, project_id TEXT NOT NULL, data BLOB NOT NULL,
    PRIMARY KEY (slot, project_id)
);
"""


def init_schema(db_path: Path) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with _session(db_path) as conn:
        conn.executescript(_SCHEMA)


@contextmanager
def _session(db_path: Path) -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(db_path, check_same_thread=False, timeout=10)
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


# table/column names below are always our own hardcoded literals, never
# request-derived - f-string interpolation here is not a SQL-injection risk.


def _get_one(db_path: Path, table: str, project_id: str, model: type[M]) -> M | None:
    with _session(db_path) as conn:
        row = conn.execute(f"SELECT data FROM {table} WHERE project_id = ?", (project_id,)).fetchone()  # noqa: S608
    return model.model_validate_json(row[0]) if row else None


def _save_one(db_path: Path, table: str, project_id: str, instance: BaseModel) -> None:
    with _session(db_path) as conn:
        conn.execute(
            f"INSERT INTO {table} (project_id, data) VALUES (?, ?) "  # noqa: S608
            "ON CONFLICT(project_id) DO UPDATE SET data = excluded.data",
            (project_id, instance.model_dump_json()),
        )


def _list_many(db_path: Path, table: str, project_id: str, model: type[M]) -> list[M]:
    with _session(db_path) as conn:
        rows = conn.execute(  # noqa: S608
            f"SELECT data FROM {table} WHERE project_id = ? ORDER BY rowid", (project_id,)
        ).fetchall()
    return [model.model_validate_json(r[0]) for r in rows]


def _append_many(db_path: Path, table: str, key_col: str, project_id: str, key_val: str, instance: BaseModel) -> None:
    with _session(db_path) as conn:
        conn.execute(
            f"INSERT INTO {table} (project_id, {key_col}, data) VALUES (?, ?, ?) "  # noqa: S608
            f"ON CONFLICT(project_id, {key_col}) DO UPDATE SET data = excluded.data",
            (project_id, key_val, instance.model_dump_json()),
        )


class SqliteProjectRepository:
    def __init__(self, db_path: Path) -> None:
        self._db_path = db_path

    def create(self, project: Project) -> Project:
        _save_one(self._db_path, "projects", project.project_id, project)
        return project

    def get(self, project_id: str) -> Project | None:
        return _get_one(self._db_path, "projects", project_id, Project)

    def list(self) -> list[Project]:
        with _session(self._db_path) as conn:
            rows = conn.execute("SELECT data FROM projects ORDER BY rowid").fetchall()
        return [Project.model_validate_json(r[0]) for r in rows]

    def delete(self, project_id: str) -> None:
        with _session(self._db_path) as conn:
            conn.execute("DELETE FROM projects WHERE project_id = ?", (project_id,))


class SqliteNodeRepository:
    def __init__(self, db_path: Path) -> None:
        self._db_path = db_path

    def add(self, project_id: str, node: Node) -> None:
        _append_many(self._db_path, "nodes", "node_id", project_id, node.node_id, node)

    def get(self, project_id: str, node_id: str) -> Node | None:
        with _session(self._db_path) as conn:
            row = conn.execute(
                "SELECT data FROM nodes WHERE project_id = ? AND node_id = ?", (project_id, node_id)
            ).fetchone()
        return NodeAdapter.validate_json(row[0]) if row else None

    def list_by_project(self, project_id: str) -> list[Node]:
        with _session(self._db_path) as conn:
            rows = conn.execute(
                "SELECT data FROM nodes WHERE project_id = ? ORDER BY rowid", (project_id,)
            ).fetchall()
        return [NodeAdapter.validate_json(r[0]) for r in rows]

    def list_by_stage(self, project_id: str, stage: int) -> list[Node]:
        return [n for n in self.list_by_project(project_id) if n.provenance.generated_at_stage == stage]


class SqliteSessionRepository:
    def __init__(self, db_path: Path) -> None:
        self._db_path = db_path

    def get_or_create(self, project_id: str) -> PipelineOrchestrator:
        existing = _get_one(self._db_path, "sessions", project_id, PipelineOrchestrator)
        if existing is not None:
            return existing
        orchestrator = PipelineOrchestrator(current_state="INITIALIZED")
        self.save(project_id, orchestrator)
        return orchestrator

    def save(self, project_id: str, orchestrator: PipelineOrchestrator) -> None:
        _save_one(self._db_path, "sessions", project_id, orchestrator)


class SqliteDecisionLedgerRepository:
    def __init__(self, db_path: Path) -> None:
        self._db_path = db_path

    def append(self, project_id: str, entry: DecisionEntry) -> None:
        _append_many(self._db_path, "decisions", "entry_id", project_id, entry.entry_id, entry)

    def list(self, project_id: str) -> list[DecisionEntry]:
        return _list_many(self._db_path, "decisions", project_id, DecisionEntry)

    def get(self, project_id: str, entry_id: str) -> DecisionEntry | None:
        with _session(self._db_path) as conn:
            row = conn.execute(
                "SELECT data FROM decisions WHERE project_id = ? AND entry_id = ?", (project_id, entry_id)
            ).fetchone()
        return DecisionEntry.model_validate_json(row[0]) if row else None


class SqliteAuditTrailRepository:
    def __init__(self, db_path: Path) -> None:
        self._db_path = db_path

    def append(self, project_id: str, event: AuditEvent) -> None:
        _append_many(self._db_path, "audit_events", "event_id", project_id, event.event_id, event)

    def list(self, project_id: str) -> list[AuditEvent]:
        return _list_many(self._db_path, "audit_events", project_id, AuditEvent)


class SqliteChatRepository:
    def __init__(self, db_path: Path) -> None:
        self._db_path = db_path

    def append(self, project_id: str, message: ChatMessage) -> None:
        _append_many(self._db_path, "chat_messages", "message_id", project_id, message.message_id, message)

    def list(self, project_id: str) -> list[ChatMessage]:
        return _list_many(self._db_path, "chat_messages", project_id, ChatMessage)

    def delete(self, project_id: str, message_id: str) -> bool:
        with _session(self._db_path) as conn:
            cur = conn.execute(
                "DELETE FROM chat_messages WHERE project_id = ? AND message_id = ?", (project_id, message_id)
            )
        return cur.rowcount > 0


class SqliteCheckpointRepository:
    def __init__(self, db_path: Path) -> None:
        self._db_path = db_path

    def create(self, project_id: str, checkpoint: Checkpoint) -> None:
        _append_many(
            self._db_path, "checkpoints", "checkpoint_id", project_id, checkpoint.checkpoint_id, checkpoint
        )

    def list(self, project_id: str) -> list[Checkpoint]:
        return _list_many(self._db_path, "checkpoints", project_id, Checkpoint)

    def get(self, project_id: str, checkpoint_id: str) -> Checkpoint | None:
        with _session(self._db_path) as conn:
            row = conn.execute(
                "SELECT data FROM checkpoints WHERE project_id = ? AND checkpoint_id = ?",
                (project_id, checkpoint_id),
            ).fetchone()
        return Checkpoint.model_validate_json(row[0]) if row else None


class SqliteWorkspaceRepository:
    def __init__(self, db_path: Path) -> None:
        self._db_path = db_path

    def save_file(self, project_id: str, generated_file: GeneratedFile) -> None:
        _append_many(
            self._db_path, "workspace_files", "file_path", project_id, generated_file.file_path, generated_file
        )

    def list_files(self, project_id: str) -> list[GeneratedFile]:
        return _list_many(self._db_path, "workspace_files", project_id, GeneratedFile)

    def save_manifest(self, project_id: str, manifest: WorkspaceManifest) -> None:
        _save_one(self._db_path, "workspace_manifests", project_id, manifest)

    def get_manifest(self, project_id: str) -> WorkspaceManifest | None:
        return _get_one(self._db_path, "workspace_manifests", project_id, WorkspaceManifest)


class SqliteInfrastructureProfileRepository:
    def __init__(self, db_path: Path) -> None:
        self._db_path = db_path

    def save(self, project_id: str, profile: InfrastructureProfile) -> None:
        _save_one(self._db_path, "infrastructure_profiles", project_id, profile)

    def get(self, project_id: str) -> InfrastructureProfile | None:
        return _get_one(self._db_path, "infrastructure_profiles", project_id, InfrastructureProfile)


class SqliteTechStackProfileRepository:
    def __init__(self, db_path: Path) -> None:
        self._db_path = db_path

    def save(self, project_id: str, profile: TechStackProfile) -> None:
        _save_one(self._db_path, "tech_stack_profiles", project_id, profile)

    def get(self, project_id: str) -> TechStackProfile | None:
        return _get_one(self._db_path, "tech_stack_profiles", project_id, TechStackProfile)


class SqliteRBACModelRepository:
    def __init__(self, db_path: Path) -> None:
        self._db_path = db_path

    def save(self, project_id: str, model: RBACModel) -> None:
        _save_one(self._db_path, "rbac_models", project_id, model)

    def get(self, project_id: str) -> RBACModel | None:
        return _get_one(self._db_path, "rbac_models", project_id, RBACModel)


class SqlitePendingDict(MutableMapping[str, Any]):
    """Backs one `AppState.pending_*` scratch slot - see module docstring
    for why this is pickle-backed rather than the JSON pattern above."""

    def __init__(self, db_path: Path, slot: str) -> None:
        self._db_path = db_path
        self._slot = slot

    def __getitem__(self, project_id: str) -> Any:
        with _session(self._db_path) as conn:
            row = conn.execute(
                "SELECT data FROM pending_state WHERE slot = ? AND project_id = ?", (self._slot, project_id)
            ).fetchone()
        if row is None:
            raise KeyError(project_id)
        return pickle.loads(row[0])  # noqa: S301 - see module docstring, never untrusted/external data

    def __setitem__(self, project_id: str, value: Any) -> None:
        with _session(self._db_path) as conn:
            conn.execute(
                "INSERT INTO pending_state (slot, project_id, data) VALUES (?, ?, ?) "
                "ON CONFLICT(slot, project_id) DO UPDATE SET data = excluded.data",
                (self._slot, project_id, pickle.dumps(value)),
            )

    def __delitem__(self, project_id: str) -> None:
        with _session(self._db_path) as conn:
            cur = conn.execute(
                "DELETE FROM pending_state WHERE slot = ? AND project_id = ?", (self._slot, project_id)
            )
        if cur.rowcount == 0:
            raise KeyError(project_id)

    def __contains__(self, project_id: object) -> bool:
        with _session(self._db_path) as conn:
            row = conn.execute(
                "SELECT 1 FROM pending_state WHERE slot = ? AND project_id = ?", (self._slot, project_id)
            ).fetchone()
        return row is not None

    def __iter__(self) -> Iterator[str]:
        with _session(self._db_path) as conn:
            rows = conn.execute("SELECT project_id FROM pending_state WHERE slot = ?", (self._slot,)).fetchall()
        return iter([r[0] for r in rows])

    def __len__(self) -> int:
        with _session(self._db_path) as conn:
            row = conn.execute(
                "SELECT COUNT(*) FROM pending_state WHERE slot = ?", (self._slot,)
            ).fetchone()
        return row[0]
