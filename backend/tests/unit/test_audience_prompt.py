from __future__ import annotations

import pytest

from app.ai.agents.audience_prompt import (
    audience_instruction_block,
    needs_child_simple_language,
    prepend_audience_block,
)
from app.ai.skills.loader import load_skills_for_purpose


@pytest.mark.unit
@pytest.mark.parametrize("age", [5, 7, 8, 10])
def test_needs_child_simple_language_for_early_and_child_bands(age: int) -> None:
    assert needs_child_simple_language(age) is True


@pytest.mark.unit
@pytest.mark.parametrize("age", [11, 14])
def test_needs_child_simple_language_outside_reinforced_bands(age: int) -> None:
    assert needs_child_simple_language(age) is False


@pytest.mark.unit
def test_audience_instruction_block_early_band() -> None:
    block = audience_instruction_block(6, "band_early")
    assert "band_early" in block
    assert "5–7" in block
    assert "12 palabras" in block


@pytest.mark.unit
def test_audience_instruction_block_child_band() -> None:
    block = audience_instruction_block(10, "band_child")
    assert "band_child" in block
    assert "8–10" in block
    assert "18 palabras" in block
    assert "Vigía Onírico" in block


@pytest.mark.unit
def test_prepend_audience_block_adds_child_rules() -> None:
    out = prepend_audience_block("hola", age_years=6, age_band="band_early")
    assert out.startswith("AUDIENCIA OBLIGATORIA")
    assert "band_early" in out
    assert "hola" in out


@pytest.mark.unit
def test_critical_skills_load_eager_not_deferred() -> None:
    caps = load_skills_for_purpose("character_coach")
    by_id = {cap.id: cap for cap in caps}
    assert by_id["audience-language"].defer_loading is False
    assert by_id["mentor-prose-clarity"].defer_loading is False
    assert by_id["original-ip"].defer_loading is True


@pytest.mark.unit
def test_placement_writer_loads_exam_skills_eager() -> None:
    caps = load_skills_for_purpose("placement_item_writer")
    by_id = {cap.id: cap for cap in caps}
    assert by_id["placement-exam"].defer_loading is False
    assert by_id["subject-pedagogy"].defer_loading is False
    assert by_id["original-ip"].defer_loading is True
