"""Async LLM composition for adventure narrative envelopes."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Callable

from app.ai.gateway import AiGateway
from app.catalogs import AgeBand, ZoneCatalog
from app.logging_ import channel
from app.services.journey_context import JourneyContextPack


class AdventureComposeFailedException(RuntimeError):
    def __init__(self, compose_debug: dict[str, Any]) -> None:
        super().__init__("ADVENTURE_COMPOSE_FAILED")
        self.compose_debug = compose_debug


class AdventureComposeService:
    MAX_VALIDATION_RETRIES = 2
    def __init__(self, session: Any, gateway: AiGateway | None = None) -> None:
        self.session, self.gateway = session, gateway or AiGateway(session)

    async def _complete_json(self, child_id: str, kind: str, messages: list[dict[str, str]],
                             purpose: str, temperature: float, validator: Callable[[dict[str, Any]], str | None]) -> dict[str, Any]:
        last_error = "unknown"
        for attempt in range(self.MAX_VALIDATION_RETRIES + 1):
            try:
                result = await self.gateway.complete(messages, {"purpose": purpose, "temperature": temperature, "max_tokens": 1400, "child_id": child_id})
                parsed = json.loads(result["content"])
                error = validator(parsed) if isinstance(parsed, dict) else "JSON inválido"
                if error is None:
                    return parsed
                last_error = error
                channel("ai").info("narrative_validation_failed", compose_kind=kind, attempt=attempt, error=error)
                messages += [{"role": "assistant", "content": result["content"]}, {"role": "user", "content": f"Corrige el JSON: {error}"}]
            except Exception as exc:
                last_error = str(exc)
        channel("compose").warning("adventure_compose_failed", compose_kind=kind, child_id=child_id, error=last_error)
        raise AdventureComposeFailedException({"compose_kind": kind, "reason": last_error})

    async def compose_pitch_bundle(self, child_id: str, child: dict[str, Any], session_id: str,
                                   zone_ids: list[str], subject_levels: dict[str, str]) -> dict[str, Any]:
        theme = str(child.get("world_theme") or "fantasy")
        prompt = {"world_theme": theme, "display_name": child.get("display_name"), "subject_levels_hint": subject_levels,
                  "zones": [{"zone_id": z, "canonical_label": ZoneCatalog.label(theme, z), "subject_id": ZoneCatalog.subject_for_zone(z)} for z in zone_ids]}
        def validate(value: dict[str, Any]) -> str | None:
            options = value.get("options")
            if not isinstance(options, list) or {str(x.get("id")) for x in options if isinstance(x, dict)} != set(zone_ids): return "options inválidas"
            return None
        parsed = await self._complete_json(child_id, "pitch", [{"role": "system", "content": "Escribe solo JSON con mentor_bridge y options; castellano de España."}, {"role": "user", "content": json.dumps(prompt, ensure_ascii=False)}], "adventure_pitch", .6, validate)
        return {"mentor_bridge": str(parsed.get("mentor_bridge") or ""), "options": [{"id": str(x["id"]), "label": str(x.get("label") or ZoneCatalog.label(theme, str(x["id"]))), "description": str(x.get("description") or ""), "why_for_you": str(x.get("why_for_you") or "")} for x in parsed["options"]]}

    async def compose_scene(self, child_id: str, child: dict[str, Any], zone_id: str, scene_kind: str, context: dict[str, Any]) -> dict[str, Any]:
        pack = await JourneyContextPack(self.session).build(child_id, 4, 4, 2000)
        user = {"world_theme": child.get("world_theme") or "fantasy", "zone_id": zone_id, "scene_kind": scene_kind, "display_name": child.get("display_name") or "explorador", "journey_context": pack, **context}
        parsed = await self._complete_json(child_id, "scene", [{"role": "system", "content": "Responde solo JSON válido con agent_text y npc_display; castellano de España."}, {"role": "user", "content": json.dumps(user, ensure_ascii=False)}], "adventure_scene", .6, lambda p: None if isinstance(p.get("agent_text"), str) and p["agent_text"].strip() else "agent_text inválido")
        npc = parsed.get("npc_display") if isinstance(parsed.get("npc_display"), dict) else {}
        return {"text": str(parsed["agent_text"]).strip(), "meta": {"npc_ids": ["zone_guardian"], "npc_display": {"archetype": str(npc.get("archetype") or "zone_guardian"), "name": str(npc.get("name") or ""), "one_line_voice": str(npc.get("one_line_voice") or "")}}}

    async def compose_arrival(self, child_id: str, child: dict[str, Any], zone_id: str, chosen_label: str, steps_total: int = 3) -> dict[str, Any]:
        return await self.compose_scene(child_id, child, zone_id, "zone_arrive", {"chosen_label": chosen_label, "steps_total": steps_total, "cta": "Afrontar el obstáculo"})

    async def compose_waiting_bundle(self, child_id: str, child: dict[str, Any], kind: str) -> dict[str, Any]:
        parsed = await self._complete_json(child_id, "waiting", [{"role": "system", "content": "Responde JSON {\"lines\":[...]}; frases breves de espera, castellano de España."}, {"role": "user", "content": json.dumps({"kind": kind, "world_theme": child.get("world_theme"), "age_band": AgeBand.from_legacy(child.get("age_band"), child.get("age_years"))}, ensure_ascii=False)}], "adventure_waiting", .7, lambda p: None if isinstance(p.get("lines"), list) else "lines inválidas")
        return {"lines": [str(x).strip() for x in parsed["lines"] if isinstance(x, str) and x.strip()], "kind": kind, "ttl_hours": 24}
