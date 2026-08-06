from __future__ import annotations


class AgeBand:
    EARLY = "band_early"
    CHILD = "band_child"
    TWEEN = "band_tween"
    TEEN = "band_teen"
    ADULT = "band_adult"
    SENIOR = "band_senior"
    ALL = (EARLY, CHILD, TWEEN, TEEN, ADULT, SENIOR)

    @classmethod
    def from_age_years(cls, age: int) -> str:
        if age <= 7:
            return cls.EARLY
        if age <= 10:
            return cls.CHILD
        if age <= 13:
            return cls.TWEEN
        if age <= 17:
            return cls.TEEN
        if age <= 64:
            return cls.ADULT
        return cls.SENIOR

    @classmethod
    def is_valid(cls, band: str | None) -> bool:
        return band in cls.ALL

    @classmethod
    def from_legacy(cls, legacy: str | None, age_years: int | None = None) -> str | None:
        if not legacy:
            return cls.from_age_years(age_years) if age_years is not None else None
        if legacy in cls.ALL:
            return legacy
        if legacy == "age_7":
            return cls.EARLY if age_years is not None and age_years <= 7 else cls.CHILD
        if legacy == "age_9":
            return cls.TWEEN if age_years is not None and age_years >= 11 else cls.CHILD
        return None

    @staticmethod
    def assert_age_years(age: int) -> None:
        if age < 5 or age > 99:
            raise ValueError("age_years invalid")
