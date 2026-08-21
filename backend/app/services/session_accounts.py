"""Resolución de sesión tutor vs tripulante (SPEC_APP_CREW_MEMBER_ACCOUNT)."""

from __future__ import annotations

from typing import Any

from sqlalchemy import text

from app.db import session_scope
from app.services.gmail_canonical import InviteEmailError, canonicalize_gmail
from app.services.parents import ParentAccountService


class CrewRoleError(PermissionError):
    """JWT de tripulante en una superficie solo-tutor."""

    def __init__(self, detail: str = "crew_role") -> None:
        super().__init__(detail)
        self.detail = detail


class SessionConflictError(RuntimeError):
    def __init__(self, detail: str = "session_conflict") -> None:
        super().__init__(detail)
        self.detail = detail


def invite_link_status(invite_email: str | None, linked_auth_user_id: str | None) -> str:
    if linked_auth_user_id:
        return "linked"
    if invite_email:
        return "pending"
    return "none"


class SessionAccountService:
    def __init__(self, parents: ParentAccountService | None = None) -> None:
        self.parents = parents or ParentAccountService()

    async def bootstrap(
        self,
        auth_user_id: str,
        email: str,
        display_name: str | None = None,
        avatar_url: str | None = None,
    ) -> dict[str, Any]:
        crew = await self._resolve_or_link_crew(auth_user_id, email)
        if crew:
            return crew
        parent = await self.parents.bootstrap(auth_user_id, email, display_name, avatar_url)
        return {
            "role": "tutor",
            "parent_id": parent["parent_id"],
            "auth_user_id": auth_user_id,
            "email": email,
            "display_name": parent.get("display_name") or display_name,
            "avatar_url": parent.get("avatar_url") or avatar_url,
            "provider": "google",
            "created": bool(parent.get("created")),
        }

    async def me(
        self,
        auth_user_id: str,
        email: str,
        display_name: str | None = None,
        avatar_url: str | None = None,
    ) -> dict[str, Any]:
        return await self.bootstrap(auth_user_id, email, display_name, avatar_url)

    async def require_tutor(
        self,
        auth_user_id: str,
        email: str,
        display_name: str | None = None,
        avatar_url: str | None = None,
    ) -> dict[str, Any]:
        session = await self.bootstrap(auth_user_id, email, display_name, avatar_url)
        if session.get("role") == "crew":
            raise CrewRoleError()
        return session

    async def require_crew(self, auth_user_id: str, email: str) -> dict[str, Any]:
        crew = await self._find_linked_crew(auth_user_id)
        if crew:
            return crew
        linked = await self._resolve_or_link_crew(auth_user_id, email)
        if not linked:
            raise CrewRoleError("tutor_role")
        return linked

    async def _resolve_or_link_crew(self, auth_user_id: str, email: str) -> dict[str, Any] | None:
        from app.db import get_engine

        if get_engine() is None:
            return None
        linked = await self._find_linked_crew(auth_user_id)
        if linked:
            return linked
        existing_parent = await self.parents.find_by_auth_user_id(auth_user_id)
        if existing_parent:
            return None
        try:
            canonical = canonicalize_gmail(email)
        except InviteEmailError:
            return None
        if not canonical:
            return None
        return await self._link_by_invite(auth_user_id, email, canonical)

    async def _find_linked_crew(self, auth_user_id: str) -> dict[str, Any] | None:
        row = await self._fetch_one(
            """
            select c.id, c.display_name, c.status, c.invite_email, c.invite_email_canonical,
                   c.linked_auth_user_id, c.parent_id
            from public.children c
            where c.linked_auth_user_id = :auth and c.status <> 'deleted'
            limit 1
            """,
            {"auth": auth_user_id},
        )
        if not row:
            return None
        return self._crew_dto(row, email=None, created_link=False, auth_user_id=auth_user_id)

    async def _link_by_invite(
        self, auth_user_id: str, email: str, canonical: str
    ) -> dict[str, Any] | None:
        parent_clash = await self._fetch_one(
            """
            select id from public.parent_accounts
            where lower(email) = :email
            limit 1
            """,
            {"email": canonical},
        )
        if parent_clash:
            raise SessionConflictError("invite_email_is_tutor")
        row = await self._fetch_one(
            """
            select c.id, c.display_name, c.status, c.invite_email, c.invite_email_canonical,
                   c.linked_auth_user_id, c.parent_id
            from public.children c
            where c.invite_email_canonical = :canonical and c.status <> 'deleted'
            limit 1
            """,
            {"canonical": canonical},
        )
        if not row:
            return None
        created_link = row.get("linked_auth_user_id") is None
        await self._execute(
            """
            update public.children
            set linked_auth_user_id = :auth, linked_at = now(), updated_at = now()
            where id = :id and status <> 'deleted'
            """,
            {"auth": auth_user_id, "id": str(row["id"])},
        )
        row = dict(row)
        row["linked_auth_user_id"] = auth_user_id
        return self._crew_dto(row, email=email, created_link=created_link, auth_user_id=auth_user_id)

    def _crew_dto(
        self,
        row: Any,
        *,
        email: str | None,
        created_link: bool,
        auth_user_id: str | None = None,
    ) -> dict[str, Any]:
        invite = row.get("invite_email")
        sub = auth_user_id or (str(row["linked_auth_user_id"]) if row.get("linked_auth_user_id") else "")
        return {
            "role": "crew",
            "auth_user_id": sub,
            "email": email or (str(invite) if invite else ""),
            "child_id": str(row["id"]),
            "parent_id": str(row["parent_id"]) if row.get("parent_id") else None,
            "display_name": row.get("display_name") if isinstance(row.get("display_name"), str) else None,
            "avatar_url": None,
            "provider": "google",
            "link_status": "linked",
            "created_link": created_link,
            "status": str(row["status"]) if row.get("status") else "active",
        }

    async def _fetch_one(self, sql: str, params: dict[str, Any]) -> dict[str, Any] | None:
        try:
            async with session_scope() as session:
                row = (await session.execute(text(sql), params)).mappings().first()
        except RuntimeError as exc:
            if str(exc) in {"DATABASE_URL not configured", "Database unavailable"}:
                return None
            raise
        return dict(row) if row else None

    async def _execute(self, sql: str, params: dict[str, Any]) -> None:
        async with session_scope() as session:
            await session.execute(text(sql), params)
