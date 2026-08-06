from __future__ import annotations

import tempfile
from pathlib import Path

from typing import Any

from fastapi import APIRouter, Body, File, Form, Header, HTTPException, UploadFile

from app.services.auth import AuthError, SupabaseAuthService
from app.storage import create_storage_driver

router = APIRouter(tags=["storage"])


@router.post("/api/v1/storage/prepare-upload")
async def prepare_upload(
    body: dict[str, Any] = Body(...),
    authorization: str | None = Header(default=None),
) -> dict:
    auth = SupabaseAuthService()
    try:
        claims = await auth.validate_bearer(authorization)
    except AuthError as exc:
        raise HTTPException(status_code=401, detail=exc.message) from exc
    finally:
        await auth.aclose()

    filename = str(body.get("filename") or "")
    if not filename:
        raise HTTPException(status_code=422, detail="filename is required")
    category = str(body.get("category") or "poc")
    try:
        plan = create_storage_driver().prepare_upload(claims["sub"], filename, category)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return plan.to_dict()


@router.post("/api/v1/storage/upload")
async def upload(
    token: str = Form(...),
    file: UploadFile = File(...),
) -> dict:
    if not token:
        raise HTTPException(status_code=422, detail="token is required")
    if file is None:
        raise HTTPException(status_code=422, detail="file is required")
    suffix = Path(file.filename or "upload.bin").suffix
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp_path = Path(tmp.name)
            content = await file.read()
            tmp.write(content)
        public_url = create_storage_driver().complete_upload(token, tmp_path)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"public_url": public_url}
