"""Tests for path_composer_context."""

from __future__ import annotations

from app.services.path_composer_context import PathComposerContextService


def test_tutor_boost_for_note_keywords() -> None:
    assert PathComposerContextService.tutor_boost_for_note("") == 0.0
    assert PathComposerContextService.tutor_boost_for_note("nota") == 1.0
    assert PathComposerContextService.tutor_boost_for_note("hay que reforzar tablas") == 1.5
    assert PathComposerContextService.tutor_boost_for_note("nota", prioritized=True) == 3.0
    assert PathComposerContextService.tutor_boost_for_note("", prioritized=True) == 2.0


def test_prompt_sections_include_per_path_notes() -> None:
    context = {
        "general_note": "Muy adelantado",
        "subject_notes": {"math": "Divisiones de 2 cifras"},
        "path_slots": [
            {"slot_index": 0, "subject_id": "math", "tutor_note": "Divisiones de 2 cifras"},
            {"slot_index": 1, "subject_id": "language", "tutor_note": None},
            {"slot_index": 2, "subject_id": "logic", "tutor_note": None},
        ],
    }
    sections = PathComposerContextService.prompt_sections(context)
    joined = "\n".join(sections)
    assert "## Contexto del tutor" in joined
    assert "Divisiones de 2 cifras" in joined
    assert "Camino 1 → materia math" in joined


def test_placement_tutor_sections() -> None:
    child = {
        "settings": {
            "learning": {
                "general_note": "Muy adelantado",
                "subject_notes": [{"subject_id": "math", "note": "Tablas del 7"}],
                "subject_priorities": ["language"],
            }
        }
    }
    sections = PathComposerContextService.placement_tutor_sections(
        child, ["math", "language"]
    )
    joined = "\n".join(sections)
    assert "examen de ingreso" in joined
    assert "Tablas del 7" in joined
    assert "priorizada" in joined


def test_rank_subjects_boosts_priority_flag() -> None:
    child = {
        "settings": {
            "learning": {
                "active_subjects": ["math", "language", "logic"],
                "subject_priorities": ["logic"],
            }
        },
    }
    rows = [
        {"subject_id": "math", "level_id": "L2", "accuracy_rolling": 0.5},
        {"subject_id": "language", "level_id": "L2", "accuracy_rolling": 0.5},
        {"subject_id": "logic", "level_id": "L2", "accuracy_rolling": 0.5},
    ]
    ranked = PathComposerContextService.rank_subjects(child, subject_rows=rows, limit=3)
    assert ranked[0]["subject_id"] == "logic"


def test_rank_subjects_boosts_noted_subject() -> None:
    child = {
        "settings": {
            "learning": {
                "active_subjects": ["math", "language", "logic"],
                "subject_notes": [{"subject_id": "logic", "note": "Reforzar secuencias"}],
            }
        },
    }
    rows = [
        {"subject_id": "math", "level_id": "L2", "accuracy_rolling": 0.5},
        {"subject_id": "language", "level_id": "L2", "accuracy_rolling": 0.5},
        {"subject_id": "logic", "level_id": "L2", "accuracy_rolling": 0.5},
    ]
    ranked = PathComposerContextService.rank_subjects(child, subject_rows=rows, limit=3)
    assert ranked[0]["subject_id"] == "logic"
