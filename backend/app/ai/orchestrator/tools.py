"""Tools del orquestador: glosario DuckDB + consultas ledger."""
from __future__ import annotations

import json
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

from app.ai.journey.ledger import JourneyLedger
from app.ai.orchestrator.glossary_layers import (
    all_forbidden_surfaces,
    format_glossary_compose_block,
    glossary_compose,
    load_glossary_rows,
    normalize_layer,
)


@dataclass
class GlossaryHit:
    id: str
    world: str
    kind: str
    term: str
    definition: str
    tags: list[str]
    tone_notes: str | None = None


def default_glossary_dir() -> Path:
    import os

    env = os.environ.get("GLOSSARY_DATA_DIR")
    if env:
        return Path(env)
    # backend/app/ai/orchestrator → repo root data/glossary
    return Path(__file__).resolve().parents[4] / "data" / "glossary"


def glossary_search(
    world: Literal["fantasy", "sci-fi"],
    *,
    kind: str | None = None,
    tags: list[str] | None = None,
    query: str | None = None,
    limit: int = 8,
    glossary_dir: Path | None = None,
    exclude_terms: list[str] | None = None,
    rotate_seed: int | None = None,
    layer: str | None = None,
) -> list[GlossaryHit]:
    root = glossary_dir or default_glossary_dir()
    rows = load_glossary_rows(world, glossary_dir=root)
    filtered = rows
    if layer:
        filtered = [r for r in filtered if normalize_layer(r) == layer]
    if kind:
        filtered = [r for r in filtered if r.get("kind") == kind]
    if query:
        q = query.lower()
        filtered = [
            r
            for r in filtered
            if q in str(r.get("term", "")).lower()
            or q in str(r.get("definition", "")).lower()
        ]
    if tags:
        filtered = [
            r for r in filtered if any(t in (r.get("tags") or []) for t in tags)
        ]
    if exclude_terms:
        blocked = {t.strip().lower() for t in exclude_terms if str(t).strip()}
        filtered = [
            r
            for r in filtered
            if str(r.get("term") or "").strip().lower() not in blocked
        ]
    if rotate_seed is not None:
        pool = list(filtered)
        rng = random.Random(rotate_seed)
        rng.shuffle(pool)
        filtered = pool
    out: list[GlossaryHit] = []
    for r in filtered[:limit]:
        tag_val = r.get("tags") or []
        if isinstance(tag_val, str):
            try:
                tag_val = json.loads(tag_val)
            except json.JSONDecodeError:
                tag_val = []
        out.append(
            GlossaryHit(
                id=str(r.get("id") or ""),
                world=str(r.get("world") or world),
                kind=str(r.get("kind") or ""),
                term=str(r.get("term") or ""),
                definition=str(r.get("definition") or ""),
                tags=list(tag_val),
                tone_notes=r.get("tone_notes"),
            )
        )
    return out


def _all_glossary_terms(
    world: Literal["fantasy", "sci-fi"],
    *,
    glossary_dir: Path | None = None,
) -> list[str]:
    """Todos los términos del glosario (lectura directa del JSONL)."""
    root = glossary_dir or default_glossary_dir()
    terms: list[str] = []
    seen: set[str] = set()
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
                term = str(row.get("term") or "").strip().lower()
                if len(term) < 2 or term in seen:
                    continue
                seen.add(term)
                terms.append(term)
    return terms


def ledger_recent_stems(
    ledger: JourneyLedger,
    parent_id: str,
    child_id: str,
    *,
    world_theme: str | None = None,
    limit: int = 20,
) -> list[str]:
    """Anti-repetición: item_key / stems recientes del ledger."""
    rows = ledger.read_dialogue(parent_id, child_id, limit=limit * 2)
    stems: list[str] = []
    for row in rows:
        payload = row.get("payload") or {}
        key = payload.get("item_key") or payload.get("stem")
        if isinstance(key, str) and key:
            stems.append(key)
        text = row.get("text")
        if isinstance(text, str) and text.strip():
            stems.append(text.strip()[:80])
    # world filter is path-based in ledger; dialogue already scoped per world when configured
    _ = world_theme
    return stems[-limit:]


def _collect_option_labels(payload: dict[str, Any]) -> list[str]:
    labels: list[str] = []
    for opt in payload.get("options") or []:
        if not isinstance(opt, dict):
            continue
        label = str(opt.get("label") or opt.get("text") or "").strip()
        if label:
            labels.append(label)
    return labels


def ledger_recent_avoid_phrases(
    ledger: JourneyLedger,
    parent_id: str,
    child_id: str,
    world_theme: str | None,
    *,
    glossary_dir: Path | None = None,
    limit_dialogue: int = 40,
) -> list[str]:
    """Términos del glosario y etiquetas de chips ya usados en el viaje."""
    world: Literal["fantasy", "sci-fi"] = (
        world_theme if world_theme in {"fantasy", "sci-fi"} else "fantasy"
    )
    glossary_terms = _all_glossary_terms(world, glossary_dir=glossary_dir)
    forbidden = all_forbidden_surfaces(world, glossary_dir=glossary_dir)
    rows = ledger.read_dialogue(parent_id, child_id, limit=limit_dialogue)
    avoid: list[str] = []
    seen: set[str] = set()

    def _remember(phrase: str) -> None:
        key = phrase.strip().lower()
        if len(key) < 5 or key in seen:
            return
        seen.add(key)
        avoid.append(phrase.strip())

    for row in rows:
        payload = row.get("payload") if isinstance(row.get("payload"), dict) else {}
        meta = row.get("meta") if isinstance(row.get("meta"), dict) else {}
        texts: list[str] = []
        if isinstance(row.get("text"), str) and row["text"].strip():
            texts.append(str(row["text"]))
        for label in _collect_option_labels(payload):
            _remember(label)
        for label in _collect_option_labels(meta):
            _remember(label)
        blob = " ".join(texts).lower()
        for term in glossary_terms:
            if len(term) >= 5 and term in blob:
                _remember(term)
        for surface in forbidden:
            if len(surface) >= 5 and surface.lower() in blob:
                _remember(surface)
    return avoid[-24:]
