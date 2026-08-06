# Spec: Frases de espera del mentor (JSONL)

> Estado: **aprobada / implementada** (ago 2026)  
> **Supersede:** decisión W1 anterior (tabla Postgres `waiting_phrases`).  
> Relacionado: [SPEC_APP_JOURNEY_MECHANICS.md](SPEC_APP_JOURNEY_MECHANICS.md), [SPEC_DATA_STORAGE_LAYERS.md](SPEC_DATA_STORAGE_LAYERS.md), [SPEC_APP_WORLD_GLOSSARY.md](SPEC_APP_WORLD_GLOSSARY.md), [SPEC_APP_AGE_BANDS.md](SPEC_APP_AGE_BANDS.md)

## Contexto

Durante compose LLM el cliente muestra frases de espera. El catálogo debe vivir junto al resto de **contenido estático versionable** (como glosarios), no en Postgres.

## Objetivo

1. Catálogo JSONL por mundo (y opcional `neutral`).
2. Servicio `pick_waiting_batch` leyendo ficheros (DuckDB opcional).
3. Contrato UI: rotación cada **8 s**; campo `waiting_hints` en turnos de compose.

---

## 1. Decisiones

| # | Decisión | Valor |
| --- | --- | --- |
| W1 | Store | **JSONL** bajo `data/waiting/` (no tabla PG) |
| W2 | Rotación UI | **8 segundos** entre frases |
| W3 | Filtros | `world_theme`, `age_band` (null = todas), `phase` |
| W4 | Contenido | Sin spoilear lugares/NPCs de la escena actual |
| W5 | Generación en caliente | **No** por defecto; seed en repo + posible job offline que reescriba JSONL |
| W6 | Migración | Dejar de usar `public.waiting_phrases`; seed SQL queda legado (no fuente de verdad) |
| W7 | DuckDB | Opcional para filtrar; lectura línea a línea válida en MVP |

---

## 2. Layout de archivos

```
data/waiting/
  fantasy.jsonl
  sci-fi.jsonl
  neutral.jsonl
```

Cada línea:

```json
{
  "id": "wait_fantasy_placement_01",
  "world_theme": "fantasy",
  "age_band": null,
  "phase": "placement_compose",
  "locale": "es",
  "body": "La historia toma aire antes de continuar.",
  "weight": 1,
  "active": true
}
```

Fases mínimas: `placement_compose`, `path_compose`, `challenge_compose`, `generic`.

---

## 3. Selección

```python
def pick_waiting_batch(
    *,
    world_theme: str,
    age_band: str | None,
    phase: str,
    limit: int = 12,
) -> list[str]:
    """Lee JSONL world + neutral; filtra active/locale/phase/age_band; weight/random; dedupe."""
```

Play adjunta `meta.waiting_hints` al iniciar compose largo (placement/path).

---

## 4. Criterios de aceptación

1. Seeds JSONL ≥ 6 frases útiles por mundo × fases core.
2. UI play rota cada 8 s usando solo esas frases (no tabla PG).
3. Ninguna frase seed menciona spoilers de zona/NPC de trama del niño.
4. `pick_waiting_batch` no consulta `waiting_phrases` en Postgres.

## Fuera de alcance

- Editor admin de frases.
- Parquet / `.duckdb` persistente / ETL (explícitamente **no** en este corte).
