"""Validación de prosa del mentor y arquetipos (SPEC_APP_MENTOR_PROSE_CLARITY)."""
from __future__ import annotations

import re
from typing import Any

from app.catalogs.age_band import AgeBand

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
    "niebla": 1,
    "chispa": 1,
    "runa": 2,
    "fragmento": 2,
    "equilibrio": 1,
}

_AUDIENCE_MAX_WORDS_PER_SENTENCE: dict[str, int] = {
    AgeBand.EARLY: 12,
    AgeBand.CHILD: 18,
    AgeBand.TWEEN: 24,
    AgeBand.TEEN: 28,
    AgeBand.ADULT: 28,
    AgeBand.SENIOR: 28,
}

_CHILD_COMPLEX_MARKERS: tuple[str, ...] = (
    "onírico",
    "onirico",
    "vigía oníric",
    "vigia oniric",
    "sentinela oníric",
    "sentinela oniric",
    "custodio oníric",
    "custodio oniric",
    "penumbra",
    "remanso",
    "anhelad",
    "anhelar",
    "valía",
    "valia",
    "perentori",
    "efímer",
    "efemer",
    "luctuos",
    "inenarr",
    "empíreo",
    "empireo",
    "melancol",
    "sibil",
    "lambisc",
    "auspic",
    "opípar",
    "opipar",
    "limerenc",
)

_CHILD_POMPOUS_TITLE_RE = re.compile(
    r"\b(vigía|vigia|sentinela|custodio|arcano|heraldo)\s+[\wáéíóúñ]+",
    re.IGNORECASE,
)


def resolve_audience_band(age_band: str | None, age_years: int | None) -> str:
    """Resuelve la banda efectiva para validación de audiencia."""
    if age_years is not None:
        return AgeBand.from_age_years(age_years)
    if age_band and AgeBand.is_valid(age_band):
        return age_band
    legacy = AgeBand.from_legacy(age_band, age_years)
    return legacy or AgeBand.CHILD


def validate_audience_prose(
    text: str,
    *,
    age_band: str | None = None,
    age_years: int | None = None,
) -> list[str]:
    """Incidencias de registro inadecuado para la edad del explorador."""
    issues: list[str] = []
    body = (text or "").strip()
    if not body:
        return issues

    band = resolve_audience_band(age_band, age_years)
    if band not in {AgeBand.EARLY, AgeBand.CHILD, AgeBand.TWEEN}:
        return issues

    lower = body.lower()
    if band in {AgeBand.EARLY, AgeBand.CHILD}:
        for marker in _CHILD_COMPLEX_MARKERS:
            if marker in lower:
                issues.append(
                    f"vocabulario demasiado difícil para {band} (5–7 o 8–10 años); "
                    f"evita palabras como «{marker}» y usa lenguaje más sencillo"
                )
                break
        if not issues and _CHILD_POMPOUS_TITLE_RE.search(body):
            issues.append(
                f"apodo demasiado pomposo para {band}; "
                "usa frases sencillas como las del explorador (p. ej. «protector de los sueños»)"
            )

    max_words = _AUDIENCE_MAX_WORDS_PER_SENTENCE.get(band, 28)
    sentences = [s.strip() for s in re.split(r"[.!?]+", body) if s.strip()]
    for sentence in sentences:
        words = sentence.split()
        if len(words) > max_words:
            issues.append(
                f"frase demasiado larga para la edad del explorador; máximo ~{max_words} palabras"
            )
            break

    if band == AgeBand.EARLY and len(body) > 320:
        issues.append("texto demasiado largo para band_early; acorta a 2–3 frases simples")
    elif band == AgeBand.CHILD and len(body) > 420:
        issues.append("texto demasiado largo para un niño de 8–10 años; acorta la burbuja")

    return issues


def simple_character_agent_text(explorer_choice: str) -> str:
    """Prosa mínima cuando el LLM no respeta la audiencia infantil."""
    choice = (explorer_choice or "explorador").strip()
    return f"Perfecto: eres {choice}. ¿Empezamos tu prueba de ingreso?"


def path_compose_exhausted_mentor_text(child: dict[str, Any] | None) -> str:
    """Prosa del mentor cuando falla la composición de caminos (sin plantilla)."""
    data = child or {}
    theme = str(data.get("world_theme") or data.get("active_world_theme") or "fantasy")
    name = str(data.get("display_name") or "").strip()
    if theme == "sci-fi":
        if name:
            return (
                f"{name}, el observatorio ha devuelto un trazado inconsistente: "
                f"el relato y la prueba no encajan en la misma ruta. "
                f"No pasa nada — cuando pulses Reintentar, reabriré el mapa "
                f"y trazaré tres caminos nuevos desde cero."
            )
        return (
            "El cartografiado de las rutas de práctica se ha desalineado: "
            "algo en el pasaje no cuadra con la prueba que debía seguirle. "
            "Respira un momento. Al pulsar Reintentar, volveré a trazar "
            "tres senderos limpios desde el observatorio."
        )
    if name:
        return (
            f"{name}, el pergamino de las tres sendas se ha desdibujado: "
            f"el relato del camino y su prueba no van al unísono. "
            f"No importa — cuando pulses Reintentar, consultaré de nuevo "
            f"las runas y abriré tres senderos claros en la niebla."
        )
    return (
        "Las runas no dibujan bien el tríbulo de caminos: "
        "el pasaje contado y la prueba que debía seguirle no encajan. "
        "Respira hondo. Al pulsar Reintentar, volveré a trazar "
        "tres senderos limpios desde la encrucijada."
    )


def validate_traveler_profile_prose(
    *,
    agent_text: str,
    species: str | None = None,
    vibe: str | None = None,
    age_band: str | None = None,
    age_years: int | None = None,
    description_md: str | None = None,
    personality_md: str | None = None,
    avoid_phrases: list[str] | None = None,
) -> list[str]:
    """Valida prosa del character_coach (burbuja + campos visibles del perfil)."""
    issues: list[str] = []
    for issue in validate_mentor_prose(
        agent_text,
        age_band=age_band,
        age_years=age_years,
        avoid_phrases=avoid_phrases,
    ):
        issues.append(issue)
    for label, text in {
        "species": species or "",
        "vibe": vibe or "",
        "description_md": description_md or "",
        "personality_md": personality_md or "",
    }.items():
        if not text.strip():
            continue
        for issue in validate_audience_prose(
            text, age_band=age_band, age_years=age_years
        ):
            issues.append(f"{label}: {issue}")
    return issues


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


def validate_avoid_repetition(
    text: str,
    avoid_phrases: list[str] | None,
) -> list[str]:
    """Marca términos del glosario o chips ya usados en el viaje."""
    if not avoid_phrases:
        return []
    lower = (text or "").lower()
    issues: list[str] = []
    seen: set[str] = set()
    for phrase in avoid_phrases:
        key = phrase.strip().lower()
        if len(key) < 5 or key in seen:
            continue
        if key in lower:
            seen.add(key)
            issues.append(f"evita repetir «{phrase.strip()}» (ya usado en este viaje)")
    return issues


def validate_mentor_prose(
    text: str,
    *,
    age_band: str | None = None,
    age_years: int | None = None,
    avoid_phrases: list[str] | None = None,
) -> list[str]:
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
    issues.extend(
        validate_audience_prose(body, age_band=age_band, age_years=age_years)
    )
    issues.extend(validate_avoid_repetition(body, avoid_phrases))
    return issues


def validate_species_options(
    options: list[dict[str, Any]] | None,
    world_theme: str | None,
    *,
    age_band: str | None = None,
    age_years: int | None = None,
    avoid_phrases: list[str] | None = None,
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
            for audience_issue in validate_audience_prose(
                field, age_band=age_band, age_years=age_years
            ):
                issues.append(f"opción {idx + 1}: {audience_issue}")
            for repeat_issue in validate_avoid_repetition(field, avoid_phrases):
                issues.append(f"opción {idx + 1}: {repeat_issue}")
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
