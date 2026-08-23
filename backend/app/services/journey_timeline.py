"""Timeline de viaje: preferencia dialogue.jsonl; fallback Postgres turns."""
from __future__ import annotations

import base64
from typing import Any

from sqlalchemy import text

from app.ai.journey.ledger import JourneyLedger
from app.config import get_settings
from app.services.journey_memory import JourneyMemoryService
from app.services.mentor_profiles import mentor_for_child

_TUTOR_SUMMARY_MAX_CHARS = 2000


def tutor_facing_summary(
    *,
    kind: str,
    text: str = "",
    summary: str = "",
    payload: dict[str, Any] | None = None,
) -> str:
    """Prosa del diario tutor: etiqueta humana, no option_id crudo."""
    raw = str(text or summary or "")
    if kind == "explorer_reply":
        reply = payload.get("reply") if isinstance(payload, dict) else None
        if isinstance(reply, dict):
            display = str(reply.get("displayLabel") or "").strip()
            body = str(reply.get("text") or "").strip()
            if display:
                raw = display
            elif body:
                raw = body
            elif str(reply.get("kind") or "") == "continue":
                raw = "Continuar"
    collapsed = " ".join(str(raw).split())
    if len(collapsed) > _TUTOR_SUMMARY_MAX_CHARS:
        return collapsed[:_TUTOR_SUMMARY_MAX_CHARS].rstrip()
    return collapsed


class JourneyTimelineService:
    KIND_RANK = {
        "decision": 10,
        "quest": 20,
        "system": 30,
        "challenge": 40,
        "mentor_utterance": 50,
        "explorer_reply": 60,
        "traveler_update": 65,
        "chapter_opened": 68,
        "level": 70,
        "rank": 70,
    }

    def __init__(self, session: Any) -> None:
        self.session = session
        self.settings = get_settings()
        self.ledger = JourneyLedger(self.settings.journey_data_dir)

    async def page(
        self, child_id: str, cursor: str | None = None, limit: int = 30
    ) -> dict[str, Any]:
        limit = max(1, min(100, limit))
        child = (
            await self.session.execute(
                text(
                    "select id, parent_id, display_name, world_theme from children where id=:id"
                ),
                {"id": child_id},
            )
        ).mappings().first() or {}
        events: list[dict[str, Any]] = []
        parent_id = child.get("parent_id")
        if parent_id:
            for row in self.ledger.read_dialogue(str(parent_id), child_id):
                kind = str(row.get("kind") or "system")
                events.append(
                    self._event(
                        f"dlg:{row.get('id')}",
                        child_id,
                        row.get("at"),
                        kind,
                        "dialogue.jsonl",
                        row.get("id"),
                        tutor_facing_summary(
                            kind=kind,
                            text=str(row.get("text") or ""),
                            summary=str(row.get("summary") or ""),
                            payload=row.get("payload")
                            if isinstance(row.get("payload"), dict)
                            else None,
                        ),
                        int(row.get("seq") or 0),
                    )
                )
        if not events:
            turns = (
                await self.session.execute(
                    text(
                        "select id,role,text,created_at,sequence from dialogue_turns "
                        "where child_id=:id and role in ('mentor','agent','explorer')"
                    ),
                    {"id": child_id},
                )
            ).mappings().all()
            for r in turns:
                kind = (
                    "mentor_utterance"
                    if r["role"] in ("mentor", "agent")
                    else "explorer_reply"
                )
                events.append(
                    self._event(
                        f"turn:{r['id']}",
                        child_id,
                        r["created_at"],
                        kind,
                        "dialogue_turns",
                        r["id"],
                        tutor_facing_summary(
                            kind=kind,
                            text=str(r["text"] or ""),
                        ),
                        int(r["sequence"] or 0),
                    )
                )
        newest_first = sorted(
            events, key=lambda x: (x["at"], x["seq"], x["kind_rank"], x["id"]), reverse=True
        )
        offset = 0
        if cursor:
            try:
                offset = int(base64.b64decode(cursor).decode())
            except Exception:
                offset = 0
        window = newest_first[offset : offset + limit]
        page = list(reversed(window))
        nxt = offset + len(page)
        return {
            "events": page,
            "next_cursor": base64.b64encode(str(nxt).encode()).decode()
            if nxt < len(events)
            else None,
            "summary": await JourneyMemoryService(self.session).latest_summary_text(
                child_id
            ),
            "explorer_label": str(child.get("display_name") or "Explorador"),
            "mentor_label": mentor_for_child(child)["display_name"],
        }

    def _event(
        self,
        id: str,
        child: str,
        at: Any,
        kind: str,
        table: str,
        ref: Any,
        summary: str,
        seq: int,
    ) -> dict[str, Any]:
        value = str(at)
        rank = self.KIND_RANK.get(kind, 80)
        return {
            "id": id,
            "member_id": child,
            "at": value,
            "sort_key": f"{value}|{seq:06d}|{rank:03d}|{id}",
            "seq": seq,
            "kind_rank": rank,
            "kind": kind,
            "ref_table": table,
            "ref_id": str(ref),
            "summary": str(summary or ""),
            "source": "primary",
        }
