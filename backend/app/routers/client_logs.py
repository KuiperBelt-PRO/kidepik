from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Header, HTTPException

from app.config import get_settings
from app.logging_ import channel
from app.services.auth import AuthError, SupabaseAuthService

router = APIRouter(tags=["client-logs"])

MAX_EVENTS = 50
MAX_MESSAGE_LEN = 200
ALLOWED_LEVELS = {"debug", "info", "notice", "warning", "error"}


@router.post("/api/v1/client/logs")
async def ingest_client_logs(
    body: dict[str, Any],
    authorization: str | None = Header(default=None),
) -> dict[str, int]:
    settings = get_settings()
    if not settings.client_log_ingest_enabled():
        raise HTTPException(status_code=404, detail="Client log ingest disabled")

    events = body.get("events")
    if not isinstance(events, list):
        raise HTTPException(status_code=422, detail="events array required")
    if len(events) > MAX_EVENTS:
        raise HTTPException(status_code=422, detail="too many events")

    auth_user_id: str | None = None
    if authorization:
        auth = SupabaseAuthService()
        try:
            claims = await auth.validate_bearer(authorization)
            auth_user_id = claims["sub"]
        except AuthError:
            auth_user_id = None
        finally:
            await auth.aclose()

    logger = channel("client")
    accepted = 0
    rejected = 0
    for event in events:
        if not isinstance(event, dict):
            rejected += 1
            continue
        level = str(event.get("level") or "info").lower()
        if level not in ALLOWED_LEVELS:
            rejected += 1
            continue
        message = str(event.get("message") or "").strip()
        if not message:
            rejected += 1
            continue
        if len(message) > MAX_MESSAGE_LEN:
            message = message[:MAX_MESSAGE_LEN]
        context = event.get("context") if isinstance(event.get("context"), dict) else {}
        context = dict(context)
        if auth_user_id:
            context["auth_user_id"] = auth_user_id
        client_ts = event.get("client_ts")
        if isinstance(client_ts, str) and client_ts:
            context["client_ts"] = client_ts[:40]
        context["source"] = "web"
        getattr(logger, level if level != "notice" else "info")(message, **context)
        accepted += 1
    return {"accepted": accepted, "rejected": rejected}
