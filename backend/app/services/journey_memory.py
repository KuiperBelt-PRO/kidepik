"""Resúmenes de viaje: preferencia ledger ficheros; fallback Postgres."""
from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.gemini_gateway import GeminiGateway
from app.ai.journey.ledger import JourneyLedger
from app.config import get_settings


class JourneyMemoryService:
    def __init__(
        self,
        session: AsyncSession,
        gateway: GeminiGateway | None = None,
    ) -> None:
        self.session = session
        self.gateway = gateway or GeminiGateway()
        self.settings = get_settings()
        self.ledger = JourneyLedger(self.settings.journey_data_dir)

    async def _parent_id(self, child_id: str) -> str | None:
        return (
            await self.session.execute(
                text("select parent_id from children where id=:id"),
                {"id": child_id},
            )
        ).scalar()

    async def maybe_condense(self, child_id: str, every_n: int = 3) -> dict:
        count = int(
            (
                await self.session.execute(
                    text("select count(*) from story_beats where child_id=:id"),
                    {"id": child_id},
                )
            ).scalar()
            or 0
        )
        if count >= every_n and count % every_n == 0:
            return await self.condense_now(child_id)
        return {"wrote": False, "summary": None, "up_to": None}

    async def condense_now(self, child_id: str) -> dict:
        """Compat: sigue escribiendo story_summaries si hay beats; no es el camino primario."""
        rows = (
            await self.session.execute(
                text(
                    "select sequence_num,narrative_text from story_beats "
                    "where child_id=:id order by sequence_num"
                ),
                {"id": child_id},
            )
        ).mappings().all()
        if not rows:
            return {"wrote": False, "summary": None, "up_to": None}
        summary = "\n".join(
            f"#{row['sequence_num']} {row['narrative_text']}" for row in rows
        )[:800]
        up_to = int(rows[-1]["sequence_num"])
        await self.session.execute(
            text(
                "insert into story_summaries "
                "(child_id,kind,up_to_sequence,summary_text,model_used) "
                "values (:id,'condensed_full',:up,:summary,null)"
            ),
            {"id": child_id, "up": up_to, "summary": summary},
        )
        parent_id = await self._parent_id(child_id)
        if parent_id:
            self.ledger.write_journey_condensed(
                str(parent_id),
                child_id,
                front_matter={"up_to_sequence": up_to, "source": "story_beats"},
                body_markdown=summary,
            )
        return {"wrote": True, "summary": summary, "up_to": up_to}

    async def latest_summary_text(self, child_id: str) -> str | None:
        parent_id = await self._parent_id(child_id)
        if parent_id:
            path = (
                self.ledger.child_dir(str(parent_id), child_id) / "journey-condensed.md"
            )
            _meta, body = self.ledger.read_markdown_document(path)
            if body.strip():
                return body.strip()
        return (
            await self.session.execute(
                text(
                    "select summary_text from story_summaries "
                    "where child_id=:id and kind='condensed_full' "
                    "order by up_to_sequence desc,created_at desc limit 1"
                ),
                {"id": child_id},
            )
        ).scalar()
