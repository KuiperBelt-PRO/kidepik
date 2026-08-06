"""Tools del orquestador: glosario DuckDB + consultas ledger."""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

from app.ai.journey.ledger import JourneyLedger


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
) -> list[GlossaryHit]:
    root = glossary_dir or default_glossary_dir()
    paths = [root / f"{world}.jsonl", root / "shared.jsonl"]
    rows: list[dict[str, Any]] = []
    for path in paths:
        if not path.is_file():
            continue
        try:
            import duckdb  # type: ignore

            con = duckdb.connect(database=":memory:")
            # read_json_auto handles ndjson
            escaped = str(path).replace("\\", "/")
            frame = con.execute(
                f"select * from read_json_auto('{escaped}', format='newline_delimited')"
            ).fetchall()
            cols = [d[0] for d in con.description]
            for tup in frame:
                rows.append(dict(zip(cols, tup, strict=False)))
        except Exception:
            with path.open(encoding="utf-8") as handle:
                for line in handle:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        rows.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue

    filtered = rows
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
