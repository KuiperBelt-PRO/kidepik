"""Presigned upload routes."""

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.auth import verify_supabase_jwt
from app.storage import create_presigned_upload

router = APIRouter(prefix="/api/v1/storage", tags=["storage"])


class PresignRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=255)


@router.post("/presign-upload")
def presign_upload(
    body: PresignRequest,
    claims: dict[str, Any] = Depends(verify_supabase_jwt),
) -> dict[str, str]:
    """Issue presigned PUT URL; client uploads directly to R2/MinIO."""
    user_id = str(claims.get("sub", "anonymous"))
    return create_presigned_upload(body.filename, user_id)
