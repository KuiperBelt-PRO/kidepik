"""Lectura y edición de traveler.md (ficha canónica del explorador)."""
from __future__ import annotations

import re
from typing import Any

from app.ai.journey.ledger import JourneyLedger
from app.config import get_settings

_PLACEHOLDER_PALETTES = frozenset(
    {
        "",
        "sin definir",
        "por definir",
        "violeta y plata",
    }
)
_COLOR_STOPWORDS = frozenset({"claro", "oscuro", "muy", "tono", "tonos", "color", "colores"})


def palette_is_meaningful(palette: str | None) -> bool:
    raw = str(palette or "").strip().lower()
    return bool(raw) and raw not in _PLACEHOLDER_PALETTES


def extract_palette_tokens(palette: str | None) -> list[str]:
    """Tokens de la paleta para detectar repetición en enunciados."""
    if not palette_is_meaningful(palette):
        return []
    tokens: set[str] = set()
    for part in re.split(r"[,;/]| y ", str(palette).lower()):
        chunk = part.strip()
        if not chunk:
            continue
        if len(chunk) >= 3 and chunk not in _COLOR_STOPWORDS:
            tokens.add(chunk)
        for word in chunk.split():
            if len(word) >= 3 and word not in _COLOR_STOPWORDS:
                tokens.add(word)
    if "plata" in tokens:
        tokens.add("platead")
    if "dorado" in tokens or "oro" in tokens:
        tokens.add("dorad")
    return sorted(tokens)


def parse_markdown_sections(body: str) -> dict[str, str]:
    sections: dict[str, str] = {}
    current: str | None = None
    lines: list[str] = []
    for line in (body or "").splitlines():
        if line.startswith("## "):
            if current is not None:
                sections[current] = "\n".join(lines).strip()
            current = line[3:].strip()
            lines = []
        else:
            lines.append(line)
    if current is not None:
        sections[current] = "\n".join(lines).strip()
    return sections


def _clean_short(value: Any, *, max_len: int) -> str:
    text = re.sub(r"<[^>]+>", "", str(value or "")).strip()
    if len(text) < 2:
        raise ValueError("text too short")
    if len(text) > max_len:
        raise ValueError("text too long")
    return text


def _clean_optional_short(value: Any, *, max_len: int) -> str | None:
    if value is None:
        return None
    text = re.sub(r"<[^>]+>", "", str(value)).strip()
    if not text:
        return None
    if len(text) > max_len:
        raise ValueError("text too long")
    return text


def _clean_features(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        raw_items = [part.strip() for part in re.split(r"[\n,;]+", value) if part.strip()]
    elif isinstance(value, list):
        raw_items = [str(part).strip() for part in value if str(part).strip()]
    else:
        raise ValueError("features invalid")
    items = [_clean_short(item, max_len=80) for item in raw_items[:6]]
    return items


class TravelerProfileService:
    def __init__(self, journey_data_dir: str | None = None) -> None:
        self.ledger = JourneyLedger(journey_data_dir or get_settings().journey_data_dir)

    def read_for_child(self, parent_id: str, child_id: str) -> dict[str, Any] | None:
        try:
            frontmatter, body = self.ledger.read_traveler_profile(parent_id, child_id)
        except FileNotFoundError:
            return None
        except OSError:
            return None
        sections = parse_markdown_sections(body)
        features = frontmatter.get("features")
        abilities = frontmatter.get("abilities")
        return {
            "species": str(frontmatter.get("species") or "").strip() or None,
            "palette": str(frontmatter.get("palette") or "").strip() or None,
            "features": [str(x).strip() for x in features if str(x).strip()]
            if isinstance(features, list)
            else [],
            "abilities": [str(x).strip() for x in abilities if str(x).strip()]
            if isinstance(abilities, list)
            else [],
            "vibe": str(frontmatter.get("vibe") or "").strip() or None,
            "description_md": sections.get("Descripción") or None,
            "outfit_md": sections.get("Atuendo") or None,
            "personality_md": sections.get("Personalidad") or None,
            "abilities_md": sections.get("Habilidades") or None,
            "updated_at": frontmatter.get("updated_at"),
            "source": "ledger",
        }

    def update_for_child(
        self,
        parent_id: str,
        child_id: str,
        *,
        child_snapshot: dict[str, Any],
        patch: dict[str, Any],
    ) -> dict[str, Any]:
        if not isinstance(patch, dict):
            raise ValueError("traveler_profile invalid")
        current = self.read_for_child(parent_id, child_id) or {}
        species = (
            _clean_short(patch["species"], max_len=64)
            if "species" in patch
            else current.get("species") or "explorador"
        )
        palette_raw = patch.get("palette") if "palette" in patch else current.get("palette")
        palette = _clean_optional_short(palette_raw, max_len=64)
        features = (
            _clean_features(patch.get("features"))
            if "features" in patch
            else list(current.get("features") or [])
        )
        vibe = (
            _clean_optional_short(patch.get("vibe"), max_len=80)
            if "vibe" in patch
            else current.get("vibe")
        )
        description_md = (
            _clean_optional_short(patch.get("description_md"), max_len=1200)
            if "description_md" in patch
            else current.get("description_md")
        )
        outfit_md = (
            _clean_optional_short(patch.get("outfit_md"), max_len=600)
            if "outfit_md" in patch
            else current.get("outfit_md")
        )
        personality_md = (
            _clean_optional_short(patch.get("personality_md"), max_len=600)
            if "personality_md" in patch
            else current.get("personality_md")
        )
        abilities = list(current.get("abilities") or [])
        body_parts: list[str] = []
        if description_md:
            body_parts.append(f"## Descripción\n\n{description_md}")
        if outfit_md:
            body_parts.append(f"## Atuendo\n\n{outfit_md}")
        if personality_md:
            body_parts.append(f"## Personalidad\n\n{personality_md}")
        if abilities:
            body_parts.append(
                "## Habilidades\n\n" + "\n".join(f"- {item}" for item in abilities)
            )
        if not body_parts and vibe:
            body_parts.append(f"## Descripción\n\n{vibe}.")
        front_matter = {
            "display_name": child_snapshot.get("display_name"),
            "world_theme": child_snapshot.get("world_theme"),
            "age_band": child_snapshot.get("age_band")
            or child_snapshot.get("effective_age_band"),
            "age_years": child_snapshot.get("age_years"),
            "explorer_gender": child_snapshot.get("explorer_gender"),
            "species": species,
            "features": features,
            "abilities": abilities,
        }
        if palette:
            front_matter["palette"] = palette
        if vibe:
            front_matter["vibe"] = vibe
        self.ledger.write_traveler_profile(
            parent_id,
            child_id,
            front_matter=front_matter,
            body_markdown="\n\n".join(body_parts),
        )
        return self.read_for_child(parent_id, child_id) or {}
