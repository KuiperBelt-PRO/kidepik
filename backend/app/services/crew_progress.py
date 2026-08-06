from __future__ import annotations

from datetime import date
from typing import Any

from sqlalchemy import text

from app.catalogs import SubjectCatalog
from app.db import session_scope


class CrewProgressService:
    THRESHOLD_UP = .80
    ZONES = {
        "zone_math": ("math", "Bosque de los Números", "Nebulosa Matemática"),
        "zone_language": ("language", "Montañas de la Gramática", "Estación Léxico"),
        "zone_logic": ("logic", "Laberinto de Espejos", "Laberinto de Circuitos"),
        "zone_science": ("science", "Jardines Alquímicos", "Cinturón de Observatorios"),
        "zone_culture": ("culture", "Biblioteca de los Reinos", "Archivo Galáctico"),
    }
    RANKS = {
        "fantasy": (("fantasy_spark", "Chispa del reino"), ("fantasy_apprentice", "Aprendiz de los reinos"), ("fantasy_adept", "Adepto del artefacto"), ("fantasy_guardian", "Guardián del saber"), ("fantasy_archon", "Archón del equilibrio")),
        "sci-fi": (("scifi_recruit", "Recluta estelar"), ("scifi_cadet", "Cadete explorador"), ("scifi_ensign", "Alférez de ruta"), ("scifi_lieutenant", "Teniente de nebulosa"), ("scifi_captain", "Capitán del saber")),
    }

    async def build_for_child(self, child: dict[str, Any]) -> dict[str, dict[str, Any]]:
        child_id, theme = str(child.get("id", "")), str(child.get("world_theme") or "fantasy")
        settings = child.get("settings") if isinstance(child.get("settings"), dict) else {}
        learning = settings.get("learning") if isinstance(settings.get("learning"), dict) else {}
        active = learning.get("active_subjects") if isinstance(learning.get("active_subjects"), list) else []
        levels, quest, completed_at = await self._data(child_id)
        journey_settings = settings.get("journey") if isinstance(settings.get("journey"), dict) else {}
        completed = [str(x) for x in journey_settings.get("completed_zone_ids", []) if isinstance(x, str)]
        active_zone = journey_settings.get("active_zone_id") if isinstance(journey_settings.get("active_zone_id"), str) else None
        subjects, weighted, total_weight, unevaluated = [], 0.0, 0.0, 0
        for subject in active:
            if subject not in SubjectCatalog.META: continue
            meta, row = SubjectCatalog.META[subject], levels.get(subject)
            level = row.get("level_id") if row else None
            progress = self._level_progress(level, row.get("accuracy_rolling") if row else None, 1 if row else 0, meta["label"]) if level else None
            if progress: weighted += progress["percent_to_next"] * SubjectCatalog.WEIGHTS.get(subject, .05); total_weight += SubjectCatalog.WEIGHTS.get(subject, .05)
            else: unevaluated += 1
            zone = meta["zone_id"]
            subjects.append({"subject_id": subject, "label": meta["label"], "family": meta["family"], "zone_id": zone, "zone_label": self._zone_label(theme, zone), "level_id": level, "level_progress": progress, "zone_status": self._zone_status(level, zone, completed, active_zone, quest), "recent_attempts": 1 if row else 0})
        general = child.get("general_level") if isinstance(child.get("general_level"), str) else None
        rank = self._rank(theme, child.get("rank_track"), child.get("rank_id"), general)
        rank_next = self._next_rank(theme, rank["tier"]) if rank else None
        general_progress = None
        if child.get("placement_status", "pending") == "completed" and general:
            percent, next_level = round(weighted / total_weight) if total_weight else 10, self._next_level(general)
            hint = f"{unevaluated} materias pendientes de examen." if unevaluated else (f"Nivel general {general} — {percent} % del camino hacia {next_level}." if next_level else f"Nivel general {general} — nivel máximo.")
            general_progress = {"current": general, "next": next_level, "percent_to_next": max(0, min(100, percent)), "hint_tutor": hint}
        pending = self._plan_zones(levels, completed, child_id, theme)
        return {"progress": {"general_level": general, "general_progress": general_progress, "rank": rank, "rank_next": rank_next, "rank_eligible_now": bool(rank_next and general and self._level_index(general) >= self._level_index(rank_next["min_general_level"])), "subjects": subjects, "placement_completed_at": completed_at}, "journey": {"chapter_id": str(journey_settings.get("chapter_id", "C1_first_zone")), "chapter_label": "Primer destino", "active_zone_id": active_zone, "active_zone_label": self._zone_label(theme, active_zone), "fragments_restored": int(journey_settings.get("fragments_restored", 0)), "zones_completed": completed, "zones_completed_labels": [self._zone_label(theme, zone) for zone in completed], "pending_destinations": pending, "active_quest": quest}}

    async def _data(self, child_id: str) -> tuple[dict[str, dict[str, Any]], dict[str, Any] | None, str | None]:
        async with session_scope() as session:
            level_rows = (await session.execute(text("select subject_id, level_id, accuracy_rolling from user_subject_levels where child_id = :id"), {"id": child_id})).mappings().all()
            quest = (await session.execute(text("select id, zone_id, title_child, steps_done, steps_total from narrative_quests where child_id = :id and status = 'active' order by updated_at desc nulls last limit 1"), {"id": child_id})).mappings().first()
            completed = (await session.execute(text(
                """
                select coalesce(cwp.updated_at, c.updated_at)
                from children c
                left join child_world_progress cwp
                  on cwp.child_id = c.id
                 and cwp.world_theme = coalesce(c.active_world_theme, c.world_theme, 'fantasy')
                where c.id = :id
                  and (c.placement_status = 'completed' or cwp.placement_status = 'completed')
                limit 1
                """
            ), {"id": child_id})).scalar_one_or_none()
        levels = {str(row["subject_id"]): {"level_id": str(row["level_id"] or "L1"), "accuracy_rolling": float(row["accuracy_rolling"]) if row["accuracy_rolling"] is not None else None} for row in level_rows}
        return levels, (dict(quest) if quest else None), (str(completed) if completed else None)
    def _level_progress(self, level: str, accuracy: float | None, attempts: int, label: str) -> dict[str, Any]:
        if self._level_index(level) >= 5: return {"current": "L5", "next": None, "percent_to_next": 100, "hint_tutor": "Nivel máximo en esta materia."}
        accuracy = accuracy if accuracy is not None else .5; percent = 10 if attempts < 1 else round(accuracy / self.THRESHOLD_UP * 100)
        next_level = f"L{self._level_index(level) + 1}"
        hint = f"Cerca de subir a {next_level} en {label}." if accuracy >= self.THRESHOLD_UP and attempts >= 4 else ("Convendría reforzar en la aventura." if accuracy < .5 else f"Nivel {level} en {label}.")
        return {"current": level, "next": next_level, "percent_to_next": max(0, min(100, percent)), "hint_tutor": hint}
    def _rank(self, theme: str, track: object, rank_id: object, general: str | None) -> dict[str, Any] | None:
        if not general: return None
        track = "sci-fi" if track == "sci-fi" else ("sci-fi" if theme == "sci-fi" else "fantasy")
        tiers = self.RANKS[track]; tier = self._level_index(general)
        if isinstance(rank_id, str):
            for idx, item in enumerate(tiers, 1):
                if item[0] == rank_id: tier = idx
        item = tiers[tier - 1]; return {"id": item[0], "track": track, "tier": tier, "label_child": item[1], "label_tutor": item[1]}
    def _next_rank(self, theme: str, tier: int) -> dict[str, Any] | None:
        if tier >= 5: return None
        track = "sci-fi" if theme == "sci-fi" else "fantasy"; item = self.RANKS[track][tier]
        return {"id": item[0], "track": track, "tier": tier + 1, "label_child": item[1], "label_tutor": item[1], "min_general_level": f"L{tier + 1}"}
    def _plan_zones(self, levels: dict[str, dict[str, Any]], completed: list[str], child_id: str, theme: str) -> list[dict[str, str]]:
        candidates = [(self._level_index(levels.get(subject, {}).get("level_id", "L3")), zone) for zone, (subject, _, _) in self.ZONES.items() if zone not in completed]
        candidates.sort(); return [{"id": zone, "label": self._zone_label(theme, zone) or ""} for _, zone in candidates[:3]]
    def _zone_status(self, level: str | None, zone: str | None, completed: list[str], active: str | None, quest: dict[str, Any] | None) -> str:
        if level is None: return "not_evaluated"
        if not zone: return "not_visited"
        if zone in completed: return "completed"
        return "in_progress" if zone == active or quest and quest.get("zone_id") == zone else "not_visited"
    def _zone_label(self, theme: str, zone: str | None) -> str | None:
        if not zone or zone not in self.ZONES: return None
        return self.ZONES[zone][2] if theme == "sci-fi" else self.ZONES[zone][1]
    @staticmethod
    def _level_index(level: str) -> int: return {"L1": 1, "L2": 2, "L3": 3, "L4": 4, "L5": 5}.get(level, 1)
    def _next_level(self, level: str) -> str | None: return None if self._level_index(level) >= 5 else f"L{self._level_index(level) + 1}"
