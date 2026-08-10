from __future__ import annotations

import pytest

from app.ai.journey.ledger import JourneyLedger
from app.services.traveler_profile import (
    TravelerProfileService,
    extract_palette_tokens,
    palette_is_meaningful,
    parse_markdown_sections,
)


@pytest.mark.unit
def test_extract_palette_tokens() -> None:
    tokens = extract_palette_tokens("Azul claro, blanco y plata")
    assert "azul" in tokens
    assert "blanco" in tokens
    assert "plata" in tokens
    assert "platead" in tokens


@pytest.mark.unit
def test_palette_is_meaningful() -> None:
    assert palette_is_meaningful("verde y dorado") is True
    assert palette_is_meaningful("Azul claro, blanco y plata") is True
    assert palette_is_meaningful("") is False
    assert palette_is_meaningful("violeta y plata") is False


@pytest.mark.unit
def test_parse_markdown_sections() -> None:
    body = "## Descripción\n\nHola.\n\n## Atuendo\n\nTúnica blanca."
    sections = parse_markdown_sections(body)
    assert sections["Descripción"] == "Hola."
    assert sections["Atuendo"] == "Túnica blanca."


@pytest.mark.unit
def test_traveler_profile_read_write_roundtrip(tmp_path) -> None:
    ledger = JourneyLedger(str(tmp_path))
    parent_id = "11111111-1111-4111-8111-111111111111"
    child_id = "22222222-2222-4222-8222-222222222222"
    ledger.write_traveler_profile(
        parent_id,
        child_id,
        front_matter={
            "species": "Intérprete del viento",
            "palette": "Azul claro, blanco y plata",
            "features": ["Ojos del cielo"],
        },
        body_markdown="## Descripción\n\nUna chica especial.",
    )
    svc = TravelerProfileService(str(tmp_path))
    read = svc.read_for_child(parent_id, child_id)
    assert read is not None
    assert read["species"] == "Intérprete del viento"
    assert read["description_md"] == "Una chica especial."

    updated = svc.update_for_child(
        parent_id,
        child_id,
        child_snapshot={"display_name": "Aleria", "world_theme": "fantasy"},
        patch={"palette": "", "species": "Exploradora del bosque"},
    )
    assert updated["species"] == "Exploradora del bosque"
    assert updated.get("palette") in (None, "")

    reread = svc.read_for_child(parent_id, child_id)
    assert reread is not None
    assert "palette" not in (ledger.read_traveler_profile(parent_id, child_id)[0])
