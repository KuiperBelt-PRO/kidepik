"""Actualización de niveles y rolling tras retos de camino (SPEC_APP_SUBJECT_PROGRESS_LINEAR_B)."""
from __future__ import annotations

from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.catalogs import SubjectCatalog
from app.services.crew_progress import CrewProgressService
from app.services.subject_progress_config import (
    DELTA_PER_CORRECT,
    REQUIRED_CORRECT_CHALLENGES,
    ROLLING_MODEL,
    SEED_ROLLING,
    THRESHOLD_UP,
)


class SubjectProgressService:
    THRESHOLD_UP = THRESHOLD_UP
    SEED_ROLLING = SEED_ROLLING
    DELTA_PER_CORRECT = DELTA_PER_CORRECT

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def record_path_challenge(
        self,
        child_id: str,
        world_theme: str,
        subject_id: str,
        *,
        score: float,
    ) -> list[dict[str, Any]]:
        """Registra un intento de reto y devuelve efectos para el turno."""
        subject = str(subject_id or "math").strip() or "math"
        world = str(world_theme or "fantasy")
        row = await self._fetch_row(child_id, world, subject)
        level = str(row.get("level_id") or "L1") if row else "L1"
        rolling_before = self._effective_rolling(row)

        if score < 1.0:
            return [
                {
                    "type": "record_learning_result",
                    "subject_id": subject,
                    "score": score,
                    "accuracy_rolling": round(rolling_before, 3),
                    "level_id": level,
                    "rolling_delta": 0.0,
                    "rolling_model": ROLLING_MODEL,
                }
            ]

        rolling = min(THRESHOLD_UP, rolling_before + DELTA_PER_CORRECT)
        rolling = round(rolling, 4)
        new_level = level
        source = "path_challenge"
        if rolling >= THRESHOLD_UP and self._level_index(level) < 5:
            new_level = f"L{self._level_index(level) + 1}"
            rolling = SEED_ROLLING
            source = "path_level_up"

        await self._upsert_row(
            child_id, world, subject, new_level, rolling, source=source
        )
        effects: list[dict[str, Any]] = [
            {
                "type": "record_learning_result",
                "subject_id": subject,
                "score": score,
                "accuracy_rolling": round(rolling, 3),
                "level_id": new_level,
                "rolling_delta": round(DELTA_PER_CORRECT, 4),
                "rolling_model": ROLLING_MODEL,
            }
        ]
        if new_level != level:
            effects.append(
                {"type": "update_subject_level", "subject_id": subject, "level_id": new_level}
            )
            general_before = await self._general_level(child_id)
            new_general = await self._recalculate_general_level(
                child_id, world, await self._active_subjects(child_id)
            )
            if new_general and new_general != general_before:
                effects.append({"type": "set_general_level", "general_level": new_general})
            effective_general = new_general or general_before
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

    @staticmethod
    def linear_state_after_corrects(
        n_correct: int, start_level: str = "L1"
    ) -> tuple[str, float, str]:
        """Reconstruye nivel, rolling y source tras N aciertos conservados."""
        remaining = max(0, int(n_correct))
        level_idx = SubjectProgressService._level_index(start_level)
        if level_idx < 1:
            level_idx = 1
        if level_idx > 5:
            level_idx = 5
        leveled = False
        while remaining >= REQUIRED_CORRECT_CHALLENGES and level_idx < 5:
            remaining -= REQUIRED_CORRECT_CHALLENGES
            level_idx += 1
            leveled = True
        if remaining == 0:
            source = "path_level_up" if leveled else "placement"
            return f"L{level_idx}", SEED_ROLLING, source
        rolling = round(
            min(THRESHOLD_UP, SEED_ROLLING + remaining * DELTA_PER_CORRECT), 4
        )
        return f"L{level_idx}", rolling, "path_challenge"

    @staticmethod
    def count_conserved_corrects(
        events: list[dict[str, Any]] | None = None,
        remaining_turns: list[dict[str, Any]] | None = None,
    ) -> dict[str, int]:
        """Cuenta aciertos de camino que siguen vivos tras un rewind.

        Prefiere eventos ``path_progress`` con ``last_ok: true``. Si no hay
        ninguno, usa turnos ``path_challenge_echo`` con ``choice_correct``.
        """
        counts: dict[str, int] = {}
        for row in events or []:
            if row.get("kind") != "path_progress":
                continue
            payload = row.get("payload") if isinstance(row.get("payload"), dict) else {}
            if payload.get("last_ok") is not True:
                continue
            path = payload.get("path") if isinstance(payload.get("path"), dict) else {}
            subject = str(
                path.get("subject_id") or payload.get("subject_id") or ""
            ).strip() or "math"
            counts[subject] = counts.get(subject, 0) + 1
        if counts:
            return counts
        for turn in remaining_turns or []:
            meta = turn.get("meta") if isinstance(turn.get("meta"), dict) else {}
            if str(meta.get("phase") or "") != "path_challenge_echo":
                continue
            if meta.get("choice_correct") is not True:
                continue
            subject = str(meta.get("subject_id") or "").strip() or "math"
            counts[subject] = counts.get(subject, 0) + 1
        return counts

    @staticmethod
    def _placement_subjects(events: list[dict[str, Any]] | None) -> list[str]:
        subjects: list[str] = []
        for row in events or []:
            if row.get("kind") != "placement_result":
                continue
            payload = row.get("payload") if isinstance(row.get("payload"), dict) else {}
            if payload.get("status") != "completed":
                continue
            raw = payload.get("subjects") or []
            if isinstance(raw, list):
                subjects = [str(item) for item in raw if str(item).strip()]
        return subjects

    async def rebuild_after_rewind(
        self,
        child_id: str,
        world_theme: str,
        *,
        events: list[dict[str, Any]] | None = None,
        remaining_turns: list[dict[str, Any]] | None = None,
    ) -> None:
        """Reescribe rolling post-placement desde aciertos conservados (rewind V2)."""
        world = str(world_theme or "fantasy")
        counts = self.count_conserved_corrects(
            events, remaining_turns=remaining_turns
        )
        existing = await self._fetch_all_rows(child_id, world)
        subjects = (
            set(existing)
            | set(counts)
            | set(self._placement_subjects(events))
        )
        if not subjects:
            return
        for subject in subjects:
            row = existing.get(subject)
            start_level = "L1"
            if row and str(row.get("source") or "") == "placement":
                start_level = str(row.get("level_id") or "L1")
            n_correct = int(counts.get(subject, 0))
            level_id, rolling, source = self.linear_state_after_corrects(
                n_correct, start_level
            )
            await self._upsert_row(
                child_id, world, subject, level_id, rolling, source=source
            )
        await self._recalculate_general_level(
            child_id, world, await self._active_subjects(child_id)
        )
        general = await self._general_level(child_id)
        if general:
            rank_id = self._rank_id_for_general(world, general)
            if rank_id:
                await self.session.execute(
                    text(
                        "update children set rank_id=:rid, rank_track=:track, "
                        "updated_at=now() where id=:cid"
                    ),
                    {
                        "rid": rank_id,
                        "track": "sci-fi" if world == "sci-fi" else "fantasy",
                        "cid": child_id,
                    },
                )

    async def _fetch_all_rows(
        self, child_id: str, world: str
    ) -> dict[str, dict[str, Any]]:
        rows = (
            await self.session.execute(
                text(
                    "select subject_id, level_id, source, accuracy_rolling "
                    "from user_subject_levels "
                    "where child_id=:cid and world_theme=:theme"
                ),
                {"cid": child_id, "theme": world},
            )
        ).mappings().all()
        return {str(row["subject_id"]): dict(row) for row in rows}

    async def finalize_path_completion(
        self,
        child_id: str,
        world_theme: str,
        subject_id: str,
        *,
        active_subjects: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        """Cierra camino: subida pendiente, informe y nivel general (sin bonus de rolling)."""
        subject = str(subject_id or "math").strip() or "math"
        world = str(world_theme or "fantasy")
        effects: list[dict[str, Any]] = []
        row = await self._fetch_row(child_id, world, subject)
        if not row:
            return effects

        level = str(row.get("level_id") or "L1")
        rolling = self._effective_rolling(row)
        rolling = round(rolling, 4)
        new_level = level
        if rolling >= THRESHOLD_UP and self._level_index(level) < 5:
            new_level = f"L{self._level_index(level) + 1}"
            rolling = SEED_ROLLING
            await self._upsert_row(
                child_id, world, subject, new_level, rolling, source="path_level_up"
            )
            effects.append(
                {"type": "update_subject_level", "subject_id": subject, "level_id": new_level}
            )
        else:
            new_level = level

        effects.append(
            {
                "type": "record_learning_result",
                "subject_id": subject,
                "score": 1.0,
                "accuracy_rolling": round(rolling, 3),
                "level_id": new_level,
                "path_complete": True,
                "rolling_delta": 0.0,
                "rolling_model": ROLLING_MODEL,
            }
        )

        general_before = await self._general_level(child_id)
        subjects = active_subjects or await self._active_subjects(child_id)
        new_general = await self._recalculate_general_level(child_id, world, subjects)
        effective_general = new_general or general_before
        if new_general and new_general != general_before:
            effects.append({"type": "set_general_level", "general_level": new_general})
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

    async def _active_subjects(self, child_id: str) -> list[str]:
        row = (
            await self.session.execute(
                text("select settings from children where id=:id"),
                {"id": child_id},
            )
        ).mappings().first()
        settings = dict(row).get("settings") if row else {}
        learning = settings.get("learning") if isinstance(settings, dict) else {}
        active = learning.get("active_subjects") if isinstance(learning, dict) else []
        return [str(s) for s in active] if isinstance(active, list) else []

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
    def _effective_rolling(row: dict[str, Any] | None) -> float:
        if not row or row.get("accuracy_rolling") is None:
            return SEED_ROLLING
        return float(row["accuracy_rolling"])

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
