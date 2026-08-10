from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from app.ai.journey.ledger import JourneyLedger
from app.ai.orchestrator.tools import (
    GlossaryHit,
    default_glossary_dir,
    glossary_search,
    ledger_recent_avoid_phrases,
    ledger_recent_stems,
)


@pytest.mark.unit
def test_default_glossary_dir_env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("GLOSSARY_DATA_DIR", str(tmp_path))
    assert default_glossary_dir() == tmp_path


@pytest.mark.unit
def test_glossary_search_filters(tmp_path: Path) -> None:
    world_file = tmp_path / "fantasy.jsonl"
    world_file.write_text(
        "\n".join(
            [
                json.dumps(
                    {
                        "id": "g1",
                        "world": "fantasy",
                        "kind": "creature",
                        "term": "Draco",
                        "definition": "Un dragón amable",
                        "tags": ["bosque"],
                    }
                ),
                json.dumps(
                    {
                        "id": "g2",
                        "world": "fantasy",
                        "kind": "place",
                        "term": "Torre",
                        "definition": "Torre antigua",
                        "tags": "[]",
                    }
                ),
            ]
        ),
        encoding="utf-8",
    )
    hits = glossary_search(
        "fantasy",
        kind="creature",
        query="draco",
        tags=["bosque"],
        glossary_dir=tmp_path,
    )
    assert len(hits) == 1
    assert isinstance(hits[0], GlossaryHit)
    assert hits[0].term == "Draco"


@pytest.mark.unit
def test_glossary_search_skips_bad_json_lines(tmp_path: Path) -> None:
    path = tmp_path / "fantasy.jsonl"
    path.write_text('{"id":"x","term":"A","definition":"B","kind":"k"}\n{broken\n', encoding="utf-8")
    hits = glossary_search("fantasy", glossary_dir=tmp_path)
    assert len(hits) == 1


@pytest.mark.unit
def test_ledger_recent_stems() -> None:
    ledger = MagicMock(spec=JourneyLedger)
    ledger.read_dialogue.return_value = [
        {"payload": {"item_key": "stem-1"}, "text": "  hola mundo  "},
        {"payload": {}, "text": "otro"},
        {"payload": {"stem": "stem-2"}},
    ]
    stems = ledger_recent_stems(ledger, "parent", "child", world_theme="fantasy", limit=3)
    assert stems == ["stem-1", "hola mundo", "otro", "stem-2"][-3:]


@pytest.mark.unit
def test_glossary_search_excludes_terms(tmp_path: Path) -> None:
    world_file = tmp_path / "fantasy.jsonl"
    world_file.write_text(
        "\n".join(
            [
                json.dumps(
                    {
                        "id": "g1",
                        "world": "fantasy",
                        "kind": "place_type",
                        "term": "puente de niebla",
                        "definition": "Pasarela vaporosa",
                    }
                ),
                json.dumps(
                    {
                        "id": "g2",
                        "world": "fantasy",
                        "kind": "place_type",
                        "term": "claro de cristales",
                        "definition": "Claro luminoso",
                    }
                ),
            ]
        ),
        encoding="utf-8",
    )
    hits = glossary_search(
        "fantasy",
        glossary_dir=tmp_path,
        exclude_terms=["puente de niebla"],
    )
    terms = [h.term for h in hits]
    assert "puente de niebla" not in terms
    assert "claro de cristales" in terms


@pytest.mark.unit
def test_glossary_search_rotate_seed_changes_order(tmp_path: Path) -> None:
    world_file = tmp_path / "fantasy.jsonl"
    rows = [
        json.dumps(
            {
                "id": f"g{i}",
                "world": "fantasy",
                "kind": "place_type",
                "term": f"lugar-{i}",
                "definition": f"Def {i}",
            }
        )
        for i in range(6)
    ]
    world_file.write_text("\n".join(rows), encoding="utf-8")
    order_a = [h.term for h in glossary_search("fantasy", glossary_dir=tmp_path, rotate_seed=1)]
    order_b = [h.term for h in glossary_search("fantasy", glossary_dir=tmp_path, rotate_seed=99)]
    assert order_a != order_b


@pytest.mark.unit
def test_ledger_recent_avoid_phrases(tmp_path: Path) -> None:
    glossary = tmp_path / "fantasy.jsonl"
    glossary.write_text(
        json.dumps(
            {
                "id": "g1",
                "world": "fantasy",
                "kind": "place_type",
                "term": "puente de niebla",
                "definition": "Pasarela vaporosa",
            }
        ),
        encoding="utf-8",
    )
    ledger = MagicMock(spec=JourneyLedger)
    ledger.read_dialogue.return_value = [
        {
            "text": "Mira las piedras rúnicas junto al puente de niebla.",
            "payload": {
                "options": [
                    {"label": "El mago del Puente de Niebla"},
                ]
            },
        },
    ]
    avoid = ledger_recent_avoid_phrases(
        ledger,
        "parent",
        "child",
        "fantasy",
        glossary_dir=tmp_path,
    )
    lowered = {p.lower() for p in avoid}
    assert "puente de niebla" in lowered
    assert "el mago del puente de niebla" in lowered
