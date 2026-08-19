"""Seed extra baggage rows for local dev (Aleria). Run: python -m app.scripts.seed_aleria_baggage"""

from __future__ import annotations

import argparse
import asyncio

from sqlalchemy import text

from app.db import init_engine, session_scope
from app.config import get_settings

ALERIA_ID = "5c914daf-0578-44ce-97d3-2feb782a6f9f"
WORLD = "fantasy"

# (item_def_id, instance_name, instance_description)
SEED_ROWS: list[tuple[str, str, str]] = [
    ("fantasy_potion_focus_math", "Elixir de sumas veladas", "Una gota que aclara los números del reto."),
    ("fantasy_scroll_table_runes", "Pergamino de tablas", "Runas que ordenan las operaciones del reto."),
    ("fantasy_ward_counting_ring", "Anillo del contador", "Te ayuda a agrupar cantidades antes de responder."),
    ("fantasy_charm_second_chance_math", "Medallón del segundo golpe", "Segunda oportunidad en retos de matemáticas."),
    (
        "fantasy_charm_second_chance_math",
        "Amuleto de la segunda oportunidad",
        "Otra copia para reintentar retos de números sin ver la pista.",
    ),
    ("fantasy_artifact_logic_lens", "Lente del enigma", "Aclara los caminos en retos de lógica."),
    ("fantasy_relic_science_orb", "Orbe alquímico menor", "Susurra pistas de ciencias al explorador."),
    ("fantasy_potion_focus_language", "Brebaje de sílabas", "Ordena las palabras cuando el reto se enreda."),
    ("fantasy_charm_second_chance_reading", "Rollo del retorno", "Una segunda voz para retos de lectura."),
    (
        "fantasy_charm_second_chance_logic",
        "Talismán del laberinto",
        "Segunda oportunidad en retos de lógica.",
    ),
    (
        "fantasy_charm_second_chance_science",
        "Reliquia del segundo intento",
        "Segunda oportunidad en retos de ciencias.",
    ),
]

RETRY_DEF_IDS = frozenset(
    {
        "fantasy_charm_second_chance_math",
        "fantasy_charm_second_chance_reading",
        "fantasy_charm_second_chance_logic",
        "fantasy_charm_second_chance_science",
        "scifi_module_retry_math",
        "scifi_module_retry_reading",
    }
)


async def _seed_child(
    session,
    child_id: str,
    world_theme: str,
    rows: list[tuple[str, str, str]],
) -> int:
    inserted = 0
    for item_def_id, name, desc in rows:
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
                    "child_id": child_id,
                    "theme": world_theme,
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
                "child_id": child_id,
                "theme": world_theme,
                "def": item_def_id,
                "name": name,
                "desc": desc,
            },
        )
        inserted += 1
    return inserted


async def main() -> None:
    parser = argparse.ArgumentParser(description="Seed dev baggage (retry items incluidos).")
    parser.add_argument("--child-id", default=ALERIA_ID, help="Explorador (default: Aleria)")
    parser.add_argument("--world", default=WORLD, choices=("fantasy", "sci-fi"))
    parser.add_argument(
        "--retry-only",
        action="store_true",
        help="Solo ítems challenge_retry del mundo indicado",
    )
    args = parser.parse_args()

    rows = SEED_ROWS
    if args.retry_only:
        if args.world == "sci-fi":
            rows = [
                (
                    "scifi_module_retry_math",
                    "Módulo de segundo ciclo",
                    "Reinicia un reto de números fallido.",
                ),
                (
                    "scifi_module_retry_reading",
                    "Holopad de segunda voz",
                    "Repite un reto de lectura.",
                ),
            ]
        else:
            rows = [r for r in SEED_ROWS if r[0] in RETRY_DEF_IDS]

    init_engine(get_settings())
    async with session_scope() as session:
        inserted = await _seed_child(session, args.child_id, args.world, rows)
        total = (
            await session.execute(
                text(
                    "select count(*) from public.child_inventory_items "
                    "where child_id = :id and world_theme = :theme"
                ),
                {"id": args.child_id, "theme": args.world},
            )
        ).scalar_one()
    print(
        f"Seeded {inserted} new row(s) for {args.child_id} ({args.world}). "
        f"Total inventory rows: {total}."
    )


if __name__ == "__main__":
    asyncio.run(main())
