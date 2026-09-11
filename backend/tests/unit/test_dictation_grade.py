from __future__ import annotations

import pytest

from app.services.dictation_grade import (
    grade_transcription,
    pass_threshold_for_band,
    tokenize_dictation,
)


@pytest.mark.unit
def test_perfect_match_passes_early() -> None:
    result = grade_transcription(
        "El sol brilla alto.",
        "El sol brilla alto.",
        "band_early",
    )
    assert result["score"] == 1.0
    assert result["passed"] is True
    assert result["errors"] == []


@pytest.mark.unit
def test_accent_counts_as_error_and_may_still_pass() -> None:
    result = grade_transcription(
        "El árbol es grande y bonito hoy.",
        "El arbol es grande y bonito hoy.",
        "band_early",
    )
    assert 0.0 < result["score"] < 1.0
    classes = [e["error_class"] for e in result["errors"]]
    assert "accent" in classes
    assert result["passed"] is True


@pytest.mark.unit
def test_grapheme_bv_classified() -> None:
    result = grade_transcription("La vaca come.", "La baca come.", "band_child")
    classes = [e["error_class"] for e in result["errors"]]
    assert "grapheme" in classes


@pytest.mark.unit
def test_capitalization_error() -> None:
    result = grade_transcription("Madrid es grande.", "madrid es grande.", "band_tween")
    classes = [e["error_class"] for e in result["errors"]]
    assert "capitalization" in classes


@pytest.mark.unit
def test_teen_threshold_stricter() -> None:
    assert pass_threshold_for_band("band_early") == 0.75
    assert pass_threshold_for_band("band_teen") == 0.90
    canonical = "Uno dos tres cuatro cinco seis siete ocho"
    # 4 of 8 tokens wrong -> 0.5, fails teen
    result = grade_transcription(
        canonical,
        "Uno dos tres cuatro cinco xx yy zz",
        "band_teen",
    )
    assert result["passed"] is False
    assert result["score"] < 0.9


@pytest.mark.unit
def test_nfc_normalization() -> None:
    # á as composed vs combining
    canonical = "está"
    transcribed = "esta\u0301"
    result = grade_transcription(canonical, transcribed, "band_child")
    assert result["score"] == 1.0


@pytest.mark.unit
def test_tokenize_keeps_words() -> None:
    tokens = tokenize_dictation("¡Hola, mundo!")
    assert "Hola" in tokens
    assert "mundo" in tokens
