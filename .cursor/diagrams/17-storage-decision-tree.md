# 17 — Dónde guardar: árbol de decisión de almacenamiento

**Specs:** [SPEC_DATA_STORAGE_LAYERS.md](../specify/SPEC_DATA_STORAGE_LAYERS.md), [SPEC_AI_JOURNEY_FILE_LEDGER.md](../specify/SPEC_AI_JOURNEY_FILE_LEDGER.md), [SPEC_APP_PARALLEL_WORLDS.md](../specify/SPEC_APP_PARALLEL_WORLDS.md), [SPEC_APP_CANONICAL_VOCABULARY.md](../specify/SPEC_APP_CANONICAL_VOCABULARY.md)

```mermaid
flowchart TD
  Q([¿Qué dato es?]) --> A{¿Auth, ownership,<br/>permisos, PIN, settings?}
  A -- SI --> PG[(Supabase)]
  A -- NO --> B{¿Nivel/rango/materias activas<br/>oficiales para UI?}
  B -- SI --> PG
  B -- NO --> C{¿Frase de espera del catálogo?}
  C -- SI --> WAIT[Archivos data/waiting/*.jsonl]
  C -- NO --> D{¿Cola/índice/scores de<br/>examen o camino en curso?}
  D -- SI --> FS[Archivos JSONL sesión]
  D -- NO --> E{¿Diálogo, evento narrativo,<br/>summary, informe, glosario?}
  E -- SI --> FS2[Archivos JSONL/MD]
  E -- NO --> F{¿Ficha personaje<br/>especie/atuendo/…?}
  F -- SI --> MD[traveler.md]
  F -- NO --> G{¿Lista fija ids<br/>AgeBand / materias?}
  G -- SI --> CODE[Código Python catalogs]
  G -- NO --> H{¿Consulta/filtro sobre<br/>JSONL para agente?}
  H -- SI --> DUCK[DuckDB tool]
  H -- NO --> I{¿Banco estático de preguntas?}
  I -- SI --> NO[🚫 Prohibido PlacementBank]
  I -- NO --> REV[Revisar SPEC_DATA_STORAGE_LAYERS]
  DUCK --> FS2
  WAIT --> FS2
```

> **Nota:** Parquet / `.duckdb` persistente / ETL → **aplazado** (SPEC_DATA_STORAGE_LAYERS D13).  
> Frases de espera: JSONL (no Postgres).
## Resumen visual de capas

```mermaid
flowchart LR
  subgraph Producto
    PG[(Supabase)]
  end
  subgraph Viaje
    FS[data/journey worlds/*]
    GL[data/glossary/*.jsonl]
  end
  subgraph Consulta
    DK[DuckDB]
  end
  subgraph Vocabulario
    PY[AgeBand + SubjectCatalog]
  end
  UI --> PG
  UI --> API[FastAPI]
  API --> PG
  API --> FS
  API --> DK
  DK --> FS
  DK --> GL
  API --> PY
```

## Anti-errores

- DuckDB no guarda cuentas ni es fuente de niveles oficiales.
- Examen/retos **no** van a `placement_exams` / `narrative_quests`.
- `child_traits` PG → no; usar `traveler.md`.
