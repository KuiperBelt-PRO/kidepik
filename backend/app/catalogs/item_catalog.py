from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.catalogs.subject_catalog import SubjectCatalog

_EFFECTS = frozenset(
    {
        "challenge_hint",
        "challenge_retry",
        "skip_wait_token",
        "unlock_minigame",
        "avatar_cosmetic",
    }
)
_KINDS_FANTASY = frozenset(
    {"potion", "artifact", "charm", "relic", "scroll", "weapon", "ward", "cloak"}
)
_KINDS_SCIFI = frozenset(
    {"program", "artifact", "module", "tech", "datapad", "blade", "barrier", "mesh"}
)
_RARITIES = frozenset({"common", "uncommon", "rare"})
_RARITY_ORDER = {"rare": 0, "uncommon": 1, "common": 2}


def _items_dir() -> Path:
    candidates: list[Path] = []
    try:
        from app.config import get_settings

        candidates.append(Path(get_settings().items_data_dir))
    except Exception:
        pass
    here = Path(__file__).resolve()
    # Repo layout: kidepik/backend/app/catalogs → kidepik/data/items
    candidates.append(here.parents[3] / "data" / "items")
    candidates.append(Path("/data/items"))
    for path in candidates:
        if (path / "fantasy.v1.json").is_file() and (path / "sci-fi.v1.json").is_file():
            return path
    raise FileNotFoundError("Item catalog JSON not found (data/items/*.v1.json)")


class ItemCatalog:
    """Definiciones de objetos de equipaje (fantasy / sci-fi)."""

    @classmethod
    @lru_cache(maxsize=1)
    def _defs(cls) -> dict[str, dict[str, Any]]:
        out: dict[str, dict[str, Any]] = {}
        base = _items_dir()
        for path in (base / "fantasy.v1.json", base / "sci-fi.v1.json"):
            raw = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(raw, list):
                raise ValueError(f"Item catalog must be a list: {path}")
            for row in raw:
                defn = cls._normalize(row)
                if defn["id"] in out:
                    raise ValueError(f"Duplicate item_def_id: {defn['id']}")
                out[defn["id"]] = defn
        if len(out) < 12:
            raise ValueError("Item catalog seed incomplete (expected ≥12 defs)")
        return out

    @classmethod
    def _normalize(cls, row: object) -> dict[str, Any]:
        if not isinstance(row, dict):
            raise ValueError("Item def must be an object")
        item_id = str(row.get("id") or "").strip()
        theme = str(row.get("world_theme") or "").strip()
        kind = str(row.get("kind") or "").strip()
        rarity = str(row.get("rarity") or "common").strip()
        if not item_id:
            raise ValueError("item id required")
        if theme not in {"fantasy", "sci-fi"}:
            raise ValueError(f"bad world_theme for {item_id}")
        if theme == "fantasy" and kind not in _KINDS_FANTASY:
            raise ValueError(f"bad fantasy kind for {item_id}")
        if theme == "sci-fi" and kind not in _KINDS_SCIFI:
            raise ValueError(f"bad sci-fi kind for {item_id}")
        if rarity not in _RARITIES:
            raise ValueError(f"bad rarity for {item_id}")
        subjects = [str(s) for s in (row.get("subject_ids") or []) if isinstance(s, str) and s]
        if not subjects or any(not SubjectCatalog.is_valid(s) for s in subjects):
            raise ValueError(f"bad subject_ids for {item_id}")
        effects = [str(e) for e in (row.get("effects") or []) if isinstance(e, str) and e]
        if not effects or any(e not in _EFFECTS for e in effects):
            raise ValueError(f"bad effects for {item_id}")
        prefix = "fantasy_" if theme == "fantasy" else "scifi_"
        if not item_id.startswith(prefix):
            raise ValueError(f"id prefix mismatch for {item_id}")
        return {
            "id": item_id,
            "world_theme": theme,
            "kind": kind,
            "rarity": rarity,
            "label_child": str(row.get("label_child") or item_id),
            "label_tutor": str(row.get("label_tutor") or row.get("label_child") or item_id),
            "description_child": str(row.get("description_child") or ""),
            "description_tutor": str(row.get("description_tutor") or row.get("description_child") or ""),
            "icon_id": str(row.get("icon_id") or "item-artifact"),
            "subject_ids": subjects,
            "effects": effects,
            "stackable": bool(row.get("stackable", True)),
            "unique": bool(row.get("unique", False)),
            "fallback_currency": max(1, int(row.get("fallback_currency") or 5)),
            "duplicate_currency": max(0, int(row.get("duplicate_currency") or 0)),
            "min_general_level": row.get("min_general_level")
            if isinstance(row.get("min_general_level"), str)
            else None,
            "age_bands": [str(a) for a in row.get("age_bands") or [] if isinstance(a, str)] or None,
        }

    @classmethod
    def get(cls, item_def_id: str) -> dict[str, Any] | None:
        return cls._defs().get(item_def_id)

    @classmethod
    def require(cls, item_def_id: str) -> dict[str, Any]:
        defn = cls.get(item_def_id)
        if not defn:
            raise ValueError(f"Unknown item_def_id: {item_def_id}")
        return defn

    @classmethod
    def list_for_world(cls, world_theme: str) -> list[dict[str, Any]]:
        theme = "sci-fi" if world_theme == "sci-fi" else "fantasy"
        return [d for d in cls._defs().values() if d["world_theme"] == theme]

    @classmethod
    def list_for_subject(cls, world_theme: str, subject_id: str) -> list[dict[str, Any]]:
        return [d for d in cls.list_for_world(world_theme) if subject_id in d["subject_ids"]]

    @classmethod
    def rarity_rank(cls, rarity: str) -> int:
        return _RARITY_ORDER.get(rarity, 9)

    @classmethod
    def effect_label(cls, effect_id: str) -> str:
        return {
            "challenge_hint": "Pista en retos",
            "challenge_retry": "Reintento de reto",
            "skip_wait_token": "Acortar espera",
            "unlock_minigame": "Desbloquear minijuego",
            "avatar_cosmetic": "Cosmético de avatar",
        }.get(effect_id, effect_id)

    @classmethod
    def effect_implemented(cls, effect_id: str) -> bool:
        return effect_id in {"challenge_hint", "challenge_retry"}
