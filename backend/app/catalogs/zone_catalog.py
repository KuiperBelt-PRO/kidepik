from __future__ import annotations


class ZoneCatalog:
    ZONE_IDS = ("zone_math", "zone_language", "zone_logic", "zone_science", "zone_culture")
    _subjects = {"zone_math": "math", "zone_language": "reading", "zone_logic": "logic", "zone_science": "science", "zone_culture": "culture"}
    _labels = {
        "fantasy": {"zone_math": "Las Torres de los Números", "zone_language": "El Bosque de los Relatos", "zone_logic": "El Laberinto de las Llaves", "zone_science": "La Forja de las Estrellas", "zone_culture": "Los Archivos del Reino"},
        "sci-fi": {"zone_math": "La Estación de los Números", "zone_language": "El Archivo de Señales", "zone_logic": "El Nodo de las Rutas", "zone_science": "El Laboratorio Orbital", "zone_culture": "La Biblioteca de Mundos"},
    }
    @classmethod
    def subject_for_zone(cls, zone_id: str) -> str: return cls._subjects.get(zone_id, "math")
    @classmethod
    def label(cls, theme: str, zone_id: str) -> str: return cls._labels.get(theme, cls._labels["fantasy"]).get(zone_id, zone_id)
