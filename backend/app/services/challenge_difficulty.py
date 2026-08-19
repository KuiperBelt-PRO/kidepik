"""Calibración de dificultad: suelo por edad + nivel de materia."""

from __future__ import annotations

from dataclasses import dataclass

from app.catalogs.age_band import AgeBand
from app.catalogs.subject_catalog import SubjectCatalog
from app.services.subject_progress_config import SEED_ROLLING, THRESHOLD_UP

_LEVEL_INDEX = {"L1": 1, "L2": 2, "L3": 3, "L4": 4, "L5": 5}

_MATH_HINTS: dict[str, str] = {
    AgeBand.EARLY: (
        "Una sola operación por ítem; sumas o restas con números pequeños (hasta ~20). "
        "Vocabulario concreto."
    ),
    AgeBand.CHILD: (
        "Hasta dos pasos; sumas/restas con llevada o tablas sencillas. "
        "Una sola pregunta clara."
    ),
    AgeBand.TWEEN: (
        "Fracciones simples, problemas de dos pasos o patrones. "
        "Prohibido como núcleo: suma directa de enteros de una cifra (p. ej. 4+3)."
    ),
    AgeBand.TEEN: (
        "Porcentajes, proporcionalidad, ecuaciones de primer grado o problemas de 2–3 pasos. "
        "Prohibido como pregunta principal: suma/resta directa de enteros de 1–2 cifras "
        "(p. ej. 10+5, 7−3)."
    ),
    AgeBand.ADULT: (
        "Álgebra contextual, porcentajes compuestos o razonamiento cuantitativo. "
        "Prohibido como núcleo: aritmética de primaria (p. ej. 10+5)."
    ),
    AgeBand.SENIOR: (
        "Porcentajes, proporciones e interpretación de cantidades; léxico claro. "
        "Prohibido como núcleo: aritmética de primaria (p. ej. 10+5)."
    ),
}

_GENERIC_HINTS: dict[str, str] = {
    AgeBand.EARLY: "Enunciado corto, una idea, vocabulario concreto.",
    AgeBand.CHILD: "Puede combinar dos pasos o un mini-pasaje; una sola pregunta clara.",
    AgeBand.TWEEN: "Complejidad media; menos andamiaje; no infantilizar.",
    AgeBand.TEEN: (
        "Complejidad media-alta, registro respetuoso. "
        "No uses contenido de primaria como núcleo del reto."
    ),
    AgeBand.ADULT: "Razonamiento adulto-amigable; sin condescendencia.",
    AgeBand.SENIOR: "Como adult, con léxico claro y ritmo cómodo.",
}


@dataclass(frozen=True)
class ChallengeDifficulty:
    """Resultado de calibrar un ítem o un slot de camino."""

    age_band: str
    subject_id: str
    floor: int
    ceiling: int
    target: int
    level_id: str | None
    accuracy_rolling: float | None
    difficulty_modifier: float
    curriculum_hint: str


class ChallengeDifficultyService:
    """Calcula suelo, techo y objetivo de dificultad para compose."""

    @staticmethod
    def _round_half_up(value: float) -> int:
        if value >= 0:
            return int(value + 0.5)
        return int(value - 0.5)

    @staticmethod
    def _clamp(value: float, lo: float, hi: float) -> float:
        return max(lo, min(hi, value))

    @classmethod
    def level_index(cls, level_id: str | None) -> int:
        """Map `L1`…`L5` to 1…5.

        Parameters
        ----------
        level_id
            Discrete subject level, or None.

        Returns
        -------
        int
            Index in 1…5 (default 1).
        """
        return _LEVEL_INDEX.get(str(level_id or "L1"), 1)

    @classmethod
    def curriculum_hint(cls, subject_id: str, age_band: str) -> str:
        """Return the curricular focus line for a subject and band.

        Parameters
        ----------
        subject_id
            Catalog id (`math`, `language`, …).
        age_band
            Pedagogical band.

        Returns
        -------
        str
            Hint injected into compose prompts.
        """
        band = age_band if AgeBand.is_valid(age_band) else AgeBand.CHILD
        if subject_id == "math":
            return _MATH_HINTS.get(band, _MATH_HINTS[AgeBand.CHILD])
        return _GENERIC_HINTS.get(band, _GENERIC_HINTS[AgeBand.CHILD])

    @classmethod
    def resolve(
        cls,
        *,
        age_band: str,
        level_id: str | None = "L1",
        accuracy_rolling: float | None = None,
        difficulty_modifier: float = 0.0,
        subject_id: str = "math",
    ) -> ChallengeDifficulty:
        """Compute target difficulty inside the age-band range.

        Parameters
        ----------
        age_band
            `effective_age_band` (or `age_band` if missing).
        level_id
            Subject level from placement / paths.
        accuracy_rolling
            Intra-level progress; None uses the post-placement seed.
        difficulty_modifier
            Fine additive tweak; cannot drop below the band floor.
        subject_id
            Used only for the curriculum hint.

        Returns
        -------
        ChallengeDifficulty
            Floor, ceiling, integer target and hint.
        """
        band = age_band if AgeBand.is_valid(age_band) else AgeBand.CHILD
        floor, ceiling = SubjectCatalog.difficulty_range(band)
        span = ceiling - floor
        rolling = SEED_ROLLING if accuracy_rolling is None else float(accuracy_rolling)
        denom = THRESHOLD_UP - SEED_ROLLING
        rolling_t = 0.0 if denom <= 0 else cls._clamp((rolling - SEED_ROLLING) / denom, 0.0, 1.0)
        position = cls._clamp((cls.level_index(level_id) - 1 + rolling_t) / 4.0, 0.0, 1.0)
        raw = floor + position * span + float(difficulty_modifier or 0.0)
        target = int(cls._clamp(cls._round_half_up(raw), floor, ceiling))
        return ChallengeDifficulty(
            age_band=band,
            subject_id=subject_id,
            floor=floor,
            ceiling=ceiling,
            target=target,
            level_id=str(level_id or "L1"),
            accuracy_rolling=rolling,
            difficulty_modifier=float(difficulty_modifier or 0.0),
            curriculum_hint=cls.curriculum_hint(subject_id, band),
        )

    @classmethod
    def placement(cls, age_band: str, *, subject_id: str = "math") -> ChallengeDifficulty:
        """Placement target: midpoint of the band range (no subject level yet).

        Parameters
        ----------
        age_band
            Pedagogical band of the explorer.
        subject_id
            Slot subject, for the curricular hint.

        Returns
        -------
        ChallengeDifficulty
            Midpoint target with `level_id` None.
        """
        band = age_band if AgeBand.is_valid(age_band) else AgeBand.CHILD
        floor, ceiling = SubjectCatalog.difficulty_range(band)
        target = int(cls._clamp(cls._round_half_up((floor + ceiling) / 2.0), floor, ceiling))
        return ChallengeDifficulty(
            age_band=band,
            subject_id=subject_id,
            floor=floor,
            ceiling=ceiling,
            target=target,
            level_id=None,
            accuracy_rolling=None,
            difficulty_modifier=0.0,
            curriculum_hint=cls.curriculum_hint(subject_id, band),
        )

    @classmethod
    def slot_prompt_line(cls, resolved: ChallengeDifficulty) -> str:
        """One-line calibration for a path slot.

        Parameters
        ----------
        resolved
            Calibrated difficulty for that subject.

        Returns
        -------
        str
            Spanish prompt fragment.
        """
        level = resolved.level_id or "L1"
        rolling = resolved.accuracy_rolling
        bar = ""
        if rolling is not None:
            bar = f" (barra {int(round(rolling * 100))}%)"
        return (
            f"Nivel {level}{bar}. Dificultad objetivo {resolved.target} "
            f"[suelo {resolved.floor}–techo {resolved.ceiling}]. "
            f"Contenido esperado: {resolved.curriculum_hint}"
        )

    @classmethod
    def placement_prompt_block(cls, age_band: str, subject_slots: list[str]) -> str:
        """Prompt block for the placement composer.

        Parameters
        ----------
        age_band
            Pedagogical band.
        subject_slots
            Subject ids in the current batch.

        Returns
        -------
        str
            Multi-line Spanish instructions.
        """
        sample = cls.placement(age_band, subject_id="math")
        lines = [
            "## Calibración pedagógica",
            (
                f"Banda {sample.age_band}: dificultad permitida "
                f"{sample.floor}–{sample.ceiling} (objetivo típico {sample.target}). "
                "Ningún ítem puede quedar por debajo del suelo de la banda."
            ),
        ]
        seen: set[str] = set()
        for subject_id in subject_slots:
            if subject_id in seen:
                continue
            seen.add(subject_id)
            hint = cls.curriculum_hint(subject_id, sample.age_band)
            lines.append(f"- {subject_id}: {hint}")
        return "\n".join(lines)
