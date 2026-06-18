"""Simple RBAC middleware for pipeline access control.

Reads ``X-User-Id`` and ``X-User-Role`` headers for now.
Real authentication (OAuth2/JWT) will be plugged in later.

Roles:
  * ``pipeline_admin``   -- Full access to all endpoints
  * ``pipeline_user``    -- Can create/run pipelines, submit input, steer
  * ``pipeline_viewer``  -- Read-only access
"""
from __future__ import annotations

from enum import Enum
from typing import Annotated

from fastapi import Header, HTTPException, status, Depends


class PipelineRole(str, Enum):
    """Pipeline-specific RBAC roles."""
    ADMIN = "pipeline_admin"
    USER = "pipeline_user"
    VIEWER = "pipeline_viewer"


# Role hierarchy: higher index = more permissions
_ROLE_LEVELS: dict[PipelineRole, int] = {
    PipelineRole.VIEWER: 1,
    PipelineRole.USER: 2,
    PipelineRole.ADMIN: 3,
}


def _get_role(role_header: str | None) -> PipelineRole | None:
    """Parse role header into a PipelineRole."""
    if not role_header:
        return None
    try:
        return PipelineRole(role_header.lower())
    except ValueError:
        return None


def _require_min_role(min_role: PipelineRole):
    """Build a dependency that requires at least ``min_role``."""

    async def dependency(
        x_user_id: Annotated[str | None, Header()] = None,
        x_user_role: Annotated[str | None, Header()] = None,
    ) -> dict[str, str]:
        if not x_user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing X-User-Id header",
                headers={"WWW-Authenticate": "Bearer"},
            )

        role = _get_role(x_user_role)
        if role is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Invalid or missing role. Required: {min_role.value}",
            )

        user_level = _ROLE_LEVELS.get(role, 0)
        min_level = _ROLE_LEVELS.get(min_role, 999)

        if user_level < min_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required: {min_role.value}, got: {role.value}",
            )

        return {"user_id": x_user_id, "role": role.value}

    return dependency


# -- Public dependencies --

require_auth = Depends(_require_min_role(PipelineRole.VIEWER))
"""Any authenticated user (viewer, user, or admin)."""

require_pipeline_viewer = Depends(_require_min_role(PipelineRole.VIEWER))
"""Any authenticated pipeline role (viewer, user, or admin)."""

require_pipeline_user = Depends(_require_min_role(PipelineRole.USER))
"""pipeline_user or pipeline_admin."""

require_pipeline_admin = Depends(_require_min_role(PipelineRole.ADMIN))
"""pipeline_admin only."""
