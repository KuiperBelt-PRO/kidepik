"""Actualización de niveles y rolling tras retos de camino (SPEC_APP_CREW_PROGRESS §3)."""
from __future__ import annotations

from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.catalogs import SubjectCatalog
from app.services.crew_progress import CrewProgressService


class SubjectProgressService:
    THRESHOLD_UP = CrewProgressService.THRESHOLD_UP
    EMA_ALPHA = 0.35
    PATH_COMPLETE_BONUS = 0.08

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def record_path_challenge(
        self,
        child_id: str,
        world_theme: str,
        subject_id: str,
        *,
        score: float,
    ) -> dict[str, Any]:
        """Registra un intento de reto y devuelve efectos para el turno."""
        subject = str(subject_id or "math").strip() or "math"
        world = str(world_theme or "fantasy")
        row = await self._fetch_row(child_id, world, subject)
        level = str(row.get("level_id") or "L1") if row else "L1"
        rolling = self._blend_rolling(
            float(row["accuracy_rolling"]) if row and row.get("accuracy_rolling") is not None else None,
            score,
        )
        await self._upsert_row(child_id, world, subject, level, rolling, source="path_challenge")
        return {
            "type": "record_learning_result",
            "subject_id": subject,
            "score": score,
            "accuracy_rolling": round(rolling, 3),
            "level_id": level,
        }

    async def finalize_path_completion(
        self,
        child_id: str,
        world_theme: str,
        subject_id: str,
        *,
        active_subjects: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        """Bonificación de camino, posible subida de materia/general y rango."""
        subject = str(subject_id or "math").strip() or "math"
        world = str(world_theme or "fantasy")
        effects: list[dict[str, Any]] = []
        row = await self._fetch_row(child_id, world, subject)
        if not row:
            return effects

        level = str(row.get("level_id") or "L1")
        rolling = self._blend_rolling(
            float(row["accuracy_rolling"]) if row.get("accuracy_rolling") is not None else None,
            1.0,
            bonus=self.PATH_COMPLETE_BONUS,
        )
        new_level = level
        level_up = False
        if rolling >= self.THRESHOLD_UP and self._level_index(level) < 5:
            new_level = f"L{self._level_index(level) + 1}"
            rolling = 0.55
            level_up = True

        await self._upsert_row(child_id, world, subject, new_level, rolling, source="path_complete")
        effects.append(
            {
                "type": "record_learning_result",
                "subject_id": subject,
                "score": 1.0,
                "accuracy_rolling": round(rolling, 3),
                "level_id": new_level,
                "path_complete": True,
            }
        )
        if level_up:
            effects.append(
                {
                    "type": "update_subject_level",
                    "subject_id": subject,
                    "level_id": new_level,
                }
            )

        general_before = await self._general_level(child_id)
        new_general = await self._recalculate_general_level(
            child_id, world, active_subjects or []
        )
        effective_general = new_general or general_before
        if new_general and new_general != general_before:
            effects.append(
                {"type": "set_general_level", "general_level": new_general}
            )
        # Asegura rango coherente con el nivel general (también si faltaba rank_id).
        if effective_general:
            rank_id = self._rank_id_for_general(world, effective_general)
            if rank_id:
                await self.session.execute(
                    text(
                        "update children set rank_id=:rid, rank_track=:track, "
                        "updated_at=now() where id=:cid "
                        "and (rank_id is distinct from :rid or rank_id is null)"
                    ),
                    {
                        "rid": rank_id,
                        "track": "sci-fi" if world == "sci-fi" else "fantasy",
                        "cid": child_id,
                    },
                )
                effects.append({"type": "grant_rank", "rank_id": rank_id})
        return effects

    async def _fetch_row(
        self, child_id: str, world: str, subject_id: str
    ) -> dict[str, Any] | None:
        row = (
            await self.session.execute(
                text(
                    "select level_id, accuracy_rolling from user_subject_levels "
                    "where child_id=:cid and world_theme=:theme and subject_id=:sid"
                ),
                {"cid": child_id, "theme": world, "sid": subject_id},
            )
        ).mappings().first()
        return dict(row) if row else None

    async def _upsert_row(
        self,
        child_id: str,
        world: str,
        subject_id: str,
        level_id: str,
        rolling: float,
        *,
        source: str,
    ) -> None:
        await self.session.execute(
            text(
                """
                insert into user_subject_levels(
                  child_id, world_theme, subject_id, level_id,
                  accuracy_rolling, source, updated_at
                ) values (:cid, :theme, :sid, :level, :rolling, :source, now())
                on conflict (child_id, world_theme, subject_id) do update set
                  level_id = excluded.level_id,
                  accuracy_rolling = excluded.accuracy_rolling,
                  source = excluded.source,
                  updated_at = now()
                """
            ),
            {
                "cid": child_id,
                "theme": world,
                "sid": subject_id,
                "level": level_id,
                "rolling": round(rolling, 4),
                "source": source,
            },
        )

    async def _general_level(self, child_id: str) -> str | None:
        value = (
            await self.session.execute(
                text("select general_level from children where id=:id"),
                {"id": child_id},
            )
        ).scalar_one_or_none()
        return str(value) if value else None

    async def _recalculate_general_level(
        self,
        child_id: str,
        world: str,
        active_subjects: list[str],
    ) -> str | None:
        rows = (
            await self.session.execute(
                text(
                    "select subject_id, level_id from user_subject_levels "
                    "where child_id=:cid and world_theme=:theme"
                ),
                {"cid": child_id, "theme": world},
            )
        ).mappings().all()
        by_subject = {str(r["subject_id"]): str(r["level_id"]) for r in rows}
        subjects = [s for s in active_subjects if s in SubjectCatalog.META] or list(
            by_subject.keys()
        )
        weighted = 0.0
        total_weight = 0.0
        for subject in subjects:
            level = by_subject.get(subject)
            if not level:
                continue
            weight = SubjectCatalog.WEIGHTS.get(subject, 0.05)
            weighted += weight * self._level_index(level)
            total_weight += weight
        if total_weight <= 0:
            return None
        general_idx = max(1, min(5, round(weighted / total_weight)))
        general = f"L{general_idx}"
        await self.session.execute(
            text(
                "update children set general_level=:gl, updated_at=now() where id=:id"
            ),
            {"gl": general, "id": child_id},
        )
        await self.session.execute(
            text(
                """
                insert into child_world_progress(
                  child_id, world_theme, general_level, updated_at
                ) values (:id, :theme, :gl, now())
                on conflict (child_id, world_theme) do update set
                  general_level = excluded.general_level,
                  updated_at = now()
                """
            ),
            {"id": child_id, "theme": world, "gl": general},
        )
        return general

    @staticmethod
    def _blend_rolling(
        current: float | None, score: float, *, bonus: float = 0.0
    ) -> float:
        base = current if current is not None else 0.5
        blended = base * (1.0 - SubjectProgressService.EMA_ALPHA) + score * SubjectProgressService.EMA_ALPHA
        if bonus:
            blended += bonus
        return max(0.0, min(1.0, blended))

    @staticmethod
    def _level_index(level: str) -> int:
        return CrewProgressService._level_index(level)

    @staticmethod
    def _rank_id_for_general(world: str, general: str) -> str | None:
        track = "sci-fi" if world == "sci-fi" else "fantasy"
        tiers = CrewProgressService.RANKS[track]
        tier = SubjectProgressService._level_index(general)
        if tier < 1 or tier > len(tiers):
            return None
        return tiers[tier - 1][0]
