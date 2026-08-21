"""Grupos y permisos de cuenta tutor (RBAC ligero)."""
from __future__ import annotations

from typing import Any

from sqlalchemy import text

from app.db import session_scope


class AccountAuthorizationService:
    async def has_permission(self, parent_id: str, permission_slug: str) -> bool:
        async with session_scope() as session:
            value = (
                await session.execute(
                    text(
                        """
                        select 1
                        from public.parent_account_groups pag
                        join public.app_groups g on g.id = pag.group_id
                        join public.app_group_permissions agp on agp.group_id = g.id
                        join public.app_permissions p on p.id = agp.permission_id
                        where pag.parent_id = :parent_id
                          and p.slug = :permission_slug
                        limit 1
                        """
                    ),
                    {"parent_id": parent_id, "permission_slug": permission_slug},
                )
            ).scalar_one_or_none()
        return value is not None

    async def list_permissions(self, parent_id: str) -> list[str]:
        async with session_scope() as session:
            rows = (
                await session.execute(
                    text(
                        """
                        select distinct p.slug
                        from public.parent_account_groups pag
                        join public.app_groups g on g.id = pag.group_id
                        join public.app_group_permissions agp on agp.group_id = g.id
                        join public.app_permissions p on p.id = agp.permission_id
                        where pag.parent_id = :parent_id
                        order by p.slug
                        """
                    ),
                    {"parent_id": parent_id},
                )
            ).scalars().all()
        return [str(slug) for slug in rows]

    async def list_groups(self, parent_id: str) -> list[str]:
        async with session_scope() as session:
            rows = (
                await session.execute(
                    text(
                        """
                        select g.slug
                        from public.parent_account_groups pag
                        join public.app_groups g on g.id = pag.group_id
                        where pag.parent_id = :parent_id
                        order by g.slug
                        """
                    ),
                    {"parent_id": parent_id},
                )
            ).scalars().all()
        return [str(slug) for slug in rows]

    async def grant_group(self, parent_id: str, group_slug: str) -> bool:
        async with session_scope() as session:
            group_id = (
                await session.execute(
                    text("select id from public.app_groups where slug = :group_slug limit 1"),
                    {"group_slug": group_slug},
                )
            ).scalar_one_or_none()
            if not group_id:
                return False
            existing = (
                await session.execute(
                    text(
                        """
                        select 1 from public.parent_account_groups
                        where parent_id = :parent_id and group_id = :group_id
                        limit 1
                        """
                    ),
                    {"parent_id": parent_id, "group_id": group_id},
                )
            ).scalar_one_or_none()
            if existing:
                return True
            result = await session.execute(
                text(
                    """
                    insert into public.parent_account_groups (parent_id, group_id)
                    values (:parent_id, :group_id)
                    """
                ),
                {"parent_id": parent_id, "group_id": group_id},
            )
        return bool(result.rowcount)

    async def grant_group_by_email(self, email: str, group_slug: str) -> bool:
        async with session_scope() as session:
            parent_id = (
                await session.execute(
                    text(
                        """
                        select id
                        from public.parent_accounts
                        where lower(email) = lower(:email)
                        limit 1
                        """
                    ),
                    {"email": email},
                )
            ).scalar_one_or_none()
        if not parent_id:
            return False
        return await self.grant_group(str(parent_id), group_slug)

    async def has_bootstrap_email_permission(self, email: str, permission_slug: str) -> bool:
        """Permiso vía email preautorizado (developers/admins), sin parent_account_groups."""
        async with session_scope() as session:
            value = (
                await session.execute(
                    text(
                        """
                        select 1
                        from public.app_group_bootstrap_emails b
                        join public.app_groups g on g.id = b.group_id
                        join public.app_group_permissions agp on agp.group_id = g.id
                        join public.app_permissions p on p.id = agp.permission_id
                        where lower(b.email) = lower(:email)
                          and p.slug = :permission_slug
                        limit 1
                        """
                    ),
                    {"email": email, "permission_slug": permission_slug},
                )
            ).scalar_one_or_none()
        return value is not None

    async def apply_bootstrap_grants(self, parent_id: str, email: str) -> None:
        """Aplica app_group_bootstrap_emails para este tutor (idempotente)."""
        async with session_scope() as session:
            await session.execute(
                text(
                    """
                    insert into public.parent_account_groups (parent_id, group_id)
                    select :parent_id, b.group_id
                    from public.app_group_bootstrap_emails b
                    where lower(b.email) = lower(:email)
                    on conflict do nothing
                    """
                ),
                {"parent_id": parent_id, "email": email},
            )

    async def authorization_summary(self, parent_id: str) -> dict[str, Any]:
        groups = await self.list_groups(parent_id)
        permissions = await self.list_permissions(parent_id)
        return {"groups": groups, "permissions": permissions}
