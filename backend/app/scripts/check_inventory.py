"""Dev helper: list child inventory rows."""

from __future__ import annotations

import asyncio
import sys

from sqlalchemy import text

from app.config import get_settings
from app.db import init_engine, session_scope

CHILD = "5c914daf-0578-44ce-97d3-2feb782a6f9f"


async def main() -> None:
    child_id = sys.argv[1] if len(sys.argv) > 1 else CHILD
    init_engine(get_settings())
    async with session_scope() as session:
        rows = (
            await session.execute(
                text(
                    "select id, item_def_id, instance_name, qty "
                    "from public.child_inventory_items "
                    "where child_id = :cid and world_theme = 'fantasy' "
                    "order by instance_name"
                ),
                {"cid": child_id},
            )
        ).mappings().all()
        print(f"inventory rows: {len(rows)}")
        for row in rows:
            print(dict(row))


if __name__ == "__main__":
    asyncio.run(main())
