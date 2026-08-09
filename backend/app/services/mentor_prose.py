"""Validación de prosa del mentor y arquetipos (SPEC_APP_MENTOR_PROSE_CLARITY)."""
from __future__ import annotations

import re
from typing import Any

# Muletillas y giros «olor a LLM» — castellano de España, tono natural.
BANNED_PHRASES: tuple[str, ...] = (
    "vibra",
    "vibrar",
    "resuena",
    "resonar",
    "resonancia",
    "armar un examen",
    "armar la prueba",
    "armar el examen",
    "armamos un examen",
    "armamos la prueba",
    "tejer",
    "danza",
    "danzar",
    "sumérgete",
    "embarcarte",
    "embarcarse",
    "telón de",
    "hilo conductor",
    "en el corazón de",
    "viaje épico",
    "tapiz de",
    "tejiendo",
    "cúmulo de",
    "sinfín de",
    "desplegar",
    "desplegando",
    "entrelazar",
    "entrelaz",
    "susurra el viento",
    "susurran las",
    "ecos del destino",
    "tejiendo el destino",
    "forjar tu camino",
    "trama del destino",
    "llama interior",
    "chispa del saber",
    "equilibrio tiembla",
    "equilibrio se rompe",
    "pergeñar",
    "dilucidar",
    "elucubrar",
    "empyreo",
)

MULETILLA_LIMITS: dict[str, int] = {
    "niebla": 2,
    "chispa": 1,
    "runa": 2,
    "fragmento": 2,
    "equilibrio": 1,
}

_SLUG_RE = re.compile(r"^[a-z][a-z0-9_]{1,23}$")

_NON_HUMAN_LABEL_TERMS: dict[str, tuple[str, ...]] = {
    "fantasy": (
        "elfo",
        "élfo",
        "elfa",
        "orco",
        "orca",
        "enano",
        "enana",
        "hada",
        "dragón",
        "dragon",
        "gnomo",
        "centauro",
        "fénix",
        "fenix",
        "troll",
        "duende",
        "trasgo",
    ),
    "sci-fi": (
        "androide",
        "robot",
        "alien",
        "alienígena",
        "alienigena",
        "cyborg",
        "sintético",
        "sintetico",
        "clon",
    ),
}

_SLUG_SPECIES_MARKERS = (
    "elfo",
    "elfa",
    "orco",
    "enano",
    "enana",
    "androide",
    "alien",
    "robot",
    "hada",
    "dragon",
    "gnomo",
    "troll",
)

# Marcas, personajes y lugares icónicos de franquicias (substring, minúsculas).
# No incluir tropos genéricos (elfo, mago, nave, etc.).
FRANCHISE_MARKERS: tuple[str, ...] = (
    "gandalf",
    "frodo",
    "bilbo",
    "mordor",
    "hobbit",
    "shire",
    "sauron",
    "gollum",
    "aragorn",
    "legolas",
    "rivendell",
    "balrog",
    "galadriel",
    "saruman",
    "hogwarts",
    "hermione",
    "voldemort",
    "dumbledore",
    "gryffindor",
    "slytherin",
    "hufflepuff",
    "ravenclaw",
    "quidditch",
    "harry potter",
    "jedi",
    "sith",
    "darth",
    "yoda",
    "skywalker",
    "tatooine",
    "vader",
    "chewbacca",
    "mandalorian",
    "grogu",
    "spider-man",
    "spiderman",
    "iron man",
    "ironman",
    "hulk",
    "avengers",
    "thor",
    "batman",
    "superman",
    "gotham",
    "wonder woman",
    "hyrule",
    "zelda",
    "pikachu",
    "pokémon",
    "pokemon",
    "winterfell",
    "targaryen",
    "daenerys",
    "juego de tronos",
    "game of thrones",
    "arthas",
    "thrall",
    "orgrimmar",
    "azeroth",
    "warcraft",
    "arrakis",
    "atreides",
    "narnia",
    "aslan",
    "dragon ball",
    "goku",
    "saiyan",
    "desdentao",
    "hiccup",
    "cómo entrenar a tu dragón",
    "como entrenar a tu dragon",
    "percy jackson",
    "campamento mestizo",
    "star trek",
    "spock",
    "enterprise",
    "matrix",
    "morpheus",
    "wolverine",
    "x-men",
    "xmen",
    "muggles",
    "muggle",
    "padawan",
    "lightsaber",
    "sable de luz",
    "middle-earth",
    "tierra media",
)


def franchise_violations_in_text(text: str) -> list[str]:
    """Devuelve marcadores de franquicia detectados en el texto."""
    lower = (text or "").lower()
    if not lower:
        return []
    return [marker for marker in FRANCHISE_MARKERS if marker in lower]


def _franchise_issues_for_fields(*fields: str) -> list[str]:
    issues: list[str] = []
    seen: set[str] = set()
    for field in fields:
        for marker in franchise_violations_in_text(field):
            if marker in seen:
                continue
            seen.add(marker)
            issues.append(
                f"evita referencia a franquicia conocida («{marker}»); inventa nombres originales"
            )
    return issues


def _label_mentions_non_human(label: str, world_theme: str | None) -> bool:
    lower = label.lower()
    terms = _NON_HUMAN_LABEL_TERMS.get(world_theme or "", ())
    if not terms:
        terms = _NON_HUMAN_LABEL_TERMS["fantasy"] + _NON_HUMAN_LABEL_TERMS["sci-fi"]
    return any(term in lower for term in terms)


def _slug_implies_non_human(slug: str) -> bool:
    return any(marker in slug for marker in _SLUG_SPECIES_MARKERS)


def validate_mentor_prose(text: str) -> list[str]:
    """Devuelve incidencias de prosa; lista vacía = OK."""
    issues: list[str] = []
    body = (text or "").strip()
    if not body:
        issues.append("agent_text vacío")
        return issues
    lower = body.lower()
    for phrase in BANNED_PHRASES:
        if phrase in lower:
            issues.append(f"evita la expresión «{phrase}»")
    for term, limit in MULETILLA_LIMITS.items():
        if lower.count(term) > limit:
            issues.append(f"demasiadas repeticiones de «{term}» (máx. {limit})")
    sentences = [s.strip() for s in re.split(r"[.!?]+", body) if s.strip()]
    for sentence in sentences:
        words = sentence.split()
        if len(words) > 28:
            issues.append("frase demasiado larga; acorta a ≤28 palabras")
            break
    if len(body) > 520:
        issues.append("texto demasiado largo; máximo ~80 palabras")
    issues.extend(_franchise_issues_for_fields(body))
    return issues


def validate_species_options(
    options: list[dict[str, Any]] | None,
    world_theme: str | None,
) -> list[str]:
    """Valida 3 sugerencias de arquetipo generadas por el LLM.

    Un arquetipo puede combinar especie, profesión, rol o criatura. No se
    restringe deliberadamente a ``kind=creature``.
    """
    _ = world_theme
    issues: list[str] = []
    if not options or len(options) != 3:
        issues.append("debes devolver exactamente 3 opciones de arquetipo")
        return issues
    labels: list[str] = []
    theme = world_theme if world_theme in {"fantasy", "sci-fi"} else "fantasy"
    non_human_named = 0
    for idx, opt in enumerate(options):
        if not isinstance(opt, dict):
            issues.append(f"opción {idx + 1} inválida")
            continue
        oid = str(opt.get("id") or "").strip().lower()
        label = str(opt.get("label") or opt.get("text") or "").strip()
        desc = str(opt.get("description") or "").strip()
        if not _SLUG_RE.match(oid):
            issues.append(f"id de opción {idx + 1} debe ser slug en minúsculas (ej. zorro_brasas)")
        if len(label) < 2 or len(label) > 48:
            issues.append(f"etiqueta de opción {idx + 1} entre 2 y 48 caracteres")
        if desc and len(desc) > 120:
            issues.append(f"descripción de opción {idx + 1} demasiado larga")
        for field in (label, desc):
            for phrase in BANNED_PHRASES:
                if phrase in field.lower():
                    issues.append(f"opción {idx + 1}: evita «{phrase}»")
            for franchise_issue in _franchise_issues_for_fields(field):
                issues.append(f"opción {idx + 1}: {franchise_issue}")
        for franchise_issue in _franchise_issues_for_fields(oid):
            issues.append(f"opción {idx + 1}: {franchise_issue}")
        if _slug_implies_non_human(oid) and not _label_mentions_non_human(label, theme):
            issues.append(
                f"opción {idx + 1}: si no es humano, el label debe nombrar la especie"
            )
        if _label_mentions_non_human(label, theme):
            non_human_named += 1
        if label:
            labels.append(label.lower())
    if len(labels) != len(set(labels)):
        issues.append("las tres etiquetas deben ser distintas")
    if non_human_named < 1:
        issues.append(
            "al menos una opción debe nombrar una especie no humana en el label"
        )
    return issues
