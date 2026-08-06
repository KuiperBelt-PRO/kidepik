from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class JourneyContextPack:
    def __init__(self, session: AsyncSession) -> None: self.session = session

    async def build(self, child_id: str, max_recent_beats: int = 6, max_recent_turns: int = 8, max_chars: int = 4000) -> dict:
        summary = (await self.session.execute(text(
            "select summary_text from story_summaries where child_id=:id and kind='condensed_full' "
            "order by up_to_sequence desc, created_at desc limit 1"), {"id": child_id})).scalar()
        beats = [dict(row) for row in (await self.session.execute(text(
            "select sequence_num as sequence,narrative_text as text,beat_kind as kind from story_beats "
            "where child_id=:id order by sequence_num desc limit :limit"), {"id": child_id, "limit": max_recent_beats})).mappings().all()][::-1]
        turns = [dict(row) for row in (await self.session.execute(text(
            "select sequence,role,text from dialogue_turns where child_id=:id and role in ('mentor','agent','explorer') "
            "order by created_at desc limit :limit"), {"id": child_id, "limit": max_recent_turns})).mappings().all()][::-1]
        budget, truncated = max(200, max_chars - len(summary or "")), False
        while sum(len(str(x["text"])) for x in beats + turns) > budget and len(turns) > 1:
            turns.pop(0); truncated = True
        while sum(len(str(x["text"])) for x in beats + turns) > budget and len(beats) > 1:
            beats.pop(0); truncated = True
        return {"journey_summary": summary, "recent_beats": beats, "recent_turns": turns, "truncated": truncated}

    @staticmethod
    def to_prompt_block(pack: dict) -> str:
        beats = "\n".join(f"#{x['sequence']} [{x.get('kind') or ''}] {x['text']}" for x in pack["recent_beats"]) or "(ninguno)"
        turns = "\n".join(f"{x['role']}: {x['text']}" for x in pack["recent_turns"]) or "(ninguno)"
        return f"JOURNEY_CONDENSED (L2):\n{pack['journey_summary'] or '(sin resumen aún)'}\n\nRECENT_BEATS (L3):\n{beats}\n\nRECENT_TURNS (L3):\n{turns}"
