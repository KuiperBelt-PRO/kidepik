from __future__ import annotations

import pytest

from app.ai.errors import AiProductError, classify_gemini_exception, product_error
from app.text_utils import CharacterSummaryBuilder, DisplayNameExtractor, SpeciesExtractor


@pytest.mark.unit
def test_character_summary_builder_basic() -> None:
    text = CharacterSummaryBuilder.build(
        "Mago humano",
        "índigo",
        ["curioso", "valiente"],
        vibe="metódico",
    )
    assert "Mago humano" in text
    assert "curioso" in text
    assert "metódico" in text


@pytest.mark.unit
@pytest.mark.parametrize(
    "raw,expected",
    [
        ("soy un mago viajero", "Mago Viajero"),
        ("me llamo Luna", "Luna"),
    ],
    ids=["species", "name"],
)
def test_extractors_pick_best(raw: str, expected: str) -> None:
    species = SpeciesExtractor.pick_best(raw)
    name = DisplayNameExtractor.pick_best(raw)
    assert species == expected or name == expected


@pytest.mark.unit
def test_ai_product_error_to_dict() -> None:
    err = product_error("ai_rate_limited", model="gemini-test")
    payload = err.to_dict()
    assert payload["error_code"] == "ai_rate_limited"
    assert payload["retryable"] is True
    assert payload["model"] == "gemini-test"


@pytest.mark.unit
def test_classify_api_key_error() -> None:
    class Exc(Exception):
        status_code = 403

    classified = classify_gemini_exception(Exc("invalid api key"))
    assert classified.error_code == "ai_not_configured"
    assert classified.advance_model is False


@pytest.mark.unit
def test_classify_safety_blocked() -> None:
    class Exc(Exception):
        status_code = 400

    classified = classify_gemini_exception(Exc("safety blocked content"))
    assert classified.error_code == "ai_safety_blocked"


@pytest.mark.unit
def test_character_summary_species_only_and_append() -> None:
    text = CharacterSummaryBuilder.build("elfo", "", [], explorer_note="soy un elfo")
    assert text == "elfo."
    merged = CharacterSummaryBuilder.append("Base", "Extra")
    assert "Extra" in merged
    assert CharacterSummaryBuilder.append("Base", "base") == "Base"


@pytest.mark.unit
def test_species_extractor_candidates_and_invalid() -> None:
    assert SpeciesExtractor.candidates("") == []
    assert SpeciesExtractor.is_valid_species("a") is False
    raw = "me gustaría ser un robot explorador"
    picks = SpeciesExtractor.candidates(raw)
    best = SpeciesExtractor.pick_best(raw)
    assert picks and best == picks[0]


@pytest.mark.unit
def test_display_name_extractor_candidates() -> None:
    assert DisplayNameExtractor.candidates("") == []
    assert DisplayNameExtractor.pick_best('mi nombre es "Aurora"') == "Aurora"
    assert DisplayNameExtractor.is_valid_name("será") is False
