"""S3-compatible object storage (MinIO local, Cloudflare R2 production)."""

from uuid import uuid4

import boto3
from botocore.client import Config
from botocore.exceptions import BotoCoreError, ClientError

from app.config import settings


def _external_endpoint_url() -> str:
    """Client-reachable MinIO host (must match S3_PUBLIC_BASE_URL, not 10.0.2.2 on physical device)."""
    base = settings.s3_public_base_url.rstrip("/")
    suffix = f"/{settings.s3_bucket}"
    if base.endswith(suffix):
        return base[: -len(suffix)]
    return settings.s3_external_endpoint_url


def _s3_client(*, external: bool = False):
    endpoint = _external_endpoint_url() if external else settings.s3_endpoint_url
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=settings.s3_access_key_id,
        aws_secret_access_key=settings.s3_secret_access_key,
        region_name=settings.s3_region,
        config=Config(signature_version="s3v4"),
    )


def check_storage_connection() -> dict[str, str | bool]:
    """Verify bucket access for architecture status endpoint."""
    try:
        client = _s3_client()
        client.head_bucket(Bucket=settings.s3_bucket)
        return {"ok": True, "bucket": settings.s3_bucket}
    except (BotoCoreError, ClientError) as exc:
        return {"ok": False, "error": str(exc)}


def create_presigned_upload(filename: str, user_id: str) -> dict[str, str]:
    """Return presigned PUT URL and public read URL for a POC object."""
    safe_name = filename.replace("/", "_").replace("\\", "_") or "upload.bin"
    object_key = f"poc/{user_id}/{uuid4().hex}-{safe_name}"

    client = _s3_client(external=True)
    upload_url = client.generate_presigned_url(
        "put_object",
        Params={"Bucket": settings.s3_bucket, "Key": object_key},
        ExpiresIn=300,
    )

    public_url = f"{settings.s3_public_base_url.rstrip('/')}/{object_key}"
    return {
        "object_key": object_key,
        "upload_url": upload_url,
        "public_url": public_url,
    }
