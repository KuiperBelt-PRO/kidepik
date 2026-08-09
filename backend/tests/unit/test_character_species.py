"""Tests de arquetipos fallback sugeridos."""
from __future__ import annotations

from app.catalogs.character_species import resolve_species_input, species_options_for_world


def test_species_options_per_world() -> None:
    fantasy = species_options_for_world("fantasy")
    scifi = species_options_for_world("sci-fi")
    assert len(fantasy) == 3
    assert len(scifi) == 3
    assert fantasy[0]["id"] == "mago_noche_blanca"
    assert scifi[0]["id"] == "cadete_humano"


def test_resolve_species_input_maps_chip_id() -> None:
    assert resolve_species_input("mago_noche_blanca", "fantasy") == "El mago de la noche blanca"
    assert (
        resolve_species_input("elfo_bosque_milenario", "fantasy")
        == "El elfo explorador del bosque milenario"
    )
    assert resolve_species_input("cadete_humano", "sci-fi") == "Cadete humano"
    assert resolve_species_input("mi criatura única", "fantasy") == "mi criatura única"
