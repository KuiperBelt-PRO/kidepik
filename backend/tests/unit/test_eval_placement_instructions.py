from __future__ import annotations

import pytest

from app.scripts.eval_placement_instructions import _review_item


@pytest.mark.unit
def test_eval_flags_meaning_echo_option() -> None:
    issues = _review_item(
        {
            "presentation_text": (
                "El registro mostraba una anomalía inefable. "
                "¿Cuál es el significado preciso de 'inefable'?"
            ),
            "options": [
                {"id": "a", "label": "Inefable"},
                {"id": "b", "label": "Frecuente"},
                {"id": "c", "label": "Mesurable"},
            ],
            "correct_option_id": "a",
        }
    )
    assert "meaning_echo:inefable" in issues


@pytest.mark.unit
def test_eval_flags_meaning_echo_la_palabra() -> None:
    issues = _review_item(
        {
            "presentation_text": (
                "¿Cuál es el significado preciso de la palabra «inefable»?"
            ),
            "options": [
                {"id": "a", "label": "Que no se puede expresar con palabras"},
                {"id": "b", "label": "Inefable"},
                {"id": "c", "label": "Frecuente"},
            ],
            "correct_option_id": "a",
        }
    )
    assert "meaning_echo:inefable" in issues


@pytest.mark.unit
def test_eval_accepts_definition_chips() -> None:
    issues = _review_item(
        {
            "presentation_text": "¿Cuál es el significado de 'inefable'?",
            "options": [
                {"id": "a", "label": "Que no se puede explicar"},
                {"id": "b", "label": "Frecuente"},
                {"id": "c", "label": "Medible"},
            ],
            "correct_option_id": "a",
        }
    )
    assert issues == []
