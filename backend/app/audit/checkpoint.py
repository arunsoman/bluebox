"""CheckpointManager — immutable snapshots at stage boundaries."""

from __future__ import annotations

import gzip
import json
import logging
from uuid import uuid4

from app.domain.models import utcnow

logger = logging.getLogger(__name__)


class CheckpointManager:
    """Immutable snapshots at stage boundaries."""

    def __init__(self, blob_store=None):
        self.blob_store = blob_store  # S3/MinIO client
        self._checkpoints: dict[str, list[str]] = {}  # project_id -> checkpoint_ids

    async def create(self, orchestrator) -> str:
        checkpoint_id = str(uuid4())
        snapshot = {
            "checkpoint_id": checkpoint_id,
            "project_id": orchestrator.project_id,
            "stage": orchestrator.current_stage,
            "state": orchestrator.state.value,
            "blueprint": orchestrator.blueprint.model_dump(),
            "ledger": orchestrator.ledger.model_dump(),
            "timestamp": utcnow().isoformat(),
        }
        key = f"checkpoints/{orchestrator.project_id}/{checkpoint_id}.json.gz"
        data = gzip.compress(json.dumps(snapshot, default=str).encode())
        if self.blob_store:
            await self.blob_store.put(key, data)
        self._checkpoints.setdefault(orchestrator.project_id, []).append(checkpoint_id)
        return checkpoint_id

    async def restore(self, project_id: str, checkpoint_id: str) -> dict:
        key = f"checkpoints/{project_id}/{checkpoint_id}.json.gz"
        if self.blob_store:
            data = await self.blob_store.get(key)
            snapshot = json.loads(gzip.decompress(data))
        else:
            snapshot = {}
        return snapshot

    async def list_checkpoints(self, project_id: str) -> list[dict]:
        return [{"checkpoint_id": cid} for cid in self._checkpoints.get(project_id, [])]
