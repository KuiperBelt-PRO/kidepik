"""CLI: asignar grupo de cuenta a un tutor por email."""

from __future__ import annotations

import argparse
import asyncio

from app.config import get_settings
from app.db import init_engine
from app.services.account_authorization import AccountAuthorizationService


async def main() -> None:
    init_engine(get_settings())
    parser = argparse.ArgumentParser(description="Grant an app group to a parent account by email.")
    parser.add_argument("--email", required=True, help="Email del tutor (parent_accounts.email)")
    parser.add_argument(
        "--group",
        required=True,
        help="Slug del grupo (p. ej. developers, admins)",
    )
    args = parser.parse_args()

    ok = await AccountAuthorizationService().grant_group_by_email(args.email, args.group)
    if not ok:
        raise SystemExit(
            f"No se pudo asignar grupo '{args.group}' a '{args.email}' "
            "(cuenta inexistente o grupo desconocido)."
        )
    print(f"OK: {args.email} → grupo '{args.group}'")


if __name__ == "__main__":
    asyncio.run(main())
