"""Play dialogue: first_run + placement + LLM Gemini + ledger ficheros."""
from __future__ import annotations

import asyncio
import json
import re
from typing import Any
from uuid import UUID

from sqlalchemy import text

from app.ai.agents.curriculum_knowledge import (
    ANSWER_LEAK_IN_STIMULUS_RULE,
    FANTASY_PATH_TITLE_GUIDANCE,
    FANTASY_WORLD_PROSE_RULE,
    GAP_QUESTION_IN_STIMULUS_RULE,
    MEANING_QUESTION_NO_ECHO_RULE,
    PATH_LORE_ONLY_IF_TAUGHT_RULE,
    PLACEMENT_PRIOR_KNOWLEDGE_RULE,
    SCI_FI_WORLD_PROSE_RULE,
    STIMULUS_PROMPT_ALIGNMENT_RULE,
)
from app.ai.agents.deps import AudienceContext, RunDeps
from app.ai.agents.envelopes import (
    DialogueEnvelope,
    PathPackEnvelope,
    PlacementQueueEnvelope,
    TravelerProfileEnvelope,
)
from app.ai.agents.runner import build_character_coach_prompt, run_purpose
from app.ai.errors import AiProductError, product_error
from app.ai.gemini_gateway import GeminiGateway
from app.ai.journey.ledger import JourneyLedger
from app.ai.orchestrator import Orchestrator, TurnContext
from app.ai.orchestrator.input_modes import PHASE_INPUT_MODE
from app.ai.orchestrator.tools import ledger_recent_avoid_phrases
from app.catalogs import AgeBand, SubjectCatalog
from app.catalogs.zone_catalog import ZoneCatalog
from app.catalogs.character_species import resolve_species_input, species_options_for_world
from app.catalogs.explorer_gender import (
    assert_explorer_gender,
    canonical_gender_question,
    gender_chip_options,
    gender_grammar_prompt_block,
    resolve_explorer_gender,
)
from app.config import get_settings
from app.logging_ import AppLogger
from app.services.chapter_titles import read_latest_chapter_opened, resolve_chapter
from app.services.mentor_profiles import mentor_for_child, mentor_profile, resolve_mentor_key
from app.services.mentor_prose import (
    franchise_violations_in_text,
    path_compose_exhausted_mentor_text,
    simple_character_agent_text,
    validate_species_options,
    validate_traveler_profile_prose,
)
from app.services.baggage_offers import BaggageOfferService
from app.services.crew import CrewService
from app.services.crew_progress import CrewProgressService
from app.services.path_composer_context import PathComposerContextService
from app.services.placement import PlacementService
from app.services.subject_progress_config import (
    MAX_CHALLENGES_PER_PATH,
    MIN_CHALLENGES_PER_PATH,
    SEED_ROLLING,
    challenges_per_path_from_pack,
    effective_challenges_per_path,
)
from app.services.traveler_profile import extract_palette_tokens, palette_is_meaningful
from app.services.waiting_copy import WaitingCopyService
from app.services.waiting_phrases import pick_waiting_batch

compose_log = AppLogger("compose")


class DialogueService:
    PAGE_SIZE = 24

    def __init__(self, session: Any, gateway: GeminiGateway | None = None) -> None:
        self.session = session
        self.gateway = gateway or GeminiGateway()
        self.settings = get_settings()
        self.ledger = JourneyLedger(self.settings.journey_data_dir)
        self.orchestrator = Orchestrator(settings=self.settings, gateway=self.gateway)
        self._ledger_events_cache: dict[tuple[str, str, str, str | None], list[dict[str, Any]]] = {}

    @staticmethod
    def _world(child: dict[str, Any]) -> str | None:
        theme = child.get("active_world_theme") or child.get("world_theme")
        return theme if theme in {"fantasy", "sci-fi"} else None

    def _ledger_avoid_phrases(self, child: dict[str, Any]) -> list[str]:
        parent_id = child.get("parent_id")
        if not parent_id:
            return []
        try:
            return ledger_recent_avoid_phrases(
                self.ledger,
                str(parent_id),
                str(child["id"]),
                self._world(child),
            )
        except Exception:
            return []

    async def open_session(
        self, auth_user_id: str, child_id: str, flow_id: str = "first_run"
    ) -> dict[str, Any]:
        child = await self._child(auth_user_id, child_id)
        if child.get("status") == "paused":
            raise PermissionError("child_paused")
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
            mentor = resolve_mentor_key(child)
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
        turns = await self._recent(child_id, self.PAGE_SIZE, str(row["id"]))
        last = await self._last_mentor(str(row["id"]))
        last_phase = (last or {}).get("meta", {}).get("phase")
        chapter = self._resolve_chapter(child, str(row["id"]), last_phase)
        self._record_chapter_if_changed(child, str(row["id"]), chapter)
        payload = {
            "session_id": str(row["id"]),
            "flow_id": str(row["flow_id"]),
            "onboarding_step": child.get("onboarding_step") or "pending_entry",
            "world_theme": child.get("world_theme"),
            "age_band": child.get("age_band") or child.get("effective_age_band"),
            "age_years": child.get("age_years"),
            "display_name": child.get("display_name"),
            "mentor": mentor_profile(str(row.get("mentor_id") or resolve_mentor_key(child))),
            "chapter": chapter,
            "turns": turns,
            "history": await self._history(child_id, turns, str(row["id"])),
            "pending_agent_turn": await self._last_mentor(str(row["id"])),
            "waiting_copy": await WaitingCopyService(self.session).waiting_copy_from_cache(
                child_id
            ),
        }
        await self._attach_baggage_offers(payload, child, str(row["id"]))
        return payload

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
                text(
                    "select id, sequence, session_id from dialogue_turns "
                    "where id=:id and child_id=:cid"
                ),
                {"id": before_turn_id, "cid": child_id},
            )
        ).mappings().first()
        if not anchor:
            raise ValueError("before_turn_id not found")
        amount = max(1, min(48, limit or self.PAGE_SIZE))
        rows = (
            await self.session.execute(
                text(
                    "select * from dialogue_turns where child_id=:cid and session_id=:sid "
                    "and sequence < :seq order by sequence desc limit :lim"
                ),
                {
                    "cid": child_id,
                    "sid": session_id,
                    "seq": anchor["sequence"],
                    "lim": amount,
                },
            )
        ).mappings().all()
        turns = await self._turns_from_rows(reversed(rows), child_id)
        return {"turns": turns, "history": await self._history(child_id, turns, session_id)}

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
        display_label = str(reply.get("displayLabel") or "").strip()
        if kind == "continue":
            bubble_text = display_label or "Continuar"
        elif kind == "option" and display_label:
            bubble_text = display_label
        else:
            bubble_text = value

        explorer_meta: dict[str, Any] = {}
        if kind == "option":
            last_mentor = await self._last_mentor(session_id)
            scoring_item = await self._choice_echo_scoring_item(
                last_mentor, child_id, session_id, child
            )
            explorer_meta = self._choice_echo_meta(
                last_mentor,
                selected_id=value,
                display_label=display_label,
                reply=reply,
                scoring_item=scoring_item,
            )

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
        explorer_turn = await self._insert(
            {
                "session_id": session_id,
                "child_id": child_id,
                "flow_id": session["flow_id"],
                "sequence": sequence,
                "role": "explorer",
                "text": bubble_text,
                "explorer_reply": reply,
                "meta": explorer_meta,
            }
        )
        self._ledger_explorer(child, session_id, bubble_text, reply)
        return await self._advance_from_last_explorer(
            auth_user_id,
            child_id,
            session_id,
            session,
            int(explorer_turn["sequence"]),
            reply,
            child,
            attach_debug=attach_debug,
        )

    async def replay_last_explorer_reply(
        self,
        auth_user_id: str,
        child_id: str,
        session_id: str,
        *,
        attach_debug: bool = False,
    ) -> dict[str, Any] | None:
        """Re-ejecuta la fase actual sin insertar otro turno explorador (rewind debug)."""
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
        row = (
            await self.session.execute(
                text(
                    "select * from dialogue_turns where session_id=:sid and role='explorer' "
                    "order by sequence desc limit 1"
                ),
                {"sid": session_id},
            )
        ).mappings().first()
        if not row:
            return None
        reply = row.get("explorer_reply")
        if isinstance(reply, str):
            try:
                reply = json.loads(reply)
            except ValueError:
                reply = {}
        if not isinstance(reply, dict):
            reply = {}
        if not reply:
            kind = "text" if str(row.get("text") or "").strip() else "continue"
            reply = {
                "kind": kind,
                "text": str(row.get("text") or ""),
                "option_id": str(row.get("text") or ""),
            }
        return await self._advance_from_last_explorer(
            auth_user_id,
            child_id,
            session_id,
            session,
            int(row["sequence"]),
            reply,
            child,
            attach_debug=attach_debug,
        )

    async def reemit_placement_item(
        self,
        auth_user_id: str,
        child_id: str,
        session_id: str,
        *,
        item_index: int,
    ) -> dict[str, Any] | None:
        """Vuelve a emitir un ítem del examen en curso sin recomponer la cola (rewind debug)."""
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
        parent_id = child.get("parent_id")
        world = self._world(child)
        state = self._read_placement_state(
            str(parent_id) if parent_id else None, child_id, session_id, world
        )
        if not state or not state.get("queue"):
            return None
        queue = state["queue"]
        if item_index < 0 or item_index >= len(queue):
            return None
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
        mentor_id = str(session.get("mentor_id") or "guardian")
        turn_payload = PlacementService(self.session).item_to_turn(
            session_id,
            child_id,
            str(session["flow_id"]),
            sequence,
            mentor_id,
            str(world or "fantasy"),
            queue[item_index],
            item_index,
            len(queue),
            child,
        )
        return await self._insert(
            {
                **{
                    k: turn_payload[k]
                    for k in (
                        "session_id",
                        "child_id",
                        "flow_id",
                        "sequence",
                        "role",
                        "text",
                        "input_mode",
                        "options",
                        "meta",
                    )
                },
                "explorer_reply": None,
                "model_used": turn_payload.get("model_used"),
            }
        )

    async def reemit_choose_path(
        self,
        auth_user_id: str,
        child_id: str,
        session_id: str,
    ) -> dict[str, Any] | None:
        """Restaura la encrucijada post-examen (choose_path) reutilizando path_pack si existe."""
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
        parent_id = child.get("parent_id")
        world = self._world(child) or "fantasy"
        events = self._ledger_events_for_session(
            str(parent_id) if parent_id else None,
            child_id,
            session_id,
            world,
        )
        completed_ids = DialogueService._completed_path_ids_from_events(events)
        latest_completed = DialogueService._latest_completed_path_id(events)
        pack = self._read_path_pack(
            str(parent_id) if parent_id else None, child_id, session_id, world
        )
        if not pack:
            pack = await self._compose_path_pack(child, session_id)
            if parent_id and pack:
                try:
                    waiting_hints = await pick_waiting_batch(
                        self.session,
                        world_theme=world,
                        age_band=child.get("age_band") or child.get("effective_age_band"),
                        phase="path_compose",
                    )
                    self._append_ledger_event(
                        str(parent_id),
                        child_id,
                        session_id,
                        kind="path_pack",
                        purpose="path_composer",
                        payload={"pack": pack, "waiting_hints": waiting_hints},
                        world_theme=world,
                    )
                except Exception:
                    pass
        if not pack:
            raise ValueError("path pack unavailable")
        if latest_completed and any(
            str(path.get("path_id") or "") == latest_completed for path in pack
        ):
            pack, _ = await self._refresh_path_pack_after_complete(
                child, session_id, latest_completed
            )
        elif completed_ids:
            pack = [
                path
                for path in pack
                if str(path.get("path_id") or "") not in completed_ids
            ]
        if not pack:
            raise ValueError("path pack unavailable")
        if completed_ids:
            intro_text = (
                "¡Camino superado! Siguen rutas que dejaste pendientes "
                "y una nueva pensada para lo que más te conviene practicar ahora. "
                "Si quieres, pregúntame antes de elegir."
            )
        else:
            intro_text = (
                "¡Prueba superada! Elige el siguiente camino. "
                "Hay tres rutas pensadas para lo que más te conviene practicar. "
                "Si quieres, pregúntame antes de elegir."
            )
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
        waiting_hints = await pick_waiting_batch(
            self.session,
            world_theme=world,
            age_band=child.get("age_band") or child.get("effective_age_band"),
            phase="path_compose",
        )
        options = [
            {
                "id": p["path_id"],
                "label": p["title"],
                "description": DialogueService._path_pitch_description(p),
            }
            for p in pack
        ]
        return await self._mentor_turn(
            session_id,
            child_id,
            str(session["flow_id"]),
            sequence,
            intro_text,
            "options_or_text",
            options,
            {
                "phase": "choose_path",
                "waiting_hints": waiting_hints,
                "path_ids": [p["path_id"] for p in pack],
            },
        )

    async def reemit_path_challenge(
        self,
        auth_user_id: str,
        child_id: str,
        session_id: str,
        *,
        challenge_index: int,
        path_id: str | None = None,
    ) -> dict[str, Any] | None:
        """Vuelve a emitir un reto del camino en curso (rewind debug)."""
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
        parent_id = child.get("parent_id")
        world = self._world(child)
        progress = self._read_path_progress(
            str(parent_id) if parent_id else None, child_id, session_id, world
        )
        path = dict(progress.get("path") or {})
        if path_id:
            path["path_id"] = path_id
        challenges = list(path.get("challenges") or [])
        if challenge_index < 0 or challenge_index >= len(challenges):
            raise ValueError("path challenge unavailable")
        if parent_id:
            try:
                self._append_ledger_event(
                    str(parent_id),
                    child_id,
                    session_id,
                    kind="path_progress",
                    payload={
                        "path_id": path.get("path_id"),
                        "challenge_index": challenge_index,
                        "status": "active",
                        "path": path,
                    },
                    world_theme=world,
                )
            except Exception:
                pass
        ch = DialogueService._finalize_path_challenge(challenges[challenge_index])
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
        typ = str(ch.get("item_type") or "mcq")
        return await self._mentor_turn(
            session_id,
            child_id,
            str(session["flow_id"]),
            sequence,
            DialogueService._format_path_challenge_text(ch, path),
            "options_only" if typ == "mcq" else "text_only",
            ch.get("options"),
            {
                "phase": "path_challenge",
                "path_id": path.get("path_id"),
                "challenge_index": challenge_index,
                "total": len(challenges),
            },
        )

    async def reemit_path_intro(
        self,
        auth_user_id: str,
        child_id: str,
        session_id: str,
        *,
        path_id: str | None = None,
    ) -> dict[str, Any] | None:
        """Vuelve a emitir la intro del camino elegido (rewind debug)."""
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
        parent_id = child.get("parent_id")
        world = self._world(child)
        progress = self._read_path_progress(
            str(parent_id) if parent_id else None, child_id, session_id, world
        )
        path = dict(progress.get("path") or {})
        if path_id:
            path["path_id"] = path_id
        if not path:
            raise ValueError("path progress unavailable")
        if parent_id:
            try:
                self._append_ledger_event(
                    str(parent_id),
                    child_id,
                    session_id,
                    kind="path_progress",
                    payload={
                        "path_id": path.get("path_id"),
                        "challenge_index": 0,
                        "status": "intro",
                        "path": path,
                    },
                    world_theme=world,
                )
            except Exception:
                pass
        text = DialogueService._format_path_intro_text(path)
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
        return await self._mentor_turn(
            session_id,
            child_id,
            str(session["flow_id"]),
            sequence,
            text,
            "options_or_text",
            [DialogueService._path_intro_start_option()],
            {"phase": "path_intro", "path_id": path.get("path_id")},
        )

    async def _advance_from_last_explorer(
        self,
        auth_user_id: str,
        child_id: str,
        session_id: str,
        session: Any,
        sequence: int,
        reply: dict[str, Any],
        child: dict[str, Any],
        *,
        attach_debug: bool = False,
    ) -> dict[str, Any]:
        kind = reply.get("kind")
        value = str(reply.get("text") or reply.get("option_id") or "").strip()

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
            elif phase == "choose_gender":
                effects, turns = await self._phase_choose_gender(
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
            elif phase == "placement_feedback":
                effects, turns = await self._placement_feedback_continue(
                    child_id, session_id, session, sequence, last or {}
                )
            elif phase == "choose_path":
                if kind == "text":
                    effects, turns = await self._path_phase_mentor_consult(
                        child_id,
                        session_id,
                        session,
                        sequence,
                        value,
                        child,
                        phase="choose_path",
                        last=last or {},
                    )
                else:
                    effects, turns = await self._choose_path(
                        child_id, session_id, session, sequence, reply, value, child
                    )
            elif phase == "path_intro":
                last_meta = (last or {}).get("meta") if isinstance((last or {}).get("meta"), dict) else {}
                if kind == "text" and not last_meta.get("retry"):
                    effects, turns = await self._path_phase_mentor_consult(
                        child_id,
                        session_id,
                        session,
                        sequence,
                        value,
                        child,
                        phase="path_intro",
                        last=last or {},
                    )
                elif last_meta.get("retry"):
                    effects, turns = await self._path_intro_retry_continue(
                        child_id, session_id, session, sequence, child, last or {}
                    )
                else:
                    effects, turns = await self._path_next_challenge(
                        child_id, session_id, session, sequence, child
                    )
            elif phase == "path_challenge":
                effects, turns = await self._path_challenge_answer(
                    child_id, session_id, session, sequence, value, reply, last or {}, child
                )
            elif phase == "adventure_ready":
                effects, turns = await self._start_path_choice(
                    child,
                    session_id,
                    session,
                    sequence,
                    refresh_after_complete=True,
                )
            elif phase == "compose_failed":
                retry = str((last or {}).get("meta", {}).get("retry_action") or "placement")
                if retry == "path_pack":
                    effects, turns = await self._start_path_choice(
                        child, session_id, session, sequence
                    )
                else:
                    effects, turns = await self._start_placement(
                        auth_user_id, child_id, session_id, session, sequence
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
            retry_action = "placement"
            if phase in {"choose_path", "adventure_ready", "path_intro"}:
                retry_action = "path_pack"
            compose_debug = dict(getattr(exc, "compose_debug", None) or {})
            compose_debug.setdefault("outcome", "failed")
            compose_debug.setdefault("error_code", exc.error_code)
            if retry_action == "placement":
                compose_debug.setdefault("purpose", "placement_item_writer")
            elif retry_action == "path_pack":
                compose_debug.setdefault("purpose", "path_composer")
            if exc.model:
                compose_debug.setdefault("model", exc.model)
            if exc.models_tried:
                compose_debug.setdefault("models_tried", exc.models_tried)
            mentor_text = DialogueService._compose_failed_mentor_text(
                exc, retry_action=retry_action, child=child
            )
            turns = [
                await self._mentor_turn(
                    session_id,
                    child_id,
                    str(session["flow_id"]),
                    sequence + 1,
                    mentor_text,
                    "continue",
                    [{"id": "continue", "label": "Reintentar"}],
                    {
                        "phase": "compose_failed",
                        "error_code": exc.error_code,
                        "models_tried": exc.models_tried,
                        "retry": True,
                        "retry_action": retry_action,
                        "compose_failed": True,
                        "compose_debug": compose_debug,
                    },
                )
            ]

        fresh = await self._child(auth_user_id, child_id)
        mid = resolve_mentor_key(fresh)
        last_turn = turns[-1] if turns else last
        last_phase = (last_turn or {}).get("meta", {}).get("phase")
        chapter = self._resolve_chapter(fresh, session_id, last_phase)
        self._record_chapter_if_changed(fresh, session_id, chapter)
        result: dict[str, Any] = {
            "agent_turns": turns,
            "effects": effects,
            "pending_agent_turn": await self._last_mentor(session_id),
            "waiting_copy": await WaitingCopyService(self.session).waiting_copy_from_cache(
                child_id
            ),
            "flow_complete": fresh.get("onboarding_step") == "complete"
            and fresh.get("placement_status") == "completed",
            "onboarding_step": fresh.get("onboarding_step"),
            "display_name": fresh.get("display_name"),
            "mentor": mentor_profile(mid),
            "chapter": chapter,
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
        await self._attach_baggage_offers(result, fresh, session_id)
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
        mentor = resolve_mentor_key({"world_theme": theme})
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
                "onboarding_step='choose_gender',updated_at=now() where id=:id"
            ),
            {"age": age, "band": band, "id": child_id},
        )
        effects = [
            {"type": "set_age", "value": {"age_years": age, "age_band": band}},
            {"type": "advance_onboarding", "to": "choose_gender"},
            {
                "type": "suggest_active_subjects",
                "value": SubjectCatalog.base_subjects_for_band(band),
            },
        ]
        child = await self._child_by_id(child_id)
        child["age_years"] = age
        child["age_band"] = band
        child["onboarding_step"] = "choose_gender"
        turn = await self._mentor_choose_gender_turn(
            child,
            session_id,
            str(session["flow_id"]),
            sequence + 1,
        )
        return effects, [turn]

    async def _mentor_choose_gender_turn(
        self,
        child: dict[str, Any],
        session_id: str,
        flow: str,
        sequence: int,
        *,
        reprompt: bool = False,
    ) -> dict[str, Any]:
        band = child.get("age_band") or child.get("effective_age_band")
        age = child.get("age_years")
        question = canonical_gender_question(band, age)
        options = gender_chip_options(band, age)
        prefix = "No he entendido. " if reprompt else ""
        return await self._mentor_turn(
            session_id,
            str(child["id"]),
            flow,
            sequence,
            f"{prefix}{question}",
            "options_only",
            options,
            {
                "phase": "choose_gender",
                "world_theme": child.get("world_theme"),
            },
            None,
        )

    async def _phase_choose_gender(
        self, child_id: str, session_id: str, session: Any, sequence: int, value: str
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        try:
            gender = assert_explorer_gender(value)
        except ValueError:
            child = await self._child_by_id(child_id)
            turn = await self._mentor_choose_gender_turn(
                child,
                session_id,
                str(session["flow_id"]),
                sequence + 1,
                reprompt=True,
            )
            return [], [turn]

        await self.session.execute(
            text(
                "update children set explorer_gender=:gender,"
                "onboarding_step='choose_character',updated_at=now() where id=:id"
            ),
            {"gender": gender, "id": child_id},
        )
        effects = [
            {"type": "set_explorer_gender", "value": gender},
            {"type": "advance_onboarding", "to": "choose_character"},
        ]
        child = await self._child_by_id(child_id)
        child["explorer_gender"] = gender
        child["onboarding_step"] = "choose_character"
        turn = await self._agent_mentor_turn(
            child,
            session_id,
            str(session["flow_id"]),
            sequence + 1,
            "Pide que elija una de las sugerencias o describa su personaje con sus palabras. "
            "Devuelve exactamente 3 opciones en `options` (id slug, label, description breve). "
            "Los labels deben ser variados y evocadores (título, rol, lugar o historia). "
            "Si el arquetipo es humano, no hace falta decir «humano». Si NO es humano, "
            "el label debe nombrar la especie (elfo, orco, androide…). Ejemplos: "
            "«El mago de la noche blanca», «El elfo explorador del bosque milenario», "
            "«La bibliotecaria de Anderlogia». Al menos una opción no humana entre las tres. "
            "Inspírate en el glosario; no copies lista fija. No hables de «forma y oficio». "
            "No uses continue: chips temáticos + texto libre. "
            f"Concordancia de género: explorer_gender={gender}.",
            "choose_character_species",
            purpose="mentor_guide",
            force_input_mode="options_or_text",
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
        *,
        prose_retry_hint: str | None = None,
        prose_attempt: int = 0,
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        raw = resolve_species_input(value, self._world(child))[:120] or "explorador"
        deps = self._deps(child, session_id, "character_coach")
        age_years = child.get("age_years")
        age_band = child.get("age_band") or child.get("effective_age_band")
        prompt = build_character_coach_prompt(
            deps,
            explorer_choice=raw,
            extra_hint=prose_retry_hint,
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
            avoid_phrases = self._ledger_avoid_phrases(child)
            prose_issues = validate_traveler_profile_prose(
                agent_text=agent_text,
                species=species,
                vibe=vibe,
                age_band=age_band,
                age_years=age_years,
                description_md=profile.description_md,
                personality_md=profile.personality_md,
                avoid_phrases=avoid_phrases,
            )
            if prose_issues:
                species = raw[:64]
                vibe = species
                agent_text = simple_character_agent_text(raw)
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

        # Persistencia canónica: traveler.md (no child_traits PG)
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
                        "explorer_gender": resolve_explorer_gender(
                            child.get("explorer_gender")
                        ),
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
                    world_theme=self._world(child),
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
        waiting_hints = await pick_waiting_batch(
            self.session,
            world_theme=str(self._world(child) or "neutral"),
            age_band=child.get("age_band") or child.get("effective_age_band"),
            phase="placement_compose",
        )
        queue = await self._compose_placement_queue(child, session_id)
        parent_id = child.get("parent_id")
        if parent_id:
            try:
                self._append_ledger_event(
                    str(parent_id),
                    child_id,
                    session_id,
                    kind="placement_queue",
                    purpose="placement_item_writer",
                    payload={"queue": queue, "waiting_hints": waiting_hints},
                    world_theme=self._world(child),
                )
            except Exception:
                pass
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
        meta = dict(turn_row.get("meta") or {})
        meta["waiting_hints"] = waiting_hints
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
                "meta": meta,
                "explorer_reply": None,
                "model_used": turn_row.get("model_used"),
            }
        )
        return started["effects"], [turn]

    async def _compose_placement_queue(
        self, child: dict[str, Any], session_id: str
    ) -> list[dict[str, Any]]:
        active = PlacementService.active_subjects_for_child(child)
        band = (
            AgeBand.from_legacy(child.get("age_band"), child.get("age_years"))
            or AgeBand.CHILD
        )
        subject_slots = SubjectCatalog.exam_subject_slots(band, active)
        if not subject_slots:
            raise product_error("ai_compose_failed")

        batch_max = max(1, int(self.settings.ai_compose_batch_max_slots))
        batch_retries = max(0, int(self.settings.ai_compose_batch_retries))
        batches = (
            self._chunk_subject_slots(subject_slots, batch_max)
            if len(subject_slots) > batch_max
            else [subject_slots]
        )
        items: list[dict[str, Any]] = []
        palette_tokens = self._traveler_palette_tokens(child)
        for batch_index, batch_slots in enumerate(batches):
            batch_items = await self._compose_placement_batch_with_retry(
                child,
                session_id,
                batch_slots,
                band,
                batch_index=batch_index,
                batch_retries=batch_retries,
                palette_tokens=palette_tokens,
            )
            items.extend(batch_items)
        return items

    def _traveler_palette_tokens(self, child: dict[str, Any]) -> list[str]:
        parent_id = child.get("parent_id")
        if not parent_id:
            return []
        try:
            frontmatter, _body = self.ledger.read_traveler_profile(
                str(parent_id), str(child["id"])
            )
        except Exception:
            return []
        return extract_palette_tokens(str(frontmatter.get("palette") or ""))

    @staticmethod
    def _chunk_subject_slots(slots: list[str], size: int) -> list[list[str]]:
        if size <= 0:
            return [slots]
        return [slots[i : i + size] for i in range(0, len(slots), size)]

    @staticmethod
    def _placement_compose_error(
        model: str | None = None,
        *,
        issue: str | None = None,
        batch_index: int | None = None,
        subject_id: str | None = None,
        quality_fallback_items: list[dict[str, Any]] | None = None,
    ) -> AiProductError:
        debug: dict[str, Any] = {
            "outcome": "failed",
            "purpose": "placement_item_writer",
        }
        if issue:
            debug["quality_issue"] = issue
        if batch_index is not None:
            debug["batch_index"] = batch_index
        if subject_id:
            debug["subject_id"] = subject_id
        if model:
            debug["model"] = model
        err = product_error("ai_compose_failed", model=model, compose_debug=debug)
        if quality_fallback_items:
            err.quality_fallback_items = list(quality_fallback_items)
        return err

    async def _compose_placement_batch_with_retry(
        self,
        child: dict[str, Any],
        session_id: str,
        subject_slots: list[str],
        age_band: str,
        *,
        batch_index: int,
        batch_retries: int,
        palette_tokens: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        last_error: AiProductError | None = None
        last_quality_items: list[dict[str, Any]] | None = None
        tokens = palette_tokens or []
        for attempt in range(batch_retries + 1):
            try:
                return await self._compose_placement_batch(
                    child,
                    session_id,
                    subject_slots,
                    age_band,
                    batch_index=batch_index,
                    palette_tokens=tokens,
                )
            except AiProductError as exc:
                last_error = exc
                fallback = getattr(exc, "quality_fallback_items", None)
                if isinstance(fallback, list) and fallback:
                    last_quality_items = fallback
                compose_log.warning(
                    "placement_compose_batch_retry",
                    batch_index=batch_index,
                    attempt=attempt + 1,
                    slots=len(subject_slots),
                    error_code=exc.error_code,
                    quality_fallback=bool(last_quality_items),
                )
                if attempt >= batch_retries:
                    if last_quality_items is not None:
                        issue = (exc.compose_debug or {}).get("quality_issue")
                        compose_log.warning(
                            "placement_compose_quality_fallback",
                            batch_index=batch_index,
                            issue=issue,
                            slots=len(last_quality_items),
                        )
                        return last_quality_items
                    raise
        if last_error:
            raise last_error
        raise self._placement_compose_error()

    async def _compose_placement_batch(
        self,
        child: dict[str, Any],
        session_id: str,
        subject_slots: list[str],
        age_band: str,
        *,
        batch_index: int = 0,
        palette_tokens: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        deps = self._deps(child, session_id, "placement_item_writer")
        prompt = self._placement_compose_prompt(
            child, subject_slots, age_band, batch_index=batch_index
        )
        bundle, model = await run_purpose(
            "placement_item_writer",
            prompt,
            deps,
            settings=self.settings,
            gateway=self.gateway,
            expect_type=PlacementQueueEnvelope,
        )
        if not isinstance(bundle, PlacementQueueEnvelope) or len(bundle.items) != len(
            subject_slots
        ):
            compose_log.warning(
                "placement_compose_batch_count_mismatch",
                batch_index=batch_index,
                expected=len(subject_slots),
                got=len(bundle.items) if isinstance(bundle, PlacementQueueEnvelope) else None,
                model=model,
            )
            raise self._placement_compose_error(
                model=model,
                issue="batch_count_mismatch",
                batch_index=batch_index,
            )

        items: list[dict[str, Any]] = []
        for idx, (subject_id, item) in enumerate(
            zip(subject_slots, bundle.items, strict=True)
        ):
            blob = " ".join(
                str(getattr(item, key, "") or "")
                for key in ("prompt_text", "presentation_text", "item_key")
            )
            if franchise_violations_in_text(blob):
                raise self._placement_compose_error(
                    model=model,
                    issue="franchise_violation",
                    batch_index=batch_index,
                    subject_id=subject_id,
                )
            resolved_subject = (
                item.subject_id
                if SubjectCatalog.is_valid(item.subject_id)
                else subject_id
            )
            item_dict = {
                "subject_id": resolved_subject,
                "item_key": item.item_key or f"{subject_id}_{idx + 1}",
                "item_type": item.item_type,
                "prompt_text": item.prompt_text,
                "presentation_text": item.presentation_text or item.prompt_text,
                "options": [option.model_dump() for option in item.options],
                "correct_option_id": item.correct_option_id,
                "expected_answer": item.expected_answer,
                "success_feedback": item.success_feedback,
                "explanation": item.explanation,
                "model_used": model,
            }
            items.append(self._finalize_placement_queue_item(item_dict))
        del palette_tokens
        compose_log.info(
            "placement_compose_batch_ok",
            batch_index=batch_index,
            slots=len(subject_slots),
            model=model,
        )
        return items

    @staticmethod
    def _finalize_mcq_item(item: dict[str, Any]) -> dict[str, Any]:
        """Normaliza opciones y resuelve correct_option_id (id, label o explicación)."""
        out = dict(item)
        options = DialogueService._normalize_options_list(out.get("options")) or []
        out["options"] = options
        if str(out.get("item_type") or "mcq") == "mcq" and options:
            resolved = DialogueService._resolved_correct_option_id(out, options)
            if not resolved or not any(
                str(opt.get("id")) == resolved for opt in options
            ):
                resolved = DialogueService._infer_correct_option_id(out, options)
            if resolved:
                out["correct_option_id"] = resolved
        return out

    @staticmethod
    def _finalize_placement_queue_item(item: dict[str, Any]) -> dict[str, Any]:
        """Normaliza opciones y alinea correct_option_id con los ids reales."""
        return DialogueService._finalize_mcq_item(item)

    @staticmethod
    def _resolved_correct_option_id(
        item: dict[str, Any], options: list[dict[str, Any]]
    ) -> str | None:
        raw = item.get("correct_option_id")
        if not raw:
            return None
        raw_s = str(raw).strip()
        if not raw_s:
            return None
        ids = {str(opt.get("id")) for opt in options}
        if raw_s in ids:
            return raw_s
        raw_lower = raw_s.lower()
        for opt in options:
            label = str(opt.get("label") or "").strip().lower()
            if label and label == raw_lower:
                return str(opt.get("id"))
        if (
            len(raw_s) == 1
            and raw_s.isalpha()
            and raw_s not in ids
            and options
        ):
            idx = ord(raw_lower) - ord("a")
            if 0 <= idx < len(options):
                return str(options[idx].get("id"))
        return raw_s

    _READING_EVENT_QUESTION_MARKERS = (
        "qué ocurre",
        "que ocurre",
        "qué pasa",
        "que pasa",
        "qué sucede",
        "que sucede",
    )
    _READING_ACTION_VERBS = (
        "hay",
        "había",
        "mueve",
        "mueven",
        "cae",
        "caen",
        "brilla",
        "brillan",
        "suena",
        "suenan",
        "pasa",
        "pasan",
        "corre",
        "corren",
        "vuela",
        "vuelan",
        "escucha",
        "escuchan",
        "sopla",
        "soplan",
        "llueve",
        "nieva",
        "golpea",
        "golpean",
        "entra",
        "entran",
        "sale",
        "salen",
    )
    _PURPOSE_QUESTION_MARKERS = (
        "para qué",
        "para que ",
        "para qué sirven",
        "para que sirven",
        "para qué sirve",
        "para que sirve",
        "cuál es la función",
        "cual es la funcion",
        "cuál es el uso",
        "cual es el uso",
        "qué función",
        "que función",
        "con qué fin",
        "con que fin",
    )
    _PURPOSE_ANSWER_KEYWORDS = frozenset(
        {
            "volumen",
            "sombra",
            "sombras",
            "luz",
            "luces",
            "contraste",
            "profundidad",
            "realismo",
            "relieve",
            "forma",
            "efecto",
            "sombreado",
            "iluminación",
            "iluminacion",
            "medir",
            "calentar",
            "absorber",
            "nutrir",
            "proteger",
            "crear",
            "dar",
            "hacer",
            "mostrar",
            "marcar",
            "definir",
            "conseguir",
            "representar",
            "ayudar",
            "dibujar",
            "pintar",
            "expresar",
            "comunicar",
            "identificar",
            "clasificar",
            "ordenar",
            "comparar",
        }
    )
    _SPANISH_STOPWORDS = frozenset(
        {
            "para",
            "qué",
            "que",
            "los",
            "las",
            "del",
            "de",
            "la",
            "el",
            "un",
            "una",
            "en",
            "y",
            "o",
            "es",
            "son",
            "con",
            "por",
            "se",
            "al",
            "a",
            "como",
            "cómo",
            "juntos",
            "juntas",
            "obra",
            "unas",
            "unos",
            "su",
            "sus",
            "este",
            "esta",
            "ese",
            "esa",
            "una",
            "uno",
            "muy",
            "más",
            "mas",
            "sin",
            "sobre",
            "entre",
            "tiene",
            "tienen",
            "sirven",
            "sirve",
            "usar",
            "usan",
            "usa",
            "solo",
            "sólo",
            "toda",
            "todo",
            "todos",
            "todas",
            "cada",
            "otro",
            "otra",
            "otros",
            "otras",
            "ser",
            "parezca",
            "parece",
            "parecen",
            "según",
            "segun",
            "texto",
            "pregunta",
        }
    )
    _PALETTE_MAX_MENTIONS_PER_BATCH = 1
    _PLACEMENT_HARD_QUALITY = frozenset(
        {
            "empty_prompt",
            "mcq_needs_options",
            "mcq_invalid_correct_option",
            "short_text_missing_expected",
        }
    )
    _PATH_MIN_CHALLENGES = MIN_CHALLENGES_PER_PATH
    # Avisos suaves (log); no rechazan el pack ni fuerzan reintentos.
    _PATH_NARRATIVE_MIN_CHARS = 40
    _PATH_LESSON_MIN_CHARS = 80
    _PATH_CHALLENGE_WRAPPER_MIN_CHARS = 60
    _PATH_TEACHING_BEAT_MIN_CHARS = 0
    _STORY_COMPREHENSION_MARKERS = (
        "dónde",
        "donde",
        "cuándo",
        "cuando",
        "qué hizo",
        "que hizo",
        "qué hace",
        "que hace",
        "qué pasó",
        "que paso",
        "qué paso",
        "quién",
        "quien",
        "por qué",
        "porque",
    )
    _GAP_QUESTION_MARKERS = (
        "que falta",
        "qué falta",
        "completa el hueco",
        "completa la frase",
        "completa el pasaje",
        "locución causal",
        "locucion causal",
        "forma correcta de escribir",
        "escritura correcta",
        "ortografía correcta",
        "ortografia correcta",
    )
    _PATH_TITLE_CLICHES = (
        "bosque de los números",
        "torre de las letras",
        "torres de las letras",
        "biblioteca secreta",
        "torres de los números",
        "bosque de los relatos",
        "laberinto de las llaves",
        "forja de las estrellas",
        "archivos del reino",
        "biblioteca de mundos",
    )

    @staticmethod
    def _world_narrative_rules(theme: str) -> list[str]:
        normalized = str(theme or "fantasy").strip().lower()
        if normalized == "fantasy":
            return [FANTASY_WORLD_PROSE_RULE, FANTASY_PATH_TITLE_GUIDANCE]
        if normalized == "sci-fi":
            return [SCI_FI_WORLD_PROSE_RULE]
        return []

    @staticmethod
    def _compose_failed_mentor_text(
        exc: AiProductError,
        *,
        retry_action: str,
        child: dict[str, Any] | None = None,
    ) -> str:
        if retry_action == "path_pack":
            return path_compose_exhausted_mentor_text(child)
        detail = str(exc.detail or "").strip()
        if detail:
            return f"{detail} Pulsa continuar para reintentar."
        return "No se pudo generar la respuesta. Pulsa continuar para reintentar."

    @staticmethod
    def _normalize_challenge_text(text: str) -> str:
        lowered = str(text or "").lower()
        lowered = lowered.replace("«", "").replace("»", "").replace('"', "")
        lowered = re.sub(r"\s+", " ", lowered).strip()
        return lowered

    @staticmethod
    def _quoted_spans_in_prompt(prompt: str) -> list[str]:
        spans: list[str] = []
        for match in re.finditer(r"«([^»]+)»", str(prompt or "")):
            token = match.group(1).strip()
            if token:
                spans.append(token)
        for match in re.finditer(r'"([^"]+)"', str(prompt or "")):
            token = match.group(1).strip()
            if token:
                spans.append(token)
        return spans

    @staticmethod
    def _path_prompt_asks_for_gap(prompt: str) -> bool:
        lowered = str(prompt or "").lower()
        if any(marker in lowered for marker in DialogueService._GAP_QUESTION_MARKERS):
            return True
        if "locución" in lowered or "locucion" in lowered:
            if any(
                token in lowered
                for token in ("escrib", "forma correcta", "ortograf", "ortografía")
            ):
                return True
        return False

    @staticmethod
    def _wrapper_has_visible_gap(wrapper: str) -> bool:
        text = str(wrapper or "")
        if re.search(r"_{3,}", text):
            return True
        if "…" in text or "..." in text:
            return True
        if re.search(r"\[\s*\.{2,}\s*\]|\[\s*\]", text):
            return True
        return False

    @staticmethod
    def _path_challenge_stimulus_coherence_issue(
        challenge: dict[str, Any], *, subject_id: str
    ) -> str | None:
        wrapper = str(challenge.get("narrative_wrapper") or "").strip()
        prompt = str(challenge.get("prompt_text") or "").strip()
        if not wrapper or not prompt:
            return None
        quality_item = DialogueService._path_challenge_quality_item(
            challenge, subject_id
        )
        leak_issue = DialogueService._placement_item_quality_issue(quality_item)
        if leak_issue:
            return leak_issue
        if DialogueService._path_prompt_asks_for_gap(prompt):
            if not DialogueService._wrapper_has_visible_gap(wrapper):
                return "path_challenge_missing_gap"
        wrapper_norm = DialogueService._normalize_challenge_text(wrapper)
        for quote in DialogueService._quoted_spans_in_prompt(prompt):
            quote_norm = DialogueService._normalize_challenge_text(quote)
            if len(quote_norm) < 3:
                continue
            word_count = len(quote_norm.split())
            if word_count >= 5:
                if quote_norm not in wrapper_norm:
                    return "path_challenge_quote_not_in_wrapper"
                continue
            if not re.search(
                rf"\b{re.escape(quote_norm)}\b",
                wrapper_norm,
            ):
                return "path_challenge_quote_not_in_wrapper"
        return None

    @staticmethod
    def _is_purpose_question(text: str) -> bool:
        lowered = text.lower()
        return any(marker in lowered for marker in DialogueService._PURPOSE_QUESTION_MARKERS)

    @staticmethod
    def _content_tokens(text: str) -> set[str]:
        tokens = re.findall(r"[a-záéíóúñü]+", text.lower())
        return {
            token
            for token in tokens
            if len(token) >= 3 and token not in DialogueService._SPANISH_STOPWORDS
        }

    @staticmethod
    def _option_echoes_question_subject(presentation: str, label: str) -> bool:
        question_tokens = DialogueService._content_tokens(presentation)
        option_tokens = DialogueService._content_tokens(label)
        if not option_tokens or len(option_tokens) > 4:
            return False
        return option_tokens.issubset(question_tokens)

    @staticmethod
    def _option_has_purpose_semantics(label: str) -> bool:
        lowered = label.lower().strip()
        if re.search(r"\bpara\s+\w{3,}", lowered):
            return True
        option_tokens = set(re.findall(r"[a-záéíóúñü]+", lowered))
        if option_tokens & DialogueService._PURPOSE_ANSWER_KEYWORDS:
            return True
        return DialogueService._spanish_label_has_action_verb(label)

    @staticmethod
    def _palette_mention_count(
        items: list[dict[str, Any]], palette_tokens: list[str]
    ) -> int:
        if not palette_tokens:
            return 0
        hits = 0
        for item in items:
            presentation = " ".join(
                str(item.get(key) or "")
                for key in ("presentation_text", "prompt_text")
            ).lower()
            if any(token in presentation for token in palette_tokens):
                hits += 1
        return hits

    @staticmethod
    def _placement_batch_quality_issue(
        items: list[dict[str, Any]],
        *,
        palette_tokens: list[str] | None = None,
    ) -> str | None:
        tokens = palette_tokens or []
        if (
            tokens
            and DialogueService._palette_mention_count(items, tokens)
            > DialogueService._PALETTE_MAX_MENTIONS_PER_BATCH
        ):
            return "palette_overuse"
        return None

    _UNNATURAL_MATERIAL_LABEL = re.compile(
        r"\b(llave|caja|anillo|moneda|espada|corona)\s+"
        r"(plata|oro|madera|hierro|cobre|cristal)\b",
        re.IGNORECASE,
    )

    @staticmethod
    def _spanish_label_has_action_verb(label: str) -> bool:
        lowered = label.lower()
        tokens = re.findall(r"[a-záéíóúñü]+", lowered)
        for token in tokens:
            if token in DialogueService._READING_ACTION_VERBS:
                return True
            if len(token) >= 4 and token.endswith(("ando", "iendo")):
                return True
            if (
                len(token) >= 4
                and token.endswith(("an", "en", "as", "es"))
                and not token.endswith(("mas", "pes", "les", "nos"))
            ):
                return True
        return False

    @staticmethod
    def _placement_item_quality_issue(item: dict[str, Any]) -> str | None:
        """Devuelve motivo de rechazo o None si el ítem es válido."""
        presentation = " ".join(
            str(item.get(key) or "")
            for key in ("presentation_text", "prompt_text")
        ).strip()
        if not presentation:
            return "empty_prompt"
        presentation_lower = presentation.lower()
        item_type = str(item.get("item_type") or "mcq")
        subject_id = str(item.get("subject_id") or "").lower()
        # Comprensión lectora: la respuesta puede estar en el pasaje citado.
        skip_answer_leak = subject_id == "reading"
        options = item.get("options") if isinstance(item.get("options"), list) else []

        if item_type == "mcq":
            if len(options) < 2:
                return "mcq_needs_options"
            correct_id = DialogueService._resolved_correct_option_id(item, options)
            if not correct_id or not any(
                str(opt.get("id")) == correct_id for opt in options
            ):
                return "mcq_invalid_correct_option"
            correct_opt = next(
                (opt for opt in options if str(opt.get("id")) == correct_id),
                None,
            )
            if correct_opt and not skip_answer_leak:
                label = str(correct_opt.get("label") or "").strip().lower()
                if label and len(label) >= 2 and label in presentation_lower:
                    return "answer_leak_in_prompt"
        else:
            expected = str(item.get("expected_answer") or "").strip()
            if not expected:
                return "short_text_missing_expected"
            if not skip_answer_leak:
                for alt in expected.split("|"):
                    token = alt.strip().lower()
                    if len(token) >= 3 and token in presentation_lower:
                        return "answer_leak_in_prompt"

        banned = (
            "cómo se dice",
            "como se dice",
            "¿qué palabra es",
            "que palabra es",
        )
        if any(phrase in presentation_lower for phrase in banned):
            for alt in str(item.get("expected_answer") or "").split("|"):
                token = alt.strip().lower()
                if token and token in presentation_lower:
                    return "circular_translation_prompt"
            if item_type == "mcq":
                correct_id = DialogueService._resolved_correct_option_id(item, options)
                correct_opt = next(
                    (
                        opt
                        for opt in options
                        if str(opt.get("id")) == str(correct_id or "")
                    ),
                    None,
                )
                if correct_opt:
                    label = str(correct_opt.get("label") or "").strip().lower()
                    if label and label in presentation_lower:
                        return "circular_translation_prompt"

        if subject_id == "reading" and item_type == "mcq":
            if any(marker in presentation_lower for marker in DialogueService._READING_EVENT_QUESTION_MARKERS):
                correct_id = DialogueService._resolved_correct_option_id(item, options)
                correct_opt = next(
                    (
                        opt
                        for opt in options
                        if str(opt.get("id")) == str(correct_id or "")
                    ),
                    None,
                )
                if correct_opt:
                    label = str(correct_opt.get("label") or "").strip()
                    if label and not DialogueService._spanish_label_has_action_verb(label):
                        return "reading_event_answer_mismatch"

        if subject_id == "language" and item_type == "mcq":
            for opt in options:
                label = str(opt.get("label") or "")
                if DialogueService._UNNATURAL_MATERIAL_LABEL.search(label):
                    return "language_ungrammatical_option"

        if item_type == "mcq" and DialogueService._is_purpose_question(presentation):
            correct_id = DialogueService._resolved_correct_option_id(item, options)
            correct_opt = next(
                (opt for opt in options if str(opt.get("id")) == str(correct_id or "")),
                None,
            )
            if correct_opt:
                label = str(correct_opt.get("label") or "").strip()
                if label:
                    if DialogueService._option_echoes_question_subject(
                        presentation, label
                    ):
                        return "purpose_question_echo_option"
                    if not DialogueService._option_has_purpose_semantics(label):
                        return "purpose_question_weak_option"

        return None

    @staticmethod
    def _path_compose_error(
        model: str | None = None,
        *,
        issue: str | None = None,
        path_index: int | None = None,
        subject_id: str | None = None,
        quality_fallback_pack: list[dict[str, Any]] | None = None,
        detail: str | None = None,
    ) -> AiProductError:
        debug: dict[str, Any] = {
            "outcome": "failed",
            "purpose": "path_composer",
        }
        if issue:
            debug["quality_issue"] = issue
        if path_index is not None:
            debug["path_index"] = path_index
        if subject_id:
            debug["subject_id"] = subject_id
        if model:
            debug["model"] = model
        err = product_error(
            "ai_compose_failed",
            model=model,
            compose_debug=debug,
            detail=detail,
        )
        if quality_fallback_pack:
            err.quality_fallback_pack = list(quality_fallback_pack)
        return err

    _EXPLANATION_CORRECT_PATTERNS = (
        re.compile(
            r"(?:opci[oó]n\s+correcta\s+es|respuesta\s+correcta\s+es|correcta\s+es|"
            r"correct\s+(?:option|answer)\s+is)\s+(.+?)(?:[,.;!?]|$)",
            re.IGNORECASE,
        ),
        re.compile(
            r"«([^»]+)»\s+(?:es\s+)?(?:la\s+)?(?:opci[oó]n\s+)?correcta",
            re.IGNORECASE,
        ),
    )

    @staticmethod
    def _match_option_by_answer_hint(
        hint: str, options: list[dict[str, Any]]
    ) -> str | None:
        candidate = str(hint or "").strip().lower()
        if not candidate:
            return None
        for prefix in ("la ", "el ", "los ", "las ", "un ", "una "):
            if candidate.startswith(prefix):
                candidate = candidate[len(prefix) :].strip()
                break
        exact: list[str] = []
        partial: list[str] = []
        for opt in options:
            oid = str(opt.get("id") or "").strip()
            label = str(opt.get("label") or "").strip()
            if not oid or not label:
                continue
            label_lower = label.lower()
            if label_lower == candidate:
                exact.append(oid)
            elif candidate in label_lower or label_lower in candidate:
                partial.append(oid)
        if len(exact) == 1:
            return exact[0]
        if len(partial) == 1:
            return partial[0]
        return None

    @staticmethod
    def _infer_correct_option_id(
        item: dict[str, Any], options: list[dict[str, Any]]
    ) -> str | None:
        expl = str(item.get("explanation") or "").strip()
        if not expl or not options:
            return None
        for pattern in DialogueService._EXPLANATION_CORRECT_PATTERNS:
            match = pattern.search(expl)
            if not match:
                continue
            resolved = DialogueService._match_option_by_answer_hint(
                match.group(1).strip(" «\"'([])"), options
            )
            if resolved:
                return resolved
        return None

    @staticmethod
    def _finalize_path_challenge(challenge: dict[str, Any]) -> dict[str, Any]:
        return DialogueService._finalize_mcq_item(challenge)

    @staticmethod
    def _path_pitch_description(path: dict[str, Any]) -> str:
        blurb = str(path.get("learning_blurb") or "").strip()
        if blurb:
            return blurb
        return str(path.get("intro") or path.get("subject_id") or "").strip()

    @staticmethod
    def _format_path_intro_text(path: dict[str, Any]) -> str:
        title = str(path.get("title") or "").strip()
        scene = str(path.get("path_narrative") or "").strip()
        lesson = str(path.get("lesson_narrative") or "").strip()
        if scene and lesson:
            body = f"{scene}\n\n{lesson}"
        elif lesson:
            body = lesson
        elif scene:
            body = scene
        else:
            intro = str(path.get("intro") or "").strip()
            blurb = str(path.get("learning_blurb") or "").strip()
            parts = [p for p in [intro, blurb] if p]
            body = "\n\n".join(parts) if parts else str(path.get("title") or "Adelante.")
        if title and title.lower() not in body.lower()[: max(len(title) + 8, 40)]:
            return f"{title}\n\n{body}"
        return body

    @staticmethod
    def _path_intro_start_option() -> dict[str, str]:
        return {"id": "start_challenges", "label": "Empezar los retos"}

    @staticmethod
    def _choose_path_card_options(pack: list[dict[str, Any]]) -> list[dict[str, str]]:
        return [
            {
                "id": str(p.get("path_id") or ""),
                "label": str(p.get("title") or p.get("path_id") or "Camino"),
                "description": DialogueService._path_pitch_description(p),
            }
            for p in pack
            if p.get("path_id")
        ]

    async def _path_phase_mentor_consult(
        self,
        child_id: str,
        session_id: str,
        session: Any,
        sequence: int,
        question: str,
        child: dict[str, Any],
        *,
        phase: str,
        last: dict[str, Any],
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        """Consulta libre al mentor en encrucijada o intro; no avanza de fase."""
        parent_id = child.get("parent_id")
        world = self._world(child)
        meta = last.get("meta") if isinstance(last.get("meta"), dict) else {}
        pack = self._read_path_pack(
            str(parent_id) if parent_id else None, child_id, session_id, world
        )
        if phase == "choose_path":
            force_options = DialogueService._choose_path_card_options(pack)
            context_lines = []
            for p in pack:
                title = str(p.get("title") or p.get("path_id") or "Camino")
                blurb = str(p.get("learning_blurb") or "").strip()
                subject = str(p.get("subject_id") or "").strip()
                line = f"- {title}"
                if subject:
                    line += f" (materia: {subject})"
                if blurb:
                    line += f": {blurb}"
                context_lines.append(line)
            context_block = "\n".join(context_lines) or "(sin pack de caminos)"
            guidance = (
                "El explorador pregunta consejo ANTES de elegir un camino. "
                "Compara de forma breve las rutas del pack. "
                "NO elijas por él. NO reveles enunciados, opciones ni respuestas "
                "correctas de los retos. Tras aconsejar, invita a elegir una carta "
                "o a seguir preguntando.\n\n"
                f"Rutas disponibles:\n{context_block}"
            )
            force_meta_phase = "choose_path"
            extra_meta: dict[str, Any] = {
                "path_ids": [str(p.get("path_id")) for p in pack if p.get("path_id")],
            }
            if meta.get("waiting_hints") is not None:
                extra_meta["waiting_hints"] = meta.get("waiting_hints")
        else:
            progress = self._read_path_progress(
                str(parent_id) if parent_id else None, child_id, session_id, world
            )
            path = dict(progress.get("path") or {})
            path_id = str(meta.get("path_id") or path.get("path_id") or "")
            if not path and pack and path_id:
                path = next(
                    (dict(p) for p in pack if str(p.get("path_id")) == path_id),
                    {},
                )
            force_options = [DialogueService._path_intro_start_option()]
            title = str(path.get("title") or path_id or "este camino")
            lesson = str(path.get("lesson_narrative") or "").strip()
            scene = str(path.get("path_narrative") or "").strip()
            blurb = str(path.get("learning_blurb") or "").strip()
            context_block = "\n".join(
                part
                for part in (
                    f"Título: {title}",
                    f"Blurb: {blurb}" if blurb else "",
                    f"Escena: {scene}" if scene else "",
                    f"Lección: {lesson}" if lesson else "",
                )
                if part
            )
            guidance = (
                "El explorador pregunta dudas o más información del TEMA de este "
                "camino, ANTES de los retos MCQ. Aclara solo este tema con la "
                "lección dada. NO reveles enunciados, opciones ni respuestas "
                "correctas de los retos. Tras responder, invita a pulsar "
                "«Empezar los retos» o a seguir preguntando.\n\n"
                f"Contexto del camino:\n{context_block or title}"
            )
            force_meta_phase = "path_intro"
            extra_meta = {"path_id": path_id}

        prompt = question.strip() or "…"
        turn = await self._agent_mentor_turn(
            child,
            session_id,
            str(session["flow_id"]),
            sequence + 1,
            prompt,
            force_meta_phase,
            purpose="mentor_guide",
            force_options=force_options,
            force_input_mode="options_or_text",
            extra_meta=extra_meta,
            extra_prompt=guidance,
        )
        return [], [turn]

    @staticmethod
    def _is_story_comprehension_question(text: str) -> bool:
        lowered = text.lower()
        return any(marker in lowered for marker in DialogueService._STORY_COMPREHENSION_MARKERS)

    @staticmethod
    def _label_supported_in_context(label: str, context: str) -> bool:
        label_tokens = DialogueService._content_tokens(label)
        context_tokens = DialogueService._content_tokens(context)
        if not label_tokens:
            return True
        if len(label_tokens) == 1:
            return label_tokens.issubset(context_tokens)
        overlap = label_tokens & context_tokens
        return len(overlap) >= max(1, len(label_tokens) // 2)

    @staticmethod
    def _path_challenge_reuses_lesson(
        challenge: dict[str, Any], lesson_narrative: str
    ) -> bool:
        wrapper = str(challenge.get("narrative_wrapper") or "").strip()
        prompt = str(challenge.get("prompt_text") or "").strip()
        lesson = str(lesson_narrative or "").strip()
        if not lesson:
            return False
        challenge_blob = f"{wrapper} {prompt}".lower()
        lesson_lower = lesson.lower()
        lesson_tokens = DialogueService._content_tokens(lesson)
        challenge_tokens = DialogueService._content_tokens(challenge_blob)
        if not lesson_tokens or not challenge_tokens:
            return False
        overlap = len(lesson_tokens & challenge_tokens) / len(lesson_tokens)
        return overlap >= 0.35

    @staticmethod
    def _path_challenge_context_issue(
        challenge: dict[str, Any],
        *,
        subject_id: str,
        lesson_narrative: str = "",
    ) -> str | None:
        wrapper = str(challenge.get("narrative_wrapper") or "").strip()
        prompt = str(challenge.get("prompt_text") or "").strip()
        if len(wrapper) < DialogueService._PATH_CHALLENGE_WRAPPER_MIN_CHARS:
            return "path_challenge_missing_wrapper"
        if DialogueService._path_challenge_reuses_lesson(challenge, lesson_narrative):
            return "path_challenge_reuses_lesson_example"
        if str(challenge.get("item_type") or "mcq") != "mcq":
            return None
        options = challenge.get("options") if isinstance(challenge.get("options"), list) else []
        correct_id = DialogueService._resolved_correct_option_id(challenge, options)
        correct_opt = next(
            (opt for opt in options if str(opt.get("id")) == str(correct_id or "")),
            None,
        )
        if not correct_opt:
            return None
        label = str(correct_opt.get("label") or "").strip()
        subject = str(subject_id or "").lower()
        needs_context = subject == "reading" or DialogueService._is_story_comprehension_question(
            prompt
        )
        if needs_context and label:
            if not DialogueService._label_supported_in_context(label, wrapper):
                return "path_challenge_answer_not_in_context"
        return None

    @staticmethod
    def _format_path_recap_text(path: dict[str, Any], *, passed: bool) -> str:
        title = str(path.get("title") or "este camino").strip()
        blurb = str(path.get("learning_blurb") or path.get("intro") or "").strip()
        npc = path.get("npc") if isinstance(path.get("npc"), dict) else {}
        npc_name = str(npc.get("name") or "tu guía").strip()
        challenges = [
            str(ch.get("prompt_text") or "").strip()
            for ch in (path.get("challenges") or [])
            if isinstance(ch, dict) and str(ch.get("prompt_text") or "").strip()
        ]
        parts: list[str] = []
        if passed:
            parts.append(f"¡Camino superado! Has completado «{title}».")
        else:
            parts.append(f"Repaso de «{title}» antes de seguir.")
        if blurb:
            parts.append(f"Recordemos: {blurb}")
        if challenges:
            recap_items = "; ".join(
                f"«{q}»" for q in challenges[:MAX_CHALLENGES_PER_PATH]
            )
            parts.append(f"Has practicado con estos retos: {recap_items}.")
        parts.append(
            f"{npc_name} da por buen trabajo lo aprendido. "
            "Cuando quieras, elegimos otra ruta."
        )
        return "\n\n".join(parts)

    @staticmethod
    def _format_path_challenge_text(
        challenge: dict[str, Any],
        path: dict[str, Any] | None = None,
    ) -> str:
        wrapper = str(challenge.get("narrative_wrapper") or "").strip()
        prompt = str(challenge.get("prompt_text") or "Reto").strip()
        if wrapper and prompt:
            return f"{wrapper}\n\n{prompt}"
        if wrapper:
            return wrapper
        return prompt or "Reto"

    @staticmethod
    def _explanation_mentions_correct_label(
        explanation: str, correct_label: str
    ) -> bool:
        """Exige que la explicación cite el label de la opción marcada como correcta."""
        label = str(correct_label or "").strip().lower()
        text = str(explanation or "").strip().lower()
        if not label:
            return False
        # Números cortos / sí-no: no forzar mención literal.
        if label.isdigit() or len(label) < 2:
            return True
        return label in text

    @staticmethod
    def _path_challenge_quality_item(
        challenge: dict[str, Any], subject_id: str
    ) -> dict[str, Any]:
        wrapper = str(challenge.get("narrative_wrapper") or "").strip()
        prompt = str(challenge.get("prompt_text") or "").strip()
        presentation = f"{wrapper}\n{prompt}".strip() if wrapper else prompt
        return {
            "subject_id": subject_id,
            "item_type": challenge.get("item_type") or "mcq",
            "presentation_text": presentation,
            "prompt_text": prompt,
            "options": challenge.get("options"),
            "correct_option_id": challenge.get("correct_option_id"),
            "expected_answer": challenge.get("expected_answer"),
        }

    @staticmethod
    def _path_challenge_mcq_truth_issue(challenge: dict[str, Any]) -> str | None:
        """Solo fallos estructurales que rompen el scoring (correct_id ausente).

        La verdad pedagógica se guía por instrucciones del agente; no rechazar por
        longitud de explanation ni por «menos de 3 opciones» (2+ basta con placement).
        """
        if str(challenge.get("item_type") or "mcq") != "mcq":
            return None
        options = challenge.get("options") if isinstance(challenge.get("options"), list) else []
        if len(options) < 2:
            return "path_mcq_needs_options"
        correct_id = DialogueService._resolved_correct_option_id(challenge, options)
        if not correct_id or not any(str(opt.get("id")) == correct_id for opt in options):
            return "path_mcq_invalid_correct_option"
        return None

    @staticmethod
    def _path_pack_soft_quality_warnings(
        entry: dict[str, Any], theme: str = "fantasy"
    ) -> list[str]:
        """Avisos pedagógicos: se registran, no bloquean el compose."""
        warnings: list[str] = []
        title = str(entry.get("title") or "").strip()
        if DialogueService._path_title_is_cliche(title):
            warnings.append("path_title_cliche")
        if DialogueService._path_title_matches_zone_catalog(title, theme):
            warnings.append("path_title_catalog_copy")
        narrative = str(entry.get("path_narrative") or "").strip()
        if len(narrative) < DialogueService._PATH_NARRATIVE_MIN_CHARS:
            warnings.append("path_narrative_short")
        lesson = str(entry.get("lesson_narrative") or "").strip()
        if len(lesson) < DialogueService._PATH_LESSON_MIN_CHARS:
            warnings.append("path_lesson_short")
        subject_id = str(entry.get("subject_id") or "")
        for challenge in entry.get("challenges") or []:
            if not isinstance(challenge, dict):
                continue
            finalized = DialogueService._finalize_path_challenge(challenge)
            context_issue = DialogueService._path_challenge_context_issue(
                finalized, subject_id=subject_id, lesson_narrative=lesson
            )
            if context_issue:
                warnings.append(context_issue)
            item_issue = DialogueService._placement_item_quality_issue(
                DialogueService._path_challenge_quality_item(finalized, subject_id)
            )
            if item_issue:
                warnings.append(f"path_challenge_{item_issue}")
            if str(finalized.get("item_type") or "mcq") != "mcq":
                continue
            options = (
                finalized.get("options")
                if isinstance(finalized.get("options"), list)
                else []
            )
            if len(options) < 3:
                warnings.append("path_mcq_fewer_than_three_options")
            correct_id = DialogueService._resolved_correct_option_id(finalized, options)
            correct_opt = next(
                (opt for opt in options if str(opt.get("id")) == str(correct_id or "")),
                None,
            )
            if correct_opt:
                label = str(correct_opt.get("label") or "").strip()
                expl = str(finalized.get("explanation") or "")
                if not DialogueService._explanation_mentions_correct_label(expl, label):
                    warnings.append("path_explanation_may_mismatch_correct")
        return warnings

    @staticmethod
    def _path_title_is_cliche(title: str) -> bool:
        lowered = title.lower().strip()
        return any(cliche in lowered for cliche in DialogueService._PATH_TITLE_CLICHES)

    @staticmethod
    def _path_title_matches_zone_catalog(title: str, theme: str) -> bool:
        lowered = title.lower().strip()
        if not lowered:
            return False
        for zone_id in ZoneCatalog.ZONE_IDS:
            label = ZoneCatalog.label(theme, zone_id).lower()
            if lowered == label:
                return True
            if len(lowered) >= 12 and (label in lowered or lowered in label):
                return True
        return False

    @staticmethod
    def _path_pack_entry_quality_issue(entry: dict[str, Any], theme: str) -> str | None:
        """Solo fallos estructurales: sin título, sin suficientes retos o MCQ no puntuable."""
        del theme  # La pedagogía (cliché, wrapper, leak) va a avisos suaves.
        title = str(entry.get("title") or "").strip()
        if not title:
            return "path_missing_title"
        challenges = entry.get("challenges")
        if not isinstance(challenges, list) or len(challenges) < DialogueService._PATH_MIN_CHALLENGES:
            return "path_challenge_count"
        for challenge in challenges:
            if not isinstance(challenge, dict):
                return "path_challenge_invalid"
            finalized = DialogueService._finalize_path_challenge(challenge)
            truth_issue = DialogueService._path_challenge_mcq_truth_issue(finalized)
            if truth_issue:
                return truth_issue
        return None

    @staticmethod
    def _path_pack_palette_mention_count(
        pack: list[dict[str, Any]], palette_tokens: list[str]
    ) -> int:
        if not palette_tokens:
            return 0
        hits = 0
        for entry in pack:
            blob = " ".join(
                [
                    str(entry.get("title") or ""),
                    str(entry.get("intro") or ""),
                    str(entry.get("learning_blurb") or ""),
                    str(entry.get("path_narrative") or ""),
                    str(entry.get("lesson_narrative") or ""),
                    *(
                        str(ch.get("prompt_text") or "")
                        for ch in (entry.get("challenges") or [])
                        if isinstance(ch, dict)
                    ),
                ]
            ).lower()
            if any(token in blob for token in palette_tokens):
                hits += 1
        return hits

    @staticmethod
    def _path_pack_quality_issue(
        pack: list[dict[str, Any]],
        theme: str,
        *,
        palette_tokens: list[str] | None = None,
    ) -> str | None:
        del palette_tokens
        for entry in pack:
            issue = DialogueService._path_pack_entry_quality_issue(entry, theme)
            if issue:
                return issue
        return None

    @staticmethod
    def _path_pack_soft_quality_warnings_pack(
        pack: list[dict[str, Any]],
        theme: str,
        *,
        palette_tokens: list[str] | None = None,
    ) -> list[str]:
        warnings: list[str] = []
        titles: list[str] = []
        for entry in pack:
            warnings.extend(
                DialogueService._path_pack_soft_quality_warnings(entry, theme)
            )
            titles.append(str(entry.get("title") or "").lower().strip())
        if len(titles) != len(set(titles)):
            warnings.append("path_title_duplicate")
        tokens = palette_tokens or []
        if (
            tokens
            and DialogueService._path_pack_palette_mention_count(pack, tokens)
            > DialogueService._PALETTE_MAX_MENTIONS_PER_BATCH
        ):
            warnings.append("palette_overuse")
        return warnings

    def _placement_compose_prompt(
        self,
        child: dict[str, Any],
        subject_slots: list[str],
        age_band: str,
        *,
        batch_index: int = 0,
    ) -> str:
        """Prompt de un lote: N ítems (típicamente ≤4) con contexto del viajero."""
        count = len(subject_slots)
        parts = [
            f"Genera exactamente {count} ítems de examen de ingreso (PlacementQueueEnvelope).",
            (
                "Un ítem por posición en esta lista de materias "
                f"(respeta orden y subject_id): {subject_slots}."
            ),
            *PathComposerContextService.placement_tutor_sections(child, subject_slots),
        ]
        if batch_index > 0:
            parts.append(
                f"Este es el lote {batch_index + 1} de un examen más largo; "
                "mantén coherencia narrativa pero ítems independientes."
            )
        parts.append(
            f"Mundo activo: {child.get('world_theme') or child.get('active_world_theme')}."
        )
        theme = str(
            child.get("world_theme") or child.get("active_world_theme") or "fantasy"
        )
        parts.extend(DialogueService._world_narrative_rules(theme))
        parts.append(
            f"Edad cronológica: {child.get('age_years')}. Banda pedagógica: {age_band}."
        )
        display_name = child.get("display_name")
        if display_name:
            parts.append(f"Nombre del explorador: {display_name}.")
        gender = resolve_explorer_gender(child.get("explorer_gender"))
        if gender in {"male", "female"}:
            parts.append(
                gender_grammar_prompt_block(gender, display_name)
            )
        parent_id = child.get("parent_id")
        if parent_id:
            try:
                frontmatter, _body = self.ledger.read_traveler_profile(
                    str(parent_id), str(child["id"])
                )
            except Exception:
                frontmatter = None
            if frontmatter:
                species = frontmatter.get("species")
                palette = frontmatter.get("palette")
                vibe = frontmatter.get("vibe")
                if species:
                    parts.append(
                        "Personaje del explorador: "
                        f"especie {species}, personalidad {vibe or '—'}."
                    )
                    if palette and palette_is_meaningful(palette):
                        parts.append(
                            f"Paleta visual de referencia: {palette}. "
                            "Úsala como acento ocasional del personaje: como máximo "
                            "1 ítem de este lote puede mencionar colores de la paleta; "
                            "el resto debe usar escenarios neutros del mundo (sin repetir "
                            "plata, azul, blanco u otros tonos de la paleta en cada pregunta)."
                        )
        allowed_types = SubjectCatalog.allowed_item_types(age_band)
        parts.append(
            f"Tipos de ítem permitidos para esta edad: {', '.join(allowed_types)}. "
            "En este examen de ingreso usa SOLO item_type mcq (no short_text ni true_false)."
        )
        parts.append(PLACEMENT_PRIOR_KNOWLEDGE_RULE)
        parts.append(MEANING_QUESTION_NO_ECHO_RULE)
        parts.append(ANSWER_LEAK_IN_STIMULUS_RULE)
        parts.append(
            "Aplica los skills placement-exam y subject-pedagogy (checklist MCQ, "
            "alineación pregunta↔opciones por tipo). "
            "Cada ítem: subject_id, item_key único, prompt_text, presentation_text, "
            "3–4 opciones mcq (ids a/b/c), correct_option_id obligatorio (id, no texto), "
                "success_feedback y explanation si aplica. "
                "Si el alumno puede fallar, explanation debe decir por qué la opción "
                "incorrecta no encaja y orientar hacia la correcta (no solo definir el "
                "concepto sin mencionar el error). "
            "Solo item_type mcq en este examen. Castellano de España. Sin franquicias."
        )
        return "\n".join(parts)

    @staticmethod
    def _score_placement_item(item: dict[str, Any], reply: dict[str, Any]) -> float:
        options = DialogueService._normalize_options_list(item.get("options")) or []
        correct_id = DialogueService._resolved_correct_option_id(item, options)
        if correct_id and reply.get("option_id"):
            chosen = str(reply.get("option_id"))
            if chosen == correct_id:
                return 1.0
            chosen_opt = next(
                (opt for opt in options if str(opt.get("id")) == chosen),
                None,
            )
            correct_opt = next(
                (opt for opt in options if str(opt.get("id")) == correct_id),
                None,
            )
            if chosen_opt and correct_opt:
                chosen_label = str(chosen_opt.get("label") or "").strip().lower()
                correct_label = str(correct_opt.get("label") or "").strip().lower()
                if chosen_label and chosen_label == correct_label:
                    return 1.0
            return 0.0
        expected = str(item.get("expected_answer") or "").strip().lower()
        answer = str(reply.get("text") or reply.get("option_id") or "").strip().lower()
        if expected and answer:
            alts = [part.strip() for part in expected.split("|") if part.strip()]
            return 1.0 if answer in alts else 0.0
        if correct_id:
            return 0.0
        return 0.5

    @staticmethod
    def _placement_feedback_text(
        item: dict[str, Any],
        score: float,
        reply: dict[str, Any] | None = None,
    ) -> str:
        if score >= 1.0:
            custom = str(item.get("success_feedback") or "").strip()
            return custom or "¡Correcto! Sigue así."
        return DialogueService._incorrect_choice_feedback(item, reply)

    @staticmethod
    def _incorrect_choice_feedback(
        item: dict[str, Any], reply: dict[str, Any] | None = None
    ) -> str:
        options = DialogueService._normalize_options_list(item.get("options")) or []
        correct_id = DialogueService._resolved_correct_option_id(item, options)
        chosen_id = str((reply or {}).get("option_id") or "").strip()
        if not chosen_id:
            chosen_id = str((reply or {}).get("text") or "").strip()
        correct_opt = (
            next((opt for opt in options if str(opt.get("id")) == correct_id), None)
            if correct_id
            else None
        )
        chosen_opt = (
            next((opt for opt in options if str(opt.get("id")) == chosen_id), None)
            if chosen_id
            else None
        )
        correct_label = str((correct_opt or {}).get("label") or correct_id or "").strip()
        chosen_label = str(chosen_opt.get("label") or chosen_id or "").strip()
        expl = str(item.get("explanation") or "").strip()

        if chosen_label and correct_label and chosen_label.lower() != correct_label.lower():
            if expl and DialogueService._explanation_addresses_mistake(
                expl, chosen_label, correct_label
            ):
                return expl
            if expl:
                return f"«{chosen_label}» no es correcto. {expl}"
            return (
                f"«{chosen_label}» no es correcto. "
                f"La respuesta correcta es «{correct_label}»."
            )
        if expl:
            return expl
        if correct_label:
            return f"La respuesta correcta es «{correct_label}»."
        return "Casi. Vamos con la siguiente."

    @staticmethod
    def _explanation_addresses_mistake(
        explanation: str, chosen_label: str, correct_label: str
    ) -> bool:
        lowered = explanation.lower()
        chosen = chosen_label.lower()
        correct = correct_label.lower()
        if chosen and chosen in lowered:
            return True
        if correct and correct in lowered:
            return "no " in lowered or "incorrect" in lowered or "no es" in lowered
        return False

    async def _placement_item_turn(
        self,
        child_id: str,
        session: Any,
        session_id: str,
        sequence: int,
        item: dict[str, Any],
        index: int,
        total: int,
        child: dict[str, Any],
        world: str | None,
    ) -> dict[str, Any]:
        mentor_id = str(session.get("mentor_id") or "guardian")
        turn_payload = PlacementService(self.session).item_to_turn(
            session_id,
            child_id,
            str(session["flow_id"]),
            sequence,
            mentor_id,
            str(world or "fantasy"),
            item,
            index,
            total,
            child,
        )
        return await self._insert(
            {
                **{
                    k: turn_payload[k]
                    for k in (
                        "session_id",
                        "child_id",
                        "flow_id",
                        "sequence",
                        "role",
                        "text",
                        "input_mode",
                        "options",
                        "meta",
                    )
                },
                "explorer_reply": None,
                "model_used": turn_payload.get("model_used"),
            }
        )

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
        child = await self._child_by_id(child_id)
        parent_id = child.get("parent_id")
        world = self._world(child)
        state = self._read_placement_state(
            str(parent_id) if parent_id else None, child_id, session_id, world
        )
        if not state or not state.get("queue"):
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
        queue = state["queue"]
        index = int(state.get("index") or 0)
        item = queue[index] if index < len(queue) else None
        score = self._score_placement_item(item or {}, reply)
        if item and parent_id:
            try:
                self._append_ledger_event(
                    str(parent_id),
                    child_id,
                    session_id,
                    kind="placement_answer",
                    payload={
                        "index": index,
                        "item_key": item.get("item_key"),
                        "subject_id": item.get("subject_id"),
                        "score": score,
                        "response": reply,
                    },
                    world_theme=world,
                )
            except Exception:
                pass
        feedback_turn = await self._mentor_turn(
            session_id,
            child_id,
            session["flow_id"],
            sequence + 1,
            self._placement_feedback_text(item or {}, score, reply),
            "continue",
            [{"id": "continue", "label": "Continuar"}],
            {
                "phase": "placement_feedback",
                "subject_id": (item or {}).get("subject_id"),
                "item_key": (item or {}).get("item_key"),
                "score": score,
                "index": index,
                "next_index": index + 1,
                "total": len(queue),
            },
        )
        next_index = index + 1
        if next_index >= len(queue):
            await self._finish_placement(child, session_id, queue)
            effects, path_turns = await self._start_path_choice(
                child, session_id, session, sequence + 1
            )
            return effects, [feedback_turn, *path_turns]

        if parent_id:
            try:
                self._append_ledger_event(
                    str(parent_id),
                    child_id,
                    session_id,
                    kind="placement_result",
                    payload={"current_index": next_index, "status": "in_progress"},
                    world_theme=world,
                )
            except Exception:
                pass
        next_turn = await self._placement_item_turn(
            child_id,
            session,
            session_id,
            sequence + 2,
            queue[next_index],
            next_index,
            len(queue),
            child,
            world,
        )
        return [], [feedback_turn, next_turn]

    async def _placement_feedback_continue(
        self,
        child_id: str,
        session_id: str,
        session: Any,
        sequence: int,
        last: dict[str, Any],
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        """Fallback si el cliente queda en placement_feedback sin el siguiente ítem."""
        child = await self._child_by_id(child_id)
        parent_id = child.get("parent_id")
        world = self._world(child)
        state = self._read_placement_state(
            str(parent_id) if parent_id else None, child_id, session_id, world
        )
        if not state or not state.get("queue"):
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
        meta = last.get("meta") if isinstance(last.get("meta"), dict) else {}
        next_index = int(meta.get("next_index") or state.get("index") or 0)
        queue = state["queue"]
        if next_index >= len(queue):
            await self._finish_placement(child, session_id, queue)
            return await self._start_path_choice(
                child, session_id, session, sequence
            )
        turn = await self._placement_item_turn(
            child_id,
            session,
            session_id,
            sequence + 1,
            queue[next_index],
            next_index,
            len(queue),
            child,
            world,
        )
        return [], [turn]

    def _read_placement_state(
        self,
        parent_id: str | None,
        child_id: str,
        session_id: str,
        world: str | None,
    ) -> dict[str, Any] | None:
        if not parent_id:
            return None
        rows = self._read_ledger_events(
            str(parent_id), child_id, session_id, world=world
        )
        queue: list[dict[str, Any]] | None = None
        index = 0
        for row in rows:
            kind = row.get("kind")
            payload = row.get("payload") or {}
            if kind == "placement_queue":
                queue = payload.get("queue") or []
                index = 0
            elif kind == "placement_answer":
                index = int(payload.get("index") or index) + 1
            elif kind == "placement_result" and "current_index" in payload:
                index = int(payload.get("current_index") or index)
        if queue is None:
            return None
        return {"queue": queue, "index": index}

    async def _finish_placement(
        self, child: dict[str, Any], session_id: str, queue: list[dict[str, Any]]
    ) -> None:
        child_id = str(child["id"])
        world = self._world(child) or "fantasy"
        settings = child.get("settings") if isinstance(child.get("settings"), dict) else {}
        learning = settings.get("learning") if isinstance(settings.get("learning"), dict) else {}
        active = SubjectCatalog.resolve_active_subjects(child, learning)
        subjects = set(active) | {str(i.get("subject_id") or "math") for i in queue}
        for subject in subjects:
            await self.session.execute(
                text(
                    "insert into user_subject_levels("
                    "child_id,world_theme,subject_id,level_id,accuracy_rolling,source,updated_at) "
                    "values(:cid,:theme,:sid,'L1',:seed,'placement',now()) "
                    "on conflict (child_id, world_theme, subject_id) do update set "
                    "level_id='L1', accuracy_rolling=excluded.accuracy_rolling, "
                    "source='placement', updated_at=now()"
                ),
                {
                    "cid": child_id,
                    "theme": world,
                    "sid": subject,
                    "seed": SEED_ROLLING,
                },
            )
        rank_track = "sci-fi" if world == "sci-fi" else "fantasy"
        from app.services.crew_progress import CrewProgressService

        rank_id = CrewProgressService.RANKS[rank_track][0][0]
        await self.session.execute(
            text(
                "update children set placement_status='completed',onboarding_step='complete',"
                "general_level='L1',rank_id=:rid,rank_track=:track,updated_at=now() where id=:id"
            ),
            {"id": child_id, "rid": rank_id, "track": rank_track},
        )
        await self.session.execute(
            text(
                """
                insert into child_world_progress(
                  child_id, world_theme, general_level, placement_status, onboarding_step, updated_at
                ) values (:id, :theme, 'L1', 'completed', 'complete', now())
                on conflict (child_id, world_theme) do update set
                  general_level='L1',
                  placement_status='completed',
                  onboarding_step='complete',
                  updated_at=now()
                """
            ),
            {"id": child_id, "theme": world},
        )
        parent_id = child.get("parent_id")
        if parent_id:
            try:
                self._append_ledger_event(
                    str(parent_id),
                    child_id,
                    session_id,
                    kind="placement_result",
                    payload={
                        "status": "completed",
                        "general_level": "L1",
                        "subjects": sorted(subjects),
                    },
                    world_theme=world,
                )
            except Exception:
                pass

    async def _start_path_choice(
        self,
        child: dict[str, Any],
        session_id: str,
        session: Any,
        sequence: int,
        *,
        refresh_after_complete: bool = False,
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        child_id = str(child["id"])
        world = self._world(child) or "fantasy"
        waiting_hints = await pick_waiting_batch(
            self.session,
            world_theme=world,
            age_band=child.get("age_band") or child.get("effective_age_band"),
            phase="path_compose",
        )
        pack_meta: dict[str, Any] = {"compose_mode": "full_parallel"}
        if refresh_after_complete:
            parent_id = child.get("parent_id")
            events = self._ledger_events_for_session(
                str(parent_id) if parent_id else None,
                child_id,
                session_id,
                world,
            )
            progress = self._read_path_progress(
                str(parent_id) if parent_id else None, child_id, session_id, world
            )
            completed_path_id = (
                DialogueService._latest_completed_path_id(events)
                or str((progress.get("path") or {}).get("path_id") or "")
            )
            pack, pack_meta = await self._refresh_path_pack_after_complete(
                child, session_id, completed_path_id
            )
            completed_ids = DialogueService._completed_path_ids_from_events(events)
            if completed_path_id:
                completed_ids.add(completed_path_id)
            pack = DialogueService._pack_entries_not_completed(pack, completed_ids)
            if len(pack) < 3:
                compose_log.warning(
                    "path_pack_refresh_short_after_filter",
                    pack_len=len(pack),
                    completed_ids=sorted(completed_ids),
                )
            intro_text = (
                "¡Camino superado! Siguen dos rutas que dejaste pendientes "
                "y una nueva pensada para lo que más te conviene practicar ahora. "
                "Si quieres, pregúntame antes de elegir."
            )
        else:
            pack = await self._compose_path_pack(child, session_id)
            intro_text = (
                "¡Prueba superada! Elige el siguiente camino. "
                "Hay tres rutas pensadas para lo que más te conviene practicar. "
                "Si quieres, pregúntame antes de elegir."
            )
        parent_id = child.get("parent_id")
        if parent_id:
            try:
                self._append_ledger_event(
                    str(parent_id),
                    child_id,
                    session_id,
                    kind="path_pack",
                    purpose="path_composer",
                    payload={
                        "pack": pack,
                        "waiting_hints": waiting_hints,
                        **{
                            key: pack_meta[key]
                            for key in (
                                "compose_mode",
                                "reused_path_ids",
                                "composed_slots",
                                "fallback_slots",
                                "completed_path_id",
                                "new_subject_id",
                            )
                            if key in pack_meta
                        },
                    },
                    world_theme=world,
                )
            except Exception:
                pass
        options = [
            {
                "id": p["path_id"],
                "label": p["title"],
                "description": DialogueService._path_pitch_description(p),
            }
            for p in pack
        ]
        turn = await self._mentor_turn(
            session_id,
            child_id,
            session["flow_id"],
            sequence + 1,
            intro_text,
            "options_or_text",
            options,
            {
                "phase": "choose_path",
                "waiting_hints": waiting_hints,
                "path_ids": [p["path_id"] for p in pack],
            },
        )
        effects: list[dict[str, Any]] = []
        if not refresh_after_complete:
            effects = [
                {"type": "advance_onboarding", "to": "complete"},
                {"type": "placement_completed", "value": True},
            ]
        else:
            effects = [{"type": "path_pack_refreshed", "value": True}]
        return effects, [turn]

    async def _path_composer_subject_rows(
        self, child: dict[str, Any]
    ) -> list[dict[str, Any]]:
        theme = self._world(child) or "fantasy"
        return list(
            (
                await self.session.execute(
                    text(
                        "select subject_id, level_id, accuracy_rolling, "
                        "difficulty_modifier "
                        "from user_subject_levels "
                        "where child_id = :id and world_theme = :theme"
                    ),
                    {"id": str(child["id"]), "theme": theme},
                )
            )
            .mappings()
            .all()
        )

    async def _path_composer_context(self, child: dict[str, Any]) -> dict[str, Any]:
        rows = await self._path_composer_subject_rows(child)
        return PathComposerContextService.build_context(child, subject_rows=rows)

    async def _weak_subjects_for_path_pack(self, child: dict[str, Any]) -> list[str]:
        """Materias prioritarias: niveles PG + señales del tutor."""
        context = await self._path_composer_context(child)
        return PathComposerContextService.weak_subject_ids(context)

    async def _compose_path_pack(
        self, child: dict[str, Any], session_id: str
    ) -> list[dict[str, Any]]:
        subjects = PlacementService.active_subjects_for_child(child)[:5]
        composer_context = await self._path_composer_context(child)
        weak = PathComposerContextService.weak_subject_ids(composer_context)
        theme = self._world(child) or "fantasy"
        palette_tokens = self._traveler_palette_tokens(child)
        retries = self.settings.ai_compose_batch_retries
        parent_id = child.get("parent_id")
        if parent_id:
            try:
                self._append_ledger_event(
                    str(parent_id),
                    str(child["id"]),
                    session_id,
                    kind="path_compose_context",
                    payload={"tutor_context": composer_context},
                    world_theme=theme,
                )
            except Exception:
                pass
        return await self._compose_path_pack_parallel(
            child,
            session_id,
            weak,
            composer_context,
            subjects,
            theme,
            palette_tokens,
            retries,
        )

    @staticmethod
    def _path_slots_for_compose(
        composer_context: dict[str, Any], weak: list[str]
    ) -> list[dict[str, Any]]:
        slots = composer_context.get("path_slots")
        if isinstance(slots, list) and len(slots) >= 3:
            return [dict(slot) for slot in slots[:3]]
        return [
            {
                "slot_index": idx,
                "subject_id": weak[idx % len(weak)] if weak else "math",
            }
            for idx in range(3)
        ]

    @staticmethod
    def _pick_refresh_subject(
        reused_paths: list[dict[str, Any]], composer_context: dict[str, Any]
    ) -> str:
        reused_subjects = {
            str(path.get("subject_id") or "").strip()
            for path in reused_paths
            if str(path.get("subject_id") or "").strip()
        }
        ranked = composer_context.get("weak_subjects_ranked")
        candidates: list[dict[str, Any]] = []
        if isinstance(ranked, list):
            candidates = [
                row
                for row in ranked
                if str(row.get("subject_id") or "").strip()
                and str(row.get("subject_id")) not in reused_subjects
            ]
        if not candidates:
            compose_log.warning(
                "path_reuse_subject_collision",
                reused_subjects=sorted(reused_subjects),
            )
            candidates = list(ranked) if isinstance(ranked, list) else []
        if candidates:
            return str(candidates[0]["subject_id"])
        weak = PathComposerContextService.weak_subject_ids(composer_context)
        return weak[0] if weak else "math"

    @staticmethod
    def _pack_entries_not_completed(
        pack: list[dict[str, Any]], completed_ids: set[str]
    ) -> list[dict[str, Any]]:
        """Rutas del pack que el viajero aún no ha superado."""
        if not completed_ids:
            return [dict(path) for path in pack]
        return [
            dict(path)
            for path in pack
            if str(path.get("path_id") or "").strip()
            and str(path.get("path_id") or "") not in completed_ids
        ]

    async def _refresh_path_pack_after_complete(
        self,
        child: dict[str, Any],
        session_id: str,
        completed_path_id: str,
    ) -> tuple[list[dict[str, Any]], dict[str, Any]]:
        subjects = PlacementService.active_subjects_for_child(child)[:5]
        composer_context = await self._path_composer_context(child)
        theme = self._world(child) or "fantasy"
        palette_tokens = self._traveler_palette_tokens(child)
        retries = self.settings.ai_compose_batch_retries
        parent_id = child.get("parent_id")
        events = self._ledger_events_for_session(
            str(parent_id) if parent_id else None,
            str(child["id"]),
            session_id,
            theme,
        )
        completed_ids = DialogueService._completed_path_ids_from_events(events)
        if completed_path_id:
            completed_ids.add(completed_path_id)
        pack = self._read_path_pack(
            str(parent_id) if parent_id else None,
            str(child["id"]),
            session_id,
            theme,
        )
        reused = DialogueService._pack_entries_not_completed(pack, completed_ids)
        need_compose = max(0, 3 - len(reused))
        if need_compose >= 3 or not pack:
            compose_log.warning(
                "path_pack_refresh_fallback_full",
                completed_path_id=completed_path_id or None,
                reused_count=len(reused),
                completed_ids=sorted(completed_ids),
            )
            full_pack = await self._compose_path_pack_parallel(
                child,
                session_id,
                PathComposerContextService.weak_subject_ids(composer_context),
                composer_context,
                subjects,
                theme,
                palette_tokens,
                retries,
            )
            return full_pack, {
                "compose_mode": "full_parallel",
                "reused_path_ids": [],
                "composed_slots": [],
                "fallback_slots": [],
            }

        composed_slots: list[dict[str, Any]] = []
        fallback_slots: list[int] = []
        refreshed = list(reused)
        for offset in range(need_compose):
            new_slot_index = len(refreshed)
            new_subject = DialogueService._pick_refresh_subject(
                refreshed, composer_context
            )
            new_path = await self._compose_path_slot_with_retry(
                child,
                session_id,
                new_slot_index,
                new_subject,
                composer_context,
                subjects,
                theme,
                palette_tokens,
                retries,
            )
            refreshed.append(new_path)
            composed_slots.append(
                {
                    "slot_index": new_slot_index,
                    "subject_id": new_subject,
                    "model": new_path.get("model_used"),
                }
            )
            if not new_path.get("model_used"):
                fallback_slots.append(new_slot_index)
        meta = {
            "compose_mode": "refresh_after_complete",
            "reused_path_ids": [str(path.get("path_id") or "") for path in reused],
            "composed_slots": composed_slots,
            "fallback_slots": fallback_slots,
            "completed_path_id": completed_path_id,
            "new_subject_id": composed_slots[-1]["subject_id"] if composed_slots else None,
        }
        compose_log.info(
            "path_pack_refresh",
            compose_mode=meta["compose_mode"],
            reused_path_ids=meta["reused_path_ids"],
            composed_slots=composed_slots,
            fallback_slots=fallback_slots,
        )
        return refreshed[:3], meta

    async def _compose_path_pack_parallel(
        self,
        child: dict[str, Any],
        session_id: str,
        weak: list[str],
        composer_context: dict[str, Any],
        subjects: list[str],
        theme: str,
        palette_tokens: list[str],
        retries: int,
    ) -> list[dict[str, Any]]:
        slots = DialogueService._path_slots_for_compose(composer_context, weak)
        concurrency = min(3, max(1, int(self.settings.ai_compose_batch_max_slots)))
        semaphore = asyncio.Semaphore(concurrency)

        async def compose_slot(slot: dict[str, Any]) -> dict[str, Any]:
            slot_index = int(slot.get("slot_index") or 0)
            subject_id = str(slot.get("subject_id") or weak[slot_index % len(weak)])
            async with semaphore:
                return await self._compose_path_slot_with_retry(
                    child,
                    session_id,
                    slot_index,
                    subject_id,
                    composer_context,
                    subjects,
                    theme,
                    palette_tokens,
                    retries,
                )

        pack = list(await asyncio.gather(*(compose_slot(slot) for slot in slots)))
        del theme, palette_tokens
        compose_log.info("path_compose_parallel_ok", paths=len(pack))
        return pack

    async def _compose_path_slot_with_retry(
        self,
        child: dict[str, Any],
        session_id: str,
        slot_index: int,
        subject_id: str,
        composer_context: dict[str, Any],
        subjects: list[str],
        theme: str,
        palette_tokens: list[str],
        retries: int,
    ) -> dict[str, Any]:
        last_issue: str | None = None
        for attempt in range(retries + 1):
            try:
                entry = await self._compose_path_slot(
                    child,
                    session_id,
                    slot_index,
                    subject_id,
                    composer_context,
                    subjects,
                    theme,
                    palette_tokens,
                )
                compose_log.info(
                    "path_compose_slot_ok",
                    slot_index=slot_index,
                    subject_id=subject_id,
                    model=entry.get("model_used"),
                    attempt=attempt + 1,
                )
                return entry
            except AiProductError as exc:
                debug = exc.compose_debug or {}
                last_issue = str(debug.get("quality_issue") or exc.error_code)
                compose_log.warning(
                    "path_compose_slot_retry",
                    slot_index=slot_index,
                    subject_id=subject_id,
                    attempt=attempt + 1,
                    issue=last_issue,
                    model=debug.get("model") or exc.model,
                )
            except Exception as exc:
                last_issue = f"{type(exc).__name__}"
                compose_log.warning(
                    "path_compose_slot_exception",
                    slot_index=slot_index,
                    subject_id=subject_id,
                    attempt=attempt + 1,
                    error=f"{type(exc).__name__}: {exc}"[:300],
                )
        compose_log.warning(
            "path_compose_slot_exhausted",
            slot_index=slot_index,
            subject_id=subject_id,
            issue=last_issue,
        )
        raise self._path_compose_error(
            issue=last_issue or "path_compose_exhausted",
            path_index=slot_index,
            subject_id=subject_id,
            detail=path_compose_exhausted_mentor_text(child),
        )

    async def _compose_path_slot(
        self,
        child: dict[str, Any],
        session_id: str,
        slot_index: int,
        subject_id: str,
        composer_context: dict[str, Any],
        subjects: list[str],
        theme: str,
        palette_tokens: list[str],
    ) -> dict[str, Any]:
        del theme, palette_tokens
        deps = self._deps(child, session_id, "path_composer")
        prompt = self._path_compose_prompt(
            child,
            [subject_id],
            composer_context,
            path_count=1,
            slot_subject=subject_id,
        )
        expected_count = DialogueService._expected_challenges_per_path(child)
        bundle, model = await run_purpose(
            "path_composer",
            prompt,
            deps,
            settings=self.settings,
            gateway=self.gateway,
            expect_type=PathPackEnvelope,
        )
        if not isinstance(bundle, PathPackEnvelope) or len(bundle.paths) < 1:
            compose_log.warning(
                "path_compose_pack_count_mismatch",
                expected=1,
                got=len(bundle.paths) if isinstance(bundle, PathPackEnvelope) else None,
                model=model,
                slot_index=slot_index,
                subject_id=subject_id,
            )
            raise self._path_compose_error(
                model=model,
                issue="pack_count_mismatch",
                path_index=slot_index,
                subject_id=subject_id,
            )

        detail = bundle.paths[0]
        parsed, parse_issue = self._path_detail_to_pack_entry(
            detail,
            subject_id,
            subjects,
            slot_index,
            model,
            expected_count=expected_count,
        )
        if not parsed:
            compose_log.warning(
                "path_compose_path_parse_failed",
                path_index=slot_index,
                subject_id=subject_id,
                issue=parse_issue or "path_parse_failed",
                model=model,
                expected_count=expected_count,
                challenges_received=len(detail.challenges),
            )
            raise self._path_compose_error(
                model=model,
                issue=parse_issue or "path_parse_failed",
                path_index=slot_index,
                subject_id=subject_id,
            )
        return parsed

    @staticmethod
    def _expected_challenges_per_path(child: dict[str, Any]) -> int:
        settings = child.get("settings") if isinstance(child.get("settings"), dict) else {}
        learning = settings.get("learning") if isinstance(settings, dict) else {}
        raw = learning.get("challenges_per_path") if isinstance(learning, dict) else None
        years = child.get("age_years")
        try:
            age_years = int(years) if years is not None else None
        except (TypeError, ValueError):
            age_years = None
        return effective_challenges_per_path(
            raw,
            str(child.get("age_band") or "") or None,
            age_years,
        )

    def _path_compose_prompt(
        self,
        child: dict[str, Any],
        subject_slots: list[str],
        composer_context: dict[str, Any],
        *,
        path_count: int,
        slot_subject: str | None = None,
    ) -> str:
        theme = str(child.get("world_theme") or child.get("active_world_theme") or "fantasy")
        subjects_line = ", ".join(subject_slots)
        catalog_avoid = ", ".join(
            ZoneCatalog.label(theme, zone_id) for zone_id in ZoneCatalog.ZONE_IDS
        )
        prompt_context = composer_context
        if slot_subject:
            slots = composer_context.get("path_slots")
            filtered = [
                dict(slot)
                for slot in (slots if isinstance(slots, list) else [])
                if str(slot.get("subject_id") or "") == slot_subject
            ]
            if not filtered:
                filtered = [{"slot_index": 0, "subject_id": slot_subject}]
            prompt_context = dict(composer_context)
            prompt_context["path_slots"] = filtered
        tutor_sections = PathComposerContextService.prompt_sections(prompt_context)
        challenge_n = DialogueService._expected_challenges_per_path(child)
        parts = [
            f"Genera PathPackEnvelope con exactamente {path_count} camino(s) "
            f"(paths.length = {path_count}).",
            f"Materias prioritarias (orden): {subjects_line}.",
            *tutor_sections,
            (
                "Las notas del tutor son información adicional neutral "
                "(fortalezas, contexto o ritmo); úsalas para calibrar dificultad y "
                "contenido sin asumir que siempre indican debilidad."
            ),
            f"Mundo: {theme}. Edad/banda: {child.get('age_years')}/{child.get('age_band')}.",
            *DialogueService._world_narrative_rules(theme),
            (
                "Orden de escritura POR CAMINO (obligatorio): "
                "(1) inventa título + pitch + NPC; "
                "(2) escribe lesson_narrative con la teoría y 2–3 ejemplos concretos; "
                f"(3) escribe EXACTAMENTE {challenge_n} retos "
                "(ni uno más ni uno menos) con narrative_wrapper "
                "(3-5 frases cada uno) "
                "usando ejemplos NUEVOS distintos a la lección; "
                "(4) para cada reto, prompt_text + 3 opciones (ids a/b/c) y LUEGO "
                "correct_option_id obligatorio (id a/b/c de la opción verdadera, "
                "nunca null ni el texto visible); responde solo con el wrapper "
                "(o la regla escolar si es gramática); ANTES de emitir, relee "
                "wrapper+pregunta: si pides ortografía/locución/significado, la "
                "correcta NO puede estar ya escrita en el wrapper; "
                "(5) explanation enseña la regla en 1-2 frases (por qué es esa opción), "
                "no solo «la correcta es X»; en series, escribe las diferencias "
                "y el siguiente término (que debe estar en las opciones)."
            ),
            (
                "Regla de contexto: si preguntas dónde/qué hizo/qué pasó, "
                "esa información DEBE estar en narrative_wrapper del reto. "
                "No preguntes hechos que no se hayan dicho. "
                "No copies ejemplos de lesson_narrative en los retos."
            ),
            PATH_LORE_ONLY_IF_TAUGHT_RULE,
            MEANING_QUESTION_NO_ECHO_RULE,
            ANSWER_LEAK_IN_STIMULUS_RULE,
            STIMULUS_PROMPT_ALIGNMENT_RULE,
            GAP_QUESTION_IN_STIMULUS_RULE,
            (
                "Regla de oro del MCQ: si enseñas que «correr» es un verbo, la opción "
                "«Verbo» DEBE ser correct_option_id. Si preguntas «¿cuál es un adjetivo?», "
                "alguna opción DEBE ser adjetivo (p. ej. Grande), no solo Casa/Perro/Correr. "
                "teaching_beat y narrative_wrapper vacíos: la teoría va solo en lesson_narrative."
            ),
            (
                f"No copies estos títulos del mapa de zonas: {catalog_avoid}. "
                "Títulos en castellano, distintos entre sí, con sabor del mundo. "
                "Prohibido «Ruta de math/language/reading» u otros ids de materia. "
                "Cada learning_blurb es concreto y distinto (qué se practica en ESA ruta)."
            ),
            (
                "Campos: path_id, subject_id, title, intro, learning_blurb, "
                "path_narrative (2-3 frases de escena), lesson_narrative (5-8 frases de teoría "
                "con NPC ANTES de los retos), npc (npc_id, name, role guide|gatekeeper, "
                "one_line_voice), "
                f"{challenge_n} challenges con narrative_wrapper "
                "(3-5 frases, pasaje autónomo), prompt_text, "
                "item_type mcq, 3 opciones a/b/c, correct_option_id (verdadera), explanation. "
                "Castellano de España. Sin franquicias."
            ),
        ]
        display_name = child.get("display_name")
        if display_name:
            parts.append(f"Nombre del explorador: {display_name}.")
        gender = resolve_explorer_gender(child.get("explorer_gender"))
        if gender in {"male", "female"}:
            parts.append(gender_grammar_prompt_block(gender, display_name))
        parent_id = child.get("parent_id")
        if parent_id:
            try:
                frontmatter, _body = self.ledger.read_traveler_profile(
                    str(parent_id), str(child["id"])
                )
            except Exception:
                frontmatter = None
            if frontmatter:
                species = frontmatter.get("species")
                palette = frontmatter.get("palette")
                vibe = frontmatter.get("vibe")
                if species:
                    parts.append(
                        "Personaje del explorador: "
                        f"especie {species}, personalidad {vibe or '—'}."
                    )
                    if palette and palette_is_meaningful(palette):
                        parts.append(
                            f"Paleta visual de referencia: {palette}. "
                            "Acento ocasional: como máximo 1 camino del pack puede "
                            "mencionar colores de la paleta."
                        )
        return "\n".join(parts)

    def _path_detail_to_pack_entry(
        self,
        detail: Any,
        subject: str,
        subjects: list[str],
        index: int,
        model: str,
        expected_count: int | None = None,
    ) -> tuple[dict[str, Any] | None, str | None]:
        """Parse one LLM path into a pack entry.

        Returns
        -------
        tuple
            ``(entry, None)`` on success; ``(None, issue_code)`` on structural reject.
        """
        p = detail.path
        expected = (
            DialogueService._PATH_MIN_CHALLENGES
            if expected_count is None
            else max(DialogueService._PATH_MIN_CHALLENGES, int(expected_count))
        )
        expected = min(expected, MAX_CHALLENGES_PER_PATH)
        received = list(detail.challenges or [])
        if len(received) > expected:
            compose_log.info(
                "path_compose_challenge_count_truncated",
                expected_count=expected,
                challenges_received=len(received),
                path_index=index,
                subject_id=subject,
                model=model,
            )
        challenges: list[dict[str, Any]] = []
        for ch in received[:expected]:
            finalized = DialogueService._finalize_path_challenge(
                {
                    "prompt_text": ch.prompt_text,
                    "narrative_wrapper": ch.narrative_wrapper,
                    "teaching_beat": ch.teaching_beat,
                    "npc_id": ch.npc_id,
                    "item_type": ch.item_type,
                    "options": [o.model_dump() for o in ch.options],
                    "correct_option_id": ch.correct_option_id,
                    "expected_answer": ch.expected_answer,
                    "explanation": ch.explanation,
                }
            )
            if str(finalized.get("item_type") or "mcq") == "mcq":
                truth_issue = DialogueService._path_challenge_mcq_truth_issue(finalized)
                if truth_issue:
                    compose_log.warning(
                        "path_compose_challenge_unscorable",
                        issue=truth_issue,
                        path_index=index,
                        subject_id=subject,
                        model=model,
                        prompt=str(finalized.get("prompt_text") or "")[:120],
                    )
                    return None, truth_issue
            coherence_issue = DialogueService._path_challenge_stimulus_coherence_issue(
                finalized, subject_id=subject
            )
            if coherence_issue:
                compose_log.warning(
                    "path_compose_challenge_stimulus_issue",
                    issue=coherence_issue,
                    path_index=index,
                    subject_id=subject,
                    model=model,
                    prompt=str(finalized.get("prompt_text") or "")[:120],
                )
                return None, coherence_issue
            challenges.append(finalized)
        if len(challenges) < expected:
            return None, "path_challenge_count_short"
        npc_blob = ""
        if p.npc is not None:
            npc_blob = f"{p.npc.name} {p.npc.one_line_voice}"
        path_blob = " ".join(
            [
                str(p.title or ""),
                str(p.intro or ""),
                str(p.learning_blurb or ""),
                str(p.path_narrative or ""),
                str(getattr(p, "lesson_narrative", None) or ""),
                npc_blob,
                *(str(ch.get("prompt_text") or "") for ch in challenges),
                *(str(ch.get("explanation") or "") for ch in challenges),
            ]
        )
        if franchise_violations_in_text(path_blob):
            return None, "franchise_violation"
        npc: dict[str, Any] | None = None
        if p.npc is not None:
            npc = p.npc.model_dump()
        return (
            {
                "path_id": p.path_id or f"path_{index + 1}",
                "subject_id": p.subject_id if p.subject_id in subjects else subject,
                "title": p.title or f"Camino {index + 1}",
                "intro": p.intro,
                "learning_blurb": p.learning_blurb,
                "path_narrative": p.path_narrative,
                "lesson_narrative": getattr(p, "lesson_narrative", None) or "",
                "npc": npc,
                "challenges": challenges,
                "challenges_per_path": len(challenges),
                "model_used": model,
            },
            None,
        )

    @staticmethod
    def _ledger_events_cache_key(
        ledger: JourneyLedger,
        parent_id: str | None,
        child_id: str,
        session_id: str,
        world: str | None,
    ) -> tuple[int, str, str, str, str | None]:
        return (id(ledger), str(parent_id or ""), child_id, session_id, world)

    def _invalidate_ledger_events_cache(
        self,
        parent_id: str | None,
        child_id: str,
        session_id: str,
        world: str | None = None,
    ) -> None:
        self._ledger_events_cache.pop(
            self._ledger_events_cache_key(
                self.ledger, parent_id, child_id, session_id, world
            ),
            None,
        )

    def _read_ledger_events(
        self,
        parent_id: str,
        child_id: str,
        session_id: str,
        *,
        limit: int | None = None,
        after_seq: int = 0,
        world: str | None = None,
    ) -> list[dict[str, Any]]:
        if limit is None and after_seq == 0:
            key = self._ledger_events_cache_key(
                self.ledger, parent_id, child_id, session_id, world
            )
            cached = self._ledger_events_cache.get(key)
            if cached is not None:
                return cached
        read_kwargs: dict[str, Any] = {}
        if limit is not None:
            read_kwargs["limit"] = limit
        if after_seq:
            read_kwargs["after_seq"] = after_seq
        try:
            rows = self.ledger.read_events(
                parent_id,
                child_id,
                session_id,
                world_theme=world,
                **read_kwargs,
            )
        except TypeError:
            rows = self.ledger.read_events(
                parent_id,
                child_id,
                session_id,
                **read_kwargs,
            )
        if limit is None and after_seq == 0:
            self._ledger_events_cache[
                self._ledger_events_cache_key(
                    self.ledger, parent_id, child_id, session_id, world
                )
            ] = rows
        return rows

    def _append_ledger_event(
        self,
        parent_id: str,
        child_id: str,
        session_id: str,
        *,
        world_theme: str | None = None,
        **kwargs: Any,
    ) -> Any:
        event = self.ledger.append_event(
            parent_id,
            child_id,
            session_id,
            world_theme=world_theme,
            **kwargs,
        )
        self._invalidate_ledger_events_cache(
            parent_id, child_id, session_id, world_theme
        )
        return event

    def _ledger_events_for_session(
        self,
        parent_id: str | None,
        child_id: str,
        session_id: str,
        world: str | None,
    ) -> list[dict[str, Any]]:
        if not parent_id:
            return []
        return list(
            self._read_ledger_events(str(parent_id), child_id, session_id, world=world)
        )

    @staticmethod
    def _completed_path_ids_from_events(events: list[dict[str, Any]]) -> set[str]:
        """path_id con los N retos superados (challenge_index >= n retos)."""
        completed: set[str] = set()
        for row in events or []:
            if row.get("kind") != "path_progress":
                continue
            payload = row.get("payload") if isinstance(row.get("payload"), dict) else {}
            path_id = str(payload.get("path_id") or "").strip()
            if not path_id:
                continue
            path = payload.get("path") if isinstance(payload.get("path"), dict) else {}
            challenges = path.get("challenges") or []
            if not isinstance(challenges, list) or not challenges:
                continue
            if payload.get("last_ok") is not True:
                continue
            idx = int(payload.get("challenge_index") or 0)
            if idx >= len(challenges):
                completed.add(path_id)
        return completed

    @staticmethod
    def _latest_completed_path_id(events: list[dict[str, Any]]) -> str | None:
        last_id: str | None = None
        for row in events or []:
            if row.get("kind") != "path_progress":
                continue
            payload = row.get("payload") if isinstance(row.get("payload"), dict) else {}
            path_id = str(payload.get("path_id") or "").strip()
            if not path_id:
                continue
            path = payload.get("path") if isinstance(payload.get("path"), dict) else {}
            challenges = path.get("challenges") or []
            if not isinstance(challenges, list) or not challenges:
                continue
            if payload.get("last_ok") is not True:
                continue
            idx = int(payload.get("challenge_index") or 0)
            if idx >= len(challenges):
                last_id = path_id
        return last_id

    def _read_path_pack(
        self,
        parent_id: str | None,
        child_id: str,
        session_id: str,
        world: str | None,
    ) -> list[dict[str, Any]]:
        if not parent_id:
            return []
        rows = self._read_ledger_events(
            str(parent_id), child_id, session_id, world=world
        )
        for row in reversed(rows):
            if row.get("kind") == "path_pack":
                return list((row.get("payload") or {}).get("pack") or [])
        return []

    def _read_path_progress(
        self,
        parent_id: str | None,
        child_id: str,
        session_id: str,
        world: str | None,
    ) -> dict[str, Any]:
        if not parent_id:
            return {}
        rows = self._read_ledger_events(
            str(parent_id), child_id, session_id, world=world
        )
        progress: dict[str, Any] = {}
        for row in rows:
            if row.get("kind") == "path_progress":
                progress = dict(row.get("payload") or {})
        return progress

    async def _choose_path(
        self,
        child_id: str,
        session_id: str,
        session: Any,
        sequence: int,
        reply: dict[str, Any],
        value: str,
        child: dict[str, Any],
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        parent_id = child.get("parent_id")
        world = self._world(child)
        pack = self._read_path_pack(
            str(parent_id) if parent_id else None, child_id, session_id, world
        )
        path_id = str(reply.get("option_id") or value or "")
        chosen = next((p for p in pack if p.get("path_id") == path_id), None)
        if not chosen:
            return [], [
                await self._mentor_turn(
                    session_id,
                    child_id,
                    session["flow_id"],
                    sequence + 1,
                    "No encontré ese camino. Elige una de las rutas.",
                    "options_or_text",
                    [
                        {
                            "id": p["path_id"],
                            "label": p["title"],
                            "description": DialogueService._path_pitch_description(p),
                        }
                        for p in pack
                    ],
                    {"phase": "choose_path"},
                )
            ]
        path_id = str(chosen.get("path_id"))
        if parent_id:
            try:
                self._append_ledger_event(
                    str(parent_id),
                    child_id,
                    session_id,
                    kind="path_progress",
                    payload={
                        "path_id": path_id,
                        "challenge_index": 0,
                        "status": "intro",
                        "path": chosen,
                    },
                    world_theme=world,
                )
            except Exception:
                pass
        intro = DialogueService._format_path_intro_text(chosen)
        turn = await self._mentor_turn(
            session_id,
            child_id,
            session["flow_id"],
            sequence + 1,
            intro,
            "options_or_text",
            [DialogueService._path_intro_start_option()],
            {"phase": "path_intro", "path_id": path_id},
        )
        return [{"type": "path_chosen", "value": path_id}], [turn]

    async def _grant_path_reward(
        self,
        child: dict[str, Any],
        *,
        session_id: str,
        offer_id: str,
        grant_key: str,
        currency_amount: int = 0,
        item_def_id: str | None = None,
        agent_name: str | None = None,
    ) -> dict[str, Any] | None:
        """Grant idempotente; never raises into the dialogue path."""
        try:
            from app.catalogs.item_catalog import ItemCatalog
            from app.catalogs.item_namer import ItemNamer
            from app.services.reward_economy import RewardEconomyService

            world = self._world(child) or "fantasy"
            named = None
            if item_def_id:
                defn = ItemCatalog.get(item_def_id)
                if defn:
                    named = ItemNamer.propose(
                        world_theme=world,
                        kind=str(defn["kind"]),
                        subject_ids=list(defn["subject_ids"]),
                        grant_key=grant_key,
                        agent_name=agent_name,
                        fallback=str(defn.get("label_child") or ""),
                        effects=list(defn.get("effects") or []),
                    )
            result = await RewardEconomyService().grant(
                str(child["id"]),
                world,
                grant_key=grant_key,
                offer_id=offer_id,
                currency_amount=currency_amount,
                item_def_id=item_def_id,
                instance_name=named,
                agent_name=agent_name,
                age_band=child.get("age_band")
                if isinstance(child.get("age_band"), str)
                else None,
                session_id=session_id,
            )
            if result.get("skipped"):
                return None
            return result
        except Exception:
            return None

    @staticmethod
    def _pick_path_reward_item(world: str, subject_id: str | None) -> str | None:
        if not subject_id:
            return None
        try:
            from app.catalogs.item_catalog import ItemCatalog

            items = ItemCatalog.list_for_subject(world, subject_id)
        except Exception:
            return None
        for it in items:
            if "challenge_hint" in it.get("effects", []) and it.get("rarity") == "common":
                return str(it["id"])
        return str(items[0]["id"]) if items else None

    async def _path_next_challenge(
        self,
        child_id: str,
        session_id: str,
        session: Any,
        sequence: int,
        child: dict[str, Any],
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        parent_id = child.get("parent_id")
        world = self._world(child)
        progress = self._read_path_progress(
            str(parent_id) if parent_id else None, child_id, session_id, world
        )
        path = progress.get("path") or {}
        challenges = list(path.get("challenges") or [])
        idx = int(progress.get("challenge_index") or 0)
        if idx >= len(challenges):
            recap = DialogueService._format_path_recap_text(path, passed=True)
            parent_id = child.get("parent_id")
            if parent_id:
                try:
                    from app.services.tutor_reports import TutorReportService

                    learning = (child.get("settings") or {}).get("learning") or {}
                    TutorReportService(self.ledger).write_evaluation_report(
                        parent_id=str(parent_id),
                        child_id=child_id,
                        world_theme=world,
                        display_name=child.get("display_name"),
                        progress={
                            "general_level": child.get("general_level"),
                            "rank": {"label_tutor": child.get("rank_id")},
                            "subjects": [],
                        },
                        subject_notes=CrewService.effective_subject_notes(learning),
                        reason="path_completed",
                    )
                except Exception:
                    pass
            subject_id = str(path.get("subject_id") or "") or None
            if not subject_id and challenges:
                subject_id = str(challenges[0].get("subject_id") or "") or None
            progress_effects: list[dict[str, Any]] = []
            try:
                from app.services.subject_progress import SubjectProgressService

                learning = (child.get("settings") or {}).get("learning") or {}
                active = (
                    learning.get("active_subjects")
                    if isinstance(learning.get("active_subjects"), list)
                    else []
                )
                progress_effects = await SubjectProgressService(
                    self.session
                ).finalize_path_completion(
                    child_id,
                    world or "fantasy",
                    subject_id or "math",
                    active_subjects=[str(s) for s in active],
                )
            except Exception:
                pass
            path_id = str(path.get("path_id") or "path")
            grant = await self._grant_path_reward(
                child,
                session_id=session_id,
                offer_id=f"{path_id}:complete",
                grant_key=f"{child_id}:{world or 'fantasy'}:{session_id}:{path_id}:complete",
                currency_amount=25,
                item_def_id=self._pick_path_reward_item(world or "fantasy", subject_id),
            )
            if grant and grant.get("toast_child"):
                recap = f"{recap}\n\n{grant['toast_child']}"
            turn = await self._mentor_turn(
                session_id,
                child_id,
                session["flow_id"],
                sequence + 1,
                recap,
                "continue",
                None,
                {"phase": "adventure_ready", "path_completed": True, "path_recap": True},
            )
            effects: list[dict[str, Any]] = [
                {"type": "path_completed", "value": path.get("path_id")},
                *progress_effects,
            ]
            if grant:
                effects.append(grant)
            return effects, [turn]
        ch = DialogueService._finalize_path_challenge(challenges[idx])
        typ = str(ch.get("item_type") or "mcq")
        turn = await self._mentor_turn(
            session_id,
            child_id,
            session["flow_id"],
            sequence + 1,
            DialogueService._format_path_challenge_text(ch, path),
            "options_only" if typ == "mcq" else "text_only",
            ch.get("options"),
            {
                "phase": "path_challenge",
                "path_id": path.get("path_id"),
                "challenge_index": idx,
                "total": len(challenges),
            },
        )
        return [], [turn]

    @staticmethod
    def _wrong_path_challenge_copy(*, has_usable_baggage: bool) -> str:
        if has_usable_baggage:
            return (
                "Esa respuesta no ha salido. Puedes usar algo del equipaje "
                "para reintentar antes de ver la pista, o continuar."
            )
        return "Esa respuesta no ha salido. Puedes continuar para ver la pista."

    async def _path_fail_skip_to_next_challenge(
        self,
        child_id: str,
        session_id: str,
        session: Any,
        sequence: int,
        child: dict[str, Any],
        *,
        path: dict[str, Any],
        challenges: list[dict[str, Any]],
        idx: int,
        reply: dict[str, Any],
        ch: dict[str, Any],
        progress: dict[str, Any],
        progress_effects: list[dict[str, Any]],
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        """Sin equipaje usable: explicación inmediata y avance al siguiente reto."""
        parent_id = child.get("parent_id")
        world = self._world(child)
        path_id = str(path.get("path_id") or "path")
        next_idx = idx + 1
        if parent_id:
            try:
                helps = (
                    dict(progress.get("helps") or {})
                    if isinstance(progress.get("helps"), dict)
                    else {}
                )
                self._append_ledger_event(
                    str(parent_id),
                    child_id,
                    session_id,
                    kind="path_progress",
                    payload={
                        "path_id": path_id,
                        "challenge_index": next_idx,
                        "status": "active",
                        "path": path,
                        "challenges_per_path": challenges_per_path_from_pack(
                            path,
                            fallback=DialogueService._expected_challenges_per_path(child),
                        ),
                        "helps": helps,
                    },
                    world_theme=world,
                )
            except Exception:
                pass
        expl = DialogueService._incorrect_choice_feedback(ch, reply)
        expl_turn = await self._mentor_turn(
            session_id,
            child_id,
            session["flow_id"],
            sequence + 1,
            expl,
            "continue",
            None,
            {
                "phase": "path_intro",
                "path_id": path_id,
                "challenge_index": idx,
                "total": len(challenges),
                "retry": True,
                "explanation_shown": True,
            },
        )
        next_effects, next_turns = await self._path_next_challenge(
            child_id, session_id, session, sequence + 1, child
        )
        return progress_effects + next_effects, [expl_turn] + next_turns

    async def _has_usable_baggage_for_retry(
        self,
        child: dict[str, Any],
        *,
        path: dict[str, Any],
        challenge_index: int,
        progress: dict[str, Any],
    ) -> bool:
        try:
            retry_progress = dict(progress)
            retry_progress["last_ok"] = False
            offers = await BaggageOfferService().offers_for_play(
                child,
                phase="path_intro",
                meta={
                    "phase": "path_intro",
                    "retry": True,
                    "challenge_index": challenge_index,
                    "path_id": path.get("path_id"),
                },
                progress=retry_progress,
                eligible_retry=True,
            )
        except Exception:
            return False
        return BaggageOfferService.has_usable_offer(offers)

    async def _path_wrong_answer_mentor_text(
        self,
        child: dict[str, Any],
        *,
        path: dict[str, Any],
        progress: dict[str, Any],
        challenge_index: int,
    ) -> str:
        """Copy tras fallo: menciona equipaje solo si hay oferta `can_use`."""
        has_usable = await self._has_usable_baggage_for_retry(
            child,
            path=path,
            challenge_index=challenge_index,
            progress=progress,
        )
        return DialogueService._wrong_path_challenge_copy(
            has_usable_baggage=has_usable
        )

    async def _path_intro_retry_continue(
        self,
        child_id: str,
        session_id: str,
        session: Any,
        sequence: int,
        child: dict[str, Any],
        last: dict[str, Any],
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        """Tras fallar con equipaje usable: equipaje → pista → siguiente reto."""
        parent_id = child.get("parent_id")
        world = self._world(child)
        progress = self._read_path_progress(
            str(parent_id) if parent_id else None, child_id, session_id, world
        )
        path = progress.get("path") or {}
        challenges = list(path.get("challenges") or [])
        meta = last.get("meta") if isinstance(last.get("meta"), dict) else {}
        idx = int(
            meta.get("challenge_index")
            if meta.get("challenge_index") is not None
            else progress.get("challenge_index")
            or 0
        )
        path_id = str(meta.get("path_id") or path.get("path_id") or "path")

        if not meta.get("explanation_shown"):
            ch = DialogueService._finalize_path_challenge(
                challenges[idx] if 0 <= idx < len(challenges) else {}
            )
            wrong_reply = progress.get("last_wrong_reply")
            if not isinstance(wrong_reply, dict):
                wrong_reply = {}
            expl = DialogueService._incorrect_choice_feedback(ch, wrong_reply)
            turn = await self._mentor_turn(
                session_id,
                child_id,
                session["flow_id"],
                sequence + 1,
                expl,
                "continue",
                None,
                {
                    "phase": "path_intro",
                    "path_id": path_id,
                    "challenge_index": idx,
                    "total": len(challenges),
                    "retry": True,
                    "explanation_shown": True,
                },
            )
            return [], [turn]

        next_idx = idx + 1
        if parent_id:
            try:
                helps = (
                    dict(progress.get("helps") or {})
                    if isinstance(progress.get("helps"), dict)
                    else {}
                )
                self._append_ledger_event(
                    str(parent_id),
                    child_id,
                    session_id,
                    kind="path_progress",
                    payload={
                        "path_id": path_id,
                        "challenge_index": next_idx,
                        "status": "active",
                        "path": path,
                        "challenges_per_path": challenges_per_path_from_pack(
                            path,
                            fallback=DialogueService._expected_challenges_per_path(child),
                        ),
                        "helps": helps,
                    },
                    world_theme=world,
                )
            except Exception:
                pass
        return await self._path_next_challenge(
            child_id, session_id, session, sequence, child
        )

    async def _path_challenge_answer(
        self,
        child_id: str,
        session_id: str,
        session: Any,
        sequence: int,
        value: str,
        reply: dict[str, Any],
        last: dict[str, Any],
        child: dict[str, Any],
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        parent_id = child.get("parent_id")
        world = self._world(child)
        progress = self._read_path_progress(
            str(parent_id) if parent_id else None, child_id, session_id, world
        )
        path = progress.get("path") or {}
        challenges = list(path.get("challenges") or [])
        idx = int(last.get("meta", {}).get("challenge_index") or progress.get("challenge_index") or 0)
        ch = DialogueService._finalize_path_challenge(
            challenges[idx] if idx < len(challenges) else {}
        )
        ok = DialogueService._score_placement_item(ch, reply) >= 1.0
        progress_effects: list[dict[str, Any]] = []
        subject_id = str(path.get("subject_id") or "") or "math"
        if not subject_id and challenges:
            subject_id = str(challenges[0].get("subject_id") or "math")
        try:
            from app.services.subject_progress import SubjectProgressService

            progress_effects.extend(
                await SubjectProgressService(self.session).record_path_challenge(
                    child_id,
                    world or "fantasy",
                    subject_id,
                    score=1.0 if ok else 0.0,
                    challenges_per_path=challenges_per_path_from_pack(
                        path,
                        fallback=DialogueService._expected_challenges_per_path(child),
                    ),
                )
            )
        except Exception:
            pass
        next_idx = idx + 1 if ok else idx
        if parent_id:
            try:
                helps = (
                    dict(progress.get("helps") or {})
                    if isinstance(progress.get("helps"), dict)
                    else {}
                )
                self._append_ledger_event(
                    str(parent_id),
                    child_id,
                    session_id,
                    kind="path_progress",
                    payload={
                        "path_id": path.get("path_id"),
                        "challenge_index": next_idx,
                        "status": "active",
                        "last_ok": ok,
                        "path": path,
                        "challenges_per_path": challenges_per_path_from_pack(
                            path,
                            fallback=DialogueService._expected_challenges_per_path(
                                child
                            ),
                        ),
                        "helps": helps,
                        **({"last_wrong_reply": reply} if not ok else {}),
                    },
                    world_theme=world,
                )
            except Exception:
                pass
        if not ok:
            fail_progress = {
                **progress,
                "path_id": path.get("path_id"),
                "challenge_index": idx,
                "last_ok": False,
                "last_wrong_reply": reply,
                "path": path,
            }
            has_usable = await self._has_usable_baggage_for_retry(
                child,
                path=path,
                challenge_index=idx,
                progress=fail_progress,
            )
            if not has_usable:
                return await self._path_fail_skip_to_next_challenge(
                    child_id,
                    session_id,
                    session,
                    sequence,
                    child,
                    path=path,
                    challenges=challenges,
                    idx=idx,
                    reply=reply,
                    ch=ch,
                    progress=progress,
                    progress_effects=progress_effects,
                )
            wrong_text = await self._path_wrong_answer_mentor_text(
                child,
                path=path,
                progress=fail_progress,
                challenge_index=idx,
            )
            turn = await self._mentor_turn(
                session_id,
                child_id,
                session["flow_id"],
                sequence + 1,
                wrong_text,
                "continue",
                None,
                {
                    "phase": "path_intro",
                    "path_id": path.get("path_id"),
                    "challenge_index": idx,
                    "total": len(challenges),
                    "retry": True,
                    "explanation_shown": False,
                },
            )
            return progress_effects, [turn]
        path_id = str(path.get("path_id") or "path")
        reward_effects: list[dict[str, Any]] = list(progress_effects)
        grant = await self._grant_path_reward(
            child,
            session_id=session_id,
            offer_id=f"{path_id}:challenge:{idx}",
            grant_key=f"{child_id}:{world or 'fantasy'}:{session_id}:{path_id}:challenge:{idx}",
            currency_amount=10,
        )
        if grant:
            reward_effects.append(grant)
        # Advance: reuse path_intro handler semantics via continue turn
        child2 = await self._child_by_id(child_id)
        next_effects, turns = await self._path_next_challenge(
            child_id, session_id, session, sequence, child2
        )
        return reward_effects + next_effects, turns

    async def regenerate_anchor_mentor_turn(
        self,
        auth_user_id: str,
        child_id: str,
        session_id: str,
        *,
        phase: str,
    ) -> dict[str, Any] | None:
        """Regenera el primer turno mentor de una fase (rewind sin explorador previo)."""
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
        flow = str(session["flow_id"])
        if phase == "choose_world":
            return await self._agent_mentor_turn(
                child,
                session_id,
                flow,
                sequence,
                "Preséntate y pide elegir mundo (fantasy o sci-fi). Sé breve y claro.",
                "choose_world",
                purpose="onboarding_host",
                force_options=self._world_options(),
                force_input_mode="options_only",
            )
        if phase == "handoff_placement":
            return await self._insert(
                {
                    "session_id": session_id,
                    "child_id": child_id,
                    "flow_id": flow,
                    "sequence": sequence,
                    "role": "mentor",
                    "text": (
                        "Cuando quieras, abrimos la prueba de ingreso. "
                        "Te haré unas preguntas para situarte."
                    ),
                    "input_mode": "continue",
                    "options": None,
                    "meta": {"phase": "handoff_placement"},
                    "explorer_reply": None,
                    "model_used": None,
                }
            )
        if phase == "choose_path":
            return await self.reemit_choose_path(auth_user_id, child_id, session_id)
        if phase == "choose_gender":
            return await self._mentor_choose_gender_turn(
                child, session_id, flow, sequence
            )
        return None

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
        prose_retry_hint: str | None = None,
        extra_meta: dict[str, Any] | None = None,
        extra_prompt: str | None = None,
    ) -> dict[str, Any]:
        purpose_run = purpose if purpose != "character_coach" else "mentor_guide"
        deps = self._deps(child, session_id, purpose_run)
        merged_extra = extra_prompt
        if prose_retry_hint:
            hint = f"Corrección obligatoria: {prose_retry_hint}"
            merged_extra = f"{merged_extra}\n\n{hint}" if merged_extra else hint
        ctx = TurnContext(
            child=child,
            session_id=session_id,
            flow_id=flow,
            sequence=sequence,
            phase=str(phase or "dialogue"),
            purpose=purpose_run,
            explorer_reply=value,
            extra_prompt=merged_extra,
            force_options=force_options,
            force_input_mode=force_input_mode,
            deps=deps,
            settings=self.settings,
            gateway=self.gateway,
            ledger=self.ledger,
        )
        result = await self.orchestrator.run(ctx)
        envelope = result.output
        assert isinstance(envelope, DialogueEnvelope)
        phase_key = str(phase or "")
        world = self._world(child) or "fantasy"
        options = force_options or [o.model_dump() for o in envelope.options] or None
        if phase_key == "choose_character_species" and not force_options:
            avoid_phrases = self._ledger_avoid_phrases(child)
            option_issues = validate_species_options(
                options,
                world,
                age_band=child.get("age_band") or child.get("effective_age_band"),
                age_years=child.get("age_years"),
                avoid_phrases=avoid_phrases,
            )
            if option_issues:
                options = species_options_for_world(world)
        input_mode = force_input_mode or envelope.input_mode
        meta = {
            **(envelope.meta or {}),
            **(extra_meta or {}),
            "phase": phase or "dialogue",
            "world_theme": child.get("world_theme"),
            "mentor_id": deps.mentor and deps.mentor.get("id"),
            "tool_notes": result.tool_notes,
        }
        return await self._mentor_turn(
            session_id,
            str(child["id"]),
            flow,
            sequence,
            envelope.agent_text,
            input_mode,
            options,
            meta,
            result.model_used,
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
        resolved_gender = resolve_explorer_gender(child.get("explorer_gender"))
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
            mentor=mentor_for_child(child),
            player_state={
                "onboarding_step": child.get("onboarding_step"),
                "display_name": child.get("display_name"),
                "placement_status": child.get("placement_status"),
                "explorer_gender": resolved_gender,
            },
            ledger=self.ledger,
        )

    def _ledger_explorer(
        self, child: dict[str, Any], session_id: str, value: str, reply: dict[str, Any]
    ) -> None:
        parent_id = child.get("parent_id")
        if not parent_id:
            return
        display = str(reply.get("displayLabel") or "").strip()
        body = str(reply.get("text") or "").strip()
        if str(reply.get("kind") or "") == "continue":
            ledger_text = display or "Continuar"
        else:
            ledger_text = display or body or value
        try:
            self.ledger.append_dialogue(
                str(parent_id),
                str(child["id"]),
                session_id,
                kind="explorer_reply",
                text=ledger_text,
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
        events = self._read_ledger_events(
            parent_id, child_id, session_id, limit=40
        )
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
                    "select c.* from children c "
                    "where c.id=:child and c.status<>'deleted' and ("
                    " exists (select 1 from parent_accounts p where p.id=c.parent_id and p.auth_user_id=:auth)"
                    " or c.linked_auth_user_id=:auth"
                    ")"
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

    def _chapter_events(
        self,
        parent_id: str | None,
        child_id: str,
        session_id: str,
        world: str | None,
    ) -> list[dict[str, Any]]:
        if not parent_id:
            return []
        return self._read_ledger_events(
            str(parent_id), child_id, session_id, world=world
        )

    def _resolve_chapter(
        self,
        child: dict[str, Any],
        session_id: str,
        last_phase: str | None,
    ) -> dict[str, Any]:
        parent_id = child.get("parent_id")
        world = self._world(child)
        events = self._chapter_events(
            str(parent_id) if parent_id else None,
            str(child["id"]),
            session_id,
            world,
        )
        persisted = read_latest_chapter_opened(events)
        progress = self._read_path_progress(
            str(parent_id) if parent_id else None,
            str(child["id"]),
            session_id,
            world,
        )
        return resolve_chapter(
            child,
            world_theme=world,
            last_phase=last_phase,
            persisted=persisted,
            path_progress=progress or None,
        )

    def _record_chapter_if_changed(
        self,
        child: dict[str, Any],
        session_id: str,
        chapter: dict[str, Any],
    ) -> None:
        parent_id = child.get("parent_id")
        if not parent_id:
            return
        world = self._world(child)
        events = self._chapter_events(str(parent_id), str(child["id"]), session_id, world)
        latest = read_latest_chapter_opened(events)
        chapter_id = str(chapter.get("id") or "")
        title = str(chapter.get("title") or "")
        if (
            latest
            and str(latest.get("chapter_id") or latest.get("id") or "") == chapter_id
            and str(latest.get("title") or "") == title
        ):
            return
        try:
            self._append_ledger_event(
                str(parent_id),
                str(child["id"]),
                session_id,
                kind="chapter_opened",
                payload={
                    "chapter_id": chapter_id,
                    "title": title,
                    "source": chapter.get("source"),
                    "world_theme": chapter.get("world_theme"),
                    "path_id": chapter.get("path_id"),
                },
                world_theme=world,
                summary=f"Capítulo: {title}",
            )
        except Exception:
            pass

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
            return
        if child.get("onboarding_step") == "placement":
            await self._insert(
                {
                    "session_id": sid,
                    "child_id": cid,
                    "flow_id": flow,
                    "sequence": 1,
                    "role": "mentor",
                    "text": (
                        "Cuando quieras, abrimos la prueba de ingreso. "
                        "No es un trámite: es el mapa de tu viaje."
                    ),
                    "input_mode": "continue",
                    "options": None,
                    "meta": {"phase": "handoff_placement"},
                }
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
        child = await self._child_by_id(str(saved["child_id"]))
        return self._enrich_turn(self._turn(saved), child)

    async def _turns_from_rows(
        self, rows: list[Any], child_id: str | None = None
    ) -> list[dict[str, Any]]:
        if not rows:
            return []
        cid = child_id or str(rows[0]["child_id"])
        child = await self._child_by_id(cid)
        return [self._enrich_turn(self._turn(row), child) for row in rows]

    async def _recent(
        self, cid: str, limit: int, session_id: str | None = None
    ) -> list[dict[str, Any]]:
        if session_id:
            rows = (
                await self.session.execute(
                    text(
                        "select * from dialogue_turns where child_id=:id and session_id=:sid "
                        "order by sequence asc"
                    ),
                    {"id": cid, "sid": session_id},
                )
            ).mappings().all()
            if len(rows) > limit:
                rows = rows[-limit:]
            return await self._turns_from_rows(rows, cid)
        rows = (
            await self.session.execute(
                text(
                    "select * from dialogue_turns where child_id=:id "
                    "order by sequence asc"
                ),
                {"id": cid},
            )
        ).mappings().all()
        if len(rows) > limit:
            rows = rows[-limit:]
        return await self._turns_from_rows(rows, cid)

    async def baggage_offers_for_session(
        self,
        auth_user_id: str,
        child_id: str,
        session_id: str,
    ) -> dict[str, Any]:
        """Return inline baggage offers for the active challenge turn."""
        child = await self._child(auth_user_id, child_id)
        payload: dict[str, Any] = {}
        await self._attach_baggage_offers(payload, child, session_id)
        return {"baggage_offers": payload.get("baggage_offers") or []}

    async def _attach_baggage_offers(
        self,
        payload: dict[str, Any],
        child: dict[str, Any],
        session_id: str,
    ) -> None:
        last = payload.get("pending_agent_turn")
        if not isinstance(last, dict):
            last = await self._last_mentor(session_id)
        meta = last.get("meta") if isinstance(last, dict) and isinstance(last.get("meta"), dict) else {}
        phase = str(meta.get("phase") or "")
        if phase not in {"path_challenge", "path_intro"}:
            payload["baggage_offers"] = []
            return
        parent_id = child.get("parent_id")
        world = self._world(child) or "fantasy"
        progress = self._read_path_progress(
            str(parent_id) if parent_id else None, str(child["id"]), session_id, world
        )
        eligible_retry = phase == "path_intro" and bool(meta.get("retry"))
        if not eligible_retry and progress.get("last_ok") is False:
            eligible_retry = True
        offers = await BaggageOfferService().offers_for_play(
            child,
            phase=phase,
            meta=meta,
            progress=progress,
            eligible_retry=eligible_retry,
        )
        payload["baggage_offers"] = offers

    async def use_baggage_item(
        self,
        auth_user_id: str,
        child_id: str,
        item_row_id: str,
        effect_id: str,
        session_id: str,
    ) -> dict[str, Any]:
        """Consume inventory item for challenge_hint / challenge_retry."""
        from app.services.baggage_use import BaggageUseService, UseItemError

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
            raise ValueError("Dialogue session not found or closed")

        last = await self._last_mentor(session_id)
        meta = (last or {}).get("meta") if isinstance((last or {}).get("meta"), dict) else {}
        phase = str(meta.get("phase") or "")
        if phase.startswith("placement"):
            raise UseItemError("no_active_challenge", 409)

        parent_id = child.get("parent_id")
        world = self._world(child) or "fantasy"
        progress = self._read_path_progress(
            str(parent_id) if parent_id else None, child_id, session_id, world
        )
        path = progress.get("path") if isinstance(progress.get("path"), dict) else {}
        challenges = list(path.get("challenges") or [])
        idx = int(
            meta.get("challenge_index")
            if meta.get("challenge_index") is not None
            else progress.get("challenge_index")
            or 0
        )
        helps = progress.get("helps") if isinstance(progress.get("helps"), dict) else {}
        help_row = helps.get(str(idx)) if isinstance(helps.get(str(idx)), dict) else {}

        active_challenge: dict[str, Any] | None = None
        can_retry = False
        if phase == "path_challenge" and 0 <= idx < len(challenges):
            active_challenge = dict(challenges[idx])
        elif phase == "path_intro" and meta.get("retry") and 0 <= idx < len(challenges):
            active_challenge = dict(challenges[idx])
            can_retry = True
        elif progress.get("last_ok") is False and 0 <= idx < len(challenges):
            active_challenge = dict(challenges[idx])
            can_retry = True

        if effect_id == "challenge_hint" and help_row.get("hint"):
            raise UseItemError("hint_already_used", 409)
        if effect_id == "challenge_retry":
            if help_row.get("retry"):
                raise UseItemError("retry_not_eligible", 409)
            if not can_retry:
                raise UseItemError("retry_not_eligible", 409)

        item_snapshot = (
            await self.session.execute(
                text(
                    """
                    select item_def_id, instance_name
                    from public.child_inventory_items
                    where id = :id and child_id = :child_id
                    """
                ),
                {"id": item_row_id, "child_id": child_id},
            )
        ).mappings().first()

        result = await BaggageUseService().use(
            child=child,
            item_row_id=item_row_id,
            effect_id=effect_id,
            session_id=session_id,
            active_challenge=active_challenge,
            can_retry=can_retry if effect_id == "challenge_retry" else bool(active_challenge),
        )

        if parent_id:
            try:
                new_helps = dict(helps)
                row_help = dict(help_row)
                if effect_id == "challenge_hint":
                    row_help["hint"] = True
                if effect_id == "challenge_retry":
                    row_help["retry"] = True
                new_helps[str(idx)] = row_help
                self._append_ledger_event(
                    str(parent_id),
                    child_id,
                    session_id,
                    kind="path_progress",
                    payload={**progress, "helps": new_helps},
                    world_theme=world,
                )
                self._append_ledger_event(
                    str(parent_id),
                    child_id,
                    session_id,
                    kind="item_used",
                    payload={
                        "item_row_id": item_row_id,
                        "item_def_id": str(item_snapshot["item_def_id"])
                        if item_snapshot
                        else None,
                        "instance_name": str(item_snapshot["instance_name"] or "").strip()
                        if item_snapshot and item_snapshot.get("instance_name")
                        else None,
                        "effect_id": effect_id,
                        "challenge_index": idx,
                        "path_id": path.get("path_id"),
                        "subject_id": str(active_challenge.get("subject_id") or "")
                        if active_challenge
                        else None,
                    },
                    world_theme=world,
                )
            except Exception:
                pass

        agent_turns: list[dict[str, Any]] = []
        if effect_id == "challenge_retry" and result.get("challenge_reopened"):
            sequence = int(
                (
                    await self.session.execute(
                        text(
                            "select coalesce(max(sequence),0) as m from dialogue_turns where session_id=:id"
                        ),
                        {"id": session_id},
                    )
                ).mappings().one()["m"]
            )
            _fx, agent_turns = await self._path_next_challenge(
                child_id, session_id, session, sequence, child
            )
            result["agent_turns"] = agent_turns
            result["pending_agent_turn"] = agent_turns[-1] if agent_turns else None
        elif effect_id == "challenge_hint" and result.get("hint_text"):
            # Keep challenge pending; mentor_line is informational only
            result["pending_agent_turn"] = last

        await self._attach_baggage_offers(result, child, session_id)
        return result

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
        if not row:
            return None
        child = await self._child_by_id(str(row["child_id"]))
        return self._enrich_turn(self._turn(row), child)

    async def _history(
        self, cid: str, turns: list[dict[str, Any]], session_id: str | None = None
    ) -> dict[str, Any]:
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
        sid = session_id or new.get("session_id")
        older = False
        if sid and old.get("sequence") is not None:
            older = bool(
                (
                    await self.session.execute(
                        text(
                            "select 1 from dialogue_turns where child_id=:cid and session_id=:sid "
                            "and sequence < :seq limit 1"
                        ),
                        {"cid": cid, "sid": sid, "seq": old["sequence"]},
                    )
                ).scalar()
            )
        return {
            "page_size": self.PAGE_SIZE,
            "has_older": bool(older),
            "oldest_turn_id": old["id"],
            "newest_turn_id": new["id"],
            "oldest_sequence": old["sequence"],
            "newest_sequence": new["sequence"],
        }

    _CHOICE_ECHO_PHASES = frozenset({"placement_item", "choose_path", "path_challenge"})
    _CHOICE_ECHO_PHASE_NAMES = {
        "placement_item": "placement_choice_echo",
        "choose_path": "path_choice_echo",
        "path_challenge": "path_challenge_echo",
    }

    async def _choice_echo_scoring_item(
        self,
        last_mentor: dict[str, Any],
        child_id: str,
        session_id: str,
        child: dict[str, Any],
    ) -> dict[str, Any] | None:
        mentor_meta = (
            last_mentor.get("meta") if isinstance(last_mentor.get("meta"), dict) else {}
        )
        phase = str(mentor_meta.get("phase") or "")
        parent_id = child.get("parent_id")
        world = self._world(child)
        if phase == "placement_item" and parent_id:
            state = self._read_placement_state(
                str(parent_id), child_id, session_id, world
            )
            if not state:
                return None
            queue = state.get("queue") or []
            index = int(mentor_meta.get("index") if mentor_meta.get("index") is not None else state.get("index") or 0)
            if 0 <= index < len(queue):
                return queue[index]
        if phase == "path_challenge" and parent_id:
            progress = self._read_path_progress(
                str(parent_id), child_id, session_id, world
            )
            path = progress.get("path") or {}
            challenges = list(path.get("challenges") or [])
            index = int(
                mentor_meta.get("challenge_index")
                if mentor_meta.get("challenge_index") is not None
                else progress.get("challenge_index") or 0
            )
            if 0 <= index < len(challenges):
                item = DialogueService._finalize_path_challenge(challenges[index])
                subject_id = str(path.get("subject_id") or item.get("subject_id") or "")
                if subject_id:
                    item["subject_id"] = subject_id
                return item
        return None

    @staticmethod
    def _choice_echo_meta(
        last_mentor: dict[str, Any],
        *,
        selected_id: str,
        display_label: str,
        reply: dict[str, Any] | None = None,
        scoring_item: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        mentor_meta = (
            last_mentor.get("meta") if isinstance(last_mentor.get("meta"), dict) else {}
        )
        phase = str(mentor_meta.get("phase") or "")
        if phase not in DialogueService._CHOICE_ECHO_PHASES:
            return {}
        opts = DialogueService._normalize_options_list(last_mentor.get("options")) or []
        if not opts:
            return {}
        taken = next(
            (opt for opt in opts if str(opt.get("id")) == selected_id),
            {"id": selected_id, "label": display_label or selected_id},
        )
        meta: dict[str, Any] = {
            "phase": DialogueService._CHOICE_ECHO_PHASE_NAMES[phase],
            "choice_taken": taken,
            "choices_discarded": [
                opt for opt in opts if str(opt.get("id")) != selected_id
            ],
        }
        if scoring_item and phase in {"placement_item", "path_challenge"}:
            score_reply = reply if isinstance(reply, dict) else {"option_id": selected_id}
            finalized = (
                DialogueService._finalize_path_challenge(scoring_item)
                if phase == "path_challenge"
                else DialogueService._finalize_placement_queue_item(scoring_item)
            )
            score = DialogueService._score_placement_item(finalized, score_reply)
            if score >= 1.0:
                meta["choice_correct"] = True
            elif score < 0.5:
                meta["choice_correct"] = False
            subject_id = str(scoring_item.get("subject_id") or finalized.get("subject_id") or "")
            if subject_id:
                meta["subject_id"] = subject_id
        return meta

    @staticmethod
    def _normalize_options_list(raw: Any) -> list[dict[str, Any]] | None:
        if raw is None:
            return None
        if isinstance(raw, dict):
            raw = [{"id": str(key), "label": str(value)} for key, value in raw.items()]
        if not isinstance(raw, list):
            return None
        out: list[dict[str, Any]] = []
        for idx, item in enumerate(raw):
            if isinstance(item, str):
                out.append({"id": item, "label": item})
                continue
            if not isinstance(item, dict):
                continue
            oid = str(
                item.get("id") or item.get("option_id") or item.get("key") or ""
            ).strip().rstrip(":")
            label = str(
                item.get("label")
                or item.get("text")
                or item.get("value")
                or item.get("answer")
                or item.get("content")
                or ""
            ).strip()
            desc = str(item.get("description") or "").strip()
            if not label and desc:
                label = desc
            elif (
                label
                and desc
                and len(label) <= 2
                and label.upper() == oid.upper()
                and desc.lower() != oid.lower()
            ):
                label = desc
            if not oid:
                oid = chr(ord("a") + idx) if idx < 26 else str(idx)
            if not label:
                label = oid
            entry: dict[str, Any] = {"id": oid, "label": label}
            if desc and desc != label:
                entry["description"] = desc
            out.append(entry)
        return out or None

    @staticmethod
    def _options_are_letter_only(options: list[dict[str, Any]] | None) -> bool:
        if not options:
            return True
        for opt in options:
            oid = str(opt.get("id") or "").strip()
            label = str(opt.get("label") or "").strip()
            if not label:
                return True
            if len(label) <= 2 and label.upper() == oid.upper():
                return True
        return False

    def _placement_options_from_ledger(
        self, child: dict[str, Any], turn: dict[str, Any]
    ) -> list[dict[str, Any]] | None:
        parent_id = child.get("parent_id")
        if not parent_id:
            return None
        meta = turn.get("meta") if isinstance(turn.get("meta"), dict) else {}
        session_id = str(turn.get("session_id") or "")
        world = str(meta.get("world_theme") or self._world(child) or "")
        state = self._read_placement_state(
            str(parent_id), str(child["id"]), session_id, world or None
        )
        if not state:
            return None
        index = int(
            meta.get("index")
            if meta.get("index") is not None
            else state.get("index") or 0
        )
        queue = state.get("queue") or []
        if index >= len(queue):
            return None
        item = queue[index]
        return self._normalize_options_list(item.get("options"))

    def _enrich_turn(self, turn: dict[str, Any], child: dict[str, Any]) -> dict[str, Any]:
        d = dict(turn)
        d["options"] = self._normalize_options_list(d.get("options"))
        meta = d.get("meta") if isinstance(d.get("meta"), dict) else {}
        if meta.get("phase") == "placement_item" and self._options_are_letter_only(
            d.get("options")
        ):
            restored = self._placement_options_from_ledger(child, d)
            if restored:
                d["options"] = restored
        return DialogueService._normalize_turn_fields(d)

    @staticmethod
    def _normalize_turn_fields(d: dict[str, Any]) -> dict[str, Any]:
        meta = d.get("meta") if isinstance(d.get("meta"), dict) else {}
        phase = str(meta.get("phase") or "")
        d["options"] = DialogueService._normalize_options_list(d.get("options"))
        if phase == "path_intro" and meta.get("retry"):
            d["input_mode"] = "continue"
        elif phase in PHASE_INPUT_MODE:
            d["input_mode"] = PHASE_INPUT_MODE[phase]
        if phase == "choose_age" and not d.get("options"):
            d["options"] = [
                {"id": str(age), "label": str(age)}
                for age in (6, 7, 8, 9, 10, 12, 15, 18, 30, 50, 70)
            ]
        if phase == "choose_gender" and not d.get("options"):
            d["options"] = gender_chip_options(None, None)
        if phase in {"choose_character_species", "choose_character"} and not d.get("options"):
            world = str(meta.get("world_theme") or "")
            d["options"] = species_options_for_world(world if world in {"fantasy", "sci-fi"} else "fantasy")
        if (
            phase == "path_intro"
            and not meta.get("retry")
            and not any(
                str(o.get("id") or "") == "start_challenges"
                for o in (d.get("options") or [])
                if isinstance(o, dict)
            )
        ):
            d["options"] = [DialogueService._path_intro_start_option()]
        return d

    @staticmethod
    def _turn(row: Any) -> dict[str, Any]:
        d = dict(row)
        for key in ("options", "explorer_reply", "meta"):
            if isinstance(d.get(key), str):
                try:
                    d[key] = json.loads(d[key])
                except ValueError:
                    d[key] = None if key != "meta" else {}
        if isinstance(d.get("options"), list):
            d["options"] = DialogueService._normalize_options_list(d.get("options"))
        d = DialogueService._normalize_turn_fields(d)
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
