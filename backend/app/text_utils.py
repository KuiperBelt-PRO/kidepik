from __future__ import annotations

import re


def _title(value: str) -> str:
    return " ".join(part.capitalize() for part in value.split())


class CharacterSummaryBuilder:
    @staticmethod
    def build(species: str, palette: str, features: list[str], vibe: str | None = None, explorer_note: str | None = None) -> str:
        parts: list[str] = []
        species, palette = species.strip(), palette.strip()
        if species and palette: parts.append(f"{species} de tono {palette}.")
        elif species: parts.append(f"{species}.")
        normalized = list(dict.fromkeys(item.strip() for item in features if isinstance(item, str) and item.strip()))
        if normalized: parts.append(f"Rasgos: {', '.join(normalized)}.")
        if vibe and vibe.strip(): parts.append(f"Personalidad: {vibe.strip()}.")
        note = CharacterSummaryBuilder._note(explorer_note, species)
        if note: parts.append(note)
        return " ".join(parts).strip()

    @staticmethod
    def append(existing: str, append: str) -> str:
        existing, append = existing.strip(), append.strip()
        if not append or not existing: return append or existing
        return existing if append.casefold() in existing.casefold() else f"{existing}\n\n{append}"

    @staticmethod
    def _note(raw: str | None, species: str) -> str | None:
        if not raw or not raw.strip(): return None
        raw = raw.strip()
        normalized, species_norm = raw.casefold(), species.strip().casefold()
        if normalized in {species_norm, f"soy un {species_norm}", f"soy una {species_norm}"}: return None
        if normalized.startswith(f"soy un {species_norm}") and len(raw) <= len(species) + 12: return None
        return raw[:277] + "…" if len(raw) > 280 else raw


class SpeciesExtractor:
    _patterns = (
        r"soy\s+(?:un|una)\s+([^.!?\n]{2,60})", r"soy\s+([^.!?\n]{2,60})",
        r"(?:criatura|especie|ser)\s+(?:es|un|una)?\s*[:\s]+([^.!?\n]{2,60})",
        r"(?:me\s+gustaría\s+ser|quiero\s+ser)\s+([^.!?\n]{2,60})",
    )
    @staticmethod
    def is_valid_species(value: str) -> bool:
        return bool(re.fullmatch(r"[\w\s'\-,]+", value.strip(), re.UNICODE)) and 2 <= len(value.strip()) <= 40
    @classmethod
    def candidates(cls, raw: str) -> list[str]:
        raw = raw.strip()
        if not raw: return []
        found = [match.group(1) for pattern in cls._patterns if (match := re.search(pattern, raw, re.I))]
        found.append(re.split(r"[.!?\n]", raw, maxsplit=1)[0].strip())
        if cls.is_valid_species(raw): found.append(raw)
        result: list[str] = []
        for candidate in found:
            candidate = _title(re.sub(r"\s+", " ", candidate.replace(",", " ")).strip())
            if not cls.is_valid_species(candidate): candidate = candidate[:40].rsplit(" ", 1)[0] if len(candidate) > 40 and " " in candidate[:40] else candidate[:40]
            if cls.is_valid_species(candidate) and candidate not in result: result.append(candidate)
        return result
    @classmethod
    def pick_best(cls, raw: str) -> str | None:
        return next(iter(cls.candidates(raw)), None)


class DisplayNameExtractor:
    SKIP_WORDS = {"será", "sera", "es", "un", "una", "el", "la", "los", "las", "mi", "tu", "su", "yo", "y", "en", "de", "del", "al", "con", "por", "para", "que", "como"}
    _patterns = (r"(?:se\s+llama|se\s+llame|nombre\s+es|me\s+llamo|ll[aá]mame|mi\s+nombre\s+es|nombre)\s*[:\s]+[\"«]?([\w][\w'\-]{0,22}[\w])", r"[\"«“]([\w][\w\s'\-]{0,22}[\w])[\"»”]", r"(?:personaje\s+se\s+llama|llamar[áa])\s*[:\s]+([\w][\w\s'\-]{0,22})")
    @classmethod
    def is_valid_name(cls, value: str) -> bool:
        value = value.strip()
        return bool(re.fullmatch(r"[\w\d '\-]+", value, re.UNICODE)) and len(value) <= 24 and value.casefold() not in cls.SKIP_WORDS
    @classmethod
    def candidates(cls, raw: str) -> list[str]:
        raw = raw.strip()
        if not raw: return []
        found = [match.group(1) for pattern in cls._patterns if (match := re.search(pattern, raw, re.I))]
        if cls.is_valid_name(raw): found.append(raw)
        if match := re.search(r"\b([\w][\w'-]{1,20})\b", raw, re.UNICODE): found.append(match.group(1))
        result: list[str] = []
        for candidate in found:
            candidate = _title(re.sub(r"\s+", " ", candidate).strip())
            if cls.is_valid_name(candidate) and candidate not in result: result.append(candidate)
        return result
    @classmethod
    def pick_best(cls, raw: str) -> str | None:
        return next(iter(cls.candidates(raw)), None)
