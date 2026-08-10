from __future__ import annotations

import pytest

from app.services.mentor_prose import (
    franchise_violations_in_text,
    validate_audience_prose,
    validate_avoid_repetition,
    validate_mentor_prose,
    validate_species_options,
)


@pytest.mark.unit
def test_validate_audience_prose_flags_vigia_onirico_for_child() -> None:
    issues = validate_audience_prose(
        "Eres un Vigía Onírico. Un guardián de estrellas que cuida los sueños olvidados.",
        age_years=10,
    )
    assert any("difícil" in i or "pomposo" in i for i in issues)


@pytest.mark.unit
def test_simple_character_agent_text_uses_explorer_words() -> None:
    from app.services.mentor_prose import simple_character_agent_text

    text = simple_character_agent_text("Protector de los sueños abandonados")
    assert "Protector de los sueños abandonados" in text
    assert "onírico" not in text.lower()


@pytest.mark.unit
def test_validate_audience_prose_flags_adult_poetry_for_child() -> None:
    issues = validate_audience_prose(
        "Tú eres el Sentinela Onírico. Tu presencia es un remanso de plata "
        "en la penumbra de los recuerdos perdidos. Demuestra tu valía.",
        age_years=10,
    )
    assert any("difícil" in i for i in issues)


@pytest.mark.unit
def test_validate_audience_prose_accepts_simple_child_copy() -> None:
    issues = validate_audience_prose(
        "Eres el protector de los sueños olvidados. Llevas una capa plateada. "
        "¿Empezamos la prueba?",
        age_years=10,
    )
    assert issues == []


@pytest.mark.unit
def test_validate_mentor_prose_child_flags_complex_words() -> None:
    issues = validate_mentor_prose(
        "Tu esencia vibra con el claro mientras armamos un examen épico.",
        age_years=10,
    )
    assert any("vibra" in i for i in issues)


@pytest.mark.unit
def test_validate_mentor_prose_flags_llm_smell() -> None:
    issues = validate_mentor_prose(
        "Tu esencia vibra con el claro mientras armamos un examen épico.",
        age_years=42,
    )
    assert any("vibra" in i for i in issues)
    assert any("armamos" in i for i in issues)


@pytest.mark.unit
def test_validate_mentor_prose_accepts_plain_copy() -> None:
    issues = validate_mentor_prose(
        "Estamos en el claro de cristales. Dime cuántos años tienes para ajustar las preguntas."
    )
    assert issues == []


@pytest.mark.unit
def test_validate_species_options_requires_three() -> None:
    issues = validate_species_options(
        [{"id": "a", "label": "Uno"}, {"id": "b", "label": "Dos"}],
        "fantasy",
    )
    assert any("3" in i for i in issues)


@pytest.mark.unit
def test_validate_species_options_rejects_bad_slug() -> None:
    issues = validate_species_options(
        [
            {"id": "A", "label": "Zorro"},
            {"id": "b", "label": "Búho"},
            {"id": "c", "label": "Lince"},
        ],
        "fantasy",
    )
    assert any("slug" in i for i in issues)


@pytest.mark.unit
def test_validate_species_options_accepts_mixed_archetypes() -> None:
    issues = validate_species_options(
        [
            {"id": "mago_noche_blanca", "label": "El mago de la noche blanca"},
            {"id": "elfo_explorador", "label": "El elfo explorador del bosque"},
            {"id": "bibliotecaria", "label": "La bibliotecaria de Anderlogia"},
        ],
        "fantasy",
        age_years=10,
    )
    assert issues == []


@pytest.mark.unit
def test_validate_species_options_requires_non_human_in_label() -> None:
    issues = validate_species_options(
        [
            {"id": "tejedora_nieblas", "label": "La tejedora de nieblas"},
            {"id": "erudito_arboleda", "label": "El erudito de la arboleda"},
            {"id": "guardiana_claro", "label": "La guardiana del claro"},
        ],
        "fantasy",
    )
    assert any("especie no humana" in i for i in issues)


@pytest.mark.unit
def test_validate_mentor_prose_flags_franchise_reference() -> None:
    issues = validate_mentor_prose(
        "Bienvenido a Hogwarts, joven mago. Elige tu casa en Gryffindor."
    )
    assert any("franquicia" in i for i in issues)
    assert any("hogwarts" in i for i in issues)


@pytest.mark.unit
def test_validate_species_options_rejects_franchise_labels() -> None:
    issues = validate_species_options(
        [
            {"id": "jedi_aprendiz", "label": "El jedi aprendiz del templo"},
            {"id": "elfo_bosque", "label": "El elfo del bosque milenario"},
            {"id": "bibliotecaria", "label": "La bibliotecaria de Anderlogia"},
        ],
        "fantasy",
    )
    assert any("franquicia" in i for i in issues)


@pytest.mark.unit
def test_franchise_violations_ignores_generic_fantasy() -> None:
    assert franchise_violations_in_text("El elfo explorador del bosque milenario") == []


@pytest.mark.unit
def test_validate_species_options_slug_non_human_needs_species_in_label() -> None:
    issues = validate_species_options(
        [
            {"id": "mago_noche_blanca", "label": "El mago de la noche blanca"},
            {"id": "elfo_bosque", "label": "El explorador del bosque milenario"},
            {"id": "bibliotecaria", "label": "La bibliotecaria de Anderlogia"},
        ],
        "fantasy",
    )
    assert any("debe nombrar la especie" in i for i in issues)


@pytest.mark.unit
def test_validate_avoid_repetition_flags_glossary_term() -> None:
    issues = validate_avoid_repetition(
        "Elige si quieres cruzar el puente de niebla.",
        ["puente de niebla", "arboleda susurrante"],
    )
    assert any("puente de niebla" in i for i in issues)


@pytest.mark.unit
def test_validate_species_options_flags_repeated_glossary_label() -> None:
    issues = validate_species_options(
        [
            {"id": "elfo_arboleda", "label": "La elfa de la Arboleda Susurrante"},
            {"id": "orco_claro", "label": "El orco del claro de cristales"},
            {"id": "mago_puente", "label": "El mago del Puente de Niebla"},
        ],
        "fantasy",
        avoid_phrases=["puente de niebla"],
    )
    assert any("puente de niebla" in i.lower() for i in issues)
