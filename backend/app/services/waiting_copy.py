from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import text

from app.services.adventure_compose import AdventureComposeService


class WaitingCopyService:
    TTL_HOURS = 24
    def __init__(self, session: Any, compose: AdventureComposeService | None = None) -> None:
        self.session, self.compose = session, compose or AdventureComposeService(session)
    async def cached_lines(self, child_id: str, kind: str) -> list[str]:
        row = (await self.session.execute(text("select settings from children where id=:id"), {"id": child_id})).mappings().first()
        settings = dict(row["settings"] or {}) if row else {}
        entry = (settings.get("play_waiting_cache") or {}).get(kind)
        if not isinstance(entry, dict): return []
        try:
            age = (datetime.now(timezone.utc) - datetime.fromisoformat(str(entry["generated_at"]).replace("Z", "+00:00"))).total_seconds()
            if age > int(entry.get("ttl_hours", self.TTL_HOURS)) * 3600: return []
        except (KeyError, TypeError, ValueError): return []
        return [line for line in entry.get("lines", []) if isinstance(line, str) and line]
    async def waiting_copy_from_cache(self, child_id: str) -> dict[str, list[str]]:
        return {kind: await self.cached_lines(child_id, kind) for kind in ("preparing_exam", "evaluating_answer", "adventure_compose", "general")}
    async def lines_for(self, child_id: str, child: dict[str, Any], session_id: str, kind: str) -> dict[str, Any]:
        cached = await self.cached_lines(child_id, kind)
        if cached: return {"lines": cached, "kind": kind, "ttl_hours": self.TTL_HOURS}
        try: bundle = await self.compose.compose_waiting_bundle(child_id, child, kind)
        except Exception: return {"lines": [], "kind": kind, "ttl_hours": self.TTL_HOURS}
        row = (await self.session.execute(text("select settings from children where id=:id for update"), {"id": child_id})).mappings().first()
        settings = dict(row["settings"] or {}) if row else {}; cache = dict(settings.get("play_waiting_cache") or {})
        cache[kind] = {"generated_at": datetime.now(timezone.utc).isoformat(), **bundle}; settings["play_waiting_cache"] = cache
        await self.session.execute(text("update children set settings=cast(:settings as jsonb),updated_at=now() where id=:id"), {"id": child_id, "settings": __import__("json").dumps(settings, ensure_ascii=False)})
        return bundle
