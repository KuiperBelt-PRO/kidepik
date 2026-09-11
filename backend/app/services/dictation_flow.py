"""Orquestación del gate de dictado (fases play)."""
from __future__ import annotations

import json
import uuid
from pathlib import Path
from typing import Any

from sqlalchemy import bindparam, text
from sqlalchemy.dialects.postgresql import JSONB

from app.ai.errors import AiProductError
from app.config import get_settings
from app.services.dictation_cards import DEBUG_DICTATION_OPTION_ID, listen_prompt, start_dictation_option
from app.services.dictation_compose import compose_dictation
from app.services.dictation_grade import grade_transcription
from app.services.dictation_photo import validate_dictation_photo_url
from app.services.dictation_settings import effective_dictation_settings
from app.services.dictation_tts import synthesize_dictation
from app.services.dictation_weak_points import apply_attempt_to_weak_points
from app.services.waiting_phrases import pick_waiting_batch

RETRY_LISTEN_OPTION = {"id": "retry_listen", "label": "Oír otra vez y repetir"}
CONTINUE_OPTION = {"id": "continue", "label": "Continuar"}


def weak_points_path(ledger: Any, parent_id: str, child_id: str, world: str) -> Path:
    return ledger.world_dir(parent_id, child_id, world) / "dictation_weak_points.json"


def load_weak_points(ledger: Any, parent_id: str, child_id: str, world: str) -> list[dict[str, Any]]:
    path = weak_points_path(ledger, parent_id, child_id, world)
    if not path.is_file():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []
    return list(data) if isinstance(data, list) else []


def save_weak_points(
    ledger: Any,
    parent_id: str,
    child_id: str,
    world: str,
    points: list[dict[str, Any]],
) -> None:
    path = weak_points_path(ledger, parent_id, child_id, world)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(points, ensure_ascii=False, indent=2), encoding="utf-8")


def latest_open_dictation(events: list[dict[str, Any]]) -> dict[str, Any] | None:
    current: dict[str, Any] | None = None
    for row in events or []:
        payload = row.get("payload") if isinstance(row.get("payload"), dict) else {}
        etype = str(payload.get("type") or "")
        if etype == "dictation_started":
            current = dict(payload)
        elif etype in {"dictation_passed", "dictation_exhausted"}:
            current = None
    return current


async def persist_dictation_runtime(
    session: Any,
    child: dict[str, Any],
    patch: dict[str, Any],
) -> None:
    settings = dict(child.get("settings") or {})
    learning = dict(settings.get("learning") or {})
    dictation = dict(learning.get("dictation") or {})
    dictation.update(patch)
    learning["dictation"] = dictation
    settings["learning"] = learning
    statement = text(
        "update children set settings = cast(:settings as jsonb), updated_at = now() where id = :id"
    ).bindparams(bindparam("settings", type_=JSONB))
    await session.execute(statement, {"id": child["id"], "settings": settings})
    child["settings"] = settings


async def maybe_start_after_path(
    dialogue: Any,
    child: dict[str, Any],
    session_id: str,
    session: Any,
    sequence: int,
    *,
    path_id: str,
    subject_id: str,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]] | None:
    """Obsoleto: la oferta es la 4.ª carta en ``choose_path``. No fuerza al cerrar un camino."""
    _ = (dialogue, child, session_id, session, sequence, path_id, subject_id)
    return None


async def launch_dictation(
    dialogue: Any,
    child: dict[str, Any],
    session_id: str,
    session: Any,
    sequence: int,
    *,
    source: str,
    path_id: str = "",
    completed_path_count: int = 0,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]] | None:
    parent_id = str(child.get("parent_id") or "")
    world = dialogue._world(child) or "fantasy"
    child_id = str(child["id"])
    weak = load_weak_points(dialogue.ledger, parent_id, child_id, world) if parent_id else []
    envelope = await compose_dictation(child, weak)
    dictation_id = str(uuid.uuid4())
    settings = get_settings()
    try:
        audio_url, model = await synthesize_dictation(
            canonical_text=envelope.canonical_text,
            dictation_id=dictation_id,
            user_id=str(getattr(dialogue, "_auth_user_id", None) or child_id),
            media_root=settings.media_root,
            tts_instruction=envelope.tts_instruction,
            settings=settings,
        )
    except AiProductError as exc:
        if exc.error_code in {"ai_quota_exhausted", "ai_not_configured", "ai_provider_unavailable"}:
            if parent_id:
                try:
                    dialogue._append_ledger_event(
                        parent_id,
                        child_id,
                        session_id,
                        kind="system",
                        payload={
                            "type": "dictation_skipped_quota",
                            "reason": exc.error_code,
                            "source": source,
                            "path_id": path_id,
                        },
                        world_theme=world,
                    )
                except Exception:
                    pass
            if source == "product":
                await persist_dictation_runtime(
                    dialogue.session,
                    child,
                    {"last_gate_path_count": completed_path_count},
                )
            # path_offer D7: no resetear offer_skips; el viajero sigue en choose_path.
            return None
        raise
    if parent_id:
        try:
            dialogue._append_ledger_event(
                parent_id,
                child_id,
                session_id,
                kind="system",
                payload={
                    "type": "dictation_started",
                    "dictation_id": dictation_id,
                    "path_id": path_id,
                    "source": source,
                    "canonical_text": envelope.canonical_text,
                    "focus_applied": envelope.focus_applied,
                    "attempt": 0,
                    "max_attempts": effective_dictation_settings(
                        ((child.get("settings") or {}).get("learning") or {}).get("dictation")
                    )["max_attempts"],
                    "audio_url": audio_url,
                    "tts_model": model,
                },
                world_theme=world,
            )
            dialogue._append_ledger_event(
                parent_id,
                child_id,
                session_id,
                kind="system",
                payload={
                    "type": "dictation_audio_ready",
                    "dictation_id": dictation_id,
                    "audio_url": audio_url,
                    "model": model,
                },
                world_theme=world,
            )
        except Exception:
            pass
        if source in {"product", "path_offer"}:
            await persist_dictation_runtime(
                dialogue.session,
                child,
                {"last_gate_path_count": completed_path_count, "offer_skips": 0},
            )
    theory = envelope.theory_mentor.strip()
    start_opt = start_dictation_option(world)
    turn = await dialogue._mentor_turn(
        session_id,
        child_id,
        session["flow_id"],
        sequence + 1,
        theory,
        "options_or_text",
        [start_opt],
        {
            "phase": "dictation_theory",
            "dictation_id": dictation_id,
            "source": source,
            "audio_url": audio_url,
        },
    )
    return [{"type": "dictation_started", "value": dictation_id, "source": source}], [turn]


async def handle_theory(
    dialogue: Any,
    child: dict[str, Any],
    session_id: str,
    session: Any,
    sequence: int,
    reply: dict[str, Any],
    last: dict[str, Any],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    kind = str(reply.get("kind") or "")
    option_id = str(reply.get("option_id") or "")
    meta = last.get("meta") if isinstance(last.get("meta"), dict) else {}
    world = dialogue._world(child) or "fantasy"
    start_opt = start_dictation_option(world)
    if kind == "text":
        turn = await dialogue._agent_mentor_turn(
            child,
            session_id,
            str(session["flow_id"]),
            sequence + 1,
            str(reply.get("text") or ""),
            "dictation_theory",
            purpose="mentor_guide",
            force_options=[start_opt],
            force_input_mode="options_or_text",
            extra_meta={
                "phase": "dictation_theory",
                "dictation_id": meta.get("dictation_id"),
                "source": meta.get("source"),
                "audio_url": meta.get("audio_url"),
            },
            extra_prompt=(
                "El explorador pregunta dudas SOLO de la regla de esta teoría de dictado. "
                "No recites ni parafrasees el texto canónico. No des la respuesta del dictado."
            ),
        )
        return [], [turn]
    if option_id != "start_dictation" and kind != "continue":
        return [], [
            await dialogue._mentor_turn(
                session_id,
                str(child["id"]),
                session["flow_id"],
                sequence + 1,
                last.get("text") or "Cuando quieras, empezamos el dictado.",
                "options_or_text",
                [start_opt],
                {
                    "phase": "dictation_theory",
                    "dictation_id": meta.get("dictation_id"),
                    "source": meta.get("source"),
                    "audio_url": meta.get("audio_url"),
                },
            )
        ]
    return await _listen_turn(dialogue, child, session_id, session, sequence, meta, last)


async def _listen_turn(
    dialogue: Any,
    child: dict[str, Any],
    session_id: str,
    session: Any,
    sequence: int,
    meta: dict[str, Any],
    last: dict[str, Any],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    audio_url = meta.get("audio_url")
    world = dialogue._world(child) or "fantasy"
    grade_hints = await pick_waiting_batch(
        dialogue.session,
        world_theme=world,
        age_band=child.get("age_band") or child.get("effective_age_band"),
        phase="dictation_grade",
    )
    turn = await dialogue._mentor_turn(
        session_id,
        str(child["id"]),
        session["flow_id"],
        sequence + 1,
        listen_prompt(world),
        "photo",
        None,
        {
            "phase": "dictation_listen",
            "dictation_id": meta.get("dictation_id"),
            "source": meta.get("source"),
            "audio_url": audio_url,
            "waiting_hints": grade_hints,
        },
    )
    return [], [turn]


async def handle_listen(
    dialogue: Any,
    child: dict[str, Any],
    session_id: str,
    session: Any,
    sequence: int,
    reply: dict[str, Any],
    last: dict[str, Any],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    meta = last.get("meta") if isinstance(last.get("meta"), dict) else {}
    dictation_id = str(reply.get("dictation_id") or meta.get("dictation_id") or "")
    photo_url = validate_dictation_photo_url(
        str(reply.get("photo_url") or ""),
        user_id=str(getattr(dialogue, "_auth_user_id", None) or child["id"]),
    )
    parent_id = str(child.get("parent_id") or "")
    world = dialogue._world(child) or "fantasy"
    events = dialogue._ledger_events_for_session(
        parent_id or None, str(child["id"]), session_id, world
    )
    opened = latest_open_dictation(events) or {}
    canonical = str(opened.get("canonical_text") or "")
    max_attempts = int(opened.get("max_attempts") or 3)
    attempt = int(opened.get("attempt") or 0) + 1
    transcription = str(reply.get("transcription") or "")
    grade_llm = None
    if not transcription:
        grade_llm = await _grade_with_vision(canonical, photo_url, child)
        if grade_llm and grade_llm.get("unreadable"):
            if parent_id:
                dialogue._append_ledger_event(
                    parent_id,
                    str(child["id"]),
                    session_id,
                    kind="system",
                    payload={
                        "type": "dictation_unreadable",
                        "dictation_id": dictation_id,
                        "photo_url": photo_url,
                    },
                    world_theme=world,
                )
            turn = await dialogue._mentor_turn(
                session_id,
                str(child["id"]),
                session["flow_id"],
                sequence + 1,
                "No se lee bien la foto. Haz otra, con más luz y sin tapar las letras.",
                "photo",
                None,
                {
                    "phase": "dictation_listen",
                    "dictation_id": dictation_id,
                    "source": meta.get("source"),
                    "audio_url": meta.get("audio_url"),
                },
            )
            return [{"type": "dictation_unreadable", "value": dictation_id}], [turn]
        transcription = str((grade_llm or {}).get("transcription") or "")
    band = str(child.get("effective_age_band") or child.get("age_band") or "band_child")
    graded = grade_transcription(canonical, transcription, band)
    passed = bool(graded["passed"])
    mentor_text = _result_prose(graded, passed, world, grade_llm)
    if parent_id:
        dialogue._append_ledger_event(
            parent_id,
            str(child["id"]),
            session_id,
            kind="system",
            payload={
                "type": "dictation_attempt",
                "dictation_id": dictation_id,
                "attempt": attempt,
                "score": graded["score"],
                "errors": graded["errors"],
                "photo_url": photo_url,
                "transcription": transcription,
            },
            world_theme=world,
        )
        # bump attempt on started payload via a small progress event
        opened["attempt"] = attempt
    exhausted = (not passed) and attempt >= max_attempts
    options = [CONTINUE_OPTION]
    if not passed and not exhausted:
        options = [RETRY_LISTEN_OPTION, CONTINUE_OPTION]
    close_type = "dictation_passed" if passed else ("dictation_exhausted" if exhausted else None)
    effects: list[dict[str, Any]] = [
        {"type": "dictation_attempt", "score": graded["score"], "passed": passed}
    ]
    if close_type and parent_id:
        points = load_weak_points(dialogue.ledger, parent_id, str(child["id"]), world)
        correct_tags = [] if not passed else [e.get("tag") for e in [] if False]
        points = apply_attempt_to_weak_points(
            points,
            errors=graded["errors"],
            correct_tags=correct_tags,
            now=__import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat().replace("+00:00", "Z"),
        )
        save_weak_points(dialogue.ledger, parent_id, str(child["id"]), world, points)
        dialogue._append_ledger_event(
            parent_id,
            str(child["id"]),
            session_id,
            kind="system",
            payload={
                "type": close_type,
                "dictation_id": dictation_id,
                "final_score": graded["score"],
                "source": meta.get("source"),
            },
            world_theme=world,
        )
        if passed:
            try:
                from app.services.subject_progress import SubjectProgressService
                from app.services.subject_progress_config import (
                    CHALLENGES_PER_PATH_NORM,
                    effective_challenges_per_path,
                )

                learning = (child.get("settings") or {}).get("learning") or {}
                n = effective_challenges_per_path(
                    learning.get("challenges_per_path") if isinstance(learning, dict) else None,
                    child.get("age_band"),
                    child.get("age_years"),
                )
                progress_effects = await SubjectProgressService(dialogue.session).record_dictation_pass(
                    str(child["id"]),
                    world,
                    "language",
                    challenges_per_path=n or CHALLENGES_PER_PATH_NORM,
                )
                effects.extend(progress_effects)
                from app.services.dictation_orthography import advance_orthography, effective_orthography

                dictation_blob = learning.get("dictation") if isinstance(learning, dict) else {}
                ortho = advance_orthography(
                    effective_orthography(dictation_blob if isinstance(dictation_blob, dict) else None),
                    challenges_per_path=n or CHALLENGES_PER_PATH_NORM,
                )
                await persist_dictation_runtime(dialogue.session, child, ortho)
            except Exception:
                pass
    turn = await dialogue._mentor_turn(
        session_id,
        str(child["id"]),
        session["flow_id"],
        sequence + 1,
        mentor_text,
        "continue" if passed or exhausted else "options_or_text",
        options,
        {
            "phase": "dictation_result",
            "dictation_id": dictation_id,
            "source": meta.get("source"),
            "audio_url": meta.get("audio_url"),
            "passed": passed,
            "exhausted": exhausted,
            "attempt": attempt,
            "canonical_hidden": True,
        },
    )
    return effects, [turn]


async def handle_result(
    dialogue: Any,
    child: dict[str, Any],
    session_id: str,
    session: Any,
    sequence: int,
    reply: dict[str, Any],
    last: dict[str, Any],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    meta = last.get("meta") if isinstance(last.get("meta"), dict) else {}
    option_id = str(reply.get("option_id") or "")
    if option_id == "retry_listen" and not meta.get("passed") and not meta.get("exhausted"):
        return await _listen_turn(dialogue, child, session_id, session, sequence, meta, last)
    if meta.get("source") == "debug_card":
        pack = dialogue._read_path_pack(
            str(child.get("parent_id") or "") or None,
            str(child["id"]),
            session_id,
            dialogue._world(child),
        )
        options = dialogue._choose_path_card_options(pack)
        options = dialogue._with_debug_dictation_option(options, child, session_id)
        turn = await dialogue._mentor_turn(
            session_id,
            str(child["id"]),
            session["flow_id"],
            sequence + 1,
            "Sigues en la encrucijada. Elige un camino cuando quieras.",
            "options_or_text",
            options,
            {
                "phase": "choose_path",
                "path_ids": [p.get("path_id") for p in pack],
                "dictation_waiting_hints": await dialogue._dictation_waiting_hints(child),
            },
        )
        return [], [turn]
    return await dialogue._start_path_choice(
        child, session_id, session, sequence, refresh_after_complete=True
    )


async def _grade_with_vision(
    canonical: str,
    photo_url: str,
    child: dict[str, Any],
) -> dict[str, Any] | None:
    try:
        from app.ai.agents.registry import build_agent
        from app.ai.gemini_gateway import GeminiGateway

        gateway = GeminiGateway()
        prompt = (
            "Transcribe la letra manuscrita en castellano de España. "
            "No inventes. Si no se lee, unreadable=true y confidence bajo. "
            f"El texto canónico (interno, no lo recites entero) tiene {len(canonical.split())} palabras."
        )

        async def _run(model_id: str):
            agent = build_agent("dictation_grader", model=gateway.model_string(model_id))
            result = await agent.run(prompt)
            return result.output

        envelope, _model = await gateway.run_with_model_list(
            "dictation_grader",
            _run,
            child_id=str(child.get("id") or "") or None,
        )
        return {
            "transcription": envelope.transcription,
            "confidence": envelope.confidence,
            "unreadable": envelope.unreadable or envelope.confidence < 0.45,
            "mentor_text": envelope.mentor_text,
        }
    except Exception:
        return None


def _result_prose(
    graded: dict[str, Any],
    passed: bool,
    world: str,
    grade_llm: dict[str, Any] | None,
) -> str:
    if grade_llm and grade_llm.get("mentor_text"):
        return str(grade_llm["mentor_text"])
    if passed:
        return (
            "Bien copiado. El parte queda registrado."
            if world == "sci-fi"
            else "Bien copiado. El recado queda claro."
        )
    bits = []
    for err in graded.get("errors") or []:
        expected = str(err.get("expected") or "").strip()
        got = str(err.get("got") or "").strip()
        if expected:
            bits.append(f"«{got or '…'}» → «{expected}»")
        if len(bits) >= 4:
            break
    detail = " ".join(bits) if bits else "Hay letras que no coinciden."
    return f"Casi. Mira estas palabras: {detail}"
