from __future__ import annotations

from copy import deepcopy
from typing import Any

from sqlalchemy import bindparam, text
from sqlalchemy.dialects.postgresql import JSONB

from app.catalogs import AgeBand, SubjectCatalog
from app.db import session_scope
from app.services.parents import ParentAccountService


class ParentSettingsService:
    SCHEMA_VERSION = 1
    MEMBER_LIMIT = 10

    @classmethod
    def defaults(cls) -> dict[str, Any]:
        return {"ui_theme": "fantasy", "font_scale_ui": "md", "font_scale_play": "md", "reduce_motion": "system", "world_intensity": "lively",
                "crew_defaults": {"session_limit_per_day": 3, "max_session_minutes": 10, "require_exit_pin": False, "allow_solo_start": True, "lock_world_theme": True, "font_scale_play": "md"},
                "learning": {"adaptation_policy": "balanced", "active_subjects": SubjectCatalog.base_subjects_for_band(AgeBand.CHILD), "show_levels_to_child": False, "pause_adaptation": False},
                "narrative": {"creativity": "balanced", "avoid_themes": [], "resume_mode": "continue"},
                "privacy": {"story_retention": "full", "analytics_opt_in": False}, "schema_version": cls.SCHEMA_VERSION}

    @classmethod
    def merge_with_defaults(cls, stored: object) -> dict[str, Any]:
        return cls._deep_merge(cls.defaults(), stored) if isinstance(stored, dict) else cls.defaults()

    @classmethod
    def apply_patch(cls, current: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
        merged = cls._deep_merge(deepcopy(current), patch)
        cls.validate(merged)
        return merged

    @classmethod
    def validate(cls, settings: dict[str, Any]) -> None:
        cls._enum(settings.get("ui_theme"), ("fantasy", "sci-fi"), "ui_theme")
        cls._enum(settings.get("font_scale_ui"), ("md", "lg", "xl"), "font_scale_ui")
        cls._enum(settings.get("font_scale_play"), ("md", "lg", "xl"), "font_scale_play")
        cls._enum(settings.get("reduce_motion"), ("system", "always", "never"), "reduce_motion")
        cls._enum(settings.get("world_intensity"), ("calm", "lively"), "world_intensity")
        crew = settings.get("crew_defaults")
        if not isinstance(crew, dict): raise ValueError("crew_defaults invalid")
        limit = crew.get("session_limit_per_day")
        if type(limit) is not int or not 1 <= limit <= 12: raise ValueError("crew_defaults.session_limit_per_day invalid")
        cls._session_minutes(crew.get("max_session_minutes"), "crew_defaults.max_session_minutes")
        cls._enum(crew.get("font_scale_play"), ("md", "lg", "xl"), "crew_defaults.font_scale_play")
        for key in ("require_exit_pin", "allow_solo_start", "lock_world_theme"):
            if type(crew.get(key)) is not bool: raise ValueError(f"crew_defaults.{key} invalid")
        learning = settings.get("learning")
        if not isinstance(learning, dict): raise ValueError("learning invalid")
        cls._enum(learning.get("adaptation_policy"), ("balanced", "easier", "harder"), "learning.adaptation_policy")
        subjects = learning.get("active_subjects")
        if not isinstance(subjects, list) or not subjects: raise ValueError("learning.active_subjects must be non-empty")
        SubjectCatalog.normalize_active_subjects(subjects)
        narrative = settings.get("narrative")
        if not isinstance(narrative, dict): raise ValueError("narrative invalid")
        cls._enum(narrative.get("creativity"), ("conservative", "balanced"), "narrative.creativity")
        cls._enum(narrative.get("resume_mode"), ("continue", "recap"), "narrative.resume_mode")
        if not isinstance(narrative.get("avoid_themes", []), list) or any(item not in ("fear", "darkness", "conflict", "peril") for item in narrative["avoid_themes"]): raise ValueError("narrative.avoid_themes invalid")
        privacy = settings.get("privacy")
        if not isinstance(privacy, dict): raise ValueError("privacy invalid")
        cls._enum(privacy.get("story_retention"), ("full", "days_30", "days_90"), "privacy.story_retention")
        if type(privacy.get("analytics_opt_in")) is not bool: raise ValueError("privacy.analytics_opt_in invalid")

    @classmethod
    def _deep_merge(cls, base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
        for key, value in override.items():
            base[key] = cls._deep_merge(base[key], value) if isinstance(value, dict) and isinstance(base.get(key), dict) else value
        return base
    @staticmethod
    def _enum(value: object, allowed: tuple[str, ...], field: str) -> None:
        if value not in allowed: raise ValueError(f"{field} invalid")
    @staticmethod
    def _session_minutes(value: object, field: str) -> None:
        if type(value) is not int or not 5 <= value <= 120 or value % 5: raise ValueError(f"{field} invalid")


class ParentSettingsRepository:
    def __init__(self, parents: ParentAccountService | None = None) -> None: self.parents = parents or ParentAccountService()
    async def get_for_auth_user(self, auth_user_id: str, email: str, display_name: str | None = None, avatar_url: str | None = None) -> dict[str, Any]:
        account = await self.parents.get_or_bootstrap(auth_user_id, email, display_name, avatar_url)
        return {"settings": await self.get_merged_settings_for_parent_id(account["parent_id"]), "crew_summary": {"member_count": await self._count(account["parent_id"])}}
    async def patch_for_auth_user(self, auth_user_id: str, email: str, patch: dict[str, Any], display_name: str | None = None, avatar_url: str | None = None) -> dict[str, Any]:
        account = await self.parents.get_or_bootstrap(auth_user_id, email, display_name, avatar_url)
        next_settings = ParentSettingsService.apply_patch(await self.get_merged_settings_for_parent_id(account["parent_id"]), patch)
        async with session_scope() as session:
            statement = text("update public.parent_accounts set settings = :settings, updated_at = now() where id = :id").bindparams(bindparam("settings", type_=JSONB))
            result = await session.execute(statement, {"settings": next_settings, "id": account["parent_id"]})
        if not result.rowcount: raise RuntimeError("Parent account not found")
        return {"settings": next_settings, "crew_summary": {"member_count": await self._count(account["parent_id"])}}
    async def get_merged_settings_for_parent_id(self, parent_id: str) -> dict[str, Any]:
        async with session_scope() as session:
            value = (await session.execute(text("select settings from public.parent_accounts where id = :id limit 1"), {"id": parent_id})).scalar_one_or_none()
        return ParentSettingsService.merge_with_defaults(value)
    async def _count(self, parent_id: str) -> int:
        try:
            async with session_scope() as session:
                value = (await session.execute(text("select count(*)::int from public.children where parent_id = :parent_id and status <> 'deleted' and coalesce(is_tutor_profile, false) = false"), {"parent_id": parent_id})).scalar_one()
            return int(value)
        except Exception: return 0
