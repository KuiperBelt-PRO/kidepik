"""Glosario en capas L1/L2/L3 y composición (SPEC_APP_GLOSSARY_LAYERED_COMPOSITION)."""
from __future__ import annotations

import json
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

GlossaryLayer = Literal["ingredient", "reference", "canonical"]
ComposePurpose = Literal["mentor_prose", "species_chip", "zone_pitch"]
GlossaryWorld = Literal["fantasy", "sci-fi"]

COMPOSE_HINT = (
    "Combina los ingredientes en prosa o chips nuevos. "
    "Las referencias de tono son solo para el estilo: no copies sus nombres literal."
)

_FANTASY_SLOT_PLAN: dict[ComposePurpose, dict[str, int]] = {
    "species_chip": {
        "species": 2,
        "role_archetype": 1,
        "place_form": 1,
    },
    "mentor_prose": {
        "place_form": 1,
        "place_mood": 1,
        "place_lesson": 1,
    },
    "zone_pitch": {
        "place_form": 1,
        "place_mood": 1,
        "tone": 1,
    },
}

_SCIFI_SLOT_PLAN: dict[ComposePurpose, dict[str, int]] = {
    "species_chip": {
        "species": 2,
        "crew_role": 1,
        "sector_form": 1,
    },
    "mentor_prose": {
        "sector_form": 1,
        "signal_mood": 1,
        "mission_lesson": 1,
    },
    "zone_pitch": {
        "sector_form": 1,
        "signal_mood": 1,
        "tone": 1,
    },
}

_STYLE_REF_LIMIT: dict[ComposePurpose, int] = {
    "species_chip": 1,
    "mentor_prose": 1,
    "zone_pitch": 2,
}


@dataclass
class GlossaryIngredient:
    slot: str
    term: str
    definition: str
    tone_notes: str | None = None


@dataclass
class GlossaryStyleRef:
    id: str
    paraphrase_hint: str


@dataclass
class GlossaryComposeResult:
    ingredients: list[GlossaryIngredient]
    style_refs: list[GlossaryStyleRef]
    compose_hint: str = COMPOSE_HINT


def default_glossary_dir() -> Path:
    import os

    env = os.environ.get("GLOSSARY_DATA_DIR")
    if env:
        return Path(env)
    return Path(__file__).resolve().parents[4] / "data" / "glossary"


def normalize_layer(row: dict[str, Any]) -> GlossaryLayer:
    layer = str(row.get("layer") or "reference").strip().lower()
    if layer in {"ingredient", "reference", "canonical"}:
        return layer  # type: ignore[return-value]
    return "reference"


def load_glossary_rows(
    world: GlossaryWorld,
    *,
    glossary_dir: Path | None = None,
) -> list[dict[str, Any]]:
    root = glossary_dir or default_glossary_dir()
    rows: list[dict[str, Any]] = []
    for path in (root / f"{world}.jsonl", root / "shared.jsonl"):
        if not path.is_file():
            continue
        with path.open(encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line:
                    continue
                try:
                    row = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if isinstance(row, dict):
                    rows.append(row)
    return rows


def _slot_plan(world: GlossaryWorld, purpose: ComposePurpose) -> dict[str, int]:
    if world == "sci-fi":
        return dict(_SCIFI_SLOT_PLAN.get(purpose, _SCIFI_SLOT_PLAN["mentor_prose"]))
    return dict(_FANTASY_SLOT_PLAN.get(purpose, _FANTASY_SLOT_PLAN["mentor_prose"]))


def _pick_rows(
    pool: list[dict[str, Any]],
    count: int,
    rng: random.Random,
    *,
    exclude_terms: set[str],
) -> list[dict[str, Any]]:
    candidates = [
        r
        for r in pool
        if str(r.get("term") or "").strip().lower() not in exclude_terms
    ]
    rng.shuffle(candidates)
    return candidates[:count]


def glossary_compose(
    world: GlossaryWorld,
    *,
    purpose: ComposePurpose = "mentor_prose",
    slots: dict[str, int] | None = None,
    exclude_terms: list[str] | None = None,
    rotate_seed: int | None = None,
    glossary_dir: Path | None = None,
    age_band: str | None = None,
) -> GlossaryComposeResult:
    """Devuelve ingredientes L1 + referencias de tono L2 (no copiables)."""
    _ = age_band
    rows = load_glossary_rows(world, glossary_dir=glossary_dir)
    blocked = {t.strip().lower() for t in (exclude_terms or []) if str(t).strip()}
    rng = random.Random(rotate_seed)
    plan = slots or _slot_plan(world, purpose)

    by_slot: dict[str, list[dict[str, Any]]] = {}
    references: list[dict[str, Any]] = []
    for row in rows:
        layer = normalize_layer(row)
        if layer == "ingredient":
            slot = str(row.get("slot") or "").strip()
            if slot:
                by_slot.setdefault(slot, []).append(row)
        elif layer == "reference":
            references.append(row)

    ingredients: list[GlossaryIngredient] = []
    for slot, count in plan.items():
        picked = _pick_rows(by_slot.get(slot, []), count, rng, exclude_terms=blocked)
        for row in picked:
            ingredients.append(
                GlossaryIngredient(
                    slot=slot,
                    term=str(row.get("term") or ""),
                    definition=str(row.get("definition") or ""),
                    tone_notes=row.get("tone_notes"),
                )
            )

    ref_limit = _STYLE_REF_LIMIT.get(purpose, 1)
    style_refs: list[GlossaryStyleRef] = []
    for row in _pick_rows(references, ref_limit, rng, exclude_terms=blocked):
        surface = str(row.get("example_surface") or row.get("term") or "").strip()
        definition = str(row.get("definition") or "").strip()
        hint = definition
        if surface and surface.lower() in hint.lower():
            hint = (
                f"Escena con atmósfera similar a «{surface}», pero inventa otro nombre: "
                f"{definition}"
            )
        else:
            hint = f"Tono de referencia: {definition}"
        style_refs.append(
            GlossaryStyleRef(
                id=str(row.get("id") or ""),
                paraphrase_hint=hint,
            )
        )

    return GlossaryComposeResult(
        ingredients=ingredients,
        style_refs=style_refs,
    )


def format_glossary_compose_block(
    result: GlossaryComposeResult,
    *,
    header: str | None = None,
) -> str:
    lines: list[str] = [
        header
        or "Vocabulario composable (ingredientes + tono; no copies frases cerradas del glosario):",
    ]
    if result.ingredients:
        lines.append("Ingredientes:")
        for ing in result.ingredients:
            tone = f" ({ing.tone_notes})" if ing.tone_notes else ""
            lines.append(f"- [{ing.slot}] {ing.term}: {ing.definition}{tone}")
    if result.style_refs:
        lines.append("Referencia de tono (parafrasea; NO uses estos nombres literal):")
        for ref in result.style_refs:
            lines.append(f"- {ref.paraphrase_hint}")
    lines.append(result.compose_hint)
    return "\n".join(lines)


def all_forbidden_surfaces(
    world: GlossaryWorld,
    *,
    glossary_dir: Path | None = None,
) -> list[str]:
    """Términos y example_surface de entradas con copy_policy forbid_literal."""
    phrases: list[str] = []
    seen: set[str] = set()
    for row in load_glossary_rows(world, glossary_dir=glossary_dir):
        policy = str(row.get("copy_policy") or "forbid_literal").strip().lower()
        if policy == "allow_canonical":
            continue
        for key in ("term", "example_surface"):
            value = str(row.get(key) or "").strip()
            lower = value.lower()
            if len(lower) >= 5 and lower not in seen:
                seen.add(lower)
                phrases.append(value)
    return phrases
