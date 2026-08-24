from __future__ import annotations

import json
import re
from typing import Any

from sqlalchemy import bindparam, text
from sqlalchemy.dialects.postgresql import JSONB

from app.catalogs import AgeBand, SubjectCatalog
from app.catalogs.explorer_gender import assert_explorer_gender, display_label_for_gender
from app.db import session_scope
from app.security.exit_pin import hash_exit_pin, verify_exit_pin
from app.services.parents import ParentAccountService
from app.services.settings import ParentSettingsRepository
from app.services.subject_progress_config import normalize_challenges_per_path_patch
from app.services.traveler_profile import TravelerProfileService
from app.text_utils import CharacterSummaryBuilder


class CrewService:
    MEMBER_LIMIT = 10
    GENERAL_NOTE_MAX_LEN = 400
    SUBJECT_NOTE_MAX_LEN = 600
    def __init__(self, parents: ParentAccountService | None = None, settings_repo: ParentSettingsRepository | None = None) -> None:
        self.parents, self.settings_repo = parents or ParentAccountService(), settings_repo or ParentSettingsRepository()

    async def list_for_auth_user(self, auth_user_id: str) -> dict[str, Any]:
        await self.ensure_tutor_profile_for_auth_user(auth_user_id)
        parent_id = await self._parent_id(auth_user_id)
        async with session_scope() as session:
            rows = (await session.execute(text("""select id, display_name, age_years, age_band, world_theme, explorer_gender, status, onboarding_step, placement_status, settings, is_tutor_profile, updated_at, invite_email, invite_email_canonical, linked_auth_user_id from public.children where parent_id = :parent_id and status <> 'deleted' order by is_tutor_profile desc, created_at asc"""), {"parent_id": parent_id})).mappings().all()
        members = [self._list_item(row) for row in rows]
        return {"members": members, "member_count": sum(not x["is_tutor_profile"] for x in members), "member_limit": self.MEMBER_LIMIT, "has_tutor_profile": any(x["is_tutor_profile"] for x in members)}

    async def ensure_tutor_profile_for_auth_user(self, auth_user_id: str) -> None:
        parent = await self.parents.find_by_auth_user_id(auth_user_id)
        if not parent: return
        parent_id, label = parent["parent_id"], self._tutor_name(parent)
        async with session_scope() as session:
            existing = (await session.execute(text("select id from public.children where parent_id = :parent_id and is_tutor_profile = true and status <> 'deleted' limit 1"), {"parent_id": parent_id})).mappings().first()
            if existing:
                await session.execute(text("update public.children set display_name = :display_name, updated_at = now() where id = :id and display_name is distinct from :display_name"), {"id": existing["id"], "display_name": label})
                return
            defaults = await self.settings_repo.get_merged_settings_for_parent_id(parent_id)
            crew = defaults.get("crew_defaults", {})
            statement = text("""insert into public.children (parent_id, display_name, status, onboarding_step, placement_status, is_tutor_profile, settings) values (:parent_id, :display_name, 'active', 'complete', 'completed', true, :settings) returning id""").bindparams(bindparam("settings", type_=JSONB))
            child_id = (await session.execute(statement, {"parent_id": parent_id, "display_name": label, "settings": {"tutor_label": "Tu perfil de tutor"}})).scalar_one()
            await self._insert_permissions(session, str(child_id), crew)

    async def create_for_auth_user(self, auth_user_id: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        parent_id = await self._parent_id(auth_user_id)
        if (await self.list_for_auth_user(auth_user_id))["member_count"] >= self.MEMBER_LIMIT: raise ValueError("Crew member limit reached")
        payload = payload or {}
        tutor_label = self._tutor_label(payload["tutor_label"]) if "tutor_label" in payload else None
        defaults = (await self.settings_repo.get_merged_settings_for_parent_id(parent_id)).get("crew_defaults", {})
        async with session_scope() as session:
            statement = text("insert into public.children (parent_id, settings) values (:parent_id, :settings) returning id").bindparams(bindparam("settings", type_=JSONB))
            child_id = (await session.execute(statement, {"parent_id": parent_id, "settings": {"tutor_label": tutor_label}})).scalar_one()
            await self._insert_permissions(session, str(child_id), defaults)
        return await self.get_for_auth_user(auth_user_id, str(child_id))

    async def get_for_auth_user(self, auth_user_id: str, child_id: str) -> dict[str, Any]:
        parent_id = await self._parent_id(auth_user_id)
        async with session_scope() as session:
            row = (await session.execute(text("""select c.*, p.allow_solo_start, p.require_exit_pin, p.exit_pin_hash, p.session_limit_per_day, p.max_session_minutes, p.allowed_hours, p.can_choose_story_branch, p.lock_world_theme, p.font_scale_play, p.learning_overrides from public.children c join public.child_permissions p on p.child_id = c.id where c.id = :id and c.parent_id = :parent_id and c.status <> 'deleted' limit 1"""), {"id": child_id, "parent_id": parent_id})).mappings().first()
            if not row: raise RuntimeError("Crew member not found")
            detail = self._detail(row)
            traits = (await session.execute(text("select species, palette, features, vibe, achievements, character_summary, updated_at from public.child_traits where child_id = :id limit 1"), {"id": child_id})).mappings().first()
            if (
                not detail["is_tutor_profile"]
                and str(row.get("placement_status") or "") == "completed"
            ):
                from app.services.crew_progress import CrewProgressService

                learning = detail["settings"].get("learning") if isinstance(detail["settings"], dict) else {}
                active = SubjectCatalog.resolve_active_subjects(dict(row), learning or {})
                await CrewProgressService.ensure_base_levels_with_session(
                    session,
                    child_id,
                    str(row.get("world_theme") or "fantasy"),
                    active,
                    source="repair",
                )
        if traits: detail["traits"] = self._traits(traits)
        if not detail["is_tutor_profile"]:
            traveler = TravelerProfileService().read_for_child(parent_id, child_id)
            if traveler:
                detail["traveler_profile"] = traveler
            from app.services.crew_progress import CrewProgressService
            built = await CrewProgressService().build_for_child(dict(row, settings=detail["settings"]))
            detail.update({"progress": built["progress"], "journey": built["journey"], "general_level": built["progress"].get("general_level"), "rank_id": self._string(row.get("rank_id")), "rank": built["progress"].get("rank")})
        return detail

    async def update_profile_for_auth_user(self, auth_user_id: str, child_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        detail = await self.get_for_auth_user(auth_user_id, child_id)
        fields, params = [], {"id": child_id}
        if "display_name" in payload: fields.append("display_name = :display_name"); params["display_name"] = self._display_name(payload["display_name"])
        if "age_years" in payload:
            age = payload["age_years"]
            if age is not None and (type(age) is not int): raise ValueError("age_years invalid")
            if age is not None: AgeBand.assert_age_years(age)
            fields.append("age_years = :age_years"); params["age_years"] = age
            if age is not None: fields.extend(("age_band = :age_band", "effective_age_band = :effective_age_band")); params.update(age_band=AgeBand.from_age_years(age), effective_age_band=AgeBand.from_age_years(age))
        if "explorer_gender" in payload:
            if detail["is_tutor_profile"]:
                raise ValueError("Cannot set explorer_gender on tutor profile")
            fields.append("explorer_gender = :explorer_gender")
            params["explorer_gender"] = assert_explorer_gender(str(payload["explorer_gender"]))
        if "status" in payload:
            if detail["is_tutor_profile"]: raise ValueError("Cannot change tutor profile status")
            if payload["status"] not in ("active", "paused"): raise ValueError("status invalid")
            fields.append("status = :status"); params["status"] = payload["status"]
        if "world_theme" in payload:
            theme = payload["world_theme"]
            if theme is not None and theme not in ("fantasy", "sci-fi"): raise ValueError("world_theme invalid")
            if detail["permissions"]["lock_world_theme"] and payload.get("unlock_world") is not True and theme != detail["world_theme"]: raise ValueError("world_theme locked")
            fields.append("world_theme = :world_theme"); params["world_theme"] = theme
        settings = dict(detail["settings"])
        if "invite_email" in payload:
            await self._apply_invite_email(auth_user_id, detail, payload["invite_email"], fields, params)
        if "tutor_label" in payload: settings["tutor_label"] = self._tutor_label(payload["tutor_label"])
        if "learning" in payload:
            if detail["is_tutor_profile"]: raise ValueError("Cannot set learning on tutor profile")
            incoming = payload["learning"]
            if not isinstance(incoming, dict): raise ValueError("learning invalid")
            learning = dict(settings.get("learning") or {})
            if "active_subjects" in incoming:
                if not isinstance(incoming["active_subjects"], list): raise ValueError("learning.active_subjects invalid")
                # Solo cambia la lista activa; user_subject_levels conserva el progreso de materias pausadas.
                learning["active_subjects"] = SubjectCatalog.normalize_active_subjects(incoming["active_subjects"])
                learning["subjects_locked_by_tutor"] = True
                if "subject_priorities" not in incoming and learning.get("subject_priorities"):
                    learning["subject_priorities"] = self._normalize_subject_priorities(
                        learning["subject_priorities"],
                        learning["active_subjects"],
                    )
            for key in ("adaptation_policy", "show_levels_to_child", "pause_adaptation"):
                if key in incoming: learning[key] = incoming[key]
            if "subject_notes" in incoming:
                learning["subject_notes"] = self._normalize_subject_notes(
                    incoming["subject_notes"]
                )
                learning.pop("weak_spots", None)
            elif "weak_spots" in incoming:
                legacy = self._normalize_weak_spots(incoming["weak_spots"])
                learning["subject_notes"] = [
                    {"subject_id": str(item["subject_id"]), "note": str(item["note"])}
                    for item in legacy
                    if item.get("subject_id") and item.get("note")
                ]
                orphan = [
                    str(item["note"])
                    for item in legacy
                    if not item.get("subject_id") and item.get("note")
                ]
                if orphan and "general_note" not in incoming:
                    learning["general_note"] = self._normalize_general_note("; ".join(orphan))
                learning.pop("weak_spots", None)
            if "general_note" in incoming:
                learning["general_note"] = self._normalize_general_note(incoming["general_note"])
            if "subject_priorities" in incoming:
                active_list = learning.get("active_subjects")
                learning["subject_priorities"] = self._normalize_subject_priorities(
                    incoming["subject_priorities"],
                    active_list if isinstance(active_list, list) else None,
                )
            if "challenges_per_path" in incoming:
                learning["challenges_per_path"] = normalize_challenges_per_path_patch(
                    incoming["challenges_per_path"]
                )
            settings["learning"] = learning
        if "tutor_label" in payload or "learning" in payload: fields.append("settings = CAST(:settings AS jsonb)"); params["settings"] = settings
        traits_changed = "character_summary" in payload
        traveler_changed = "traveler_profile" in payload
        if traveler_changed:
            if detail["is_tutor_profile"]:
                raise ValueError("Cannot set traveler_profile on tutor profile")
            parent_id = await self._parent_id(auth_user_id)
            TravelerProfileService().update_for_child(
                parent_id,
                child_id,
                child_snapshot=detail,
                patch=payload["traveler_profile"] or {},
            )
        if traits_changed:
            if detail["is_tutor_profile"]:
                raise ValueError("Cannot set character_summary on tutor profile")
            await self._upsert_summary(child_id, self._summary(payload["character_summary"]))
        if not fields and not traits_changed and not traveler_changed:
            raise ValueError("No updatable fields")
        async with session_scope() as session:
            if fields:
                statement = text(f"update public.children set {', '.join(fields)}, updated_at = now() where id = :id and status <> 'deleted'")
                if "settings" in params: statement = statement.bindparams(bindparam("settings", type_=JSONB))
                await session.execute(statement, params)
                if (
                    "learning" in payload
                    and not detail["is_tutor_profile"]
                    and str(detail.get("placement_status") or "") == "completed"
                ):
                    from app.services.crew_progress import CrewProgressService

                    learning_patch = settings.get("learning") if isinstance(settings.get("learning"), dict) else {}
                    active = SubjectCatalog.resolve_active_subjects(
                        {"age_band": detail.get("age_band")},
                        learning_patch,
                    )
                    await CrewProgressService.ensure_base_levels_with_session(
                        session,
                        child_id,
                        str(detail.get("world_theme") or "fantasy"),
                        active,
                        source="activation",
                    )
            elif traits_changed or traveler_changed:
                await session.execute(
                    text(
                        "update public.children set updated_at = now() where id = :id and status <> 'deleted'"
                    ),
                    {"id": child_id},
                )
        return await self.get_for_auth_user(auth_user_id, child_id)

    async def update_permissions_for_auth_user(self, auth_user_id: str, child_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        await self.get_for_auth_user(auth_user_id, child_id)
        fields, params = [], {"child_id": child_id}
        for key in ("allow_solo_start", "require_exit_pin", "can_choose_story_branch", "lock_world_theme"):
            if key in payload:
                if type(payload[key]) is not bool: raise ValueError(f"{key} invalid")
                fields.append(f"{key} = :{key}"); params[key] = payload[key]
        if "session_limit_per_day" in payload:
            value = payload["session_limit_per_day"]
            if value is not None and (type(value) is not int or not 1 <= value <= 12): raise ValueError("session_limit_per_day invalid")
            fields.append("session_limit_per_day = :session_limit_per_day"); params["session_limit_per_day"] = value
        if "max_session_minutes" in payload:
            value = payload["max_session_minutes"]
            if type(value) is not int or not 5 <= value <= 120 or value % 5: raise ValueError("max_session_minutes invalid")
            fields.append("max_session_minutes = :max_session_minutes"); params["max_session_minutes"] = value
        if "font_scale_play" in payload:
            if payload["font_scale_play"] not in ("md", "lg", "xl"): raise ValueError("font_scale_play invalid")
            fields.append("font_scale_play = :font_scale_play"); params["font_scale_play"] = payload["font_scale_play"]
        if "exit_pin" in payload:
            pin = payload["exit_pin"]
            if pin is None: fields.append("exit_pin_hash = null")
            elif not isinstance(pin, str) or not re.fullmatch(r"\d{4}", pin): raise ValueError("exit_pin invalid")
            else:
                fields.append("exit_pin_hash = :exit_pin_hash")
                params["exit_pin_hash"] = hash_exit_pin(pin)
        if not fields: raise ValueError("No updatable fields")
        async with session_scope() as session: await session.execute(text(f"update public.child_permissions set {', '.join(fields)}, updated_at = now() where child_id = :child_id"), params)
        return await self.get_for_auth_user(auth_user_id, child_id)

    async def soft_delete_for_auth_user(self, auth_user_id: str, child_id: str, confirm: bool) -> dict[str, bool]:
        if not confirm: raise ValueError("confirm required")
        if (await self.get_for_auth_user(auth_user_id, child_id))["is_tutor_profile"]: raise ValueError("Cannot delete tutor profile")
        async with session_scope() as session: await session.execute(text("update public.children set status = 'deleted', deleted_at = now(), updated_at = now(), invite_email = null, invite_email_canonical = null, linked_auth_user_id = null, linked_at = null where id = :id"), {"id": child_id})
        return {"deleted": True}

    async def verify_exit_pin_for_auth_user(self, auth_user_id: str, child_id: str, pin: str) -> dict[str, bool]:
        detail = await self.get_for_auth_user(auth_user_id, child_id)
        perms = detail.get("permissions") or {}
        if not perms.get("require_exit_pin"):
            return {"ok": True, "required": False}
        if not perms.get("exit_pin_set"):
            return {"ok": True, "required": False}
        if not isinstance(pin, str) or not re.fullmatch(r"\d{4}", pin):
            raise ValueError("exit_pin invalid")
        parent_id = await self._parent_id(auth_user_id)
        async with session_scope() as session:
            row = (
                await session.execute(
                    text(
                        """select p.exit_pin_hash
                           from public.child_permissions p
                           join public.children c on c.id = p.child_id
                           where p.child_id = :id and c.parent_id = :parent_id
                           limit 1"""
                    ),
                    {"id": child_id, "parent_id": parent_id},
                )
            ).mappings().first()
        stored_hash = str(row["exit_pin_hash"]) if row and row.get("exit_pin_hash") else None
        if not verify_exit_pin(pin, stored_hash):
            return {"ok": False, "required": True}
        return {"ok": True, "required": True}

    async def _parent_id(self, auth_user_id: str) -> str:
        parent = await self.parents.find_by_auth_user_id(auth_user_id)
        if not parent: raise RuntimeError("Parent account not found")
        return parent["parent_id"]
    async def _insert_permissions(self, session: Any, child_id: str, defaults: dict[str, Any]) -> None:
        await session.execute(text("""insert into public.child_permissions (child_id, allow_solo_start, require_exit_pin, session_limit_per_day, max_session_minutes, can_choose_story_branch, lock_world_theme, font_scale_play) values (:child_id, :allow_solo_start, :require_exit_pin, :session_limit_per_day, :max_session_minutes, true, :lock_world_theme, :font_scale_play)"""), {"child_id": child_id, "allow_solo_start": defaults.get("allow_solo_start", True), "require_exit_pin": defaults.get("require_exit_pin", False), "session_limit_per_day": defaults.get("session_limit_per_day", 3), "max_session_minutes": defaults.get("max_session_minutes", 10), "lock_world_theme": defaults.get("lock_world_theme", True), "font_scale_play": defaults.get("font_scale_play", "md")})
    @staticmethod
    def _json(value: object) -> dict[str, Any]: return value if isinstance(value, dict) else {}
    @staticmethod
    def _string(value: object) -> str | None: return value if isinstance(value, str) and value else None
    def _list_item(self, row: Any) -> dict[str, Any]:
        from app.services.session_accounts import invite_link_status
        settings = self._json(row["settings"]); invite = self._string(row.get("invite_email")); linked = str(row["linked_auth_user_id"]) if row.get("linked_auth_user_id") else None; return {"id": str(row["id"]), "display_name": self._string(row["display_name"]), "age_years": int(row["age_years"]) if row["age_years"] is not None else None, "age_band": self._string(row["age_band"]), "world_theme": self._string(row["world_theme"]), "explorer_gender": self._string(row.get("explorer_gender")), "explorer_gender_label": display_label_for_gender(self._string(row.get("explorer_gender")), int(row["age_years"]) if row["age_years"] is not None else None), "status": str(row["status"]), "onboarding_step": str(row["onboarding_step"]), "placement_status": str(row["placement_status"]), "tutor_label": self._string(settings.get("tutor_label")), "is_tutor_profile": bool(row["is_tutor_profile"]), "invite_email": invite, "invite_link_status": invite_link_status(invite, linked), "updated_at": str(row["updated_at"]) if row["updated_at"] else None}
    def _detail(self, row: Any) -> dict[str, Any]:
        settings, learning, hours = self._json(row["settings"]), self._json(row["learning_overrides"]), row["allowed_hours"]
        band = AgeBand.from_legacy(row["age_band"], int(row["age_years"]) if row["age_years"] is not None else None) or AgeBand.CHILD
        active = settings.get("learning", {}).get("active_subjects") if isinstance(settings.get("learning"), dict) else None
        from app.services.session_accounts import invite_link_status
        invite = self._string(row.get("invite_email"))
        linked = str(row["linked_auth_user_id"]) if row.get("linked_auth_user_id") else None
        return {"id": str(row["id"]), "display_name": self._string(row["display_name"]), "age_years": int(row["age_years"]) if row["age_years"] is not None else None, "age_band": self._string(row["age_band"]), "effective_age_band": self._string(row["effective_age_band"]), "birth_year": int(row["birth_year"]) if row["birth_year"] is not None else None, "world_theme": self._string(row["world_theme"]), "explorer_gender": self._string(row.get("explorer_gender")), "explorer_gender_label": display_label_for_gender(self._string(row.get("explorer_gender")), int(row["age_years"]) if row["age_years"] is not None else None), "locale": str(row["locale"] or "es-ES"), "status": str(row["status"]), "onboarding_step": str(row["onboarding_step"]), "placement_status": str(row["placement_status"]), "is_tutor_profile": bool(row["is_tutor_profile"]), "settings": settings, "subject_catalog": SubjectCatalog.list_for_ui(), "active_subjects": active if isinstance(active, list) else SubjectCatalog.base_subjects_for_band(band), "permissions": {"allow_solo_start": bool(row["allow_solo_start"]), "require_exit_pin": bool(row["require_exit_pin"]), "exit_pin_set": bool(row["exit_pin_hash"]), "session_limit_per_day": row["session_limit_per_day"], "max_session_minutes": int(row["max_session_minutes"] or 10), "allowed_hours": hours, "can_choose_story_branch": bool(row["can_choose_story_branch"]), "lock_world_theme": bool(row["lock_world_theme"]), "font_scale_play": str(row["font_scale_play"] or "md"), "learning_overrides": learning}, "traits": None, "invite_email": invite, "invite_link_status": invite_link_status(invite, linked), "created_at": str(row["created_at"]) if row["created_at"] else None, "updated_at": str(row["updated_at"]) if row["updated_at"] else None}
    def _traits(self, row: Any) -> dict[str, Any]:
        species, palette = str(row["species"] or ""), str(row["palette"] or ""); features = [x for x in row["features"] or [] if isinstance(x, str) and x.strip()]; achievements = [x for x in row["achievements"] or [] if isinstance(x, str) and x.strip()]; summary = self._string(row["character_summary"]) or (CharacterSummaryBuilder.build(species, palette, features, self._string(row["vibe"])) if species else None)
        return {"species": species, "palette": palette, "features": features, "vibe": self._string(row["vibe"]), "achievements": achievements, "character_summary": summary, "updated_at": str(row["updated_at"]) if row["updated_at"] else None}
    async def _upsert_summary(self, child_id: str, summary: str | None) -> None:
        async with session_scope() as session:
            row = (await session.execute(text("select species, palette from public.child_traits where child_id = :id"), {"id": child_id})).mappings().first()
            if row:
                await session.execute(text("update public.child_traits set character_summary = :summary, updated_at = now() where child_id = :id"), {"id": child_id, "summary": summary})
                if summary is None and str(row["species"]).strip() == "Por definir" and str(row["palette"]).strip() == "Por definir": await session.execute(text("delete from public.child_traits where child_id = :id"), {"id": child_id})
            elif summary is not None: await session.execute(text("insert into public.child_traits (child_id, species, palette, features, vibe, achievements, character_summary, updated_at) values (:id, 'Por definir', 'Por definir', '[]'::jsonb, null, '[]'::jsonb, :summary, now())"), {"id": child_id, "summary": summary})
    @staticmethod
    def effective_subject_notes(learning: dict[str, Any] | None) -> list[dict[str, str]]:
        """Notas del tutor por materia (neutral), con migración suave desde weak_spots."""
        if not isinstance(learning, dict):
            return []
        out: list[dict[str, str]] = []
        seen: set[str] = set()
        raw_notes = learning.get("subject_notes")
        if isinstance(raw_notes, list):
            for item in raw_notes:
                if not isinstance(item, dict):
                    continue
                sid = str(item.get("subject_id") or "").strip()
                note = str(item.get("note") or "").strip()
                if not sid or not note or sid in seen:
                    continue
                if sid not in SubjectCatalog.ALL:
                    continue
                seen.add(sid)
                out.append({"subject_id": sid, "note": note})
        legacy = learning.get("weak_spots")
        if isinstance(legacy, list):
            for item in legacy:
                if isinstance(item, dict):
                    sid = str(item.get("subject_id") or "").strip()
                    note = str(item.get("note") or "").strip()
                elif isinstance(item, str):
                    sid, note = "", item.strip()
                else:
                    continue
                if not sid or not note or sid in seen:
                    continue
                if sid not in SubjectCatalog.ALL:
                    continue
                seen.add(sid)
                out.append({"subject_id": sid, "note": note[:200]})
        return out

    @staticmethod
    def effective_general_note(learning: dict[str, Any] | None) -> str | None:
        if not isinstance(learning, dict):
            return None
        raw = learning.get("general_note")
        if isinstance(raw, str) and raw.strip():
            return raw.strip()[:400]
        legacy = learning.get("weak_spots")
        if isinstance(legacy, list):
            parts: list[str] = []
            for item in legacy:
                if isinstance(item, str) and item.strip():
                    parts.append(item.strip()[:200])
                elif isinstance(item, dict) and not item.get("subject_id"):
                    note = str(item.get("note") or "").strip()
                    if note:
                        parts.append(note[:200])
            if parts:
                return "; ".join(parts)[:400]
        return None

    @staticmethod
    def tutor_learning_context_line(learning: dict[str, Any] | None) -> str:
        chunks: list[str] = []
        general = CrewService.effective_general_note(learning)
        if general:
            chunks.append(f" Información adicional general del tutor: {general}.")
        notes = CrewService.effective_subject_notes(learning)
        if notes:
            parts = [f"{row['subject_id']}: {row['note']}" for row in notes[:8]]
            chunks.append(f" Información adicional por materia: {'; '.join(parts)}.")
        return "".join(chunks)

    @staticmethod
    def subject_notes_prompt_line(learning: dict[str, Any] | None) -> str:
        return CrewService.tutor_learning_context_line(learning)

    @staticmethod
    def _normalize_general_note(raw: object) -> str | None:
        if raw is None:
            return None
        if not isinstance(raw, str):
            raise ValueError("learning.general_note invalid")
        value = raw.strip()
        if not value:
            return None
        if len(value) > CrewService.GENERAL_NOTE_MAX_LEN:
            raise ValueError("learning.general_note too long")
        return value

    @staticmethod
    def _normalize_subject_notes(raw: object) -> list[dict[str, str]]:
        if raw is None:
            return []
        if not isinstance(raw, list):
            raise ValueError("learning.subject_notes invalid")
        out: list[dict[str, str]] = []
        seen: set[str] = set()
        for item in raw[:16]:
            if not isinstance(item, dict):
                continue
            sid = str(item.get("subject_id") or "").strip()
            note = str(item.get("note") or "").strip()
            if not sid or not note:
                continue
            if len(note) > CrewService.SUBJECT_NOTE_MAX_LEN:
                raise ValueError("learning.subject_notes too long")
            if sid not in SubjectCatalog.ALL:
                raise ValueError("learning.subject_notes invalid")
            if sid in seen:
                continue
            seen.add(sid)
            out.append({"subject_id": sid, "note": note})
        return out

    @staticmethod
    def _normalize_subject_priorities(
        raw: object,
        active_subjects: list[str] | None = None,
    ) -> list[str]:
        if raw is None:
            return []
        if not isinstance(raw, list):
            raise ValueError("learning.subject_priorities invalid")
        active = set(active_subjects or [])
        out: list[str] = []
        seen: set[str] = set()
        for item in raw[:16]:
            sid = str(item or "").strip()
            if not sid or sid not in SubjectCatalog.ALL or sid in seen:
                continue
            if active and sid not in active:
                continue
            seen.add(sid)
            out.append(sid)
        return out

    @staticmethod
    def _normalize_weak_spots(raw: object) -> list[dict[str, str | None]]:
        if raw is None:
            return []
        if isinstance(raw, str):
            note = raw.strip()
            return [{"subject_id": None, "note": note}] if note else []
        if not isinstance(raw, list):
            raise ValueError("learning.weak_spots invalid")
        out: list[dict[str, str | None]] = []
        for item in raw[:12]:
            if isinstance(item, str):
                note = item.strip()
                if note:
                    out.append({"subject_id": None, "note": note[:200]})
                continue
            if not isinstance(item, dict):
                continue
            note = str(item.get("note") or "").strip()[:200]
            if not note:
                continue
            sid = item.get("subject_id")
            subject_id = str(sid).strip() if isinstance(sid, str) and sid.strip() else None
            out.append({"subject_id": subject_id, "note": note})
        return out

    @staticmethod
    def _summary(value: object) -> str | None:
        if value is None: return None
        if not isinstance(value, str): raise ValueError("character_summary invalid")
        value = re.sub(r"<[^>]*>", "", value).strip()
        if len(value) > 600: raise ValueError("character_summary too long")
        return value or None
    @staticmethod
    def _tutor_label(value: object) -> str | None:
        if value is None: return None
        if not isinstance(value, str): raise ValueError("tutor_label invalid")
        value = value.strip()
        if len(value) > 40: raise ValueError("tutor_label too long")
        return value or None
    @staticmethod
    def _display_name(value: object) -> str | None:
        if value is None: return None
        if not isinstance(value, str): raise ValueError("display_name invalid")
        value = value.strip()
        if len(value) > 24: raise ValueError("display_name too long")
        if value and not re.fullmatch(r"[\w\d '\-]+", value, re.UNICODE): raise ValueError("display_name invalid characters")
        return value or None
    @staticmethod
    def _tutor_name(parent: dict[str, Any]) -> str:
        if isinstance(parent.get("display_name"), str) and parent["display_name"].strip(): return parent["display_name"].strip()
        email = parent.get("email", "")
        if isinstance(email, str) and "@" in email: return email.split("@", 1)[0].replace(".", " ").replace("_", " ").replace("-", " ").title().strip() or "Tutor"
        return "Tutor"

    async def get_accessible_for_auth_user(self, auth_user_id: str, child_id: str) -> dict[str, Any]:
        parent = await self.parents.find_by_auth_user_id(auth_user_id)
        if parent:
            return await self.get_for_auth_user(auth_user_id, child_id)
        return await self.get_for_linked_crew(auth_user_id, child_id)

    async def get_for_linked_crew(self, auth_user_id: str, child_id: str) -> dict[str, Any]:
        async with session_scope() as session:
            row = (await session.execute(text("""select c.*, p.allow_solo_start, p.require_exit_pin, p.exit_pin_hash, p.session_limit_per_day, p.max_session_minutes, p.allowed_hours, p.can_choose_story_branch, p.lock_world_theme, p.font_scale_play, p.learning_overrides from public.children c join public.child_permissions p on p.child_id = c.id where c.id = :id and c.linked_auth_user_id = :auth and c.status <> 'deleted' limit 1"""), {"id": child_id, "auth": auth_user_id})).mappings().first()
            if not row: raise RuntimeError("Crew member not found")
            detail = self._detail(row)
            parent_id = str(row["parent_id"])
            traits = (await session.execute(text("select species, palette, features, vibe, achievements, character_summary, updated_at from public.child_traits where child_id = :id limit 1"), {"id": child_id})).mappings().first()
            if (
                not detail["is_tutor_profile"]
                and str(row.get("placement_status") or "") == "completed"
            ):
                from app.services.crew_progress import CrewProgressService

                learning = detail["settings"].get("learning") if isinstance(detail["settings"], dict) else {}
                active = SubjectCatalog.resolve_active_subjects(dict(row), learning or {})
                await CrewProgressService.ensure_base_levels_with_session(
                    session,
                    child_id,
                    str(row.get("world_theme") or "fantasy"),
                    active,
                    source="repair",
                )
        if traits: detail["traits"] = self._traits(traits)
        if not detail["is_tutor_profile"]:
            traveler = TravelerProfileService().read_for_child(parent_id, child_id)
            if traveler:
                detail["traveler_profile"] = traveler
            from app.services.crew_progress import CrewProgressService
            built = await CrewProgressService().build_for_child(dict(row, settings=detail["settings"]))
            detail.update({"progress": built["progress"], "journey": built["journey"], "general_level": built["progress"].get("general_level"), "rank_id": self._string(row.get("rank_id")), "rank": built["progress"].get("rank")})
        return detail

    def to_self_view(self, detail: dict[str, Any]) -> dict[str, Any]:
        progress = detail.get("progress")
        if isinstance(progress, dict):
            progress = dict(progress)
            progress.pop("general_level", None)
            rank = progress.get("rank")
            if isinstance(rank, dict):
                progress["rank"] = {
                    "id": rank.get("id"),
                    "label_child": rank.get("label_child") or rank.get("label_tutor"),
                    "tier": rank.get("tier"),
                }
            rank_next = progress.get("rank_next")
            if isinstance(rank_next, dict):
                progress["rank_next"] = {
                    "id": rank_next.get("id"),
                    "label_child": rank_next.get("label_child") or rank_next.get("label_tutor"),
                    "tier": rank_next.get("tier"),
                }
        learning = (detail.get("settings") or {}).get("learning") if isinstance(detail.get("settings"), dict) else {}
        active = learning.get("active_subjects") if isinstance(learning, dict) else detail.get("active_subjects")
        perms = detail.get("permissions") if isinstance(detail.get("permissions"), dict) else {}
        settings = detail.get("settings") if isinstance(detail.get("settings"), dict) else {}
        return {
            "id": detail["id"],
            "display_name": detail.get("display_name"),
            "age_years": detail.get("age_years"),
            "age_band": detail.get("age_band"),
            "world_theme": detail.get("world_theme"),
            "explorer_gender": detail.get("explorer_gender"),
            "explorer_gender_label": detail.get("explorer_gender_label"),
            "status": detail.get("status"),
            "onboarding_step": detail.get("onboarding_step"),
            "placement_status": detail.get("placement_status"),
            "traits": detail.get("traits"),
            "traveler_profile": detail.get("traveler_profile"),
            "progress": progress,
            "journey": detail.get("journey"),
            "rank": (progress or {}).get("rank") if isinstance(progress, dict) else detail.get("rank"),
            "active_subjects": active,
            "subject_catalog": detail.get("subject_catalog"),
            "font_scale_play": str(perms.get("font_scale_play") or "md"),
            "ui_preferences": self._member_ui_preferences(settings, detail.get("world_theme")),
            "viewer": "self",
        }

    MEMBER_SELF_FIELDS = frozenset(
        {
            "display_name",
            "explorer_gender",
            "character_summary",
            "traveler_profile",
            "diagnostics",
            "font_scale_play",
            "ui_preferences",
        }
    )

    @staticmethod
    def _member_ui_preferences(settings: dict[str, Any], world_theme: str | None) -> dict[str, str]:
        raw = settings.get("ui_preferences") if isinstance(settings.get("ui_preferences"), dict) else {}
        theme = raw.get("ui_theme")
        if theme not in ("fantasy", "sci-fi"):
            theme = world_theme if world_theme in ("fantasy", "sci-fi") else "fantasy"
        motion = raw.get("reduce_motion")
        if motion not in ("system", "always", "never"):
            motion = "system"
        return {"ui_theme": str(theme), "reduce_motion": str(motion)}

    async def patch_crew_diagnostics(
        self, auth_user_id: str, child_id: str, email: str, diagnostics: dict[str, Any]
    ) -> dict[str, Any]:
        from app.services.debug_access import assert_crew_debug_diagnostics_patch_allowed

        await assert_crew_debug_diagnostics_patch_allowed(email, child_id, {"diagnostics": diagnostics})
        if not isinstance(diagnostics.get("debug_ai_enabled"), bool):
            raise ValueError("diagnostics.debug_ai_enabled invalid")
        detail = await self.get_for_linked_crew(auth_user_id, child_id)
        settings = dict(detail.get("settings") or {})
        merged = dict(settings.get("diagnostics") or {})
        merged["debug_ai_enabled"] = diagnostics["debug_ai_enabled"]
        settings["diagnostics"] = merged
        async with session_scope() as session:
            await session.execute(
                text(
                    """
                    update public.children
                    set settings = cast(:settings as jsonb), updated_at = now()
                    where id = :id and linked_auth_user_id = :auth and status <> 'deleted'
                    """
                ),
                {
                    "id": child_id,
                    "auth": auth_user_id,
                    "settings": json.dumps(settings),
                },
            )
        return await self.get_for_linked_crew(auth_user_id, child_id)

    async def patch_member_font_scale_play(
        self, auth_user_id: str, child_id: str, value: object
    ) -> None:
        if value not in ("md", "lg", "xl"):
            raise ValueError("font_scale_play invalid")
        async with session_scope() as session:
            result = await session.execute(
                text(
                    """
                    update public.child_permissions p
                    set font_scale_play = :font_scale_play
                    from public.children c
                    where p.child_id = c.id
                      and c.id = :id
                      and c.linked_auth_user_id = :auth
                      and c.status <> 'deleted'
                    """
                ),
                {"id": child_id, "auth": auth_user_id, "font_scale_play": value},
            )
            if result.rowcount == 0:
                raise RuntimeError("Crew member not found")

    async def patch_member_ui_preferences(
        self, auth_user_id: str, child_id: str, prefs: object
    ) -> None:
        if not isinstance(prefs, dict):
            raise ValueError("ui_preferences invalid")
        unknown = set(prefs) - {"ui_theme", "reduce_motion"}
        if unknown:
            raise ValueError("field_forbidden")
        if "ui_theme" in prefs and prefs["ui_theme"] not in ("fantasy", "sci-fi"):
            raise ValueError("ui_theme invalid")
        if "reduce_motion" in prefs and prefs["reduce_motion"] not in ("system", "always", "never"):
            raise ValueError("reduce_motion invalid")
        detail = await self.get_for_linked_crew(auth_user_id, child_id)
        settings = dict(detail.get("settings") or {})
        merged = dict(settings.get("ui_preferences") or {})
        if "ui_theme" in prefs:
            merged["ui_theme"] = prefs["ui_theme"]
        if "reduce_motion" in prefs:
            merged["reduce_motion"] = prefs["reduce_motion"]
        settings["ui_preferences"] = merged
        async with session_scope() as session:
            result = await session.execute(
                text(
                    """
                    update public.children
                    set settings = cast(:settings as jsonb), updated_at = now()
                    where id = :id and linked_auth_user_id = :auth and status <> 'deleted'
                    """
                ),
                {
                    "id": child_id,
                    "auth": auth_user_id,
                    "settings": json.dumps(settings),
                },
            )
            if result.rowcount == 0:
                raise RuntimeError("Crew member not found")

    async def update_self_profile(
        self,
        auth_user_id: str,
        child_id: str,
        payload: dict[str, Any],
        *,
        email: str = "",
    ) -> dict[str, Any]:
        if "diagnostics" in payload:
            await self.patch_crew_diagnostics(
                auth_user_id,
                child_id,
                email,
                payload["diagnostics"],
            )
            payload = {k: v for k, v in payload.items() if k != "diagnostics"}
        if "ui_preferences" in payload:
            await self.patch_member_ui_preferences(auth_user_id, child_id, payload["ui_preferences"])
            payload = {k: v for k, v in payload.items() if k != "ui_preferences"}
        if "font_scale_play" in payload:
            await self.patch_member_font_scale_play(auth_user_id, child_id, payload["font_scale_play"])
            payload = {k: v for k, v in payload.items() if k != "font_scale_play"}
        unknown = set(payload) - self.MEMBER_SELF_FIELDS
        if unknown:
            raise ValueError("field_forbidden")
        if not payload:
            return await self.get_for_linked_crew(auth_user_id, child_id)
        return await self.update_profile_for_auth_user_self(auth_user_id, child_id, payload)

    async def update_profile_for_auth_user_self(
        self, auth_user_id: str, child_id: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        detail = await self.get_for_linked_crew(auth_user_id, child_id)
        fields, params = [], {"id": child_id}
        if "display_name" in payload:
            fields.append("display_name = :display_name")
            params["display_name"] = self._display_name(payload["display_name"])
        if "explorer_gender" in payload:
            fields.append("explorer_gender = :explorer_gender")
            params["explorer_gender"] = assert_explorer_gender(str(payload["explorer_gender"]))
        traits_changed = "character_summary" in payload
        traveler_changed = "traveler_profile" in payload
        if traveler_changed:
            parent_id = await self._parent_id_for_child(child_id)
            TravelerProfileService().update_for_child(
                parent_id,
                child_id,
                child_snapshot=detail,
                patch=payload["traveler_profile"] or {},
            )
        if traits_changed:
            await self._upsert_summary(child_id, self._summary(payload["character_summary"]))
        if not fields and not traits_changed and not traveler_changed:
            raise ValueError("No updatable fields")
        async with session_scope() as session:
            if fields:
                await session.execute(
                    text(f"update public.children set {', '.join(fields)}, updated_at = now() where id = :id and status <> 'deleted'"),
                    params,
                )
            elif traits_changed or traveler_changed:
                await session.execute(
                    text("update public.children set updated_at = now() where id = :id and status <> 'deleted'"),
                    {"id": child_id},
                )
        return await self.get_for_linked_crew(auth_user_id, child_id)

    async def unlink_keep_invite(self, auth_user_id: str) -> bool:
        async with session_scope() as session:
            result = await session.execute(
                text(
                    """
                    update public.children
                    set linked_auth_user_id = null, linked_at = null, updated_at = now()
                    where linked_auth_user_id = :auth and status <> 'deleted'
                    """
                ),
                {"auth": auth_user_id},
            )
            try:
                await session.execute(text("delete from auth.users where id = :auth"), {"auth": auth_user_id})
            except Exception:
                pass
        return True

    async def _parent_id_for_child(self, child_id: str) -> str:
        async with session_scope() as session:
            row = (await session.execute(text("select parent_id from public.children where id = :id"), {"id": child_id})).mappings().first()
        if not row:
            raise RuntimeError("Crew member not found")
        return str(row["parent_id"])

    async def _apply_invite_email(
        self,
        auth_user_id: str,
        detail: dict[str, Any],
        raw: object,
        fields: list[str],
        params: dict[str, Any],
    ) -> None:
        from app.services.gmail_canonical import InviteEmailError, canonicalize_gmail, display_invite_email

        if detail.get("is_tutor_profile"):
            raise ValueError("invite_email_tutor_profile")
        display = display_invite_email(raw)
        canonical = canonicalize_gmail(raw)
        fields.extend(
            (
                "invite_email = :invite_email",
                "invite_email_canonical = :invite_email_canonical",
            )
        )
        params["invite_email"] = display
        params["invite_email_canonical"] = canonical
        previous = detail.get("invite_email")
        prev_canonical = None
        if previous:
            try:
                prev_canonical = canonicalize_gmail(previous)
            except InviteEmailError:
                prev_canonical = None
        if canonical is None or canonical != prev_canonical:
            fields.extend(("linked_auth_user_id = null", "linked_at = null"))
        if canonical is None:
            return
        parent = await self.parents.find_by_auth_user_id(auth_user_id)
        tutor_email = parent.get("email") if parent else None
        if tutor_email:
            try:
                tutor_canonical = canonicalize_gmail(tutor_email)
            except InviteEmailError:
                tutor_canonical = str(tutor_email).strip().lower()
            if tutor_canonical == canonical:
                raise ValueError("invite_email_same_as_tutor")
        clash = await self._invite_conflicts(canonical, str(detail["id"]))
        if clash == "tutor":
            raise ValueError("invite_email_is_tutor")
        if clash == "taken":
            raise ValueError("invite_email_taken")

    async def _invite_conflicts(self, canonical: str, child_id: str) -> str | None:
        async with session_scope() as session:
            parent_row = (
                await session.execute(
                    text(
                        """
                        select email from public.parent_accounts
                        where lower(email) = :canonical
                           or lower(email) like '%@gmail.com'
                           or lower(email) like '%@googlemail.com'
                        """
                    ),
                    {"canonical": canonical},
                )
            ).mappings().all()
            other = (
                await session.execute(
                    text(
                        """
                        select id from public.children
                        where invite_email_canonical = :canonical
                          and id <> :id
                          and status <> 'deleted'
                        limit 1
                        """
                    ),
                    {"canonical": canonical, "id": child_id},
                )
            ).mappings().first()
        from app.services.gmail_canonical import InviteEmailError, canonicalize_gmail

        for row in parent_row:
            email = str(row["email"] or "")
            try:
                other_c = canonicalize_gmail(email)
            except InviteEmailError:
                other_c = email.strip().lower()
            if other_c == canonical:
                return "tutor"
        if other:
            return "taken"
        return None

