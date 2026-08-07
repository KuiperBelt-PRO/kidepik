from __future__ import annotations

from app.config import Settings
from app.services.auth import AuthClaims

PARENT_ID = "11111111-1111-4111-8111-111111111111"
CHILD_ID = "22222222-2222-4222-8222-222222222222"
AUTH_USER_ID = "00000000-0000-4000-8000-000000000099"


def make_auth_claims(**overrides: str | None) -> AuthClaims:
    claims: AuthClaims = {
        "sub": AUTH_USER_ID,
        "role": "authenticated",
        "email": "tutor@example.com",
        "display_name": "Tutor Test",
        "avatar_url": None,
    }
    claims.update(overrides)  # type: ignore[typeddict-item]
    return claims


def make_settings(**overrides: object) -> Settings:
    return Settings.model_validate(overrides)


def sample_parent_account() -> dict:
    return {
        "parent_id": PARENT_ID,
        "auth_user_id": AUTH_USER_ID,
        "email": "tutor@example.com",
        "display_name": "Tutor Test",
        "avatar_url": None,
    }


def sample_bootstrap_result(*, created: bool = False) -> dict:
    return {
        "parent_id": PARENT_ID,
        "auth_user_id": AUTH_USER_ID,
        "email": "tutor@example.com",
        "created": created,
    }


def sample_crew_member(*, is_tutor: bool = False) -> dict:
    return {
        "id": CHILD_ID,
        "display_name": "Tutor Test" if is_tutor else "Ada",
        "age_years": None if is_tutor else 9,
        "age_band": None if is_tutor else "band_child",
        "world_theme": None if is_tutor else "fantasy",
        "status": "active",
        "onboarding_step": "complete",
        "placement_status": "completed",
        "is_tutor_profile": is_tutor,
        "settings": {},
        "permissions": {
            "allow_solo_start": True,
            "require_exit_pin": False,
        },
    }


def sample_crew_list() -> dict:
    tutor = sample_crew_member(is_tutor=True)
    child = sample_crew_member(is_tutor=False)
    return {
        "members": [tutor, child],
        "member_count": 1,
        "member_limit": 10,
        "has_tutor_profile": True,
    }


def sample_settings_payload() -> dict:
    return {
        "settings": {
            "ui_theme": "fantasy",
            "font_scale_ui": "md",
            "schema_version": 1,
        },
        "crew_summary": {"member_count": 1},
    }
