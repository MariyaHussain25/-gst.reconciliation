"""
S3 / Cloudflare R2 storage service — Phase 3.

Uploads files to an S3-compatible object store (AWS S3 or Cloudflare R2)
when the required credentials are configured in the environment.
If credentials are absent, the service is a no-op and returns None.
"""

import logging
from typing import Optional

from app.config.settings import settings

logger = logging.getLogger(__name__)


def _get_client():
    """Return a boto3 S3 client if credentials are configured, else None."""
    if not (settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY and settings.S3_BUCKET_NAME):
        return None

    try:
        import boto3

        kwargs = dict(
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name="auto",
        )
        if settings.S3_ENDPOINT_URL:
            kwargs["endpoint_url"] = settings.S3_ENDPOINT_URL

        return boto3.client("s3", **kwargs)
    except ImportError:
        logger.warning("[s3] boto3 is not installed; S3 uploads are disabled.")
        return None


def upload_file(file_bytes: bytes, object_key: str) -> Optional[str]:
    """
    Upload *file_bytes* to the configured S3 bucket under *object_key*.

    Returns the S3 object key on success, or None if S3 is not configured.
    """
    client = _get_client()
    if client is None:
        return None

    bucket = settings.S3_BUCKET_NAME
    try:
        from io import BytesIO

        client.upload_fileobj(BytesIO(file_bytes), bucket, object_key)
        logger.info("[s3] Uploaded '%s' to bucket '%s'", object_key, bucket)
        return object_key
    except Exception as exc:
        logger.error("[s3] Failed to upload '%s': %s", object_key, exc)
        raise
