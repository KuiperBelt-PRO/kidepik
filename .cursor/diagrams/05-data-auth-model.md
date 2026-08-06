# 05 — Auth y modelo de datos

**Specs:** [SPEC_APP_AUTH.md](../specify/SPEC_APP_AUTH.md), [SPEC_APP_AUTH_GOOGLE_IMPLEMENTATION.md](../specify/SPEC_APP_AUTH_GOOGLE_IMPLEMENTATION.md), [SPEC_DATA_STORAGE_LAYERS.md](../specify/SPEC_DATA_STORAGE_LAYERS.md), [SPEC_APP_PARALLEL_WORLDS.md](../specify/SPEC_APP_PARALLEL_WORLDS.md), [SPEC_APP_WAITING_PHRASES.md](../specify/SPEC_APP_WAITING_PHRASES.md), migraciones en `supabase/migrations/`

## Capas (ago 2026)

```mermaid
flowchart TB
  subgraph PG[Supabase Postgres]
    Auth[auth + parent_accounts]
    Child[children + permisos]
    Prog[progreso por mundo / niveles]
    Wait[waiting_phrases]
    Legal[legal_documents]
  end
  subgraph FS[Archivos data/journey + glossary]
    Traveler[traveler.md]
    Dial[dialogue.jsonl por mundo]
    Ev[events.jsonl examen/caminos]
    Gloss[glossary/*.jsonl]
  end
  subgraph Duck[DuckDB in-process]
    Tools[glossary_search / ledger_query]
  end
  Auth --- Child --- Prog
  Child -.-> Traveler
  Dial --> Tools
  Gloss --> Tools
  Ev --> Tools
```

## Auth tutor (MVP)

```mermaid
sequenceDiagram
  participant U as Tutor
  participant Web as web/ auth-panel
  participant SB as Supabase Auth
  participant API as FastAPI /parents/*
  participant PG as Postgres

  U->>Web: Google OAuth PKCE
  Web->>SB: signInWithOAuth
  SB-->>Web: session JWT
  Web->>API: POST /parents/bootstrap Bearer
  API->>SB: GET /auth/v1/user
  API->>PG: upsert parent_accounts
  API-->>Web: parent profile
```

## Modelo relacional (tablas clave de producto)

```mermaid
erDiagram
  auth_users ||--|| parent_accounts : "auth_user_id"
  parent_accounts ||--o{ children : "parent_id"
  children ||--|| child_permissions : "child_id"
  children ||--o{ child_world_progress : "por mundo"
  children ||--o{ user_subject_levels : "por mundo+materia"
  waiting_phrases {
    text world_theme
    text age_band
    text phase
    text body
  }
  parent_accounts {
    uuid id
    uuid auth_user_id
    text email
    text display_name
    jsonb settings
  }
  children {
    uuid id
    text display_name
    text active_world_theme
    text onboarding_step
    text status
  }
```

> **Deprecado como fuente de verdad:** `dialogue_turns`, `story_*`, `placement_exams`, `placement_answers`, `narrative_quests`, `child_traits` — ver [SPEC_DATA_STORAGE_LAYERS](../specify/SPEC_DATA_STORAGE_LAYERS.md).

## Migraciones (orden)

Ver `supabase/migrations/` y [SPEC_PHP_DB_MIGRATIONS_AND_LEGAL.md](../specify/SPEC_PHP_DB_MIGRATIONS_AND_LEGAL.md). Nuevas tablas de producto (`waiting_phrases`, `child_world_progress`) se añaden al implementar las specs propuesta.
