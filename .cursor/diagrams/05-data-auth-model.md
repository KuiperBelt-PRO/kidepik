# 05 — Auth y modelo de datos

**Specs:** [SPEC_APP_AUTH.md](../specify/SPEC_APP_AUTH.md), [SPEC_APP_AUTH_GOOGLE_IMPLEMENTATION.md](../specify/SPEC_APP_AUTH_GOOGLE_IMPLEMENTATION.md), migraciones en `supabase/migrations/`

## Auth tutor (MVP)

```mermaid
sequenceDiagram
  participant U as Tutor
  participant Web as web/ auth-panel
  participant SB as Supabase Auth
  participant API as PHP /parents/*
  participant PG as Postgres

  U->>Web: Google OAuth PKCE
  Web->>SB: signInWithOAuth
  SB-->>Web: session JWT
  Web->>API: POST /parents/bootstrap Bearer
  API->>SB: GET /auth/v1/user
  API->>PG: upsert parent_accounts
  API-->>Web: parent profile
```

## Modelo relacional (tablas clave)

```mermaid
erDiagram
  auth_users ||--|| parent_accounts : "auth_user_id"
  parent_accounts ||--o{ children : "parent_id"
  children ||--|| child_permissions : "child_id"
  legal_documents {
    text slug
    int version
    text body_markdown
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
    text world_theme
    text onboarding_step
    text placement_status
    text status
  }
  child_permissions {
    bool allow_solo_start
    int max_session_minutes
    int session_limit_per_day
    bool require_exit_pin
  }
```

## Migraciones (orden)

| Timestamp | Contenido |
| --- | --- |
| `20260615000000` | `poc_health` |
| `20260720163000` | `legal_documents` |
| `20260725140000` | seed legal v2 |
| `20260725180000` | `parent_accounts` |
| `20260726230000` | `parent_accounts.settings` jsonb |
| `20260726230100` | `children` + `child_permissions` |
| `20260728220000` | `max_session_minutes` 5–120 step 5 |

## `parent_accounts.settings` (defaults)

Claves: `ui_theme`, `font_scale_ui`, `font_scale_play`, `reduce_motion`, `world_intensity`, `crew_defaults`, `learning`, `narrative`, `privacy`, `schema_version` — ver `ParentSettingsService::defaults()`.

## Anti-errores

- Slugs legales DB: `terms` / `privacy`; front/hash: `terminos` / `privacidad` (mapeo en LegalController).
- RLS: lecturas selectivas; **mutaciones de negocio por PHP**, no por cliente authenticated.
- MVP auth = **solo Google**.
