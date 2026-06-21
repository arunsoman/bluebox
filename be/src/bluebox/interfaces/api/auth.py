"""Dev-only JWT auth - doc/api_event_contract.md SS1.1.

One seeded user, password-only login. Deliberately NOT implemented:
biometric (`/auth/biometric`, WebAuthn) and voice (`/auth/voice`) - both
need real hardware/SDK integration this pass doesn't build, so those
routes simply don't exist rather than returning a fake challenge. SSO is
accepted as a `LoginRequest` field but ignored (`sso_token` is not
verified) - there is no real SSO provider wired up.
"""

import time
import uuid
from typing import Literal

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_bearer = HTTPBearer(auto_error=False)


def _hash_password(password: str) -> bytes:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt())


def _verify_password(password: str, hashed: bytes) -> bool:
    return bcrypt.checkpw(password.encode(), hashed)


class JWTSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="BLUEBOX_JWT_")

    secret: str = "dev-secret-change-me-32-bytes-minimum-for-hs256"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 15


class UserPreferences(BaseModel):
    model_config = ConfigDict(extra="forbid")

    theme: Literal["light", "dark", "system"] = "system"
    language: str = "en-US"
    notification_channel: Literal["websocket", "polling", "webhook"] = "websocket"
    webhook_url: str | None = None


class UserProfile(BaseModel):
    """doc/api_event_contract.md SS1.1 `UserProfile`."""

    model_config = ConfigDict(extra="forbid")

    user_id: str
    email: str
    name: str
    avatar_url: str | None = None
    persona: Literal["citizen_developer", "architect", "security_engineer"]
    permissions: list[Literal["pipeline_admin", "pipeline_user", "pipeline_viewer"]] = Field(
        default_factory=lambda: ["pipeline_admin"]
    )
    preferences: UserPreferences = Field(default_factory=UserPreferences)


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str
    password: str | None = None
    sso_provider: Literal["github", "google", "microsoft"] | None = None
    sso_token: str | None = None
    persona: Literal["citizen_developer", "architect", "security_engineer"] = "architect"
    trust_mode_default: Literal["PARANOID", "BALANCED", "AUTO_PILOT"] = "PARANOID"


class LoginResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    access_token: str
    refresh_token: str
    user: UserProfile
    session_id: str


_SEED_USER = UserProfile(
    user_id="user-1", email="dev@bluebox.local", name="Dev User", persona="architect",
)
# Pre-computed bcrypt hash for "dev-password" (bcrypt.gensalt() with cost=12)
# This is stable across server restarts, unlike generating at import time
_SEED_PASSWORD_HASH = b"$2b$12$9CNZyjl4hafSBoXN9hNrgO3/G/P7SADZzBXnGU2291Oo.JMKBT3L."


class InvalidCredentialsError(Exception):
    pass


def login(request: LoginRequest) -> LoginResponse:
    if request.email != _SEED_USER.email or not request.password:
        raise InvalidCredentialsError
    if not _verify_password(request.password, _SEED_PASSWORD_HASH):
        raise InvalidCredentialsError

    user = _SEED_USER.model_copy(update={"persona": request.persona})
    token = create_access_token(user.user_id)
    return LoginResponse(
        access_token=token, refresh_token=token, user=user, session_id=str(uuid.uuid4())
    )


def create_access_token(user_id: str, *, settings: JWTSettings | None = None) -> str:
    settings = settings or JWTSettings()
    now = int(time.time())
    payload = {
        "sub": user_id,
        "iat": now,
        "exp": now + settings.access_token_expire_minutes * 60,
    }
    return jwt.encode(payload, settings.secret, algorithm=settings.algorithm)


class TokenInvalidError(Exception):
    pass


def decode_token(token: str) -> UserProfile:
    """Shared by the HTTP `get_current_user` dependency and the WS
    `AUTH_SESSION_INIT` handler - both need to turn a bearer token into the
    seeded user, but only one of them has a FastAPI request to hang a
    `Depends` off of."""

    settings = JWTSettings()
    try:
        payload = jwt.decode(token, settings.secret, algorithms=[settings.algorithm])
    except jwt.PyJWTError as exc:
        raise TokenInvalidError from exc

    if payload.get("sub") != _SEED_USER.user_id:
        raise TokenInvalidError
    return _SEED_USER


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> UserProfile:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="missing bearer token")
    try:
        return decode_token(credentials.credentials)
    except TokenInvalidError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="invalid or expired token") from exc
