from __future__ import annotations

from typing import Any

import httpx
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.config import get_settings
from app.db import get_engine
from app.db.migrations import MigrationRunner
from app.storage import create_storage_driver

router = APIRouter(tags=["architecture"])


@router.get("/api/v1/architecture/config")
async def architecture_config() -> dict[str, Any]:
    settings = get_settings()
    return {
        "api_url": settings.public_api_url,
        "supabase_url": settings.public_supabase_url,
        "storage_public_url": settings.media_base,
        "media_base_url": settings.media_base,
        "client_logging": settings.client_log_ingest_enabled(),
        "client_log_level": settings.client_log_level,
        "note": "Same-origin app: web + API + /media on one host.",
    }


@router.get("/api/v1/architecture/status")
async def architecture_status() -> dict[str, Any]:
    settings = get_settings()
    supabase_ok = False
    supabase_detail = "unknown"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{settings.supabase_base}/rest/v1/")
            supabase_ok = response.status_code < 500
            supabase_detail = f"http {response.status_code}"
    except httpx.HTTPError as exc:
        supabase_detail = str(exc)

    postgres_ok = False
    poc_health = None
    engine = get_engine()
    if engine is not None:
        try:
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
                result = await conn.execute(
                    text("SELECT message FROM public.poc_health LIMIT 1")
                )
                row = result.first()
                poc_health = str(row[0]) if row else None
                postgres_ok = True
        except Exception:
            postgres_ok = False

    storage = create_storage_driver().status()
    migration_status = await MigrationRunner.from_env().status()
    migrations = {
        "pending_count": len(migration_status.get("pending") or []),
        "applied_count": len(migration_status.get("applied") or []),
        "ok": bool(migration_status.get("ok")),
    }
    return {
        "api": {"ok": True, "service": settings.app_name},
        "supabase": {"ok": supabase_ok, "detail": supabase_detail},
        "postgres": {"ok": postgres_ok},
        "poc_health": poc_health,
        "storage": storage,
        "migrations": migrations,
    }


@router.get("/api/v1/migrations/status")
async def migrations_status() -> JSONResponse:
    status = await MigrationRunner.from_env().status()
    code = 200 if status.get("ok") else 503
    return JSONResponse(status, status_code=code)
