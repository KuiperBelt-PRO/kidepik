"""Debug AI status/ping para el camino Gemini (SPEC_AI_GEMINI_GATEWAY)."""
from __future__ import annotations

from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import text

from app.ai.agents.deps import AudienceContext, RunDeps
from app.ai.agents.runner import run_dialogue_purpose
from app.ai.errors import AiProductError
from app.ai.gemini_gateway import GeminiGateway
from app.config import GEMINI_LITE_PURPOSES, get_settings


class DebugAiService:
    def __init__(self, session: Any) -> None:
        self.session = session
        self.settings = get_settings()
        self.gateway = GeminiGateway(self.settings)

    async def status(self) -> dict[str, Any]:
        return {
            "enabled": self.settings.ai_enabled,
            "provider": "gemini",
            "mock": False,
            "key_present": bool(self.settings.gemini_api_key_resolved()),
            "models": self.settings.gemini_model_list(),
            "models_lite": self.settings.gemini_model_list_lite(),
            "lite_purposes": sorted(GEMINI_LITE_PURPOSES),
            "max_attempts": len(self.settings.gemini_model_list()),
            "app_env": self.settings.app_env,
            "debug_allowed": self.settings.ai_debug_enabled(),
            "journey_data_dir": self.settings.journey_data_dir,
        }

    async def queues(self, purpose: str | None = None) -> list[dict[str, Any]]:
        purposes = [purpose] if purpose else [
            "mentor_guide",
            "placement_item_writer",
            "placement_text_scorer",
            "journey_summarizer",
            "waiting_copy_writer",
        ]
        rows = []
        for p in purposes:
            models = self.settings.gemini_model_list_for_purpose(p)
            tier = self.settings.gemini_model_tier_for_purpose(p)
            for idx, mid in enumerate(models):
                rows.append(
                    {
                        "purpose": p,
                        "model": mid,
                        "priority": idx + 1,
                        "provider": "gemini",
                        "tier": tier,
                    }
                )
        return rows

    async def resolve(self, purpose: str) -> dict[str, Any]:
        return {
            "purpose": purpose,
            "provider": "gemini",
            "tier": self.settings.gemini_model_tier_for_purpose(purpose),
            "models": self.settings.gemini_model_list_for_purpose(purpose),
            "key_present": bool(self.settings.gemini_api_key_resolved()),
        }

    async def attempts(self, limit: int = 20) -> list[dict[str, Any]]:
        try:
            return [
                dict(r)
                for r in (
                    await self.session.execute(
                        text(
                            "select * from ai_call_attempts "
                            "order by created_at desc limit :limit"
                        ),
                        {"limit": max(1, min(100, limit))},
                    )
                ).mappings().all()
            ]
        except Exception:
            return []

    async def ping(self, child_id: str | None = None) -> dict[str, Any]:
        deps = RunDeps(
            child_id=UUID(child_id) if child_id else uuid4(),
            session_id=str(uuid4()),
            purpose="mentor_guide",
            world_theme="fantasy",
            age_band="child",
            audience=AudienceContext(age_band="child", age_years=10),
            mentor={"id": "guardian", "display_name": "El Guardián"},
            player_state={"ping": True},
        )
        try:
            envelope, model = await run_dialogue_purpose(
                "mentor_guide",
                "Ping de salud. Responde una frase corta de bienvenida (DialogueEnvelope).",
                deps,
                settings=self.settings,
                gateway=self.gateway,
            )
            return {
                "ok": True,
                "content_preview": envelope.agent_text[:200],
                "model": model,
                "provider": "gemini",
                "input_mode": envelope.input_mode,
            }
        except AiProductError as exc:
            return {
                "ok": False,
                "error_code": exc.error_code,
                "detail": exc.detail,
                "models_tried": exc.models_tried,
                "provider": "gemini",
            }
