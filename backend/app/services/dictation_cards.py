"""Cartas de dictado en la encrucijada (producto + debug)."""
from __future__ import annotations

import hashlib
from typing import Any

from app.services.dictation_settings import DEFAULT_EVERY_N, MAX_EVERY_N, MIN_EVERY_N, is_offer_mandatory

DEBUG_DICTATION_OPTION_ID = "debug_start_dictation"
PRODUCT_DICTATION_OPTION_ID = "start_path_dictation"
START_DICTATION_OPTION_ID = "start_dictation"
DICTATION_OPTION_IDS = frozenset({DEBUG_DICTATION_OPTION_ID, PRODUCT_DICTATION_OPTION_ID})

_CARDS: dict[str, tuple[tuple[str, str], ...]] = {
    "sci-fi": (
        (
            "Prueba de transcripción interestelar",
            "Copia el parte de radio como un oficial de puente.",
        ),
        (
            "Bitácora de la baliza",
            "Transcribe el mensaje que acaba de llegar.",
        ),
    ),
    "fantasy": (
        (
            "Recado del cronista",
            "Escribe al dictado el aviso de la hermandad.",
        ),
        (
            "Eco del pergamino",
            "El Guía te dicta el recado; tú lo copias en papel.",
        ),
    ),
}


def _card_copy(world: str, *, rotate_key: str = "") -> tuple[str, str]:
    theme = "sci-fi" if world == "sci-fi" else "fantasy"
    catalog = _CARDS[theme]
    digest = hashlib.sha256(f"{theme}|{rotate_key}".encode("utf-8")).digest()
    idx = int.from_bytes(digest[:2], "big") % len(catalog)
    return catalog[idx]


def debug_dictation_card(world: str, *, rotate_key: str = "") -> dict[str, str]:
    title, blurb = _card_copy(world, rotate_key=rotate_key)
    return {
        "id": DEBUG_DICTATION_OPTION_ID,
        "label": title,
        "description": blurb,
        "kind": "debug_dictation",
        "badge": "debug",
    }


def start_dictation_option(world: str) -> dict[str, str]:
    label = "Sintonizar el parte" if world == "sci-fi" else "Escuchar el recado"
    return {"id": START_DICTATION_OPTION_ID, "label": label}


def listen_prompt(world: str) -> str:
    if world == "sci-fi":
        return "Cópialo en papel. Cuando acabes, captura una foto del recado."
    return "Escríbelo en papel. Cuando acabes, haz una foto del recado."


def product_dictation_card(world: str, *, rotate_key: str = "") -> dict[str, str]:
    title, blurb = _card_copy(world, rotate_key=rotate_key)
    return {
        "id": PRODUCT_DICTATION_OPTION_ID,
        "label": title,
        "description": blurb,
        "kind": "dictation",
    }


def merge_debug_dictation_option(
    options: list[dict[str, Any]],
    *,
    enabled: bool,
    world: str,
    rotate_key: str = "",
) -> list[dict[str, Any]]:
    if not enabled:
        return list(options)
    merged = [opt for opt in options if str(opt.get("id") or "") != DEBUG_DICTATION_OPTION_ID]
    merged.append(debug_dictation_card(world, rotate_key=rotate_key))
    return merged


def merge_choose_path_dictation_options(
    options: list[dict[str, Any]],
    *,
    product_enabled: bool,
    debug_enabled: bool = False,
    offer_skips: int = 0,
    every_n: int = DEFAULT_EVERY_N,
    world: str = "fantasy",
    rotate_key: str = "",
) -> list[dict[str, Any]]:
    paths = [opt for opt in options if str(opt.get("id") or "") not in DICTATION_OPTION_IDS]
    n = every_n if type(every_n) is int else DEFAULT_EVERY_N
    n = max(MIN_EVERY_N, min(MAX_EVERY_N, n))
    skips = offer_skips if type(offer_skips) is int else 0
    if product_enabled and is_offer_mandatory(
        {"enabled": True, "every_n": n, "offer_skips": skips}
    ):
        return [product_dictation_card(world, rotate_key=rotate_key)]
    if product_enabled:
        return [*paths, product_dictation_card(world, rotate_key=rotate_key)]
    if debug_enabled:
        return merge_debug_dictation_option(
            paths, enabled=True, world=world, rotate_key=rotate_key
        )
    return list(paths)
