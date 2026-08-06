"""Play dialogue: first_run + placement + LLM Gemini + ledger ficheros."""
from __future__ import annotations

import json
from typing import Any
from uuid import UUID

from sqlalchemy import text

from app.ai.agents.deps import AudienceContext, RunDeps
from app.ai.agents.envelopes import DialogueEnvelope, PlacementQueueEnvelope, TravelerProfileEnvelope
from app.ai.agents.runner import build_mentor_prompt, run_dialogue_purpose, run_purpose
from app.ai.errors import AiProductError
from app.ai.gemini_gateway import GeminiGateway
from app.ai.journey.ledger import JourneyLedger
from app.catalogs import AgeBand, SubjectCatalog
from app.config import get_settings
from app.services.placement import PlacementService
from app.services.waiting_copy import WaitingCopyService


class DialogueService:
    PAGE_SIZE = 24

    def __init__(self, session: Any, gateway: GeminiGateway | None = None) -> None:
        self.session = session
        self.gateway = gateway or GeminiGateway()
        self.settings = get_settings()
        self.ledger = JourneyLedger(self.settings.journey_data_dir)

    async def open_session(
        self, auth_user_id: str, child_id: str, flow_id: str = "first_run"
    ) -> dict[str, Any]:
        child = await self._child(auth_user_id, child_id)
        row = (
            await self.session.execute(
                text(
                    "select * from dialogue_sessions where child_id=:cid and flow_id=:flow "
                    "and status='open' order by created_at desc limit 1"
                ),
                {"cid": child_id, "flow": flow_id},
            )
        ).mappings().first()
        if not row:
            row = (
                await self.session.execute(
                    text(
                        "select * from dialogue_sessions where child_id=:cid and status='open' "
                        "order by updated_at desc, created_at desc limit 1"
                    ),
                    {"cid": child_id},
                )
            ).mappings().first()
        if not row:
            resolved = self._flow(child)
            mentor = "architect" if child.get("world_theme") == "sci-fi" else "guardian"
            row = (
                await self.session.execute(
                    text(
                        "insert into dialogue_sessions(child_id,flow_id,mentor_id,status) "
                        "values(:cid,:flow,:mentor,'open') returning *"
                    ),
                    {"cid": child_id, "flow": resolved, "mentor": mentor},
                )
            ).mappings().one()
            await self._seed(str(row["id"]), child_id, resolved, child)
            child = await self._child(auth_user_id, child_id)
        turns = await self._recent(child_id, self.PAGE_SIZE)
        return {
            "session_id": str(row["id"]),
            "flow_id": str(row["flow_id"]),
            "onboarding_step": child.get("onboarding_step") or "pending_entry",
            "world_theme": child.get("world_theme"),
            "age_band": child.get("age_band") or child.get("effective_age_band"),
            "age_years": child.get("age_years"),
            "display_name": child.get("display_name"),
            "mentor": self._mentor(str(row.get("mentor_id") or "guardian")),
            "turns": turns,
            "history": await self._history(child_id, turns),
            "pending_agent_turn": await self._last_mentor(str(row["id"])),
            "waiting_copy": await WaitingCopyService(self.session).waiting_copy_from_cache(
                child_id
            ),
        }

    async def load_history(
        self,
        auth_user_id: str,
        child_id: str,
        session_id: str,
        before_turn_id: str,
        limit: int | None = None,
    ) -> dict[str, Any]:
        await self._child(auth_user_id, child_id)
        ok = (
            await self.session.execute(
                text(
                    "select 1 from dialogue_sessions where id=:id and child_id=:cid and status='open'"
                ),
                {"id": session_id, "cid": child_id},
            )
        ).scalar()
        if not ok:
            raise RuntimeError("Dialogue session not found or closed")
        anchor = (
            await self.session.execute(
                text("select id,created_at from dialogue_turns where id=:id and child_id=:cid"),
                {"id": before_turn_id, "cid": child_id},
            )
        ).mappings().first()
        if not anchor:
            raise ValueError("before_turn_id not found")
        amount = max(1, min(48, limit or self.PAGE_SIZE))
        rows = (
            await self.session.execute(
                text(
                    "select * from dialogue_turns where child_id=:cid and "
                    "(created_at<:at or (created_at=:at and id<:id)) "
                    "order by created_at desc,id desc limit :lim"
                ),
                {
                    "cid": child_id,
                    "at": anchor["created_at"],
                    "id": anchor["id"],
                    "lim": amount,
                },
            )
        ).mappings().all()
        turns = [self._turn(row) for row in reversed(rows)]
        return {"turns": turns, "history": await self._history(child_id, turns)}

    async def submit_turn(
        self,
        auth_user_id: str,
        child_id: str,
        session_id: str,
        reply: dict[str, Any],
        attach_debug: bool = False,
    ) -> dict[str, Any]:
        child = await self._child(auth_user_id, child_id)
        session = (
            await self.session.execute(
                text(
                    "select * from dialogue_sessions where id=:id and child_id=:cid and status='open'"
                ),
                {"id": session_id, "cid": child_id},
            )
        ).mappings().first()
        if not session:
            raise ValueError("session not found")
        kind = reply.get("kind")
        if kind not in {"option", "text", "continue"}:
            raise ValueError("reply invalid")
        value = str(reply.get("text") or reply.get("option_id") or "").strip()
        if kind != "continue" and not value:
            raise ValueError("reply empty")

        sequence = int(
            (
                await self.session.execute(
                    text(
                        "select coalesce(max(sequence),0)+1 from dialogue_turns where session_id=:id"
                    ),
                    {"id": session_id},
                )
            ).scalar()
        )
        await self._insert(
            {
                "session_id": session_id,
                "child_id": child_id,
                "flow_id": session["flow_id"],
                "sequence": sequence,
                "role": "explorer",
                "text": value,
                "explorer_reply": reply,
                "meta": {},
            }
        )
        self._ledger_explorer(child, session_id, value, reply)

        last = await self._last_mentor(session_id)
        phase = (last or {}).get("meta", {}).get("phase")
        effects: list[dict[str, Any]] = []
        turns: list[dict[str, Any]] = []

        try:
            if phase == "choose_world":
                effects, turns = await self._phase_choose_world(
                    child_id, session_id, session, sequence, reply, value
                )
            elif phase == "choose_name":
                effects, turns = await self._phase_choose_name(
                    child_id, session_id, session, sequence, value
                )
            elif phase == "choose_age":
                effects, turns = await self._phase_choose_age(
                    child_id, session_id, session, sequence, value
                )
            elif phase in {"choose_character_species", "choose_character"}:
                effects, turns = await self._phase_character(
                    child_id, session_id, session, sequence, value, child
                )
            elif phase == "handoff_placement" or (
                child.get("onboarding_step") == "placement"
                and phase not in {"placement_item"}
                and kind == "continue"
            ):
                effects, turns = await self._start_placement(
                    auth_user_id, child_id, session_id, session, sequence
                )
            elif phase == "placement_item":
                effects, turns = await self._placement_answer(
                    child_id, session_id, session, sequence, value, reply, last or {}
                )
            else:
                turns = [
                    await self._agent_mentor_turn(
                        child,
                        session_id,
                        str(session["flow_id"]),
                        sequence + 1,
                        value or "continuar",
                        phase,
                        purpose="mentor_guide",
                    )
                ]
        except AiProductError as exc:
            turns = [
                await self._mentor_turn(
                    session_id,
                    child_id,
                    str(session["flow_id"]),
                    sequence + 1,
                    exc.detail,
                    "continue",
                    None,
                    {
                        "phase": "compose_failed",
                        "error_code": exc.error_code,
                        "models_tried": exc.models_tried,
                    },
                )
            ]

        fresh = await self._child(auth_user_id, child_id)
        mid = "architect" if fresh.get("world_theme") == "sci-fi" else "guardian"
        result: dict[str, Any] = {
            "agent_turns": turns,
            "effects": effects,
            "waiting_copy": await WaitingCopyService(self.session).waiting_copy_from_cache(
                child_id
            ),
            "flow_complete": fresh.get("onboarding_step") == "complete"
            and fresh.get("placement_status") == "completed",
            "onboarding_step": fresh.get("onboarding_step"),
            "display_name": fresh.get("display_name"),
            "mentor": self._mentor(mid),
            "world_theme": fresh.get("world_theme"),
            "age_band": fresh.get("age_band") or fresh.get("effective_age_band"),
            "age_years": fresh.get("age_years"),
        }
        if attach_debug:
            result["debug"] = {
                "ai": {
                    "enabled": self.gateway.is_enabled(),
                    "provider": "gemini",
                    "key_present": bool(self.settings.gemini_api_key_resolved()),
                    "models": self.settings.gemini_model_list(),
                    "debug_allowed": self.settings.ai_debug_enabled(),
                }
            }
        return result

    async def _phase_choose_world(
        self,
        child_id: str,
        session_id: str,
        session: Any,
        sequence: int,
        reply: dict[str, Any],
        value: str,
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        theme = str(reply.get("option_id") or value or "")
        if theme not in {"fantasy", "sci-fi"}:
            return [], [
                await self._mentor_turn(
                    session_id,
                    child_id,
                    session["flow_id"],
                    sequence + 1,
                    "Elige cómo será tu mundo.",
                    "options_only",
                    self._world_options(),
                    {"phase": "choose_world"},
                )
            ]
        mentor = "architect" if theme == "sci-fi" else "guardian"
        await self.session.execute(
            text(
                "update children set world_theme=:theme,mentor_id=:mentor,"
                "onboarding_step='choose_name',updated_at=now() where id=:id"
            ),
            {"theme": theme, "mentor": mentor, "id": child_id},
        )
        await self.session.execute(
            text("update dialogue_sessions set mentor_id=:mentor,updated_at=now() where id=:id"),
            {"mentor": mentor, "id": session_id},
        )
        effects = [
            {"type": "set_world_theme", "value": theme},
            {"type": "set_mentor", "mentor_id": mentor},
            {"type": "advance_onboarding", "to": "choose_name"},
        ]
        child = await self._child_by_id(child_id)
        child["world_theme"] = theme
        child["onboarding_step"] = "choose_name"
        turn = await self._agent_mentor_turn(
            child,
            session_id,
            str(session["flow_id"]),
            sequence + 1,
            f"El explorador eligió mundo={theme}. Preséntate como mentor y pide solo el nombre de aventura.",
            "choose_name",
            purpose="mentor_guide",
        )
        return effects, [turn]

    async def _phase_choose_name(
        self, child_id: str, session_id: str, session: Any, sequence: int, value: str
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        name = value.strip()[:24]
        if not name:
            return [], [
                await self._mentor_turn(
                    session_id,
                    child_id,
                    session["flow_id"],
                    sequence + 1,
                    "Escribe solo tu nombre para la aventura.",
                    "text_only",
                    None,
                    {"phase": "choose_name", "clarification": True},
                )
            ]
        await self.session.execute(
            text(
                "update children set display_name=:name,onboarding_step='choose_age',"
                "updated_at=now() where id=:id"
            ),
            {"name": name, "id": child_id},
        )
        effects = [
            {"type": "set_display_name", "value": name},
            {"type": "advance_onboarding", "to": "choose_age"},
        ]
        child = await self._child_by_id(child_id)
        child["display_name"] = name
        child["onboarding_step"] = "choose_age"
        ages = [{"id": str(x), "label": str(x)} for x in [6, 7, 8, 9, 10, 12, 15, 18, 30, 50, 70]]
        turn = await self._agent_mentor_turn(
            child,
            session_id,
            str(session["flow_id"]),
            sequence + 1,
            f"El explorador se llama {name}. Pregunta la edad (puede elegir opción o escribir número).",
            "choose_age",
            purpose="mentor_guide",
            force_options=ages,
            force_input_mode="options_or_text",
        )
        return effects, [turn]

    async def _phase_choose_age(
        self, child_id: str, session_id: str, session: Any, sequence: int, value: str
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        try:
            age = int(value)
        except ValueError as exc:
            raise ValueError("age invalid") from exc
        AgeBand.assert_age_years(age)
        band = AgeBand.from_age_years(age)
        await self.session.execute(
            text(
                "update children set age_years=:age,age_band=:band,effective_age_band=:band,"
                "onboarding_step='choose_character',updated_at=now() where id=:id"
            ),
            {"age": age, "band": band, "id": child_id},
        )
        effects = [
            {"type": "set_age", "value": {"age_years": age, "age_band": band}},
            {"type": "advance_onboarding", "to": "choose_character"},
            {
                "type": "suggest_active_subjects",
                "value": SubjectCatalog.base_subjects_for_band(band),
            },
        ]
        child = await self._child_by_id(child_id)
        child["age_years"] = age
        child["age_band"] = band
        child["onboarding_step"] = "choose_character"
        turn = await self._agent_mentor_turn(
            child,
            session_id,
            str(session["flow_id"]),
            sequence + 1,
            "Pide que describa su forma/especie/criatura para la aventura (texto libre).",
            "choose_character_species",
            purpose="mentor_guide",
        )
        return effects, [turn]

    async def _phase_character(
        self,
        child_id: str,
        session_id: str,
        session: Any,
        sequence: int,
        value: str,
        child: dict[str, Any],
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        raw = value.strip()[:120] or "explorador"
        deps = self._deps(child, session_id, "character_coach")
        prompt = (
            "El explorador describe su forma. Genera TravelerProfileEnvelope: "
            "species, palette, features, abilities, vibe, y secciones markdown "
            "(description_md, outfit_md, personality_md, abilities_md). "
            f"Respuesta del explorador: {raw!r}. "
            "agent_text: confirma la forma en 2ª persona (tú eres…) y ofrece continuar a la prueba de ingreso. "
            "input_mode=continue. Castellano de España; adapta tono a age_band y world_theme."
        )
        try:
            profile, model = await run_purpose(
                "character_coach",
                prompt,
                deps,
                settings=self.settings,
                gateway=self.gateway,
                expect_type=TravelerProfileEnvelope,
            )
            assert isinstance(profile, TravelerProfileEnvelope)
            species = (profile.species or raw)[:64]
            palette = (profile.palette or "violeta y plata")[:64]
            features = profile.features[:6] or ["curioso", "valiente"]
            abilities = profile.abilities[:8]
            vibe = profile.vibe or f"{species} de tonos {palette}"
            agent_text = profile.agent_text
            input_mode = profile.input_mode or "continue"
        except Exception:
            species = raw[:64]
            palette = "violeta y plata"
            features = ["curioso", "valiente"]
            abilities = []
            vibe = f"{species} de tonos {palette}"
            agent_text = (
                f"Perfecto: eres {vibe}. Cuando quieras, empezamos la prueba de ingreso."
            )
            input_mode = "continue"
            model = None
            profile = None

        await self.session.execute(
            text(
                "insert into child_traits (child_id, species, palette, features, vibe, achievements, updated_at) "
                "values (:id, :species, :palette, cast(:features as jsonb), :vibe, '[]'::jsonb, now()) "
                "on conflict (child_id) do update set species=excluded.species, palette=excluded.palette, "
                "features=excluded.features, vibe=excluded.vibe, updated_at=now()"
            ),
            {
                "id": child_id,
                "species": species,
                "palette": palette,
                "features": json.dumps(features, ensure_ascii=False),
                "vibe": vibe,
            },
        )
        await self.session.execute(
            text(
                "update children set onboarding_step='placement',updated_at=now() where id=:id"
            ),
            {"id": child_id},
        )
        parent_id = child.get("parent_id")
        if parent_id:
            body_parts = []
            if profile:
                if profile.description_md:
                    body_parts.append(f"## Descripción\n\n{profile.description_md}")
                if profile.outfit_md:
                    body_parts.append(f"## Atuendo\n\n{profile.outfit_md}")
                if profile.personality_md:
                    body_parts.append(f"## Personalidad\n\n{profile.personality_md}")
                if profile.abilities_md:
                    body_parts.append(f"## Habilidades\n\n{profile.abilities_md}")
            if not body_parts:
                body_parts = [
                    f"## Descripción\n\n{vibe}.",
                    f"## Atuendo\n\nTonos {palette}.",
                    f"## Personalidad\n\n{', '.join(features)}.",
                    f"## Habilidades\n\n{', '.join(abilities) if abilities else 'Por descubrir.'}",
                ]
            try:
                self.ledger.write_traveler_profile(
                    str(parent_id),
                    child_id,
                    front_matter={
                        "display_name": child.get("display_name"),
                        "world_theme": child.get("world_theme"),
                        "age_band": child.get("age_band")
                        or child.get("effective_age_band"),
                        "age_years": child.get("age_years"),
                        "species": species,
                        "palette": palette,
                        "features": features,
                        "abilities": abilities,
                        "model_used": model,
                    },
                    body_markdown="\n\n".join(body_parts),
                )
                self.ledger.append_dialogue(
                    str(parent_id),
                    child_id,
                    session_id,
                    kind="traveler_update",
                    summary=vibe,
                    purpose="character_coach",
                    model=model,
                    payload={
                        "species": species,
                        "palette": palette,
                        "features": features,
                        "abilities": abilities,
                    },
                )
            except Exception:
                pass

        effects = [
            {
                "type": "set_traits",
                "value": {
                    "species": species,
                    "palette": palette,
                    "features": features,
                    "vibe": vibe,
                    "abilities": abilities,
                },
            },
            {"type": "advance_onboarding", "to": "placement"},
        ]
        turn = await self._mentor_turn(
            session_id,
            child_id,
            session["flow_id"],
            sequence + 1,
            agent_text,
            input_mode,
            None,
            {
                "phase": "handoff_placement",
                "species": species,
                "palette": palette,
            },
            model,
        )
        return effects, [turn]

    async def _start_placement(
        self,
        auth_user_id: str,
        child_id: str,
        session_id: str,
        session: Any,
        sequence: int,
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        child = await self._child(auth_user_id, child_id)
        subjects = PlacementService.active_subjects_for_child(child)[:4]
        queue = await self._compose_placement_queue(child, session_id, subjects)
        mentor_id = str(session.get("mentor_id") or "guardian")
        started = await PlacementService(self.session).start_exam(
            child_id,
            child,
            session_id,
            str(session["flow_id"]),
            sequence + 1,
            mentor_id,
            queue,
        )
        turn_row = started["turn"]
        turn = await self._insert(
            {
                **{k: turn_row[k] for k in (
                    "session_id",
                    "child_id",
                    "flow_id",
                    "sequence",
                    "role",
                    "text",
                    "input_mode",
                    "options",
                    "meta",
                )},
                "explorer_reply": None,
                "model_used": turn_row.get("model_used"),
            }
        )
        return started["effects"], [turn]

    async def _compose_placement_queue(
        self, child: dict[str, Any], session_id: str, subjects: list[str]
    ) -> list[dict[str, Any]]:
        deps = self._deps(child, session_id, "placement_item_writer")
        prompt = (
            "Genera exactamente 3 ítems de examen de ingreso (PlacementQueueEnvelope). "
            f"Materias permitidas: {subjects}. Mundo: {child.get('world_theme')}. "
            f"Edad/banda: {child.get('age_years')}/{child.get('age_band')}. "
            "Mezcla mcq y short_text. Castellano de España."
        )
        try:
            bundle, model = await run_purpose(
                "placement_item_writer",
                prompt,
                deps,
                settings=self.settings,
                gateway=self.gateway,
                expect_type=PlacementQueueEnvelope,
            )
            assert isinstance(bundle, PlacementQueueEnvelope)
            items = []
            for idx, item in enumerate(bundle.items[:3]):
                items.append(
                    {
                        "subject_id": item.subject_id if item.subject_id in subjects else subjects[0],
                        "item_key": item.item_key or f"item_{idx+1}",
                        "item_type": item.item_type,
                        "prompt_text": item.prompt_text,
                        "presentation_text": item.presentation_text or item.prompt_text,
                        "options": [o.model_dump() for o in item.options],
                        "correct_option_id": item.correct_option_id,
                        "expected_answer": item.expected_answer,
                        "model_used": model,
                    }
                )
            if items:
                return items
        except Exception:
            pass
        # Fallback mínimo sin LLM (solo si compose falla): 1 pregunta trivial por materia
        return [
            {
                "subject_id": subjects[0] if subjects else "math",
                "item_key": "fallback_1",
                "item_type": "mcq",
                "prompt_text": "¿Cuánto es 2+2?",
                "presentation_text": "Para calentar: ¿cuánto es 2+2?",
                "options": [
                    {"id": "a", "label": "3"},
                    {"id": "b", "label": "4"},
                    {"id": "c", "label": "5"},
                ],
                "correct_option_id": "b",
            }
        ]

    async def _placement_answer(
        self,
        child_id: str,
        session_id: str,
        session: Any,
        sequence: int,
        value: str,
        reply: dict[str, Any],
        last: dict[str, Any],
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        exam = (
            await self.session.execute(
                text(
                    "select * from placement_exams where child_id=:id and status='in_progress' "
                    "order by started_at desc limit 1"
                ),
                {"id": child_id},
            )
        ).mappings().first()
        if not exam:
            return [], [
                await self._mentor_turn(
                    session_id,
                    child_id,
                    session["flow_id"],
                    sequence + 1,
                    "La prueba no está activa. Pulsa continuar para empezarla.",
                    "continue",
                    None,
                    {"phase": "handoff_placement"},
                )
            ]
        queue = exam.get("item_queue") or []
        if isinstance(queue, str):
            queue = json.loads(queue)
        index = int(exam.get("current_index") or 0)
        item = queue[index] if index < len(queue) else None
        score = 0.5
        if item:
            if item.get("correct_option_id") and reply.get("option_id"):
                score = 1.0 if reply.get("option_id") == item.get("correct_option_id") else 0.0
            await self.session.execute(
                text(
                    "insert into placement_answers(exam_id,subject_id,item_key,item_type,prompt_text,response,score) "
                    "values(:exam,:subject,:key,:typ,:prompt,cast(:response as jsonb),:score)"
                ),
                {
                    "exam": exam["id"],
                    "subject": item.get("subject_id") or "math",
                    "key": item.get("item_key") or f"i{index}",
                    "typ": item.get("item_type") or "mcq",
                    "prompt": item.get("prompt_text") or "",
                    "response": json.dumps(reply, ensure_ascii=False),
                    "score": score,
                },
            )
        next_index = index + 1
        if next_index >= len(queue):
            await self._finish_placement(child_id, exam["id"], queue)
            turn = await self._mentor_turn(
                session_id,
                child_id,
                session["flow_id"],
                sequence + 1,
                "¡Prueba superada! El camino del viaje queda abierto. Cuando quieras, seguimos explorando.",
                "continue",
                None,
                {"phase": "adventure_ready"},
            )
            await self._maybe_write_session_summary(child_id, session_id)
            return [
                {"type": "advance_onboarding", "to": "complete"},
                {"type": "placement_completed", "value": True},
            ], [turn]

        await self.session.execute(
            text(
                "update placement_exams set current_index=:idx,updated_at=now() where id=:id"
            ),
            {"idx": next_index, "id": exam["id"]},
        )
        nxt = queue[next_index]
        mentor_id = str(session.get("mentor_id") or "guardian")
        child_theme = (
            await self.session.execute(
                text("select world_theme from children where id=:id"),
                {"id": child_id},
            )
        ).scalar()
        turn_payload = PlacementService(self.session).item_to_turn(
            session_id,
            child_id,
            str(session["flow_id"]),
            sequence + 1,
            mentor_id,
            str(child_theme or "fantasy"),
            nxt,
            next_index,
            len(queue),
        )
        turn = await self._insert(
            {
                **{k: turn_payload[k] for k in (
                    "session_id",
                    "child_id",
                    "flow_id",
                    "sequence",
                    "role",
                    "text",
                    "input_mode",
                    "options",
                    "meta",
                )},
                "explorer_reply": None,
                "model_used": None,
            }
        )
        return [], [turn]

    async def _finish_placement(
        self, child_id: str, exam_id: Any, queue: list[dict[str, Any]]
    ) -> None:
        subjects = {str(i.get("subject_id") or "math") for i in queue}
        for subject in subjects:
            await self.session.execute(
                text(
                    "insert into user_subject_levels(child_id,subject_id,level_id,source,updated_at) "
                    "values(:cid,:sid,'L1','placement',now()) "
                    "on conflict (child_id,subject_id) do update set level_id='L1', source='placement', updated_at=now()"
                ),
                {"cid": child_id, "sid": subject},
            )
        await self.session.execute(
            text(
                "update placement_exams set status='completed',completed_at=now(),general_level='L1' where id=:id"
            ),
            {"id": exam_id},
        )
        await self.session.execute(
            text(
                "update children set placement_status='completed',onboarding_step='complete',"
                "general_level='L1',updated_at=now() where id=:id"
            ),
            {"id": child_id},
        )

    async def _agent_mentor_turn(
        self,
        child: dict[str, Any],
        session_id: str,
        flow: str,
        sequence: int,
        value: str,
        phase: Any,
        *,
        purpose: str,
        force_options: list[dict[str, Any]] | None = None,
        force_input_mode: str | None = None,
    ) -> dict[str, Any]:
        deps = self._deps(child, session_id, purpose)
        prompt = build_mentor_prompt(deps, explorer_reply=value)
        prompt += f"\nphase={phase}. Responde como mentor en DialogueEnvelope."
        if force_input_mode:
            prompt += f" input_mode debe ser {force_input_mode}."
        envelope, model = await run_dialogue_purpose(
            purpose if purpose != "character_coach" else "mentor_guide",
            prompt,
            deps,
            settings=self.settings,
            gateway=self.gateway,
        )
        assert isinstance(envelope, DialogueEnvelope)
        options = force_options or [o.model_dump() for o in envelope.options] or None
        input_mode = force_input_mode or envelope.input_mode
        return await self._mentor_turn(
            session_id,
            str(child["id"]),
            flow,
            sequence,
            envelope.agent_text,
            input_mode,
            options,
            {
                **(envelope.meta or {}),
                "phase": phase or "dialogue",
                "mentor_id": deps.mentor and deps.mentor.get("id"),
            },
            model,
        )

    async def _child_by_id(self, child_id: str) -> dict[str, Any]:
        row = (
            await self.session.execute(
                text("select * from children where id=:id"),
                {"id": child_id},
            )
        ).mappings().first()
        return dict(row) if row else {"id": child_id}

    def _deps(self, child: dict[str, Any], session_id: str, purpose: str) -> RunDeps:
        mid = "architect" if child.get("world_theme") == "sci-fi" else "guardian"
        return RunDeps(
            child_id=UUID(str(child["id"])),
            parent_id=UUID(str(child["parent_id"])) if child.get("parent_id") else None,
            session_id=session_id,
            purpose=purpose,
            world_theme=child.get("world_theme"),
            age_band=child.get("age_band") or child.get("effective_age_band"),
            audience=AudienceContext(
                age_band=child.get("age_band") or child.get("effective_age_band"),
                age_years=child.get("age_years"),
            ),
            mentor=self._mentor(mid),
            player_state={
                "onboarding_step": child.get("onboarding_step"),
                "display_name": child.get("display_name"),
                "placement_status": child.get("placement_status"),
            },
            ledger=self.ledger,
        )

    def _ledger_explorer(
        self, child: dict[str, Any], session_id: str, value: str, reply: dict[str, Any]
    ) -> None:
        parent_id = child.get("parent_id")
        if not parent_id:
            return
        try:
            self.ledger.append_dialogue(
                str(parent_id),
                str(child["id"]),
                session_id,
                kind="explorer_reply",
                text=value,
                payload={"reply": reply},
            )
        except Exception:
            pass

    async def _maybe_write_session_summary(self, child_id: str, session_id: str) -> None:
        child = (
            await self.session.execute(
                text("select * from children where id=:id"), {"id": child_id}
            )
        ).mappings().first()
        if not child or not child.get("parent_id"):
            return
        parent_id = str(child["parent_id"])
        events = self.ledger.read_events(parent_id, child_id, session_id, limit=40)
        deps = self._deps(dict(child), session_id, "journey_summarizer")
        prompt = (
            "Escribe SessionSummaryEnvelope con resumen markdown de la sesión y structured ligero. "
            f"Eventos: {json.dumps(events, ensure_ascii=False)[:6000]}"
        )
        try:
            from app.ai.agents.envelopes import SessionSummaryEnvelope

            out, model = await run_purpose(
                "journey_summarizer",
                prompt,
                deps,
                settings=self.settings,
                gateway=self.gateway,
                expect_type=SessionSummaryEnvelope,
            )
            fm = {
                **(out.structured or {}),
                "world_theme": child.get("world_theme"),
                "model_used": model,
                "events_up_to_seq": events[-1]["seq"] if events else 0,
            }
            self.ledger.write_session_summary(
                parent_id,
                child_id,
                session_id,
                front_matter=fm,
                body_markdown=out.summary_markdown,
            )
            self.ledger.write_journey_condensed(
                parent_id,
                child_id,
                front_matter=fm,
                body_markdown=out.summary_markdown[:1200],
            )
        except Exception:
            body = "\n".join(
                f"- [{e.get('kind')}] {e.get('text') or e.get('summary') or ''}"
                for e in events[-12:]
            )
            self.ledger.write_session_summary(
                parent_id,
                child_id,
                session_id,
                front_matter={"events_up_to_seq": events[-1]["seq"] if events else 0},
                body_markdown=body or "Sesión sin eventos.",
            )

    async def _child(self, auth: str, child: str) -> dict[str, Any]:
        row = (
            await self.session.execute(
                text(
                    "select c.* from children c join parent_accounts p on p.id=c.parent_id "
                    "where c.id=:child and p.auth_user_id=:auth and c.status<>'deleted'"
                ),
                {"child": child, "auth": auth},
            )
        ).mappings().first()
        if not row:
            raise RuntimeError("Crew member not found")
        return dict(row)

    @staticmethod
    def _flow(child: dict[str, Any]) -> str:
        if child.get("onboarding_step") == "placement":
            return "placement"
        if child.get("onboarding_step") == "complete":
            return "adventure"
        return "first_run"

    @staticmethod
    def _mentor(mid: str) -> dict[str, str]:
        return {
            "id": mid,
            "display_name": "La Arquitecta" if mid == "architect" else "El Guardián",
            "short_description": "mentor del viaje",
        }

    @staticmethod
    def _world_options() -> list[dict[str, str]]:
        return [
            {
                "id": "sci-fi",
                "label": "Ciencia ficción",
                "description": "Naves, planetas y galaxias.",
            },
            {
                "id": "fantasy",
                "label": "Fantasía",
                "description": "Magia, reinos y artefactos.",
            },
        ]

    async def _seed(self, sid: str, cid: str, flow: str, child: dict[str, Any]) -> None:
        if child.get("onboarding_step") in {"pending_entry", "choose_world", None}:
            await self._insert(
                {
                    "session_id": sid,
                    "child_id": cid,
                    "flow_id": flow,
                    "sequence": 1,
                    "role": "mentor",
                    "text": "Bienvenido al umbral del viaje. Primero elige el mundo que habitarás.",
                    "input_mode": "options_only",
                    "options": self._world_options(),
                    "meta": {"phase": "choose_world"},
                }
            )
            if child.get("onboarding_step") == "pending_entry":
                await self.session.execute(
                    text(
                        "update children set onboarding_step='choose_world',updated_at=now() where id=:id"
                    ),
                    {"id": cid},
                )

    async def _mentor_turn(
        self,
        sid: str,
        cid: str,
        flow: str,
        seq: int,
        text_value: str,
        input_mode: str,
        options: Any,
        meta: dict[str, Any],
        model: Any = None,
    ) -> dict[str, Any]:
        turn = await self._insert(
            {
                "session_id": sid,
                "child_id": cid,
                "flow_id": flow,
                "sequence": seq,
                "role": "mentor",
                "text": text_value,
                "input_mode": input_mode,
                "options": options,
                "meta": meta,
                "model_used": model,
            }
        )
        child = (
            await self.session.execute(
                text("select parent_id from children where id=:id"), {"id": cid}
            )
        ).mappings().first()
        if child and child.get("parent_id"):
            try:
                self.ledger.append_dialogue(
                    str(child["parent_id"]),
                    cid,
                    sid,
                    kind="mentor_utterance",
                    text=text_value,
                    purpose=meta.get("phase"),
                    model=model,
                    payload={"input_mode": input_mode, "meta": meta},
                )
            except Exception:
                pass
        return turn

    async def _insert(self, row: dict[str, Any]) -> dict[str, Any]:
        saved = (
            await self.session.execute(
                text(
                    "insert into dialogue_turns(session_id,child_id,flow_id,sequence,role,text,options,"
                    "input_mode,explorer_reply,meta,model_used) "
                    "values(:session_id,:child_id,:flow_id,:sequence,:role,:text,cast(:options as jsonb),"
                    ":input_mode,cast(:explorer_reply as jsonb),cast(:meta as jsonb),:model_used) returning *"
                ),
                {
                    **row,
                    "options": json.dumps(row.get("options")),
                    "explorer_reply": json.dumps(row.get("explorer_reply")),
                    "meta": json.dumps(row.get("meta", {})),
                    "input_mode": row.get("input_mode"),
                    "model_used": row.get("model_used"),
                },
            )
        ).mappings().one()
        return self._turn(saved)

    async def _recent(self, cid: str, limit: int) -> list[dict[str, Any]]:
        rows = (
            await self.session.execute(
                text(
                    "select * from dialogue_turns where child_id=:id order by created_at desc,id desc limit :lim"
                ),
                {"id": cid, "lim": limit},
            )
        ).mappings().all()
        return [self._turn(row) for row in reversed(rows)]

    async def _last_mentor(self, sid: str) -> dict[str, Any] | None:
        row = (
            await self.session.execute(
                text(
                    "select * from dialogue_turns where session_id=:id and role in ('mentor','agent') "
                    "order by sequence desc limit 1"
                ),
                {"id": sid},
            )
        ).mappings().first()
        return self._turn(row) if row else None

    async def _history(self, cid: str, turns: list[dict[str, Any]]) -> dict[str, Any]:
        if not turns:
            return {
                "page_size": self.PAGE_SIZE,
                "has_older": False,
                "oldest_turn_id": None,
                "newest_turn_id": None,
                "oldest_sequence": None,
                "newest_sequence": None,
            }
        old, new = turns[0], turns[-1]
        older = (
            await self.session.execute(
                text(
                    "select 1 from dialogue_turns where child_id=:cid and "
                    "(created_at<:at or (created_at=:at and id<:id)) limit 1"
                ),
                {"cid": cid, "at": old["created_at"], "id": old["id"]},
            )
        ).scalar()
        return {
            "page_size": self.PAGE_SIZE,
            "has_older": bool(older),
            "oldest_turn_id": old["id"],
            "newest_turn_id": new["id"],
            "oldest_sequence": old["sequence"],
            "newest_sequence": new["sequence"],
        }

    @staticmethod
    def _turn(row: Any) -> dict[str, Any]:
        d = dict(row)
        for key in ("options", "explorer_reply", "meta"):
            if isinstance(d.get(key), str):
                try:
                    d[key] = json.loads(d[key])
                except ValueError:
                    d[key] = None if key != "meta" else {}
        created = d.get("created_at")
        return {
            "id": str(d["id"]),
            "child_id": str(d["child_id"]),
            "session_id": str(d["session_id"]),
            "flow_id": str(d["flow_id"]),
            "sequence": int(d["sequence"]),
            "role": str(d["role"]),
            "text": str(d["text"]),
            "options": d.get("options"),
            "input_mode": d.get("input_mode"),
            "explorer_reply": d.get("explorer_reply"),
            "meta": d.get("meta") or {},
            "model_used": d.get("model_used"),
            # Mantener datetime para queries internas (_history); FastAPI lo serializa.
            "created_at": created if created is not None else "",
        }
