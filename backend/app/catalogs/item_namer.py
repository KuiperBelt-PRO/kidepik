from __future__ import annotations

import hashlib
from typing import Any, Sequence

_MAX_LEN = 48

_FANTASY: dict[str, tuple[tuple[str, ...], tuple[str, ...]]] = {
    "potion": (
        ("Poción", "Elixir", "Frasco", "Brebaje"),
        ("de números claros", "de la niebla lúcida", "de palabras vivas", "del aliento sereno"),
    ),
    "scroll": (
        ("Pergamino", "Códice", "Rollo", "Grimorio"),
        ("de la segunda voz", "del relato eterno", "de las voces gemelas", "del saber antiguo"),
    ),
    "charm": (
        ("Amuleto", "Talismán", "Dije", "Sello"),
        ("del segundo golpe", "de la suerte quieta", "del retorno", "de la chispa fiel"),
    ),
    "artifact": (
        ("Lente", "Reliquia", "Prisma", "Runa"),
        ("del laberinto", "de los caminos ocultos", "del patrón secreto", "de la mirada justa"),
    ),
    "relic": (
        ("Orbe", "Cristal", "Núcleo", "Gema"),
        ("alquímico", "de los jardines", "del equilibrio", "de la savia"),
    ),
    "weapon": (
        ("Espada", "Hoja", "Daga", "Bastón"),
        ("del viento", "de la guarda", "del alba", "de la promesa"),
    ),
    "ward": (
        ("Escudo", "Broquel", "Égida", "Barrera"),
        ("del reino", "de musgo", "de la calma", "del claro"),
    ),
    "cloak": (
        ("Capa", "Manto", "Velo", "Sudario"),
        ("de hojas", "de estrellas suaves", "del viajero", "de la bruma"),
    ),
}

_SCIFI: dict[str, tuple[tuple[str, ...], tuple[str, ...]]] = {
    "program": (
        ("Programa", "Rutina", "Parche", "Script"),
        ("de cálculo", "de puente léxico", "de foco nítido", "de eco claro"),
    ),
    "module": (
        ("Módulo", "Cartucho", "Núcleo", "Chip"),
        ("de reintento", "de segundo ciclo", "de lectura", "de respaldo"),
    ),
    "datapad": (
        ("Holopad", "Tableta", "Archivo", "Bitácora"),
        ("de segunda voz", "de relatos", "de bitácora", "de memoria"),
    ),
    "artifact": (
        ("Escáner", "Sonda", "Prisma", "Lente"),
        ("de circuitos", "de patrones", "de ruta", "de lógica"),
    ),
    "tech": (
        ("Sonda", "Baliza", "Emisor", "Nodo"),
        ("científica", "de observación", "de laboratorio", "de órbita"),
    ),
    "blade": (
        ("Sable", "Cúter", "Haz", "Filo"),
        ("de plasma", "de ruta", "estelar", "de nebulosa"),
    ),
    "barrier": (
        ("Barrera", "Campo", "Escudo", "Malla"),
        ("cinética", "de fase", "de casco", "de tránsito"),
    ),
    "mesh": (
        ("Malla", "Capa", "Velo", "Traje"),
        ("de sigilo", "de tránsito", "de sombra", "de vacío"),
    ),
}

_SUBJECT_FLAVOR = {
    "math": ("numérico", "de cifras"),
    "language": ("de palabras", "léxico"),
    "reading": ("del relato", "de lectura"),
    "logic": ("de patrones", "del laberinto"),
    "science": ("alquímico", "de observación"),
}


class ItemNamer:
    """Nombres diegéticos de instancia al otorgar un arquetipo del catálogo."""

    @classmethod
    def propose(
        cls,
        *,
        world_theme: str,
        kind: str,
        subject_ids: Sequence[str],
        grant_key: str,
        agent_name: str | None = None,
        fallback: str | None = None,
        effects: Sequence[str] | None = None,
    ) -> str:
        """Return a visible item name.

        Parameters
        ----------
        world_theme, kind, subject_ids
            Archetype from the catalog.
        grant_key
            Stable seed so retries of the same grant keep the name.
        agent_name
            If the adventure agent invented a name, it wins (sanitized).
        fallback
            Catalog `label_child` if banks miss.
        effects
            Unused for copy; kept for call-site symmetry.
        """
        del effects
        chosen = cls.sanitize(agent_name)
        if chosen:
            return chosen
        banks = _SCIFI if world_theme == "sci-fi" else _FANTASY
        nouns, epithets = banks.get(kind, (("Hallazgo",), ("del viaje",)))
        digest = hashlib.sha256(f"{grant_key}:{kind}:{','.join(subject_ids)}".encode()).digest()
        noun = nouns[digest[0] % len(nouns)]
        extra = list(epithets)
        for sid in subject_ids:
            extra.extend(_SUBJECT_FLAVOR.get(str(sid), ()))
        epithet = extra[digest[1] % len(extra)] if extra else "del viaje"
        composed = cls.sanitize(f"{noun} {epithet}")
        return composed or cls.sanitize(fallback) or "Hallazgo del viaje"

    @staticmethod
    def sanitize(value: object) -> str | None:
        if not isinstance(value, str):
            return None
        text = " ".join(value.strip().split())
        if not text:
            return None
        if len(text) > _MAX_LEN:
            text = text[:_MAX_LEN].rstrip()
        return text


def instance_labels(
    defn: dict[str, Any],
    row: dict[str, Any],
    *,
    audience: str,
) -> tuple[str, str, str]:
    """Return (label_child, label_tutor_purpose, label_for_audience)."""
    meta = row.get("meta") if isinstance(row.get("meta"), dict) else {}
    granted = ItemNamer.sanitize(row.get("instance_name")) or ItemNamer.sanitize(
        meta.get("granted_name") if isinstance(meta, dict) else None
    )
    child = granted or str(defn.get("label_child") or "Hallazgo")
    purpose = str(defn.get("label_tutor") or defn.get("label_child") or child)
    del audience
    return child, purpose, child
