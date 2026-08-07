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
