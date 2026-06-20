"""CRUD round-trip tests for shared_kernel/infrastructure/in_memory.py."""

from bluebox.modules.chat.domain.chat_message import ChatMessage
from bluebox.modules.code_generation.domain.workspace import (
    FileProvenance,
    GeneratedFile,
    WorkspaceManifest,
)
from bluebox.modules.core_pipeline.domain.project import Project
from bluebox.shared_kernel.domain.audit import (
    AuditActor,
    AuditEvent,
    AuditTarget,
    Checkpoint,
    DecisionEntry,
    DecisionEntryMetadata,
    ProvenanceChain,
)
from bluebox.shared_kernel.domain.node import ActorNode, NodeProvenance
from bluebox.shared_kernel.infrastructure.in_memory import (
    InMemoryAuditTrailRepository,
    InMemoryChatRepository,
    InMemoryCheckpointRepository,
    InMemoryDecisionLedgerRepository,
    InMemoryNodeRepository,
    InMemoryProjectRepository,
    InMemorySessionRepository,
    InMemoryWorkspaceRepository,
)


def test_project_repository_crud() -> None:
    repo = InMemoryProjectRepository()
    project = Project(project_id="P-1", project_name="Dental SaaS", owner_id="user-1")
    repo.create(project)
    assert repo.get("P-1") == project
    assert repo.list() == [project]
    repo.delete("P-1")
    assert repo.get("P-1") is None


def test_node_repository_crud_and_stage_filter() -> None:
    repo = InMemoryNodeRepository()
    node = ActorNode(
        node_id="ACT-1", name="Patient", description="End user", layer="Auth",
        risk_classification="LOW_RISK", status="SYSTEM_GENERATED", created_by="system",
        provenance=NodeProvenance(generated_at_stage=2, decision_entry_id="DEC-1", checkpoint_id="CKPT-1"),
    )
    repo.add("P-1", node)
    assert repo.get("P-1", "ACT-1") == node
    assert repo.list_by_project("P-1") == [node]
    assert repo.list_by_stage("P-1", 2) == [node]
    assert repo.list_by_stage("P-1", 3) == []


def test_session_repository_get_or_create_is_idempotent() -> None:
    repo = InMemorySessionRepository()
    first = repo.get_or_create("P-1")
    second = repo.get_or_create("P-1")
    assert first is second
    assert first.current_state == "INITIALIZED"


def test_decision_ledger_repository_append_and_get() -> None:
    repo = InMemoryDecisionLedgerRepository()
    entry = DecisionEntry(
        entry_id="DEC-1", decision_type="steering", stage=1, stage_name="Actor Discovery",
        summary="Approved Patient actor",
        provenance=ProvenanceChain(trigger_event="STEERING_ACTION", context_snapshot_id="CTX-1"),
        metadata=DecisionEntryMetadata(
            layer="Auth", risk_classification="LOW_RISK", auto_approved=True, trust_mode_at_decision="BALANCED"
        ),
        created_by="user-1",
    )
    repo.append("P-1", entry)
    assert repo.list("P-1") == [entry]
    assert repo.get("P-1", "DEC-1") == entry
    assert repo.get("P-1", "DEC-missing") is None


def test_audit_trail_repository_append_and_list() -> None:
    repo = InMemoryAuditTrailRepository()
    event = AuditEvent(
        event_id="AUD-1", session_id="sess-1", actor=AuditActor(user_id="user-1", role="architect"),
        action="steering", target=AuditTarget(target_type="actor", target_id="ACT-1"),
        description="Approved Patient actor",
    )
    repo.append("P-1", event)
    assert repo.list("P-1") == [event]


def test_chat_repository_append_and_list() -> None:
    repo = InMemoryChatRepository()
    message = ChatMessage(message_id="msg-1", message_type="user_intent", sender="user", content="Hi")
    repo.append("P-1", message)
    assert repo.list("P-1") == [message]


def test_checkpoint_repository_create_get_list() -> None:
    repo = InMemoryCheckpointRepository()
    checkpoint = Checkpoint(
        checkpoint_id="CKPT-1", stage=1, stage_name="Actor Discovery", label="auto",
        current_state="AWAITING_STEERING", decision_ledger_snapshot=[], created_by="system",
    )
    repo.create("P-1", checkpoint)
    assert repo.list("P-1") == [checkpoint]
    assert repo.get("P-1", "CKPT-1") == checkpoint


def test_workspace_repository_files_and_manifest() -> None:
    repo = InMemoryWorkspaceRepository()
    generated_file = GeneratedFile(
        file_path="backend/src/middleware/auth.ts", content="export const auth = () => {};",
        content_hash="sha256:abc", size_bytes=30, layer="Backend", task_id="TASK-1",
        provenance=FileProvenance(task_id="TASK-1", story_id="STORY-1", decision_entry_id="DEC-1", checkpoint_id="CKPT-1"),
        language="typescript",
    )
    repo.save_file("P-1", generated_file)
    assert repo.list_files("P-1") == [generated_file]

    manifest = WorkspaceManifest(project_id="P-1", files=[generated_file.file_path], run_command="npm run dev")
    repo.save_manifest("P-1", manifest)
    assert repo.get_manifest("P-1") == manifest
