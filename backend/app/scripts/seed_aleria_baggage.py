"""Seed extra baggage rows for local dev (Aleria). Run: python -m app.scripts.seed_aleria_baggage"""

from __future__ import annotations

import asyncio

from sqlalchemy import text

from app.db import init_engine, session_scope
from app.config import get_settings

ALERIA_ID = "5c914daf-0578-44ce-97d3-2feb782a6f9f"
WORLD = "fantasy"

SEED_ROWS = [
    ("fantasy_potion_focus_math", "Elixir de sumas veladas", "Una gota que aclara los números del reto."),
    ("fantasy_charm_second_chance_math", "Medallón del segundo golpe", "Segunda oportunidad en retos de matemáticas."),
    ("fantasy_artifact_logic_lens", "Lente del enigma", "Aclara los caminos en retos de lógica."),
    ("fantasy_relic_science_orb", "Orbe alquímico menor", "Susurra pistas de ciencias al explorador."),
    ("fantasy_potion_focus_language", "Brebaje de sílabas", "Ordena las palabras cuando el reto se enreda."),
    ("fantasy_charm_second_chance_reading", "Rollo del retorno", "Una segunda voz para retos de lectura."),
]


async def main() -> None:
    init_engine(get_settings())
    async with session_scope() as session:
        for item_def_id, name, desc in SEED_ROWS:
            exists = (
                await session.execute(
                    text(
                        """
                        select 1 from public.child_inventory_items
                        where child_id = :child_id and world_theme = :theme
                          and item_def_id = :def and instance_name = :name
                        """
                    ),
                    {
                        "child_id": ALERIA_ID,
                        "theme": WORLD,
                        "def": item_def_id,
                        "name": name,
                    },
                )
            ).first()
            if exists:
                continue
            await session.execute(
                text(
                    """
                    insert into public.child_inventory_items
                      (child_id, world_theme, item_def_id, qty, instance_name, instance_description)
                    values
                      (:child_id, :theme, :def, 1, :name, :desc)
                    """
                ),
                {
                    "child_id": ALERIA_ID,
                    "theme": WORLD,
                    "def": item_def_id,
                    "name": name,
                    "desc": desc,
                },
            )
    total = (
        await session.execute(
            text(
                "select count(*) from public.child_inventory_items where child_id = :id and world_theme = :theme"
            ),
            {"id": ALERIA_ID, "theme": WORLD},
        )
    ).scalar_one()
    print(f"Seeded up to {len(SEED_ROWS)} items for Aleria ({ALERIA_ID}). Total rows: {total}.")


if __name__ == "__main__":
    asyncio.run(main())
