"""Real on-disk workspace writes - doc/prd.md SS4.8 WorkspaceManager.

Per the confirmed scope for this pass, generated files are written to real
disk under `WORKSPACE_ROOT/{project_id}/...` (not just held in memory) -
`content_hash`/`size_bytes` are computed here from the actual written bytes,
never asked of the LLM (same principle as `GeneratedFileDraft`, pass 2).
"""

import hashlib
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

from bluebox.modules.code_generation.domain.workspace import (
    FileProvenance,
    GeneratedFile,
    WorkspaceManifest,
)
from bluebox.shared_kernel.ports import WorkspaceRepository


class WorkspaceSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="BLUEBOX_WORKSPACE_")

    root: Path = Path(".workspaces")


class PathEscapeError(Exception):
    """Raised when a `file_path` would write outside the project's workspace
    directory (e.g. via `../../etc/passwd`) - never trust LLM-generated
    paths to stay inside their sandbox."""

    def __init__(self, file_path: str) -> None:
        super().__init__(f"file_path {file_path!r} escapes the project workspace")


class WorkspaceManager:
    def __init__(self, workspace_repo: WorkspaceRepository, *, root: Path | None = None) -> None:
        self._workspace_repo = workspace_repo
        self._root = root if root is not None else WorkspaceSettings().root

    def _resolve_path(self, project_id: str, file_path: str) -> Path:
        project_root = (self._root / project_id).resolve()
        resolved = (project_root / file_path).resolve()
        if project_root not in resolved.parents and resolved != project_root:
            raise PathEscapeError(file_path)
        return resolved

    def write(
        self,
        project_id: str,
        file_path: str,
        content: str,
        *,
        layer: str,
        task_id: str,
        language: str,
        provenance: FileProvenance,
    ) -> GeneratedFile:
        absolute_path = self._resolve_path(project_id, file_path)
        absolute_path.parent.mkdir(parents=True, exist_ok=True)
        absolute_path.write_text(content)

        generated_file = GeneratedFile(
            file_path=file_path,
            content=content,
            content_hash=hashlib.sha256(content.encode()).hexdigest(),
            size_bytes=len(content.encode()),
            layer=layer,
            task_id=task_id,
            provenance=provenance,
            language=language,
        )
        self._workspace_repo.save_file(project_id, generated_file)
        return generated_file

    def build_manifest(
        self,
        project_id: str,
        *,
        run_command: str,
        test_command: str | None = None,
        build_command: str | None = None,
    ) -> WorkspaceManifest:
        files = self._workspace_repo.list_files(project_id)
        manifest = WorkspaceManifest(
            project_id=project_id,
            files=[f.file_path for f in files],
            run_command=run_command,
            test_command=test_command,
            build_command=build_command,
        )
        self._workspace_repo.save_manifest(project_id, manifest)
        return manifest

    def workspace_dir(self, project_id: str) -> Path:
        return (self._root / project_id).resolve()
