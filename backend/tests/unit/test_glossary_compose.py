from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.ai.orchestrator.glossary_layers import (
    all_forbidden_surfaces,
    format_glossary_compose_block,
    glossary_compose,
    load_glossary_rows,
)
from app.ai.orchestrator.tools import glossary_search


@pytest.mark.unit
def test_glossary_compose_returns_ingredients_and_style_ref(tmp_path: Path) -> None:
    glossary = tmp_path / "fantasy.jsonl"
    rows = [
        {
            "id": "ing1",
            "world": "fantasy",
            "layer": "ingredient",
            "slot": "place_form",
            "term": "pasarela",
            "definition": "Camino estrecho.",
        },
        {
            "id": "ing2",
            "world": "fantasy",
            "layer": "ingredient",
            "slot": "place_mood",
            "term": "vapor tenue",
            "definition": "Niebla ligera.",
        },
        {
            "id": "ing3",
            "world": "fantasy",
            "layer": "ingredient",
            "slot": "place_lesson",
            "term": "paciencia",
            "definition": "Ir despacio.",
        },
        {
            "id": "ref1",
            "world": "fantasy",
            "layer": "reference",
            "term": "puente de niebla",
            "example_surface": "puente de niebla",
            "definition": "Pasarela vaporosa entre riscos.",
            "copy_policy": "forbid_literal",
        },
    ]
    glossary.write_text(
        "\n".join(json.dumps(r, ensure_ascii=False) for r in rows),
        encoding="utf-8",
    )
    result = glossary_compose(
        "fantasy",
        purpose="mentor_prose",
        glossary_dir=tmp_path,
        rotate_seed=7,
    )
    assert len(result.ingredients) == 3
    slots = {ing.slot for ing in result.ingredients}
    assert slots == {"place_form", "place_mood", "place_lesson"}
    assert len(result.style_refs) == 1
    block = format_glossary_compose_block(result)
    assert "pasarela" in block
    assert "NO uses estos nombres literal" in block
    assert "Combina los ingredientes" in block


@pytest.mark.unit
def test_glossary_compose_excludes_terms(tmp_path: Path) -> None:
    glossary = tmp_path / "fantasy.jsonl"
    rows = [
        {
            "id": "ing1",
            "world": "fantasy",
            "layer": "ingredient",
            "slot": "place_form",
            "term": "pasarela",
            "definition": "A",
        },
        {
            "id": "ing2",
            "world": "fantasy",
            "layer": "ingredient",
            "slot": "place_form",
            "term": "torre",
            "definition": "B",
        },
        {
            "id": "ing3",
            "world": "fantasy",
            "layer": "ingredient",
            "slot": "place_mood",
            "term": "vapor tenue",
            "definition": "C",
        },
        {
            "id": "ing4",
            "world": "fantasy",
            "layer": "ingredient",
            "slot": "place_lesson",
            "term": "paciencia",
            "definition": "D",
        },
    ]
    glossary.write_text(
        "\n".join(json.dumps(r, ensure_ascii=False) for r in rows),
        encoding="utf-8",
    )
    result = glossary_compose(
        "fantasy",
        purpose="mentor_prose",
        glossary_dir=tmp_path,
        exclude_terms=["pasarela"],
        rotate_seed=1,
    )
    terms = [ing.term for ing in result.ingredients]
    assert "pasarela" not in terms


@pytest.mark.unit
def test_glossary_search_filters_by_layer(tmp_path: Path) -> None:
    glossary = tmp_path / "fantasy.jsonl"
    rows = [
        {
            "id": "ing1",
            "world": "fantasy",
            "layer": "ingredient",
            "slot": "species",
            "kind": "species",
            "term": "elfo",
            "definition": "Bosque.",
        },
        {
            "id": "ref1",
            "world": "fantasy",
            "layer": "reference",
            "kind": "place_type",
            "term": "puente de niebla",
            "definition": "Vapor.",
        },
    ]
    glossary.write_text(
        "\n".join(json.dumps(r, ensure_ascii=False) for r in rows),
        encoding="utf-8",
    )
    hits = glossary_search("fantasy", glossary_dir=tmp_path, layer="ingredient")
    assert len(hits) == 1
    assert hits[0].term == "elfo"


@pytest.mark.unit
def test_all_forbidden_surfaces_includes_reference_terms(tmp_path: Path) -> None:
    glossary = tmp_path / "fantasy.jsonl"
    row = {
        "id": "ref1",
        "world": "fantasy",
        "layer": "reference",
        "term": "puente de niebla",
        "example_surface": "puente de niebla",
        "copy_policy": "forbid_literal",
        "definition": "Vapor.",
    }
    glossary.write_text(json.dumps(row, ensure_ascii=False) + "\n", encoding="utf-8")
    surfaces = all_forbidden_surfaces("fantasy", glossary_dir=tmp_path)
    assert any("puente de niebla" in s.lower() for s in surfaces)


@pytest.mark.unit
def test_load_glossary_rows_reads_shared(tmp_path: Path) -> None:
    fantasy = tmp_path / "fantasy.jsonl"
    shared = tmp_path / "shared.jsonl"
    fantasy.write_text(
        json.dumps(
            {
                "id": "f1",
                "world": "fantasy",
                "layer": "ingredient",
                "slot": "tone",
                "term": "calma",
                "definition": "x",
            }
        )
        + "\n",
        encoding="utf-8",
    )
    shared.write_text(
        json.dumps(
            {
                "id": "s1",
                "world": "shared",
                "layer": "ingredient",
                "slot": "tone",
                "term": "universal",
                "definition": "y",
            }
        )
        + "\n",
        encoding="utf-8",
    )
    rows = load_glossary_rows("fantasy", glossary_dir=tmp_path)
    assert len(rows) == 2
