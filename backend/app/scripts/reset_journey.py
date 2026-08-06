"""CLI: reset de viajeros al first_run.

Uso (dentro del contenedor api o venv backend):

  python -m app.scripts.reset_journey --dry-run
  python -m app.scripts.reset_journey --apply
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.config import get_settings
from app.services.journey_reset import reset_travelers


async def _main(dry_run: bool) -> int:
    settings = get_settings()
    if not settings.database_url:
        print("DATABASE_URL missing", file=sys.stderr)
        return 2
    url = settings.database_url
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    engine = create_async_engine(url, pool_pre_ping=True)
    Session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as session:
        report = await reset_travelers(session, dry_run=dry_run, settings=settings)
    print(json.dumps(report.to_dict(), ensure_ascii=False, indent=2))
    return 1 if report.errors else 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Reset travelers to first_run")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--dry-run", action="store_true")
    group.add_argument("--apply", action="store_true")
    args = parser.parse_args(argv)
    return asyncio.run(_main(dry_run=not args.apply))


if __name__ == "__main__":
    raise SystemExit(main())
