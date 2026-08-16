"""Contexto del tutor y priorización de materias para path_composer."""

from __future__ import annotations

from typing import Any

from app.catalogs.subject_catalog import SubjectCatalog
from app.services.crew import CrewService
from app.services.crew_progress import CrewProgressService
from app.services.placement import PlacementService

_FOCUS_KEYWORDS = (
    "practicar",
    "reforzar",
    "cuesta",
    "cuesta ",
    "flojo",
    "floja",
    "priorizar",
    "mejorar",
    "repasar",
    "refuerzo",
    "dificult",
)


class PathComposerContextService:
    """Construye ranking de materias y bloques de prompt para caminos."""

    @staticmethod
    def tutor_boost_for_note(note: str, *, prioritized: bool = False) -> float:
        text = (note or "").strip()
        boost = 0.0
        if text:
            boost = 1.0
            lower = text.lower()
            if any(keyword in lower for keyword in _FOCUS_KEYWORDS):
                boost += 0.5
        if prioritized:
            boost += 2.0
        return boost

    @staticmethod
    def _subject_priorities(learning: dict[str, Any] | None) -> set[str]:
        if not isinstance(learning, dict):
            return set()
        raw = learning.get("subject_priorities")
        if not isinstance(raw, list):
            return set()
        return {
            str(item).strip()
            for item in raw
            if isinstance(item, str) and str(item).strip() in SubjectCatalog.ALL
        }

    @staticmethod
    def _notes_by_subject(learning: dict[str, Any] | None) -> dict[str, str]:
        out: dict[str, str] = {}
        for row in CrewService.effective_subject_notes(learning):
            sid = str(row.get("subject_id") or "").strip()
            note = str(row.get("note") or "").strip()
            if sid and note:
                out[sid] = note
        return out

    @staticmethod
    def weakness_key(
        subject_id: str,
        *,
        by_subject: dict[str, dict[str, Any]],
    ) -> float:
        row = by_subject.get(subject_id) or {}
        level = str(row.get("level_id") or "L1")
        rolling_raw = row.get("accuracy_rolling")
        rolling = float(rolling_raw) if rolling_raw is not None else 0.5
        level_part = (6 - CrewProgressService._level_index(level)) / 5.0
        acc_part = 1.0 - max(0.0, min(1.0, rolling))
        return level_part + acc_part

    @classmethod
    def rank_subjects(
        cls,
        child: dict[str, Any],
        *,
        subject_rows: list[dict[str, Any]] | None = None,
        limit: int = 3,
    ) -> list[dict[str, Any]]:
        learning = (child.get("settings") or {}).get("learning") or {}
        subjects = PlacementService.active_subjects_for_child(child)
        fallback = ["math", "language", "logic"]
        if not subjects:
            subjects = fallback[:3]

        by_subject = {
            str(row["subject_id"]): row for row in (subject_rows or []) if row.get("subject_id")
        }
        notes = cls._notes_by_subject(learning)
        priorities = cls._subject_priorities(learning)

        scored: list[dict[str, Any]] = []
        weakness_vals: list[float] = []
        boost_vals: list[float] = []
        for subject_id in subjects:
            weakness = cls.weakness_key(subject_id, by_subject=by_subject)
            boost = cls.tutor_boost_for_note(
                notes.get(subject_id, ""),
                prioritized=subject_id in priorities,
            )
            weakness_vals.append(weakness)
            boost_vals.append(boost)
            scored.append(
                {
                    "subject_id": subject_id,
                    "pg_level": str((by_subject.get(subject_id) or {}).get("level_id") or "L1"),
                    "accuracy_rolling": float(
                        (by_subject.get(subject_id) or {}).get("accuracy_rolling") or 0.5
                    ),
                    "tutor_boost": boost,
                    "weakness_pg": weakness,
                    "note": notes.get(subject_id),
                }
            )

        def normalize(values: list[float], value: float) -> float:
            if not values:
                return 0.0
            lo = min(values)
            hi = max(values)
            if hi <= lo:
                return 1.0 if value > 0 else 0.0
            return (value - lo) / (hi - lo)

        for row in scored:
            w_norm = normalize(weakness_vals, row["weakness_pg"])
            b_norm = normalize(boost_vals, row["tutor_boost"])
            row["final_score"] = 0.7 * w_norm + 0.3 * b_norm

        scored.sort(
            key=lambda row: (
                -float(row["final_score"]),
                -float(row["tutor_boost"]),
                -float(row["weakness_pg"]),
            )
        )

        picked: list[dict[str, Any]] = []
        seen: set[str] = set()
        for row in scored:
            sid = str(row["subject_id"])
            if sid in seen:
                continue
            seen.add(sid)
            picked.append(row)
            if len(picked) >= limit:
                break

        if len(picked) < limit:
            for sid in fallback:
                if sid in seen:
                    continue
                picked.append(
                    {
                        "subject_id": sid,
                        "pg_level": "L1",
                        "accuracy_rolling": 0.5,
                        "tutor_boost": cls.tutor_boost_for_note(
                            notes.get(sid, ""),
                            prioritized=sid in priorities,
                        ),
                        "weakness_pg": 1.0,
                        "note": notes.get(sid),
                        "final_score": 0.0,
                    }
                )
                seen.add(sid)
                if len(picked) >= limit:
                    break

        return picked[:limit]

    @classmethod
    def path_slots(cls, ranked: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return [
            {
                "slot_index": idx,
                "subject_id": str(row["subject_id"]),
                "tutor_note": row.get("note"),
            }
            for idx, row in enumerate(ranked[:3])
        ]

    @classmethod
    def build_context(
        cls,
        child: dict[str, Any],
        *,
        subject_rows: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        learning = (child.get("settings") or {}).get("learning") or {}
        ranked = cls.rank_subjects(child, subject_rows=subject_rows, limit=3)
        return {
            "general_note": CrewService.effective_general_note(learning),
            "subject_notes": cls._notes_by_subject(learning),
            "weak_subjects_ranked": ranked,
            "path_slots": cls.path_slots(ranked),
        }

    @classmethod
    def prompt_sections(cls, context: dict[str, Any]) -> list[str]:
        sections: list[str] = ["## Contexto del tutor"]
        general = context.get("general_note")
        if general:
            sections.append(f"General: «{general}».")
        else:
            sections.append("General: (sin nota).")

        notes = context.get("subject_notes") if isinstance(context.get("subject_notes"), dict) else {}
        if notes:
            sections.append("Por materia:")
            for sid, note in list(notes.items())[:8]:
                sections.append(f"- {sid}: «{note}»")

        sections.append("## Asignación de caminos (obligatorio)")
        slots = context.get("path_slots") if isinstance(context.get("path_slots"), list) else []
        for slot in slots:
            idx = int(slot.get("slot_index") or 0) + 1
            sid = str(slot.get("subject_id") or "math")
            note = slot.get("tutor_note")
            if note:
                sections.append(
                    f"Camino {idx} → materia {sid}. Nota tutor: «{note}». "
                    "Calibra lesson_narrative y retos a este foco."
                )
            else:
                sections.append(f"Camino {idx} → materia {sid}. (sin nota específica)")

        sections.append(
            "Cada entrada de paths[] debe usar el subject_id de su slot asignado."
        )
        return sections

    @classmethod
    def placement_tutor_sections(
        cls,
        child: dict[str, Any],
        subject_slots: list[str],
    ) -> list[str]:
        learning = (child.get("settings") or {}).get("learning") or {}
        notes = cls._notes_by_subject(learning)
        priorities = cls._subject_priorities(learning)
        general = CrewService.effective_general_note(learning)
        sections: list[str] = ["## Contexto del tutor (examen de ingreso)"]
        if general:
            sections.append(f"General: «{general}».")
        for subject_id in subject_slots:
            note = notes.get(subject_id)
            priority = subject_id in priorities
            if note and priority:
                sections.append(
                    f"Materia {subject_id}: nota «{note}»; priorizada por el tutor — "
                    "calibra dificultad y foco del ítem."
                )
            elif note:
                sections.append(
                    f"Materia {subject_id}: nota «{note}» — úsala para calibrar el ítem."
                )
            elif priority:
                sections.append(
                    f"Materia {subject_id}: priorizada por el tutor sin nota escrita."
                )
        if len(sections) == 1:
            sections.append("(Sin notas adicionales del tutor.)")
        return sections

    @classmethod
    def weak_subject_ids(cls, context: dict[str, Any]) -> list[str]:
        ranked = context.get("weak_subjects_ranked")
        if not isinstance(ranked, list):
            return ["math", "language", "logic"]
        out = [str(row.get("subject_id") or "") for row in ranked if row.get("subject_id")]
        return out or ["math", "language", "logic"]
