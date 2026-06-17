"""AuditTrailService — tiered audit logging."""

from __future__ import annotations

import difflib
import json
from enum import Enum
from functools import wraps

from app.domain.models import utcnow


class AuditLevel(str, Enum):
    DIFF = "diff"
    FULL = "full"
    REFERENCE = "reference"


class AuditTrailService:
    """Tiered audit logging. Intercepts service calls via decorator."""

    def __init__(self, budget_manager=None):
        self.budget = budget_manager
        self._events: list[dict] = []

    async def log(self, level: AuditLevel, action: str, before: dict, after: dict, metadata: dict = None):
        event = {
            "event_id": str(__import__("uuid").uuid4()),
            "level": level.value,
            "action": action,
            "timestamp": utcnow(),
            "metadata": metadata or {},
        }
        if level == AuditLevel.DIFF:
            event["delta"] = self._compute_diff(before, after)
        elif level == AuditLevel.FULL:
            event["before"] = before
            event["after"] = after
        elif level == AuditLevel.REFERENCE:
            event["reference_to"] = before.get("snapshot_id")
            event["latest_delta"] = self._compute_diff(before, after)

        self._events.append(event)
        await self._persist(event)

    def _compute_diff(self, before: dict, after: dict) -> dict:
        before_json = json.dumps(before, sort_keys=True, default=str)
        after_json = json.dumps(after, sort_keys=True, default=str)
        diff = list(difflib.unified_diff(before_json.splitlines(), after_json.splitlines(), lineterm=""))
        return {"unified_diff": diff}

    async def _persist(self, event: dict) -> None:
        pass

    def interceptor(self, level: AuditLevel = AuditLevel.DIFF):
        def decorator(func):
            @wraps(func)
            async def wrapper(*args, **kwargs):
                before = {"args": str(args), "kwargs": str(kwargs)}
                result = await func(*args, **kwargs)
                after = {"result": str(result)}
                await self.log(level, func.__qualname__, before, after)
                return result
            return wrapper
        return decorator
