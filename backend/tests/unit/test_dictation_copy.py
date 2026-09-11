from __future__ import annotations

import pytest

from app.services.dictation_cards import listen_prompt, start_dictation_option


@pytest.mark.unit
def test_start_dictation_option_is_world_specific() -> None:
    sci = start_dictation_option("sci-fi")
    fan = start_dictation_option("fantasy")
    assert sci["id"] == fan["id"] == "start_dictation"
    assert sci["label"] == "Sintonizar el parte"
    assert fan["label"] == "Escuchar el recado"
    assert sci["label"] != fan["label"]


@pytest.mark.unit
def test_listen_prompt_is_world_specific() -> None:
    sci = listen_prompt("sci-fi")
    fan = listen_prompt("fantasy")
    assert "foto" in sci.lower()
    assert "papel" in fan.lower()
    assert sci != fan
