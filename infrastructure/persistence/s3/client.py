"""S3/MinIO client for checkpoints and exports."""
from __future__ import annotations

import gzip
import io
import json
from typing import Any

import boto3
from botocore.config import Config as BotoConfig

from config.settings import settings

_s3_client = None


def get_s3_client():
    global _s3_client
    if _s3_client is None:
        _s3_client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            region_name=settings.s3_region,
            config=BotoConfig(signature_version="s3v4"),
        )
        # Ensure bucket exists
        try:
            _s3_client.head_bucket(Bucket=settings.s3_bucket)
        except:
            _s3_client.create_bucket(Bucket=settings.s3_bucket)
    return _s3_client


def store_checkpoint(session_id: str, checkpoint_id: str, data: dict[str, Any]) -> str:
    """Store compressed checkpoint snapshot. Returns S3 key."""
    client = get_s3_client()
    key = f"sessions/{session_id}/checkpoints/{checkpoint_id}.json.gz"
    payload = gzip.compress(json.dumps(data, default=str).encode("utf-8"))
    client.put_object(
        Bucket=settings.s3_bucket,
        Key=key,
        Body=payload,
        ContentType="application/gzip",
    )
    return key


def load_checkpoint(s3_key: str) -> dict[str, Any]:
    """Load checkpoint from S3."""
    client = get_s3_client()
    resp = client.get_object(Bucket=settings.s3_bucket, Key=s3_key)
    compressed = resp["Body"].read()
    return json.loads(gzip.decompress(compressed).decode("utf-8"))


def store_export(session_id: str, name: str, data: dict[str, Any]) -> str:
    """Store export artifact. Returns S3 key."""
    client = get_s3_client()
    key = f"sessions/{session_id}/exports/{name}.json"
    client.put_object(
        Bucket=settings.s3_bucket,
        Key=key,
        Body=json.dumps(data, default=str).encode("utf-8"),
        ContentType="application/json",
    )
    return key


def list_checkpoints(session_id: str) -> list[dict[str, Any]]:
    """List checkpoint objects for a session."""
    client = get_s3_client()
    prefix = f"sessions/{session_id}/checkpoints/"
    resp = client.list_objects_v2(Bucket=settings.s3_bucket, Prefix=prefix)
    return [
        {"key": obj["Key"], "size": obj["Size"], "modified": obj["LastModified"]}
        for obj in resp.get("Contents", [])
    ]
