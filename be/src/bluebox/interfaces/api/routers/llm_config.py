"""LLM provider/model selection - not part of doc/api_event_contract.md (the
spec predates this feature). Backs the frontend's AI Config popup (Ctrl+M):
the popup must only let the user pick a provider that actually has
credentials configured, so it asks here rather than hardcoding a guess.
"""

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict

from bluebox.shared_kernel.llm.connector import list_providers

router = APIRouter(prefix="/api/v1/llm", tags=["llm-config"])


class ProviderInfo(BaseModel):
    model_config = ConfigDict(extra="forbid")

    provider_id: str
    display_name: str
    configured: bool
    suggested_models: list[str]


class ProviderListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    providers: list[ProviderInfo]


@router.get("/providers", response_model=ProviderListResponse)
async def get_providers() -> ProviderListResponse:
    return ProviderListResponse(providers=[ProviderInfo(**p) for p in list_providers()])
