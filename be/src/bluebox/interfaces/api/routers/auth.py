"""doc/api_event_contract.md SS1.1. `/auth/biometric`, `/auth/voice`,
`/auth/guest` are not implemented (see `interfaces/api/auth.py` docstring)."""

from fastapi import APIRouter, Depends, HTTPException, status

from bluebox.interfaces.api.auth import (
    InvalidCredentialsError,
    LoginRequest,
    LoginResponse,
    UserProfile,
    get_current_user,
    login,
)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login_route(request: LoginRequest) -> LoginResponse:
    try:
        return login(request)
    except InvalidCredentialsError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="invalid email or password") from exc


@router.get("/me", response_model=UserProfile)
def me_route(user: UserProfile = Depends(get_current_user)) -> UserProfile:
    return user
