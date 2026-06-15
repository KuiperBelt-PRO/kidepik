"""Architecture validation endpoints for POC."""

from typing import Any

import httpx
from fastapi import APIRouter

from app.config import settings
from app.storage import check_storage_connection

router = APIRouter(prefix="/api/v1/architecture", tags=["architecture"])


@router.get("/config")
def public_config() -> dict[str, str]:
    """URLs and hints for mobile clients (no secrets)."""
    return {
        "api_url": settings.public_api_url,
        "supabase_url": settings.public_supabase_url,
        "storage_public_url": settings.public_storage_url,
        "note": "Use 10.0.2.2 from Android emulator; LAN IP from physical device.",
    }


@router.get("/status")
async def architecture_status() -> dict[str, Any]:
    """Check connectivity to Supabase gateway and object storage."""
    supabase_ok = False
    supabase_detail = "unknown"

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{settings.supabase_url.rstrip('/')}/rest/v1/")
            supabase_ok = response.status_code < 500
            supabase_detail = f"http {response.status_code}"
    except httpx.HTTPError as exc:
        supabase_detail = str(exc)

    storage = check_storage_connection()

    return {
        "api": {"ok": True, "service": settings.app_name},
        "supabase": {"ok": supabase_ok, "detail": supabase_detail},
        "storage": storage,
    }
