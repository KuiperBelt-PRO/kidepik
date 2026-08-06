from __future__ import annotations

from app.catalogs.age_band import AgeBand


class SubjectCatalog:
    ALL = (
        "math", "language", "reading", "logic", "science", "culture", "geography",
        "history", "mythology", "ethics", "communication", "politics", "arts",
        "sports", "finance",
    )
    WEIGHTS = {
        "math": .13, "language": .13, "reading": .09, "logic": .09, "science": .09,
        "culture": .06, "geography": .06, "history": .08, "mythology": .04,
        "ethics": .05, "communication": .04, "politics": .03, "arts": .04,
        "sports": .03, "finance": .04,
    }
    META = {
        "math": {"label": "Matemáticas", "family": "fundamentals", "zone_id": "zone_math"},
        "language": {"label": "Lengua y gramática", "family": "fundamentals", "zone_id": "zone_language"},
        "reading": {"label": "Comprensión lectora", "family": "fundamentals", "zone_id": "zone_language"},
        "logic": {"label": "Lógica y razonamiento", "family": "fundamentals", "zone_id": "zone_logic"},
        "science": {"label": "Ciencias naturales", "family": "sciences", "zone_id": "zone_science"},
        "culture": {"label": "Cultura general", "family": "humanities", "zone_id": "zone_culture"},
        "geography": {"label": "Geografía", "family": "humanities", "zone_id": "zone_culture"},
        "history": {"label": "Historia", "family": "humanities", "zone_id": "zone_culture"},
        "mythology": {"label": "Mitología", "family": "humanities", "zone_id": None},
        "ethics": {"label": "Ética y moral", "family": "society", "zone_id": None},
        "communication": {"label": "Comunicación", "family": "society", "zone_id": None},
        "politics": {"label": "Política y ciudadanía", "family": "society", "zone_id": None},
        "arts": {"label": "Arte (plástica, música, cine…)", "family": "expression", "zone_id": None},
        "sports": {"label": "Deporte y salud", "family": "expression", "zone_id": None},
        "finance": {"label": "Finanzas y economía cotidiana", "family": "life", "zone_id": None},
    }
    BASE_BY_BAND = {
        AgeBand.EARLY: ("math", "language", "logic", "science", "arts", "communication"),
        AgeBand.CHILD: ("math", "language", "reading", "logic", "science", "arts", "communication", "sports"),
        AgeBand.TWEEN: ("math", "language", "reading", "logic", "science", "culture", "geography", "history", "mythology", "ethics", "arts", "communication", "sports"),
        AgeBand.TEEN: ALL,
        AgeBand.ADULT: ALL,
        AgeBand.SENIOR: ALL,
    }

    @classmethod
    def ids(cls) -> tuple[str, ...]: return cls.ALL
    @classmethod
    def is_valid(cls, subject_id: str | None) -> bool: return subject_id in cls.ALL
    @classmethod
    def default_weights(cls) -> dict[str, float]: return cls.WEIGHTS.copy()
    @classmethod
    def base_subjects_for_band(cls, age_band: str) -> list[str]:
        return list(cls.BASE_BY_BAND.get(age_band, cls.BASE_BY_BAND[AgeBand.CHILD]))
    @classmethod
    def normalize_active_subjects(cls, raw: list[object]) -> list[str]:
        result: list[str] = []
        for item in raw:
            if isinstance(item, str) and item and item in cls.ALL and item not in result:
                result.append(item)
        if not result: raise ValueError("learning.active_subjects must be non-empty")
        if len(result) > 16: raise ValueError("learning.active_subjects exceeds maximum")
        return result
    @classmethod
    def renormalize_weights(cls, active: list[str]) -> dict[str, float]:
        subjects = cls.normalize_active_subjects(active)
        total = sum(cls.WEIGHTS.get(item, 0) for item in subjects)
        return ({item: 1 / len(subjects) for item in subjects} if total <= 0
                else {item: cls.WEIGHTS.get(item, 0) / total for item in subjects})
    @classmethod
    def suggest_active_subjects(cls, age_band: str, household: list[str] | None = None) -> list[str]:
        result = cls.base_subjects_for_band(age_band)
        for item in household or []:
            if item in cls.ALL and item not in result: result.append(item)
        return result
    @classmethod
    def families(cls) -> dict[str, list[str]]:
        result: dict[str, list[str]] = {}
        for item, meta in cls.META.items(): result.setdefault(meta["family"], []).append(item)
        return result
    @classmethod
    def difficulty_range(cls, age_band: str) -> tuple[int, int]:
        return {AgeBand.EARLY:(1,1), AgeBand.CHILD:(1,2), AgeBand.TWEEN:(2,3), AgeBand.TEEN:(2,4), AgeBand.ADULT:(3,5), AgeBand.SENIOR:(2,4)}.get(age_band, (1,2))
    @classmethod
    def extra_challenge_subjects(cls, age_band: str) -> list[str]:
        return ["math", "language"] if age_band in (AgeBand.TEEN, AgeBand.ADULT, AgeBand.SENIOR) else []
    @classmethod
    def allowed_item_types(cls, age_band: str) -> list[str]:
        return ["mcq"] if age_band == AgeBand.EARLY else (["mcq", "short_text"] if age_band == AgeBand.CHILD else ["mcq", "short_text", "numeric"])
    @classmethod
    def exam_subject_slots(cls, age_band: str, active_subjects: list[str]) -> list[str]:
        try: subjects = cls.normalize_active_subjects(active_subjects)
        except ValueError: subjects = cls.base_subjects_for_band(age_band)
        return [subject for subject in subjects for _ in range(1 + (subject in cls.extra_challenge_subjects(age_band)))]
    @classmethod
    def prose_word_range(cls, age_band: str) -> tuple[int, int]:
        return {AgeBand.EARLY:(20,45), AgeBand.CHILD:(30,60), AgeBand.TWEEN:(40,80), AgeBand.TEEN:(50,100), AgeBand.ADULT:(55,120), AgeBand.SENIOR:(45,100)}.get(age_band, (30,60))
    @classmethod
    def list_for_ui(cls) -> list[dict[str, str | None]]:
        return [{"id": item, **cls.META[item]} for item in cls.ALL]
