# Spec: Glosarios de mundo (JSONL + DuckDB)

> Estado: **aprobada** (ago 2026)  
> Relacionado: [SPEC_DATA_STORAGE_LAYERS.md](SPEC_DATA_STORAGE_LAYERS.md), [SPEC_AI_CENTRAL_ORCHESTRATOR.md](SPEC_AI_CENTRAL_ORCHESTRATOR.md), [SPEC_APP_WORLD_JOURNEY_CANON.md](SPEC_APP_WORLD_JOURNEY_CANON.md), [SPEC_AI_AGENT_SKILLS.md](SPEC_AI_AGENT_SKILLS.md)

## Contexto

Los agentes no deben depender solo del entrenamiento base para tipos de lugares, objetos, especies, fenómenos, etc. Hace falta un **glosario tipológico por mundo**, consultable por tool, **sin nombres propios** de personajes/lugares de la trama del niño.

## Objetivo

1. Formato JSONL de términos.
2. Tool DuckDB `glossary_search` para agentes.
3. Separación clara glosario ≠ biblia de zona con spoilers del viajero.

---

## 1. Decisiones

| # | Decisión | Valor |
| --- | --- | --- |
| G1 | Formato | **JSONL** por mundo |
| G2 | Consulta | Tool **DuckDB** (`glossary_search`) |
| G3 | Contenido | Tipos genéricos (lugares, objetos, especies, criaturas, fenómenos, artefactos…) |
| G4 | Prohibido | Nombres propios de NPCs/lugares de la sesión del niño |
| G5 | Mundos | Ficheros separados `fantasy` / `sci-fi` (+ opcional `shared`) |
| G6 | Autoría | Seed en repo; ampliación futura por tutor/ops fuera de MVP |

---

## 2. Ubicación

```
data/glossary/                 # o backend/data/glossary/ versionado
  fantasy.jsonl
  sci-fi.jsonl
  shared.jsonl                 # opcional: términos transversales
```

En Docker: montaje de lectura para el API; path vía settings `GLOSSARY_DATA_DIR`.

---

## 3. Esquema de línea JSONL

```json
{
  "id": "fx_crystal_grove",
  "world": "fantasy",
  "kind": "place_type",
  "term": "claro de cristales",
  "definition": "Claro natural donde afloran cristales luminosos; ambiente sereno, sin peligro gratuito.",
  "tags": ["naturaleza", "magia", "luz"],
  "tone_notes": "maravilla calmada; no terror"
}
```

| Campo | Tipo | Notas |
| --- | --- | --- |
| `id` | string | Estable, snake |
| `world` | `fantasy` \| `sci-fi` \| `shared` | |
| `kind` | enum | `place_type`, `object`, `species`, `creature`, `phenomenon`, `artifact`, `other` |
| `term` | string | Etiqueta corta ES |
| `definition` | string | 1–3 frases |
| `tags` | string[] | Filtrado |
| `tone_notes` | string? | Guía de prosa |

---

## 4. Tool `glossary_search`

```python
def glossary_search(
    world: Literal["fantasy", "sci-fi"],
    *,
    kind: str | None = None,
    tags: list[str] | None = None,
    query: str | None = None,
    limit: int = 8,
) -> list[GlossaryHit]:
    ...
```

Implementación: DuckDB `read_json_objects` / `read_ndjson_objects` sobre los JSONL del mundo + `shared`; filtro ILIKE en `term`/`definition`/`tags`.

Disponible para roles que lo declaren en frontmatter ([SPEC_AI_CENTRAL_ORCHESTRATOR](SPEC_AI_CENTRAL_ORCHESTRATOR.md)).

---

## 5. Criterios de aceptación

1. Al menos un JSONL seed fantasy y uno sci-fi con ≥ 10 términos cada uno (al implementar).
2. Test unitario: `glossary_search(world="fantasy", kind="place_type")` devuelve hits tipados.
3. Ningún término seed usa nombre propio de mentor canónico como lugar de trama del niño.
4. Documentado en capas de datos D10.

## Fuera de alcance

- UI de edición de glosario para tutores.
- Generación automática masiva de glosario por LLM (posible fase 2).
