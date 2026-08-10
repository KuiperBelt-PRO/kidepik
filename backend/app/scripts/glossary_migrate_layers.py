"""Migra glosarios JSONL al esquema en capas v2 (SPEC_APP_GLOSSARY_LAYERED_COMPOSITION).

Uso:
  python -m app.scripts.glossary_migrate_layers --dry-run
  python -m app.scripts.glossary_migrate_layers --apply
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from app.ai.orchestrator.glossary_layers import default_glossary_dir

_FANTASY_INGREDIENTS: list[dict[str, Any]] = [
    {
        "id": "fx_slot_passerelle",
        "world": "fantasy",
        "layer": "ingredient",
        "slot": "place_form",
        "kind": "place_type",
        "term": "pasarela",
        "definition": "Camino estrecho entre dos alturas; invita a ir despacio.",
        "tags": ["viaje", "altura"],
        "tone_notes": "aventura suave",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "fx_slot_clearing",
        "world": "fantasy",
        "layer": "ingredient",
        "slot": "place_form",
        "kind": "place_type",
        "term": "claro",
        "definition": "Espacio abierto entre árboles o rocas, bueno para hacer una pausa.",
        "tags": ["naturaleza"],
        "tone_notes": "maravilla calmada",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "fx_slot_tower",
        "world": "fantasy",
        "layer": "ingredient",
        "slot": "place_form",
        "kind": "place_type",
        "term": "torre",
        "definition": "Estructura alta desde la que se observa el camino.",
        "tags": ["altura", "vigilancia"],
        "tone_notes": "misterio amable",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "fx_slot_grove",
        "world": "fantasy",
        "layer": "ingredient",
        "slot": "place_form",
        "kind": "place_type",
        "term": "arboleda",
        "definition": "Grupo de árboles viejos que guardan silencio y sombra.",
        "tags": ["naturaleza", "bosque"],
        "tone_notes": "calma",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "fx_slot_grotto",
        "world": "fantasy",
        "layer": "ingredient",
        "slot": "place_form",
        "kind": "place_type",
        "term": "gruta",
        "definition": "Cavidad rocosa con eco suave; pide atención antes de entrar.",
        "tags": ["roca", "misterio"],
        "tone_notes": "misterio amable",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "fx_slot_trail",
        "world": "fantasy",
        "layer": "ingredient",
        "slot": "place_form",
        "kind": "place_type",
        "term": "sendero",
        "definition": "Camino marcado entre hierba y piedras.",
        "tags": ["viaje"],
        "tone_notes": "aventura suave",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "fx_slot_vapor",
        "world": "fantasy",
        "layer": "ingredient",
        "slot": "place_mood",
        "kind": "phenomenon",
        "term": "vapor tenue",
        "definition": "Niebla ligera que suaviza las formas sin ocultar del todo.",
        "tags": ["atmósfera"],
        "tone_notes": "aventura suave",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "fx_slot_crystal_light",
        "world": "fantasy",
        "layer": "ingredient",
        "slot": "place_mood",
        "kind": "phenomenon",
        "term": "cristal luminoso",
        "definition": "Destellos fríos y claros que guían sin deslumbrar.",
        "tags": ["luz", "magia"],
        "tone_notes": "maravilla calmada",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "fx_slot_moss",
        "world": "fantasy",
        "layer": "ingredient",
        "slot": "place_mood",
        "kind": "phenomenon",
        "term": "musgo húmedo",
        "definition": "Olor a tierra mojada y pasos silenciosos.",
        "tags": ["naturaleza"],
        "tone_notes": "calma",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "fx_slot_deep_silence",
        "world": "fantasy",
        "layer": "ingredient",
        "slot": "place_mood",
        "kind": "phenomenon",
        "term": "silencio profundo",
        "definition": "Quietud que invita a pensar antes de hablar.",
        "tags": ["atmósfera"],
        "tone_notes": "calma",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "fx_slot_warm_breeze",
        "world": "fantasy",
        "layer": "ingredient",
        "slot": "place_mood",
        "kind": "phenomenon",
        "term": "brisa cálida",
        "definition": "Aire suave que anima a seguir caminando.",
        "tags": ["atmósfera"],
        "tone_notes": "aventura suave",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "fx_slot_golden_light",
        "world": "fantasy",
        "layer": "ingredient",
        "slot": "place_mood",
        "kind": "phenomenon",
        "term": "luz dorada",
        "definition": "Rayos cálidos al atardecer que hacen todo más amable.",
        "tags": ["luz"],
        "tone_notes": "maravilla calmada",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "fx_slot_patience",
        "world": "fantasy",
        "layer": "ingredient",
        "slot": "place_lesson",
        "kind": "other",
        "term": "paciencia",
        "definition": "Tomarse el tiempo necesario antes de decidir.",
        "tags": ["aprendizaje"],
        "tone_notes": "ritmo pausado",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "fx_slot_observation",
        "world": "fantasy",
        "layer": "ingredient",
        "slot": "place_lesson",
        "kind": "other",
        "term": "observación",
        "definition": "Mirar con detalle antes de actuar.",
        "tags": ["aprendizaje"],
        "tone_notes": "calma",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "fx_slot_cooperation",
        "world": "fantasy",
        "layer": "ingredient",
        "slot": "place_lesson",
        "kind": "other",
        "term": "cooperación",
        "definition": "Avanzar mejor cuando el grupo se ayuda.",
        "tags": ["aprendizaje"],
        "tone_notes": "celebración",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "fx_slot_listening",
        "world": "fantasy",
        "layer": "ingredient",
        "slot": "place_lesson",
        "kind": "other",
        "term": "escucha",
        "definition": "Prestar atención a pistas pequeñas del entorno.",
        "tags": ["aprendizaje"],
        "tone_notes": "calma",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "fx_slot_balance",
        "world": "fantasy",
        "layer": "ingredient",
        "slot": "place_lesson",
        "kind": "other",
        "term": "equilibrio",
        "definition": "Mantener la calma cuando el camino se estrecha.",
        "tags": ["aprendizaje"],
        "tone_notes": "aventura suave",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "fx_slot_curiosity",
        "world": "fantasy",
        "layer": "ingredient",
        "slot": "place_lesson",
        "kind": "other",
        "term": "curiosidad",
        "definition": "Preguntar y probar con cuidado.",
        "tags": ["aprendizaje"],
        "tone_notes": "compañero juguetón",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "fx_slot_cartographer",
        "world": "fantasy",
        "layer": "ingredient",
        "slot": "role_archetype",
        "kind": "profession",
        "term": "cartógrafo",
        "definition": "Dibuja mapas y recuerda rutas seguras.",
        "tags": ["profesión", "viaje"],
        "tone_notes": "curioso",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "fx_slot_guardian",
        "world": "fantasy",
        "layer": "ingredient",
        "slot": "role_archetype",
        "kind": "profession",
        "term": "guardián",
        "definition": "Vigila un lugar y protege a quienes pasan.",
        "tags": ["profesión", "defensa"],
        "tone_notes": "sereno",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "fx_slot_librarian",
        "world": "fantasy",
        "layer": "ingredient",
        "slot": "role_archetype",
        "kind": "profession",
        "term": "bibliotecario",
        "definition": "Guarda libros y ayuda a encontrar respuestas.",
        "tags": ["profesión", "saber"],
        "tone_notes": "sabio amable",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "fx_slot_weaver",
        "world": "fantasy",
        "layer": "ingredient",
        "slot": "role_archetype",
        "kind": "profession",
        "term": "tejedor",
        "definition": "Une hilos, ideas y recursos con paciencia.",
        "tags": ["profesión", "artesano"],
        "tone_notes": "práctico",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "fx_slot_messenger",
        "world": "fantasy",
        "layer": "ingredient",
        "slot": "role_archetype",
        "kind": "profession",
        "term": "mensajero",
        "definition": "Lleva noticias y recados entre lugares lejanos.",
        "tags": ["profesión", "viaje"],
        "tone_notes": "activo",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "fx_slot_artisan",
        "world": "fantasy",
        "layer": "ingredient",
        "slot": "role_archetype",
        "kind": "profession",
        "term": "artesano",
        "definition": "Construye y repara con manos expertas.",
        "tags": ["profesión", "artesano"],
        "tone_notes": "práctico",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "fx_tone_wonder",
        "world": "fantasy",
        "layer": "ingredient",
        "slot": "tone",
        "kind": "other",
        "term": "maravilla calmada",
        "definition": "Asombro suave sin sobresaltos.",
        "tags": ["tono"],
        "tone_notes": "maravilla calmada",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "fx_tone_soft_adventure",
        "world": "fantasy",
        "layer": "ingredient",
        "slot": "tone",
        "kind": "other",
        "term": "aventura suave",
        "definition": "Riesgo leve y emoción amable.",
        "tags": ["tono"],
        "tone_notes": "aventura suave",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "fx_tone_kind_mystery",
        "world": "fantasy",
        "layer": "ingredient",
        "slot": "tone",
        "kind": "other",
        "term": "misterio amable",
        "definition": "Preguntas sin miedo ni amenaza.",
        "tags": ["tono"],
        "tone_notes": "misterio amable",
        "copy_policy": "forbid_literal",
    },
]

_SCIFI_INGREDIENTS: list[dict[str, Any]] = [
    {
        "id": "sf_slot_corridor",
        "world": "sci-fi",
        "layer": "ingredient",
        "slot": "sector_form",
        "kind": "place_type",
        "term": "pasillo orbital",
        "definition": "Tubo conectado entre módulos de la nave.",
        "tags": ["estructura"],
        "tone_notes": "claro y técnico suave",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "sf_slot_dome",
        "world": "sci-fi",
        "layer": "ingredient",
        "slot": "sector_form",
        "kind": "place_type",
        "term": "cúpula de observación",
        "definition": "Sala con ventanales para mirar las estrellas.",
        "tags": ["espacio"],
        "tone_notes": "curiosidad científica",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "sf_slot_bay",
        "world": "sci-fi",
        "layer": "ingredient",
        "slot": "sector_form",
        "kind": "place_type",
        "term": "bahía técnica",
        "definition": "Espacio para revisar equipos con calma.",
        "tags": ["tecnología"],
        "tone_notes": "práctico",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "sf_slot_node",
        "world": "sci-fi",
        "layer": "ingredient",
        "slot": "sector_form",
        "kind": "place_type",
        "term": "nodo de datos",
        "definition": "Sala con pantallas que muestran rutas y señales.",
        "tags": ["datos"],
        "tone_notes": "claro y técnico suave",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "sf_slot_airlock",
        "world": "sci-fi",
        "layer": "ingredient",
        "slot": "sector_form",
        "kind": "place_type",
        "term": "esclusa",
        "definition": "Puerta doble entre interior y vacío.",
        "tags": ["seguridad"],
        "tone_notes": "sereno",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "sf_slot_garden",
        "world": "sci-fi",
        "layer": "ingredient",
        "slot": "sector_form",
        "kind": "place_type",
        "term": "invernadero orbital",
        "definition": "Módulo verde para respirar y descansar.",
        "tags": ["vida"],
        "tone_notes": "calma",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "sf_slot_soft_hum",
        "world": "sci-fi",
        "layer": "ingredient",
        "slot": "signal_mood",
        "kind": "phenomenon",
        "term": "zumbido estable",
        "definition": "Vibración constante de máquinas en reposo.",
        "tags": ["atmósfera"],
        "tone_notes": "calma",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "sf_slot_blue_glow",
        "world": "sci-fi",
        "layer": "ingredient",
        "slot": "signal_mood",
        "kind": "phenomenon",
        "term": "luz azul tenue",
        "definition": "Iluminación de emergencia suave en pasillos.",
        "tags": ["luz"],
        "tone_notes": "claro y técnico suave",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "sf_slot_static",
        "world": "sci-fi",
        "layer": "ingredient",
        "slot": "signal_mood",
        "kind": "phenomenon",
        "term": "estática leve",
        "definition": "Chasquidos suaves en los altavoces.",
        "tags": ["señal"],
        "tone_notes": "misterio amable",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "sf_slot_starfield",
        "world": "sci-fi",
        "layer": "ingredient",
        "slot": "signal_mood",
        "kind": "phenomenon",
        "term": "campo estelar",
        "definition": "Millones de puntos de luz fuera del ventanal.",
        "tags": ["espacio"],
        "tone_notes": "maravilla calmada",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "sf_slot_cool_air",
        "world": "sci-fi",
        "layer": "ingredient",
        "slot": "signal_mood",
        "kind": "phenomenon",
        "term": "aire filtrado",
        "definition": "Brisa fría y limpia del sistema de vida.",
        "tags": ["atmósfera"],
        "tone_notes": "sereno",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "sf_slot_ping",
        "world": "sci-fi",
        "layer": "ingredient",
        "slot": "signal_mood",
        "kind": "phenomenon",
        "term": "ping rítmico",
        "definition": "Señal repetida que marca un ritmo seguro.",
        "tags": ["señal"],
        "tone_notes": "guía",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "sf_slot_protocol",
        "world": "sci-fi",
        "layer": "ingredient",
        "slot": "mission_lesson",
        "kind": "other",
        "term": "protocolo",
        "definition": "Seguir pasos acordados antes de improvisar.",
        "tags": ["aprendizaje"],
        "tone_notes": "claro y técnico suave",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "sf_slot_teamwork",
        "world": "sci-fi",
        "layer": "ingredient",
        "slot": "mission_lesson",
        "kind": "other",
        "term": "trabajo en equipo",
        "definition": "Coordinar roles para resolver un fallo.",
        "tags": ["aprendizaje"],
        "tone_notes": "celebración suave",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "sf_slot_scan",
        "world": "sci-fi",
        "layer": "ingredient",
        "slot": "mission_lesson",
        "kind": "other",
        "term": "escaneo",
        "definition": "Revisar datos antes de decidir.",
        "tags": ["aprendizaje"],
        "tone_notes": "curiosidad científica",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "sf_slot_calibration",
        "world": "sci-fi",
        "layer": "ingredient",
        "slot": "mission_lesson",
        "kind": "other",
        "term": "calibración",
        "definition": "Ajustar con paciencia hasta que todo encaje.",
        "tags": ["aprendizaje"],
        "tone_notes": "ritmo pausado",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "sf_slot_backup",
        "world": "sci-fi",
        "layer": "ingredient",
        "slot": "mission_lesson",
        "kind": "other",
        "term": "plan de respaldo",
        "definition": "Tener una segunda opción lista.",
        "tags": ["aprendizaje"],
        "tone_notes": "sereno",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "sf_slot_focus",
        "world": "sci-fi",
        "layer": "ingredient",
        "slot": "mission_lesson",
        "kind": "other",
        "term": "concentración",
        "definition": "Una tarea a la vez en situaciones nuevas.",
        "tags": ["aprendizaje"],
        "tone_notes": "calma",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "sf_slot_navigator",
        "world": "sci-fi",
        "layer": "ingredient",
        "slot": "crew_role",
        "kind": "profession",
        "term": "navegante",
        "definition": "Traza rutas y evita obstáculos en el espacio.",
        "tags": ["profesión", "viaje"],
        "tone_notes": "activo",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "sf_slot_medic",
        "world": "sci-fi",
        "layer": "ingredient",
        "slot": "crew_role",
        "kind": "profession",
        "term": "médico de tripulación",
        "definition": "Cuida al equipo y revisa signos vitales.",
        "tags": ["profesión", "cuidado"],
        "tone_notes": "amable",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "sf_slot_comm_officer",
        "world": "sci-fi",
        "layer": "ingredient",
        "slot": "crew_role",
        "kind": "profession",
        "term": "oficial de comunicaciones",
        "definition": "Traduce señales y mantiene el contacto.",
        "tags": ["profesión", "datos"],
        "tone_notes": "claro y técnico suave",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "sf_slot_mechanic",
        "world": "sci-fi",
        "layer": "ingredient",
        "slot": "crew_role",
        "kind": "profession",
        "term": "mecánico orbital",
        "definition": "Repara módulos con herramientas precisas.",
        "tags": ["profesión", "tecnología"],
        "tone_notes": "práctico",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "sf_slot_researcher",
        "world": "sci-fi",
        "layer": "ingredient",
        "slot": "crew_role",
        "kind": "profession",
        "term": "investigador",
        "definition": "Formula hipótesis y comprueba resultados.",
        "tags": ["profesión", "ciencia"],
        "tone_notes": "curiosidad científica",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "sf_slot_officer",
        "world": "sci-fi",
        "layer": "ingredient",
        "slot": "crew_role",
        "kind": "profession",
        "term": "oficial de puente",
        "definition": "Coordina decisiones con voz tranquila.",
        "tags": ["profesión", "liderazgo"],
        "tone_notes": "sereno",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "sf_tone_soft_tech",
        "world": "sci-fi",
        "layer": "ingredient",
        "slot": "tone",
        "kind": "other",
        "term": "ciencia amable",
        "definition": "Tecnología explicada sin alarmismo.",
        "tags": ["tono"],
        "tone_notes": "claro y técnico suave",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "sf_tone_calm_void",
        "world": "sci-fi",
        "layer": "ingredient",
        "slot": "tone",
        "kind": "other",
        "term": "vacío sereno",
        "definition": "Espacio profundo sin amenaza inmediata.",
        "tags": ["tono"],
        "tone_notes": "calma",
        "copy_policy": "forbid_literal",
    },
    {
        "id": "sf_tone_clean_puzzle",
        "world": "sci-fi",
        "layer": "ingredient",
        "slot": "tone",
        "kind": "other",
        "term": "reto limpio",
        "definition": "Problema con reglas claras y solución justa.",
        "tags": ["tono"],
        "tone_notes": "reto limpio",
        "copy_policy": "forbid_literal",
    },
]


def _infer_layer(row: dict[str, Any]) -> dict[str, Any]:
    if row.get("layer"):
        out = dict(row)
        out.setdefault("copy_policy", "forbid_literal")
        if out.get("layer") == "reference":
            out.setdefault("example_surface", out.get("term"))
        return out

    kind = str(row.get("kind") or "")
    out = dict(row)
    if kind == "species":
        out["layer"] = "ingredient"
        out["slot"] = "species"
        out["copy_policy"] = "forbid_literal"
    elif kind == "profession":
        out["layer"] = "ingredient"
        out["slot"] = "crew_role" if row.get("world") == "sci-fi" else "role_archetype"
        out["copy_policy"] = "forbid_literal"
    else:
        out["layer"] = "reference"
        out["example_surface"] = out.get("term")
        out["copy_policy"] = "forbid_literal"
        if kind in {"place_type", "artifact", "object", "phenomenon"}:
            out["composes_with"] = (
                ["sector_form", "signal_mood", "mission_lesson"]
                if row.get("world") == "sci-fi"
                else ["place_form", "place_mood", "place_lesson"]
            )
    return out


def migrate_file(path: Path, extra_ingredients: list[dict[str, Any]]) -> list[dict[str, Any]]:
    existing_ids: set[str] = set()
    migrated: list[dict[str, Any]] = []
    if path.is_file():
        with path.open(encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line:
                    continue
                row = json.loads(line)
                row = _infer_layer(row)
                existing_ids.add(str(row.get("id") or ""))
                migrated.append(row)
    for row in extra_ingredients:
        if str(row.get("id") or "") not in existing_ids:
            migrated.insert(0, row)
            existing_ids.add(str(row["id"]))
    return migrated


def write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser(description="Migrate glossary JSONL to layered schema v2")
    parser.add_argument("--dry-run", action="store_true", help="Show counts only")
    parser.add_argument("--apply", action="store_true", help="Write migrated JSONL files")
    args = parser.parse_args()
    if not args.dry_run and not args.apply:
        parser.error("Use --dry-run or --apply")

    root = default_glossary_dir()
    targets = [
        (root / "fantasy.jsonl", _FANTASY_INGREDIENTS),
        (root / "sci-fi.jsonl", _SCIFI_INGREDIENTS),
    ]
    for path, extras in targets:
        rows = migrate_file(path, extras)
        ingredients = sum(1 for r in rows if r.get("layer") == "ingredient")
        references = sum(1 for r in rows if r.get("layer") == "reference")
        print(f"{path.name}: {len(rows)} rows ({ingredients} ingredient, {references} reference)")
        if args.apply:
            write_jsonl(path, rows)
            print(f"  wrote {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
