from __future__ import annotations

from fastapi import APIRouter

from app.config import get_settings

router = APIRouter(tags=["health"])


@router.get("/api/v1/health")
async def health() -> dict:
    settings = get_settings()
    return {"status": "ok", "service": settings.app_name}
