"""CLI: rellena datos demo en tripulantes locales (sin tocar perfil tutor).

Uso:
  docker compose exec api python -m app.scripts.seed_crew_demo
"""
from __future__ import annotations

import asyncio
import json
import sys
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.config import get_settings
from app.services.crew import CrewService

PRESETS: list[dict[str, Any]] = [
    {
        "display_name": "Nora",
        "world_theme": "fantasy",
        "age_years": 8,
        "tutor_label": "La mayor del grupo",
        "onboarding_step": "complete",
        "placement_status": "completed",
        "status": "active",
    },
    {
        "display_name": "Leo",
        "world_theme": "sci-fi",
        "age_years": 10,
        "tutor_label": "Le encantan los robots",
        "onboarding_step": "complete",
        "placement_status": "completed",
        "status": "active",
    },
    {
        "display_name": "Marta",
        "world_theme": "fantasy",
        "age_years": 7,
        "tutor_label": "Curiosa y valiente",
        "onboarding_step": "pending_entry",
        "placement_status": "not_started",
        "status": "active",
    },
    {
        "display_name": "Kai",
        "world_theme": None,
        "age_years": None,
        "tutor_label": "En examen de acceso",
        "onboarding_step": "placement",
        "placement_status": "in_progress",
        "status": "active",
    },
    {
        "display_name": "Sofía",
        "world_theme": "sci-fi",
        "age_years": 9,
        "tutor_label": "Descanso temporal",
        "onboarding_step": "complete",
        "placement_status": "completed",
        "status": "paused",
    },
    {
        "display_name": "Hugo",
        "world_theme": "fantasy",
        "age_years": 6,
        "tutor_label": "El peque de la casa",
        "onboarding_step": "complete",
        "placement_status": "completed",
        "status": "active",
    },
]


def _age_band(age_years: int | None) -> str | None:
    if age_years is None:
        return None
    return "age_7" if age_years <= 8 else "age_9"


async def _run() -> int:
    settings = get_settings()
    if settings.app_env != "local":
        print("seed-crew-demo: solo disponible con APP_ENV=local", file=sys.stderr)
        return 1
    if not settings.database_url:
        print("seed-crew-demo: DATABASE_URL no configurada", file=sys.stderr)
        return 1

    url = settings.database_url
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)

    engine = create_async_engine(url, pool_pre_ping=True)
    Session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    crew = CrewService()
    total = 0

    async with Session() as session:
        parents = (
            await session.execute(
                text(
                    "select id, auth_user_id from public.parent_accounts order by created_at asc",
                ),
            )
        ).mappings().all()
        if not parents:
            print("seed-crew-demo: no hay cuentas tutor")
            return 0

        for parent in parents:
            auth_user_id = str(parent["auth_user_id"])
            parent_id = str(parent["id"])
            await crew.ensure_tutor_profile_for_auth_user(auth_user_id)

            children = (
                await session.execute(
                    text(
                        """select id, settings
                           from public.children
                           where parent_id = :parent_id
                             and status <> 'deleted'
                             and is_tutor_profile = false
                           order by created_at asc""",
                    ),
                    {"parent_id": parent_id},
                )
            ).mappings().all()

            for index, child in enumerate(children):
                preset = PRESETS[index % len(PRESETS)]
                settings_obj: dict[str, Any] = {}
                raw_settings = child.get("settings")
                if isinstance(raw_settings, dict):
                    settings_obj = dict(raw_settings)
                elif isinstance(raw_settings, str) and raw_settings:
                    try:
                        decoded = json.loads(raw_settings)
                        if isinstance(decoded, dict):
                            settings_obj = decoded
                    except json.JSONDecodeError:
                        pass
                if preset["tutor_label"]:
                    settings_obj["tutor_label"] = preset["tutor_label"]

                await session.execute(
                    text(
                        """update public.children
                           set display_name = :display_name,
                               world_theme = :world_theme,
                               age_years = :age_years,
                               age_band = :age_band,
                               status = :status,
                               onboarding_step = :onboarding_step,
                               placement_status = :placement_status,
                               settings = CAST(:settings AS jsonb),
                               updated_at = now()
                           where id = :id""",
                    ),
                    {
                        "id": str(child["id"]),
                        "display_name": preset["display_name"],
                        "world_theme": preset["world_theme"],
                        "age_years": preset["age_years"],
                        "age_band": _age_band(preset["age_years"]),
                        "status": preset["status"],
                        "onboarding_step": preset["onboarding_step"],
                        "placement_status": preset["placement_status"],
                        "settings": json.dumps(settings_obj, ensure_ascii=False),
                    },
                )
                total += 1

        await session.commit()

    print(f"seed-crew-demo: OK — {total} tripulante(s) actualizado(s)")
    return 0


def main() -> int:
    return asyncio.run(_run())


if __name__ == "__main__":
    raise SystemExit(main())
