"""Debug AI status/ping para el camino Gemini (SPEC_AI_GEMINI_GATEWAY)."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import text

from app.ai.agents.deps import AudienceContext, RunDeps
from app.ai.agents.runner import run_dialogue_purpose
from app.ai.errors import AiProductError
from app.ai.gemini_gateway import GeminiGateway
from app.config import GEMINI_LITE_PURPOSES, get_settings
from app.services.debug_access import debug_capabilities_for_parent
from app.services.settings import ParentSettingsRepository

# Purposes OpenRouter → Gemini (panel / resolve)
PURPOSE_ALIASES = {
    "placement_exam_composer": "placement_item_writer",
    "placement_exam_batch_writer": "placement_item_writer",
    "dialogue": "mentor_guide",
    "adventure_scene": "mentor_guide",
    "adventure_challenge": "path_composer",
    "adventure_pitch": "path_composer",
    "adventure_waiting": "waiting_copy_writer",
}

DEFAULT_PURPOSE = "mentor_guide"

GEMINI_PURPOSES = [
    "mentor_guide",
    "placement_item_writer",
    "placement_text_scorer",
    "path_composer",
    "journey_summarizer",
    "waiting_copy_writer",
    "character_coach",
]


def normalize_purpose(purpose: str | None) -> str:
    raw = (purpose or DEFAULT_PURPOSE).strip() or DEFAULT_PURPOSE
    return PURPOSE_ALIASES.get(raw, raw)


class DebugAiService:
    def __init__(self, session: Any) -> None:
        self.session = session
        self.settings = get_settings()
        self.gateway = GeminiGateway(self.settings)

    async def status(self, parent_id: str, parent_settings: dict[str, Any] | None = None) -> dict[str, Any]:
        models = self.settings.gemini_model_list()
        capabilities = await debug_capabilities_for_parent(parent_id, parent_settings, settings=self.settings)
        return self._status_body(capabilities)

    async def status_from_capabilities(self, capabilities: dict[str, bool]) -> dict[str, Any]:
        return self._status_body(capabilities)

    def _status_body(self, capabilities: dict[str, bool]) -> dict[str, Any]:
        models = self.settings.gemini_model_list()
        return {
            "enabled": self.settings.ai_enabled,
            "provider": "gemini",
            "mock": False,
            "key_present": bool(self.settings.gemini_api_key_resolved()),
            "models": models,
            "models_lite": self.settings.gemini_model_list_lite(),
            "lite_purposes": sorted(GEMINI_LITE_PURPOSES),
            "max_attempts": len(models),
            "app_env": self.settings.app_env,
            "operator_eligible": capabilities["operator_eligible"],
            "debug_enabled": capabilities["debug_enabled"],
            "debug_allowed": capabilities["debug_allowed"],
            "journey_data_dir": self.settings.journey_data_dir,
            # Compat panel antiguo
            "queue_backend": "gemini_env",
        }

    async def queues(self, purpose: str | None = None) -> list[dict[str, Any]]:
        purposes = [normalize_purpose(purpose)] if purpose else list(GEMINI_PURPOSES)
        rows: list[dict[str, Any]] = []
        for p in purposes:
            models = self.settings.gemini_model_list_for_purpose(p)
            tier = self.settings.gemini_model_tier_for_purpose(p)
            for idx, mid in enumerate(models):
                rows.append(
                    {
                        "purpose": p,
                        "model": mid,
                        "model_id": mid,
                        "priority": idx + 1,
                        "provider": "gemini",
                        "tier": tier,
                        "enabled": True,
                        "source": "env",
                    }
                )
        return rows

    async def resolve(self, purpose: str) -> dict[str, Any]:
        canonical = normalize_purpose(purpose)
        models = self.settings.gemini_model_list_for_purpose(canonical)
        return {
            "purpose": canonical,
            "purpose_requested": purpose,
            "provider": "gemini",
            "tier": self.settings.gemini_model_tier_for_purpose(canonical),
            "models": models,
            # Compat con panel que lee resolved_models / queue_source
            "resolved_models": models,
            "queue_source": "gemini_env",
            "key_present": bool(self.settings.gemini_api_key_resolved()),
        }

    async def attempts(self, limit: int = 20) -> list[dict[str, Any]]:
        cap = max(1, min(100, limit))
        from_logs = self._attempts_from_ai_logs(cap)
        if from_logs:
            return from_logs
        try:
            rows = (
                await self.session.execute(
                    text(
                        "select purpose, model_id, ok, http_status, latency_ms, "
                        "error_class, created_at from ai_call_attempts "
                        "order by created_at desc limit :limit"
                    ),
                    {"limit": cap},
                )
            ).mappings().all()
            out = []
            for r in rows:
                mid = str(r.get("model_id") or "")
                # Etiquetar legado OpenRouter vs Gemini
                provider = (
                    "gemini"
                    if mid.startswith("gemini") or mid.startswith("google:")
                    else "legacy_openrouter"
                )
                out.append(
                    {
                        "purpose": r.get("purpose"),
                        "model_id": mid,
                        "ok": bool(r.get("ok")),
                        "http_status": r.get("http_status"),
                        "latency_ms": r.get("latency_ms"),
                        "error_class": r.get("error_class"),
                        "provider": provider,
                        "created_at": (
                            r["created_at"].isoformat()
                            if hasattr(r.get("created_at"), "isoformat")
                            else r.get("created_at")
                        ),
                        "source": "ai_call_attempts",
                    }
                )
            return out
        except Exception:
            return []

    def _attempts_from_ai_logs(self, limit: int) -> list[dict[str, Any]]:
        root = Path(self.settings.log_dir)
        if not root.is_dir():
            return []
        day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        path = root / f"ai-{day}.log"
        if not path.is_file():
            # fallback: último ai-*.log
            candidates = sorted(root.glob("ai-*.log"), reverse=True)
            if not candidates:
                return []
            path = candidates[0]
        rows: list[dict[str, Any]] = []
        try:
            lines = path.read_text(encoding="utf-8").splitlines()
        except OSError:
            return []
        for line in reversed(lines):
            line = line.strip()
            if not line:
                continue
            try:
                payload = json.loads(line)
            except json.JSONDecodeError:
                continue
            if payload.get("message") != "llm_attempt":
                continue
            ctx = payload.get("context") or {}
            rows.append(
                {
                    "purpose": ctx.get("purpose"),
                    "model_id": ctx.get("model"),
                    "ok": bool(ctx.get("ok")),
                    "http_status": ctx.get("http_status"),
                    "latency_ms": ctx.get("duration_ms"),
                    "error_class": ctx.get("error_code") or ctx.get("error_class"),
                    "provider": ctx.get("provider") or "gemini",
                    "created_at": payload.get("ts"),
                    "source": "ai_log",
                }
            )
            if len(rows) >= limit:
                break
        return rows

    async def ping(self, child_id: str | None = None) -> dict[str, Any]:
        deps = RunDeps(
            child_id=UUID(child_id) if child_id else uuid4(),
            session_id=str(uuid4()),
            purpose="mentor_guide",
            world_theme="fantasy",
            age_band="child",
            audience=AudienceContext(age_band="child", age_years=10),
            mentor={"id": "guardian", "display_name": "El Guardián del Conocimiento", "mentor_id": "mentor_fantasy_guardian"},
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
