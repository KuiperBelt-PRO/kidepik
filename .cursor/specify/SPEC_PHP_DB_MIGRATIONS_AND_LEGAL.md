# Spec: Migraciones PHP + documentos legales (Términos / Privacidad)

> Estado: **aprobada** (julio 2026)  
> Relacionado: [SPEC_PHP_BACKEND_ARCHITECTURE.md](SPEC_PHP_BACKEND_ARCHITECTURE.md), [SPEC_APP_AUTH.md](SPEC_APP_AUTH.md), [SPEC_POC_PHP_DREAMHOST_ARCHITECTURE.md](SPEC_POC_PHP_DREAMHOST_ARCHITECTURE.md)

## Objetivo

1. Un **runner de migraciones SQL en PHP** que reutiliza el directorio canónico de Supabase (`supabase/migrations/`), aplica pendientes al arrancar la API y expone una consulta de estado.
2. Como primera migración de prueba: tabla de **documentos legales versionados** (Términos y Política de privacidad) en Markdown, con API y pantallas que muestran **siempre la última versión**.

## Contexto

- Ya existen ficheros SQL bajo `supabase/migrations/` (p. ej. `20260615000000_poc_health.sql`) y el CLI de Supabase (`db reset` / `db push`).
- En DreamHost el runtime es **PHP** (sin CLI de Supabase en producción): las migraciones deben poder aplicarse solas al servir la API.
- Auth enlaza a `#/legal/terminos` y `#/legal/privacidad` ([SPEC_APP_AUTH.md](SPEC_APP_AUTH.md)); hoy son placeholders.

## Decisión de diseño — aprovechar Supabase

| Aspecto | Decisión |
| --- | --- |
| **Directorio canónico** | `supabase/migrations/` — mismo sitio para CLI local y runner PHP |
| **Nomenclatura** | `{YYYYMMDDHHMMSS}_{slug}.sql` (datetime + texto descriptivo) |
| **Historial** | Tabla `supabase_migrations.schema_migrations` (la que usa el CLI), clave `version` = el datetime del fichero |
| **Idempotencia** | Si un `.sql` ya está en el historial (CLI o PHP), el otro no lo reejecuta |
| **CLI local** | Sigue válido: `supabase db reset` / `db push` |
| **Producción** | Sin depender del CLI: PHP aplica pendientes en el bootstrap de la API |

### Por qué datetime al inicio (no `slug_datetime`)

El CLI de Supabase y la columna `version` esperan el prefijo temporal. Orden lexicográfico = orden de aplicación. Ejemplo:

```text
20260615000000_poc_health.sql
20260720163000_create_legal_documents.sql
```

### Patrón de referencia

Misma idea que PDA (`Shared\Services\Database::ensureMigrations()`), adaptada a Postgres + historial Supabase.

---

## Parte A — Sistema de migraciones PHP

### Componentes

| Pieza | Ubicación | Responsabilidad |
| --- | --- | --- |
| `MigrationRunner` | `shared/Database/MigrationRunner.php` | Listar `.sql`, comparar historial, aplicar pendientes, devolver estado |
| Bootstrap | `api/public/index.php` (antes del `dispatch`) | Llamar a `ensureApplied()` una vez por request (barato si no hay pendientes) |
| Consulta | `GET /api/v1/migrations/status` | Estado sin aplicar migraciones (solo lectura) |

### Nomenclatura de ficheros

```text
^{YYYYMMDDHHMMSS}_{slug}\.sql$
```

- `YYYYMMDDHHMMSS`: 14 dígitos (UTC recomendado al generar).
- `slug`: `[a-z0-9_]+` (snake_case).
- Ficheros que no cumplan el patrón se **ignoran** (log/warning en status).

### Historial (compatibilidad Supabase)

Al arrancar el runner:

1. `CREATE SCHEMA IF NOT EXISTS supabase_migrations;`
2. `CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
     version text PRIMARY KEY,
     name text,
     statements text[],
     applied_at timestamptz NOT NULL DEFAULT now()
   );`  
   (Si la tabla ya existe con columnas del CLI, no alterar de forma destructiva; insertar al menos `version` y, si existe la columna, `name`.)

3. Para cada fichero pendiente (orden por `version` ascendente):
   - Abrir transacción.
   - Ejecutar el SQL completo del fichero (PDO, `ERRMODE_EXCEPTION`).
   - `INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES (:version, :name)`.
   - Commit.
   - Si falla: rollback, **no** marcar como aplicada; el request falla con 503 y detalle en log (sin stack al cliente en prod).

### Concurrencia

Usar `pg_advisory_lock` / `pg_advisory_unlock` con una clave fija del proyecto durante `ensureApplied()`, para que dos requests concurrentes no apliquen la misma migración dos veces.

### Cuándo se aplica

| Momento | Comportamiento |
| --- | --- |
| Cada request a la API | `ensureApplied()` si hay `DATABASE_URL` |
| Sin `DATABASE_URL` | No-op (dev sin BD); status reporta `skipped` |
| `GET /api/v1/migrations/status` | **No** aplica; solo lista applied / pending / invalid |

### Contrato — consulta de estado

`GET /api/v1/migrations/status`

```json
{
  "ok": true,
  "directory": "supabase/migrations",
  "applied": [
    { "version": "20260615000000", "name": "poc_health", "applied_at": "2026-06-15T00:00:00+00:00" }
  ],
  "pending": [
    { "version": "20260720163000", "name": "create_legal_documents", "file": "20260720163000_create_legal_documents.sql" }
  ],
  "invalid_files": []
}
```

También incluir un resumen en `GET /api/v1/architecture/status`: `migrations: { pending_count, applied_count }`.

### Errores

| Caso | Respuesta API |
| --- | --- |
| Migración falla al aplicar | `503` JSON `{ "error": "Migration failed", "version": "…" }` (mensaje genérico al cliente) |
| Directorio inexistente | Status con `ok: false`, `error: "migrations_dir_missing"`; bootstrap no tumba health si no hay pendientes esperados |
| SQL malicioso / path traversal | Solo se leen ficheros `.sql` directamente bajo `supabase/migrations/` (basename validado) |

### Fuera de alcance (esta spec)

- Rollback automático (crear migración inversa a mano).
- UI admin para editar legales.
- Sustituir el CLI de Supabase en local (sigue siendo recomendado para `db reset`).

---

## Parte B — Documentos legales (prueba del sistema)

### Tabla

Migración: `YYYYMMDDHHMMSS_create_legal_documents.sql`

```sql
create table if not exists public.legal_documents (
    id uuid primary key default gen_random_uuid(),
    slug text not null check (slug in ('terms', 'privacy')),
    version integer not null check (version > 0),
    title text not null,
    body_markdown text not null,
    published_at timestamptz not null default now(),
    unique (slug, version)
);

create index if not exists legal_documents_slug_published_idx
    on public.legal_documents (slug, published_at desc);

alter table public.legal_documents enable row level security;

-- Lectura pública de la última versión vía API PHP (service role / DATABASE_URL).
-- Políticas RLS: select para anon/authenticated del contenido publicado (opcional PostgREST);
-- la fuente canónica de la app es la API PHP.

grant select on public.legal_documents to anon, authenticated;

create policy "Allow public read legal_documents"
    on public.legal_documents
    for select
    to anon, authenticated
    using (true);
```

Seed en la **misma** migración (o migración siguiente `…_seed_legal_documents_v1.sql`):

| slug | version | title |
| --- | --- | --- |
| `terms` | 1 | Términos de uso |
| `privacy` | 1 | Política de privacidad |

Contenido: Markdown en español (borrador producto, no asesoría legal firmada). Suficiente para pantallas y aceptación en auth.

### Regla de lectura

«Última versión» = para un `slug`, la fila con **mayor `version`**; empate imposible por `unique(slug, version)`. Alternativa equivalente: `order by published_at desc, version desc limit 1`.

### API

| Método | Ruta | Auth | Respuesta |
| --- | --- | --- | --- |
| `GET` | `/api/v1/legal/{slug}` | Pública | Última versión del slug |
| `GET` | `/api/v1/legal/{slug}/versions` | Pública (opcional) | Lista `{ version, title, published_at }` sin body |

`slug` aceptado: `terms` | `privacy`. Alias de ruta amigables (opcional en router):

- `/api/v1/legal/terminos` → `terms`
- `/api/v1/legal/privacidad` → `privacy`

Ejemplo `GET /api/v1/legal/terms`:

```json
{
  "slug": "terms",
  "version": 1,
  "title": "Términos de uso",
  "body_markdown": "# Términos…",
  "published_at": "2026-07-20T14:30:00+00:00"
}
```

404 si el slug no existe o no hay filas.

### Cliente web

| Ruta hash | Comportamiento |
| --- | --- |
| `#/legal/terminos` | Pantalla legal con mundo loader (bandas comprimidas), logo animado, markdown desde API, scroll custom blanco, FAB volver y subir |
| `#/legal/privacidad` | Igual para política de privacidad |

Transiciones animadas (FLIP) al entrar/salir desde el panel auth del loader; bandas fantasía/espacio se comprimen sin deformar proporciones.

### Versionado futuro

Nueva versión = **nueva fila** (mismo `slug`, `version` + 1) vía nueva migración SQL `INSERT`. No UPDATE in-place del body publicado (auditoría / aceptación histórica).

---

## Tests (PHPUnit)

| Test | Escenario |
| --- | --- |
| `MigrationRunnerTest` | Fichero pendiente se aplica y aparece en historial; segunda pasada no reejecuta |
| `MigrationRunnerTest` | Nombre inválido → `invalid_files`, no aplica |
| `MigrationStatusTest` | `GET /migrations/status` refleja applied/pending |
| `LegalDocumentsTest` | Tras migración, `GET /legal/terms` y `/legal/privacy` → 200 + markdown |
| `LegalDocumentsTest` | Con dos versiones seed, responde la mayor `version` |
| `LegalDocumentsTest` | Slug desconocido → 404 |

Tests de integración con stack Docker (`poc-up.ps1`) y `DATABASE_URL` del `.env.poc`.

## Validación observable

1. Arrancar stack; primera petición API aplica pendientes.
2. `GET /api/v1/migrations/status` → `pending: []`, incluye `create_legal_documents`.
3. `GET /api/v1/legal/terms` y `/privacy` → markdown.
4. Navegador (Playwright, viewport 390×844): `#/legal/terminos` y `#/legal/privacidad` muestran título + contenido; capturas bajo `tmp/playwright-output/`.

## Criterios de éxito

1. Un solo directorio de migraciones compartido con Supabase.
2. Auto-aplicación en bootstrap PHP sin CLI en producción.
3. Consulta de estado vía API.
4. Términos y Privacidad versionados en BD; la app muestra siempre la última.
5. PHPUnit verde + smoke Playwright de las dos pantallas legales.

## Aprobación

- [x] Usuario aprueba historial compartido `supabase_migrations.schema_migrations` + nomenclatura `{datetime}_{slug}.sql`
- [x] Usuario aprueba auto-apply en cada request API + endpoint `/api/v1/migrations/status`
- [x] Usuario aprueba tabla `legal_documents` + API pública + pantallas `#/legal/*`
- [x] Usuario aprueba textos seed como **borrador de producto** (no texto legal firmado)
