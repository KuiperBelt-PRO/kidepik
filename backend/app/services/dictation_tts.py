"""Cache WAV de dictado (SPEC_AI_GEMINI_TTS)."""
from __future__ import annotations

import base64
import hashlib
import io
import wave
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Any

import httpx

from app.ai.errors import AiProductError, classify_gemini_exception, product_error
from app.config import Settings, get_settings
from app.logging_ import AppLogger

ai_log = AppLogger("ai")

GeneratePcm = Callable[[str, str, str], Awaitable[bytes]]

# Voces Gemini TTS (prebuilt). Mixto para oído: no siempre la misma.
FEMALE_VOICES = ("Kore", "Aoede", "Leda", "Callirrhoe")
MALE_VOICES = ("Puck", "Charon", "Fenrir", "Orus")


def pick_dictation_voice(dictation_id: str) -> tuple[str, str]:
    digest = hashlib.sha256(f"tts-voice|{dictation_id}".encode("utf-8")).digest()
    gender = "female" if digest[0] % 2 == 0 else "male"
    pool = FEMALE_VOICES if gender == "female" else MALE_VOICES
    idx = int.from_bytes(digest[1:3], "big") % len(pool)
    return pool[idx], gender


def pcm16_to_wav(pcm: bytes, sample_rate: int = 24000, channels: int = 1) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as handle:
        handle.setnchannels(channels)
        handle.setsampwidth(2)
        handle.setframerate(sample_rate)
        handle.writeframes(pcm)
    return buf.getvalue()


def cached_audio_path(media_root: Path | str, user_id: str, dictation_id: str) -> Path:
    safe_user = "".join(ch for ch in str(user_id) if ch.isalnum() or ch in "-_")
    safe_id = "".join(ch for ch in str(dictation_id) if ch.isalnum() or ch in "-_")
    return Path(media_root) / "audio" / safe_user / f"{safe_id}.wav"


def cached_audio_url(
    media_root: Path | str,
    user_id: str,
    dictation_id: str,
    *,
    public_base: str = "/media",
) -> str | None:
    path = cached_audio_path(media_root, user_id, dictation_id)
    if path.is_file() and path.stat().st_size > 0:
        return f"{public_base.rstrip('/')}/audio/{path.parent.name}/{path.name}"
    return None


def write_cached_wav(
    media_root: Path | str,
    *,
    user_id: str,
    dictation_id: str,
    wav_bytes: bytes,
    public_base: str = "/media",
) -> str:
    path = cached_audio_path(media_root, user_id, dictation_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(wav_bytes)
    return f"{public_base.rstrip('/')}/audio/{path.parent.name}/{path.name}"


async def generate_gemini_tts_pcm(
    model_id: str,
    text: str,
    tts_instruction: str,
    *,
    settings: Settings | None = None,
    voice: str | None = None,
) -> bytes:
    cfg = settings or get_settings()
    key = cfg.gemini_api_key_resolved()
    if not key:
        raise product_error("ai_not_configured")
    voice_name = str(voice or getattr(cfg, "ai_tts_voice", None) or "Kore")
    language = str(getattr(cfg, "ai_tts_language", None) or "es-ES")
    prompt = (
        f"{tts_instruction or 'Dictado escolar en castellano de España. Lento, pausas entre oraciones.'}\n"
        f"Idioma: castellano de España ({language}). Voz {voice_name}.\n\n"
        f"Lee en voz alta, sin añadir nada:\n{text}"
    )
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model_id}:generateContent"
    )
    payload: dict[str, Any] = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {
                "voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice_name}},
            },
        },
    }
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                url,
                params={"key": key},
                json=payload,
                headers={"Content-Type": "application/json"},
            )
            response.raise_for_status()
            body = response.json()
    except Exception as exc:  # noqa: BLE001
        classified = classify_gemini_exception(exc)
        raise product_error(
            classified.error_code,
            model=model_id,
            retryable=classified.retryable,
            http_status=classified.http_status,
        ) from exc
    _ = language
    try:
        b64 = body["candidates"][0]["content"]["parts"][0]["inlineData"]["data"]
        raw = base64.b64decode(b64)
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        raise product_error("ai_compose_failed", model=model_id) from exc
    if len(raw) >= 12 and raw[:4] == b"RIFF":
        return raw
    return raw


async def synthesize_dictation(
    *,
    canonical_text: str,
    dictation_id: str,
    user_id: str,
    media_root: Path | str,
    tts_instruction: str = "",
    settings: Settings | None = None,
    generate_pcm: GeneratePcm | None = None,
    public_base: str = "/media",
) -> tuple[str, str]:
    """Sintetiza una vez; si hay WAV cacheado no llama a Gemini.

    Returns
    -------
    tuple[str, str]
        ``(audio_url, model_id)``. ``model_id`` es ``cache`` si no hubo red.
    """
    cfg = settings or get_settings()
    hit = cached_audio_url(
        media_root, user_id, dictation_id, public_base=public_base
    )
    if hit:
        return hit, "cache"
    voice_name, gender = pick_dictation_voice(dictation_id)
    models = cfg.gemini_tts_model_list()
    last_code = "ai_quota_exhausted"
    gen = generate_pcm
    if gen is None:
        async def _default(model_id: str, text: str, instruction: str) -> bytes:
            return await generate_gemini_tts_pcm(
                model_id, text, instruction, settings=cfg, voice=voice_name
            )

        gen = _default
    for model_id in models:
        started = __import__("time").perf_counter()
        try:
            pcm = await gen(model_id, canonical_text, tts_instruction)
            wav = pcm if pcm[:4] == b"RIFF" else pcm16_to_wav(pcm)
            url = write_cached_wav(
                media_root,
                user_id=user_id,
                dictation_id=dictation_id,
                wav_bytes=wav,
                public_base=public_base,
            )
            ai_log.info(
                "llm_attempt",
                provider="gemini",
                model=model_id,
                ok=True,
                purpose="dictation_tts",
                voice=voice_name,
                voice_gender=gender,
                duration_ms=int((__import__("time").perf_counter() - started) * 1000),
            )
            return url, model_id
        except AiProductError as exc:
            last_code = exc.error_code
            ai_log.warning(
                "llm_attempt",
                provider="gemini",
                model=model_id,
                ok=False,
                purpose="dictation_tts",
                error_class=last_code,
            )
            continue
        except Exception as exc:  # noqa: BLE001
            classified = classify_gemini_exception(exc)
            last_code = classified.error_code
            ai_log.warning(
                "llm_attempt",
                provider="gemini",
                model=model_id,
                ok=False,
                purpose="dictation_tts",
                error_class=last_code,
            )
            continue
    raise product_error(last_code if last_code else "ai_quota_exhausted")

