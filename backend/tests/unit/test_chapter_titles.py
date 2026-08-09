"""Tests chapter_titles (SPEC_APP_JOURNEY_CHAPTERS)."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.services.chapter_titles import (
    adventure_chapter_from_progress,
    clear_chapter_catalog_cache,
    macro_chapter_key,
    resolve_chapter,
    system_title,
    validate_chapter_title,
)


@pytest.fixture(autouse=True)
def _reset_catalog_cache(monkeypatch, tmp_path):
    chapters_dir = tmp_path / "chapters"
    chapters_dir.mkdir()
    catalog = {
        "umbral": {"neutral": "El umbral", "fantasy": "El umbral", "sci-fi": "La puerta estelar"},
        "rito": {"fantasy": "La prueba del saber", "sci-fi": "La prueba de acceso"},
        "adventure_fallback": {"fantasy": "La senda continúa", "sci-fi": "Rumbo desconocido"},
    }
    (chapters_dir / "system_titles.es.json").write_text(
        json.dumps(catalog, ensure_ascii=False),
        encoding="utf-8",
    )
    monkeypatch.setenv("CHAPTERS_DATA_DIR", str(chapters_dir))
    clear_chapter_catalog_cache()
    yield
    clear_chapter_catalog_cache()


def test_system_titles_by_world() -> None:
    assert system_title("umbral", None) == "El umbral"
    assert system_title("umbral", "sci-fi") == "La puerta estelar"
    assert system_title("rito", "fantasy") == "La prueba del saber"
    assert system_title("rito", "sci-fi") == "La prueba de acceso"
    assert system_title("adventure", "fantasy") == "La senda continúa"
    assert system_title("adventure", "sci-fi") == "Rumbo desconocido"


@pytest.mark.parametrize(
    ("child", "phase", "expected"),
    [
        ({"onboarding_step": "choose_world"}, None, "umbral"),
        ({"onboarding_step": "placement", "placement_status": "not_started"}, "handoff_placement", "umbral"),
        ({"onboarding_step": "placement", "placement_status": "in_progress"}, None, "rito"),
        ({"onboarding_step": "placement", "placement_status": "in_progress"}, "placement_item", "rito"),
        ({"onboarding_step": "complete", "placement_status": "completed"}, None, "adventure"),
        ({"onboarding_step": "complete"}, "choose_path", "adventure"),
    ],
)
def test_macro_chapter_key(child: dict, phase: str | None, expected: str) -> None:
    assert macro_chapter_key(child, last_phase=phase) == expected


def test_validate_chapter_title() -> None:
    assert validate_chapter_title("abc") is None
    assert validate_chapter_title("El bosque") == "El bosque"
    assert validate_chapter_title("a\nb") is None


def test_adventure_from_path_progress() -> None:
    chapter = adventure_chapter_from_progress(
        {
            "path_id": "path_alpha",
            "challenge_index": 1,
            "path": {"path_id": "path_alpha", "title": "El bosque de los ecos"},
        },
        "fantasy",
    )
    assert chapter is not None
    assert chapter["id"] == "adventure:path_alpha:1"
    assert chapter["title"] == "El bosque de los ecos"
    assert chapter["source"] == "llm"


def test_resolve_chapter_umbral_and_adventure_fallback() -> None:
    umbral = resolve_chapter(
        {"onboarding_step": "choose_name"},
        world_theme="sci-fi",
        last_phase="choose_name",
    )
    assert umbral["id"] == "umbral"
    assert umbral["title"] == "La puerta estelar"
    assert umbral["source"] == "system"

    adventure = resolve_chapter(
        {"onboarding_step": "complete", "placement_status": "completed"},
        world_theme="fantasy",
        last_phase="choose_path",
    )
    assert adventure["id"] == "adventure"
    assert adventure["title"] == "La senda continúa"
