# Datos del producto y persistencia local

## Fuente versionada (Git)

Estos directorios son datos de producto y se despliegan con el código:

- `glossary/`: referencias JSONL por mundo para agentes.
- `waiting/`: frases de espera por mundo.
- `chapters/`: títulos de capítulos del sistema.

Docker los monta en `/data/{glossary,waiting,chapters}` (solo lectura en el contenedor `api`).

## Datos mutables locales (bind mount, no en Git por defecto)

Están **en el repo** vía volumen Docker (`docker/compose.yaml`), no ocultos dentro del contenedor:

| Carpeta en repo | Montaje en `api` | Contenido |
| --- | --- | --- |
| `data/journey/` | `/data/journey` | Ledger JSONL/MD por viajero |
| `web/media/` | `/var/www/html/media` | Archivos subidos |
| `web/logs/` | `/var/www/html/logs` | Logs de API/IA |

Persisten al reiniciar contenedores. Se pierden si borras esas carpetas o haces reset sin copia.

**Versionar en Git:** por defecto están en `.gitignore` (datos personales/de prueba). Si quieres fijar un fixture concreto (p. ej. un viaje de demo), puedes quitar la entrada del ignore o copiar a otra ruta versionada a propósito.

## Base de datos Supabase

- **Esquema versionado:** `supabase/migrations/`.
- **Datos de filas:** viven en volúmenes Docker gestionados por `supabase start` (no en el árbol del repo).
- `poc-up.ps1` hace `supabase db reset --local` y **borra** esos datos salvo que hagas backup antes.

## Backup local

Antes de `db reset`, `poc-down` con borrado de volúmenes o reset de journey:

```powershell
./scripts/poc-backup-local.ps1
# o con etiqueta:
./scripts/poc-backup-local.ps1 -Label "antes-reset"
```

Genera `data/backups/<timestamp>/` con copia de `journey`, `media`, `logs` y, si Supabase está arriba, `supabase.sql`.

`poc-up.ps1` y `poc-reset-journey.ps1 -Apply` ejecutan este backup automáticamente salvo que pases `-SkipBackup`.

## Aplicar cambios de montaje en Compose

Tras editar `docker/compose.yaml`:

```powershell
docker compose --env-file .env.poc -f docker/compose.yaml up -d api web
```
