"""Inspección rápida: ¿qué turnos llevan model_used (Gemini)?"""
from __future__ import annotations

import asyncio

from sqlalchemy import text

from app.config import get_settings
from app.db import dispose_engine, init_engine, session_scope


async def main() -> None:
    init_engine(get_settings())
    async with session_scope() as session:
        rows = (
            await session.execute(
                text(
                    """
                    select c.display_name, dt.sequence, dt.role,
                           left(dt.text, 90) as text,
                           dt.meta->>'phase' as phase,
                           dt.model_used, dt.created_at
                    from dialogue_turns dt
                    join children c on c.id = dt.child_id
                    order by dt.created_at desc
                    limit 20
                    """
                )
            )
        ).mappings().all()
        with_model = sum(1 for r in rows if r["model_used"])
        print(f"turns={len(rows)} with_model_used={with_model}")
        for r in rows:
            print(
                f"{r['created_at']} | {r['display_name']} | seq={r['sequence']} | "
                f"phase={r['phase']} | model={r['model_used'] or '-'} | {r['text']}"
            )
    await dispose_engine()


if __name__ == "__main__":
    asyncio.run(main())
