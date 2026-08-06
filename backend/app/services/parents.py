from __future__ import annotations

import re
from typing import Any

from sqlalchemy import text

from app.db import session_scope


class ParentAccountService:
    @staticmethod
    def normalize_display_name(value: object) -> str | None:
        if value is None:
            return None
        if not isinstance(value, str):
            raise ValueError("display_name must be a string")
        trimmed = value.strip()
        if not trimmed:
            return None
        if len(trimmed) > 40:
            raise ValueError("display_name too long")
        if not re.fullmatch(r"[\w\d '\-]+", trimmed, re.UNICODE):
            raise ValueError("display_name invalid characters")
        return trimmed

    async def find_by_auth_user_id(self, auth_user_id: str) -> dict[str, Any] | None:
        async with session_scope() as session:
            row = (
                await session.execute(
                    text(
                        """
                        select id, auth_user_id, email, display_name, avatar_url
                        from public.parent_accounts
                        where auth_user_id = :auth_user_id
                        limit 1
                        """
                    ),
                    {"auth_user_id": auth_user_id},
                )
            ).mappings().first()
        return self._map(row) if row else None

    async def bootstrap(
        self,
        auth_user_id: str,
        email: str,
        display_name: str | None = None,
        avatar_url: str | None = None,
    ) -> dict[str, Any]:
        existing = await self.find_by_auth_user_id(auth_user_id)
        if existing:
            return {
                "parent_id": existing["parent_id"],
                "auth_user_id": auth_user_id,
                "email": email,
                "created": False,
            }
        async with session_scope() as session:
            row = (
                await session.execute(
                    text(
                        """
                        insert into public.parent_accounts (auth_user_id, email, display_name, avatar_url)
                        values (:auth_user_id, :email, :display_name, :avatar_url)
                        on conflict (auth_user_id) do nothing
                        returning id
                        """
                    ),
                    {
                        "auth_user_id": auth_user_id,
                        "email": email,
                        "display_name": display_name,
                        "avatar_url": avatar_url,
                    },
                )
            ).mappings().first()
        if row:
            return {
                "parent_id": str(row["id"]),
                "auth_user_id": auth_user_id,
                "email": email,
                "created": True,
            }
        existing = await self.find_by_auth_user_id(auth_user_id)
        if not existing:
            raise RuntimeError("Failed to bootstrap parent account")
        return {
            "parent_id": existing["parent_id"],
            "auth_user_id": auth_user_id,
            "email": email,
            "created": False,
        }

    async def get_or_bootstrap(
        self,
        auth_user_id: str,
        email: str,
        display_name: str | None = None,
        avatar_url: str | None = None,
    ) -> dict[str, Any]:
        await self.bootstrap(auth_user_id, email, display_name, avatar_url)
        account = await self.find_by_auth_user_id(auth_user_id)
        if not account:
            raise RuntimeError("Failed to load parent account")
        return account

    async def update_display_name(self, auth_user_id: str, display_name: object) -> dict[str, Any]:
        normalized = self.normalize_display_name(display_name)
        async with session_scope() as session:
            result = await session.execute(
                text(
                    """
                    update public.parent_accounts
                    set display_name = :display_name, updated_at = now()
                    where auth_user_id = :auth_user_id
                    """
                ),
                {"display_name": normalized, "auth_user_id": auth_user_id},
            )
            if result.rowcount == 0:
                raise RuntimeError("Parent account not found")
        account = await self.find_by_auth_user_id(auth_user_id)
        if not account:
            raise RuntimeError("Parent account not found")
        return account

    async def delete_account(self, auth_user_id: str) -> bool:
        async with session_scope() as session:
            await session.execute(
                text("delete from public.parent_accounts where auth_user_id = :auth_user_id"),
                {"auth_user_id": auth_user_id},
            )
            try:
                await session.execute(
                    text("delete from auth.users where id = :auth_user_id"),
                    {"auth_user_id": auth_user_id},
                )
            except Exception:
                pass
        return True

    @staticmethod
    def _map(row: Any) -> dict[str, Any]:
        return {
            "parent_id": str(row["id"]),
            "auth_user_id": str(row["auth_user_id"]),
            "email": str(row["email"]),
            "display_name": row["display_name"] if isinstance(row["display_name"], str) else None,
            "avatar_url": row["avatar_url"] if isinstance(row["avatar_url"], str) else None,
            "provider": "google",
        }
