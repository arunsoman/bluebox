"""Redis client for session cache, pub/sub, and rate limiting."""
from __future__ import annotations

import json
from typing import Any

import redis.asyncio as redis

from config.settings import settings

_client: redis.Redis | None = None


async def get_redis() -> redis.Redis:
    global _client
    if _client is None:
        _client = redis.from_url(settings.redis_url, decode_responses=True)
    return _client


async def cache_session(session_id: str, data: dict, ttl: int = 1800) -> None:
    r = await get_redis()
    await r.setex(f"session:{session_id}", ttl, json.dumps(data, default=str))


async def get_cached_session(session_id: str) -> dict | None:
    r = await get_redis()
    raw = await r.get(f"session:{session_id}")
    return json.loads(raw) if raw else None


async def delete_cached_session(session_id: str) -> None:
    r = await get_redis()
    await r.delete(f"session:{session_id}")


async def publish_event(channel: str, message: dict) -> None:
    r = await get_redis()
    await r.publish(channel, json.dumps(message, default=str))


async def close_redis() -> None:
    global _client
    if _client:
        await _client.close()
        _client = None
